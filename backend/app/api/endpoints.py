import os
import shutil
import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from typing import List
from app.config import settings
from app.models.schemas import (
    UploadResponse, DocumentInfo, ChatRequest, ChatResponse, HealthResponse,
    UserRegister, UserLogin, Token, GoogleAuthRequest, ContactRequest
)
from app.services.document import DocumentProcessor
from app.services.vector import VectorStoreService
from app.services.auth import AuthService
from app.rag.pipeline import RAGPipeline
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()

# Dependency Injection helpers to ensure service singletons per-request
def get_vector_service() -> VectorStoreService:
    return VectorStoreService()

def get_rag_pipeline(vector_service: VectorStoreService = Depends(get_vector_service)) -> RAGPipeline:
    return RAGPipeline(vector_service)

def get_auth_service() -> AuthService:
    return AuthService()

def send_welcome_email(username: str, email_address: str):
    """
    Sends a welcome email with a 'How to Use' guide to the user's email address.
    """
    log_dir = os.path.join(settings.VECTOR_DB_DIR, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "welcome_emails.txt")
    
    timestamp = datetime.datetime.now().isoformat()
    log_entry = (
        f"--- WELCOME EMAIL TO {email_address} ON {timestamp} ---\n"
        f"Recipient Email: {email_address}\n"
        f"Recipient Username: {username}\n"
        f"Subject: Welcome to RAG Knowledge Assistant!\n"
        f"Body:\n"
        f"Hi {username},\n\n"
        f"Welcome to the RAG Knowledge Assistant!\n\n"
        f"Here is a quick 'How to Use' guide to get you started:\n\n"
        f"1. Open the Workspace tab on your dashboard.\n"
        f"2. Upload one or more PDF files using the drag-and-drop zone or file picker.\n"
        f"3. Select which uploaded documents you want to active-query using the checkboxes in the Document Library sidebar.\n"
        f"4. Ask questions in the chat bar (e.g. 'Summarize section 2'). The assistant will retrieve precise snippets from your documents to answer your query.\n"
        f"5. Hover over citations to see context sources, document names, and snippet scores.\n\n"
        f"We hope this helps you manage and interact with your knowledge database efficiently!\n\n"
        f"Best regards,\n"
        f"Anupam Singh\n"
        f"-----------------------------------------------------\n\n"
    )
    
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
        print(f"[WELCOME EMAIL] Saved welcome email log for {email_address}.")
    except Exception as e:
        print(f"[WELCOME EMAIL] Failed to save local log: {str(e)}")
        
    # Real SMTP Email Integration Block
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    
    if smtp_server and smtp_user and smtp_password:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = email_address
            msg['Subject'] = "Welcome to RAG Knowledge Assistant - How to Use Guide"
            
            body = (
                f"Hi {username},\n\n"
                f"Welcome to the RAG Knowledge Assistant!\n\n"
                f"Here is a quick 'How to Use' guide to get you started:\n\n"
                f"1. Open the Workspace tab on your dashboard.\n"
                f"2. Upload one or more PDF files using the drag-and-drop zone or file picker.\n"
                f"3. Select which uploaded documents you want to active-query using the checkboxes in the Document Library sidebar.\n"
                f"4. Ask questions in the chat bar (e.g., 'Summarize section 2'). The assistant will retrieve precise snippets from your documents to answer your query.\n"
                f"5. Hover over citations to see context sources, document names, and snippet scores.\n\n"
                f"We hope this helps you manage and interact with your knowledge database efficiently!\n\n"
                f"Best regards,\n"
                f"Anupam Singh"
            )
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(smtp_server, int(smtp_port))
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, email_address, msg.as_string())
            server.quit()
            print(f"[WELCOME EMAIL] Real SMTP welcome email sent to {email_address} successfully.")
        except Exception as mail_err:
            print(f"[WELCOME EMAIL] Failed to send real SMTP welcome email to {email_address}: {str(mail_err)}")

def send_contact_email(name: str, email: str, subject: str, message: str):
    """
    Background task to send contact notification email via SMTP.
    """
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    
    if smtp_server and smtp_user and smtp_password:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = "anupamsingh8095@gmail.com"
            msg['Subject'] = f"Contact Form Submission: {subject}"
            
            body = (
                f"You have received a new contact message from your RAG Knowledge Assistant website.\n\n"
                f"Name: {name}\n"
                f"Email: {email}\n"
                f"Subject: {subject}\n"
                f"Message:\n{message}\n"
            )
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(smtp_server, int(smtp_port))
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, "anupamsingh8095@gmail.com", msg.as_string())
            server.quit()
            print("[CONTACT INBOX] Real SMTP email notification sent to anupamsingh8095@gmail.com successfully.")
        except Exception as mail_err:
            print(f"[CONTACT INBOX] Failed to send real SMTP email: {str(mail_err)}")

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> tuple[str, str]:
    """
    Extracts session token from Bearer header and verifies it.
    Returns (username, email)
    """
    token = credentials.credentials
    try:
        return auth_service.verify_session(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/auth/register")
def register_user(
    request: UserRegister, 
    background_tasks: BackgroundTasks,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Signs up a new user account with secure hashed password credentials.
    """
    try:
        auth_service.register_user(request.username, request.email, request.password)
        background_tasks.add_task(send_welcome_email, request.username, request.email)
        return {"message": "Account created successfully. You can now log in."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal database registration error: {str(e)}")

@router.post("/auth/login", response_model=Token)
def login_user(
    request: UserLogin, 
    background_tasks: BackgroundTasks,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Logs in a user, verifies hashed credentials, and issues an access session token.
    """
    try:
        username, email = auth_service.authenticate_user(request.email, request.password)
        token = auth_service.create_session(username, email)
        background_tasks.add_task(send_welcome_email, username, email)
        return Token(access_token=token, token_type="bearer", username=username, email=email)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal authentication system failure: {str(e)}")

@router.post("/auth/logout")
def logout_user(token: str, auth_service: AuthService = Depends(get_auth_service)):
    """
    Invalidates a user's active session token.
    """
    try:
        auth_service.delete_session(token)
        return {"message": "Successfully logged out of your session."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal database session logout failure: {str(e)}")

@router.post("/auth/google", response_model=Token)
def login_google_user(
    request: GoogleAuthRequest, 
    background_tasks: BackgroundTasks,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Validates Google ID token, registers Google users if new, and logs them in.
    """
    try:
        username, email = auth_service.verify_google_token(request.id_token)
        username, email = auth_service.register_or_login_google_user(username, email)
        token = auth_service.create_session(username, email)
        background_tasks.add_task(send_welcome_email, username, email)
        return Token(access_token=token, token_type="bearer", username=username, email=email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google authentication failed: {str(e)}")

@router.get("/health", response_model=HealthResponse)
def health_check(vector_service: VectorStoreService = Depends(get_vector_service)):
    """
    Checks if API key is configured and gets DB chunk counts.
    """
    api_key_set = vector_service.is_api_key_set()
    try:
        chunk_count = vector_service.get_chunk_count()
    except Exception as e:
        print(f"Error accessing DB inside health check: {str(e)}")
        chunk_count = 0
        
    return HealthResponse(
        status="healthy" if api_key_set else "unconfigured",
        vector_store_count=chunk_count,
        api_key_configured=api_key_set
    )

@router.post("/upload", response_model=UploadResponse)
async def upload_documents(
    files: List[UploadFile] = File(...),
    vector_service: VectorStoreService = Depends(get_vector_service),
    current_user: tuple[str, str] = Depends(get_current_user)
):
    """
    Handles file upload, converts pages to text, embeds segments, and saves to Chroma DB.
    """
    if not vector_service.is_api_key_set():
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is missing on server. Check backend configuration."
        )
        
    username, email = current_user
    processed_docs = []
    
    for file in files:
        if not file.filename.endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file.filename}. Only PDF documents are allowed."
            )
            
        user_upload_dir = os.path.join(settings.UPLOAD_DIR, username)
        os.makedirs(user_upload_dir, exist_ok=True)
        file_path = os.path.join(user_upload_dir, file.filename)
        try:
            # Write file upload locally
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            # Parse text contents page by page
            pages = DocumentProcessor.extract_text_by_page(file_path)
            
            # Segment and upload embeddings to Vector DB
            chunk_count = vector_service.add_document(pages, username=username)
            
            # File metadata
            size_bytes = os.path.getsize(file_path)
            upload_time = datetime.datetime.now().isoformat()
            
            processed_docs.append(DocumentInfo(
                filename=file.filename,
                size_bytes=size_bytes,
                upload_time=upload_time,
                chunk_count=chunk_count
            ))
        except Exception as e:
            # Clean up residual local file if processing failed
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process and index file '{file.filename}': {str(e)}"
            )
            
    return UploadResponse(
        message=f"Successfully processed {len(processed_docs)} document(s).",
        documents=processed_docs
    )

@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline),
    current_user: tuple[str, str] = Depends(get_current_user)
):
    """
    Queries document chunks using user input, structures LLM context, and outputs answers + citations.
    """
    if not rag_pipeline.vector_service.is_api_key_set():
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is missing on server. Check backend configuration."
        )
        
    username, email = current_user
    try:
        answer, citations = rag_pipeline.execute(
            messages=request.messages,
            active_documents=request.active_documents,
            username=username
        )
        return ChatResponse(answer=answer, citations=citations)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during retrieval/generation pipeline: {str(e)}"
        )

@router.get("/documents", response_model=List[DocumentInfo])
def list_documents(
    vector_service: VectorStoreService = Depends(get_vector_service),
    current_user: tuple[str, str] = Depends(get_current_user)
):
    """
    List all uploaded documents and metadata.
    """
    username, email = current_user
    filenames = vector_service.list_documents(username=username)
    docs = []
    
    user_upload_dir = os.path.join(settings.UPLOAD_DIR, username)
    
    for filename in filenames:
        file_path = os.path.join(user_upload_dir, filename)
        size_bytes = 0
        upload_time = "Unknown"
        
        if os.path.exists(file_path):
            size_bytes = os.path.getsize(file_path)
            mtime = os.path.getmtime(file_path)
            upload_time = datetime.datetime.fromtimestamp(mtime).isoformat()
            
        chunk_count = vector_service.get_document_chunk_count(filename, username=username)
        
        docs.append(DocumentInfo(
            filename=filename,
            size_bytes=size_bytes,
            upload_time=upload_time,
            chunk_count=chunk_count
        ))
        
    return docs

@router.delete("/documents/{filename}")
def delete_document(
    filename: str,
    vector_service: VectorStoreService = Depends(get_vector_service),
    current_user: tuple[str, str] = Depends(get_current_user)
):
    """
    Remove a document from the vector store index and delete the uploaded file from disk.
    """
    username, email = current_user
    
    # Clear vector store embeddings
    try:
        vector_service.delete_document(filename, username=username)
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to clear indexing chunks for document '{filename}': {str(e)}"
        )
        
    # Delete uploaded original PDF
    user_upload_dir = os.path.join(settings.UPLOAD_DIR, username)
    file_path = os.path.join(user_upload_dir, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to remove PDF file '{filename}' from backend storage: {str(e)}"
            )
            
    return {"message": f"Successfully deleted document '{filename}' from index and storage."}

@router.post("/contact")
def send_contact_message(request: ContactRequest, background_tasks: BackgroundTasks):
    """
    Saves the contact message locally and logs/simulates sending email to anupamsingh8095@gmail.com.
    """
    log_dir = os.path.join(settings.VECTOR_DB_DIR, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "contact_messages.txt")
    
    timestamp = datetime.datetime.now().isoformat()
    log_entry = (
        f"--- CONTACT MESSAGE RECEIVED ON {timestamp} ---\n"
        f"Name: {request.name}\n"
        f"Email: {request.email}\n"
        f"Subject: {request.subject}\n"
        f"Message:\n{request.message}\n"
        f"Recipient: anupamsingh8095@gmail.com\n"
        f"------------------------------------------------\n\n"
    )
    
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
            
        print(f"[CONTACT INBOX] Contact form submission logged. Notification simulated for anupamsingh8095@gmail.com.")
        
        # Schedule SMTP email dispatch task in the background to prevent request hanging/timeout
        background_tasks.add_task(
            send_contact_email,
            request.name,
            request.email,
            request.subject,
            request.message
        )
        
        return {"message": "Your message has been sent successfully. Anupam Singh will be notified."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record contact message: {str(e)}")

@router.get("/test-email")
def test_email():
    """
    Synchronous test route to return detailed SMTP tracebacks.
    """
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    
    status = {
        "smtp_server": smtp_server,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "has_password": smtp_password is not None and len(smtp_password) > 0,
        "result": None,
        "error": None,
        "traceback": None
    }
    
    if not (smtp_server and smtp_user and smtp_password):
        status["error"] = "Missing environment variables on server."
        return status
        
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = "anupamsingh8095@gmail.com"
        msg['Subject'] = "SMTP Debug Connection"
        msg.attach(MIMEText("This is a direct synchronous test from the Render container to verify SMTP.", 'plain'))
        
        server = smtplib.SMTP(smtp_server, int(smtp_port), timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, "anupamsingh8095@gmail.com", msg.as_string())
        server.quit()
        status["result"] = "Email sent successfully!"
    except Exception as e:
        import traceback
        status["error"] = str(e)
        status["traceback"] = traceback.format_exc()
        
    return status

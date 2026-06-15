from pydantic import BaseModel, Field
from typing import List, Optional

class Message(BaseModel):
    role: str = Field(..., description="Role of the sender, either 'user' or 'assistant'")
    content: str = Field(..., description="The content of the message")

class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., description="The full conversation history, with the last message being the user's current query")
    active_documents: Optional[List[str]] = Field(None, description="Optional list of specific filenames to filter retrieval by")

class Citation(BaseModel):
    document_name: str = Field(..., description="Name of the source document")
    page: int = Field(..., description="Page number where the info was found (1-indexed)")
    snippet: str = Field(..., description="Text chunk snippet retrieved")
    score: float = Field(..., description="Relevance score/distance from query")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="The generated grounded answer from the LLM")
    citations: List[Citation] = Field(..., description="Citations supporting the answer")

class DocumentInfo(BaseModel):
    filename: str = Field(..., description="Name of the file")
    size_bytes: int = Field(..., description="Size of the file in bytes")
    upload_time: str = Field(..., description="Timestamp of when file was uploaded")
    chunk_count: int = Field(..., description="Number of text chunks indexed in the vector database")

class UploadResponse(BaseModel):
    message: str = Field(..., description="Status message")
    documents: List[DocumentInfo] = Field(..., description="List of documents processed")

class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall health status")
    vector_store_count: int = Field(..., description="Total number of chunks in the vector database")
    api_key_configured: bool = Field(..., description="True if Gemini API Key is configured")

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Cleartext password")

class UserLogin(BaseModel):
    email: str = Field(..., description="Registered email address")
    password: str = Field(..., description="Cleartext password")

class Token(BaseModel):
    access_token: str = Field(..., description="The authorization session token")
    token_type: str = Field("bearer", description="The token type")
    username: str = Field(..., description="The user's username")
    email: Optional[str] = Field(None, description="The user's email address")

class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., description="Google ID OAuth token credential")

class ContactRequest(BaseModel):
    name: str = Field(..., description="The name of the person contacting")
    email: str = Field(..., description="The email address of the person contacting")
    subject: str = Field(..., description="The subject line of the contact request")
    message: str = Field(..., description="The contact message body")


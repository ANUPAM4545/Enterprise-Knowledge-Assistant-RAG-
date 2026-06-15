import re
import google.generativeai as genai
from typing import List, Dict, Any, Tuple, Optional
from app.config import settings
from app.services.vector import VectorStoreService
from app.models.schemas import Message, Citation

class RAGPipeline:
    def __init__(self, vector_service: VectorStoreService):
        self.vector_service = vector_service
        # Configure Gemini API key
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
    def execute(self, messages: List[Message], active_documents: List[str] = None, username: Optional[str] = None) -> Tuple[str, List[Citation]]:
        """
        Executes the RAG pipeline.
        - Gets user's latest query
        - Retrieves top-k relevant document chunks
        - Constructs a grounded prompt with history
        - Generates answer using Gemini 2.5 Flash
        - Parses citations
        """
        if not messages:
            return "No conversation history found.", []
            
        # The latest message from the user contains the query
        user_query = messages[-1].content
        
        # 1. Retrieve relevant chunks from vector database
        retrieved_chunks = self.vector_service.query(
            query_text=user_query,
            top_k=settings.TOP_K,
            filter_documents=active_documents,
            username=username
        )
        
        # If no documents are uploaded yet, return a clean message
        if not retrieved_chunks:
            return "No documents have been uploaded or matched. Please upload documents to begin.", []
            
        # 2. Build context text for the prompt
        context_str = ""
        for idx, chunk in enumerate(retrieved_chunks):
            context_str += f"[{idx + 1}] File: {chunk['filename']}, Page: {chunk['page']}\n"
            context_str += f"Content: {chunk['text']}\n"
            context_str += "----------------------------------------\n"
            
        # 3. Build instruction prompt
        system_instruction = (
            "You are an Enterprise Knowledge Assistant. Your job is to answer the user's question based ONLY on the provided Context text segments.\n\n"
            "CRITICAL RULES:\n"
            "1. Grounding: Answer the question using ONLY the provided context. Do not use external knowledge, do not assume or extrapolate. If the context does not contain sufficient details to answer, state exactly: 'I couldn't find sufficient information in the uploaded documents.'\n"
            "2. Citations: For every claim, fact, or sentence you state that is derived from a context segment, you MUST add an inline citation index suffix like '[i]' immediately following the claim, where 'i' is the 1-based index of the text segment in the Context list (e.g. [1], [2], etc.). Do not fabricate indexes. If a claim matches multiple sources, append multiple citation badges like [1][3].\n"
            "3. Format: Be concise, clear, and professional. Keep your formatting clean using Markdown."
        )
        
        # 4. Integrate chat history (if any)
        # Format history leading up to the final question
        history_str = ""
        if len(messages) > 1:
            history_str = "Chat History:\n"
            for msg in messages[:-1]:
                role_label = "User" if msg.role == "user" else "Assistant"
                history_str += f"{role_label}: {msg.content}\n"
            history_str += "\n"
            
        full_prompt = (
            f"{system_instruction}\n\n"
            f"{history_str}"
            f"Context:\n{context_str}\n"
            f"Question: {user_query}\n"
            f"Answer:"
        )
        
        # 5. Call Gemini LLM (using Gemini 2.5 Flash for speed and accuracy)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        try:
            response = model.generate_content(
                full_prompt,
                generation_config={"temperature": 0.0} # Low temperature to prevent hallucinations
            )
            answer_text = response.text
        except Exception as e:
            print(f"Error calling Gemini API: {str(e)}")
            return f"Error contacting AI model: {str(e)}", []
            
        # 6. Parse citations out of the model response
        # Find all patterns like [1], [2], etc.
        citations = []
        referenced_indices = set()
        
        # Search for [1], [2], etc.
        matches = re.findall(r"\[(\d+)\]", answer_text)
        for match in matches:
            idx = int(match) - 1 # Convert back to 0-index
            if 0 <= idx < len(retrieved_chunks):
                referenced_indices.add(idx)
                
        # Build list of Citation objects matching the retrieved chunks in order
        for chunk in retrieved_chunks:
            citations.append(
                Citation(
                    document_name=chunk["filename"],
                    page=chunk["page"],
                    snippet=chunk["text"],
                    score=chunk["score"]
                )
            )
            
        # Optional: If the model generated citations that were not in bounds, clean them
        # However, the matching indices are guaranteed to be correct.
        
        # If the model failed to follow instructions and didn't ground, but gave the fallback
        if "I couldn't find sufficient information" in answer_text:
            citations = [] # clear citations if it's the fallback
            
        return answer_text, citations

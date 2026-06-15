import os
import uuid
import chromadb
import google.generativeai as genai
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config import settings
from typing import List, Dict, Any, Optional

class VectorStoreService:
    def __init__(self):
        # Configure the Google Gemini API with settings key
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Configure and start a local persistent Chroma DB client
        self.client = chromadb.PersistentClient(path=settings.VECTOR_DB_DIR)
        
        # We index using cosine distance (cosine similarity)
        self.collection = self.client.get_or_create_collection(
            name="enterprise_knowledge",
            metadata={"hnsw:space": "cosine"}
        )
        
        # Text splitter to divide documents into semantic chunks
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len
        )

    def is_api_key_set(self) -> bool:
        return bool(settings.GEMINI_API_KEY)

    def _get_embedding(self, text: str, is_query: bool = False) -> List[float]:
        """
        Generate embedding for a single text using Gemini text-embedding-004.
        """
        if not self.is_api_key_set():
            raise ValueError("GEMINI_API_KEY environment variable is not configured.")
        
        task_type = "retrieval_query" if is_query else "retrieval_document"
        response = genai.embed_content(
            model="models/gemini-embedding-001",
            content=text,
            task_type=task_type
        )
        return response["embedding"]

    def _get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings in batches to optimize API calls.
        """
        if not self.is_api_key_set():
            raise ValueError("GEMINI_API_KEY environment variable is not configured.")
        
        # Batch size of 100 to avoid request body size constraints
        batch_size = 100
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = genai.embed_content(
                model="models/gemini-embedding-001",
                content=batch,
                task_type="retrieval_document"
            )
            all_embeddings.extend(response["embedding"])
        return all_embeddings

    def add_document(self, pages: List[Dict[str, Any]], username: Optional[str] = None) -> int:
        """
        Takes page-by-page extracted PDF text, chunks them, embeds them,
        and indexes them into the vector database.
        
        Returns:
            The number of chunks successfully indexed.
        """
        if not pages:
            return 0
            
        filename = pages[0]["filename"]
        
        # Delete any previous version of the document to avoid duplicate chunks
        self.delete_document(filename, username)
        
        chunks_text = []
        metadatas = []
        ids = []
        
        for page_data in pages:
            page_text = page_data["text"]
            page_num = page_data["page"]
            
            if not page_text.strip():
                continue
                
            # Chunk each page individually so chunks map to precise pages
            page_chunks = self.splitter.split_text(page_text)
            
            for idx, chunk in enumerate(page_chunks):
                chunks_text.append(chunk)
                meta = {
                    "filename": filename,
                    "page": page_num,
                    "chunk_index": idx
                }
                if username:
                    meta["username"] = username
                metadatas.append(meta)
                ids.append(f"{filename}_p{page_num}_c{idx}_{uuid.uuid4().hex[:6]}")
                
        if not chunks_text:
            return 0
            
        # Get embeddings from Gemini API
        embeddings = self._get_embeddings_batch(chunks_text)
        
        # Save to Chroma DB
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=chunks_text
        )
        
        return len(chunks_text)

    def delete_document(self, filename: str, username: Optional[str] = None) -> None:
        """
        Removes all document chunks from Chroma.
        """
        if username:
            self.collection.delete(where={"$and": [{"filename": filename}, {"username": username}]})
        else:
            self.collection.delete(where={"filename": filename})

    def list_documents(self, username: Optional[str] = None) -> List[str]:
        """
        Scans collection metadatas to extract a list of all unique documents.
        """
        results = self.collection.get(
            where={"username": username} if username else None,
            include=["metadatas"]
        )
        if not results or not results.get("metadatas"):
            return []
            
        filenames = set()
        for meta in results["metadatas"]:
            if meta and "filename" in meta:
                filenames.add(meta["filename"])
        return sorted(list(filenames))

    def get_chunk_count(self) -> int:
        """
        Returns total number of chunks inside the collection.
        """
        return self.collection.count()

    def get_document_chunk_count(self, filename: str, username: Optional[str] = None) -> int:
        """
        Returns total chunks for a single document.
        """
        if username:
            where_filter = {"$and": [{"filename": filename}, {"username": username}]}
        else:
            where_filter = {"filename": filename}
            
        results = self.collection.get(
            where=where_filter,
            include=["metadatas"]
        )
        return len(results["ids"]) if results and "ids" in results else 0

    def query(self, query_text: str, top_k: int = 5, filter_documents: Optional[List[str]] = None, username: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Runs a cosine similarity query against the database, filtering by specific files if specified.
        """
        if self.get_chunk_count() == 0:
            return []
            
        query_embedding = self._get_embedding(query_text, is_query=True)
        
        # Build filter dictionary if filter_documents or username are passed
        where_filter = None
        user_filter = {"username": username} if username else {}
        
        if filter_documents:
            if len(filter_documents) == 1:
                doc_filter = {"filename": filter_documents[0]}
            else:
                doc_filter = {"$or": [{"filename": fname} for fname in filter_documents]}
            
            if username:
                where_filter = {"$and": [user_filter, doc_filter]}
            else:
                where_filter = doc_filter
        else:
            if username:
                where_filter = user_filter
                
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )
        
        retrieved_chunks = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            distances = results["distances"][0]
            
            for i in range(len(docs)):
                # Chroma distance cosine returns 1 - cosine_similarity. Similarity = 1 - distance
                score = 1.0 - distances[i]
                retrieved_chunks.append({
                    "text": docs[i],
                    "filename": metas[i]["filename"],
                    "page": metas[i]["page"],
                    "score": max(0.0, min(1.0, score))  # Keep bounded [0, 1]
                })
                
        # Sort results by similarity score descending
        retrieved_chunks.sort(key=lambda x: x["score"], reverse=True)
        return retrieved_chunks

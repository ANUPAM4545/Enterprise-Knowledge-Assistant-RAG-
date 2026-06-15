import os
from dotenv import load_dotenv

# Locate and load the .env file at the project root
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
dotenv_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=dotenv_path)

class Settings:
    PROJECT_NAME: str = "Enterprise Knowledge Assistant (RAG)"
    API_V1_STR: str = "/api"
    
    # Load API Key (GEMINI_API_KEY is standard for google-generativeai / langchain-google-genai)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # Directory paths
    DATA_DIR: str = os.getenv("PERSISTENT_DATA_DIR", base_dir)
    UPLOAD_DIR: str = os.path.abspath(os.path.join(DATA_DIR, "uploads"))
    VECTOR_DB_DIR: str = os.path.abspath(os.path.join(DATA_DIR, "vector_store"))
    
    # RAG configuration settings
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    TOP_K: int = 5

settings = Settings()

# Ensure critical storage folders are present
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.VECTOR_DB_DIR, exist_ok=True)

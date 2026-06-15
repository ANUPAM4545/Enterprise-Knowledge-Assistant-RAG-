# Enterprise Knowledge Assistant (RAG)

An enterprise-ready Retrieval-Augmented Generation (RAG) dashboard that allows organizations to search and ask questions across employee handbooks, standard operating procedures, manuals, compliance documents, and research papers.

The assistant retrieves relevant context chunks from uploaded PDFs and generates accurate, grounded responses from Gemini 2.5 Flash, complete with page-specific citation references.

---

## Key Features
- **Multi-Document Support**: Upload multiple PDFs simultaneously.
- **Strict Grounding**: Hallucinations are suppressed; the AI answers strictly using retrieved context or explicitly states if information is unavailable.
- **Page-Aware Citations**: Inline numeric citations (e.g. `[1]`, `[2]`) map directly to original pages of specific files.
- **Interactive Citation Inspector**: Click citations to view the exact text snippets, document source, page number, and similarity score.
- **Query Filters**: Include/exclude specific uploaded documents in search queries.
- **Sleek Premium UI**: Modern slate-obsidian styling with glassmorphism layout, drag-and-drop loading, upload progress indicator, and shimmer loading states.

---

## Tech Stack
### Frontend
- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios

### Backend
- **Framework**: Python 3.9, FastAPI, Uvicorn
- **PDF Extraction**: PyPDF
- **Vector Database**: ChromaDB
- **LLM**: Gemini 2.5 Flash
- **Embeddings Model**: Gemini text-embedding-004

---

## System Architecture

```text
                 ┌────────────────────┐
                 │    React UI Client │
                 │    (Vite / TS)     │
                 └─────────┬──────────┘
                           │ POST /upload, /chat, /documents
                           ▼
                 ┌────────────────────┐
                 │   FastAPI Backend  │
                 └─────────┬──────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Document Loader│ │ RAG Pipeline   │ │ Vector Service │
│ (PyPDF extractor)│ (Context builder)│ (Chroma DB client)
└────────────────┘ └────────────────┘ └────────────────┘
                           │                        │
                           ▼                        ▼
               ┌──────────────────────┐ ┌──────────────────────┐
               │  Gemini 2.5 Flash    │ │ Gemini Embedding     │
               │  Generative Model    │ │ text-embedding-004   │
               └──────────────────────┘ └──────────────────────┘
```

---

## Directory Structure
```text
enterprise-knowledge-assistant/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── endpoints.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py
│   │   ├── rag/
│   │   │   ├── __init__.py
│   │   │   └── pipeline.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── document.py
│   │   │   └── vector.py
│   │   ├── __init__.py
│   │   ├── config.py
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── App.css
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── package.json
│   └── tailwind.config.js
├── uploads/              # Local storage for raw PDF uploads
├── vector_store/         # SQLite-based local ChromaDB vector store
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## API Endpoints

### 1. Health Status
- **Method & Route**: `GET /api/health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "vector_store_count": 42,
    "api_key_configured": true
  }
  ```

### 2. Upload Documents
- **Method & Route**: `POST /api/upload`
- **Request**: Multipart Form Data (`files`: List of PDF files)
- **Response**:
  ```json
  {
    "message": "Successfully processed 1 document(s).",
    "documents": [
      {
        "filename": "employee_handbook.pdf",
        "size_bytes": 1048576,
        "upload_time": "2026-06-15T10:30:00.000000",
        "chunk_count": 15
      }
    ]
  }
  ```

### 3. Ask RAG Query
- **Method & Route**: `POST /api/chat`
- **Request**:
  ```json
  {
    "messages": [
      {"role": "user", "content": "What is the policy on annual leave?"}
    ],
    "active_documents": ["employee_handbook.pdf"]
  }
  ```
- **Response**:
  ```json
  {
    "answer": "According to the handbook, employees receive 20 days of paid annual leave [1]. Leave must be requested at least two weeks in advance [2].",
    "citations": [
      {
        "document_name": "employee_handbook.pdf",
        "page": 4,
        "snippet": "Full-time employees accrue paid annual leave at a rate of 20 days per fiscal year...",
        "score": 0.865
      },
      {
        "document_name": "employee_handbook.pdf",
        "page": 4,
        "snippet": "Requests for leave must be submitted via the HR portal at least two weeks prior...",
        "score": 0.812
      }
    ]
  }
  ```

### 4. Delete Document
- **Method & Route**: `DELETE /api/documents/{filename}`
- **Response**:
  ```json
  {
    "message": "Successfully deleted document 'employee_handbook.pdf' from index and storage."
  }
  ```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- Google Gemini API Key

### Configuration
1. Clone the project.
2. In the project root, duplicate `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your `GEMINI_API_KEY`:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_from_google_ai_studio
   ```

### Option A: Running Locally

#### 1. Start the Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
The FastAPI API doc will be available at `http://localhost:8000/docs`.

#### 2. Start the Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
The React workspace will be available at `http://localhost:5173`.

---

### Option B: Running with Docker Compose

If you have Docker and Docker Compose installed:
1. Make sure you set your `GEMINI_API_KEY` in the root `.env` file.
2. Run from the project root:
   ```bash
   docker-compose up --build
   ```
3. Open your browser to `http://localhost:5173`.

---

## Evaluation Metrics & Observability
To monitor and evaluate response truthfulness and context recall, you can optionally integrate observability packages:
- **LangSmith**: Set environment variables `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY` to trace document embedding, chunk retrieval, and completion prompt calls.
- **Ragas**: Install `ragas` library to run context recall, faithfulness, and answer relevance automated evaluations.

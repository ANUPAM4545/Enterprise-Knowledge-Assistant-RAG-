# Enterprise Knowledge Assistant (RAG)

Production-ready Retrieval-Augmented Generation (RAG) platform built with **React, FastAPI, ChromaDB, and Gemini**, featuring **page-aware citations**, **multi-document search**, and a premium enterprise workspace.

> Transform static PDFs into an intelligent, searchable knowledge base.

---

## 🌐 Live Demo

* **Application:** https://enterprise-knowledge-assistant-rag.vercel.app

---

## ✨ Features

### Core Capabilities

* Upload and index multiple PDF documents
* Conversational question answering
* Semantic search powered by vector embeddings
* Multi-document filtering
* Persistent vector storage
* Page-specific citations
* Interactive citation inspection
* Chat history management
* Strict context grounding to reduce hallucinations

### User Experience

* Premium glassmorphism UI
* Drag-and-drop PDF upload
* Real-time indexing status
* Upload progress indicators
* Responsive design
* Dark mode workspace
* Authentication with Google Sign-In

### Developer Features

* Dockerized architecture
* Modular FastAPI backend
* Persistent ChromaDB storage
* Environment-based configuration
* Ready for LangSmith tracing
* Ready for RAGAS evaluation

---

## 📌 Problem Statement

Organizations store critical information across:

* Employee handbooks
* Standard operating procedures (SOPs)
* Product manuals
* Compliance documents
* Research papers
* Internal knowledge bases

Finding information within these documents is time-consuming and inefficient.

This project enables users to upload documents and ask questions in natural language. The system retrieves semantically relevant content and generates accurate, grounded responses with traceable citations.

---

## 🖼️ Screenshots

### Landing Page

Modern enterprise-focused landing page introducing the platform's capabilities.

<img width="1453" height="806" alt="Screenshot 2026-06-15 at 12 42 27 PM" src="https://github.com/user-attachments/assets/0890ae18-7dc1-4e83-b563-b7db6d73e7ec" />



---

### Authentication

Secure sign-in experience with email/password and Google authentication.

<img width="1401" height="825" alt="Screenshot 2026-06-15 at 12 21 27 PM" src="https://github.com/user-attachments/assets/512eb773-29f0-4c5d-ada1-1164613f8f2a" />



---

### Knowledge Workspace

Upload documents, manage the document library, and interact with your knowledge base.

![Workspace]<img width="1468" height="818" alt="Screenshot 2026-06-15 at 12 24 00 PM" src="https://github.com/user-attachments/assets/2d73d3d7-7413-4510-8683-a9cd1bc5ed26" />


---


## 🏗️ System Architecture

```text
                  ┌─────────────────────┐
                  │    React Frontend   │
                  │ (Vite + TypeScript) │
                  └──────────┬──────────┘
                             │
                             ▼

                  ┌─────────────────────┐
                  │   FastAPI Backend   │
                  └──────────┬──────────┘
                             │

      ┌──────────────────────┼──────────────────────┐
      ▼                      ▼                      ▼

┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ PDF Processor │  │  RAG Pipeline   │  │  Vector Store   │
│    (PyPDF)    │  │   (LangChain)   │  │    ChromaDB     │
└───────────────┘  └────────┬────────┘  └────────┬────────┘
                            │                    │
                            ▼                    ▼

                 ┌─────────────────────┐
                 │ Gemini Embeddings   │
                 │ text-embedding-004  │
                 └──────────┬──────────┘
                            │
                            ▼

                 ┌─────────────────────┐
                 │  Gemini 2.5 Flash   │
                 └──────────┬──────────┘
                            │
                            ▼

                 ┌─────────────────────┐
                 │ Answer + Citations  │
                 └─────────────────────┘
```

---

## 🔄 RAG Pipeline

1. User uploads one or more PDF documents.
2. PDFs are parsed page by page.
3. Each page is split into semantic chunks.
4. Embeddings are generated using Gemini embeddings.
5. Chunks are stored in ChromaDB.
6. User submits a question.
7. Relevant chunks are retrieved using semantic similarity.
8. Gemini generates an answer using only retrieved context.
9. The response is returned with page-specific citations.

---

## 📖 Citation Strategy

To ensure accurate references:

* Documents are processed page by page.
* Chunks never span multiple pages.
* Each chunk stores metadata:

```json
{
  "document_name": "employee_handbook.pdf",
  "page_number": 12,
  "chunk_index": 4
}
```

This guarantees reliable page-level citations.

---

## 🛠️ Tech Stack

### Frontend

* React 18
* TypeScript
* Vite
* Tailwind CSS
* Axios
* Lucide React

### Backend

* Python 3.9+
* FastAPI
* Uvicorn
* Pydantic

### AI & RAG

* Gemini 2.5 Flash
* Gemini text-embedding-004
* LangChain

### Data Layer

* ChromaDB
* PyPDF

### DevOps

* Docker
* Docker Compose
* Vercel

---

## 📂 Project Structure

```text
enterprise-knowledge-assistant/

├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── rag/
│   │   ├── services/
│   │   ├── config.py
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── Dockerfile
│
├── uploads/
├── vector_store/
├── assets/
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint                    | Description             |
| ------ | --------------------------- | ----------------------- |
| GET    | `/api/health`               | Health check            |
| POST   | `/api/upload`               | Upload documents        |
| POST   | `/api/chat`                 | Ask questions           |
| GET    | `/api/documents`            | List uploaded documents |
| DELETE | `/api/documents/{filename}` | Delete a document       |
| GET    | `/api/history`              | Retrieve chat history   |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Get your API key from Google AI Studio.

---

## 🚀 Getting Started

### Prerequisites

* Node.js 18+
* Python 3.9+
* Docker (optional)
* Gemini API key

---

### Run Backend

```bash
cd backend

python -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

API documentation:

```text
http://localhost:8000/docs
```

---

### Run Frontend

```bash
cd frontend

npm install

npm run dev
```

Application:

```text
http://localhost:5173
```

---

## 🐳 Run with Docker

```bash
docker-compose up --build
```

Open:

```text
http://localhost:5173
```

---

## 📊 Performance Configuration

| Parameter       | Value              |
| --------------- | ------------------ |
| Chunk Size      | 1000               |
| Chunk Overlap   | 200                |
| Retrieval Top-K | 5                  |
| Embedding Model | text-embedding-004 |
| LLM             | Gemini 2.5 Flash   |

---

## 📈 Evaluation & Observability

### LangSmith

Track:

* Prompt execution
* Retrieval quality
* Latency
* Token usage

### RAGAS

Evaluate:

* Faithfulness
* Answer relevance
* Context precision
* Context recall

---

## 🎯 Design Decisions

* Used page-level chunking to ensure citation accuracy.
* Selected ChromaDB for lightweight persistent vector storage.
* Separated embedding and generation models for flexibility.
* Implemented strict grounding prompts to reduce hallucinations.
* Prioritized a polished single-user experience for the MVP.

---

## 🔮 Future Enhancements

* Hybrid search (BM25 + vector search)
* Reranking
* Streaming responses
* LangGraph agents
* PostgreSQL + pgvector
* Redis caching
* LangSmith tracing
* Advanced analytics dashboard
* Multi-user workspaces
* Role-based access control

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

Feel free to fork the repository and submit a pull request.

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Anupam Singh**

* GitHub: https://github.com/ANUPAM4545
* LinkedIn:https://www.linkedin.com/in/anupam-singh-415999253/



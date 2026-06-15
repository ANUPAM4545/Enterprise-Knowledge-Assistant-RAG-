import axios from 'axios';

// Backend API URL configured through Vite env variables, fallback to localhost:8000
const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach session token to all requests if present
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Citation {
  document_name: string;
  page: number;
  snippet: string;
  score: number;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export interface DocumentInfo {
  filename: string;
  size_bytes: number;
  upload_time: string;
  chunk_count: number;
}

export interface UploadResponse {
  message: string;
  documents: DocumentInfo[];
}

export interface HealthResponse {
  status: string;
  vector_store_count: number;
  api_key_configured: boolean;
}

export const api = {
  /**
   * Health check to query database status and credentials configuration
   */
  getHealth: async (): Promise<HealthResponse> => {
    const response = await client.get<HealthResponse>('/health');
    return response.data;
  },

  /**
   * Uploads multiple PDF documents with progress callback
   */
  uploadDocuments: async (
    files: File[], 
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await client.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  },

  /**
   * Submits conversation history and target documents to the RAG pipeline
   */
  chat: async (
    messages: Message[], 
    activeDocuments?: string[]
  ): Promise<ChatResponse> => {
    const response = await client.post<ChatResponse>('/chat', {
      messages,
      active_documents: activeDocuments && activeDocuments.length > 0 ? activeDocuments : null,
    });
    return response.data;
  },

  /**
   * Lists all uploaded documents
   */
  listDocuments: async (): Promise<DocumentInfo[]> => {
    const response = await client.get<DocumentInfo[]>('/documents');
    return response.data;
  },

  /**
   * Deletes a document from storage and the vector index
   */
  deleteDocument: async (filename: string): Promise<{ message: string }> => {
    const response = await client.delete<{ message: string }>(
      `/documents/${encodeURIComponent(filename)}`
    );
    return response.data;
  },

  /**
   * Creates a new user account
   */
  register: async (username: string, email: string, password: string): Promise<{ message: string }> => {
    const response = await client.post<{ message: string }>('/auth/register', {
      username,
      email,
      password
    });
    return response.data;
  },

  /**
   * Authenticates user and returns active token
   */
  login: async (email: string, password: string): Promise<Token> => {
    const response = await client.post<Token>('/auth/login', {
      email,
      password
    });
    return response.data;
  },

  /**
   * Authenticates user via Google OAuth ID token
   */
  loginWithGoogle: async (idToken: string): Promise<Token> => {
    const response = await client.post<Token>('/auth/google', {
      id_token: idToken
    });
    return response.data;
  },

  /**
   * Invalidates a session token
   */
  logout: async (token: string): Promise<{ message: string }> => {
    const response = await client.post<{ message: string }>(
      `/auth/logout?token=${encodeURIComponent(token)}`
    );
    return response.data;
  },

  /**
   * Submits a contact form message to the backend
   */
  sendContactMessage: async (name: string, email: string, subject: string, message: string): Promise<{ message: string }> => {
    const response = await client.post<{ message: string }>('/contact', {
      name,
      email,
      subject,
      message,
    });
    return response.data;
  }
};

export interface Token {
  access_token: string;
  token_type: string;
  username: string;
  email?: string;
}

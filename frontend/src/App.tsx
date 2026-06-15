import React, { useState, useEffect, useRef } from 'react';
import { 
  api, 
  type Message, 
  type Citation, 
  type DocumentInfo 
} from './services/api';
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  Send, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  X, 
  MessageSquare,
  CheckCircle,
  Database,
  ArrowRight,
  Info,
  Lock,
  User,
  ShieldCheck,
  Globe,
  Sliders,
  LogOut,
  Mail,
  Heart
} from 'lucide-react';

export default function App() {
  // Navigation & Authentication states
  const [currentView, setCurrentView] = useState<'home' | 'features' | 'contact' | 'login' | 'workspace'>('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');

  // RAG Workspace states
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [isCitationOpen, setIsCitationOpen] = useState(false);

  // Server health states
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [chunkCount, setChunkCount] = useState(0);

  // Auth form states
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  // Google OAuth states
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleClientConfigured, setGoogleClientConfigured] = useState(false);

  // Contact Us form states
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);

  // Load Google Sign-In Identity Services dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    
    script.onload = () => {
      initializeGoogleAuth();
    };

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Re-initialize Google Sign-In button rendering when views or tabs shift
  useEffect(() => {
    if (currentView === 'login') {
      const timer = setTimeout(() => {
        initializeGoogleAuth();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentView, authTab]);

  const initializeGoogleAuth = () => {
    const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';
    if (googleClientId) {
      setGoogleClientConfigured(true);
    }
    
    // @ts-ignore
    if (googleClientId && window.google) {
      // @ts-ignore
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleAuthCallback,
      });

      // @ts-ignore
      const container = document.getElementById('google-signin-button-container');
      if (container) {
        // @ts-ignore
        window.google.accounts.id.renderButton(container, {
          theme: 'dark',
          size: 'large',
          width: 320,
        });
      }
    }
  };

  const handleGoogleAuthCallback = async (response: any) => {
    const idToken = response.credential;
    setAuthLoading(true);
    setErrorMsg(null);
    try {
      const result = await api.loginWithGoogle(idToken);
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('username', result.username);
      if (result.email) localStorage.setItem('email', result.email);
      setIsAuthenticated(true);
      setUsername(result.username);
      if (result.email) setEmail(result.email);
      setToken(result.access_token);
      setSuccessMsg(`Welcome, signed in with Google account!`);
      setCurrentView('workspace');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Google authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleMockLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim()) return;

    setAuthLoading(true);
    setErrorMsg(null);
    try {
      const mockToken = `mock_google_${googleEmailInput.trim().toLowerCase()}`;
      const result = await api.loginWithGoogle(mockToken);
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('username', result.username);
      if (result.email) localStorage.setItem('email', result.email);
      setIsAuthenticated(true);
      setUsername(result.username);
      if (result.email) setEmail(result.email);
      setToken(result.access_token);
      setSuccessMsg(`Welcome, signed in as ${result.username} (Google Simulation)!`);
      setIsGoogleModalOpen(false);
      setGoogleEmailInput('');
      setCurrentView('workspace');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Google Sign-In simulation failed.");
    } finally {
      setAuthLoading(false);
    }
  };
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check local token on boot
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUsername = localStorage.getItem('username');
    const savedEmail = localStorage.getItem('email');
    if (savedToken && savedUsername) {
      setIsAuthenticated(true);
      setUsername(savedUsername);
      if (savedEmail) setEmail(savedEmail);
      setToken(savedToken);
      setCurrentView('workspace');
    }
    checkHealth();
  }, []);

  // Fetch documents when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Auto-dismiss success welcome/logout messages after 5 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Health check
  const checkHealth = async () => {
    try {
      const health = await api.getHealth();
      setServerOnline(health.status === 'healthy' || health.status === 'unconfigured');
      setChunkCount(health.vector_store_count);
    } catch (err) {
      setServerOnline(false);
    }
  };

  // List all uploaded documents
  const fetchDocuments = async () => {
    try {
      const docList = await api.listDocuments();
      setDocuments(docList);
      
      const names = docList.map(d => d.filename);
      setSelectedDocs(prev => {
        const combined = new Set([...prev, ...names]);
        return Array.from(combined).filter(name => names.includes(name));
      });
    } catch (err) {
      console.error("Error listing documents:", err);
    }
  };

  const toggleDocSelection = (filename: string) => {
    setSelectedDocs(prev => 
      prev.includes(filename) 
        ? prev.filter(name => name !== filename) 
        : [...prev, filename]
    );
  };

  // Auth functions
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername || !authEmail || !authPassword) {
      setErrorMsg("All fields are required.");
      return;
    }
    setAuthLoading(true);
    setErrorMsg(null);
    try {
      await api.register(authUsername, authEmail, authPassword);
      setSuccessMsg("Account registered successfully! Please log in.");
      setAuthTab('login');
      setAuthPassword('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Registration failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setErrorMsg("All fields are required.");
      return;
    }
    setAuthLoading(true);
    setErrorMsg(null);
    try {
      const result = await api.login(authEmail, authPassword);
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('username', result.username);
      if (result.email) localStorage.setItem('email', result.email);
      setIsAuthenticated(true);
      setUsername(result.username);
      if (result.email) setEmail(result.email);
      setToken(result.access_token);
      setSuccessMsg(`Welcome back, ${result.username}!`);
      setCurrentView('workspace');
      
      // Reset auth forms
      setAuthUsername('');
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Invalid credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await api.logout(token);
      } catch (err) {
        console.error("Session delete error on logout:", err);
      }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    setIsAuthenticated(false);
    setUsername('');
    setEmail('');
    setToken('');
    setMessages([]);
    setCurrentView('home');
    setSuccessMsg("Logged out successfully.");
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      setErrorMsg("All fields are required.");
      return;
    }
    setContactLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await api.sendContactMessage(
        contactName.trim(),
        contactEmail.trim(),
        contactSubject.trim(),
        contactMessage.trim()
      );
      setSuccessMsg(result.message);
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to send message.");
    } finally {
      setContactLoading(false);
    }
  };

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (files: File[]) => {
    const pdfs = files.filter(f => f.name.endsWith('.pdf'));
    if (pdfs.length === 0) {
      setErrorMsg("Please upload only PDF documents (.pdf)");
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await api.uploadDocuments(pdfs, (progress) => {
        setUploadProgress(progress);
      });
      setSuccessMsg(response.message);
      await fetchDocuments();
      await checkHealth();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "An error occurred during file upload.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${filename} from database?`)) return;
    try {
      await api.deleteDocument(filename);
      setSuccessMsg(`Deleted ${filename}`);
      if (activeCitation?.document_name === filename) {
        setIsCitationOpen(false);
        setActiveCitation(null);
      }
      await fetchDocuments();
      await checkHealth();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to delete document.");
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isThinking) return;

    const userMessage: Message = {
      role: 'user',
      content: inputText.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsThinking(true);
    setErrorMsg(null);

    try {
      const updatedHistory = [...messages, userMessage];
      const result = await api.chat(updatedHistory, selectedDocs);
      
      const assistantMessage: Message & { citations?: Citation[] } = {
        role: 'assistant',
        content: result.answer,
        citations: result.citations
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Connection error. RAG pipeline could not answer.");
    } finally {
      setIsThinking(false);
    }
  };

  // Suggestion card click
  const handleSuggestionClick = (text: string) => {
    setInputText(text);
  };

  // Citation card click
  const handleCitationClick = (citation: Citation) => {
    setActiveCitation(citation);
    setIsCitationOpen(true);
  };

  // Custom text formatter that converts markdown & turns citation numbers [i] into buttons
  const renderMessageContent = (msg: Message & { citations?: Citation[] }) => {
    const content = msg.content;
    const msgCitations = msg.citations || [];

    const blocks = content.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, bIdx) => {
      if (block.startsWith('```')) {
        const codeText = block.replace(/```/g, '').trim();
        return (
          <pre key={bIdx} className="bg-slate-950/80 text-indigo-300 p-4 rounded-lg my-3 overflow-x-auto border border-slate-800 text-sm font-mono leading-relaxed">
            <code>{codeText}</code>
          </pre>
        );
      }

      const lines = block.split('\n');
      return lines.map((line, lIdx) => {
        if (!line.trim()) return <div key={lIdx} className="h-2" />;

        const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
        const textToFormat = isBullet ? line.trim().substring(2) : line;

        const formatInline = (text: string) => {
          const parts = text.split(/(\*\*.*?\*\*|\[\d+\])/g);
          return parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
            }

            const citationMatch = part.match(/^\[(\d+)\]$/);
            if (citationMatch) {
              const citIdx = parseInt(citationMatch[1]) - 1;
              const citation = msgCitations[citIdx];
              
              if (citation) {
                return (
                  <button
                    key={pIdx}
                    onClick={() => handleCitationClick(citation)}
                    className="mx-0.5 px-2 py-0.5 text-[11px] font-bold rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 hover:bg-brand-500 hover:text-white transition-all duration-150 inline-flex items-center justify-center align-middle focus:outline-none"
                    title={`Source: ${citation.document_name} (Page ${citation.page})`}
                  >
                    {citationMatch[1]}
                  </button>
                );
              }
            }

            return part;
          });
        };

        if (isBullet) {
          return (
            <li key={lIdx} className="ml-5 list-disc text-slate-300 mb-1 leading-relaxed">
              {formatInline(textToFormat)}
            </li>
          );
        }

        return (
          <p key={lIdx} className="text-slate-300 leading-relaxed mb-3 text-[15px]">
            {formatInline(line)}
          </p>
        );
      });
    });
  };

  // Navigation handlers
  const handleNavClick = (view: 'home' | 'features' | 'contact' | 'login' | 'workspace') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (isAuthenticated) {
      // If user is logged in, they are restricted to the workspace view
      setCurrentView('workspace');
    } else if (view === 'workspace' && !isAuthenticated) {
      setCurrentView('login');
      setAuthTab('login');
      setErrorMsg("Please register or log in to access the RAG chat workspace.");
    } else {
      setCurrentView(view);
    }
  };

  // Password strength check criteria
  const isLengthValid = authPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(authPassword);
  const hasLower = /[a-z]/.test(authPassword);
  const hasNumber = /[0-9]/.test(authPassword);
  const hasSpecial = /[!@#$%^&*(),.?\":{}|<>]/.test(authPassword);
  const isPasswordStrong = isLengthValid && hasUpper && hasLower && hasNumber && hasSpecial;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-950 via-slate-900 to-black text-slate-100 font-sans">
      
      {/* Background ambient glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] bg-brand-600/10 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* navbar: Floating glassmorphism header */}
      <header className="w-full flex-shrink-0 bg-slate-950/60 backdrop-blur-md border-b border-slate-900/60 z-30 select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          
          {/* Logo */}
          <div 
            onClick={() => handleNavClick(isAuthenticated ? 'workspace' : 'home')} 
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center glow-indicator transition-transform duration-300 group-hover:scale-105">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-slate-50 to-slate-200">
                KnowledgeAssistant
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 md:gap-3">
            {!isAuthenticated && (
              <>
                <button
                  onClick={() => handleNavClick('home')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    currentView === 'home' ? 'text-white bg-slate-900/80 border border-slate-800' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => handleNavClick('features')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    currentView === 'features' ? 'text-white bg-slate-900/80 border border-slate-800' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Features
                </button>
                <button
                  onClick={() => handleNavClick('contact')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    currentView === 'contact' ? 'text-white bg-slate-900/80 border border-slate-800' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Contact
                </button>
              </>
            )}
            <button
              onClick={() => handleNavClick('workspace')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                currentView === 'workspace' ? 'text-white bg-slate-900/80 border border-slate-800' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {!isAuthenticated && <Lock className="w-3 h-3 text-brand-400" />} Workspace
            </button>
          </nav>

          {/* Right auth buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex flex-col items-start bg-slate-900/50 px-2.5 py-1 text-slate-300 rounded-lg border border-slate-800 text-[10px] sm:text-xs" title={email || username}>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-400" />
                    <span className="font-medium max-w-[70px] sm:max-w-none truncate">
                      {username.includes('@') ? username.split('@')[0] : username}
                    </span>
                  </div>
                  {(email || username.includes('@')) && (
                    <span className="hidden sm:inline text-[9px] sm:text-[10px] text-slate-500 font-normal leading-none mt-0.5 max-w-[120px] truncate">
                      {email || username}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 border border-transparent hover:border-rose-500/20 transition-all flex items-center gap-1.5 focus:outline-none"
                  title="Log out"
                >
                  <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Log out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNavClick('login')}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md shadow-brand-950/20 active:scale-[0.98]"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating Notifications */}
      {(errorMsg || successMsg) && currentView !== 'workspace' && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-lg px-4 z-50 pointer-events-none animate-slide-up">
          {errorMsg && (
            <div className="glass-card border-rose-500/30 bg-rose-950/15 p-4 rounded-xl flex items-start gap-3 pointer-events-auto text-rose-300 text-xs shadow-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {successMsg && (
            <div className="glass-card border-emerald-500/30 bg-emerald-950/15 p-4 rounded-xl flex items-start gap-3 pointer-events-auto text-emerald-300 text-xs shadow-xl">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{successMsg}</span>
              <button onClick={() => setSuccessMsg(null)} className="hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* CONTENT AREA SCREEN SWITCH */}
      <div className="flex-1 w-full overflow-hidden relative z-10">
        
        {/* VIEW 1: LANDING PAGE ("HOME") */}
        {currentView === 'home' && (
          <div className="h-full overflow-y-auto px-6 py-12 md:py-20 select-none animate-fade-in">
            <div className="max-w-5xl mx-auto flex flex-col items-center text-center gap-8 md:gap-10">
              
              {/* Product Category badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-brand-300 animate-pulse-slow">
                <ShieldCheck className="w-3.5 h-3.5" /> Strictly Grounded, Secure RAG Assistant
              </div>

              {/* Title Header */}
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.15] bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-slate-100 to-indigo-300">
                Unlock your team's <br className="hidden md:inline" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-indigo-400 to-indigo-200">
                  collective intelligence.
                </span>
              </h1>

              {/* Description */}
              <p className="max-w-xl text-slate-400 text-sm md:text-base leading-relaxed">
                Upload policy books, standard operating procedures, manuals, or research journals. Get immediate answers grounded entirely in your context, backed by page-specific citations.
              </p>

              {/* CTA Buttons */}
              <div className="flex items-center gap-4 flex-wrap justify-center mt-2">
                <button
                  onClick={() => handleNavClick('workspace')}
                  className="px-6 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white transition-all duration-300 flex items-center gap-2 shadow-lg shadow-brand-950/30 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Start Chatting <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleNavClick('features')}
                  className="px-6 py-3 rounded-xl text-xs font-bold glass-card hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 transition-all duration-300 hover:-translate-y-0.5"
                >
                  Explore Capabilities
                </button>
              </div>

              {/* Interactive RAG live visualization mockup */}
              <div className="w-full max-w-3xl glass-card rounded-2xl p-5 md:p-6 border border-slate-800/40 relative shadow-2xl overflow-hidden mt-10 text-left">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-600 via-indigo-500 to-purple-600" />
                
                {/* Visualizer header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded text-indigo-400">RAG_PIPELINE_DEMO.sh</div>
                </div>

                {/* Animated content list */}
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex gap-2 text-slate-500">
                    <span>$</span>
                    <span className="text-slate-300 font-semibold animate-pulse-slow">rag-query --question "Is noise protection mandatory?"</span>
                  </div>
                  <div className="text-brand-400 pl-4 border-l-2 border-brand-500/25 space-y-1 py-1">
                    <p className="text-[10px] uppercase font-bold text-brand-500 tracking-wider">Step 1: Embedding Query & Chroma Search</p>
                    <p className="text-slate-400">➔ Retrieving top-k chunks from 'safety_manual.pdf' ... Done</p>
                    <p className="text-emerald-400">➔ Matches found: [Chunk 1: Page 12 (94% score)]</p>
                  </div>
                  <div className="text-indigo-400 pl-4 border-l-2 border-indigo-500/25 space-y-1.5 py-1">
                    <p className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Step 2: Grounding and LLM Response</p>
                    <p className="text-slate-300 leading-normal bg-slate-950/40 border border-slate-900 p-3 rounded-lg">
                      Yes. Noise protection is mandatory in workspaces where noise exposure exceeds 85 decibels <span className="bg-brand-500/20 px-1.5 py-0.5 rounded text-brand-300 font-bold border border-brand-500/30">[1]</span>. Hearing protectors must be provided by the company <span className="bg-brand-500/20 px-1.5 py-0.5 rounded text-brand-300 font-bold border border-brand-500/30">[1]</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* How to Use Section */}
              <div className="w-full max-w-3xl mt-12 text-left space-y-6">
                <div className="border-l-2 border-brand-500 pl-3">
                  <h3 className="text-lg font-bold text-slate-200">How to Use the Assistant</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Follow these simple steps to run grounded document search queries.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Step 1 */}
                  <div className="glass-card rounded-xl p-4 border border-slate-900/80 bg-slate-900/10 space-y-3">
                    <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 font-mono text-xs font-bold flex items-center justify-center border border-brand-500/25">
                      01
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Create Account & Log In</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Register a new profile or use Google Sign-In to launch your isolated private workspace.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="glass-card rounded-xl p-4 border border-slate-900/80 bg-slate-900/10 space-y-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-mono text-xs font-bold flex items-center justify-center border border-indigo-500/25">
                      02
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Upload PDF Documents</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Drag and drop target files in the workspace sidebar. The parser automatically segments and indexes them.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="glass-card rounded-xl p-4 border border-slate-900/80 bg-slate-900/10 space-y-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center border border-emerald-500/25">
                      03
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Ask & Inspect Citations</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Query the LLM. Click the numeric citation badges to verify responses directly in the document splits.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Footer />

            </div>
          </div>
        )}

        {/* VIEW 2: TECHNICAL FEATURES PAGE */}
        {currentView === 'features' && (
          <div className="h-full overflow-y-auto px-6 py-12 select-none animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-12">
              
              {/* Header */}
              <div className="text-center space-y-3">
                <h2 className="text-2xl md:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-indigo-200">
                  Built for Enterprise Accuracy
                </h2>
                <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto">
                  A breakdown of the architecture, algorithms, and strict prompt guarding techniques powering the Knowledge Assistant.
                </p>
              </div>

              {/* Grid cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Loader Card */}
                <div className="glass-card rounded-2xl p-6 border border-slate-800/30 space-y-4 hover:border-brand-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">PDF Page Extraction</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1.5">
                      Utilizes standard PyPDF loaders to parse uploaded files page-by-page. Content text is mapped recursively alongside file references and absolute page numbers, ensuring citation accuracy.
                    </p>
                  </div>
                </div>

                {/* DB Splitter Card */}
                <div className="glass-card rounded-2xl p-6 border border-slate-800/30 space-y-4 hover:border-brand-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">ChromaDB Vector Store</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1.5">
                      Stores 768-dimensional token vectors using Chroma DB. Text splits are generated at a threshold size of 1000 characters (200 character overlap) and searched using cosine similarity metric vectors.
                    </p>
                  </div>
                </div>

                {/* Grounding Card */}
                <div className="glass-card rounded-2xl p-6 border border-slate-800/30 space-y-4 hover:border-brand-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">Anti-Hallucination Guard</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1.5">
                      Low-temperature prompt parameters block extrapolation. If a user's question does not match semantic document chunks, the pipeline falls back to a strict: <em>"I couldn't find sufficient information in the uploaded documents."</em>
                    </p>
                  </div>
                </div>

                {/* Filter Card */}
                <div className="glass-card rounded-2xl p-6 border border-slate-800/30 space-y-4 hover:border-brand-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">Target Metadata Filters</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1.5">
                      Limit vector lookups to specific documents. The API dynamically constructs metadata conditional filters (e.g., matching target filenames) to restrict the matching candidate space.
                    </p>
                  </div>
                </div>

              </div>

              <Footer />

            </div>
          </div>
        )}

        {/* VIEW 3: CONTACT US PAGE */}
        {currentView === 'contact' && (
          <div className="h-full overflow-y-auto px-6 py-12 select-none animate-fade-in flex flex-col justify-between">
            <div className="max-w-4xl mx-auto w-full space-y-12 my-auto">
              
              {/* Header */}
              <div className="text-center space-y-3">
                <h2 className="text-2xl md:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-indigo-200">
                  Get in Touch
                </h2>
                <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto">
                  Have questions about custom integrations, security frameworks, or feedback? Send us a message and our team will get back to you.
                </p>
              </div>

              {/* Grid: Form and Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                {/* Contact form (3 cols) */}
                <form 
                  onSubmit={handleContactSubmit}
                  className="md:col-span-3 glass-card rounded-2xl p-6 border border-slate-800/40 space-y-4 text-left animate-slide-up"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Your Name</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Alex Johnson"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        disabled={contactLoading}
                        className="w-full bg-slate-950/50 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-650 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="alex@company.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        disabled={contactLoading}
                        className="w-full bg-slate-950/50 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-650 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Subject</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Custom enterprise deployment query"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      disabled={contactLoading}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-650 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Message</label>
                    <textarea 
                      required 
                      rows={4}
                      placeholder="Hi, I am interested in deploying the Knowledge Assistant locally with private LLMs..."
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      disabled={contactLoading}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-650 outline-none focus:border-brand-500 transition-colors resize-none disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={contactLoading}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {contactLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Sending Message...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" /> Send Message
                      </>
                    )}
                  </button>
                </form>

                {/* Info panels (2 cols) */}
                <div className="md:col-span-2 space-y-4 text-left animate-slide-up">
                  <div className="glass-card rounded-2xl p-5 border border-slate-800/30 flex items-start gap-4">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 flex-shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Email Us</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-normal">Our team replies within 24 hours.</p>
                      <a href="mailto:anupamsingh8095@gmail.com" className="text-xs text-brand-400 font-semibold hover:underline block mt-1.5">anupamsingh8095@gmail.com</a>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-5 border border-slate-800/30 flex items-start gap-4">
                    <div className="p-2 bg-brand-500/10 text-brand-400 rounded-lg border border-brand-500/20 flex-shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Office Location</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-normal">Varanasi</p>
                      <p className="text-xs text-slate-300 font-semibold mt-1">Uttar Pradesh, India</p>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-5 border border-slate-800/30 flex items-start gap-4">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 flex-shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Data Privacy</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-normal">Your communications and RAG index documents remain fully encrypted on disk.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <Footer />
          </div>
        )}

        {/* VIEW 4: AUTH LOGIN / SIGNUP PANEL */}
        {currentView === 'login' && (
          <div className="h-full overflow-y-auto px-6 py-12 flex flex-col items-center justify-between select-none animate-fade-in">
            <div className="w-full max-w-sm glass-card rounded-2xl border border-slate-800/50 p-6 md:p-8 relative shadow-2xl my-auto">
              
              {/* Tab selector */}
              <div className="flex items-center border-b border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setErrorMsg(null); }}
                  className={`flex-1 pb-3 text-xs font-bold border-b-2 transition-colors duration-150 ${
                    authTab === 'login' ? 'border-brand-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('register'); setErrorMsg(null); }}
                  className={`flex-1 pb-3 text-xs font-bold border-b-2 transition-colors duration-150 ${
                    authTab === 'register' ? 'border-brand-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Authentication Form */}
              <form onSubmit={authTab === 'login' ? handleLogin : handleRegister} className="space-y-4">
                
                {authTab === 'register' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Username</label>
                    <input
                      type="text"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="alex_dev"
                      required
                      className="w-full bg-slate-900/40 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email address</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="alex@company.com"
                    required
                    className="w-full bg-slate-900/40 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-900/40 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-brand-500 transition-colors"
                  />
                  {authTab === 'register' && authPassword.length > 0 && (
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900 text-[11px] space-y-1 mt-1 text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Password Requirements</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isLengthValid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className={isLengthValid ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>8+ characters ({authPassword.length}/8)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${hasUpper ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className={hasUpper ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>One uppercase letter (A-Z)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${hasLower ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className={hasLower ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>One lowercase letter (a-z)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className={hasNumber ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>One digit (0-9)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${hasSpecial ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className={hasSpecial ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>One special character (e.g. !@#$)</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={authLoading || (authTab === 'register' && !isPasswordStrong)}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-950/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {authLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : authTab === 'login' ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </button>

                <div className="flex items-center my-4 text-[10px] text-slate-500 uppercase tracking-widest select-none">
                  <div className="flex-1 h-px bg-slate-800/60" />
                  <span className="px-2.5 font-bold">Or</span>
                  <div className="flex-1 h-px bg-slate-800/60" />
                </div>

                {googleClientConfigured ? (
                  <div className="flex justify-center w-full min-h-[40px]">
                    <div id="google-signin-button-container" className="inline-block" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsGoogleModalOpen(true)}
                    className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 shadow-md focus:outline-none hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.137 4.114-3.483 0-6.312-2.829-6.312-6.314s2.829-6.314 6.312-6.314c1.554 0 2.97.567 4.072 1.492l3.14-3.14A11.9 11.9 0 0 0 12.24 0c-6.627 0-12 5.373-12 12s5.373 12 12 12c6.243 0 11.24-5.097 11.24-11.24 0-.642-.055-1.285-.165-1.915H12.24Z" />
                    </svg>
                    Continue with Google
                  </button>
                )}
              </form>

            </div>
            <Footer />
          </div>
        )}

        {/* VIEW 4: RAG CHAT WORKSPACE */}
        {currentView === 'workspace' && isAuthenticated && (
          <div className="h-full w-full flex overflow-hidden animate-fade-in relative">
            
            {/* WORKSPACE SIDEBAR: Files */}
            <aside className="w-80 flex flex-col bg-slate-950/40 border-r border-slate-900/60 z-10 select-none flex-shrink-0">
              
              {/* Health stats block */}
              <div className="p-4 border-b border-slate-900/60 flex flex-col gap-3">
                <div className="flex items-center justify-between bg-slate-900/30 px-3 py-2 rounded-lg border border-slate-850/40 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> DB Index: {chunkCount} chunks
                  </span>
                  <div className="flex items-center gap-1">
                    {serverOnline ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase">Online</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span className="text-[10px] font-semibold text-rose-400 uppercase">Offline</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload Drag Card */}
              <div className="p-4 border-b border-slate-900/40">
                <div 
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                    dragActive 
                      ? 'border-brand-500 bg-brand-500/5 shadow-md shadow-brand-950/20' 
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/10'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    accept=".pdf"
                    className="hidden"
                  />
                  {isUploading ? (
                    <div className="w-full flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                      <span className="text-xs text-slate-300 font-medium">Processing pages & index...</span>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div 
                          className="bg-brand-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{uploadProgress}% uploaded</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60 text-slate-400">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">Drag & Drop PDF files</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">or click to browse local files</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Document Library list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Document Library</span>
                  <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                    {documents.length}
                  </span>
                </div>

                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl bg-slate-900/10 border border-slate-900/40">
                    <FileText className="w-8 h-8 text-slate-700 mb-2" />
                    <p className="text-xs font-medium text-slate-500">No documents index found.</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Upload PDFs to enable context retrieval.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {documents.map((doc) => {
                      const isSelected = selectedDocs.includes(doc.filename);
                      const sizeKb = Math.round(doc.size_bytes / 1024);
                      return (
                        <div
                          key={doc.filename}
                          onClick={() => toggleDocSelection(doc.filename)}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-all duration-200 ${
                            isSelected 
                              ? 'border-brand-500/35 bg-brand-500/5' 
                              : 'border-slate-900/60 hover:border-slate-800 bg-slate-900/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`p-1.5 rounded-md ${
                              isSelected ? 'bg-brand-500/10 text-brand-400' : 'bg-slate-900 text-slate-500'
                            }`}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-200 truncate" title={doc.filename}>
                                {doc.filename}
                              </p>
                              <p className="text-[9px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-mono">
                                <span>{sizeKb} KB</span>
                                <span>•</span>
                                <span>{doc.chunk_count} chunks</span>
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => handleDeleteDocument(doc.filename, e)}
                            className="p-1 rounded-md text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors focus:outline-none"
                            title="Delete document index"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-slate-900/60 bg-slate-950/40 flex items-center justify-between">
                <button
                  onClick={() => setMessages([])}
                  disabled={messages.length === 0}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Clear Chat History
                </button>
              </div>
            </aside>

            {/* CHAT WINDOW INTERFACE */}
            <div className="flex-1 flex flex-col relative bg-slate-950/10 overflow-hidden">
              
              {/* Local Notification banner */}
              {(errorMsg || successMsg) && (
                <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-none">
                  {errorMsg && (
                    <div className="glass-card border-rose-500/25 bg-rose-950/15 p-3 rounded-lg flex items-center gap-2.5 pointer-events-auto animate-fade-in text-rose-300 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 font-medium">{errorMsg}</span>
                      <button onClick={() => setErrorMsg(null)} className="hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {successMsg && (
                    <div className="glass-card border-emerald-500/25 bg-emerald-950/15 p-3 rounded-lg flex items-center gap-2.5 pointer-events-auto animate-fade-in text-emerald-300 text-xs">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 font-medium">{successMsg}</span>
                      <button onClick={() => setSuccessMsg(null)} className="hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Message scroll container */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-12">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 glow-indicator">
                      <Sparkles className="w-8 h-8 animate-pulse-slow" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 tracking-tight">RAG Q&A Workspace</h2>
                    <p className="text-slate-400 text-sm mt-2 max-w-md">
                      Ask questions about your uploaded documents. Responses are generated based strictly on matching document context snippets.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-10">
                      <button
                        onClick={() => handleSuggestionClick("Summarize the main policies and procedures.")}
                        className="glass-card p-4 text-left rounded-xl text-xs hover:border-brand-500/30 transition-all duration-200 flex items-center justify-between group"
                      >
                        <span className="text-slate-300 font-medium group-hover:text-white transition-colors">"Summarize the main policies and procedures"</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                      <button
                        onClick={() => handleSuggestionClick("What are the working hours and leave policy?")}
                        className="glass-card p-4 text-left rounded-xl text-xs hover:border-brand-500/30 transition-all duration-200 flex items-center justify-between group"
                      >
                        <span className="text-slate-300 font-medium group-hover:text-white transition-colors">"What are the working hours and leave policy?"</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto flex flex-col gap-6">
                    {messages.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      return (
                        <div 
                          key={idx} 
                          className={`flex items-start gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}
                        >
                          {!isUser && (
                            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/25 flex items-center justify-center text-indigo-400 flex-shrink-0">
                              <Sparkles className="w-4 h-4" />
                            </div>
                          )}
                          
                          <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                            isUser 
                              ? 'bg-brand-600 text-white rounded-br-none shadow-lg shadow-brand-950/20' 
                              : 'bg-slate-900/60 border border-slate-900 rounded-bl-none prose-rag shadow-md shadow-black/10'
                          }`}>
                            {isUser ? (
                              <p>{msg.content}</p>
                            ) : (
                              renderMessageContent(msg)
                            )}
                          </div>

                          {isUser && (
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 flex-shrink-0">
                              <div className="w-3.5 h-3.5 rounded-full bg-slate-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {isThinking && (
                      <div className="flex items-start gap-4 justify-start">
                        <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 animate-pulse">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="max-w-[75%] rounded-2xl rounded-bl-none px-5 py-4 bg-slate-900/40 border border-slate-900/40 w-80 space-y-2.5 animate-pulse">
                          <div className="h-3 bg-slate-800 rounded w-full" />
                          <div className="h-3 bg-slate-800 rounded w-5/6" />
                          <div className="h-3 bg-slate-800 rounded w-4/6" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input sticky panel */}
              <div className="p-4 border-t border-slate-900/80 bg-slate-950/30">
                <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-3 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      documents.length === 0 
                        ? "Upload a document in sidebar to ask questions..." 
                        : `Ask a question (Filter active: ${selectedDocs.length} of ${documents.length} docs)...`
                    }
                    disabled={documents.length === 0 || isThinking}
                    className="flex-1 bg-slate-900/50 border border-slate-900/80 focus:border-brand-500 rounded-xl px-4 py-3.5 text-sm placeholder-slate-500 text-slate-200 outline-none transition-all pr-12 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isThinking || documents.length === 0}
                    className="absolute right-2 p-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors focus:outline-none disabled:opacity-30 disabled:hover:bg-brand-600 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                
                <div className="max-w-3xl mx-auto mt-2 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1.5 select-none">
                  <Info className="w-3 h-3" />
                  <span>Answers generated by AI from matching document source splits. Click numeric citation badges to verify claims.</span>
                </div>
              </div>

            </div>

            {/* CITATION INSPECTOR DRAWER SIDEBAR */}
            {isCitationOpen && activeCitation && (
              <aside className="w-96 flex flex-col bg-slate-950/60 border-l border-slate-900/60 select-none animate-slide-in-right z-20 flex-shrink-0">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <FileText className="w-4 h-4" />
                    <h3 className="font-bold text-sm text-slate-200">Citation Inspector</h3>
                  </div>
                  <button 
                    onClick={() => { setIsCitationOpen(false); setActiveCitation(null); }}
                    className="p-1 rounded-md text-slate-500 hover:bg-slate-900 hover:text-slate-300 transition-colors focus:outline-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body Details */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Source File</span>
                    <p className="text-xs font-semibold text-slate-200 bg-slate-900/40 border border-slate-800/40 p-3 rounded-lg flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-brand-400 flex-shrink-0" />
                      {activeCitation.document_name}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Page Reference</span>
                      <div className="bg-slate-900/40 border border-slate-800/40 p-3 rounded-lg text-xs font-bold text-slate-200 flex items-center gap-2">
                        Page {activeCitation.page}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Semantic Match</span>
                      <div className="bg-slate-900/40 border border-slate-800/40 p-3 rounded-lg text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {Math.round(activeCitation.score * 100)}% Match
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">Matching passage context</span>
                    <div className="bg-slate-900/20 border border-slate-900 p-4 rounded-xl text-xs text-slate-300 leading-relaxed max-h-96 overflow-y-auto font-mono">
                      "{activeCitation.snippet}"
                    </div>
                  </div>
                </div>
                
                {/* Footer warning */}
                <div className="p-4 border-t border-slate-900/60 bg-slate-950/40 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5">
                  <Info className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                  <span>This segment was retrieved from document store database using cosine vector mapping and fed directly to Gemini.</span>
                </div>
              </aside>
            )}

          </div>
        )}

      </div>

      {/* Google Sign-In setup & simulation modal */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/65 rounded-2xl p-6 shadow-2xl relative select-none animate-slide-up">
            
            <button
              onClick={() => setIsGoogleModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-brand-400 mb-3">
              <Globe className="w-5 h-5 animate-pulse" />
              <h3 className="font-bold text-sm text-slate-200">Google Authentication Setup</h3>
            </div>

            <div className="text-xs text-slate-400 space-y-2.5 leading-relaxed border-b border-slate-800/80 pb-4 mb-4 text-left">
              <p>Google OAuth Sign-In is supported natively in this application.</p>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Production Setup Instructions:</span>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                <li>Create OAuth Client credentials in your Google Cloud Console.</li>
                <li>Add client ID as <code className="bg-slate-950 text-indigo-300 px-1 py-0.5 rounded">VITE_GOOGLE_CLIENT_ID</code> in the frontend env configuration.</li>
                <li>Add client ID as <code className="bg-slate-950 text-indigo-300 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> in the backend environment variables.</li>
              </ol>
            </div>

            {/* Simulated Sign-In form widget */}
            <form onSubmit={handleGoogleMockLogin} className="space-y-4 text-left">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-2">Simulate Sign-In (Development Mode)</span>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Google Email Address</label>
                <input
                  type="email"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  placeholder="anupam@gmail.com"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {authLoading ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : "Simulate Sign-In"}
              </button>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}

// Reusable Footer Component
function Footer() {
  return (
    <footer className="w-full max-w-5xl mx-auto mt-16 pt-8 border-t border-slate-900/60 pb-8 text-center text-[11px] text-slate-500 select-none flex-shrink-0">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <span>© {new Date().getFullYear()} KnowledgeAssistant. All rights reserved.</span>
        <span className="flex items-center gap-1.5 justify-center">
          Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20 animate-pulse inline" /> by <strong className="text-slate-350 font-semibold">Anupam Singh</strong>
        </span>
      </div>
    </footer>
  );
}

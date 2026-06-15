import os
import sqlite3
import hashlib
import uuid
import datetime
from app.config import settings

class AuthService:
    def __init__(self):
        # Database path inside the persistent vector store directory
        self.db_path = os.path.join(settings.VECTOR_DB_DIR, "auth.db")
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            # Create Users table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            # Create Sessions table for token persistence across restarts
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    email TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.commit()

    def _hash_password(self, password: str, salt: bytes = None) -> tuple[str, str]:
        """
        Hash a password using PBKDF2 with HMAC-SHA256.
        Returns: (hash_hex, salt_hex)
        """
        if salt is None:
            salt = os.urandom(16)
        # 100,000 iterations for secure password hashing
        pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return pw_hash.hex(), salt.hex()

    def register_user(self, username: str, email: str, password: str) -> bool:
        """
        Registers a new user inside the SQLite database with strong password constraints.
        """
        username = username.strip()
        email = email.strip().lower()
        
        if not username or not email or not password:
            raise ValueError("All fields are required.")
            
        # Enforce strong password validation checks
        import re
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", password):
            raise ValueError("Password must contain at least one uppercase letter (A-Z).")
        if not re.search(r"[a-z]", password):
            raise ValueError("Password must contain at least one lowercase letter (a-z).")
        if not re.search(r"[0-9]", password):
            raise ValueError("Password must contain at least one number (0-9).")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            raise ValueError("Password must contain at least one special character (e.g. !@#$%^&*(), etc.).")
            
        with self._get_connection() as conn:
            # Check unique email constraint
            cursor = conn.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                raise ValueError("An account with this email address already exists.")
                
            password_hash, salt = self._hash_password(password)
            created_at = datetime.datetime.now().isoformat()
            
            try:
                conn.execute(
                    "INSERT INTO users (username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
                    (username, email, password_hash, salt, created_at)
                )
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                raise ValueError("An account with this email address already exists.")

    def verify_google_token(self, token: str) -> tuple[str, str]:
        """
        Verifies a Google ID token.
        If it's a simulated developer token (starts with 'mock_google_'), returns mock user info.
        Otherwise, verifies using Google APIs.
        Returns: (username, email)
        """
        token = token.strip()
        if token.startswith("mock_google_"):
            email = token.replace("mock_google_", "").strip().lower()
            username = email.split("@")[0]
            return username, email

        from google.oauth2 import id_token
        from google.auth.transport import requests
        
        google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        
        try:
            # Verify OAuth token signature and claims
            id_info = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                google_client_id if google_client_id else None
            )
            
            # Check issuer
            if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError("Wrong issuer claim.")
                
            email = id_info['email'].strip().lower()
            name = id_info.get('name', email.split('@')[0]).strip()
            return name, email
        except Exception as e:
            raise ValueError(f"Google Token Verification failed: {str(e)}")

    def register_or_login_google_user(self, username: str, email: str) -> tuple[str, str]:
        """
        Logs in a google user. If they do not exist in the user database yet,
        automatically registers them with a secure randomized placeholder password.
        Returns: (username, email)
        """
        email = email.strip().lower()
        
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT username FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            
            if user:
                return user["username"], email
                
            # If user does not exist, sign them up automatically
            # Generate a secure randomized password placeholder (unused for Google accounts)
            random_pw = uuid.uuid4().hex + uuid.uuid4().hex
            password_hash, salt = self._hash_password(random_pw)
            created_at = datetime.datetime.now().isoformat()
            
            conn.execute(
                "INSERT INTO users (username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
                (username, email, password_hash, salt, created_at)
            )
            conn.commit()
            return username, email

    def authenticate_user(self, email: str, password: str) -> tuple[str, str]:
        """
        Verifies login credentials.
        Returns: (username, email)
        """
        email = email.strip().lower()
        
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT username, password_hash, salt FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            if not user:
                raise ValueError("Invalid email or password details.")
                
            stored_hash = user["password_hash"]
            salt = bytes.fromhex(user["salt"])
            
            # Hash incoming password using stored salt and verify match
            computed_hash, _ = self._hash_password(password, salt)
            if computed_hash != stored_hash:
                raise ValueError("Invalid email or password details.")
                
            return user["username"], email

    def create_session(self, username: str, email: str) -> str:
        """
        Creates a session token for the user.
        """
        token = uuid.uuid4().hex
        created_at = datetime.datetime.now().isoformat()
        
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO sessions (token, username, email, created_at) VALUES (?, ?, ?, ?)",
                (token, username, email, created_at)
            )
            conn.commit()
            
        return token

    def verify_session(self, token: str) -> tuple[str, str]:
        """
        Verifies the session token.
        Returns: (username, email) if valid.
        """
        if not token:
            raise ValueError("Authentication token is missing.")
            
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT username, email FROM sessions WHERE token = ?", (token,))
            session = cursor.fetchone()
            if not session:
                raise ValueError("Your session has expired or is invalid. Please log in again.")
            return session["username"], session["email"]

    def delete_session(self, token: str) -> None:
        """
        Invalidates a session token (logout).
        """
        with self._get_connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()

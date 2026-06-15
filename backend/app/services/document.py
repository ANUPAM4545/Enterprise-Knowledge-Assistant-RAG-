import os
import pypdf
from typing import List, Dict, Any

class DocumentProcessor:
    @staticmethod
    def extract_text_by_page(file_path: str) -> List[Dict[str, Any]]:
        """
        Reads a PDF file and extracts text page-by-page.
        
        Returns:
            List of dicts: [
                {"filename": "...", "page": 1, "text": "..."},
                ...
            ]
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Target PDF file not found at: {file_path}")
            
        filename = os.path.basename(file_path)
        pages_content = []
        
        try:
            with open(file_path, "rb") as f:
                reader = pypdf.PdfReader(f)
                num_pages = len(reader.pages)
                
                for i in range(num_pages):
                    page = reader.pages[i]
                    text = page.extract_text()
                    
                    # Normalize text and strip excess whitespace
                    cleaned_text = ""
                    if text:
                        cleaned_text = "\n".join([line.strip() for line in text.split("\n") if line.strip()])
                        
                    pages_content.append({
                        "filename": filename,
                        "page": i + 1,  # Page numbers are 1-indexed for human readability
                        "text": cleaned_text
                    })
        except Exception as e:
            # Fallback error reporting
            print(f"Failed to parse PDF document {filename}: {str(e)}")
            raise e
            
        return pages_content

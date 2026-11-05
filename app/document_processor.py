import re
import os
import json

class DocumentProcessor:
    def __init__(self, chunk_size=500, chunk_overlap=80):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_text(self, file_path=None, raw_text=None, filename=""):
        if raw_text is not None:
            return raw_text.strip()
        
        if not file_path or not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = os.path.splitext(filename or file_path)[1].lower()

        if ext in [".txt", ".md", ".markdown", ".csv"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read().strip()
        
        elif ext == ".json":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                data = json.load(f)
                return json.dumps(data, indent=2)

        elif ext == ".pdf":
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                text = []
                for idx, page in enumerate(reader.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text.append(f"--- Page {idx + 1} ---\n{page_text}")
                return "\n\n".join(text).strip()
            except Exception:
                with open(file_path, "rb") as f:
                    content = f.read().decode("latin1", errors="ignore")
                    clean = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]', ' ', content)
                    return clean[:10000]
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read().strip()

    def chunk_text(self, text, default_heading="General Content"):
        if not text or not text.strip():
            return []

        # Split on markdown headings or double newlines
        paragraphs = re.split(r'\n{2,}', text.strip())
        chunks = []
        current_heading = default_heading
        current_chunk = ""

        heading_pattern = re.compile(r'^(#{1,6}\s+.+|[A-Z0-9\s\.\-]{3,40}:)$')

        for para in paragraphs:
            para_clean = para.strip()
            if not para_clean:
                continue

            lines = para_clean.split("\n")
            first_line = lines[0].strip()
            is_new_heading = bool(heading_pattern.match(first_line))

            # If it's a new heading and we already have accumulated chunk content, flush previous chunk
            if is_new_heading and current_chunk:
                chunks.append({
                    "heading": current_heading,
                    "content": current_chunk.strip(),
                    "token_count": len(current_chunk.split())
                })
                current_heading = first_line.lstrip("#").strip()
                current_chunk = ""
            elif is_new_heading:
                current_heading = first_line.lstrip("#").strip()

            if len(current_chunk) + len(para_clean) <= self.chunk_size:
                current_chunk = (current_chunk + "\n\n" + para_clean).strip()
            else:
                if current_chunk:
                    chunks.append({
                        "heading": current_heading,
                        "content": current_chunk.strip(),
                        "token_count": len(current_chunk.split())
                    })
                    overlap_point = max(0, len(current_chunk) - self.chunk_overlap)
                    current_chunk = current_chunk[overlap_point:].strip()

                if len(para_clean) > self.chunk_size:
                    sentences = re.split(r'(?<=[.!?])\s+', para_clean)
                    for sent in sentences:
                        if len(current_chunk) + len(sent) <= self.chunk_size:
                            current_chunk = (current_chunk + " " + sent).strip()
                        else:
                            if current_chunk:
                                chunks.append({
                                    "heading": current_heading,
                                    "content": current_chunk.strip(),
                                    "token_count": len(current_chunk.split())
                                })
                            current_chunk = sent
                else:
                    current_chunk = (current_chunk + "\n\n" + para_clean).strip()

        if current_chunk and current_chunk.strip():
            chunks.append({
                "heading": current_heading,
                "content": current_chunk.strip(),
                "token_count": len(current_chunk.split())
            })

        return chunks

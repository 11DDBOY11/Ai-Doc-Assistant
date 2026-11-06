"""
document_processor.py — Text extraction and semantic chunking.

Splits raw text into overlapping chunks bounded by markdown headings, project IDs,
and paragraph breaks. Each chunk preserves its section heading and an approximate
word token count for fast retrieval.

Supported file types: .txt, .md, .markdown, .csv, .json, .pdf, .docx
"""

import os
import io
import re
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Precompiled regex patterns for optimal performance
_HEADING_RE = re.compile(
    r'^(#{1,6}\s+.+|[A-Z0-9\s\.\-]{3,40}:|P\d{2}\s*[\-\–\—\•\:]?\s*.+|\d+\.\s+[A-Za-z\s]+.*|Evaluation rubric.*)$',
    re.IGNORECASE
)
_PARAGRAPH_SPLIT_RE = re.compile(r'\n{2,}')
_SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+')
_CONTROL_CHAR_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


class DocumentProcessor:
    """
    Extracts text from supported file types (.txt, .md, .pdf, .docx, .csv, .json)
    and splits content into overlapping chunks with heading context.

    Parameters
    ----------
    chunk_size    : Maximum character length per chunk (default 500)
    chunk_overlap : Character overlap carried between chunks (default 80)
    """

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 80) -> None:
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size.")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_text(
        self,
        file_path: Optional[str] = None,
        raw_text: Optional[str] = None,
        file_bytes: Optional[bytes] = None,
        filename: str = ""
    ) -> str:
        """Extract plain text from raw string, in-memory bytes, or file system path."""
        if raw_text is not None:
            return raw_text.strip()

        ext = os.path.splitext(filename or file_path or "")[1].lower()

        if file_bytes is not None:
            if ext in {".txt", ".md", ".markdown", ".csv"}:
                return file_bytes.decode("utf-8", errors="ignore").strip()
            if ext == ".json":
                import json
                data = json.loads(file_bytes.decode("utf-8", errors="ignore"))
                return json.dumps(data, indent=2)
            if ext == ".docx":
                return self._extract_docx(io.BytesIO(file_bytes))
            if ext == ".pdf":
                return self._extract_pdf(io.BytesIO(file_bytes))
            return file_bytes.decode("utf-8", errors="ignore").strip()

        if not file_path:
            raise ValueError("file_path, raw_text, or file_bytes must be provided.")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        if ext in {".txt", ".md", ".markdown", ".csv"}:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                return fh.read().strip()

        if ext == ".json":
            import json
            with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                data = json.load(fh)
            return json.dumps(data, indent=2)

        if ext == ".docx":
            return self._extract_docx(file_path)

        if ext == ".pdf":
            return self._extract_pdf(file_path)

        logger.warning("Unrecognized file extension '%s', attempting UTF-8 read.", ext)
        with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
            return fh.read().strip()

    def _extract_docx(self, source: Any) -> str:
        """Extract plain text paragraphs from a Word .docx document or BytesIO stream."""
        import zipfile
        import xml.etree.ElementTree as ET
        try:
            with zipfile.ZipFile(source) as z:
                xml_content = z.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                paras = []
                for p in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
                    text = "".join(
                        node.text for node in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")
                        if node.text
                    )
                    if text.strip():
                        # Normalize unicode dashes, quotes, and whitespace
                        clean = (
                            text.strip()
                            .replace('\u2013', '-')
                            .replace('\u2014', '-')
                            .replace('\u2019', "'")
                            .replace('\u2018', "'")
                            .replace('\u201c', '"')
                            .replace('\u201d', '"')
                        )
                        paras.append(clean)
                return "\n\n".join(paras).strip()
        except Exception as exc:
            logger.warning("DOCX extraction failed (%s); returning empty text.", exc)
            return ""

    def _extract_pdf(self, source: Any) -> str:
        """Extract text from PDF using pypdf, with safe fallback."""
        try:
            import pypdf
            reader = pypdf.PdfReader(source)
            pages = []
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    pages.append(f"--- Page {i + 1} ---\n{page_text}")
            result = "\n\n".join(pages).strip()
            if result:
                return result
            raise ValueError("pypdf extracted zero text.")
        except Exception as exc:
            logger.warning("PDF extraction with pypdf failed (%s); trying fallback decode.", exc)
            if hasattr(source, "read"):
                source.seek(0)
                raw = source.read().decode("latin1", errors="ignore")
            else:
                with open(source, "rb") as fh:
                    raw = fh.read().decode("latin1", errors="ignore")
            return _CONTROL_CHAR_RE.sub(" ", raw)[:10_000].strip()

    def chunk_text(self, text: str, default_heading: str = "General Content") -> List[Dict[str, Any]]:
        """
        Split text into overlapping chunks honoring headings, project codes, and paragraph boundaries.
        Returns a list of dicts with: heading, content, token_count.
        """
        if not text or not text.strip():
            return []

        paragraphs = _PARAGRAPH_SPLIT_RE.split(text.strip())
        chunks: List[Dict[str, Any]] = []
        current_heading = default_heading
        current_chunk = ""

        for para in paragraphs:
            para_clean = para.strip()
            if not para_clean:
                continue

            first_line = para_clean.split("\n")[0].strip()
            is_heading = bool(_HEADING_RE.match(first_line))

            if is_heading and current_chunk:
                chunks.append(self._make_chunk(current_heading, current_chunk))
                current_heading = first_line.lstrip("#").strip()
                current_chunk = ""
            elif is_heading:
                current_heading = first_line.lstrip("#").strip()

            if len(current_chunk) + len(para_clean) <= self.chunk_size:
                current_chunk = (current_chunk + "\n\n" + para_clean).strip()
            else:
                if current_chunk:
                    chunks.append(self._make_chunk(current_heading, current_chunk))
                    current_chunk = current_chunk[
                        max(0, len(current_chunk) - self.chunk_overlap):
                    ].strip()

                if len(para_clean) > self.chunk_size:
                    for sent in _SENTENCE_SPLIT_RE.split(para_clean):
                        if len(current_chunk) + len(sent) <= self.chunk_size:
                            current_chunk = (current_chunk + " " + sent).strip()
                        else:
                            if current_chunk:
                                chunks.append(self._make_chunk(current_heading, current_chunk))
                            current_chunk = sent
                else:
                    current_chunk = (current_chunk + "\n\n" + para_clean).strip()

        if current_chunk.strip():
            chunks.append(self._make_chunk(current_heading, current_chunk))

        return chunks

    @staticmethod
    def _make_chunk(heading: str, content: str) -> Dict[str, Any]:
        body = content.strip()
        return {
            "heading": heading,
            "content": body,
            "token_count": len(body.split()),
        }

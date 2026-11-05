"""
app.py — FastAPI service for AI Document Assistant.

Features
--------
- Hybrid TF-IDF + BM25 retrieval with sub-millisecond precomputed cache lookup.
- Incremental vector indexing on document uploads.
- Groq LPU inference with resilient deterministic local fallback.
- SQLite audit logging with full foreign key cascades and WAL mode.
- OpenAPI schema documentation at /docs.
"""

import os
import sys
import time
import logging
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# Ensure app directory is in Python path
sys.path.insert(0, os.path.dirname(__file__))

import database as db
from document_processor import DocumentProcessor
from vector_store import HybridVectorStore
from qa_engine import QAEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai_document_assistant")

# Maximum upload size: 20 MB
MAX_UPLOAD_BYTES: int = 20 * 1024 * 1024

# Global engine instances
processor = DocumentProcessor(chunk_size=500, chunk_overlap=80)
vector_store = HybridVectorStore(bm25_k1=1.5, bm25_b=0.75, vector_weight=0.55)
qa_engine = QAEngine(vector_store, min_confidence_threshold=0.20)


def refresh_vector_index() -> int:
    """Full index rebuild from database chunks. Used at startup or after deletions."""
    all_chunks = db.get_all_chunks()
    vector_store.index_chunks(all_chunks)
    logger.info("Vector index rebuilt with %d chunks.", len(all_chunks))
    return len(all_chunks)


def create_summary_preview(text: str, max_chars: int = 200) -> str:
    """DRY utility to create a clean single-line preview snippet."""
    clean_text = text.replace("\n", " ").strip()
    return clean_text[:max_chars].strip() + ("..." if len(clean_text) > max_chars else "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown procedures."""
    logger.info("Initializing database...")
    db.init_db()
    total_indexed = refresh_vector_index()
    logger.info("Startup complete: %d chunks indexed in HybridVectorStore.", total_indexed)
    yield
    logger.info("Service shutting down cleanly.")


app = FastAPI(
    title="AI Document Assistant API",
    description="Production-grade RAG Assistant with Groq API LPU inference and hybrid vector retrieval.",
    version="1.2.0",
    lifespan=lifespan
)

# CORS configuration: Wildcard origins must have allow_credentials=False for browser security compliance
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Request Models
class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Question or search query.")
    top_k: Optional[int] = Field(3, ge=1, le=10, description="Number of context chunks to retrieve.")
    filter_doc_id: Optional[int] = Field(None, description="Optional document ID constraint.")
    threshold: Optional[float] = Field(0.20, ge=0.0, le=1.0, description="Minimum confidence threshold.")
    groq_api_key: Optional[str] = Field(None, description="Optional Groq API Key.")
    groq_model: Optional[str] = Field("llama-3.3-70b-versatile", description="Target Groq model identifier.")


class TextUploadRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Title of the text document.")
    content: str = Field(..., min_length=1, description="Raw text content of the document.")


# Resolve frontend dist path
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist"))
if os.path.exists(FRONTEND_DIST) and os.path.exists(os.path.join(FRONTEND_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")


@app.get("/", tags=["General"])
def root(request: Request):
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_file) and "text/html" in request.headers.get("accept", ""):
        return FileResponse(index_file)

    return {
        "project": "AI Document Assistant",
        "author": "Darshan Dashyal",
        "features": [
            "React Minimalist UI",
            "Precomputed Hybrid TF-IDF + BM25 Caching",
            "Incremental Vector Indexing",
            "Groq API LPU Inference with Grounding Guardrails",
            "SQLite WAL Audit Logging"
        ],
        "docs_url": "/docs",
        "health_check": "/api/health"
    }


@app.get("/api/health", tags=["Monitoring"])
def health_check():
    docs = db.get_all_documents()
    total_chunks = sum(d["total_chunks"] for d in docs)
    return {
        "status": "healthy",
        "version": "1.2.0",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "default_groq_model": "llama-3.3-70b-versatile",
        "total_documents": len(docs),
        "total_chunks_indexed": len(vector_store.chunks),
        "vocabulary_size": len(vector_store.vocabulary),
        "database_connected": True,
        "timestamp": time.time()
    }


@app.get("/api/documents", tags=["Documents"])
def list_documents():
    docs = db.get_all_documents()
    return {"success": True, "documents": docs}


@app.post("/api/documents/upload-text", tags=["Documents"], status_code=status.HTTP_201_CREATED)
def upload_text_doc(req: TextUploadRequest):
    content_stripped = req.content.strip()
    if not content_stripped:
        raise HTTPException(status_code=400, detail="Document content cannot be empty.")

    file_size = len(content_stripped.encode("utf-8"))
    if file_size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Document exceeds maximum size of {MAX_UPLOAD_BYTES} bytes.")

    title = req.title.strip() or "Untitled Document"
    filename = f"{title.lower().replace(' ', '_')}.txt"

    chunks = processor.chunk_text(content_stripped, default_heading=title)
    if not chunks:
        raise HTTPException(status_code=400, detail="Failed to parse text into readable chunks.")

    summary_preview = create_summary_preview(content_stripped)
    doc_id = db.save_document(title, filename, ".txt", file_size, summary_preview)
    saved_chunks = db.save_chunks(doc_id, chunks)

    # Attach doc title and filename for retrieval citations
    for c in saved_chunks:
        c["doc_title"] = title
        c["filename"] = filename

    # Incremental update: O(new) tokenization, avoids retokenizing previous documents
    vector_store.add_chunks(saved_chunks)

    return {
        "success": True,
        "document_id": doc_id,
        "title": title,
        "total_chunks": len(saved_chunks),
        "total_indexed_system_wide": len(vector_store.chunks)
    }


@app.post("/api/documents/upload", tags=["Documents"], status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None)
):
    content_bytes = await file.read()
    file_size = len(content_bytes)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if file_size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of {MAX_UPLOAD_BYTES} bytes.")

    doc_title = title.strip() if title else os.path.splitext(file.filename)[0].replace("_", " ").title()
    ext = os.path.splitext(file.filename)[1].lower()

    content = content_bytes.decode("utf-8", errors="ignore")
    if not content.strip():
        raise HTTPException(status_code=400, detail="Uploaded file contains no readable text.")

    chunks = processor.chunk_text(content, default_heading=doc_title)
    if not chunks:
        raise HTTPException(status_code=400, detail="No readable chunks generated from file.")

    summary_preview = create_summary_preview(content)
    doc_id = db.save_document(doc_title, file.filename, ext, file_size, summary_preview)
    saved_chunks = db.save_chunks(doc_id, chunks)

    for c in saved_chunks:
        c["doc_title"] = doc_title
        c["filename"] = file.filename

    vector_store.add_chunks(saved_chunks)

    return {
        "success": True,
        "document_id": doc_id,
        "title": doc_title,
        "filename": file.filename,
        "total_chunks": len(saved_chunks),
        "total_indexed_system_wide": len(vector_store.chunks)
    }


@app.get("/api/documents/{doc_id}/chunks", tags=["Documents"])
def get_chunks(doc_id: int):
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found.")
    chunks = db.get_document_chunks(doc_id)
    return {"success": True, "document_id": doc_id, "chunks": chunks}


@app.delete("/api/documents/{doc_id}", tags=["Documents"])
def delete_doc(doc_id: int):
    deleted = db.delete_document(doc_id)
    if deleted:
        refresh_vector_index()
        return {"success": True, "message": f"Document {doc_id} deleted successfully."}
    raise HTTPException(status_code=404, detail="Document not found.")


@app.post("/api/query", tags=["Query"])
def query_documents(
    req: QueryRequest,
    x_groq_api_key: Optional[str] = Header(None)
):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Header takes precedence over body
    groq_key = x_groq_api_key or req.groq_api_key or os.getenv("GROQ_API_KEY")

    result = qa_engine.answer_query(
        query=req.query,
        top_k=req.top_k,
        filter_doc_id=req.filter_doc_id,
        custom_threshold=req.threshold,
        groq_api_key=groq_key,
        groq_model=req.groq_model
    )

    sources_to_log = [{"chunk_id": c["chunk_id"], "score": c["score"]} for c in result["citations"]]
    db.log_query(
        query_text=req.query,
        answer_text=result["answer"],
        confidence_score=result["confidence_score"],
        status=result["status"],
        latency_ms=result["latency_ms"],
        sources=sources_to_log,
        filter_doc_id=req.filter_doc_id
    )

    return {"success": True, "result": result}


@app.get("/api/history", tags=["Audit"])
def get_history(limit: int = 25):
    history = db.get_query_history(limit=min(limit, 100))
    return {"success": True, "history": history}


@app.get("/api/export", tags=["Audit"])
def export_session():
    history = db.get_query_history(limit=100)
    docs = db.get_all_documents()
    return {
        "project": "AI Document Assistant",
        "author": "Darshan Dashyal",
        "exported_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_documents": len(docs),
        "documents": docs,
        "query_history": history
    }


@app.post("/api/sample-docs/load", tags=["Documents"])
def load_sample_docs():
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sample_docs")
    loaded = []
    if os.path.exists(sample_dir):
        for f in sorted(os.listdir(sample_dir)):
            if f.endswith((".md", ".txt")):
                path = os.path.join(sample_dir, f)
                title = os.path.splitext(f)[0].replace("_", " ").title()
                with open(path, "r", encoding="utf-8") as fp:
                    content = fp.read()
                chunks = processor.chunk_text(content, default_heading=title)
                doc_id = db.save_document(title, f, ".md", os.path.getsize(path), create_summary_preview(content))
                saved_chunks = db.save_chunks(doc_id, chunks)
                for c in saved_chunks:
                    c["doc_title"] = title
                    c["filename"] = f
                vector_store.add_chunks(saved_chunks)
                loaded.append(title)
    return {"success": True, "loaded_documents": loaded}

import os
import sys
import time
from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add local path
sys.path.insert(0, os.path.dirname(__file__))

import database as db
from document_processor import DocumentProcessor
from vector_store import HybridVectorStore
from qa_engine import QAEngine

app = FastAPI(
    title="AI Document Assistant API (Groq-Enabled)",
    description="Backend service for P07 - AI Document Assistant with Groq API LPU inference and hybrid vector retrieval",
    version="1.1.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core engine initialization
db.init_db()
processor = DocumentProcessor(chunk_size=500, chunk_overlap=80)
vector_store = HybridVectorStore(bm25_k1=1.5, bm25_b=0.75, vector_weight=0.55)
qa_engine = QAEngine(vector_store, min_confidence_threshold=0.20)

def refresh_vector_index():
    all_chunks = db.get_all_chunks()
    vector_store.index_chunks(all_chunks)
    return len(all_chunks)

# Index existing data on startup
refresh_vector_index()

# Pydantic Request Models
class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3
    filter_doc_id: Optional[int] = None
    threshold: Optional[float] = 0.20
    groq_api_key: Optional[str] = None
    groq_model: Optional[str] = "llama-3.3-70b-versatile"

class TextUploadRequest(BaseModel):
    title: str
    content: str

@app.get("/")
def root():
    return {
        "project": "P07 - AI Document Assistant",
        "author": "Devaraj G (USN: 4AL24EC404)",
        "features": ["Hybrid TF-IDF + BM25 RAG", "Groq API LPU Integration", "SQLite Audit"],
        "docs_url": "/docs",
        "api_health": "/api/health"
    }

@app.get("/api/health")
def health_check():
    docs = db.get_all_documents()
    total_chunks = sum(d["total_chunks"] for d in docs)
    return {
        "status": "healthy",
        "service": "AI Document Assistant - P07",
        "version": "1.1.0",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "default_groq_model": "llama-3.3-70b-versatile",
        "total_documents": len(docs),
        "total_chunks_indexed": total_chunks,
        "vocabulary_size": len(vector_store.vocabulary),
        "timestamp": time.time()
    }

@app.get("/api/documents")
def list_documents():
    docs = db.get_all_documents()
    return {"success": True, "documents": docs}

@app.post("/api/documents/upload-text")
def upload_text_doc(req: TextUploadRequest):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Document content cannot be empty")
    
    title = req.title.strip() or "Untitled Document"
    filename = f"{title.lower().replace(' ', '_')}.txt"
    file_size = len(req.content.encode("utf-8"))

    chunks = processor.chunk_text(req.content, default_heading=title)
    if not chunks:
        raise HTTPException(status_code=400, detail="Failed to parse chunks from content")

    summary_preview = req.content[:200].replace("\n", " ").strip() + "..."
    doc_id = db.save_document(title, filename, ".txt", file_size, summary_preview)
    db.save_chunks(doc_id, chunks)

    total_indexed = refresh_vector_index()
    return {
        "success": True,
        "document_id": doc_id,
        "title": title,
        "total_chunks": len(chunks),
        "total_indexed_system_wide": total_indexed
    }

@app.post("/api/documents/upload")
async def upload_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None)
):
    doc_title = title.strip() if title else os.path.splitext(file.filename)[0].replace("_", " ").title()
    content_bytes = await file.read()
    file_size = len(content_bytes)
    ext = os.path.splitext(file.filename)[1].lower()

    content = content_bytes.decode("utf-8", errors="ignore")

    if not content.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty or unreadable")

    chunks = processor.chunk_text(content, default_heading=doc_title)
    if not chunks:
        raise HTTPException(status_code=400, detail="No text chunks generated")

    summary = content[:200].replace("\n", " ").strip() + "..."
    doc_id = db.save_document(doc_title, file.filename, ext, file_size, summary)
    db.save_chunks(doc_id, chunks)

    total_indexed = refresh_vector_index()
    return {
        "success": True,
        "document_id": doc_id,
        "title": doc_title,
        "filename": file.filename,
        "total_chunks": len(chunks),
        "total_indexed_system_wide": total_indexed
    }

@app.get("/api/documents/{doc_id}/chunks")
def get_chunks(doc_id: int):
    chunks = db.get_document_chunks(doc_id)
    return {"success": True, "document_id": doc_id, "chunks": chunks}

@app.delete("/api/documents/{doc_id}")
def delete_doc(doc_id: int):
    deleted = db.delete_document(doc_id)
    if deleted:
        refresh_vector_index()
        return {"success": True, "message": f"Document {doc_id} deleted"}
    raise HTTPException(status_code=404, detail="Document not found")

@app.post("/api/query")
def query_documents(
    req: QueryRequest,
    x_groq_api_key: Optional[str] = Header(None)
):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    groq_key = req.groq_api_key or x_groq_api_key or os.getenv("GROQ_API_KEY")

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

@app.get("/api/history")
def get_history(limit: int = 25):
    history = db.get_query_history(limit=limit)
    return {"success": True, "history": history}

@app.get("/api/export")
def export_session():
    history = db.get_query_history(limit=100)
    docs = db.get_all_documents()
    return {
        "project": "P07 - AI Document Assistant",
        "candidate": "Devaraj G (USN: 4AL24EC404)",
        "exported_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_documents": len(docs),
        "documents": docs,
        "query_history": history
    }

@app.post("/api/sample-docs/load")
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
                doc_id = db.save_document(title, f, ".md", os.path.getsize(path), content[:200])
                db.save_chunks(doc_id, chunks)
                loaded.append(title)
        refresh_vector_index()
    return {"success": True, "loaded_documents": loaded}

import sqlite3
import os
import json
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "assistant.db")

@contextmanager
def get_db(db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db(db_path=DB_PATH):
    with get_db(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                total_chunks INTEGER NOT NULL DEFAULT 0,
                summary TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                heading TEXT,
                content TEXT NOT NULL,
                token_count INTEGER NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS query_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query_text TEXT NOT NULL,
                answer_text TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                status TEXT NOT NULL,
                latency_ms REAL NOT NULL,
                filter_doc_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS query_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query_id INTEGER NOT NULL,
                chunk_id INTEGER NOT NULL,
                relevance_score REAL NOT NULL,
                FOREIGN KEY (query_id) REFERENCES query_logs (id) ON DELETE CASCADE,
                FOREIGN KEY (chunk_id) REFERENCES chunks (id) ON DELETE CASCADE
            )
        """)
        conn.commit()

def save_document(title, filename, file_type, file_size, summary=""):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO documents (title, filename, file_type, file_size, summary)
            VALUES (?, ?, ?, ?, ?)
        """, (title, filename, file_type, file_size, summary))
        conn.commit()
        return cursor.lastrowid

def save_chunks(document_id, chunks_data):
    with get_db() as conn:
        cursor = conn.cursor()
        for idx, ch in enumerate(chunks_data):
            cursor.execute("""
                INSERT INTO chunks (document_id, chunk_index, heading, content, token_count)
                VALUES (?, ?, ?, ?, ?)
            """, (document_id, idx, ch.get("heading", ""), ch.get("content", ""), ch.get("token_count", 0)))
        cursor.execute("UPDATE documents SET total_chunks = ? WHERE id = ?", (len(chunks_data), document_id))
        conn.commit()

def get_all_documents():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM documents ORDER BY uploaded_at DESC")
        return [dict(row) for row in cursor.fetchall()]

def get_document(doc_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_document_chunks(doc_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC", (doc_id,))
        return [dict(row) for row in cursor.fetchall()]

def get_all_chunks(filter_doc_id=None):
    with get_db() as conn:
        cursor = conn.cursor()
        if filter_doc_id:
            cursor.execute("""
                SELECT c.*, d.title as doc_title, d.filename 
                FROM chunks c 
                JOIN documents d ON c.document_id = d.id 
                WHERE c.document_id = ? 
                ORDER BY c.id ASC
            """, (filter_doc_id,))
        else:
            cursor.execute("""
                SELECT c.*, d.title as doc_title, d.filename 
                FROM chunks c 
                JOIN documents d ON c.document_id = d.id 
                ORDER BY c.id ASC
            """)
        return [dict(row) for row in cursor.fetchall()]

def delete_document(doc_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM chunks WHERE document_id = ?", (doc_id,))
        cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        return cursor.rowcount > 0

def log_query(query_text, answer_text, confidence_score, status, latency_ms, sources, filter_doc_id=None):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO query_logs (query_text, answer_text, confidence_score, status, latency_ms, filter_doc_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (query_text, answer_text, confidence_score, status, latency_ms, filter_doc_id))
        query_id = cursor.lastrowid
        for src in sources:
            cursor.execute("""
                INSERT INTO query_sources (query_id, chunk_id, relevance_score)
                VALUES (?, ?, ?)
            """, (query_id, src["chunk_id"], src["score"]))
        conn.commit()
        return query_id

def get_query_history(limit=25):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT q.*, d.title as filter_doc_title 
            FROM query_logs q
            LEFT JOIN documents d ON q.filter_doc_id = d.id
            ORDER BY q.created_at DESC 
            LIMIT ?
        """, (limit,))
        logs = [dict(row) for row in cursor.fetchall()]
        for log in logs:
            cursor.execute("""
                SELECT qs.relevance_score, c.chunk_index, c.heading, c.content, d.title as doc_title
                FROM query_sources qs
                JOIN chunks c ON qs.chunk_id = c.id
                JOIN documents d ON c.document_id = d.id
                WHERE qs.query_id = ?
            """, (log["id"],))
            log["sources"] = [dict(r) for r in cursor.fetchall()]
        return logs

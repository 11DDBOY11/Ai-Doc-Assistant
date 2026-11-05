"""
database.py — SQLite persistence layer for AI Document Assistant.

Schema
------
documents     — Uploaded document metadata
chunks        — Text segments with headings and token counts
query_logs    — User queries, generated answers, latency, and status
query_sources — Many-to-many link between query_logs and cited chunks

Key Performance & Integrity Features
------------------------------------
- PRAGMA foreign_keys = ON enforces ON DELETE CASCADE integrity.
- PRAGMA journal_mode = WAL enhances concurrent read/write performance.
- Single JOIN query in get_query_history prevents the N+1 query problem.
- Secondary indexes optimize lookups on document chunks and recent logs.
"""

import os
import logging
import sqlite3
from typing import List, Dict, Optional, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "assistant.db")


@contextmanager
def get_db(db_path: Optional[str] = None):
    """
    Context manager yielding an SQLite connection configured with Row factory,
    foreign key enforcement, and write-ahead logging (WAL).
    """
    path = db_path or DB_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
    finally:
        conn.close()


def init_db(db_path: Optional[str] = None) -> None:
    """Initialize database tables and performance indexes."""
    with get_db(db_path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS documents (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT    NOT NULL,
                filename     TEXT    NOT NULL,
                file_type    TEXT    NOT NULL,
                file_size    INTEGER NOT NULL,
                total_chunks INTEGER NOT NULL DEFAULT 0,
                summary      TEXT,
                uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chunks (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id   INTEGER NOT NULL,
                chunk_index   INTEGER NOT NULL,
                heading       TEXT,
                content       TEXT    NOT NULL,
                token_count   INTEGER NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS query_logs (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                query_text       TEXT  NOT NULL,
                answer_text      TEXT  NOT NULL,
                confidence_score REAL  NOT NULL,
                status           TEXT  NOT NULL,
                latency_ms       REAL  NOT NULL,
                filter_doc_id    INTEGER,
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS query_sources (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                query_id        INTEGER NOT NULL,
                chunk_id        INTEGER NOT NULL,
                relevance_score REAL    NOT NULL,
                FOREIGN KEY (query_id) REFERENCES query_logs (id) ON DELETE CASCADE,
                FOREIGN KEY (chunk_id) REFERENCES chunks (id)     ON DELETE CASCADE
            );

            -- Indexes for fast retrieval
            CREATE INDEX IF NOT EXISTS idx_chunks_doc_id      ON chunks (document_id);
            CREATE INDEX IF NOT EXISTS idx_chunks_doc_order   ON chunks (document_id, chunk_index);
            CREATE INDEX IF NOT EXISTS idx_query_logs_time    ON query_logs (created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_query_sources_qid  ON query_sources (query_id);
        """)
        conn.commit()
        logger.info("Database initialized at %s.", db_path or DB_PATH)


def save_document(
    title: str,
    filename: str,
    file_type: str,
    file_size: int,
    summary: str = ""
) -> int:
    """Insert a new document record and return its primary key id."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO documents (title, filename, file_type, file_size, summary)
               VALUES (?, ?, ?, ?, ?)""",
            (title, filename, file_type, file_size, summary)
        )
        conn.commit()
        return cursor.lastrowid


def save_chunks(document_id: int, chunks_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Persist chunk segments in batch and update document chunk total.
    Returns the chunks augmented with their assigned database IDs.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        saved_chunks: List[Dict[str, Any]] = []
        for idx, ch in enumerate(chunks_data):
            cursor.execute(
                """INSERT INTO chunks (document_id, chunk_index, heading, content, token_count)
                   VALUES (?, ?, ?, ?, ?)""",
                (document_id, idx, ch.get("heading", ""), ch.get("content", ""), ch.get("token_count", 0))
            )
            chunk_copy = dict(ch)
            chunk_copy["id"] = cursor.lastrowid
            chunk_copy["document_id"] = document_id
            chunk_copy["chunk_index"] = idx
            saved_chunks.append(chunk_copy)

        cursor.execute("UPDATE documents SET total_chunks = ? WHERE id = ?", (len(chunks_data), document_id))
        conn.commit()
        return saved_chunks


def get_all_documents() -> List[Dict[str, Any]]:
    """Retrieve all document metadata sorted by most recent upload."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM documents ORDER BY uploaded_at DESC")
        return [dict(row) for row in cursor.fetchall()]


def get_document(doc_id: int) -> Optional[Dict[str, Any]]:
    """Fetch single document metadata by id."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_document_chunks(doc_id: int) -> List[Dict[str, Any]]:
    """Fetch chunks belonging to a specific document ordered by index."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC",
            (doc_id,)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_all_chunks(filter_doc_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetch all chunks across documents with joined document titles."""
    with get_db() as conn:
        cursor = conn.cursor()
        if filter_doc_id is not None:
            cursor.execute(
                """SELECT c.*, d.title AS doc_title, d.filename
                   FROM chunks c JOIN documents d ON c.document_id = d.id
                   WHERE c.document_id = ? ORDER BY c.id ASC""",
                (filter_doc_id,)
            )
        else:
            cursor.execute(
                """SELECT c.*, d.title AS doc_title, d.filename
                   FROM chunks c JOIN documents d ON c.document_id = d.id
                   ORDER BY c.id ASC"""
            )
        return [dict(row) for row in cursor.fetchall()]


def delete_document(doc_id: int) -> bool:
    """
    Delete document. Cascades deletion to chunks and query_sources automatically
    via database foreign key constraints.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        return cursor.rowcount > 0


def log_query(
    query_text: str,
    answer_text: str,
    confidence_score: float,
    status: str,
    latency_ms: float,
    sources: List[Dict[str, Any]],
    filter_doc_id: Optional[int] = None,
) -> int:
    """Record query outcome and cited chunk references in query_logs and query_sources."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO query_logs
               (query_text, answer_text, confidence_score, status, latency_ms, filter_doc_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (query_text, answer_text, confidence_score, status, latency_ms, filter_doc_id)
        )
        query_id = cursor.lastrowid
        if sources:
            cursor.executemany(
                "INSERT INTO query_sources (query_id, chunk_id, relevance_score) VALUES (?, ?, ?)",
                [(query_id, s["chunk_id"], s["score"]) for s in sources]
            )
        conn.commit()
        return query_id


def get_query_history(limit: int = 25) -> List[Dict[str, Any]]:
    """
    Return recent query records along with their cited sources.
    Optimized with a single LEFT JOIN query to prevent N+1 queries.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                q.id, q.query_text, q.answer_text, q.confidence_score,
                q.status, q.latency_ms, q.filter_doc_id, q.created_at,
                fd.title          AS filter_doc_title,
                qs.relevance_score,
                c.chunk_index, c.heading,
                substr(c.content, 1, 500) AS content,
                dc.title          AS doc_title
            FROM (SELECT * FROM query_logs ORDER BY created_at DESC LIMIT ?) q
            LEFT JOIN documents     fd  ON q.filter_doc_id = fd.id
            LEFT JOIN query_sources qs  ON qs.query_id    = q.id
            LEFT JOIN chunks        c   ON qs.chunk_id     = c.id
            LEFT JOIN documents     dc  ON c.document_id   = dc.id
            ORDER BY q.created_at DESC, q.id DESC
            """,
            (limit,)
        )
        rows = cursor.fetchall()

    logs: Dict[int, Dict[str, Any]] = {}
    order: List[int] = []

    for row in rows:
        r = dict(row)
        qid = r["id"]
        if qid not in logs:
            logs[qid] = {
                "id":               qid,
                "query_text":       r["query_text"],
                "answer_text":      r["answer_text"],
                "confidence_score": r["confidence_score"],
                "status":           r["status"],
                "latency_ms":       r["latency_ms"],
                "filter_doc_id":    r["filter_doc_id"],
                "filter_doc_title": r["filter_doc_title"],
                "created_at":       r["created_at"],
                "sources":          [],
            }
            order.append(qid)
        if r["relevance_score"] is not None:
            logs[qid]["sources"].append({
                "relevance_score": r["relevance_score"],
                "chunk_index":     r["chunk_index"],
                "heading":         r["heading"],
                "content":         r["content"],
                "doc_title":       r["doc_title"],
            })

    return [logs[qid] for qid in order]

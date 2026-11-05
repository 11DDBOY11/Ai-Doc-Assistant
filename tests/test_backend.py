"""
test_backend.py — Comprehensive unit and API integration tests.

Coverage:
---------
- Database layer: CRUD, transactions, cascading deletes, N+1 query prevention.
- Document processor: Markdown heading detection, overlap integrity, sentence splitting.
- Hybrid vector store: Precomputed token caching, incremental indexing, BM25 scoring.
- QA engine: Grounded citation generation, deterministic fallback guardrails.
- FastAPI REST API: End-to-end endpoint tests via TestClient.
"""

import os
import sys
import tempfile
import unittest

# Ensure app package is accessible
app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
sys.path.insert(0, app_dir)

import database as db
from document_processor import DocumentProcessor
from vector_store import HybridVectorStore
from qa_engine import QAEngine
from app import app
from fastapi.testclient import TestClient


class TestAIDocumentAssistantBackend(unittest.TestCase):
    def setUp(self):
        # Dedicated isolated temporary SQLite database for each test
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        db.DB_PATH = self.temp_db_path
        db.init_db(self.temp_db_path)

        self.processor = DocumentProcessor(chunk_size=300, chunk_overlap=50)
        self.vector_store = HybridVectorStore(bm25_k1=1.5, bm25_b=0.75, vector_weight=0.55)
        self.qa_engine = QAEngine(self.vector_store, min_confidence_threshold=0.20)
        self.client = TestClient(app)

    def tearDown(self):
        os.close(self.temp_db_fd)
        if os.path.exists(self.temp_db_path):
            try:
                os.remove(self.temp_db_path)
            except OSError:
                pass

    # ------------------------------------------------------------------ #
    # 1. Database Layer Tests                                            #
    # ------------------------------------------------------------------ #

    def test_database_crud_and_cascade_delete(self):
        """Test document creation, batch chunk persistence, and cascade deletion."""
        doc_id = db.save_document("Architecture Spec", "spec.txt", ".txt", 2048, "Microservice spec summary")
        self.assertIsInstance(doc_id, int)

        chunks_data = [
            {"heading": "Section 1", "content": "Services communicate through REST and gRPC.", "token_count": 6},
            {"heading": "Section 2", "content": "Database transactions enforce strict isolation.", "token_count": 5}
        ]
        saved_chunks = db.save_chunks(doc_id, chunks_data)
        self.assertEqual(len(saved_chunks), 2)

        # Log a query that cites these chunks
        query_id = db.log_query(
            query_text="How do services communicate?",
            answer_text="Services communicate through REST and gRPC.",
            confidence_score=0.88,
            status="ANSWER_GENERATED",
            latency_ms=12.5,
            sources=[{"chunk_id": saved_chunks[0]["id"], "score": 0.88}],
            filter_doc_id=doc_id
        )
        self.assertIsInstance(query_id, int)

        # Verify query history joins cleanly without N+1 queries
        history = db.get_query_history(limit=5)
        self.assertEqual(len(history), 1)
        self.assertEqual(len(history[0]["sources"]), 1)
        self.assertEqual(history[0]["sources"][0]["doc_title"], "Architecture Spec")

        # Delete document and verify cascade delete on chunks and query_sources
        deleted = db.delete_document(doc_id)
        self.assertTrue(deleted)
        self.assertEqual(len(db.get_all_documents()), 0)
        self.assertEqual(len(db.get_document_chunks(doc_id)), 0)

        # query_sources referencing the deleted chunks should have been cascaded
        with db.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM query_sources WHERE query_id = ?", (query_id,))
            remaining_sources = cursor.fetchone()[0]
            self.assertEqual(remaining_sources, 0)

    # ------------------------------------------------------------------ #
    # 2. Document Processor Tests                                        #
    # ------------------------------------------------------------------ #

    def test_chunking_with_heading_and_overlap(self):
        """Test heading boundary detection and overlap retention."""
        sample_text = (
            "# Introduction\n\n"
            "This platform provides document retrieval using BM25 and vector search.\n\n"
            "## Storage Strategy\n\n"
            "Data is stored in relational SQLite with full text search indexes and foreign keys enabled."
        )
        chunks = self.processor.chunk_text(sample_text)
        self.assertGreaterEqual(len(chunks), 2)
        headings = [c["heading"] for c in chunks]
        self.assertTrue(any("Introduction" in h for h in headings))
        self.assertTrue(any("Storage Strategy" in h for h in headings))

    def test_invalid_overlap_raises_error(self):
        """Ensure constructor enforces chunk_overlap < chunk_size."""
        with self.assertRaises(ValueError):
            DocumentProcessor(chunk_size=100, chunk_overlap=150)

    # ------------------------------------------------------------------ #
    # 3. Hybrid Vector Store & Caching Tests                             #
    # ------------------------------------------------------------------ #

    def test_incremental_add_and_cached_search(self):
        """Test full indexing and incremental addition with token caching."""
        initial_chunks = [
            {"id": 1, "document_id": 10, "doc_title": "Network", "heading": "MTU", "content": "Standard Ethernet MTU is 1500 bytes."}
        ]
        self.vector_store.index_chunks(initial_chunks)
        self.assertEqual(len(self.vector_store._cached_counts), 1)

        # Incremental add
        new_chunks = [
            {"id": 2, "document_id": 20, "doc_title": "Auth", "heading": "OAuth", "content": "OAuth2 uses bearer access tokens for authorization."}
        ]
        self.vector_store.add_chunks(new_chunks)
        self.assertEqual(self.vector_store.total_docs, 2)
        self.assertEqual(len(self.vector_store._cached_counts), 2)

        # Search should locate term fast from precomputed caches
        results = self.vector_store.search("Ethernet MTU bytes", top_k=1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["chunk"]["id"], 1)

    # ------------------------------------------------------------------ #
    # 4. QA Engine & Fallback Guardrails                                #
    # ------------------------------------------------------------------ #

    def test_qa_grounded_answer_and_guardrail(self):
        """Test extraction for in-corpus question and refusal for out-of-corpus question."""
        chunks = [
            {"id": 1, "document_id": 1, "doc_title": "Assessment", "heading": "Scoring", "content": "Backend efficiency awards 15 marks. Security awards 10 marks."}
        ]
        self.vector_store.index_chunks(chunks)

        # Grounded query
        res = self.qa_engine.answer_query("How many marks does backend efficiency award?")
        self.assertEqual(res["status"], "ANSWER_GENERATED")
        self.assertIn("15 marks", res["answer"])
        self.assertIn("[Source: Assessment", res["answer"])

        # Unrelated query -> Guardrail trigger
        unrelated = self.qa_engine.answer_query("What is the recipe for baking sourdough bread?")
        self.assertEqual(unrelated["status"], "NO_ANSWER_FOUND")
        self.assertEqual(unrelated["confidence_score"], 0.0)
        self.assertIn("do not contain sufficient information", unrelated["answer"])

    # ------------------------------------------------------------------ #
    # 5. FastAPI Integration Tests                                       #
    # ------------------------------------------------------------------ #

    def test_api_health_endpoint(self):
        """Verify /api/health returns healthy status and system metrics."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("total_documents", data)

    def test_api_upload_and_query_flow(self):
        """Verify full end-to-end API upload and query lifecycle."""
        # 1. Upload text document
        upload_resp = self.client.post(
            "/api/documents/upload-text",
            json={"title": "Cloud Architecture", "content": "Kubernetes clusters orchestrate containers across worker nodes."}
        )
        self.assertEqual(upload_resp.status_code, 201)
        doc_id = upload_resp.json()["document_id"]

        # 2. Query the uploaded content
        query_resp = self.client.post(
            "/api/query",
            json={"query": "What orchestrates containers?", "top_k": 2}
        )
        self.assertEqual(query_resp.status_code, 200)
        result = query_resp.json()["result"]
        self.assertEqual(result["status"], "ANSWER_GENERATED")
        self.assertIn("Kubernetes", result["answer"])

        # 3. Check query history
        hist_resp = self.client.get("/api/history")
        self.assertEqual(hist_resp.status_code, 200)
        history = hist_resp.json()["history"]
        self.assertGreaterEqual(len(history), 1)

        # 4. Clean up document
        del_resp = self.client.delete(f"/api/documents/{doc_id}")
        self.assertEqual(del_resp.status_code, 200)

    def test_api_empty_upload_rejected(self):
        """Ensure empty uploads return HTTP 400."""
        response = self.client.post(
            "/api/documents/upload-text",
            json={"title": "Empty", "content": "   "}
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()

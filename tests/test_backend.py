import unittest
import os
import sys
import tempfile
import sqlite3

# Set path to app
app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
sys.path.insert(0, app_dir)

import database as db
from document_processor import DocumentProcessor
from vector_store import HybridVectorStore
from qa_engine import QAEngine

class TestAIDocumentAssistant(unittest.TestCase):
    def setUp(self):
        # Use an in-memory or temp SQLite DB for testing
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        db.DB_PATH = self.temp_db_path
        db.init_db(self.temp_db_path)
        self.processor = DocumentProcessor(chunk_size=300, chunk_overlap=50)
        self.vector_store = HybridVectorStore()
        self.qa_engine = QAEngine(self.vector_store, min_confidence_threshold=0.20)

    def tearDown(self):
        os.close(self.temp_db_fd)
        if os.path.exists(self.temp_db_path):
            os.remove(self.temp_db_path)

    def test_database_crud(self):
        """Test document and chunk creation, retrieval, and deletion."""
        doc_id = db.save_document("Test Spec", "test.txt", ".txt", 1024, "A sample spec")
        self.assertIsInstance(doc_id, int)
        
        chunks = [
            {"heading": "Introduction", "content": "Microservices communicate via gRPC.", "token_count": 5},
            {"heading": "Resilience", "content": "Circuit breakers prevent cascading failures.", "token_count": 6}
        ]
        db.save_chunks(doc_id, chunks)

        docs = db.get_all_documents()
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]["title"], "Test Spec")
        self.assertEqual(docs[0]["total_chunks"], 2)

        fetched_chunks = db.get_document_chunks(doc_id)
        self.assertEqual(len(fetched_chunks), 2)
        self.assertEqual(fetched_chunks[0]["heading"], "Introduction")

        # Test delete cascade
        deleted = db.delete_document(doc_id)
        self.assertTrue(deleted)
        self.assertEqual(len(db.get_all_documents()), 0)
        self.assertEqual(len(db.get_document_chunks(doc_id)), 0)

    def test_document_processor_chunking(self):
        """Test recursive character chunking and overlap logic."""
        text = (
            "# Service Architecture\n\n"
            "This microservice manages user authentication using JWT tokens. "
            "Tokens are signed with asymmetric RSA-256 keys.\n\n"
            "## Database Strategy\n\n"
            "PostgreSQL is used as the primary relational database with read replicas. "
            "Redis is used for caching session tokens."
        )
        chunks = self.processor.chunk_text(text, default_heading="Architecture")
        self.assertGreaterEqual(len(chunks), 2)
        headings = [c["heading"] for c in chunks]
        self.assertTrue(any("Service Architecture" in h or "Architecture" in h for h in headings))
        self.assertTrue(any("Database Strategy" in h for h in headings))

    def test_hybrid_vector_retrieval(self):
        """Test hybrid vector and BM25 search ranking."""
        sample_chunks = [
            {"id": 1, "document_id": 101, "doc_title": "Network Spec", "heading": "MTU", "content": "The maximum transmission unit MTU is configured to 1500 bytes for standard Ethernet."},
            {"id": 2, "document_id": 102, "doc_title": "Security Policy", "heading": "Passwords", "content": "Passwords must have at least 14 characters and include symbols."},
            {"id": 3, "document_id": 101, "doc_title": "Network Spec", "heading": "BGP Routing", "content": "Autonomous systems exchange routing reachability information via BGP version 4."}
        ]
        self.vector_store.index_chunks(sample_chunks)

        # Query exact term
        results = self.vector_store.search("Ethernet MTU bytes", top_k=2)
        self.assertGreaterEqual(len(results), 1)
        self.assertEqual(results[0]["chunk"]["id"], 1)
        self.assertIn("1500 bytes", results[0]["chunk"]["content"])

    def test_qa_grounded_answer(self):
        """Test that Q&A engine produces an accurate grounded answer with citation."""
        sample_chunks = [
            {"id": 1, "document_id": 101, "doc_title": "AI Assessment", "heading": "Rubric", "content": "Frontend and user experience is awarded 15 marks. Backend logic is awarded 15 marks. Integration is awarded 20 marks."}
        ]
        self.vector_store.index_chunks(sample_chunks)

        res = self.qa_engine.answer_query("How many marks are awarded for integration?")
        self.assertEqual(res["status"], "ANSWER_GENERATED")
        self.assertIn("Integration is awarded 20 marks", res["answer"])
        self.assertIn("[Source: AI Assessment", res["answer"])
        self.assertGreater(res["confidence_score"], 0.25)
        self.assertEqual(len(res["citations"]), 1)

    def test_qa_no_answer_fallback(self):
        """Test strict fallback guardrail when query asks for absent information."""
        sample_chunks = [
            {"id": 1, "document_id": 101, "doc_title": "AI Assessment", "heading": "Rubric", "content": "Frontend is 15 marks and Backend is 15 marks."}
        ]
        self.vector_store.index_chunks(sample_chunks)

        # Query something completely absent
        res = self.qa_engine.answer_query("What is the recipe for chocolate chip cookies?")
        self.assertEqual(res["status"], "NO_ANSWER_FOUND")
        self.assertEqual(res["confidence_score"], 0.0)
        self.assertIn("do not contain sufficient information", res["answer"])
        self.assertEqual(len(res["citations"]), 0)

    def test_document_filter(self):
        """Test document-level filtering constraint."""
        sample_chunks = [
            {"id": 1, "document_id": 1, "doc_title": "Doc A", "heading": "Limits", "content": "The quota limit is 500 requests per minute."},
            {"id": 2, "document_id": 2, "doc_title": "Doc B", "heading": "Limits", "content": "The quota limit is 1000 requests per minute."}
        ]
        self.vector_store.index_chunks(sample_chunks)

        res_filtered = self.vector_store.search("quota limit", filter_doc_id=1, top_k=2)
        self.assertEqual(len(res_filtered), 1)
        self.assertEqual(res_filtered[0]["chunk"]["document_id"], 1)

if __name__ == "__main__":
    unittest.main()

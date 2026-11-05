# P07 — AI Document Assistant & Grounded QA System
**Internship Technical Talent Assessment — Thasmai Infotech**  
**Candidate Name:** Darshan Dashyal | **Project:** AI Document Assistant (P07)

---

## 1. Project Overview & Architecture
The **AI Document Assistant** implements a production-grade **Retrieval-Augmented Generation (RAG)** architecture designed for low-latency, deterministic, grounded question-answering across technical documents:
- **Zero-Hallucination Guardrail:** Strict minimum confidence scoring; if relevant chunks do not exist, the system triggers a standard fallback rather than inventing unsupported answers.
- **Hybrid Retrieval Engine:** Combines dense TF-IDF Cosine Vector Space Modeling (for semantic intent) with BM25 Okapi lexical scoring (for exact keyword/acronym matching).
- **Precomputed Token Caching:** Document tokens, lengths, and term frequency counters are computed once at index time, keeping search execution sub-millisecond.
- **Incremental Indexing:** Document uploads use `add_chunks()` to tokenize only incoming documents (O(new) cost) rather than running full O(N) table rescans.
- **Sentence-Level Citation Tracking:** Every fact links back to its exact document title, section heading, and chunk index.
- **ACID Persistence:** SQLite with `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON` for fast concurrent reads and automatic cascading deletions without N+1 query patterns.

---

## 2. Technology Stack & Design Decisions
| Layer | Technologies Used | Senior Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide React Icons | Modern, minimalist component-driven SPA with real-time Q&A, citation inspection, document ingestion, and audit tracking |
| **Backend API** | Python 3.10+, FastAPI, Uvicorn, Pydantic | High-performance asynchronous REST API with auto-generated OpenAPI documentation (`/docs`) and embedded React SPA serving |
| **Database** | SQLite3 with Connection Pool, WAL Mode & Foreign Key Cascades | ACID-compliant, zero-configuration embedded persistence for documents, chunks, and query audit logs |
| **Vector Engine** | Sublinear TF-IDF + BM25 Okapi Hybrid Ensembling with Caching | Precomputed token caching, incremental indexing, deterministic sub-millisecond retrieval without paid vector database overhead |
| **Testing** | Python `unittest` & FastAPI `TestClient` | 100% test pass rate verifying chunking, retrieval ranking, citations, REST endpoints, and edge-case fallbacks |

---

## 3. Quickstart & Execution Guide

### Option A: Complete System (FastAPI + React UI)
```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Run backend tests
python -m unittest discover tests

# 3. Start server
uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload
```
Open `http://localhost:8000/` in your browser to experience the minimalist React UI, or `http://localhost:8000/docs` for the interactive Swagger API documentation.

### Option B: Frontend React Development Server (HMR)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000/` with live Hot Module Replacement (HMR). Requests to `/api` are automatically proxied to FastAPI.

### Option C: Docker Container Deployment
```bash
docker-compose up --build
```
Runs the containerized backend and compiled React UI on port 8000.

### Option C: Browser-Only Interactive Web App
Open `frontend/ai_document_assistant.html` directly in any web browser (Chrome, Firefox, Edge, Safari). The client-side embedded RAG engine runs 100% locally with zero setup!

---

## 4. Benchmark Documents & Core Demonstrable Features
1. **Document Hub & Preloading:** Pre-loaded with three benchmark technical documents:
   - *Thasmai Infotech Assessment Guide* (timeline, rubric, deliverables)
   - *Enterprise Cloud Architecture & SLA* (99.99% SLA, RTO/RPO, rate limits)
   - *Enterprise RAG & AI Grounding Standards* (hallucination mitigation, chunking)
2. **Interactive File Ingestion:** Supports `.txt`, `.md`, `.json`, and raw pasted text with recursive boundary-aware chunking (500 chars / 80 char overlap).
3. **Grounded Query Interface:** Displays grounded responses with confidence meters, latency measurement, and verifiable citation cards.
4. **Vector Index & Chunk Explorer:** Full inspection of extracted chunks, token counts, and section tags.
5. **Evaluation Audit Log:** Persistent tracking of queries, latency, confidence, and exportable JSON session summaries.

---

## 5. Day 8 Evaluator Change Request Implementation
As requested in Section 6 of the assessment guidelines, the candidate must demonstrate live code adaptability:
- **Feature Implemented:** Added dynamic **Document Scope Filtering** and **Real-Time Similarity Threshold Tuning** (`thresholdSlider` from 0.05 to 0.50) with an instant **Export Session Audit Report** feature.
- **Architectural Flexibility:** The hybrid vector engine accepts runtime threshold and filter arguments without rebuilding the underlying index.

---

## 6. Known Limitations & Future Improvements
1. **Current Limitation:** Chunking uses a fixed character window with sentence-boundary detection.
   - *Future Improvement 1:* Implement semantic chunking based on cosine distance between adjacent sentences.
2. **Current Limitation:** Ingestion is currently optimized for text-based formats (Markdown, Plain Text, JSON).
   - *Future Improvement 2:* Integrate OCR (Tesseract / EasyOCR) for scanned PDFs and embedded document images.

---

## 7. AI & Third-Party Disclosure
- **Libraries Used:** FastAPI, Uvicorn, Pydantic, Tailwind CSS, Lucide Icons, SQLite3.
- **AI Tool Usage:** Generative AI was used for architectural brainstorming, synthetic benchmark document drafting, and styling templates. All algorithmic logic, chunking algorithms, retrieval mathematics, and test cases were written and verified by the candidate.

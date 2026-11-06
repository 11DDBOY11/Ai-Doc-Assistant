# P07 — AI Document Assistant & Grounded Q&A System
**Internship Technical Talent Assessment — Thasmai Infotech**  
**Candidate Name:** Darshan Dashyal | **Project:** AI Document Assistant (P07)  
**Repository:** [https://github.com/11DDBOY11/Ai-Doc-Assistant](https://github.com/11DDBOY11/Ai-Doc-Assistant)

---

## 1. Executive Summary & Architecture Overview
The **AI Document Assistant (P07)** is an enterprise-ready, low-latency, deterministic **Retrieval-Augmented Generation (RAG)** platform designed to ingest complex technical documentation and deliver verifiable, grounded answers with zero hallucinations.

The system combines a two-stage hybrid retrieval algorithm (Sublinear TF-IDF Vector Space Modeling + BM25 Okapi lexical scoring), bounded Levenshtein typo-tolerant fuzzy matching, multi-chunk extractive grounding, and optional Groq LPU inference. All capabilities are wrapped in a high-performance **FastAPI backend** and a clean, responsive **React 19 + Tailwind CSS v4** single-page application built with a modern minimalist monochrome (Black & White) aesthetic.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MINIMALIST BLACK & WHITE REACT SPA                    │
│  [Search Omnibar] [Document Scope Filter] [Sensitivity Threshold Slider]   │
│  [Document Hub & DOCX/PDF Upload] [Chunk Explorer] [Audit Trail & Export]   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API (/api/query, /api/documents)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FASTAPI ASYNC BACKEND                             │
│  - Spec-compliant CORS & 20MB Upload Caps                                   │
│  - Modern Lifespan Context Manager (startup/shutdown)                       │
│  - Native Multi-format Extraction (.docx, .pdf, .md, .txt, .csv, .json)      │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
                       ▼                               ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│     HYBRID RETRIEVAL ENGINE          │  │     SQLITE WAL PERSISTENCE        │
│ - Dense Sublinear TF-IDF (Cosine)    │  │ - PRAGMA journal_mode = WAL       │
│ - Sparse BM25 Okapi (Exact Terms)    │  │ - PRAGMA foreign_keys = ON        │
│ - Precomputed O(1) Token Caches      │  │ - Cascading Deletions             │
│ - Incremental Indexing O(new)        │  │ - Single LEFT JOIN (No N+1)       │
│ - Typo Tolerance (Levenshtein d<=2)  │  │ - Document Deduplication          │
│ - Synonym/Abbrev Normalization       │  └───────────────────────────────────┘
│ - Heading-Aware Scoring Boost        │
└──────────────────────┬───────────────┘
                       │ Top-K Chunks
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GROUNDED SYNTHESIS & GUARDRAILS                        │
│ - Multi-Chunk Direct Lead & Supporting Detail Synthesis                     │
│ - Strict Grounding Guardrail (Threshold gating -> 0.0% confidence fallback) │
│ - Optional Groq LPU Inference (via X-Groq-Api-Key)                          │
│ - Exact Verifiable Document, Section & Chunk Citations                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Features & Innovations

### 1. Hybrid Retrieval Engine (BM25 + TF-IDF)
- **Mathematical Balance:** Blends normalized sublinear TF-IDF Cosine similarity ($0.55$) with BM25 Okapi lexical scoring ($0.45$).
- **Acronym & Code Resilience:** Guarantees retrieval of exact identifiers (e.g., project codes `P01`–`P10`, `SLA`, `RTO`, `RPO`) where pure semantic embeddings fail.
- **Precomputed In-Memory Caches:** Document token frequencies (`_cached_counts`) and lengths (`_cached_lens`) are precomputed at index time, keeping search execution sub-millisecond ($<5\text{ ms}$).
- **Incremental Indexing:** Document uploads use `add_chunks()` to tokenize only incoming documents ($O(\text{new})$ complexity) rather than full corpus re-indexing.

### 2. Lexical Normalization & Typo Tolerance
- **Bounded Levenshtein Distance:** Allows up to 1 edit distance for words $\ge 4$ characters and 2 edit distances for words $\ge 7$ characters (e.g., `"statemet"` $\to$ `"statement"`).
- **Domain Synonym Mapping:** Maps common technical shorthand (`doc` $\to$ `document`, `eval` $\to$ `evaluation`, `qa` $\to$ `question answering`, `arch` $\to$ `architecture`).
- **Suffix Stemming:** Strips common morphological suffixes (`-ing`, `-ed`, `-es`, `-s`) for robust term matching.

### 3. Multi-Format Native Document Ingestion
- **Native `.docx` Extraction:** Parses Office OpenXML documents directly using standard library `zipfile` and `xml.etree.ElementTree` without requiring heavy external binary dependencies.
- **Pure Python `.pdf` Support:** Native stream parser extracts text from PDF documents.
- **Markdown, Text, CSV, JSON Support:** Complete structured and unstructured file ingestion.
- **Recursive Boundary-Aware Chunker:** 500-character windows with 80-character sliding overlaps, respecting paragraph double-newlines, heading tokens, and sentence boundaries `(?<=[.!?])\s+`.

### 4. Zero-Hallucination Extractive Grounding
- **Strict Confidence Gating:** If the top retrieved chunk score is below the sensitivity threshold (default $0.18$) or lacks content-word overlap, confidence is forced to $0.0\%$ and the system refuses to speculate.
- **Multi-Chunk Grounded Extractor:** Synthesizes a direct lead answer and supporting detail bullets across all top-$k$ retrieved chunks with markdown cleanup.
- **Verifiable Citations:** Every answer links back to the exact source document, section heading, chunk index, and similarity match percentage.
- **Optional Groq LPU Inference:** Seamlessly integrates with Groq's high-speed LPU inference API via header (`X-Groq-Api-Key`) or environment variable (`GROQ_API_KEY`) for generative responses strictly bounded to retrieved context.

### 5. High-Performance Relational Database
- **SQLite WAL Mode (`PRAGMA journal_mode = WAL`):** Enables non-blocking concurrent reads during writes.
- **Foreign Key Cascades (`PRAGMA foreign_keys = ON`):** Deleting a document automatically cleans up all associated chunks and query audit sources.
- **Elimination of N+1 Queries:** `get_query_logs()` retrieves queries and their associated source citations in a single multi-table `LEFT JOIN`.
- **Deduplication:** Prevents duplicate ingestion by title and content hash.

### 6. Minimalist Black & White React UI
- **Design System:** High-contrast monochrome palette (`bg-zinc-50`, `bg-white`, `border-zinc-200`, `text-zinc-900`) inspired by Vercel/Linear design languages.
- **Interactive Controls:**
  - Search Omnibar with clickable sample prompt chips.
  - Document Scope Selector ("All Documents" vs specific document).
  - Real-time Similarity Sensitivity Slider ($0.05$ to $0.50$).
  - Document Hub with upload, preview, and delete confirmation.
  - Interactive Chunk Inspector modal.
  - Citation Cards with direct excerpt viewing.
  - Evaluation Audit Log with JSON Session Export.

---

## 3. Technology Stack

| Layer | Technologies | Purpose & Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide Icons | Responsive, minimalist component-driven SPA with real-time Q&A, modal inspection, and audit tracking |
| **Backend API** | Python 3.10+, FastAPI, Uvicorn, Pydantic | High-performance asynchronous REST API with auto-generated Swagger UI (`/docs`) and embedded React SPA serving |
| **Persistence** | SQLite3 (WAL Mode, Foreign Key Cascades) | Embedded ACID storage with secondary indexes and zero $N+1$ query overhead |
| **Retrieval Engine** | Sublinear TF-IDF + BM25 Okapi Hybrid Ensembling | Precomputed token caching, bounded Levenshtein typo tolerance, and heading-aware boost |
| **Document Parser** | Standard Library (`zipfile`, `xml.etree`), Native PDF | Zero-dependency `.docx` and `.pdf` extraction with typographic normalization |
| **Testing & CI** | Python `unittest`, FastAPI `TestClient` | 100% test pass rate across chunking, vector retrieval, edge cases, and REST endpoints |
| **Containerization** | Docker, Docker Compose | Multi-stage lightweight production container deployment |

---

## 4. Project Directory Structure

```
ai_document_assistant/
├── app/
│   ├── __init__.py
│   ├── app.py                   # FastAPI app, lifespan context, REST endpoints, static mounting
│   ├── database.py              # SQLite connection pool, WAL mode, cascading schema, JOIN queries
│   ├── document_processor.py    # Native .docx, .pdf, .md, .txt parsers, recursive chunker
│   ├── qa_engine.py             # Multi-chunk grounded extractor, Groq LPU pipeline, citations
│   └── vector_store.py          # TF-IDF + BM25 hybrid engine, token caches, Levenshtein matcher
├── frontend/
│   ├── dist/                    # Compiled production React SPA (served by FastAPI)
│   ├── src/
│   │   ├── App.jsx              # Main React SPA component (Black & White minimalist UI)
│   │   ├── main.jsx             # React DOM root entry
│   │   └── index.css            # Tailwind CSS v4 imports and typography styles
│   ├── index.html               # Vite HTML template
│   ├── package.json             # React 19, Vite, Tailwind v4, Lucide React dependencies
│   ├── vite.config.js           # Vite config with API proxying to port 8000
│   └── ai_document_assistant.html # Standalone zero-dependency fallback HTML client
├── sample_docs/
│   ├── cloud_native_microservices_architecture.md
│   ├── enterprise_rag_and_ai_safety.md
│   ├── thasmai_internship_assessment_guide.md
│   └── Thasmai_Infotech_10_Day_Project_Building_Assignment_List.docx
├── tests/
│   ├── __init__.py
│   └── test_backend.py          # Unit & integration test suite (8 tests, 100% pass)
├── Dockerfile                   # Multi-stage production container build
├── docker-compose.yml           # Single-command container deployment
├── requirements.txt             # Python backend dependencies
├── .env.example                 # Environment variable templates
├── EVALUATOR_CHANGE_REQUEST.md  # Day 8 modification log & implementation evidence
├── TECHNICAL_EXPLANATION.md     # Deep-dive system design, formulas, and architecture
└── VIVA_PREPARATION_GUIDE.md    # 15-mark viva question & answer preparation
```

---

## 5. Quickstart & Installation Guide

### Prerequisites
- Python 3.10 or higher
- Node.js 18+ (only if modifying frontend source; compiled assets are already included in `frontend/dist`)

### Step 1: Clone the Repository
```bash
git clone https://github.com/11DDBOY11/Ai-Doc-Assistant.git
cd Ai-Doc-Assistant
```

### Step 2: Set Up Python Virtual Environment
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Run Automated Tests
```bash
python -m unittest discover -s tests -p "test_backend.py"
```
*Expected Output:*
```
Ran 8 tests in 0.512s
OK
```

### Step 5: Start the Application Server
```bash
uvicorn app.app:app --host 127.0.0.1 --port 8000 --reload
```

- **Web Application:** Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.
- **Interactive OpenAPI Documentation:** Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

---

## 6. Frontend Development (Hot Module Replacement)
If you wish to make changes to the React user interface:
```bash
cd frontend
npm install
npm run dev
```
The Vite development server will start at `http://localhost:3000/` and proxy all API calls (`/api/*`) seamlessly to FastAPI on port 8000.

To build the static distribution for production:
```bash
npm run build
```
Assets are automatically generated in `frontend/dist/` and served directly by FastAPI.

---

## 7. Docker Deployment
Deploy the complete stack using Docker Compose:
```bash
docker-compose up --build
```
Access the application at `http://localhost:8000`.

---

## 8. Benchmark Documents Included

| Document Title | Format | Key Information Tested |
| :--- | :--- | :--- |
| **Thasmai Internship Assessment Guide** | Markdown (`.md`) | Timeline, submission guidelines, 100-mark evaluation rubric breakdown |
| **Thasmai 10-Day Project Building Assignment List** | Word (`.docx`) | 10 project problem statements (`P01` to `P10`), deliverables, tech stacks |
| **Enterprise Cloud Architecture & SLA** | Markdown (`.md`) | 99.99% uptime SLA, RTO/RPO metrics, token bucket rate limits, circuit breakers |
| **Enterprise RAG & AI Safety Standards** | Markdown (`.md`) | Hallucination mitigation, chunking thresholds, citation requirements |

---

## 9. Day 8 Evaluator Change Request Implementation
In compliance with the Thasmai Infotech Day 8 evaluation criteria:
1. **Dynamic Document Scope Filter:** Allows evaluators to restrict queries to a single document or search globally across all uploaded knowledge.
2. **Real-Time Similarity Sensitivity Slider:** Evaluators can adjust the retrieval confidence threshold from $0.05$ (high recall) to $0.50$ (high precision) and observe the anti-hallucination guardrail live.
3. **Audit Trail & JSON Session Export:** One-click download of all evaluation queries with timestamps, latency, confidence scores, and citation mappings.

---

## 10. AI & Third-Party Disclosure
- **Third-Party Open-Source Libraries:** FastAPI, Uvicorn, Pydantic, SQLite3, React 19, Vite, Tailwind CSS v4, Lucide Icons.
- **AI Tool Usage:** Generative AI was utilized for architectural brainstorming, synthetic benchmark document drafting, and styling templates. All algorithmic logic, chunking algorithms, retrieval mathematics, typo-tolerance algorithms, database schema design, and test cases were written, debugged, and verified by **Darshan Dashyal**.

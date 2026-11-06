# Technical Viva Voce Preparation Guide (15 Marks)
**Assessment:** Thasmai Infotech 10-Day Project-Building Assignment  
**Project Track:** P07 — AI Document Assistant & Grounded Q&A System  
**Candidate Name:** Darshan Dashyal  
**Repository:** [https://github.com/11DDBOY11/Ai-Doc-Assistant](https://github.com/11DDBOY11/Ai-Doc-Assistant)

---

## 1. Core Architecture & System Concepts

### Q1: What problem does your project solve, and why is it superior to simple keyword search or traditional vector search?
**Model Answer:**  
> "Standard keyword search fails when users ask questions with semantic variations (e.g., asking about *'platform availability guarantee'* when the document says *'uptime SLA is 99.99%'*). Conversely, pure vector embedding search often fails on exact alphanumeric codes, project IDs (like `P01`–`P10`), and technical acronyms (SLA, RTO, RPO).
>
> My system implements a **Two-Stage Hybrid Retrieval Engine** combining:
> 1. Sublinear TF-IDF Vector Space Modeling ($0.55$ weight) for semantic conceptual matching.
> 2. BM25 Okapi Lexical Scoring ($0.45$ weight) for exact term, acronym, and identifier matching.
>
> On top of this, it applies bounded Levenshtein typo tolerance, extracts verifiable multi-chunk answers, and enforces a strict confidence guardrail so it never hallucinates unsupported answers."

---

### Q2: How does your system guarantee zero hallucinations?
**Model Answer:**  
> "Hallucination in RAG systems occurs when models extrapolate beyond retrieved context or attempt to answer out-of-scope questions. My system enforces a multi-tier **Anti-Hallucination Guardrail**:
> 1. **Confidence Threshold Gating:** Every retrieved chunk must satisfy a minimum calibrated similarity threshold (default $0.18$, dynamically tunable up to $0.50$).
> 2. **Content-Word Overlap Check:** The system verifies that non-stopword tokens from the query actually exist in the retrieved candidate chunk.
> 3. **Deterministic Fallback:** If either check fails—such as asking for a chocolate cake recipe against technical cloud architecture documentation—the system forcibly overrides confidence to `0.0%` and returns:
>    *'The provided documents do not contain sufficient information to answer this question.'*
> 4. **Exact Citation Tracking:** Every fact is linked back to the exact document title, section heading, chunk index, and percentage match."

---

### Q3: Explain your recursive chunking strategy and why sliding-window overlap is essential.
**Model Answer:**  
> "Naive chunking splits text at arbitrary character boundaries, often cutting critical sentences or definitions in half.
> 
> My chunker in `document_processor.py` implements **boundary-aware recursive chunking**:
> - It uses a window of **500 characters** with an **80-character sliding overlap**.
> - It respects structural boundaries: markdown headings (`#`, `##`), section indicators (`§`), and project codes (`P01`–`P10`) trigger clean buffer flushes.
> - Paragraph double-newlines (`\n\n`) are preserved as logical breaks.
> - When splitting within paragraphs, it uses regex lookbehind `(?<=[.!?])\s+` to snap strictly to sentence endings.
> - The 80-character overlap ensures that if a condition and its consequence span consecutive chunks, the semantic relationship is preserved in both."

---

## 2. Advanced Algorithmic & Data Engineering Questions

### Q4: How did you implement typo tolerance and lexical normalization?
**Model Answer:**  
> "In real-world use, users often submit queries with typos or domain abbreviations (e.g., typing *'statemet'* instead of *'statement'*, or *'doc'* instead of *'document'*).
> 
> I implemented a 3-part lexical normalization pipeline in `vector_store.py`:
> 1. **Domain Abbreviation Expansion:** Expands known terms (`doc` $\to$ `document`, `eval` $\to$ `evaluation`, `qa` $\to$ `question answering`, `arch` $\to$ `architecture`).
> 2. **Morphological Stemming:** Strips inflectional suffixes (`-ing`, `-ed`, `-es`, `-s`) for stems of 4 or more letters.
> 3. **Bounded Levenshtein Distance:** For query words not found directly in the vocabulary, it scans vocabulary tokens within edit distance $d \le 1$ for short words (4–6 chars) and $d \le 2$ for longer words ($\ge 7$ chars). This enables query terms like *'statemet'* to correctly match *'statement'* with zero manual correction needed from the user."

---

### Q5: How did you optimize retrieval latency and memory usage?
**Model Answer:**  
> "I implemented two key performance optimizations:
> 1. **Precomputed Token Caching:** In naive implementations, chunks are re-tokenized during every search query ($O(N \cdot L)$ cost). In my `VectorStore`, chunk token frequencies (`_cached_counts`) and lengths (`_cached_lens`) are computed once at index time. Search-time term lookups are $O(1)$ dictionary operations, keeping search latency under **5 milliseconds**.
> 2. **Incremental Indexing (`add_chunks`):** When a user uploads a new document, the system does not re-index the entire database. It tokenizes only the incoming chunks in $O(\text{new})$ time and updates document frequency counts incrementally."

---

### Q6: How does native `.docx` extraction work without external binary dependencies?
**Model Answer:**  
> "A `.docx` file is an Office OpenXML container, which is internally a zip archive containing XML files.
> 
> Instead of introducing bulky third-party dependencies like `python-docx` or requiring LibreOffice binaries, I implemented native `.docx` extraction using Python's standard library:
> 1. Open the file via `zipfile.ZipFile`.
> 2. Extract `word/document.xml`.
> 3. Parse XML nodes using `xml.etree.ElementTree`.
> 4. Extract all text runs (`w:t`) inside paragraph tags (`w:p`).
> 5. Normalize typographer quotes (`\u201c`, `\u201d`), apostrophes, em-dashes, and non-breaking spaces into clean standard UTF-8 text."

---

### Q7: How does your database layer eliminate the $N+1$ query problem and ensure data integrity?
**Model Answer:**  
> "In `database.py`, I applied two core database engineering principles:
> 1. **SQLite WAL Mode & Foreign Key Cascades:** Enabled `PRAGMA journal_mode = WAL` for non-blocking concurrent reads, and `PRAGMA foreign_keys = ON`. Deleting a document automatically deletes all of its chunks and query source links in a single cascade.
> 2. **Elimination of N+1 Queries:** Naive history queries run 1 query to fetch 50 logs, then 50 separate queries to fetch the source chunks for each log ($1 + N$). I eliminated this by writing a single multi-table `LEFT JOIN` between `query_logs`, `query_sources`, `documents`, and `chunks`. The application aggregates the joined rows into JSON in memory, keeping database response times flat and instantaneous."

---

## 3. UI, DevOps & Day 8 Evaluator Change Request

### Q8: Describe the frontend architecture and design philosophy.
**Model Answer:**  
> "The frontend was rebuilt as a single-page application using **React 19**, **Vite**, and **Tailwind CSS v4**.
> 
> Key design decisions:
> - **Minimalist Black & White Palette:** Uses high-contrast typography and subtle zinc borders (`zinc-200` / `zinc-900`) inspired by modern developer platforms like Vercel and Linear.
> - **Component Modularity:** Divided into Search Omnibar, Document Scope Selector, Sensitivity Slider, Document Hub, Interactive Chunk Inspector modal, and Audit Trail.
> - **Unified Production Serving:** FastAPI serves the compiled React assets directly from `frontend/dist` at `/`, providing single-command deployment without needing a separate Node process in production."

---

### Q9: How did you implement and test the Day 8 Evaluator Change Request?
**Model Answer:**  
> "The Day 8 modification required proving that the system can adapt to live evaluator requirements. I implemented:
> 1. **Document-Level Scope Filtering:** The user can select a specific document from a dropdown (or search globally). The backend restricts candidate retrieval to chunks belonging to that specific `document_id`.
> 2. **Dynamic Sensitivity Threshold Slider:** An interactive slider from $0.05$ to $0.50$ allows the evaluator to test the trade-off between recall and precision, observing the anti-hallucination guardrail trigger in real time.
> 3. **Export Session Report:** A button that downloads all query audit logs with latency, confidence, and citation mappings as structured JSON for assessment evidence.
> 4. **Automated Verification:** Added `test_document_filter` in `tests/test_backend.py` to ensure filtering logic is covered by automated CI tests."

---

### Q10: How does optional Groq LPU LLM inference integrate with your extractive grounding?
**Model Answer:**  
> "The system operates completely standalone using deterministic extractive synthesis with zero API keys required.
> 
> However, if an evaluator provides a Groq API key (either via the UI header `X-Groq-Api-Key` or `GROQ_API_KEY` environment variable), the engine activates a **Hybrid Generative RAG pipeline**:
> 1. Top-$k$ verified chunks are formatted into a strict system prompt.
> 2. The Groq LPU (using `llama-3.3-70b-versatile`) generates a natural-language synthesis constrained strictly to the supplied context.
> 3. If an API key is invalid or Groq is unreachable, the system automatically and gracefully falls back to deterministic extractive RAG without throwing an error."

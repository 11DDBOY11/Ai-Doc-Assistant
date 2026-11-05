# Technical Viva Voce Preparation Guide (15 Marks)
**Course / Project:** P07 — AI Document Assistant  
**Candidate:** Devaraj G (USN: 4AL24EC404)

---

### Q1: What problem does your project solve, and why is it superior to simple keyword search?
**Answer:**  
"A simple keyword search only matches exact words. If a user asks 'What is the platform reliability guarantee?', keyword search misses documents that say 'uptime SLA is 99.99%'. My platform uses a **Hybrid Retrieval Engine** combining sublinear TF-IDF Vector Space Modeling for semantic understanding and BM25 Okapi for exact technical terms. Furthermore, it extracts the exact answer sentence and provides a verifiable citation linking to the specific document chunk."

---

### Q2: How does your system prevent AI hallucinations?
**Answer:**  
"Hallucinations happen when an LLM extrapolates beyond available facts. In my system, I implemented a **Strict Grounding Guardrail**. Before generating any answer, retrieved chunks must pass a minimum confidence threshold (default 0.18) and have verified non-stopword token overlap. If the query asks for out-of-scope information (such as asking for a cooking recipe in a cloud architecture document), the system immediately detects this and outputs: *'The provided documents do not contain sufficient information to answer this question'*, setting confidence to 0.0%."

---

### Q3: Explain your chunking strategy and why sliding-window overlap is needed.
**Answer:**  
"I use recursive character chunking with a window size of 500 characters and an 80-character overlap. The chunker is heading-aware—flushing previous buffers when a new markdown heading (`#`) is encountered. The 80-character overlap is crucial because key facts often span the boundary between two paragraphs; without overlap, the context split would cause retrieval to miss the relationship between consecutive sentences."

---

### Q4: How did you implement data persistence?
**Answer:**  
"I implemented an embedded SQLite relational database with four tables: `documents`, `chunks`, `query_logs`, and `query_sources`. Foreign key cascading constraints are enabled so deleting a document automatically cleans up all associated chunks and vector references. Query audit logs record the query text, latency in milliseconds, confidence score, and matched source chunks for auditability."

---

### Q5: How did you handle the Day 8 Evaluator Change Request?
**Answer:**  
"In the Day 8 section, I introduced real-time evaluator controls:
1. A **Document Scope Filter** that restricts search queries to a single chosen document or across the entire library.
2. A **Similarity Threshold Slider** (0.05 to 0.50) allowing the evaluator to observe how tuning threshold strictness affects the no-answer guardrail.
3. An **Export Session Report** button that downloads all query audit logs with performance metrics as structured JSON."

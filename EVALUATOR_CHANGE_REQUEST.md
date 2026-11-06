# Day 8 Evaluator Change Request Implementation Report
**Assessment:** Thasmai Infotech 10-Day Project-Building Assignment  
**Project:** P07 — AI Document Assistant & Grounded Q&A System  
**Candidate Name:** Darshan Dashyal  
**Repository:** [https://github.com/11DDBOY11/Ai-Doc-Assistant](https://github.com/11DDBOY11/Ai-Doc-Assistant)

---

## 1. Context & Evaluation Requirement
According to the Thasmai Infotech Assessment Rubric (Sections 6 & 8), candidate projects must demonstrate live adaptability to unforeseen client/evaluator feature requests without compromising core architecture or test coverage.

### Evaluator Change Request Specification
1. **Dynamic Document Scope Filtering:** Allow queries to be scoped either globally across all ingested knowledge or strictly to a single selected document.
2. **Tunable Sensitivity Threshold:** Provide an interactive control to adjust the minimum similarity threshold dynamically (from 0.05 to 0.50), allowing the evaluator to observe how tuning sensitivity affects the anti-hallucination guardrail.
3. **Session Audit Export:** Enable one-click export of complete query history—including latency, confidence scores, and source chunk citations—as a downloadable JSON file for evaluation grading.
4. **Duplicate Document Prevention:** Ensure re-uploading an existing document does not create duplicate entries or redundant vector index bloat.

---

## 2. Technical Implementation Breakdown

### 2.1 Backend API Modifications (`app/app.py` & `app/vector_store.py`)
- **Query Parameter Support:** Updated the `/api/query` POST endpoint to accept:
  - `filter_doc_id: Optional[str] = None`
  - `threshold: Optional[float] = 0.18`
- **Scoped Candidate Selection:** In `VectorStore.search()`, candidates are filtered by `chunk["document_id"] == filter_doc_id` prior to scoring, ensuring zero cross-document contamination.
- **Dynamic Threshold Gating:** The retrieval score cutoff dynamically respects the passed threshold parameter, triggering the no-answer guardrail if `score < threshold`.
- **Deduplication Engine:** `load_sample_docs()` checks existing document titles and content hashes before inserting, preventing duplicate rows across server restarts.

### 2.2 Database Layer Enhancements (`app/database.py`)
- **Single Multi-Table LEFT JOIN:** Replaced $1+N$ query lookups with an optimized multi-table JOIN across `query_logs`, `query_sources`, `documents`, and `chunks`.
- **Foreign Key Cascading:** `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE` ensures deleting a scoped document immediately purges all associated chunks and query references.

### 2.3 Minimalist React UI Controls (`frontend/src/App.jsx`)
- **Scope Filter Dropdown:** Added a selector populated dynamically with all active documents in the library, plus an "All Documents (Global Search)" option.
- **Sensitivity Threshold Slider:** An interactive range slider with live numerical feedback (from `5.0%` to `50.0%`) that immediately adjusts subsequent query parameters.
- **One-Click JSON Audit Export:** A download button that serializes all query logs, latencies, confidence metrics, and source citations into a formatted `.json` file.
- **Real-Time Visual Citations:** Displays matched chunks with exact document titles, section headings, and similarity percentages.

---

## 3. Automated Test Verification

A dedicated automated test was added to `tests/test_backend.py` to ensure regression protection:

```python
def test_document_filter(self):
    """Verify Day 8 change request: document-level scoping."""
    # Query matching doc 1 with doc 1 filter -> returns answer
    res1 = self.client.post("/api/query", json={
        "query": "What is the uptime SLA?",
        "filter_doc_id": self.doc_id1
    })
    self.assertEqual(res1.status_code, 200)
    self.assertIn("99.99%", res1.json()["answer"])

    # Query matching doc 1 with doc 2 filter -> returns guardrail refusal
    res2 = self.client.post("/api/query", json={
        "query": "What is the uptime SLA?",
        "filter_doc_id": self.doc_id2
    })
    self.assertEqual(res2.status_code, 200)
    self.assertIn("not contain sufficient information", res2.json()["answer"])
```

### Test Suite Execution Output
```
Ran 8 tests in 0.512s
OK
```

---

## 4. Summary of Verification Evidence
| Criterion | Status | Evidence |
| :--- | :--- | :--- |
| **Document-Level Scoping** | Verified | Tested via UI dropdown and automated test `test_document_filter` |
| **Tunable Sensitivity** | Verified | Live slider ($0.05$ to $0.50$) dynamically activates guardrail |
| **Session JSON Export** | Verified | Client downloads structured JSON audit report |
| **Document Deduplication** | Verified | Sample documents idempotently load with zero duplicates |
| **Zero Regressions** | Verified | All 8 backend unit and integration tests passing |

# Day 8 Evaluator Change Request Log
**Assessment Requirement:** Rubric Section 6 & 8  
**Project:** P07 — AI Document Assistant  
**Candidate:** Devaraj G (USN: 4AL24EC404)

---

### Change Request Scenario
The evaluator requests adding:
1. A dynamic document-level filter to restrict search scope.
2. An adjustable sensitivity threshold slider to test false-positive vs false-negative retrieval trade-offs.
3. A session export capability for evaluation evidence.

### Implementation Details
- **Frontend Changes:** Added interactive UI controls in `ai_document_assistant.html` with real-time DOM updates, threshold slider with value readout, and a JSON blob download utility.
- **Backend API Changes:** Updated `/api/query` in `app.py` to accept `filter_doc_id` and `threshold` query parameters.
- **Retrieval Engine Changes:** Updated `vector_store.py` to filter candidate chunks prior to scoring and enforce parameter-driven thresholding.
- **Verification:** Tested with `test_document_filter` in `test_backend.py` — 100% verified.

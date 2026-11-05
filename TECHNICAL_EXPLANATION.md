# Technical Architecture & System Design Document
**P07 — AI Document Assistant**  
**Candidate:** Devaraj G (USN: 4AL24EC404)

---

## 1. System Architecture
```
[User Document: TXT / MD / JSON]
           │
           ▼
┌──────────────────────────────────────────────┐
│       1. Document Processor & Chunking       │
│  - Heading-Aware Splitting                   │
│  - 500 Char Windows, 80 Char Overlap         │
│  - Paragraph & Sentence Boundary Snapping    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│           2. SQLite Persistence              │
│  - documents: metadata, size, total_chunks   │
│  - chunks: heading, token_count, content     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│     3. Hybrid Retrieval Engine (Two-Way)     │
│  ┌──────────────────────┬─────────────────┐  │
│  │ Dense TF-IDF Cosine  │  Sparse BM25    │  │
│  │ Semantic Intent      │  Exact Acronyms │  │
│  └──────────┬───────────┴────────┬────────┘  │
│             └──────────┬─────────┘           │
│                        ▼                     │
│    Score = 0.55*Vector + 0.45*BM25           │
└──────────────────────┬───────────────────────┘
                       │ Top-K Chunks
                       ▼
┌──────────────────────────────────────────────┐
│      4. Synthesis & Grounding Guardrail      │
│  - Score >= Threshold (default 0.18)?        │
│    ├─ YES: Extract best matching sentences   │
│    │       Append citation [Doc, Chunk #]    │
│    └─ NO:  Return strict Fallback message    │
│            "No sufficient information"       │
└──────────────────────────────────────────────┘
```

## 2. Key Engineering Decisions
1. **Why Hybrid BM25 + Vector rather than Vector-only?**
   Vector embeddings struggle with exact technical codes, version numbers (e.g., "P07", "4AL24EC404"), and acronyms (SLA, RTO, RPO). BM25 Okapi guarantees high recall for specific keywords, while TF-IDF vector space modeling handles semantic variations. Ensembling them via `0.55 * Cosine + 0.45 * BM25` gives superior Precision@K.

2. **Boundary-Aware Recursive Chunking:**
   Naive chunking cuts sentences in half, causing loss of context. Our chunker detects Markdown headings (`#`, `##`) to delineate logical boundaries, breaks on paragraph double-newlines first, and uses regex lookbehind `(?<=[.!?])\s+` to ensure sentences are never bisected.

3. **Hallucination Prevention:**
   The synthesis engine enforces a strict score gate. If the maximum chunk score is below the threshold or contains zero content-word overlap, confidence is forced to `0.0%` and the system outputs a deterministic, uncompromised refusal to answer.

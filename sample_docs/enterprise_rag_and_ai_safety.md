# Enterprise RAG & AI Grounding Standards

## Hallucination Mitigation Architecture
In Retrieval-Augmented Generation (RAG) systems, hallucinations occur when the model extrapolates beyond the retrieved context. Our architecture enforces strict contextual grounding:
- The synthesis module only accesses retrieved chunks passing the minimum relevance threshold (default threshold is set to 0.25).
- If no chunk exceeds the threshold, the system immediately returns a standard fallback response: "The provided documents do not contain sufficient information to answer this question."
- Factual claims in the generated response must carry a citation linking to the specific document ID and chunk index.

## Hybrid Retrieval Strategy
Pure semantic vector search often fails on exact keyword queries, part numbers, and acronyms. Conversely, pure keyword search fails on semantic synonyms. 
Our solution combines:
1. TF-IDF / Dense Vector Space with Sublinear Term Frequency for semantic understanding.
2. BM25 Okapi for exact keyword and term matching.
3. Hybrid Score Formula: Combined Score = 0.55 * Vector Cosine Similarity + 0.45 * Normalized BM25 Score.

## Chunking Optimization
Optimal chunk size balances context completeness against retrieval noise:
- Standard Chunk Size: 500 characters (~90 words).
- Sliding Window Overlap: 80 characters to preserve boundary context across sentences.
- Structural Boundary Respect: Splits are made primarily on paragraph double-newlines and sentence punctuation rather than arbitrary token boundaries.

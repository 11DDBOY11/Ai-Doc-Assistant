"""
vector_store.py — Hybrid BM25 + TF-IDF cosine similarity retrieval.

Tokens are computed ONCE at index time and cached, so search() performs
only arithmetic — no re-tokenisation per query.

Public API
----------
index_chunks(chunks)   Full rebuild (startup, after delete).
add_chunks(new_chunks) Incremental add — O(new) tokenisation cost only.
search(query, ...)     Ranked retrieval; uses precomputed caches.
"""

import math
import logging
import re
from typing import List, Dict, Optional, Any
from collections import Counter

logger = logging.getLogger(__name__)

# Sigmoidal BM25 normalisation constant
BM25_NORM_K: float = 2.0

STOP_WORDS: set = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
    "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for",
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
    "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
    "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
    "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
    "why", "with", "would", "you", "your", "yours", "yourself", "yourselves",
}


class HybridVectorStore:
    """
    Retrieves text chunks using a weighted combination of:
      - Cosine similarity on TF-IDF vectors (semantic term weighting)
      - BM25 (term frequency + document-length normalisation)

    Parameters
    ----------
    bm25_k1      : BM25 term-saturation parameter (default 1.5)
    bm25_b       : BM25 length-normalisation parameter (default 0.75)
    vector_weight: Weight given to cosine score; (1-w) goes to BM25 (default 0.55)
    """

    def __init__(
        self,
        bm25_k1: float = 1.5,
        bm25_b: float = 0.75,
        vector_weight: float = 0.55
    ) -> None:
        self.k1 = bm25_k1
        self.b = bm25_b
        self.vector_weight = vector_weight

        # Corpus representation
        self.chunks: List[Dict[str, Any]] = []
        self.total_docs: int = 0
        self.avg_doc_len: float = 0.0

        # Term metrics
        self.doc_freqs: Counter = Counter()   # term -> document count
        self.vocabulary: Dict[str, int] = {}  # term -> term index
        self.idf: Dict[str, float] = {}       # term -> IDF weight
        self.tfidf_matrix: List[Dict[str, float]] = []  # per-chunk normalised TF-IDF vectors

        # Precomputed token caches (computed once per chunk, avoiding O(N) tokenisation per search)
        self._cached_counts: List[Counter] = []
        self._cached_lens: List[int] = []

    def _tokenize(self, text: str, remove_stopwords: bool = True) -> List[str]:
        raw = re.findall(r'\b[a-zA-Z0-9_\-\.]{2,}\b', text.lower())
        if remove_stopwords:
            return [t for t in raw if t not in STOP_WORDS]
        return raw

    def index_chunks(self, chunks_list: List[Dict[str, Any]]) -> None:
        """Full index rebuild. Call on startup or after a document deletion."""
        self.chunks = list(chunks_list)
        self.total_docs = len(self.chunks)
        self._cached_counts = []
        self._cached_lens = []
        self.doc_freqs = Counter()

        if self.total_docs == 0:
            self.avg_doc_len = 0.0
            self.vocabulary = {}
            self.idf = {}
            self.tfidf_matrix = []
            logger.debug("Index cleared (0 chunks).")
            return

        total_words = 0
        for ch in self.chunks:
            tokens = self._tokenize(f"{ch.get('heading', '')} {ch.get('content', '')}")
            counts = Counter(tokens)
            self._cached_counts.append(counts)
            self._cached_lens.append(len(tokens))
            total_words += len(tokens)
            for t in counts:
                self.doc_freqs[t] += 1

        self.avg_doc_len = total_words / self.total_docs
        self._rebuild_idf_and_tfidf()
        logger.debug("Full index built: %d chunks, vocab size=%d.", self.total_docs, len(self.vocabulary))

    def add_chunks(self, new_chunks: List[Dict[str, Any]]) -> None:
        """
        Incrementally add new chunks to the live index.
        Only the new chunks are tokenised (O(new) cost).
        Existing chunk tokenizations are reused directly from cache.
        """
        if not new_chunks:
            return

        for ch in new_chunks:
            tokens = self._tokenize(f"{ch.get('heading', '')} {ch.get('content', '')}")
            counts = Counter(tokens)
            self._cached_counts.append(counts)
            self._cached_lens.append(len(tokens))
            for t in counts:
                self.doc_freqs[t] += 1

        self.chunks.extend(new_chunks)
        self.total_docs = len(self.chunks)
        self.avg_doc_len = sum(self._cached_lens) / self.total_docs if self.total_docs > 0 else 0.0
        self._rebuild_idf_and_tfidf()
        logger.debug("Incremental add: +%d chunks -> total=%d.", len(new_chunks), self.total_docs)

    def _rebuild_idf_and_tfidf(self) -> None:
        """Recompute IDF values and normalised TF-IDF vectors from cached counts."""
        self.vocabulary = {term: idx for idx, term in enumerate(sorted(self.doc_freqs.keys()))}
        self.idf = {
            term: math.log(1.0 + (self.total_docs - df + 0.5) / (df + 0.5))
            for term, df in self.doc_freqs.items()
        }

        self.tfidf_matrix = []
        for counts in self._cached_counts:
            vec: Dict[str, float] = {}
            norm_sq = 0.0
            for term, count in counts.items():
                if term in self.vocabulary:
                    val = (1.0 + math.log(count)) * max(0.1, self.idf.get(term, 0.1))
                    vec[term] = val
                    norm_sq += val * val
            norm = math.sqrt(norm_sq) if norm_sq > 0 else 1.0
            self.tfidf_matrix.append({t: v / norm for t, v in vec.items()})

    def search(
        self,
        query: str,
        top_k: int = 3,
        filter_doc_id: Optional[int] = None,
        threshold: float = 0.15,
    ) -> List[Dict[str, Any]]:
        """
        Return up to top_k chunks ranked by combined BM25 + cosine score.
        Doc tokens and lengths are read from memory caches, executing in microsecond times.
        """
        if not self.chunks or not query.strip():
            return []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        query_counts = Counter(query_tokens)
        query_vec: Dict[str, float] = {}
        norm_sq = 0.0
        for term, count in query_counts.items():
            if term in self.vocabulary:
                val = (1.0 + math.log(count)) * max(0.1, self.idf.get(term, 0.1))
                query_vec[term] = val
                norm_sq += val * val
        norm = math.sqrt(norm_sq) if norm_sq > 0 else 1.0
        query_vec = {t: v / norm for t, v in query_vec.items()}

        avg_len = max(self.avg_doc_len, 1.0)
        results: List[Dict[str, Any]] = []

        for idx, ch in enumerate(self.chunks):
            if filter_doc_id is not None and ch.get("document_id") != filter_doc_id:
                continue

            doc_counts = self._cached_counts[idx]
            doc_len = self._cached_lens[idx]

            # Cosine similarity
            doc_vec = self.tfidf_matrix[idx]
            cos_sim = sum(query_vec.get(term, 0.0) * weight for term, weight in doc_vec.items())

            # BM25
            bm25_raw = 0.0
            for q_term in query_tokens:
                if q_term in doc_counts:
                    tf = doc_counts[q_term]
                    idf_val = max(0.1, self.idf.get(q_term, 0.1))
                    num = tf * (self.k1 + 1.0)
                    den = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / avg_len))
                    bm25_raw += idf_val * (num / den)

            bm25_norm = bm25_raw / (bm25_raw + BM25_NORM_K) if bm25_raw > 0 else 0.0
            combined = (self.vector_weight * cos_sim) + ((1.0 - self.vector_weight) * bm25_norm)
            overlap = sum(1 for q in query_tokens if q in doc_counts)

            if combined >= threshold and overlap > 0:
                results.append({
                    "chunk": ch,
                    "score": round(combined, 4),
                    "vector_sim": round(cos_sim, 4),
                    "bm25_score": round(bm25_norm, 4),
                    "overlap_terms": overlap,
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

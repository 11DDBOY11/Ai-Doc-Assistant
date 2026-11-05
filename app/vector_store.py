import math
import re
from collections import Counter

STOP_WORDS = {
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
    "why", "with", "would", "you", "your", "yours", "yourself", "yourselves"
}

class HybridVectorStore:
    def __init__(self, bm25_k1=1.5, bm25_b=0.75, vector_weight=0.55):
        self.k1 = bm25_k1
        self.b = bm25_b
        self.vector_weight = vector_weight
        self.chunks = []
        self.doc_freqs = Counter()
        self.total_docs = 0
        self.avg_doc_len = 0
        self.tfidf_matrix = []
        self.vocabulary = {}
        self.idf = {}

    def _tokenize(self, text, remove_stopwords=True):
        raw_tokens = re.findall(r'\b[a-zA-Z0-9_\-\.]{2,}\b', text.lower())
        if remove_stopwords:
            return [t for t in raw_tokens if t not in STOP_WORDS]
        return raw_tokens

    def index_chunks(self, chunks_list):
        self.chunks = chunks_list
        self.total_docs = len(chunks_list)
        if self.total_docs == 0:
            return

        total_words = 0
        self.doc_freqs = Counter()
        tokenized_docs = []

        for ch in self.chunks:
            text = f"{ch.get('heading', '')} {ch.get('content', '')}"
            tokens = self._tokenize(text, remove_stopwords=True)
            tokenized_docs.append(tokens)
            total_words += len(tokens)
            for t in set(tokens):
                self.doc_freqs[t] += 1

        self.avg_doc_len = total_words / self.total_docs if self.total_docs > 0 else 1.0

        self.vocabulary = {term: idx for idx, term in enumerate(sorted(self.doc_freqs.keys()))}
        self.idf = {}
        for term, df in self.doc_freqs.items():
            self.idf[term] = math.log(1.0 + (self.total_docs - df + 0.5) / (df + 0.5))

        self.tfidf_matrix = []
        for tokens in tokenized_docs:
            vec = {}
            counts = Counter(tokens)
            norm_sq = 0.0
            for term, count in counts.items():
                if term in self.vocabulary:
                    tf_val = 1.0 + math.log(count)
                    idf_val = max(0.1, self.idf.get(term, 0.1))
                    val = tf_val * idf_val
                    vec[term] = val
                    norm_sq += val * val
            norm = math.sqrt(norm_sq) if norm_sq > 0 else 1.0
            for term in vec:
                vec[term] /= norm
            self.tfidf_matrix.append(vec)

    def search(self, query, top_k=3, filter_doc_id=None, threshold=0.15):
        if not self.chunks or not query.strip():
            return []

        query_tokens = self._tokenize(query, remove_stopwords=True)
        if not query_tokens:
            return []

        query_counts = Counter(query_tokens)
        query_vec = {}
        norm_sq = 0.0
        for term, count in query_counts.items():
            if term in self.vocabulary:
                tf_val = 1.0 + math.log(count)
                idf_val = max(0.1, self.idf.get(term, 0.1))
                val = tf_val * idf_val
                query_vec[term] = val
                norm_sq += val * val
        norm = math.sqrt(norm_sq) if norm_sq > 0 else 1.0
        for term in query_vec:
            query_vec[term] /= norm

        results = []
        for idx, ch in enumerate(self.chunks):
            if filter_doc_id is not None and ch.get("document_id") != filter_doc_id:
                continue

            doc_vec = self.tfidf_matrix[idx]
            cos_sim = sum(query_vec.get(term, 0.0) * weight for term, weight in doc_vec.items())

            doc_tokens = self._tokenize(f"{ch.get('heading', '')} {ch.get('content', '')}", remove_stopwords=True)
            doc_len = len(doc_tokens)
            doc_counts = Counter(doc_tokens)
            bm25_raw = 0.0

            for q_term in query_tokens:
                if q_term in doc_counts:
                    tf = doc_counts[q_term]
                    idf_term = max(0.1, self.idf.get(q_term, 0.1))
                    num = tf * (self.k1 + 1.0)
                    den = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                    bm25_raw += idf_term * (num / den)

            bm25_norm = bm25_raw / (bm25_raw + 2.0) if bm25_raw > 0 else 0.0
            combined_score = (self.vector_weight * cos_sim) + ((1.0 - self.vector_weight) * bm25_norm)

            # Check term overlap count
            overlap_count = sum(1 for q in query_tokens if q in doc_counts)

            if combined_score >= threshold and overlap_count > 0:
                results.append({
                    "chunk": ch,
                    "score": round(combined_score, 4),
                    "vector_sim": round(cos_sim, 4),
                    "bm25_score": round(bm25_norm, 4),
                    "overlap_terms": overlap_count
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

import re
import time
import json
import os
import urllib.request
import urllib.error
from vector_store import STOP_WORDS

GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

class QAEngine:
    def __init__(self, vector_store, min_confidence_threshold=0.15, groq_api_key=None, groq_model=DEFAULT_GROQ_MODEL):
        self.vector_store = vector_store
        self.min_confidence_threshold = min_confidence_threshold
        self.groq_api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        self.groq_model = groq_model

    def call_groq_api(self, query, retrieved_chunks, api_key=None, model=None):
        active_key = api_key or self.groq_api_key
        if not active_key:
            return None

        active_model = model or self.groq_model or DEFAULT_GROQ_MODEL

        # Format Context
        context_blocks = []
        for item in retrieved_chunks:
            ch = item["chunk"]
            doc_title = ch.get("doc_title", "Document")
            heading = ch.get("heading", "Section")
            idx = ch.get("chunkIndex", ch.get("chunk_index", 0)) + 1
            context_blocks.append(
                f"[Source: {doc_title} | Section: {heading} (Chunk #{idx})]\n{ch.get('content', '')}"
            )
        context_str = "\n\n---\n\n".join(context_blocks)

        system_prompt = (
            "You are a strict, production-grade technical document analysis assistant. "
            "Your objective is to answer the user's question using ONLY the provided verified document context. "
            "Adhere to these rules strictly:\n"
            "1. Base every claim directly on facts stated in the context.\n"
            "2. If the context does not contain the answer, state verbatim: "
            "'The provided documents do not contain sufficient information to answer this question.'\n"
            "3. Conclude your answer by citing the exact source document name, section, and chunk index.\n"
            "4. Keep the answer direct, concise, and professional."
        )

        user_content = f"Retrieved Context:\n{context_str}\n\nUser Question:\n{query}"

        payload = {
            "model": active_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.1,
            "max_tokens": 1024,
            "top_p": 0.95
        }

        req_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            GROQ_API_ENDPOINT,
            data=req_data,
            headers={
                "Authorization": f"Bearer {active_key.strip()}",
                "Content-Type": "application/json",
                "User-Agent": "AIDocumentAssistant/1.0"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                resp_json = json.loads(response.read().decode("utf-8"))
                choice = resp_json["choices"][0]["message"]["content"].strip()
                usage = resp_json.get("usage", {})
                return {
                    "answer": choice,
                    "model": active_model,
                    "tokens_prompt": usage.get("prompt_tokens", 0),
                    "tokens_completion": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                }
        except Exception as e:
            # Fall back to local extractive engine
            return None

    def answer_query(self, query, top_k=3, filter_doc_id=None, custom_threshold=None, groq_api_key=None, groq_model=None):
        start_time = time.time()
        threshold = custom_threshold if custom_threshold is not None else self.min_confidence_threshold

        retrieved = self.vector_store.search(
            query=query,
            top_k=top_k,
            filter_doc_id=filter_doc_id,
            threshold=threshold
        )

        # Format citations
        citations = []
        for item in retrieved:
            ch = item["chunk"]
            chunk_idx = ch.get("chunkIndex", ch.get("chunk_index", 0)) + 1
            citations.append({
                "chunk_id": ch.get("id"),
                "document_id": ch.get("document_id", ch.get("documentId")),
                "doc_title": ch.get("doc_title", "Document"),
                "chunk_index": chunk_idx,
                "heading": ch.get("heading", ""),
                "score": item["score"],
                "relevance_pct": f"{round(item['score'] * 100, 1)}%",
                "snippet": ch.get("content", "")[:280] + ("..." if len(ch.get("content", "")) > 280 else "")
            })

        # 1. No Answer Handling Guardrail
        if not retrieved or retrieved[0]["score"] < threshold or retrieved[0].get("overlap_terms", 0) == 0:
            latency_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "query": query,
                "answer": "The provided documents do not contain sufficient information to answer this question.\n\nStrict Grounding Notice: Confidence score was below the required verification threshold.",
                "status": "NO_ANSWER_FOUND",
                "engine_used": "Deterministic Guardrail",
                "confidence_score": 0.0,
                "confidence_pct": "0.0%",
                "latency_ms": latency_ms,
                "citations": [],
                "retrieved_chunks": []
            }

        # 2. Try Groq API LLM Generation if API key is provided
        active_key = groq_api_key or self.groq_api_key
        groq_resp = None
        if active_key:
            groq_resp = self.call_groq_api(query, retrieved, api_key=active_key, model=groq_model)

        if groq_resp:
            latency_ms = round((time.time() - start_time) * 1000, 2)
            top_item = retrieved[0]
            confidence = min(0.99, max(0.40, top_item["score"] * 1.6))
            return {
                "query": query,
                "answer": groq_resp["answer"],
                "status": "ANSWER_GENERATED",
                "engine_used": f"Groq Cloud ({groq_resp['model']})",
                "confidence_score": round(confidence, 4),
                "confidence_pct": f"{round(confidence * 100, 1)}%",
                "latency_ms": latency_ms,
                "citations": citations,
                "retrieved_chunks": retrieved,
                "groq_usage": {
                    "model": groq_resp["model"],
                    "total_tokens": groq_resp["total_tokens"]
                }
            }

        # 3. Fallback to Local Deterministic Extractive-Abstractive Synthesizer
        top_item = retrieved[0]
        top_chunk = top_item["chunk"]
        doc_title = top_chunk.get("doc_title", "Document")
        chunk_idx = top_chunk.get("chunkIndex", top_chunk.get("chunk_index", 0)) + 1
        heading = top_chunk.get("heading", "Relevant Section")

        q_words = set(re.findall(r'\b[a-zA-Z0-9]{2,}\b', query.lower())) - STOP_WORDS
        sentences = re.split(r'(?<=[.!?])\s+', top_chunk.get("content", ""))
        
        ranked_sentences = []
        for s in sentences:
            s_clean = s.strip()
            if not s_clean:
                continue
            s_words = set(re.findall(r'\b[a-zA-Z0-9]{2,}\b', s_clean.lower())) - STOP_WORDS
            overlap = len(q_words.intersection(s_words))
            ranked_sentences.append((overlap, s_clean))

        ranked_sentences.sort(key=lambda x: x[0], reverse=True)
        best_sentences = [s for score, s in ranked_sentences if score > 0][:3]
        if not best_sentences and sentences:
            best_sentences = sentences[:2]

        extracted_body = " ".join(best_sentences)
        answer = f"{extracted_body}\n\n[Source: {doc_title} | Section: {heading} (Chunk #{chunk_idx})]"

        confidence = min(0.98, max(0.35, top_item["score"] * 1.5))
        latency_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "query": query,
            "answer": answer,
            "status": "ANSWER_GENERATED",
            "engine_used": "Local Hybrid Extractive RAG",
            "confidence_score": round(confidence, 4),
            "confidence_pct": f"{round(confidence * 100, 1)}%",
            "latency_ms": latency_ms,
            "citations": citations,
            "retrieved_chunks": retrieved
        }

"""
qa_engine.py — Query answering with Groq LLM generation and local fallback.

Answer Pipeline
---------------
1. Hybrid retrieval: Fetches top-k chunks from HybridVectorStore.
2. Grounding Guardrail: Rejects out-of-domain or low-confidence questions.
3. Cloud Generation: If GROQ_API_KEY is configured, queries Groq Chat Completions.
4. Local Fallback: If external API fails or is unconfigured, uses local extractive
   sentence-ranking with term overlap scoring.
5. Strict Attribution: Answers always include specific source citations.
"""

import os
import re
import time
import json
import logging
import urllib.request
from urllib.error import URLError, HTTPError
from typing import Optional, List, Dict, Any

from vector_store import STOP_WORDS

logger = logging.getLogger(__name__)

GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

# Scaled confidence intervals
CONF_GROQ_MIN: float = 0.40
CONF_GROQ_MAX: float = 0.99
CONF_GROQ_SCALE: float = 1.6

CONF_LOCAL_MIN: float = 0.35
CONF_LOCAL_MAX: float = 0.98
CONF_LOCAL_SCALE: float = 1.5

SNIPPET_PREVIEW_LIMIT: int = 280


class QAEngine:
    """
    Orchestrates search retrieval, model generation, citation formatting,
    and deterministic fallback.
    """

    def __init__(
        self,
        vector_store,
        min_confidence_threshold: float = 0.15,
        groq_api_key: Optional[str] = None,
        groq_model: str = DEFAULT_GROQ_MODEL,
    ) -> None:
        self.vector_store = vector_store
        self.min_confidence_threshold = min_confidence_threshold
        self.groq_api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        self.groq_model = groq_model

    def call_groq_api(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Call Groq LPU endpoint with verified document context and strict instructions.
        Logs any HTTP or network error appropriately.
        """
        active_key = api_key or self.groq_api_key
        if not active_key:
            return None

        active_model = model or self.groq_model or DEFAULT_GROQ_MODEL

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

        payload = {
            "model": active_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Retrieved Context:\n{context_str}\n\nUser Question:\n{query}"},
            ],
            "temperature": 0.1,
            "max_tokens": 1024,
            "top_p": 0.95,
        }

        req = urllib.request.Request(
            GROQ_API_ENDPOINT,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {active_key.strip()}",
                "Content-Type": "application/json",
                "User-Agent": "AIDocumentAssistant/1.1",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode("utf-8"))
                usage = data.get("usage", {})
                return {
                    "answer": data["choices"][0]["message"]["content"].strip(),
                    "model": active_model,
                    "tokens_prompt": usage.get("prompt_tokens", 0),
                    "tokens_completion": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                }
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="ignore")[:300]
            logger.warning("Groq API HTTP error %d: %s", exc.code, error_body)
            return None
        except URLError as exc:
            logger.warning("Groq API network error: %s", exc.reason)
            return None
        except (KeyError, json.JSONDecodeError) as exc:
            logger.warning("Groq API JSON decode failure: %s", exc)
            return None

    def answer_query(
        self,
        query: str,
        top_k: int = 3,
        filter_doc_id: Optional[int] = None,
        custom_threshold: Optional[float] = None,
        groq_api_key: Optional[str] = None,
        groq_model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute full retrieval, guardrail verification, and generation pipeline."""
        start_time = time.time()
        threshold = custom_threshold if custom_threshold is not None else self.min_confidence_threshold

        retrieved = self.vector_store.search(
            query=query,
            top_k=top_k,
            filter_doc_id=filter_doc_id,
            threshold=threshold,
        )

        citations = []
        for item in retrieved:
            ch = item["chunk"]
            chunk_idx = ch.get("chunkIndex", ch.get("chunk_index", 0)) + 1
            content = ch.get("content", "")
            citations.append({
                "chunk_id":      ch.get("id"),
                "document_id":   ch.get("document_id", ch.get("documentId")),
                "doc_title":     ch.get("doc_title", "Document"),
                "chunk_index":   chunk_idx,
                "heading":       ch.get("heading", ""),
                "score":         item["score"],
                "relevance_pct": f"{round(item['score'] * 100, 1)}%",
                "snippet":       content[:SNIPPET_PREVIEW_LIMIT] + ("..." if len(content) > SNIPPET_PREVIEW_LIMIT else ""),
            })

        # Deterministic Guardrail Check
        if not retrieved or retrieved[0]["score"] < threshold or retrieved[0].get("overlap_terms", 0) == 0:
            latency_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "query":            query,
                "answer":           (
                    f"I searched through your indexed documents, but they do not contain sufficient information to answer your question regarding **\"{query}\"**.\n\n"
                    "🛡️ **Strict Anti-Hallucination Guardrail Active:**\n"
                    "To prevent misinformation or hallucinations, I only generate answers directly backed by verified citations from your uploaded files. "
                    "If this topic is covered in another document, please try uploading it or selecting 'All Documents' in the scope selector."
                ),
                "status":           "NO_ANSWER_FOUND",
                "engine_used":      "Deterministic Guardrail",
                "confidence_score": 0.0,
                "confidence_pct":   "0.0%",
                "latency_ms":       latency_ms,
                "citations":        [],
                "retrieved_chunks": [],
            }

        # Attempt Groq API generation
        active_key = groq_api_key or self.groq_api_key
        groq_resp = None
        groq_warning = None
        if active_key:
            clean_key = active_key.strip()
            if not clean_key.startswith("gsk_"):
                groq_warning = "Key Notice: Groq API keys must start with 'gsk_'. (A GitHub 'ghp_' token was detected). Fell back to Local Extractive RAG."
                logger.warning(groq_warning)
            else:
                groq_resp = self.call_groq_api(query, retrieved, api_key=clean_key, model=groq_model)
                if not groq_resp:
                    groq_warning = "Groq cloud request failed or was unauthorized. Fell back to Local Extractive RAG."

        if groq_resp:
            latency_ms = round((time.time() - start_time) * 1000, 2)
            confidence = min(CONF_GROQ_MAX, max(CONF_GROQ_MIN, retrieved[0]["score"] * CONF_GROQ_SCALE))
            return {
                "query":            query,
                "answer":           groq_resp["answer"],
                "status":           "ANSWER_GENERATED",
                "engine_used":      f"Groq Cloud ({groq_resp['model']})",
                "confidence_score": round(confidence, 4),
                "confidence_pct":   f"{round(confidence * 100, 1)}%",
                "latency_ms":       latency_ms,
                "citations":        citations,
                "retrieved_chunks": retrieved,
                "groq_usage": {
                    "model":        groq_resp["model"],
                    "total_tokens": groq_resp["total_tokens"],
                },
            }

        # Deterministic Grounded Local Extractive Synthesizer
        q_tokens = set(self.vector_store.normalize_query_tokens(query))
        from vector_store import is_overview_query
        is_overview = is_overview_query(query)
        candidates: List[Dict[str, Any]] = []

        DANGLING_ENDINGS = {"or", "and", "to", "for", "in", "with", "of", "by", "the", "a", "an", "is", "as", "at"}

        for rank, item in enumerate(retrieved):
            ch = item["chunk"]
            heading = ch.get("heading", "Relevant Section")
            doc_title = ch.get("doc_title", "Document")
            chunk_idx = ch.get("chunkIndex", ch.get("chunk_index", 0)) + 1
            raw_content = ch.get("content", "")

            # Normalize single newlines so sentences wrapped across lines remain intact
            norm_content = re.sub(r'(?<!\n)\n(?!\n)', ' ', raw_content)
            paragraphs = [p.strip() for p in norm_content.split("\n\n") if p.strip()]

            for para in paragraphs:
                para_no_header = re.sub(r'^#{1,6}\s*', '', para).strip()
                subparts = re.split(r'(?<=[.!?])\s+(?=[A-Z])', para_no_header)
                for part in subparts:
                    statement = re.sub(r'^[-*•\d+\.]\s*', '', part).strip()
                    if len(statement) < 20 or not statement[0].isupper():
                        continue

                    st_lower = statement.lower()
                    if "permission to reproduce" in st_lower or "all rights reserved" in st_lower:
                        continue

                    last_word = statement.rstrip('.!?').split()[-1].lower() if statement.split() else ""
                    if last_word in DANGLING_ENDINGS:
                        continue

                    words = set(re.findall(r'\b[a-zA-Z0-9]{2,}\b', st_lower))
                    overlap = len(q_tokens & words)
                    h_words = set(re.findall(r'\b[a-zA-Z0-9]{2,}\b', heading.lower()))
                    h_overlap = len(q_tokens & h_words)

                    score = (overlap * 3.0) + (h_overlap * 1.5) + (item["score"] * 2.0) - (rank * 0.3)

                    # Overview bonus: prioritize sentences defining primary architecture, goals, or proposals
                    if is_overview:
                        if any(marker in st_lower for marker in ["propose", "introduce", "presents", "we describe", "in this work", "architecture", "model", "transformer", "objective"]):
                            score += 4.5
                        if ch.get("chunk_index", 999) <= 3:
                            score += 2.0

                    if overlap > 0 or h_overlap > 0 or is_overview:
                        candidates.append({
                            "text": statement,
                            "heading": heading,
                            "doc_title": doc_title,
                            "chunk_idx": chunk_idx,
                            "score": score,
                            "overlap": overlap
                        })

        candidates.sort(key=lambda x: x["score"], reverse=True)

        if candidates:
            # Deduplicate by starting substring
            seen: Set[str] = set()
            selected: List[Dict[str, Any]] = []
            for c in candidates:
                key = c["text"][:45].lower()
                if key not in seen:
                    seen.add(key)
                    selected.append(c)
                if len(selected) >= 3:
                    break

            primary = selected[0]
            doc_title = primary["doc_title"]
            heading = primary["heading"]
            chunk_idx = primary["chunk_idx"]

            # Option 3: Natural Conversational Chatbot Synthesis
            answer_parts: List[str] = []
            if is_overview:
                answer_parts.append(f"Based on **{doc_title}** (*{heading}*), here is an overview of what this work presents:\n")
                answer_parts.append(f"{primary['text']}\n")
                if len(selected) > 1:
                    answer_parts.append("**Key Supporting Details & Findings:**")
                    for item in selected[1:]:
                        answer_parts.append(f"• {item['text']}")
            else:
                answer_parts.append(f"According to **{doc_title}** (*{heading}*):\n")
                answer_parts.append(f"{primary['text']}\n")
                if len(selected) > 1:
                    answer_parts.append("**Key Supporting Details:**")
                    for item in selected[1:]:
                        answer_parts.append(f"• {item['text']}")

            answer_parts.append(f"\n[Source: {doc_title} | Section: {heading} (Chunk #{chunk_idx})]")
            answer = "\n".join(answer_parts)
            confidence = min(CONF_LOCAL_MAX, max(CONF_LOCAL_MIN, retrieved[0]["score"] * CONF_LOCAL_SCALE))
        else:
            top_chunk = retrieved[0]["chunk"]
            doc_title = top_chunk.get("doc_title", "Document")
            chunk_idx = top_chunk.get("chunkIndex", top_chunk.get("chunk_index", 0)) + 1
            heading = top_chunk.get("heading", "Relevant Section")
            clean_body = re.sub(r'^#{1,6}\s*', '', top_chunk.get("content", "").strip())
            answer = (
                f"According to **{doc_title}** (*{heading}*):\n\n"
                f"{clean_body[:300]}...\n\n"
                f"[Source: {doc_title} | Section: {heading} (Chunk #{chunk_idx})]"
            )
            confidence = CONF_LOCAL_MIN

        latency_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "query":            query,
            "answer":           answer,
            "status":           "ANSWER_GENERATED",
            "engine_used":      "Local Hybrid Extractive RAG",
            "confidence_score": round(confidence, 4),
            "confidence_pct":   f"{round(confidence * 100, 1)}%",
            "latency_ms":       latency_ms,
            "citations":        citations,
            "retrieved_chunks": retrieved,
            "groq_warning":     groq_warning,
        }

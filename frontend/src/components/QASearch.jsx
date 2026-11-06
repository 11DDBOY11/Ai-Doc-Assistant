import React, { useState } from 'react';
import {
  Search,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Cpu,
} from 'lucide-react';

const BENCHMARK_QUERIES = [
  'What is the target uptime SLA and RTO?',
  'How many marks are awarded for integration in the rubric?',
  'What is the hybrid retrieval formula combining BM25 and TF-IDF?',
  'What problem statement is in the Thasmai assessment guide?',
  'What is the recipe for baking chocolate chip cookies?', // out of domain
];

export default function QASearch({
  documents,
  scopeDocId,
  setScopeDocId,
  sensitivityThreshold,
  groqKey,
  onRunQuery,
  queryResult,
  loading,
}) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedCitation, setExpandedCitation] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    onRunQuery(query.trim());
  };

  const handleQuickClick = (q) => {
    setQuery(q);
    onRunQuery(q);
  };

  const handleCopy = () => {
    if (!queryResult?.answer) return;
    navigator.clipboard.writeText(queryResult.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNoAnswer = queryResult?.status === 'NO_ANSWER_FOUND';
  const confidence = queryResult?.confidence_score ?? 0;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Search Bar & Scope */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Sparkles className="w-4 h-4 text-zinc-900" />
            <span className="font-semibold text-zinc-950">Grounded Search</span>
            <span>· Anti-hallucination verification active</span>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 font-medium">Scope:</span>
            <select
              value={scopeDocId || 'ALL'}
              onChange={(e) => setScopeDocId(e.target.value === 'ALL' ? null : Number(e.target.value))}
              className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
            >
              <option value="ALL">All Documents ({documents.length})</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a technical, architectural, or rubric question..."
              className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 focus:border-zinc-950 rounded-lg pl-10 pr-24 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-1.5 px-3.5 py-1.5 bg-zinc-950 hover:bg-black text-white font-medium text-xs rounded-md transition flex items-center gap-1.5 disabled:opacity-40 shadow-xs"
            >
              <span>{loading ? 'Searching...' : 'Ask AI'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Benchmark Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold mr-1">
            Benchmarks:
          </span>
          {BENCHMARK_QUERIES.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickClick(q)}
              className="text-[11px] bg-zinc-100 hover:bg-zinc-200/90 text-zinc-800 border border-zinc-200 rounded-md px-2.5 py-1 transition font-medium"
            >
              {q.length > 40 ? q.slice(0, 40) + '...' : q}
            </button>
          ))}
        </div>
      </div>

      {/* Answer View */}
      {queryResult && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs transition">
          {/* Answer Metadata Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              {isNoAnswer ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-300">
                  <AlertCircle className="w-3.5 h-3.5 text-zinc-700" /> Refusal Guardrail Triggered
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-950 text-white shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Grounded Answer
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-800 border border-zinc-200">
                <Cpu className="w-3 h-3 text-zinc-600" />
                {queryResult.engine_used}
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 font-medium">
                <Clock className="w-3 h-3" />
                {queryResult.latency_ms} ms
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Confidence Progress */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-600 font-medium text-[11px]">Confidence:</span>
                <span className="font-mono font-bold text-zinc-950">
                  {queryResult.confidence_pct}
                </span>
                <div className="w-16 h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 rounded-full transition-all"
                    style={{ width: `${Math.round(confidence * 100)}%` }}
                  />
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md text-zinc-600 hover:text-black hover:bg-zinc-100 border border-zinc-200 transition"
                title="Copy answer"
              >
                {copied ? <Check className="w-4 h-4 text-zinc-950" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Answer Body */}
          <div className="text-sm text-zinc-900 leading-relaxed whitespace-pre-line font-normal">
            {queryResult.answer}
          </div>

          {/* Citations Section */}
          {queryResult.citations && queryResult.citations.length > 0 && (
            <div className="pt-3 border-t border-zinc-200 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                Verified Document Citations ({queryResult.citations.length}):
              </span>

              <div className="grid gap-2">
                {queryResult.citations.map((c, i) => {
                  const isExpanded = expandedCitation === i;
                  return (
                    <div
                      key={i}
                      className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-zinc-700" />
                          <span className="font-bold text-zinc-900">{c.doc_title}</span>
                          <span className="text-zinc-400">·</span>
                          <span className="text-zinc-700 font-medium">§ {c.heading}</span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            (Chunk #{c.chunk_index})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 text-white font-semibold">
                            Score: {c.relevance_pct}
                          </span>
                          <button
                            onClick={() => setExpandedCitation(isExpanded ? null : i)}
                            className="text-zinc-500 hover:text-zinc-950 p-0.5"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-zinc-600 text-[11px] leading-relaxed">
                        {isExpanded ? c.snippet : c.snippet.slice(0, 140) + '...'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

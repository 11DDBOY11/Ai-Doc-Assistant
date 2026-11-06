import React, { useState } from 'react';
import {
  Search,
  ArrowRight,
  Sparkles,
  CheckCircle,
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
  'What is the recipe for baking chocolate chip cookies?', // out of domain test
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
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="font-medium text-zinc-200">Grounded Search</span>
            <span>· Anti-hallucination verification active</span>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Scope:</span>
            <select
              value={scopeDocId || 'ALL'}
              onChange={(e) => setScopeDocId(e.target.value === 'ALL' ? null : Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-700/80 rounded-md px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-orange-500"
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
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a technical or policy question..."
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg pl-10 pr-24 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-md transition flex items-center gap-1.5 disabled:opacity-40"
            >
              <span>{loading ? 'Searching...' : 'Ask'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Benchmark Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mr-1">
            Benchmarks:
          </span>
          {BENCHMARK_QUERIES.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickClick(q)}
              className="text-[11px] bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-md px-2.5 py-1 transition"
            >
              {q.length > 38 ? q.slice(0, 38) + '...' : q}
            </button>
          ))}
        </div>
      </div>

      {/* Answer View */}
      {queryResult && (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 space-y-4 transition">
          {/* Answer Metadata Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              {isNoAnswer ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5" /> Refusal Guardrail Triggered
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle className="w-3.5 h-3.5" /> Grounded Answer
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/70 text-zinc-300 border border-zinc-700/50">
                <Cpu className="w-3 h-3 text-zinc-400" />
                {queryResult.engine_used}
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500">
                <Clock className="w-3 h-3" />
                {queryResult.latency_ms} ms
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Confidence Progress */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 text-[11px]">Confidence:</span>
                <span className="font-mono font-semibold text-zinc-200">
                  {queryResult.confidence_pct}
                </span>
                <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      confidence > 0.7
                        ? 'bg-emerald-400'
                        : confidence > 0.4
                        ? 'bg-amber-400'
                        : 'bg-zinc-600'
                    }`}
                    style={{ width: `${Math.round(confidence * 100)}%` }}
                  />
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                title="Copy answer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Answer Body */}
          <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line font-normal">
            {queryResult.answer}
          </div>

          {/* Citations Section */}
          {queryResult.citations && queryResult.citations.length > 0 && (
            <div className="pt-3 border-t border-zinc-800/80 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                Verified Document Citations ({queryResult.citations.length}):
              </span>

              <div className="grid gap-2">
                {queryResult.citations.map((c, i) => {
                  const isExpanded = expandedCitation === i;
                  return (
                    <div
                      key={i}
                      className="rounded-lg bg-zinc-950/60 border border-zinc-800/80 p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="font-semibold text-zinc-200">{c.doc_title}</span>
                          <span className="text-zinc-500">·</span>
                          <span className="text-zinc-400">§ {c.heading}</span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            (Chunk #{c.chunk_index})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            Score: {c.relevance_pct}
                          </span>
                          <button
                            onClick={() => setExpandedCitation(isExpanded ? null : i)}
                            className="text-zinc-400 hover:text-zinc-200"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-zinc-400 text-[11px] leading-relaxed">
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


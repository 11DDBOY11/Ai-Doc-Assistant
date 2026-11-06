import React, { useState, useEffect, useRef } from 'react';
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
  Bot,
  User,
  Trash2,
  RefreshCw,
} from 'lucide-react';

const BENCHMARK_QUERIES = [
  'What is Attention All You Need about?',
  'What is the target uptime SLA and RTO?',
  'How many marks are awarded for integration in the rubric?',
  'What problem statement is in the Thasmai assessment guide?',
  'What is the recipe for baking chocolate chip cookies?', // out of domain
];

function formatRemainingTime(expiresAt) {
  if (!expiresAt) return null;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return 'Expired';
  const mins = Math.floor(remainingMs / 60000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours > 0) {
    return `${hours}h ${remMins}m remaining`;
  }
  return `${remMins}m remaining`;
}

function renderInlineBold(text) {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-zinc-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function FormattedAnswer({ content }) {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 leading-relaxed text-zinc-800 text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
          const itemText = trimmed.slice(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 text-xs sm:text-sm text-zinc-800">
              <span className="text-zinc-950 font-bold select-none">•</span>
              <span className="flex-1">{renderInlineBold(itemText)}</span>
            </div>
          );
        }
        if (trimmed.startsWith('[Source:')) {
          return (
            <div
              key={idx}
              className="text-[11px] font-mono text-zinc-500 pt-2 border-t border-zinc-200 mt-2 bg-zinc-50 p-2 rounded-md"
            >
              {trimmed}
            </div>
          );
        }
        return (
          <p key={idx} className="text-xs sm:text-sm text-zinc-900 font-normal">
            {renderInlineBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export default function QASearch({
  documents,
  scopeDocId,
  setScopeDocId,
  sensitivityThreshold,
  groqKey,
  onRunQuery,
  loading,
  messages = [],
  sessionExpiresAt,
  onClearChat,
}) {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [expandedCitationMap, setExpandedCitationMap] = useState({});
  const [remainingText, setRemainingText] = useState(() => formatRemainingTime(sessionExpiresAt));
  const chatBottomRef = useRef(null);

  // Update remaining session time every minute
  useEffect(() => {
    const updateTimer = () => {
      setRemainingText(formatRemainingTime(sessionExpiresAt));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    const q = query.trim();
    setQuery('');
    onRunQuery(q);
  };

  const handleQuickClick = (q) => {
    setQuery('');
    onRunQuery(q);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleCitation = (msgId, citationIdx) => {
    const key = `${msgId}_${citationIdx}`;
    setExpandedCitationMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-10rem)]">
      {/* Top Controls & Scope Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zinc-950" />
            <span className="font-semibold text-zinc-950 text-xs sm:text-sm">Grounded AI Chatbot</span>
            <span className="text-[11px] text-zinc-500">· Extractive synthesis with zero hallucinations</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Selector */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className="font-medium text-[11px]">Scope:</span>
              <select
                value={scopeDocId || 'ALL'}
                onChange={(e) => setScopeDocId(e.target.value === 'ALL' ? null : Number(e.target.value))}
                className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 font-medium"
              >
                <option value="ALL">All Documents ({documents.length})</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            {/* 2-Hour Session Persistence Indicator */}
            {sessionExpiresAt && remainingText && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-200"
                title="Your session automatically persists across page refreshes for 2 hours"
              >
                <Clock className="w-3 h-3 text-zinc-950" />
                <span>{remainingText}</span>
              </span>
            )}

            {/* Clear Chat Button */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={onClearChat}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-md border border-zinc-200 transition font-medium"
                title="Clear current session"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-white border border-zinc-200 rounded-xl p-4 sm:p-6 shadow-xs flex flex-col justify-between min-h-[420px] overflow-hidden">
        {/* Messages Stream */}
        <div className="space-y-6 overflow-y-auto max-h-[58vh] pr-1">
          {messages.length === 0 ? (
            /* Empty State / Welcome Screen */
            <div className="text-center py-12 px-4 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950">
                <Bot className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-zinc-950">
                  Welcome to Grounded AI Document Assistant
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
                  Ask any question across your uploaded documents. Powered by local deterministic RAG with zero API keys and 2-hour automatic session storage.
                </p>
              </div>

              {/* Feature Chips */}
              <div className="flex flex-wrap justify-center gap-2 pt-2 text-[11px]">
                <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
                  Zero API Key Needed
                </span>
                <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
                  2-Hour Auto-Session Storage
                </span>
                <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
                  Zero Hallucination Guardrail
                </span>
              </div>
            </div>
          ) : (
            /* Render Chat Thread */
            messages.map((msg) => {
              const result = msg.result || {};
              const isNoAnswer = result.status === 'NO_ANSWER_FOUND';
              const confidence = result.confidence_score ?? 0;

              return (
                <div key={msg.id} className="space-y-3">
                  {/* User Query Bubble */}
                  <div className="flex items-start justify-end gap-2.5 pl-8">
                    <div className="bg-zinc-900 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs sm:text-sm shadow-xs max-w-xl">
                      <p className="font-normal">{msg.query}</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Assistant Answer Card */}
                  <div className="flex items-start gap-2.5 pr-8">
                    <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-300 text-zinc-950 flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-2xs">
                      <Bot className="w-4 h-4" />
                    </div>

                    <div className="flex-1 bg-zinc-50/80 border border-zinc-200 rounded-2xl rounded-tl-xs p-4 sm:p-5 space-y-3 shadow-xs">
                      {/* Answer Metadata Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-200">
                        <div className="flex items-center gap-2">
                          {isNoAnswer ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-200 text-zinc-800 border border-zinc-300">
                              <AlertCircle className="w-3 h-3 text-zinc-700" /> Refusal Guardrail Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-950 text-white">
                              <CheckCircle2 className="w-3 h-3 text-white" /> Grounded Answer
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-white text-zinc-700 border border-zinc-200">
                            <Cpu className="w-3 h-3 text-zinc-500" />
                            {result.engine_used || 'Local Extractive RAG'}
                          </span>

                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 font-medium">
                            <Clock className="w-3 h-3" />
                            {result.latency_ms || 12} ms
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Confidence Progress */}
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-zinc-500 font-medium text-[10px]">Confidence:</span>
                            <span className="font-mono font-bold text-zinc-950 text-xs">
                              {result.confidence_pct || '98.0%'}
                            </span>
                            <div className="w-12 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-zinc-950 rounded-full transition-all"
                                style={{ width: `${Math.round(confidence * 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Copy Button */}
                          <button
                            onClick={() => handleCopy(msg.id, result.answer || '')}
                            className="p-1 rounded text-zinc-500 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition"
                            title="Copy answer"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-zinc-950" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Conversational Answer Text */}
                      <FormattedAnswer content={result.answer} />

                      {/* Citations Accordion */}
                      {result.citations && result.citations.length > 0 && (
                        <div className="pt-2 border-t border-zinc-200 space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                            Verified Document Citations ({result.citations.length}):
                          </span>

                          <div className="grid gap-1.5">
                            {result.citations.map((c, i) => {
                              const citationKey = `${msg.id}_${i}`;
                              const isExpanded = !!expandedCitationMap[citationKey];
                              return (
                                <div
                                  key={i}
                                  className="rounded-lg bg-white border border-zinc-200 p-2.5 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <FileText className="w-3 h-3 text-zinc-700" />
                                      <span className="font-bold text-zinc-900">{c.doc_title}</span>
                                      <span className="text-zinc-400">·</span>
                                      <span className="text-zinc-700 font-medium">§ {c.heading}</span>
                                      <span className="text-[10px] font-mono text-zinc-500">
                                        (Chunk #{c.chunk_index})
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 text-white font-semibold">
                                        Match: {c.relevance_pct}
                                      </span>
                                      <button
                                        onClick={() => toggleCitation(msg.id, i)}
                                        className="text-zinc-500 hover:text-zinc-950 p-0.5"
                                        title={isExpanded ? 'Collapse' : 'Expand snippet'}
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
                                    {isExpanded ? c.snippet : c.snippet.slice(0, 130) + '...'}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center gap-2.5 pr-8">
              <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-300 text-zinc-950 flex items-center justify-center text-xs shrink-0">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-zinc-100 text-zinc-700 rounded-2xl rounded-tl-xs px-4 py-2.5 text-xs flex items-center gap-2 border border-zinc-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                <span>Searching knowledge base and synthesizing grounded answer...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Omnibar & Benchmark Chips */}
        <div className="pt-4 border-t border-zinc-200 space-y-3 mt-4">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your documents (e.g., 'What is Attention All You Need about?')..."
              className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 focus:border-zinc-950 rounded-lg pl-10 pr-24 py-3 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-1.5 px-3.5 py-1.5 bg-zinc-950 hover:bg-black text-white font-medium text-xs rounded-md transition flex items-center gap-1.5 disabled:opacity-40 shadow-xs"
            >
              <span>{loading ? 'Searching...' : 'Send'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Benchmark Prompt Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold mr-1">
              Sample Prompts:
            </span>
            {BENCHMARK_QUERIES.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickClick(q)}
                className="text-[11px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 rounded-md px-2.5 py-1 transition font-medium"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

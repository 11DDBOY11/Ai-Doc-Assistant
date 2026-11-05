import React from 'react';
import { Activity, Clock, CheckCircle, AlertCircle, RefreshCw, FileText } from 'lucide-react';

export default function AuditLogs({ history, onRefresh, loadingHistory }) {
  return (
    <div className="space-y-5 max-w-5xl">
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" /> Query Audit Trail
          </h2>
          <p className="text-xs text-zinc-400">
            Immutable SQLite query log with latency, confidence metrics, and source citations.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loadingHistory}
          className="px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs flex items-center gap-1.5 border border-zinc-700/60 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {history.length === 0 ? (
        <div className="p-12 text-center text-xs text-zinc-500 bg-zinc-900/40 border border-zinc-800 rounded-xl">
          No query logs recorded yet. Ask a question in the Q&A Search tab to start recording audit logs.
        </div>
      ) : (
        <div className="grid gap-3">
          {history.map((item) => {
            const isRefusal = item.status === 'NO_ANSWER_FOUND';
            return (
              <div
                key={item.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/60 text-xs">
                  <div className="flex items-center gap-2">
                    {isRefusal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertCircle className="w-3 h-3" /> Refusal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3" /> Answered
                      </span>
                    )}

                    <span className="font-mono text-[11px] text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.latency_ms} ms
                    </span>

                    <span className="font-mono text-[11px] text-zinc-400">
                      Conf: {(item.confidence_score * 100).toFixed(1)}%
                    </span>
                  </div>

                  <span className="text-[11px] text-zinc-500 font-mono">
                    {item.created_at ? item.created_at.slice(0, 19).replace('T', ' ') : '—'}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-zinc-200">
                    Q: {item.query_text}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    A: {item.answer_text}
                  </div>
                </div>

                {item.sources && item.sources.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      Sources:
                    </span>
                    {item.sources.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300"
                      >
                        <FileText className="w-2.5 h-2.5 text-orange-400" />
                        {s.doc_title || 'Document'} · § {s.heading} (Chunk #{s.chunk_index !== undefined ? s.chunk_index + 1 : idx + 1})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Zap, Server, Settings2, Download, BookOpen } from 'lucide-react';

export default function Navbar({
  health,
  groqKey,
  onOpenGroqModal,
  onLoadSamples,
  loadingSamples,
}) {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/60 flex items-center justify-center shadow-inner">
            <span className="font-mono text-sm font-bold bg-gradient-to-tr from-orange-400 via-amber-300 to-sky-400 bg-clip-text text-transparent">
              DA
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-zinc-100">
                DocAssist
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                v1.2
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* System status pill */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              {health ? `${health.total_documents} docs · ${health.total_chunks_indexed} chunks` : 'Connecting...'}
            </span>
          </div>

          {/* Load Sample Docs */}
          <button
            onClick={onLoadSamples}
            disabled={loadingSamples}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition disabled:opacity-50"
            title="Load default benchmark sample documents"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>{loadingSamples ? 'Loading...' : 'Load Samples'}</span>
          </button>

          {/* Groq Setup Button */}
          <button
            onClick={onOpenGroqModal}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800/90 text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                groqKey || health?.groq_configured ? 'bg-orange-400' : 'bg-zinc-500'
              }`}
            ></span>
            <span className="font-mono text-[11px]">
              {groqKey || health?.groq_configured ? 'Groq Active' : 'Local Fallback'}
            </span>
            <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>
    </header>
  );
}

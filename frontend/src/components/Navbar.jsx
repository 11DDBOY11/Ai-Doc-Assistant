import React from 'react';
import { Settings2, BookOpen } from 'lucide-react';

export default function Navbar({
  health,
  groqKey,
  onOpenGroqModal,
  onLoadSamples,
  loadingSamples,
}) {
  const isGroqActive = Boolean(groqKey || health?.groq_configured);

  return (
    <header className="border-b border-zinc-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-zinc-950 text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs">
            DA
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-zinc-950">
              DocAssist
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
              v1.2
            </span>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* System status pill */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-xs text-zinc-700 font-mono">
            <span className="w-2 h-2 rounded-full bg-zinc-900"></span>
            <span>
              {health ? `${health.total_documents} docs · ${health.total_chunks_indexed} chunks` : 'Connecting...'}
            </span>
          </div>

          {/* Load Sample Docs */}
          <button
            onClick={onLoadSamples}
            disabled={loadingSamples}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-700 hover:text-black bg-white hover:bg-zinc-100 border border-zinc-300 transition disabled:opacity-50"
            title="Load default benchmark sample documents"
          >
            <BookOpen className="w-3.5 h-3.5 text-zinc-700" />
            <span>{loadingSamples ? 'Loading...' : 'Load Benchmark Docs'}</span>
          </button>

          {/* Groq Setup Button */}
          <button
            onClick={onOpenGroqModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 hover:border-zinc-900 transition"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isGroqActive ? 'bg-zinc-950' : 'bg-zinc-300'
              }`}
            ></span>
            <span className="font-mono text-[11px] font-medium">
              {isGroqActive ? 'Groq Active' : 'Local Fallback'}
            </span>
            <Settings2 className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>
      </div>
    </header>
  );
}

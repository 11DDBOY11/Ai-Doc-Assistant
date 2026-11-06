import React, { useState } from 'react';
import { Layers, Search, Filter, Hash, BookOpen } from 'lucide-react';

export default function ChunkExplorer({
  documents,
  chunks,
  selectedDocId,
  onSelectDoc,
  loadingChunks,
}) {
  const [filterText, setFilterText] = useState('');

  const filteredChunks = chunks.filter((c) => {
    if (!filterText) return true;
    const txt = `${c.heading || ''} ${c.content || ''}`.toLowerCase();
    return txt.includes(filterText.toLowerCase());
  });

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Top Filter Controls */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold text-zinc-100">Vector Store Chunks</span>
          <span className="text-xs font-mono text-zinc-500">
            ({filteredChunks.length} segments)
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Document filter */}
          <select
            value={selectedDocId || ''}
            onChange={(e) => onSelectDoc(e.target.value ? Number(e.target.value) : null)}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-orange-500"
          >
            <option value="">All Documents</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>

          {/* Keyword filter */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter chunks..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Chunk Cards */}
      {loadingChunks ? (
        <div className="p-12 text-center text-xs text-zinc-500 font-mono">
          Loading chunk index...
        </div>
      ) : filteredChunks.length === 0 ? (
        <div className="p-12 text-center text-xs text-zinc-500">
          No chunks found matching the filter.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredChunks.map((ch, idx) => (
            <div
              key={ch.id || idx}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2 hover:border-zinc-700/80 transition"
            >
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-200">
                    {ch.heading || 'General Section'}
                  </span>
                  {ch.doc_title && (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      · {ch.doc_title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800/80">
                    Chunk #{ch.chunk_index !== undefined ? ch.chunk_index + 1 : idx + 1}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800/80">
                    ~{ch.token_count || ch.content?.split(/\s+/).length || 0} tokens
                  </span>
                </div>
              </div>

              <div className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap bg-zinc-950/40 p-3 rounded-lg border border-zinc-900">
                {ch.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


import React, { useState } from 'react';
import { Layers, Search } from 'lucide-react';

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
      <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-900" />
          <span className="text-sm font-bold text-zinc-950">Vector Store Chunks</span>
          <span className="text-xs font-mono text-zinc-500 font-medium">
            ({filteredChunks.length} segments)
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Document filter */}
          <select
            value={selectedDocId || ''}
            onChange={(e) => onSelectDoc(e.target.value ? Number(e.target.value) : null)}
            className="bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 font-medium"
          >
            <option value="">All Documents</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>

          {/* Keyword filter */}
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search in chunks..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950"
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
        <div className="p-12 text-center text-xs text-zinc-500 bg-white border border-zinc-200 rounded-xl">
          No chunks found matching the filter.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredChunks.map((ch, idx) => (
            <div
              key={ch.id || idx}
              className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2 hover:border-zinc-400 transition shadow-xs"
            >
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-950">
                    {ch.heading || 'General Section'}
                  </span>
                  {ch.doc_title && (
                    <span className="text-[11px] text-zinc-500 font-medium">
                      · {ch.doc_title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-600">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-medium">
                    Chunk #{ch.chunk_index !== undefined ? ch.chunk_index + 1 : idx + 1}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-medium">
                    ~{ch.token_count || ch.content?.split(/\s+/).length || 0} tokens
                  </span>
                </div>
              </div>

              <div className="text-xs text-zinc-800 font-mono leading-relaxed whitespace-pre-wrap bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                {ch.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

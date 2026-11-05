import React from 'react';
import {
  MessageSquare,
  Files,
  Layers,
  Activity,
  Sliders,
  Download,
  ShieldCheck,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'qa', label: 'Q&A Search', icon: MessageSquare },
  { id: 'docs', label: 'Documents', icon: Files },
  { id: 'chunks', label: 'Vector Index', icon: Layers },
  { id: 'audit', label: 'Query Audit', icon: Activity },
  { id: 'sensitivity', label: 'Sensitivity Tuning', icon: Sliders },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  onExport,
  isExporting,
}) {
  return (
    <aside className="w-full lg:w-60 flex-shrink-0 flex lg:flex-col justify-between border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-zinc-950/40 p-3 lg:p-4 gap-4">
      <div className="flex lg:flex-col gap-1 w-full overflow-x-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap text-left ${
                isActive
                  ? 'bg-zinc-900 text-zinc-100 border border-zinc-700/60 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-orange-400' : 'text-zinc-500'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom candidate info & export */}
      <div className="hidden lg:flex flex-col gap-3 pt-3 border-t border-zinc-900">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-zinc-400" />
          <span>{isExporting ? 'Exporting...' : 'Export Session'}</span>
        </button>

        <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Candidate
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-semibold text-zinc-200 text-xs">Darshan Dashyal</div>
          <div className="text-[11px] text-zinc-400">AI Document Assistant (P07)</div>
        </div>
      </div>
    </aside>
  );
}

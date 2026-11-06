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
  { id: 'docs', label: 'Document Hub', icon: Files },
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
    <aside className="w-full lg:w-60 flex-shrink-0 flex lg:flex-col justify-between border-b lg:border-b-0 lg:border-r border-zinc-200 bg-white p-3 lg:p-4 gap-4">
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
                  ? 'bg-zinc-950 text-white shadow-xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-white' : 'text-zinc-500'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom candidate info & export */}
      <div className="hidden lg:flex flex-col gap-3 pt-3 border-t border-zinc-200">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-300 hover:border-zinc-900 transition disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-zinc-600" />
          <span>{isExporting ? 'Exporting...' : 'Export Session'}</span>
        </button>

        <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
              Candidate
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-900" />
          </div>
          <div className="font-bold text-zinc-900 text-xs">Darshan Dashyal</div>
          <div className="text-[11px] text-zinc-500">AI Document Assistant (P07)</div>
        </div>
      </div>
    </aside>
  );
}

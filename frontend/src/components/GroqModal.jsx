import React, { useState } from 'react';
import { X, Key, Zap, Eye, EyeOff, Check, ShieldCheck } from 'lucide-react';

export default function GroqModal({
  isOpen,
  onClose,
  groqKey,
  onSaveKey,
  serverConfigured,
}) {
  const [keyInput, setKeyInput] = useState(groqKey || '');
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveKey(keyInput.trim());
    onClose();
  };

  const handleClear = () => {
    setKeyInput('');
    onSaveKey('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Groq API LPU Inference</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Groq provides blazing-fast token inference for Llama 3 models. Enter your key to enable real-time LLM answers. If no key is entered, the assistant uses the local extractive RAG synthesizer with zero cloud dependencies.
        </p>

        {serverConfigured && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Server-side GROQ_API_KEY detected in .env environment.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Groq API Key (gsk_...)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-3 pr-9 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Stored only in your local browser session and passed securely via HTTP headers.
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline"
            >
              Clear Key
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


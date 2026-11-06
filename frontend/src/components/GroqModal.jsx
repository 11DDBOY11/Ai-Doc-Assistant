import React, { useState } from 'react';
import { X, Zap, Eye, EyeOff, ShieldCheck } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-zinc-900" />
            <h3 className="text-sm font-bold text-zinc-950">Groq API LPU Inference</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed">
          Groq provides high-speed token inference for Llama 3 models. Enter your key to enable real-time LLM answers. If no key is entered, the assistant uses the local extractive RAG synthesizer with zero cloud dependencies.
        </p>

        {serverConfigured && (
          <div className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-zinc-800" />
            <span className="font-medium">Server-side GROQ_API_KEY detected in environment.</span>
          </div>
        )}

        {keyInput.trim().startsWith('ghp_') && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs leading-relaxed">
            ⚠️ <strong>GitHub Token Detected:</strong> This key starts with <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">ghp_</code> (GitHub Personal Access Token). Groq API keys start with <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">gsk_</code>. You can generate a free Groq API key at{' '}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="underline font-bold text-amber-950"
            >
              console.groq.com/keys
            </a>.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-800 mb-1">
              Groq API Key (gsk_...)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 rounded-md pl-3 pr-9 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-700"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Stored only in your browser session and passed securely via HTTP headers.
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-zinc-600 hover:text-zinc-900 underline font-medium"
            >
              Clear Key
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-xs text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-md bg-zinc-950 hover:bg-black text-white text-xs font-semibold transition shadow-xs"
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

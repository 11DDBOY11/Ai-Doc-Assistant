import React from 'react';
import { Sliders, Shield, Target, Cpu } from 'lucide-react';

export default function SensitivitySettings({
  threshold,
  setThreshold,
  topK,
  setTopK,
  groqModel,
  setGroqModel,
}) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-zinc-900" /> Sensitivity & Evaluator Controls
          </h2>
          <p className="text-xs text-zinc-600">
            Tune confidence threshold cutoffs, Groq inference model, and context window size.
          </p>
        </div>

        <div className="space-y-5 pt-2">
          {/* Threshold Slider */}
          <div className="space-y-2 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-zinc-800" /> Verification Confidence Threshold
                </label>
                <p className="text-[11px] text-zinc-600">
                  Scores below this threshold trigger the deterministic anti-hallucination refusal.
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-white bg-zinc-950 px-2 py-0.5 rounded shadow-xs">
                {(threshold * 100).toFixed(0)}% ({threshold.toFixed(2)})
              </span>
            </div>

            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-zinc-950 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] font-mono text-zinc-500 font-medium">
              <span>0.05 (High Recall / Lenient)</span>
              <span>0.20 (Balanced / Recommended)</span>
              <span>0.80 (Strict Zero-Hallucination)</span>
            </div>
          </div>

          {/* Top-K Chunks */}
          <div className="space-y-2 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-800" /> Max Retrieved Context Chunks (Top-K)
                </label>
                <p className="text-[11px] text-zinc-600">
                  Number of highest-ranked hybrid chunks passed to the LLM or extractive synthesizer.
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-white bg-zinc-950 px-2 py-0.5 rounded shadow-xs">
                {topK} Chunks
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="w-full accent-zinc-950 cursor-pointer"
            />
          </div>

          {/* Groq Model Selector */}
          <div className="space-y-2 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center justify-between mb-1">
              <div>
                <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-800" /> Target Groq LPU Inference Model
                </label>
                <p className="text-[11px] text-zinc-600">
                  Select model for ultra-low latency grounded generation.
                </p>
              </div>
            </div>

            <select
              value={groqModel}
              onChange={(e) => setGroqModel(e.target.value)}
              className="w-full bg-white border border-zinc-300 rounded-md p-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 font-mono font-medium"
            >
              <option value="llama-3.3-70b-versatile">
                llama-3.3-70b-versatile (Recommended — High accuracy)
              </option>
              <option value="llama-3.1-8b-instant">
                llama-3.1-8b-instant (Fastest inference — sub-100ms)
              </option>
              <option value="mixtral-8x7b-32768">
                mixtral-8x7b-32768 (32K context window)
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

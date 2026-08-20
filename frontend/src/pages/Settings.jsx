import React, { useState } from "react";
import { Sliders, Cpu, Save, Database, ShieldAlert, Sparkles, Check } from "lucide-react";

export default function Settings() {
  const [model, setModel] = useState("cyber-rag-embeddings-v2");
  const [temperature, setTemperature] = useState(0.15);
  const [chunkSize, setChunkSize] = useState(512);
  const [overlap, setOverlap] = useState(64);
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            System Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure RAG pipeline, model embeddings, and matching heuristics weights.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-top">
        {/* Left main form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          
          {/* RAG Engine Parameters */}
          <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-6">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider pb-3 border-b border-slate-850/80 flex items-center gap-2">
              <Sliders size={15} className="text-rose-500" />
              Retrieval Augmented Generation (RAG) Parameters
            </h3>

            {/* Embedding Model selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Dense Vector Embedding Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-slate-750 transition"
              >
                <option value="cyber-rag-embeddings-v2">cyber-rag-embeddings-v2 (Optimized for cybersecurity vocabularies)</option>
                <option value="openai-ada-002">text-embedding-ada-002 (General Purpose OpenAI)</option>
                <option value="cohere-multilingual-v3">cohere-embed-multilingual-v3 (Multi-language Support)</option>
              </select>
              <span className="text-[10px] text-slate-500 block">
                Local model generating 768-dimension vectors, trained on threat playbooks.
              </span>
            </div>

            {/* Chunk Size / Overlap row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Chunk Character Size
                </label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-750 transition"
                />
                <span className="text-[10px] text-slate-500 block">Max token characters per chunk.</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Overlap Size
                </label>
                <input
                  type="number"
                  value={overlap}
                  onChange={(e) => setOverlap(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-750 transition"
                />
                <span className="text-[10px] text-slate-500 block">Contextual character overlaps.</span>
              </div>
            </div>

            {/* Model Temperature Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Model Generative Temperature
                </label>
                <span className="text-xs text-rose-400 font-mono font-bold">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-950 border border-slate-850 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <span className="text-[10px] text-slate-500 block">
                Lower values reduce hallucinations and force generation strictly grounded in playbooks.
              </span>
            </div>
          </div>

          {/* Source heuristic weights */}
          <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider pb-3 border-b border-slate-850/80 flex items-center gap-2">
              <Database size={15} className="text-rose-500" />
              Source Ranking Weights Heuristics
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs p-2 bg-slate-950/40 rounded-lg border border-slate-900">
                <span className="text-slate-350">Incident playbooks boost weight</span>
                <span className="font-mono text-emerald-400 font-bold">+1.8 (Highest priority)</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 bg-slate-950/40 rounded-lg border border-slate-900">
                <span className="text-slate-350">Vulnerability advisories match factor</span>
                <span className="font-mono text-cyan-400 font-bold">+1.2</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 bg-slate-950/40 rounded-lg border border-slate-900">
                <span className="text-slate-350">Threat intelligence feeds ranking</span>
                <span className="font-mono text-slate-400 font-bold">+0.8</span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3">
            {showSaved && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse-subtle">
                <Check size={14} />
                Parameters updated
              </span>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition shadow-[0_0_12px_rgba(225,29,72,0.15)] flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={14} />
              Save Configuration
            </button>
          </div>
        </form>

        {/* Right side info panel */}
        <div className="space-y-6">
          {/* Hardware statistics */}
          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider pb-3 border-b border-slate-850/80 flex items-center gap-2">
              <Cpu size={15} className="text-rose-500" />
              Ingestion Status
            </h3>

            <div className="space-y-3.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>CUDA GPU Memory</span>
                <span className="text-slate-200 font-mono">4.2 GB / 8.0 GB</span>
              </div>
              <div className="flex justify-between">
                <span>Vector Index Build</span>
                <span className="text-slate-200 font-mono">HNSW Flat L2</span>
              </div>
              <div className="flex justify-between">
                <span>RAG Guardrails</span>
                <span className="text-emerald-400 font-semibold">Active (NeMo Guardrails)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

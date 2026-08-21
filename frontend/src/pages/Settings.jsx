import React, { useState } from "react";
import { 
  Sliders, 
  Cpu, 
  Save, 
  Database, 
  ShieldAlert, 
  Sparkles, 
  Check, 
  Key, 
  Share2, 
  Layers, 
  Bot, 
  AlertCircle, 
  Info 
} from "lucide-react";

export default function Settings() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("cyber-rag-embeddings-v2");
  const [temperature, setTemperature] = useState(0.15);
  const [chunkSize, setChunkSize] = useState(512);
  const [overlap, setOverlap] = useState(64);
  const [topK, setTopK] = useState(4);
  const [slackWebhook, setSlackWebhook] = useState("https://hooks.slack.com/services/T00/B00/XXXX");
  const [pagerDutyKey, setPagerDutyKey] = useState("pd_live_secops_service_key_xxxx");
  const [teamsWebhook, setTeamsWebhook] = useState("");
  const [apiKey, setApiKey] = useState("sk-secops-rag-preview-mock-key-12345");
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              System Configuration
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 uppercase tracking-wider">
              Prototype Environment
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Preview pipeline configuration, ingestion settings, and future integrations.
          </p>
        </div>
      </div>

      {/* Prototype Advisory Notice Banner */}
      <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-3">
        <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-0.5">
          <span className="font-semibold text-slate-200">Advisory: Advanced Settings Preview</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            These configuration controls demonstrate future extensible capabilities (such as multi-model switching, live API keys, and notification webhooks). AlertIQ currently operates with verified local mock security playbooks.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-top">
        {/* Left main form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          
          {/* LLM Provider Selection (Future Release) */}
          <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850/80">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Bot size={15} className="text-rose-500" />
                LLM Inference Provider
              </h3>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wider">
                Future Release
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: "openai", name: "OpenAI GPT-4o", note: "Cloud API Inference" },
                { id: "anthropic", name: "Anthropic Claude 3.5", note: "Extended context window" },
                { id: "gemini", name: "Google Gemini 2.0", note: "Multimodal security reasoning" },
                { id: "ollama", name: "Local Ollama / Llama 3", note: "Air-gapped on-premise" }
              ].map((p) => (
                <label 
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                    provider === p.id 
                      ? "bg-rose-500/10 border-rose-500/40 text-slate-100" 
                      : "bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{p.name}</span>
                    <input 
                      type="radio" 
                      name="provider" 
                      checked={provider === p.id} 
                      onChange={() => setProvider(p.id)}
                      className="accent-rose-500" 
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">{p.note}</span>
                </label>
              ))}
            </div>

            {/* API Key Management */}
            <div className="space-y-1.5 pt-2 border-t border-slate-900">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Key size={12} className="text-slate-500" />
                  Provider API Key (Mock / Secure Vault)
                </label>
                <span className="text-[9px] text-slate-500 font-mono">Coming Soon</span>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-750 transition"
              />
              <span className="text-[10px] text-slate-500 block">
                Keys will be encrypted via KMS in future production deployments.
              </span>
            </div>
          </div>

          {/* RAG Engine Parameters */}
          <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850/80">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={15} className="text-rose-500" />
                RAG Pipeline Parameters
              </h3>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wider">
                Advanced Configuration — Future Release
              </span>
            </div>

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

            {/* Chunk Size / Overlap / Top-K row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Chunk Size
                </label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-750 transition"
                />
                <span className="text-[10px] text-slate-500 block">Tokens per chunk.</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Overlap
                </label>
                <input
                  type="number"
                  value={overlap}
                  onChange={(e) => setOverlap(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-750 transition"
                />
                <span className="text-[10px] text-slate-500 block">Overlap tokens.</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Top-K Retrieved
                </label>
                <input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-750 transition"
                />
                <span className="text-[10px] text-slate-500 block">Evidence chunks.</span>
              </div>
            </div>

            {/* Model Temperature Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Generative Temperature
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
                Lower values enforce grounded responses strictly constrained to retrieved documents.
              </span>
            </div>
          </div>

          {/* SOC Integrations (Slack, PagerDuty, Teams) */}
          <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850/80">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Share2 size={15} className="text-rose-500" />
                SOC Alerting & Webhooks
              </h3>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wider">
                Coming Soon
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold block">
                  Slack Incident Channel Webhook
                </label>
                <input
                  type="text"
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-750 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold block">
                  PagerDuty Routing Service Key
                </label>
                <input
                  type="text"
                  value={pagerDutyKey}
                  onChange={(e) => setPagerDutyKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-750 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold block">
                  Microsoft Teams Connector URL
                </label>
                <input
                  type="text"
                  placeholder="https://outlook.office.com/webhook/..."
                  value={teamsWebhook}
                  onChange={(e) => setTeamsWebhook(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-750 transition"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3">
            {showSaved && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse-subtle">
                <Check size={14} />
                Prototype preferences saved locally.
              </span>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition shadow-[0_0_12px_rgba(225,29,72,0.15)] flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={14} />
              Save Prototype Preferences
            </button>
          </div>
        </form>

        {/* Right side info panel */}
        <div className="space-y-6">
          {/* Hardware statistics */}
          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850/80">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Cpu size={15} className="text-rose-500" />
                Pipeline Runtime
              </h3>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                Simulated
              </span>
            </div>

            <div className="space-y-3.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Vector Index Build</span>
                <span className="text-slate-200 font-mono">HNSW Flat L2</span>
              </div>
              <div className="flex justify-between">
                <span>Embedding Dimensions</span>
                <span className="text-slate-200 font-mono">768 Dim</span>
              </div>
              <div className="flex justify-between">
                <span>Local RAG Guardrails</span>
                <span className="text-emerald-400 font-semibold">Enabled</span>
              </div>
            </div>
          </div>

          {/* Architecture Concept note */}
          <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-xl space-y-2">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
              Design Architecture Note
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              AlertIQ leverages Retrieval Augmented Generation (RAG) to ground all suggested mitigation steps against organizational runbooks. The analyst retains full authority over remediation decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

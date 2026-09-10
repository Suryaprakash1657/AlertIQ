import React, { useState, useEffect } from "react";
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
  Info,
  CheckCircle,
  Activity
} from "lucide-react";
import { healthService } from "../services/healthService.js";

export default function Settings() {
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-3.1-flash-lite");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-004");
  const [temperature, setTemperature] = useState(0.2);
  const [chunkSize, setChunkSize] = useState(500);
  const [overlap, setOverlap] = useState(50);
  const [topK, setTopK] = useState(5);
  const [slackWebhook, setSlackWebhook] = useState("https://hooks.slack.com/services/T00/B00/XXXX");
  const [pagerDutyKey, setPagerDutyKey] = useState("pd_live_secops_service_key_xxxx");
  const [teamsWebhook, setTeamsWebhook] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [healthInfo, setHealthInfo] = useState({ isOnline: true, uptime: null });

  useEffect(() => {
    let isMounted = true;
    healthService.checkHealth().then((res) => {
      if (isMounted && res.status === "ok") {
        setHealthInfo({ isOnline: true, uptime: res.uptime });
      }
    }).catch(() => {
      if (isMounted) {
        setHealthInfo({ isOnline: false, uptime: null });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
              healthInfo.isOnline 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}>
              {healthInfo.isOnline ? "Backend Connected" : "Backend Offline"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            System runtime parameters, AI model configuration, and alerting preferences.
          </p>
        </div>
      </div>

      {/* Advisory Notice Banner */}
      <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-3">
        <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-0.5">
          <span className="font-semibold text-slate-200">System Architecture Notice</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            AlertIQ is powered by Google Gemini generative models and PostgreSQL with pgvector embeddings. Server-level credentials (API keys and database connection strings) are securely managed on the backend and are never exposed to the client.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-top">
        {/* Left main form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          
          {/* LLM Provider Selection */}
          <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850/80">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Bot size={15} className="text-rose-500" />
                Active LLM Inference Engine
              </h3>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 uppercase tracking-wider">
                Active Provider
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: "gemini", name: "Google Gemini", note: "gemini-3.1-flash-lite (Active)" },
                { id: "openai", name: "OpenAI GPT-4o", note: "Future integration" },
                { id: "anthropic", name: "Anthropic Claude 3.5", note: "Future integration" },
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

            {/* Provider Model Configuration */}
            <div className="space-y-1.5 pt-2 border-t border-slate-900">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-rose-400" />
                  Inference Model
                </label>
                <span className="text-[9px] text-emerald-400 font-mono">Backend Configured</span>
              </div>
              <input
                type="text"
                value={model}
                disabled
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 opacity-80 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500 block">
                Primary model configured in backend environment for structured analysis and contextual follow-up reasoning.
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
                UI Tuning
              </span>
            </div>

            {/* Embedding Model selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Vector Embedding Model
              </label>
              <input
                type="text"
                value={embeddingModel}
                disabled
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-xs text-slate-200 font-mono opacity-80 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500 block">
                Generates 768-dimension dense vector embeddings indexed in PostgreSQL with pgvector cosine distance.
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
                <span className="text-[10px] text-slate-500 block">Characters per chunk.</span>
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
                <span className="text-[10px] text-slate-500 block">Overlap characters.</span>
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
                <span className="text-[10px] text-slate-500 block">Candidate vector chunks.</span>
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
                Preferences
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
                Client UI preferences saved locally.
              </span>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition shadow-[0_0_12px_rgba(225,29,72,0.15)] flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={14} />
              Save Client Preferences
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
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">
                PostgreSQL + pgvector
              </span>
            </div>

            <div className="space-y-3.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Vector Index Engine</span>
                <span className="text-slate-200 font-mono">pgvector Cosine</span>
              </div>
              <div className="flex justify-between">
                <span>Embedding Dimensions</span>
                <span className="text-slate-200 font-mono">768 Dim</span>
              </div>
              <div className="flex justify-between">
                <span>LLM Structured Outputs</span>
                <span className="text-emerald-400 font-semibold">Gemini Flash Schema</span>
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

import React from "react";
import { Database, ChevronRight, Info, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";

export default function SourceEvidence({ knowledgeContext, onViewSource }) {
  const status = knowledgeContext?.status || "disabled";
  const sources = Array.isArray(knowledgeContext?.sourcesUsed) ? knowledgeContext.sourcesUsed : [];
  const matchesFound = knowledgeContext?.matchesFound || sources.length;

  const getRelevanceStyle = (similarity) => {
    if (typeof similarity !== "number") {
      return "bg-slate-500/10 border-slate-500/30 text-slate-400";
    }
    if (similarity >= 0.75) {
      return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
    }
    if (similarity >= 0.60) {
      return "bg-amber-500/10 border-amber-500/30 text-amber-400";
    }
    return "bg-rose-500/10 border-rose-500/30 text-rose-400";
  };

  const formatSimilarity = (similarity) => {
    if (typeof similarity !== "number") return "Cited";
    return `${Math.round(similarity * 100)}% Relevance`;
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <Database size={16} className="text-slate-400" />
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Source Evidence
        </h3>
        <span className="text-[10px] text-slate-500 font-mono ml-auto">
          {sources.length} Cited Docs
        </span>
      </div>

      {/* RAG State Handlers */}
      {status === "no_match" && (
        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <Info size={14} />
            <span>No Direct Runbook Match</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            No indexed runbooks exceeded the similarity threshold for this specific payload. The analysis was generated using threat context and AI security reasoning.
          </p>
        </div>
      )}

      {status === "empty_kb" && (
        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-rose-400 font-semibold">
            <AlertTriangle size={14} />
            <span>Knowledge Base Empty</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            No incident response runbooks have been indexed yet. Upload organization playbooks in the Knowledge Base tab to ground future analyses.
          </p>
        </div>
      )}

      {status === "failed" && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2 text-xs text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={14} className="text-rose-400" />
            <span>Retrieval Fallback</span>
          </div>
          <p className="text-[11px] leading-relaxed text-rose-400/80">
            Knowledge retrieval encountered a temporary error. The AI engine generated a fallback analysis based on the raw alert telemetry.
          </p>
        </div>
      )}

      {status === "disabled" && (
        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-500">
          RAG knowledge retrieval was disabled for this analysis turn.
        </div>
      )}

      {/* Sources List */}
      <div className="space-y-3">
        {sources.map((source, idx) => (
          <div 
            key={source.documentId || idx} 
            className="glass-panel p-4 rounded-xl hover:border-slate-700 transition duration-200 flex flex-col justify-between gap-3.5 relative overflow-hidden"
          >
            {/* Card Meta */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded bg-slate-950 border border-slate-850 truncate max-w-[150px]">
                  {source.category || source.source || "Security Runbook"}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider uppercase ${getRelevanceStyle(source.similarity)}`}>
                  {formatSimilarity(source.similarity)}
                </span>
              </div>

              <h4 className="text-xs font-bold text-slate-200 mt-1 leading-snug">
                📄 {source.title}
              </h4>
            </div>

            {/* Source Origin */}
            <div className="p-2.5 bg-slate-950/40 border border-slate-850/80 rounded-lg flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Source: {source.source || "Internal Knowledge Base"}</span>
              <span className="text-rose-400 font-bold">Grounded</span>
            </div>

            {/* View Source Trigger */}
            <button
              onClick={() => onViewSource(source)}
              className="w-full py-1.5 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
            >
              View Source Details
              <ChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

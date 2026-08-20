import React from "react";
import { ShieldCheck, Info, CheckSquare, Sparkles } from "lucide-react";

export default function MitigationResult({ result }) {
  const getConfidenceStyle = (confidence) => {
    switch (confidence?.toLowerCase()) {
      case "high":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "medium":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "low":
        return "bg-rose-500/10 border-rose-500/30 text-rose-400";
      default:
        return "bg-slate-500/10 border-slate-500/30 text-slate-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Header Badge */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-rose-500/10 rounded text-rose-500">
            <Sparkles size={16} />
          </div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            AI-Retrieved Mitigation Advice
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-semibold">Confidence Rating:</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getConfidenceStyle(result.confidence)}`}>
            {result.confidence}
          </span>
        </div>
      </div>

      {/* Summary Box */}
      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg text-xs leading-relaxed text-slate-300 flex items-start gap-2.5">
        <Info size={16} className="text-rose-500 shrink-0 mt-0.5" />
        <p>{result.summary}</p>
      </div>

      {/* Recommended Steps */}
      <div className="space-y-3.5">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Recommended Actions
        </h4>
        <div className="space-y-3">
          {result.recommendedMitigations.map((step, idx) => (
            <div 
              key={idx} 
              className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl hover:border-slate-800 transition flex items-start gap-3.5"
            >
              <div className="w-5 h-5 rounded bg-slate-950 border border-slate-850 flex items-center justify-center text-rose-500 font-mono text-xs font-bold shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Demonstration Banner Warning */}
      <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-subtle shrink-0" />
        <span className="text-[10px] text-slate-400 font-mono">
          Prototype Notice: The above mitigation workflow has been parsed from mock security playbooks and is formatted for UI verification.
        </span>
      </div>
    </div>
  );
}

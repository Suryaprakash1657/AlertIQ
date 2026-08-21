import React, { useState } from "react";
import { Shield, Info, CheckSquare, Sparkles, Copy, Check, ShieldAlert } from "lucide-react";

export default function MitigationResult({ result }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

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

  const handleCopyGuidance = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
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
            AI Mitigation Analysis
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
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Retrieved Guidance Summary
          </span>
          <p>{result.summary}</p>
        </div>
      </div>

      {/* Recommended Guidance Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Recommended Guidance
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">
            Grounding: Knowledge Base Runbooks
          </span>
        </div>
        <div className="space-y-3">
          {result.recommendedMitigations.map((step, idx) => (
            <div 
              key={idx} 
              className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl hover:border-slate-800 transition flex items-start justify-between gap-3.5 group"
            >
              <div className="flex items-start gap-3.5 flex-1">
                <div className="w-5 h-5 rounded bg-slate-950 border border-slate-850 flex items-center justify-center text-rose-500 font-mono text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {step}
                </p>
              </div>

              {/* Copy Guidance Text for reference */}
              <button
                onClick={() => handleCopyGuidance(step, idx)}
                title="Copy guidance reference"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 shrink-0 cursor-pointer"
              >
                {copiedIndex === idx ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Mandatory Advisory Notice */}
      <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-start gap-2.5">
        <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs text-amber-200/90 font-medium">
            Verify all guidance against source evidence and organizational security procedures before taking action.
          </p>
          <p className="text-[10px] text-slate-400">
            AlertIQ is an advisory system. The human analyst makes the final operational decision.
          </p>
        </div>
      </div>
    </div>
  );
}

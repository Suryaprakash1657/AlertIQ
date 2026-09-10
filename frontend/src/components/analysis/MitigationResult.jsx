import React, { useState } from "react";
import { Sparkles, Copy, Check, ShieldAlert, AlertCircle, FileSearch, HelpCircle, ChevronDown, ChevronUp, Cpu, Database } from "lucide-react";

export default function MitigationResult({ result }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showCaveats, setShowCaveats] = useState(false);

  // Extract analysis payload safely
  const analysis = result.analysis || result;
  const riskAssessment = analysis.riskAssessment || { level: "MEDIUM", reasoning: "" };
  const recommendedActions = analysis.recommendedActions || analysis.recommendedMitigations || [];
  const keyIndicators = analysis.keyIndicators || [];
  const investigationSteps = analysis.investigationSteps || [];
  const assumptions = analysis.assumptions || [];
  const limitations = analysis.limitations || [];
  const persistence = result.persistence;
  const model = result.model;

  const getRiskStyle = (level) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
        return "bg-rose-500/15 border-rose-500/40 text-rose-400";
      case "HIGH":
        return "bg-orange-500/15 border-orange-500/40 text-orange-400";
      case "MEDIUM":
        return "bg-amber-500/15 border-amber-500/40 text-amber-400";
      case "LOW":
        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-400";
      default:
        return "bg-slate-500/15 border-slate-500/40 text-slate-400";
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
      {/* AI Header Badge & Risk Rating */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-500/10 rounded text-rose-500 border border-rose-500/20">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              AI Mitigation Analysis
            </h3>
            {model && (
              <span className="text-[10px] text-slate-500 font-mono">
                Engine: {model}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {persistence?.saved && persistence?.analysisId && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              Audit #{persistence.analysisId}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-semibold">Risk Assessment:</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getRiskStyle(riskAssessment.level)}`}>
              {riskAssessment.level}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg text-xs leading-relaxed text-slate-300 space-y-2">
        <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider text-[10px]">
          <AlertCircle size={14} />
          <span>Executive Threat Summary</span>
        </div>
        <p>{analysis.summary}</p>
        {riskAssessment.reasoning && (
          <div className="pt-2 border-t border-slate-900 text-slate-400 text-[11px] leading-relaxed">
            <strong className="text-slate-300 font-semibold">Risk Reasoning: </strong>
            {riskAssessment.reasoning}
          </div>
        )}
      </div>

      {/* Key Indicators (IOCs & Triggers) */}
      {keyIndicators.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileSearch size={13} className="text-rose-400" />
            Key Threat Indicators
          </h4>
          <div className="flex flex-wrap gap-2">
            {keyIndicators.map((indicator, idx) => (
              <span 
                key={idx} 
                className="px-2.5 py-1 rounded bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-mono"
              >
                {indicator}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Remediation Actions */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Recommended Remediation Actions
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">
            Grounding: Organization Knowledge Base
          </span>
        </div>
        <div className="space-y-3">
          {recommendedActions.map((step, idx) => (
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

              {/* Copy Guidance Text */}
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

      {/* Triage & Investigation Steps */}
      {investigationSteps.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Investigation & Validation Steps
          </h4>
          <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
            {investigationSteps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                <span className="text-rose-500 font-bold">•</span>
                <span className="leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible Assumptions & Limitations Disclosure */}
      {(assumptions.length > 0 || limitations.length > 0) && (
        <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/30">
          <button
            onClick={() => setShowCaveats(!showCaveats)}
            className="w-full p-3.5 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <span className="font-semibold flex items-center gap-1.5">
              <HelpCircle size={13} className="text-slate-500" />
              Model Assumptions & Analytical Constraints ({assumptions.length + limitations.length})
            </span>
            {showCaveats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showCaveats && (
            <div className="p-4 border-t border-slate-850 space-y-3 text-xs">
              {assumptions.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assumptions</span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                    {assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {limitations.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Limitations</span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                    {limitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

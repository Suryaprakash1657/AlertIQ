import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle } from "lucide-react";

export default function AnalysisLoader() {
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);

  const phases = [
    { label: "Analyzing alert context", sub: "Validating telemetry, target asset, and event payload..." },
    { label: "Searching security knowledge base", sub: "Querying indexed organization runbooks and playbooks..." },
    { label: "Retrieving & ranking evidence", sub: "Evaluating cosine similarity against threat vectors..." },
    { label: "Synthesizing mitigation guidance", sub: "Structuring risk assessment and remediation actions..." }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhaseIndex((prev) => (prev + 1) % phases.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [phases.length]);

  return (
    <div className="glass-panel p-8 rounded-xl flex flex-col items-center justify-center min-h-[420px] text-center border-dashed border-slate-800 animate-fade-in">
      <div className="relative mb-6">
        {/* Radar scanning effect */}
        <div className="absolute inset-0 rounded-full bg-rose-500/10 animate-ping" />
        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-rose-500 relative z-10">
          <Loader2 className="animate-spin" size={28} />
        </div>
      </div>

      <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider mb-1">
        Analyzing Alert Mitigation
      </h3>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        Retrieving evidence from organization knowledge base and generating grounded mitigation steps.
      </p>

      {/* Progress Animation Bar */}
      <div className="w-full max-w-md bg-slate-950 border border-slate-850 rounded-full h-2 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-rose-600 via-orange-500 to-rose-600 h-full w-full animate-pulse" />
      </div>

      {/* Step List Details */}
      <div className="w-full max-w-md text-left space-y-4">
        {phases.map((phase, idx) => {
          const isActive = idx === activePhaseIndex;
          const isDone = idx < activePhaseIndex;

          return (
            <div 
              key={idx} 
              className={`flex items-start gap-3 transition-all duration-300 ${
                isActive ? "opacity-100 scale-[1.01]" : isDone ? "opacity-75" : "opacity-35"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isDone ? (
                  <CheckCircle size={15} className="text-emerald-400" />
                ) : isActive ? (
                  <Loader2 size={15} className="text-rose-500 animate-spin" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-700 bg-slate-900" />
                )}
              </div>
              <div>
                <span className={`text-xs font-bold block ${
                  isActive ? "text-rose-400" : isDone ? "text-slate-300" : "text-slate-500"
                }`}>
                  {phase.label}
                </span>
                {isActive && (
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-medium leading-relaxed font-mono">
                    {phase.sub}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

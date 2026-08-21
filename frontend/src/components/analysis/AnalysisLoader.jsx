import React, { useState, useEffect } from "react";
import { Search, Loader2, Database, Shield, CheckCircle } from "lucide-react";

export default function AnalysisLoader({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    { label: "Analyzing alert context...", sub: "Extracting telemetry, target host roles, and event payload..." },
    { label: "Searching security knowledge base...", sub: "Querying indexed organization playbooks and SOPs..." },
    { label: "Retrieving relevant documents...", sub: "Gathering matching incident response documentation..." },
    { label: "Ranking relevant evidence...", sub: "Prioritizing verified runbook sections and references..." },
    { label: "Generating grounded mitigation guidance...", sub: "Compiling actionable guidance based on retrieved sources..." },
    { label: "Preparing source citations...", sub: "Linking specific runbook references and evidence items..." }
  ];

  useEffect(() => {
    // Step progression timer
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
          return prev;
        }
      });
    }, 850);

    // Progress bar smooth loader
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 100) {
          const increment = Math.floor(Math.random() * 5) + 2;
          return Math.min(prev + increment, 100);
        } else {
          clearInterval(progressInterval);
          return 100;
        }
      });
    }, 110);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  useEffect(() => {
    if (progress === 100 && currentStep === steps.length - 1) {
      const delay = setTimeout(() => {
        onComplete();
      }, 800);
      return () => clearTimeout(delay);
    }
  }, [progress, currentStep, onComplete]);

  return (
    <div className="glass-panel p-8 rounded-xl flex flex-col items-center justify-center min-h-[420px] text-center border-dashed border-slate-800">
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
        Retrieving evidence from organization knowledge bases to compile grounded steps.
      </p>

      {/* Progress Bar */}
      <div className="w-full max-w-md bg-slate-950 border border-slate-850 rounded-full h-2.5 overflow-hidden mb-8">
        <div 
          className="bg-gradient-to-r from-rose-600 to-orange-500 h-full transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step List Details */}
      <div className="w-full max-w-md text-left space-y-4">
        {steps.map((step, idx) => {
          const isPending = idx > currentStep;
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;

          return (
            <div 
              key={idx} 
              className={`flex items-start gap-3 transition-opacity duration-300 ${
                isPending ? "opacity-35" : "opacity-100"
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
                  {step.label}
                </span>
                {isActive && (
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-medium leading-relaxed font-mono">
                    {step.sub}
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

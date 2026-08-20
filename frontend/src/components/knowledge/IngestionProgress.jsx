import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle, Database } from "lucide-react";

export default function IngestionProgress({ onFinished }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    "Uploading document payload...",
    "Extracting document text layout...",
    "Cleaning content and removing noise...",
    "Creating document text chunks...",
    "Generating deep RAG embedding vectors...",
    "Indexing knowledge base vector store...",
    "Complete!"
  ];

  useEffect(() => {
    // Step progression
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
          return prev;
        }
      });
    }, 1000);

    // Progress bar smooth loader
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 100) {
          const increment = Math.floor(Math.random() * 12) + 4;
          return Math.min(prev + increment, 100);
        } else {
          clearInterval(progressInterval);
          return 100;
        }
      });
    }, 120);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-rose-500/10 animate-ping" />
        <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-rose-500 relative z-10">
          {currentStep === steps.length - 1 ? (
            <CheckCircle size={24} className="text-emerald-400" />
          ) : (
            <Loader2 className="animate-spin" size={24} />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
          Ingesting Document
        </h4>
        <p className="text-[10px] text-slate-400">
          Generating index segments for the AlertIQ RAG model.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 border border-slate-850 rounded-full h-2 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-rose-600 to-orange-500 h-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps List */}
      <div className="w-full text-left space-y-3 p-4 bg-slate-950/60 border border-slate-900 rounded-xl max-h-[160px] overflow-y-auto">
        {steps.map((step, idx) => {
          const isPending = idx > currentStep;
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;

          return (
            <div 
              key={idx} 
              className={`flex items-center gap-2.5 transition-all text-xs font-mono ${
                isPending ? "opacity-30" : "opacity-100"
              }`}
            >
              <span className="shrink-0">
                {isDone ? (
                  <span className="text-emerald-400">✓</span>
                ) : isActive ? (
                  <Loader2 size={10} className="text-rose-500 animate-spin" />
                ) : (
                  <span className="text-slate-600">·</span>
                )}
              </span>
              <span className={isActive ? "text-rose-400 font-semibold" : isDone ? "text-slate-400" : "text-slate-500"}>
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {currentStep === steps.length - 1 && (
        <button
          onClick={onFinished}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-[0_0_12px_rgba(16,185,129,0.15)] cursor-pointer"
        >
          Finish & Return
        </button>
      )}
    </div>
  );
}

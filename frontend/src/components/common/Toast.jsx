import React, { useEffect } from "react";
import { CheckCircle, AlertTriangle, X, Info } from "lucide-react";

export default function Toast({ message, type = "success", onClose, duration = 3500 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isSuccess = type === "success";
  const isError = type === "error";

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in max-w-sm">
      <div className={`p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-3 ${
        isSuccess
          ? "bg-slate-900/95 border-emerald-500/30 text-emerald-300 shadow-emerald-950/40"
          : isError
          ? "bg-slate-900/95 border-rose-500/30 text-rose-300 shadow-rose-950/40"
          : "bg-slate-900/95 border-cyan-500/30 text-cyan-300 shadow-cyan-950/40"
      }`}>
        <div className="shrink-0 mt-0.5">
          {isSuccess ? (
            <CheckCircle size={16} className="text-emerald-400" />
          ) : isError ? (
            <AlertTriangle size={16} className="text-rose-400" />
          ) : (
            <Info size={16} className="text-cyan-400" />
          )}
        </div>

        <div className="flex-1 text-xs font-medium leading-snug">
          {message}
        </div>

        <button
          onClick={onClose}
          className="shrink-0 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

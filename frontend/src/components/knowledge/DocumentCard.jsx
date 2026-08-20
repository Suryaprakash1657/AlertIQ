import React from "react";
import { FileText, Calendar, Database, Clock, RefreshCw, Eye } from "lucide-react";

export default function DocumentCard({ document, onPreview }) {
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "indexed":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "processing":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse-subtle";
      case "failed":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      default:
        return "bg-slate-500/10 border-slate-500/30 text-slate-400";
    }
  };

  return (
    <div className="glass-panel p-5 rounded-xl hover:border-slate-700 transition-all duration-200 flex flex-col justify-between h-full relative overflow-hidden group">
      {/* Top Banner Category & Status */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-850/80 mb-3">
        <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded bg-slate-950 border border-slate-850">
          {document.type}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide flex items-center gap-1 ${getStatusBadge(document.status)}`}>
          {document.status === "Processing" && <RefreshCw size={8} className="animate-spin" />}
          {document.status}
        </span>
      </div>

      {/* Main Details */}
      <div className="flex-1 space-y-2">
        <h4 className="text-xs font-bold text-slate-200 group-hover:text-rose-400 transition leading-snug">
          {document.title}
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
          {document.description}
        </p>
      </div>

      {/* Footer Metrics */}
      <div className="mt-4 pt-3 border-t border-slate-850/80 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <Database size={11} />
            {document.chunks} Chunks
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {document.lastUpdated}
          </span>
        </div>
        
        {document.status === "Indexed" && (
          <button
            onClick={() => onPreview(document)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition cursor-pointer"
            title="Preview Document Content"
          >
            <Eye size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

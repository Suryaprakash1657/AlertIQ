import React from "react";
import { X, FileText, Calendar, Database, Shield } from "lucide-react";

export default function SourceModal({ isOpen, document, onClose }) {
  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        className="glass-panel w-full max-w-2xl rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-rose-500">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Source Document Viewer
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Reference chunk details indexed in organization knowledge base.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Info Stats */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Document Title</span>
            <span className="text-slate-200 font-semibold block mt-0.5 truncate">{document.title}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Source Category</span>
            <span className="text-slate-200 font-medium block mt-0.5">{document.type}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Database Status</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              {document.status || "Indexed"}
            </span>
          </div>
        </div>

        {/* Document Content Area */}
        <div className="p-6 overflow-y-auto bg-slate-950/20 flex-1">
          <div className="space-y-4">
            {/* Section Tag */}
            {document.section && (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded uppercase tracking-wider">
                Matching Segment: {document.section}
              </div>
            )}

            {/* Ingestion Meta */}
            <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Database size={11} />
                Chunks: {document.chunks || 24}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                Updated: {document.lastUpdated}
              </span>
            </div>

            {/* Document Content Pre-Formatted Text */}
            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl">
              <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {document.content}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}

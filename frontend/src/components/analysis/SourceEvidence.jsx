import React from "react";
import { BookOpen, FileText, Database, ShieldAlert, ChevronRight } from "lucide-react";
import { mockDocuments } from "../../data/mockDocuments";

export default function SourceEvidence({ sourceIds, onViewSource }) {
  // Resolve source details
  const resolvedSources = sourceIds.map((id) => {
    const doc = mockDocuments.find((d) => d.id === id);
    if (!doc) return null;

    // Attach mock sections and relevance based on ID to match requirements
    let section = "General Reference";
    let relevance = "Medium";

    if (id === "DOC-001") {
      section = "Containment Procedure";
      relevance = "High";
    } else if (id === "DOC-002") {
      section = "Recommended Response";
      relevance = "High";
    } else if (id === "DOC-003") {
      section = "Investigation and Escalation";
      relevance = "Medium";
    } else if (id === "DOC-004") {
      section = "Hotfix Mitigation";
      relevance = "High";
    } else if (id === "DOC-05") {
      section = "Authentication Attacks";
      relevance = "High";
    } else if (id === "DOC-005") {
      section = "Authentication Attacks";
      relevance = "High";
    }

    return { ...doc, section, relevance };
  }).filter(Boolean);

  const getRelevanceStyle = (rel) => {
    return rel?.toLowerCase() === "high"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      : "bg-amber-500/10 border-amber-500/30 text-amber-400";
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
          {resolvedSources.length} Cited Docs
        </span>
      </div>

      {/* Source Cards List */}
      <div className="space-y-3">
        {resolvedSources.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            No source documents retrieved.
          </div>
        ) : (
          resolvedSources.map((source) => (
            <div 
              key={source.id} 
              className="glass-panel p-4 rounded-xl hover:border-slate-700 transition duration-200 flex flex-col justify-between gap-3.5 relative overflow-hidden"
            >
              {/* Card Meta */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded bg-slate-950 border border-slate-850">
                    {source.type}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider uppercase ${getRelevanceStyle(source.relevance)}`}>
                    Relevance: {source.relevance}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-200 mt-1 leading-snug">
                  📄 {source.title}
                </h4>
              </div>

              {/* Section Details */}
              <div className="p-2.5 bg-slate-950/40 border border-slate-850/80 rounded-lg">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">
                  Matched Section
                </span>
                <span className="text-xs text-rose-400 font-medium block mt-0.5">
                  {source.section}
                </span>
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
          ))
        )}
      </div>
    </div>
  );
}

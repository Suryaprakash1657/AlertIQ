import React from "react";
import { ShieldAlert, FileSearch, PlusCircle, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function LowConfidenceState() {
  return (
    <div className="glass-panel p-8 rounded-xl border border-dashed border-rose-500/20 bg-rose-500/[0.01] flex flex-col items-center text-center space-y-6">
      {/* Alert Warning Circle */}
      <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
        <ShieldAlert size={26} />
      </div>

      {/* Main warning text */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
          Mitigation Advisory Refusal
        </h3>
        <p className="text-xs text-rose-400 font-semibold">
          Unable to provide a reliable mitigation recommendation.
        </p>
        <p className="text-xs text-slate-400 max-w-md leading-relaxed mx-auto">
          The indexed knowledge base does not contain enough relevant evidence for this specific threat payload. To avoid generating hallucinations, the RAG model has suspended response generation.
        </p>
      </div>

      {/* Suggested Manual Actions */}
      <div className="w-full max-w-md text-left p-5 bg-slate-950/60 border border-slate-900 rounded-xl space-y-3.5">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle size={14} className="text-rose-500" />
          Recommended Next Steps
        </h4>
        
        <ul className="space-y-2 text-xs text-slate-300">
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
            <span>
              <strong>Review the alert manually:</strong> Inspect execution payloads, registry values, or network connections directly on the host console.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
            <span>
              <strong>Search the index manually:</strong> Go to the Knowledge Base page to search if matching documentation exists but wasn't prioritized.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
            <span>
              <strong>Upload incident playbooks:</strong> Add relevant incident runbooks or intelligence advisories to improve AlertIQ's retrieval capacity.
            </span>
          </li>
        </ul>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/knowledge"
          className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-750 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
        >
          <PlusCircle size={14} />
          Add Documentation
        </Link>
        
        <a
          href="https://nvd.nist.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg flex items-center gap-1.5 transition"
        >
          Search NVD Database
          <FileSearch size={14} />
        </a>
      </div>
    </div>
  );
}

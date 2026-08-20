import React from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, Clock, Terminal, ChevronRight } from "lucide-react";
import SeverityBadge from "../components/alerts/SeverityBadge";

export default function History({ history }) {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "low confidence":
        return "bg-rose-500/10 border-rose-500/30 text-rose-400";
      default:
        return "bg-slate-500/10 border-slate-500/30 text-slate-400";
    }
  };

  const getConfidenceColor = (conf) => {
    if (conf?.toLowerCase().includes("high")) {
      return "text-emerald-400";
    }
    if (conf?.toLowerCase().includes("medium")) {
      return "text-amber-400";
    }
    return "text-rose-400";
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Analysis History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit logs of previous alert mitigation searches and confidence diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <Clock size={14} className="text-slate-500" />
          <span>Total runs logged: <strong className="text-slate-200">{history.length}</strong></span>
        </div>
      </div>

      {/* Main Logs Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="p-4 pl-6">Alert Name</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Process Status</th>
                <th className="p-4">Sources Retrieved</th>
                <th className="p-4">Confidence Level</th>
                <th className="p-4">Analyzed At</th>
                <th className="p-4 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-500">
                    No run logs indexed. Try running a mitigation analysis on an active alert.
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr 
                    key={entry.id}
                    className="hover:bg-slate-850/20 transition duration-150 group"
                  >
                    {/* Alert Title */}
                    <td className="p-4 pl-6 font-bold text-slate-200 group-hover:text-rose-400 transition">
                      {entry.alertTitle}
                    </td>

                    {/* Severity */}
                    <td className="p-4 whitespace-nowrap">
                      <SeverityBadge severity={entry.severity} />
                    </td>

                    {/* Status */}
                    <td className="p-4 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getStatusColor(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>

                    {/* Sources Retrieved */}
                    <td className="p-4 whitespace-nowrap text-slate-350">
                      {entry.sourcesRetrieved}
                    </td>

                    {/* Confidence */}
                    <td className={`p-4 whitespace-nowrap font-semibold ${getConfidenceColor(entry.confidence)}`}>
                      {entry.confidence}
                    </td>

                    {/* Analyzed At */}
                    <td className="p-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {entry.analyzedAt}
                    </td>

                    {/* Action */}
                    <td className="p-4 pr-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/analysis/${entry.alertId}`)}
                        className="px-3.5 py-1.5 text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-850 hover:border-slate-700 rounded-lg transition-all flex items-center justify-center gap-1 ml-auto cursor-pointer"
                      >
                        View Analysis
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

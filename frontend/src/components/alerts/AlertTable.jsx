import React from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, Terminal, Eye, ExternalLink } from "lucide-react";
import SeverityBadge from "./SeverityBadge";

export default function AlertTable({ alerts }) {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "new":
        return "bg-sky-500/10 border-sky-500/30 text-sky-400";
      case "in progress":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "resolved":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      default:
        return "bg-slate-500/10 border-slate-500/30 text-slate-400";
    }
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <th className="p-4 pl-6">Severity</th>
              <th className="p-4">Alert ID</th>
              <th className="p-4">Threat Title & Description</th>
              <th className="p-4">Asset</th>
              <th className="p-4">Source</th>
              <th className="p-4">Time Detected</th>
              <th className="p-4">Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {alerts.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-12 text-center text-slate-500 text-sm">
                  No active security alerts match your filter criteria.
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr 
                  key={alert.id} 
                  className="hover:bg-slate-850/20 transition duration-150 group align-top"
                >
                  {/* Severity */}
                  <td className="p-4 pl-6 whitespace-nowrap">
                    <SeverityBadge severity={alert.severity} />
                  </td>

                  {/* Alert ID */}
                  <td className="p-4 whitespace-nowrap">
                    <span className="font-mono text-xs text-slate-400 group-hover:text-slate-200 transition">
                      {alert.id}
                    </span>
                  </td>

                  {/* Title & Description */}
                  <td className="p-4 max-w-sm lg:max-w-md">
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-rose-400 transition leading-snug">
                      {alert.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {alert.description}
                    </p>
                  </td>

                  {/* Asset */}
                  <td className="p-4 whitespace-nowrap font-mono text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800/80">
                      <Cpu size={12} className="text-slate-500" />
                      {alert.affectedAsset}
                    </span>
                  </td>

                  {/* Source */}
                  <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                    {alert.source}
                  </td>

                  {/* Time */}
                  <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                    {alert.detectedTime}
                  </td>

                  {/* Status */}
                  <td className="p-4 whitespace-nowrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getStatusColor(alert.status)}`}>
                      {alert.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="p-4 pr-6 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      {/* Secondary View Details */}
                      <button 
                        onClick={() => navigate(`/analysis/${alert.id}`)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-700 transition cursor-pointer"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>

                      {/* Primary Analyze Mitigation */}
                      <button
                        onClick={() => navigate(`/analysis/${alert.id}`)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all duration-200 shadow-[0_0_12px_rgba(225,29,72,0.15)] hover:shadow-[0_0_18px_rgba(225,29,72,0.35)] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Terminal size={12} />
                        Analyze Mitigation
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

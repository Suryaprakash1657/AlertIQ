import React from "react";
import { useNavigate } from "react-router-dom";
import { Terminal, ShieldAlert, Cpu } from "lucide-react";
import SeverityBadge from "../alerts/SeverityBadge";

export default function RecentAlerts({ alerts }) {
  const navigate = useNavigate();

  // Get status color
  const getStatusStyle = (status) => {
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
    <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-rose-500" size={18} />
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Recent Active Threats
          </h3>
        </div>
        <span className="text-[10px] text-slate-500 font-semibold bg-slate-950 px-2 py-0.5 border border-slate-800 rounded">
          Real-time Feed
        </span>
      </div>

      <div className="divide-y divide-slate-800/80 overflow-y-auto flex-1">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No active alerts detected.
          </div>
        ) : (
          alerts.map((alert) => (
            <div 
              key={alert.id} 
              className="p-5 hover:bg-slate-850/30 transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              {/* Alert Meta and Title */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <SeverityBadge severity={alert.severity} />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getStatusStyle(alert.status)}`}>
                    {alert.status}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ID: {alert.id}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    {alert.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl line-clamp-1">
                    {alert.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-[11px]">
                  <span className="flex items-center gap-1 font-mono text-slate-400">
                    <Cpu size={12} className="text-slate-500" />
                    {alert.affectedAsset}
                  </span>
                  <span>•</span>
                  <span>Source: <strong className="text-slate-400 font-normal">{alert.source}</strong></span>
                  <span>•</span>
                  <span>{alert.detectedTime}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0 flex items-center">
                <button
                  onClick={() => navigate(`/analysis/${alert.id}`)}
                  className="w-full lg:w-auto px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all duration-250 shadow-[0_0_12px_rgba(225,29,72,0.15)] hover:shadow-[0_0_18px_rgba(225,29,72,0.3)] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Terminal size={14} />
                  Analyze Mitigation
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

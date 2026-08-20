import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cpu, Activity, Clock, ShieldCheck, Tag } from "lucide-react";
import SeverityBadge from "../alerts/SeverityBadge";

export default function AlertDetails({ alert }) {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "new":
        return "bg-sky-500/15 border-sky-500/40 text-sky-400";
      case "in progress":
        return "bg-amber-500/15 border-amber-500/40 text-amber-400";
      case "resolved":
        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-400";
      default:
        return "bg-slate-500/15 border-slate-500/40 text-slate-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Back navigation and ID title */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/alerts")}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to Alerts
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">Triage Workspace</span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse-subtle" />
        </div>
      </div>

      {/* Main Metadata Panel */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800 relative overflow-hidden">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-2xl rounded-full" />
        
        <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded border border-rose-500/20">
                {alert.id}
              </span>
              <SeverityBadge severity={alert.severity} />
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getStatusColor(alert.status)}`}>
                {alert.status}
              </span>
            </div>
            
            <h1 className="text-xl lg:text-2xl font-bold text-slate-100 tracking-tight">
              {alert.title}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-4xl">
              {alert.description}
            </p>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800/80">
          {/* Affected Asset */}
          <div className="flex items-start gap-2.5">
            <Cpu size={16} className="text-slate-500 mt-0.5" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Affected Asset
              </span>
              <span className="text-xs text-slate-200 font-mono font-medium block mt-0.5">
                {alert.affectedAsset}
              </span>
            </div>
          </div>

          {/* Telemetry Source */}
          <div className="flex items-start gap-2.5">
            <Activity size={16} className="text-slate-500 mt-0.5" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Telemetry Source
              </span>
              <span className="text-xs text-slate-200 block mt-0.5">
                {alert.source}
              </span>
            </div>
          </div>

          {/* Time Detected */}
          <div className="flex items-start gap-2.5">
            <Clock size={16} className="text-slate-500 mt-0.5" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Time Detected
              </span>
              <span className="text-xs text-slate-200 block mt-0.5">
                {alert.detectedTime}
              </span>
            </div>
          </div>

          {/* Verification Level */}
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-slate-500 mt-0.5" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Verification State
              </span>
              <span className="text-xs text-emerald-400 block mt-0.5 font-semibold">
                Forwarded from Monitoring
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

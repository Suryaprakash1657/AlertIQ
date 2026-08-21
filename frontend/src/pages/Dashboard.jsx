import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  ShieldAlert, 
  Activity, 
  FileText, 
  Database, 
  CheckCircle, 
  Clock, 
  ChevronRight 
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RecentAlerts from "../components/dashboard/RecentAlerts";

export default function Dashboard({ alerts, documents, history }) {
  const navigate = useNavigate();

  // Compute metrics dynamically
  const activeAlertsCount = alerts.filter(a => a.status !== "Resolved").length;
  const criticalHighCount = alerts.filter(
    a => (a.severity === "CRITICAL" || a.severity === "HIGH") && a.status !== "Resolved"
  ).length;
  
  const indexedDocsCount = documents.filter(d => d.status === "Indexed").length;
  
  // Total analyses count
  const totalAnalysesCount = 18 + history.filter(h => h.sessionAdded).length;

  return (
    <div className="space-y-6">
      {/* Overview Intro */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Security Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor active security alerts and quickly retrieve relevant mitigation guidance.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <Clock size={14} className="text-slate-500 animate-pulse-subtle" />
          Last sync: <span className="text-slate-200 font-mono">Just Now</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Alerts"
          value={activeAlertsCount}
          subtext="Unresolved threats in queue"
          icon={AlertTriangle}
          colorClass="text-rose-500"
          bgClass="bg-rose-500/10 border-rose-500/25"
        />
        <StatCard
          title="Critical / High"
          value={criticalHighCount}
          subtext="Severities requiring hotfix"
          icon={ShieldAlert}
          colorClass="text-orange-500"
          bgClass="bg-orange-500/10 border-orange-500/25"
        />
        <StatCard
          title="Analyzed Today"
          value={totalAnalysesCount}
          subtext="Mitigations fetched from DB"
          icon={Activity}
          colorClass="text-emerald-500"
          bgClass="bg-emerald-500/10 border-emerald-500/25"
        />
        <StatCard
          title="Knowledge Documents"
          value={indexedDocsCount}
          subtext="Indexed incident playbooks"
          icon={FileText}
          colorClass="text-cyan-500"
          bgClass="bg-cyan-500/10 border-cyan-500/25"
        />
      </div>

      {/* Main dashboard body splitting Recent Feed and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (Recent Active Alerts) */}
        <div className="lg:col-span-2">
          {/* Show top 5 alerts */}
          <RecentAlerts alerts={alerts.slice(0, 5)} />
        </div>

        {/* Right column (System status & Activity) */}
        <div className="space-y-6">
          {/* System Ready indicator panel */}
          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850/80">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Pipeline Health
              </h3>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 uppercase tracking-wider">
                Simulated Status
              </span>
            </div>

            <div className="space-y-4">
              {/* Ready Indicator */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">RAG Server Connection</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse-subtle" />
                  System Ready
                </span>
              </div>

              {/* Latency */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Average RAG Latency</span>
                <span className="text-slate-200 font-mono font-medium">1.24s</span>
              </div>

              {/* Embeddings Count */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Vector Embeddings Size</span>
                <span className="text-slate-200 font-mono font-medium">
                  {documents.reduce((acc, doc) => acc + (doc.chunks || 0), 0)} vectors
                </span>
              </div>

              {/* KB Status */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Knowledge base status</span>
                <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                  <Database size={12} />
                  Fully Synchronized
                </span>
              </div>
            </div>
            
            <button
              onClick={() => navigate("/alerts")}
              className="w-full mt-2 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-slate-100 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
            >
              View All Alerts
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Recent Audits list */}
          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider pb-3 border-b border-slate-850/80">
              Recent Ingestion Audits
            </h3>
            
            <div className="space-y-3.5">
              {history.slice(0, 3).map((item) => (
                <div key={item.id} className="text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-200 truncate max-w-[150px]">
                      {item.alertTitle}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                      item.confidence === "High" || item.confidence === "High confidence"
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                        : item.confidence === "Medium" || item.confidence === "Medium confidence"
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                        : "bg-rose-500/10 border-rose-500/25 text-rose-400"
                    }`}>
                      {item.confidence.split(" ")[0]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>{item.sourcesRetrieved}</span>
                    <span>{item.analyzedAt.split(",")[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

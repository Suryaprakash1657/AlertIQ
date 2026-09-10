import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  ShieldAlert, 
  Activity, 
  FileText, 
  Database, 
  CheckCircle, 
  Clock, 
  ChevronRight,
  Loader2,
  RefreshCw,
  Archive
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RecentAlerts from "../components/dashboard/RecentAlerts";
import { knowledgeService } from "../services/knowledgeService.js";
import { historyService } from "../services/historyService.js";
import { healthService } from "../services/healthService.js";

export default function Dashboard({ alerts = [] }) {
  const navigate = useNavigate();

  // Backend state
  const [docsCount, setDocsCount] = useState(null);
  const [historyTotal, setHistoryTotal] = useState(null);
  const [recentHistory, setRecentHistory] = useState([]);
  const [isHealthOnline, setIsHealthOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Compute active queue metrics from incoming SIEM alerts
  const activeAlertsCount = alerts.filter(a => a.status !== "Resolved").length;
  const criticalHighCount = alerts.filter(
    a => (a.severity === "CRITICAL" || a.severity === "HIGH") && a.status !== "Resolved"
  ).length;

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const [docsRes, historyRes, healthRes] = await Promise.allSettled([
        knowledgeService.getDocuments(),
        historyService.getHistory({ limit: 4 }),
        healthService.checkHealth()
      ]);

      if (docsRes.status === "fulfilled" && docsRes.value?.data) {
        setDocsCount(docsRes.value.data.length);
      } else {
        setDocsCount(0);
      }

      if (historyRes.status === "fulfilled" && historyRes.value) {
        setHistoryTotal(historyRes.value.pagination?.total ?? (historyRes.value.data?.length || 0));
        setRecentHistory(historyRes.value.data || []);
      } else {
        setHistoryTotal(0);
        setRecentHistory([]);
      }

      if (healthRes.status === "fulfilled" && healthRes.value?.status === "ok") {
        setIsHealthOnline(true);
      } else {
        setIsHealthOnline(false);
      }
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getRiskBadge = (level) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
        return "bg-rose-500/10 border-rose-500/25 text-rose-400";
      case "HIGH":
        return "bg-orange-500/10 border-orange-500/25 text-orange-400";
      case "MEDIUM":
        return "bg-amber-500/10 border-amber-500/25 text-amber-400";
      case "LOW":
        return "bg-emerald-500/10 border-emerald-500/25 text-emerald-400";
      default:
        return "bg-slate-500/10 border-slate-500/25 text-slate-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Intro */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Security Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor active security alerts and retrieve grounded mitigation guidance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
            title="Refresh dashboard metrics"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <Clock size={14} className="text-slate-500 animate-pulse-subtle" />
            Last sync: <span className="text-slate-200 font-mono">Real-time</span>
          </div>
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
          title="Persisted Analyses"
          value={isLoading && historyTotal === null ? "..." : (historyTotal ?? 0)}
          subtext="Audited AI mitigations in DB"
          icon={Activity}
          colorClass="text-emerald-500"
          bgClass="bg-emerald-500/10 border-emerald-500/25"
        />
        <StatCard
          title="Knowledge Documents"
          value={isLoading && docsCount === null ? "..." : (docsCount ?? 0)}
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
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                isHealthOnline 
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/25 text-rose-400"
              }`}>
                {isHealthOnline ? "Live Operational" : "Degraded"}
              </span>
            </div>

            <div className="space-y-4">
              {/* Ready Indicator */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">RAG Server Connection</span>
                <span className={`font-bold flex items-center gap-1.5 ${isHealthOnline ? "text-emerald-400" : "text-rose-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isHealthOnline ? "bg-emerald-500 animate-pulse-subtle" : "bg-rose-500"}`} />
                  {isHealthOnline ? "System Ready" : "Unavailable"}
                </span>
              </div>

              {/* Vector Storage */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Vector Storage</span>
                <span className="text-slate-200 font-mono font-medium">PostgreSQL + pgvector</span>
              </div>

              {/* Total Documents */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Indexed Playbooks</span>
                <span className="text-slate-200 font-mono font-medium">
                  {docsCount !== null ? `${docsCount} documents` : "Loading..."}
                </span>
              </div>

              {/* KB Status */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Knowledge base status</span>
                <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                  <Database size={12} />
                  {docsCount && docsCount > 0 ? "Vector Synced" : "Ready"}
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
            <div className="flex items-center justify-between pb-3 border-b border-slate-850/80">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Archive size={13} className="text-rose-500" />
                Recent Analysis Logs
              </h3>
              <button
                onClick={() => navigate("/history")}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                View All ({historyTotal ?? 0})
              </button>
            </div>
            
            <div className="space-y-3.5">
              {isLoading && recentHistory.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin text-rose-500" />
                  <span>Loading recent logs...</span>
                </div>
              ) : recentHistory.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No persisted analyses recorded yet.
                </div>
              ) : (
                recentHistory.map((item) => (
                  <div 
                    key={item.analysisId} 
                    onClick={() => navigate(`/analysis/history/${item.analysisId}`)}
                    className="text-xs space-y-1 p-2 rounded-lg hover:bg-slate-850/40 transition cursor-pointer group"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200 group-hover:text-rose-400 transition truncate max-w-[150px]">
                        {item.title || "Security Incident"}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${getRiskBadge(item.riskLevel)}`}>
                        {item.riskLevel || "MEDIUM"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span>{item.sourcesUsedCount || 0} sources cited</span>
                      <span>
                        {item.createdAt 
                          ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "Recently"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Search, Filter, RefreshCw } from "lucide-react";

export default function AlertFilters({
  search,
  setSearch,
  severity,
  setSeverity,
  status,
  setStatus,
  source,
  setSource,
  onReset
}) {
  const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const statuses = ["New", "In Progress", "Resolved"];
  const sources = [
    "Endpoint Detection System",
    "Security Monitoring Platform",
    "Identity Monitoring System",
    "Vulnerability Scanner",
    "Network Traffic Monitor",
    "Threat Intelligence Hub"
  ];

  return (
    <div className="glass-panel p-5 rounded-xl space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts by title, description, or asset ID..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 transition"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={onReset}
            className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-850 hover:bg-slate-850/50 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            title="Reset Filters"
          >
            <RefreshCw size={13} />
            Reset
          </button>
        </div>
      </div>

      {/* Selectors Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Severity */}
        <div>
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
            Severity Filter
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-700 transition"
          >
            <option value="">All Severities</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
            Investigation Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-700 transition"
          >
            <option value="">All Statuses</option>
            {statuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Source */}
        <div>
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
            Telemetry Source
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-700 transition"
          >
            <option value="">All Sources</option>
            {sources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

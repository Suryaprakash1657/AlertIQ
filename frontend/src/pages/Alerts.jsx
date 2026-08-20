import React, { useState } from "react";
import AlertFilters from "../components/alerts/AlertFilters";
import AlertTable from "../components/alerts/AlertTable";
import { ShieldAlert, Info } from "lucide-react";

export default function Alerts({ alerts }) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");

  const handleReset = () => {
    setSearch("");
    setSeverity("");
    setStatus("");
    setSource("");
  };

  // Filter alerts based on criteria
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch = 
      alert.title.toLowerCase().includes(search.toLowerCase()) ||
      alert.description.toLowerCase().includes(search.toLowerCase()) ||
      alert.affectedAsset.toLowerCase().includes(search.toLowerCase()) ||
      alert.id.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity = severity ? alert.severity === severity : true;
    const matchesStatus = status ? alert.status === status : true;
    const matchesSource = source ? alert.source === source : true;

    return matchesSearch && matchesSeverity && matchesStatus && matchesSource;
  });

  return (
    <div className="space-y-6">
      {/* Page Title Intro */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Active Alerts
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Security alerts available for investigation and mitigation analysis.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse-subtle" />
          <span>Queue Status: <strong className="text-slate-200 font-bold">{filteredAlerts.length} Unresolved</strong></span>
        </div>
      </div>

      {/* Warning Box explaining SIEM workflow */}
      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3">
        <Info size={16} className="text-rose-500 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-slate-400">
          <strong className="text-slate-200">RAG Integration Framework:</strong> AlertIQ operates downstream from your detection stack (SIEM, EDR, IDS). The alerts displayed below represent active incidents fetched from mock detection APIs. Click <strong className="text-slate-200">Analyze Mitigation</strong> to query the indexed security documentation vectors for grounded remediation.
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <AlertFilters
        search={search}
        setSearch={setSearch}
        severity={severity}
        setSeverity={setSeverity}
        status={status}
        setStatus={setStatus}
        source={source}
        setSource={setSource}
        onReset={handleReset}
      />

      {/* Main List Table */}
      <AlertTable alerts={filteredAlerts} />
    </div>
  );
}

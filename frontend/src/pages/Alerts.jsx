import React, { useState } from "react";
import AlertFilters from "../components/alerts/AlertFilters";
import AlertTable from "../components/alerts/AlertTable";
import AddAlertModal from "../components/alerts/AddAlertModal";
import Toast from "../components/common/Toast";
import { Info, Plus } from "lucide-react";

export default function Alerts({ alerts = [], onAddAlert }) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const handleReset = () => {
    setSearch("");
    setSeverity("");
    setStatus("");
    setSource("");
  };

  const handleCreateAlert = (newAlert) => {
    if (onAddAlert) {
      onAddAlert(newAlert);
    }
    setToast({
      message: `Test alert ${newAlert.id} created successfully and added to queue.`,
      type: "success"
    });
  };

  // Derive unique available sources from current alerts
  const availableSources = Array.from(
    new Set(alerts.map((a) => a.source).filter(Boolean))
  );

  // Filter alerts based on criteria
  const filteredAlerts = alerts.filter((alert) => {
    const q = search.toLowerCase();
    const matchesSearch = 
      (alert.title || "").toLowerCase().includes(q) ||
      (alert.description || "").toLowerCase().includes(q) ||
      (alert.affectedAsset || "").toLowerCase().includes(q) ||
      (alert.targetHost || "").toLowerCase().includes(q) ||
      (alert.id || "").toLowerCase().includes(q) ||
      (alert.sourceIp || "").toLowerCase().includes(q) ||
      (alert.destinationIp || "").toLowerCase().includes(q) ||
      (alert.user || "").toLowerCase().includes(q);

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
        
        <div className="flex items-center gap-4 self-start md:self-auto">
          {/* Queue Status Counter */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse-subtle" />
            <span>Queue Status: <strong className="text-slate-200 font-bold">{filteredAlerts.length} Unresolved</strong></span>
          </div>

          {/* Add Alert Action with subtle demo note */}
          <div className="flex flex-col items-end">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-750 hover:border-slate-600 rounded-lg flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Plus size={13} className="text-rose-500" />
              <span>Add Alert</span>
            </button>
            <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
              For testing / demo alerts
            </span>
          </div>
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
        availableSources={availableSources}
        onReset={handleReset}
      />

      {/* Main List Table */}
      <AlertTable alerts={filteredAlerts} />

      {/* Add Alert Modal */}
      <AddAlertModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddAlert={handleCreateAlert}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}


import React, { useState } from "react";
import { X, Plus, ShieldAlert, AlertCircle, Info } from "lucide-react";
import { normalizeSeverity } from "../../utils/alertMapper";

const COMMON_SOURCES = [
  "Endpoint Detection System",
  "Security Monitoring Platform",
  "Identity Monitoring System",
  "Vulnerability Scanner",
  "Network Traffic Monitor",
  "Threat Intelligence Hub",
  "Cloud Audit Monitor",
  "Custom SIEM Feed"
];

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function AddAlertModal({ isOpen, onClose, onAddAlert }) {
  const [formData, setFormData] = useState({
    title: "",
    severity: "HIGH",
    source: "Endpoint Detection System",
    customSource: "",
    targetHost: "",
    sourceIp: "",
    destinationIp: "",
    user: "",
    description: "",
    evidence: ""
  });

  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = "Alert title is required";
    }
    const finalSource = formData.source === "OTHER" ? formData.customSource.trim() : formData.source.trim();
    if (!finalSource) {
      newErrors.source = "Source is required";
    }
    if (!formData.targetHost.trim()) {
      newErrors.targetHost = "Target host / affected asset is required";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Alert description is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const finalSource = formData.source === "OTHER" ? formData.customSource.trim() : formData.source.trim();
    const now = new Date();
    const uniqueId = `ALT-TEST-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;

    const newAlert = {
      id: uniqueId,
      title: formData.title.trim(),
      severity: normalizeSeverity(formData.severity),
      source: finalSource,
      affectedAsset: formData.targetHost.trim(),
      targetHost: formData.targetHost.trim(),
      ...(formData.sourceIp.trim() ? { sourceIp: formData.sourceIp.trim() } : {}),
      ...(formData.destinationIp.trim() ? { destinationIp: formData.destinationIp.trim() } : {}),
      ...(formData.user.trim() ? { user: formData.user.trim() } : {}),
      description: formData.description.trim(),
      ...(formData.evidence.trim() ? {
        evidence: formData.evidence.includes("\n")
          ? formData.evidence.split("\n").map((line) => line.trim()).filter(Boolean)
          : [formData.evidence.trim()]
      } : {}),
      status: "New",
      detectedTime: now.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }),
      timestamp: now.toISOString()
    };

    onAddAlert(newAlert);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      title: "",
      severity: "HIGH",
      source: "Endpoint Detection System",
      customSource: "",
      targetHost: "",
      sourceIp: "",
      destinationIp: "",
      user: "",
      description: "",
      evidence: ""
    });
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        className="glass-panel w-full max-w-2xl rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-rose-500">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Create Test Alert</span>
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Demo Mode
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Inject a temporary alert into the live triage queue for mitigation testing.
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Note Info Banner */}
          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-start gap-2.5 text-xs text-slate-400">
            <Info size={15} className="text-sky-400 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Manually created alerts are queued in frontend memory and can be analyzed using the AI mitigation pipeline. Persistence to the audit database occurs when you run analysis.
            </span>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Alert Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="e.g. Suspicious PowerShell Script Execution"
              className={`w-full bg-slate-950/90 border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                errors.title ? "border-rose-500/80 focus:border-rose-500" : "border-slate-800 focus:border-slate-700"
              }`}
            />
            {errors.title && (
              <span className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle size={10} /> {errors.title}
              </span>
            )}
          </div>

          {/* Severity & Source Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Severity */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Severity <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.severity}
                onChange={(e) => handleChange("severity", e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-700 transition"
              >
                {SEVERITIES.map((sev) => (
                  <option key={sev} value={sev}>
                    {sev}
                  </option>
                ))}
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Telemetry Source <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.source}
                onChange={(e) => handleChange("source", e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-700 transition"
              >
                {COMMON_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
                <option value="OTHER">Other / Custom Source...</option>
              </select>
            </div>
          </div>

          {/* Custom Source Input (if 'OTHER' selected) */}
          {formData.source === "OTHER" && (
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Custom Source Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.customSource}
                onChange={(e) => handleChange("customSource", e.target.value)}
                placeholder="e.g. AWS GuardDuty Sensor"
                className={`w-full bg-slate-950/90 border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                  errors.source ? "border-rose-500/80 focus:border-rose-500" : "border-slate-800 focus:border-slate-700"
                }`}
              />
              {errors.source && (
                <span className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.source}
                </span>
              )}
            </div>
          )}

          {/* Target Host & User Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Target Host */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Target Host / Asset <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.targetHost}
                onChange={(e) => handleChange("targetHost", e.target.value)}
                placeholder="e.g. WIN-SRV-042 or WORKSTATION-19"
                className={`w-full bg-slate-950/90 border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                  errors.targetHost ? "border-rose-500/80 focus:border-rose-500" : "border-slate-800 focus:border-slate-700"
                }`}
              />
              {errors.targetHost && (
                <span className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.targetHost}
                </span>
              )}
            </div>

            {/* Affected User */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Affected User <span className="text-slate-600 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.user}
                onChange={(e) => handleChange("user", e.target.value)}
                placeholder="e.g. administrator or jdoe"
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 transition"
              />
            </div>
          </div>

          {/* Network IP Addresses Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Source IP */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Source IP <span className="text-slate-600 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.sourceIp}
                onChange={(e) => handleChange("sourceIp", e.target.value)}
                placeholder="e.g. 192.168.1.45"
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 transition"
              />
            </div>

            {/* Destination IP */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Destination IP <span className="text-slate-600 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.destinationIp}
                onChange={(e) => handleChange("destinationIp", e.target.value)}
                placeholder="e.g. 10.0.10.50"
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 transition"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Threat Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Describe the anomalous telemetry or detected threat pattern..."
              className={`w-full bg-slate-950/90 border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition leading-relaxed ${
                errors.description ? "border-rose-500/80 focus:border-rose-500" : "border-slate-800 focus:border-slate-700"
              }`}
            />
            {errors.description && (
              <span className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle size={10} /> {errors.description}
              </span>
            )}
          </div>

          {/* Evidence */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Evidence / Telemetry Logs <span className="text-slate-600 font-normal">(Optional, one entry per line)</span>
            </label>
            <textarea
              rows={3}
              value={formData.evidence}
              onChange={(e) => handleChange("evidence", e.target.value)}
              placeholder="e.g.&#10;Process powershell.exe executed with encoded command payload&#10;Inbound network connection from untrusted IP"
              className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-700 transition leading-relaxed"
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-lg border border-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all duration-200 shadow-[0_0_12px_rgba(225,29,72,0.2)] hover:shadow-[0_0_18px_rgba(225,29,72,0.35)] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              Add to Queue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

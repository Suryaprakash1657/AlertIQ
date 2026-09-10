import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ChevronRight, RefreshCw, AlertTriangle, Trash2, Loader2, ChevronLeft, Filter, Shield } from "lucide-react";
import SeverityBadge from "../components/alerts/SeverityBadge";
import Toast from "../components/common/Toast";
import { historyService } from "../services/historyService.js";

export default function History() {
  const navigate = useNavigate();
  const [historyList, setHistoryList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [ragStatusFilter, setRagStatusFilter] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const fetchHistory = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      setError("");

      const params = {
        page,
        limit: 15,
        ...(severityFilter && { severity: severityFilter }),
        ...(riskFilter && { riskLevel: riskFilter }),
        ...(ragStatusFilter && { ragStatus: ragStatusFilter })
      };

      const res = await historyService.getHistory(params);
      setHistoryList(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.message || "Failed to load analysis history.");
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter, riskFilter, ragStatusFilter]);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handleDelete = async (analysisId) => {
    try {
      setDeletingId(analysisId);
      await historyService.deleteHistoryById(analysisId);
      setToastMessage(`Analysis record #${analysisId} deleted successfully.`);
      setToastType("success");
      setConfirmDeleteId(null);
      // Refresh current page or previous page if last item
      const targetPage = historyList.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
      fetchHistory(targetPage);
    } catch (err) {
      setToastMessage(err.message || "Failed to delete analysis record.");
      setToastType("error");
    } finally {
      setDeletingId(null);
    }
  };

  const getRagStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "success":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "no_match":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "empty_kb":
        return "bg-rose-500/10 border-rose-500/30 text-rose-400";
      case "failed":
        return "bg-rose-500/10 border-rose-500/30 text-rose-400";
      default:
        return "bg-slate-500/10 border-slate-500/30 text-slate-400";
    }
  };

  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
        return "text-rose-400";
      case "HIGH":
        return "text-orange-400";
      case "MEDIUM":
        return "text-amber-400";
      case "LOW":
        return "text-emerald-400";
      default:
        return "text-slate-400";
    }
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
            Audit logs of previous alert mitigation searches and persisted AI assessments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchHistory(pagination.page)}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Clock size={14} className="text-slate-500" />
            <span>Total logged: <strong className="text-slate-200 font-mono">{pagination.total}</strong></span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-3.5 bg-slate-900/40 border border-slate-850 rounded-xl text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase text-[10px]">
          <Filter size={12} className="text-rose-500" />
          <span>Filters:</span>
        </div>

        {/* Severity Filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-700 transition"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>

        {/* Risk Level Filter */}
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-700 transition"
        >
          <option value="">All Risk Levels</option>
          <option value="CRITICAL">Risk: CRITICAL</option>
          <option value="HIGH">Risk: HIGH</option>
          <option value="MEDIUM">Risk: MEDIUM</option>
          <option value="LOW">Risk: LOW</option>
        </select>

        {/* RAG Status Filter */}
        <select
          value={ragStatusFilter}
          onChange={(e) => setRagStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-700 transition"
        >
          <option value="">All RAG States</option>
          <option value="success">RAG: Success</option>
          <option value="no_match">RAG: No Match</option>
          <option value="empty_kb">RAG: Empty KB</option>
          <option value="failed">RAG: Fallback</option>
        </select>

        {(severityFilter || riskFilter || ragStatusFilter) && (
          <button
            onClick={() => {
              setSeverityFilter("");
              setRiskFilter("");
              setRagStatusFilter("");
            }}
            className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchHistory(pagination.page)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Logs Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="p-4 pl-6">Audit ID</th>
                <th className="p-4">Alert Title</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Risk Assessment</th>
                <th className="p-4">RAG Status</th>
                <th className="p-4">Sources</th>
                <th className="p-4">Analyzed At</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="p-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2.5">
                      <Loader2 size={24} className="animate-spin text-rose-500" />
                      <span className="font-mono text-xs text-slate-400">Loading audit history from database...</span>
                    </div>
                  </td>
                </tr>
              ) : historyList.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Clock size={24} className="text-slate-700" />
                      <span>No analysis records found matching criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                historyList.map((entry) => (
                  <tr 
                    key={entry.analysisId}
                    className="hover:bg-slate-850/20 transition duration-150 group"
                  >
                    {/* Audit ID */}
                    <td className="p-4 pl-6 font-mono text-[11px] text-slate-400">
                      #{entry.analysisId}
                    </td>

                    {/* Alert Title */}
                    <td className="p-4 font-bold text-slate-200 group-hover:text-rose-400 transition max-w-xs truncate">
                      {entry.title || "Security Incident"}
                    </td>

                    {/* Severity */}
                    <td className="p-4 whitespace-nowrap">
                      <SeverityBadge severity={entry.severity} />
                    </td>

                    {/* Risk Level */}
                    <td className={`p-4 whitespace-nowrap font-bold uppercase text-[11px] ${getRiskColor(entry.riskLevel)}`}>
                      {entry.riskLevel || "MEDIUM"}
                    </td>

                    {/* RAG Status */}
                    <td className="p-4 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getRagStatusBadge(entry.ragStatus)}`}>
                        {entry.ragStatus || "completed"}
                      </span>
                    </td>

                    {/* Sources Retrieved */}
                    <td className="p-4 whitespace-nowrap text-slate-350 font-mono text-[11px]">
                      {entry.sourcesUsedCount || 0} cited
                    </td>

                    {/* Analyzed At */}
                    <td className="p-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {entry.createdAt
                        ? new Date(entry.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "Recently"}
                    </td>

                    {/* Actions */}
                    <td className="p-4 pr-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Delete confirmation */}
                        {confirmDeleteId === entry.analysisId ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(entry.analysisId)}
                              disabled={deletingId === entry.analysisId}
                              className="px-2 py-1 text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded transition disabled:opacity-50 cursor-pointer"
                            >
                              {deletingId === entry.analysisId ? <Loader2 size={10} className="animate-spin" /> : "Confirm"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingId === entry.analysisId}
                              className="px-1.5 py-1 text-[10px] bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(entry.analysisId)}
                            disabled={deletingId === entry.analysisId}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}

                        {/* View Analysis */}
                        <button
                          onClick={() => navigate(`/analysis/history/${entry.analysisId}`)}
                          className="px-3 py-1.5 text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-850 hover:border-slate-700 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          View Analysis
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing page <strong className="text-slate-200">{pagination.page}</strong> of <strong className="text-slate-200">{pagination.totalPages}</strong> ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchHistory(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 disabled:opacity-40 disabled:hover:text-slate-300 transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={12} />
                Previous
              </button>
              <button
                onClick={() => fetchHistory(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 disabled:opacity-40 disabled:hover:text-slate-300 transition flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Feedback */}
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage("")}
      />
    </div>
  );
}

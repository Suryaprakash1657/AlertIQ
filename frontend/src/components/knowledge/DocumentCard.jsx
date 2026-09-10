import React, { useState } from "react";
import { Calendar, Database, RefreshCw, Eye, Trash2, Loader2 } from "lucide-react";

export default function DocumentCard({ document, onPreview, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "indexed":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "processing":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse-subtle";
      case "failed":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      default:
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
    }
  };

  // Resolve metadata fields
  const category =
    document.metadata?.category ||
    document.metadata?.type ||
    document.type ||
    document.source ||
    "Incident Runbook";

  const description =
    document.metadata?.description ||
    document.description ||
    (document.content ? document.content.slice(0, 160) + "..." : "Indexed security playbook.");

  const chunkCount = document.chunkCount ?? (document.chunks?.length ?? 0);

  const formattedDate = document.createdAt
    ? new Date(document.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
      })
    : document.lastUpdated || "Recently";

  const status = document.status || "Indexed";

  const handleDeleteClick = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(document.id);
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-xl hover:border-slate-700 transition-all duration-200 flex flex-col justify-between h-full relative overflow-hidden group">
      {/* Top Banner Category & Status */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-850/80 mb-3">
        <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded bg-slate-950 border border-slate-850 truncate max-w-[170px]">
          {category}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide flex items-center gap-1 ${getStatusBadge(status)}`}>
          {status === "Processing" && <RefreshCw size={8} className="animate-spin" />}
          {status}
        </span>
      </div>

      {/* Main Details */}
      <div className="flex-1 space-y-2">
        <h4 className="text-xs font-bold text-slate-200 group-hover:text-rose-400 transition leading-snug">
          {document.title}
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
          {description}
        </p>
      </div>

      {/* Footer Metrics & Actions */}
      <div className="mt-4 pt-3 border-t border-slate-850/80 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <Database size={11} />
            {chunkCount} Chunks
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {formattedDate}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Delete Action */}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="px-2 py-1 text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded transition disabled:opacity-50 cursor-pointer"
                title="Confirm deletion"
              >
                {isDeleting ? <Loader2 size={10} className="animate-spin" /> : "Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="px-1.5 py-1 text-[10px] bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition cursor-pointer"
              title="Delete Document"
            >
              <Trash2 size={12} />
            </button>
          )}

          {/* Preview Action */}
          <button
            onClick={() => onPreview(document)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition cursor-pointer"
            title="Preview Document Content"
          >
            <Eye size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

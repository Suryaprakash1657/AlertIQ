import React, { useState } from "react";
import { X, FileText, Upload, Plus } from "lucide-react";
import IngestionProgress from "./IngestionProgress";

export default function UploadDocumentModal({ isOpen, onClose, onSuccess }) {
  if (!isOpen) return null;

  const [title, setTitle] = useState("");
  const [type, setType] = useState("Incident Runbook");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      if (!title) {
        // Auto fill title with file base name without ext
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !description) return;
    setIsIngesting(true);
  };

  const handleIngestionFinished = () => {
    const newDoc = {
      id: `DOC-SEED-${Date.now()}`,
      title: title || "Ingested Security Reference",
      type: type,
      status: "Indexed",
      chunks: Math.floor(Math.random() * 35) + 12,
      lastUpdated: "Aug 20, 2026",
      description: description,
      content: `Uploaded Document: ${title}\nCategory: ${type}\n\nIngestion Summary:\nThis document has been fully indexed by AlertIQ. Matching chunks will be retrieved automatically when corresponding alerts are analyzed by the RAG mitigation controller.\n\nRaw Description:\n${description}`
    };
    onSuccess(newDoc);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle("");
    setType("Incident Runbook");
    setDescription("");
    setFileName("");
    setIsIngesting(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-rose-500">
              <Upload size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Upload Knowledge Document
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Ingest incident response runbooks to ground AI mitigation.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {isIngesting ? (
            <IngestionProgress onFinished={handleIngestionFinished} />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Select File
                </label>
                <div className="relative border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded-xl p-6 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.json"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    required={!fileName}
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-2 bg-slate-900 border border-slate-850 rounded-lg text-slate-400">
                      <FileText size={20} />
                    </div>
                    <span className="text-xs text-slate-300 font-semibold block">
                      {fileName ? fileName : "Drag and drop your document here"}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Supports PDF, TXT, MD or JSON up to 10MB
                    </span>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Linux Host Mitigation Runbook"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-slate-750 transition"
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Document Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-350 focus:outline-none focus:border-slate-750 transition"
                >
                  <option value="Incident Runbook">Incident Runbook</option>
                  <option value="Threat Intelligence">Threat Intelligence Report</option>
                  <option value="Vulnerability Advisory">Vulnerability Advisory</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  placeholder="Brief summary of document sections, guidelines and target exploits..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-slate-750 transition"
                  required
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-850/80">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-350 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all duration-200 shadow-[0_0_12px_rgba(225,29,72,0.15)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  Upload & Process
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

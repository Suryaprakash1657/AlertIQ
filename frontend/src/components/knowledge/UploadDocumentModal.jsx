import React, { useState } from "react";
import { X, Upload, Plus, FileText, AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import { knowledgeService } from "../../services/knowledgeService.js";

export default function UploadDocumentModal({ isOpen, onClose, onSuccess }) {
  if (!isOpen) return null;

  const [title, setTitle] = useState("");
  const [type, setType] = useState("Incident Runbook");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [ingestionPhase, setIngestionPhase] = useState("");

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      setErrorMessage("");

      // Auto-fill title if empty
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }

      // Read file text content
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          setContent(text);
          if (!description) {
            // Provide short excerpt as initial description
            setDescription(text.slice(0, 140).trim());
          }
        }
      };
      reader.onerror = () => {
        setErrorMessage("Failed to read file. Please ensure it is a valid text, markdown, or JSON file.");
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const trimmedTitle = title.trim();
    const finalContent = (content || description).trim();

    if (!trimmedTitle) {
      setErrorMessage("Document title is required.");
      return;
    }

    if (!finalContent) {
      setErrorMessage("Document content is required. Please upload a file or type content.");
      return;
    }

    try {
      setIsIngesting(true);
      setIngestionPhase("Chunking document and generating dense vector embeddings...");

      const payload = {
        title: trimmedTitle,
        content: finalContent,
        source: "Internal Knowledge Base",
        metadata: {
          category: type,
          type: type,
          description: description.trim() || trimmedTitle
        }
      };

      const result = await knowledgeService.createDocument(payload);

      setIngestionPhase("Indexed successfully!");
      if (onSuccess) {
        onSuccess(result.document);
      }

      resetForm();
      onClose();
    } catch (err) {
      setIsIngesting(false);
      setIngestionPhase("");
      setErrorMessage(err.message || "Failed to ingest document into knowledge base.");
    }
  };

  const resetForm = () => {
    setTitle("");
    setType("Incident Runbook");
    setDescription("");
    setContent("");
    setFileName("");
    setIsIngesting(false);
    setErrorMessage("");
    setIngestionPhase("");
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
            disabled={isIngesting}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition disabled:opacity-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {isIngesting ? (
            /* Live Ingestion Processing State */
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-6 min-h-[300px]">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-rose-500/10 animate-ping" />
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-rose-500 relative z-10">
                  <Loader2 className="animate-spin" size={28} />
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Indexing Document
                </h4>
                <p className="text-xs text-slate-400 max-w-xs font-mono">
                  {ingestionPhase}
                </p>
              </div>

              <div className="w-full bg-slate-950 border border-slate-850 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-rose-600 to-orange-500 h-full w-3/4 animate-pulse" />
              </div>

              <span className="text-[10px] text-slate-500 font-mono">
                Calculating vector embeddings via Gemini Embedding Model...
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* File Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Select File (TXT, MD, JSON)
                </label>
                <div className="relative border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded-xl p-5 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.json,.text"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-2 bg-slate-900 border border-slate-850 rounded-lg text-slate-400">
                      <FileText size={18} />
                    </div>
                    <span className="text-xs text-slate-300 font-semibold block">
                      {fileName ? fileName : "Drag & drop or click to browse files"}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Supports .txt, .md, and .json files
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

              {/* Content / Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Document Content
                  </label>
                  {content && (
                    <span className="text-[9px] text-slate-500 font-mono">
                      {content.length} characters loaded
                    </span>
                  )}
                </div>
                <textarea
                  value={content || description}
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (!description) setDescription(e.target.value.slice(0, 140));
                  }}
                  rows="4"
                  placeholder="Paste runbook text, investigation steps, mitigation procedures..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-slate-750 font-mono transition"
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
                  disabled={!title.trim() || (!content.trim() && !description.trim())}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:bg-slate-850 disabled:text-slate-600 text-white rounded-lg transition-all duration-200 shadow-[0_0_12px_rgba(225,29,72,0.15)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  Upload & Ingest
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

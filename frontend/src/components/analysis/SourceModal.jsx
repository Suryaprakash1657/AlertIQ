import React, { useState, useEffect } from "react";
import { X, FileText, Calendar, Database, Loader2, AlertCircle, Layers } from "lucide-react";
import { knowledgeService } from "../../services/knowledgeService.js";

export default function SourceModal({ isOpen, document, onClose }) {
  const [fullDoc, setFullDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("content"); // "content" | "chunks"

  useEffect(() => {
    if (!isOpen || !document) {
      setFullDoc(null);
      setError("");
      return;
    }

    // If document already has content and chunks, use it directly
    if (document.content && document.chunks) {
      setFullDoc(document);
      return;
    }

    // Otherwise fetch the full document details from backend
    const fetchFullDoc = async () => {
      try {
        setIsLoading(true);
        setError("");
        const res = await knowledgeService.getDocumentById(document.id || document.documentId);
        setFullDoc(res.document);
      } catch (err) {
        setError(err.message || "Failed to load document content.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFullDoc();
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const docData = fullDoc || document;

  const category =
    docData.metadata?.category ||
    docData.metadata?.type ||
    docData.type ||
    docData.source ||
    "Incident Runbook";

  const chunkCount = docData.chunkCount ?? (docData.chunks?.length ?? 0);

  const formattedDate = docData.createdAt
    ? new Date(docData.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
      })
    : docData.lastUpdated || "Recently";

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        className="glass-panel w-full max-w-2xl rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-rose-500">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 truncate max-w-md">
                {docData.title || "Source Document Viewer"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                ID: {docData.id || docData.documentId || "DOC-INDEXED"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Info Stats */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Document Title</span>
            <span className="text-slate-200 font-semibold block mt-0.5 truncate">{docData.title}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Source Category</span>
            <span className="text-slate-200 font-medium block mt-0.5">{category}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Database Status</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Indexed in PostgreSQL
            </span>
          </div>
        </div>

        {/* Tab Selector if chunks exist */}
        {docData.chunks && docData.chunks.length > 0 && (
          <div className="flex items-center gap-2 px-6 pt-3 pb-1 border-b border-slate-850 bg-slate-950/40 text-xs">
            <button
              onClick={() => setActiveTab("content")}
              className={`pb-2 px-1 font-semibold border-b-2 transition cursor-pointer ${
                activeTab === "content"
                  ? "border-rose-500 text-slate-100"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Full Document Text
            </button>
            <button
              onClick={() => setActiveTab("chunks")}
              className={`pb-2 px-1 font-semibold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "chunks"
                  ? "border-rose-500 text-slate-100"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers size={12} />
              Indexed Chunks ({docData.chunks.length})
            </button>
          </div>
        )}

        {/* Document Content Area */}
        <div className="p-6 overflow-y-auto bg-slate-950/20 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
              <Loader2 className="animate-spin text-rose-500" size={24} />
              <span className="text-xs text-slate-400 font-mono">Fetching document from database...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Ingestion Meta */}
              <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <Database size={11} />
                  Chunks: {chunkCount}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  Indexed: {formattedDate}
                </span>
              </div>

              {activeTab === "chunks" && docData.chunks ? (
                /* Chunks breakdown view */
                <div className="space-y-3">
                  {docData.chunks.map((chunk, idx) => (
                    <div key={chunk.id || idx} className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono border-b border-slate-900 pb-2">
                        <span className="text-rose-400 font-semibold">Chunk #{chunk.chunkIndex + 1} of {chunk.totalChunks || docData.chunks.length}</span>
                        <span>{chunk.charCount || chunk.content?.length || 0} chars ~ {chunk.tokenEstimate || 0} tokens</span>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                        {chunk.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                /* Full document text */
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl">
                  <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {docData.content || "No text content stored for this document."}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}

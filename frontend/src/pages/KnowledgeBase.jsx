import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Database, Info, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import DocumentCard from "../components/knowledge/DocumentCard";
import UploadDocumentModal from "../components/knowledge/UploadDocumentModal";
import SourceModal from "../components/analysis/SourceModal";
import Toast from "../components/common/Toast";
import { knowledgeService } from "../services/knowledgeService.js";

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const categories = [
    { label: "All Documents", value: "All" },
    { label: "Incident Runbooks", value: "Incident Runbook" },
    { label: "Threat Intelligence", value: "Threat Intelligence" },
    { label: "Vulnerability Advisories", value: "Vulnerability Advisory" }
  ];

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const res = await knowledgeService.getDocuments();
      setDocuments(res.documents || []);
    } catch (err) {
      setError(err.message || "Failed to load knowledge documents from backend.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDocumentUploaded = (newDoc) => {
    setToastMessage(`Document "${newDoc.title}" indexed successfully with ${newDoc.chunkCount || 0} vector chunks.`);
    setToastType("success");
    fetchDocuments();
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await knowledgeService.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setToastMessage("Document deleted from knowledge base.");
      setToastType("success");
    } catch (err) {
      setToastMessage(err.message || "Failed to delete document.");
      setToastType("error");
      throw err;
    }
  };

  // Client-side filtering over actual backend documents
  const filteredDocs = documents.filter((doc) => {
    const title = doc.title || "";
    const desc = doc.metadata?.description || doc.description || "";
    const source = doc.source || "";
    const category = doc.metadata?.category || doc.metadata?.type || doc.type || source;

    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      activeCategory === "All" ||
      category.toLowerCase().includes(activeCategory.toLowerCase()) ||
      (activeCategory === "Incident Runbook" && category.toLowerCase().includes("runbook")) ||
      (activeCategory === "Threat Intelligence" && category.toLowerCase().includes("threat")) ||
      (activeCategory === "Vulnerability Advisory" && category.toLowerCase().includes("vulnerability"));

    return matchesSearch && matchesCategory;
  });

  const handleOpenPreview = (doc) => {
    setSelectedDoc(doc);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setSelectedDoc(null);
    setIsPreviewOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Knowledge Base
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage the security documents used by AlertIQ to retrieve mitigation guidance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
            title="Refresh documents"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-all duration-200 shadow-[0_0_12px_rgba(225,29,72,0.15)] flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Plus size={14} />
            Upload Document
          </button>
        </div>
      </div>

      {/* Info notice about RAG model grounding */}
      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3">
        <Info size={16} className="text-rose-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          <strong className="text-slate-200">Semantic Embedding Index:</strong> The document chunks displayed below are processed into dense vector spaces using our embedding model. During alert analysis, AlertIQ queries this vector space to retrieve playbooks matching security parameters and alert triggers, generating grounded mitigation instructions.
        </div>
      </div>

      {/* Categories and Search row */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => setActiveCategory(c.value)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                activeCategory === c.value
                  ? "bg-slate-800 border-slate-700 text-rose-400"
                  : "bg-slate-900/40 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-850/50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:max-w-xs">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">
            <Search size={14} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-750 transition"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDocuments}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid of Documents */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500 text-sm glass-panel rounded-xl flex flex-col items-center justify-center space-y-3">
          <Loader2 size={28} className="text-rose-500 animate-spin" />
          <span className="font-mono text-xs text-slate-400">Loading indexed documents from database...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 text-sm glass-panel rounded-xl flex flex-col items-center justify-center space-y-2.5">
              <Database size={24} className="text-slate-750 animate-pulse-subtle" />
              <span>No documents match your query filters.</span>
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onPreview={handleOpenPreview}
                onDelete={handleDeleteDocument}
              />
            ))
          )}
        </div>
      )}

      {/* Ingestion Upload Overlay Modal */}
      <UploadDocumentModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleDocumentUploaded}
      />

      {/* Document View Preview Overlay Modal */}
      <SourceModal
        isOpen={isPreviewOpen}
        document={selectedDoc}
        onClose={handleClosePreview}
      />

      {/* Toast Feedback */}
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage("")}
      />
    </div>
  );
}

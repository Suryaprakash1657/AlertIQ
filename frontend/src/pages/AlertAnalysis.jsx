import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Terminal, Shield, Sparkles, Check, Database, HelpCircle } from "lucide-react";
import AlertDetails from "../components/analysis/AlertDetails";
import AnalysisLoader from "../components/analysis/AnalysisLoader";
import MitigationResult from "../components/analysis/MitigationResult";
import SourceEvidence from "../components/analysis/SourceEvidence";
import SourceModal from "../components/analysis/SourceModal";
import FollowUpChat from "../components/analysis/FollowUpChat";
import LowConfidenceState from "../components/analysis/LowConfidenceState";
import { mockAnalyses } from "../data/mockAnalyses";

export default function AlertAnalysis({ alerts, updateAlertStatus, addHistoryEntry }) {
  const { id } = useParams();
  const navigate = useNavigate();

  // Find target alert
  const alert = alerts.find((a) => a.id === id);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);

  // If alert is not found, redirect to alerts list
  useEffect(() => {
    if (!alert) {
      navigate("/alerts");
    }
  }, [alert, navigate]);

  if (!alert) return null;

  // Retrieve analysis details mapping
  const analysis = mockAnalyses[alert.id] || {
    alertId: alert.id,
    summary: "No cached recommendation. Run vector index lookup.",
    recommendedMitigations: [],
    confidence: "Low",
    retrievedSources: [],
    lowConfidence: true
  };

  const handleStartAnalysis = () => {
    setIsAnalyzing(true);
  };

  const handleAnalysisFinished = () => {
    setIsAnalyzing(false);
    setAnalysisComplete(true);
    
    // Update alert status to In Progress when analyzed
    updateAlertStatus(alert.id, "In Progress");

    // Add entry to history state
    const historyEntry = {
      id: `HIST-${Date.now()}`,
      alertId: alert.id,
      alertTitle: alert.title,
      severity: alert.severity,
      status: analysis.lowConfidence ? "Low confidence" : "Completed",
      sourcesRetrieved: analysis.lowConfidence 
        ? "0 sources" 
        : `${analysis.retrievedSources.length} sources`,
      confidence: analysis.lowConfidence ? "Low confidence" : `${analysis.confidence} confidence`,
      analyzedAt: new Date().toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }),
      sessionAdded: true // Marker for UI counter
    };
    addHistoryEntry(historyEntry);
  };

  const handleOpenSourceModal = (sourceDoc) => {
    setSelectedSource(sourceDoc);
    setIsSourceModalOpen(true);
  };

  const handleCloseSourceModal = () => {
    setIsSourceModalOpen(false);
    setSelectedSource(null);
  };

  return (
    <div className="space-y-6">
      {/* Alert Metadata Panel */}
      <AlertDetails alert={alert} />

      {/* Two Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-top">
        
        {/* Left/Main Column - Workspace Actions & Mitigation */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Work area panels */}
          {!analysisComplete && !isAnalyzing ? (
            /* Unanalyzed Action View */
            <div className="glass-panel p-8 rounded-xl border border-slate-800 text-center flex flex-col items-center justify-center min-h-[380px] space-y-6">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 relative">
                <Terminal size={28} />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 border-2 border-slate-900 animate-pulse-subtle" />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                  Mitigation Guidance Pending
                </h3>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed mx-auto">
                  AlertIQ has received the threat telemetry, but has not yet retrieved corresponding organization runbooks. Run the AI RAG compiler to search matching files.
                </p>
              </div>

              <button
                onClick={handleStartAnalysis}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(225,29,72,0.25)] hover:shadow-[0_0_30px_rgba(225,29,72,0.4)] flex items-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Sparkles size={14} className="text-white fill-white/10" />
                Analyze Mitigation
              </button>
            </div>
          ) : isAnalyzing ? (
            /* Loading State Animation */
            <AnalysisLoader onComplete={handleAnalysisFinished} />
          ) : (
            /* Analysis Completed Views */
            <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-6">
              {analysis.lowConfidence ? (
                /* Low Confidence State refusal output */
                <LowConfidenceState />
              ) : (
                /* Normal Mitigation Results output */
                <MitigationResult result={analysis} />
              )}
            </div>
          )}

          {/* Interactive Chat Dialogue - Display only when analysis has been processed and is NOT low confidence */}
          {analysisComplete && !isAnalyzing && !analysis.lowConfidence && (
            <FollowUpChat 
              alertId={alert.id}
              followUpResponses={analysis.followUpResponses}
              retrievedSources={analysis.retrievedSources}
            />
          )}
        </div>

        {/* Right Column - Source citations list */}
        <div className="space-y-6">
          {analysisComplete && !isAnalyzing && !analysis.lowConfidence ? (
            /* Sources List panel */
            <SourceEvidence 
              sourceIds={analysis.retrievedSources} 
              onViewSource={handleOpenSourceModal} 
            />
          ) : (
            /* Blank Sidebar State */
            <div className="glass-panel p-6 rounded-xl border border-slate-800 text-center h-[280px] flex flex-col items-center justify-center space-y-3">
              <Database size={24} className="text-slate-650" />
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Evidence Panel
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px]">
                Cited runbooks and matching intelligence vectors will appear here once the analysis completes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Source Preview Overlay Modal */}
      <SourceModal
        isOpen={isSourceModalOpen}
        document={selectedSource}
        onClose={handleCloseSourceModal}
      />
    </div>
  );
}

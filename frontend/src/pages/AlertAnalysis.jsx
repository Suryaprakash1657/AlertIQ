import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Terminal, Sparkles, Database, AlertTriangle, RefreshCw, ArrowLeft, Loader2, Archive } from "lucide-react";
import AlertDetails from "../components/analysis/AlertDetails";
import AnalysisLoader from "../components/analysis/AnalysisLoader";
import MitigationResult from "../components/analysis/MitigationResult";
import SourceEvidence from "../components/analysis/SourceEvidence";
import SourceModal from "../components/analysis/SourceModal";
import FollowUpChat from "../components/analysis/FollowUpChat";
import { alertService } from "../services/alertService.js";
import { historyService } from "../services/historyService.js";
import { mapAlertToBackendPayload } from "../utils/alertMapper.js";

export default function AlertAnalysis({ alerts = [], updateAlertStatus, addHistoryEntry }) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Mode Detection: Historical vs Live
  const isHistoricalMode = Boolean(params.analysisId || location.pathname.includes("/analysis/history/"));
  const analysisId = params.analysisId;
  const liveAlertId = params.id;

  // Live Alert Lookup
  const liveAlert = !isHistoricalMode ? alerts.find((a) => a.id === liveAlertId) : null;

  // Component State
  const [historicalAlert, setHistoricalAlert] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(isHistoricalMode);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);

  // 1. Historical Mode Data Loading
  useEffect(() => {
    if (!isHistoricalMode || !analysisId) return;

    let isMounted = true;
    const fetchHistoricalAnalysis = async () => {
      try {
        setIsLoadingHistorical(true);
        setError(null);

        const res = await historyService.getHistoryById(analysisId);
        if (!isMounted) return;

        const record = res.data;
        if (!record) {
          throw new Error(`Analysis record #${analysisId} not found.`);
        }

        // Format historical alert entity
        const alertEntity = record.alert || {
          title: "Security Incident (Historical)",
          severity: "MEDIUM",
          source: "Archived Telemetry",
          timestamp: record.createdAt
        };

        // Format historical analysis response entity
        const formattedAnalysisData = {
          analysis: record.analysis,
          knowledgeContext: {
            status: record.ragStatus || "success",
            matchesFound: record.matchesFound || (record.sources ? record.sources.length : 0),
            sourcesUsed: record.sources || []
          },
          model: record.model,
          usage: record.usage,
          persistence: {
            saved: true,
            analysisId: record.analysisId
          }
        };

        setHistoricalAlert(alertEntity);
        setAnalysisData(formattedAnalysisData);
      } catch (err) {
        if (!isMounted) return;
        setError({
          message: err.message || `Failed to retrieve historical analysis #${analysisId}.`,
          isNotFound: err.status === 404 || err.isNotFound
        });
      } finally {
        if (isMounted) {
          setIsLoadingHistorical(false);
        }
      }
    };

    fetchHistoricalAnalysis();

    return () => {
      isMounted = false;
    };
  }, [isHistoricalMode, analysisId]);

  // 2. Live Mode: Redirect if live alert not found
  useEffect(() => {
    if (!isHistoricalMode && !liveAlert) {
      navigate("/alerts");
    }
  }, [isHistoricalMode, liveAlert, navigate]);

  // Active Alert Entity
  const currentAlert = isHistoricalMode ? historicalAlert : liveAlert;

  // Live Analysis Action Trigger
  const handleStartAnalysis = async () => {
    if (isHistoricalMode || !currentAlert) return;

    try {
      setIsAnalyzing(true);
      setError(null);

      const payload = mapAlertToBackendPayload(currentAlert, { enableRag: true });
      const result = await alertService.analyzeAlert(payload);

      setAnalysisData(result);

      // Update alert status in parent state
      if (updateAlertStatus) {
        updateAlertStatus(currentAlert.id, "In Progress");
      }

      // Add audit entry if helper provided
      if (addHistoryEntry && result.analysis) {
        const historyEntry = {
          id: `HIST-${result.persistence?.analysisId || Date.now()}`,
          alertId: currentAlert.id,
          alertTitle: currentAlert.title,
          severity: currentAlert.severity,
          status: result.knowledgeContext?.status === "success" ? "Completed" : "Heuristic Analysis",
          sourcesRetrieved: `${result.knowledgeContext?.matchesFound || 0} sources`,
          confidence: `${result.analysis?.riskAssessment?.level || "Medium"} Risk`,
          analyzedAt: new Date().toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          }),
          sessionAdded: true
        };
        addHistoryEntry(historyEntry);
      }
    } catch (err) {
      setError({
        message: err.message || "Failed to analyze security alert.",
        isRateLimit: err.isRateLimit || false,
        isNetworkError: err.isNetworkError || false
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenSourceModal = (sourceDoc) => {
    setSelectedSource(sourceDoc);
    setIsSourceModalOpen(true);
  };

  const handleCloseSourceModal = () => {
    setIsSourceModalOpen(false);
    setSelectedSource(null);
  };

  // Loading Historical Record State
  if (isHistoricalMode && isLoadingHistorical) {
    return (
      <div className="py-24 text-center glass-panel rounded-2xl flex flex-col items-center justify-center space-y-3">
        <Loader2 size={32} className="animate-spin text-rose-500" />
        <span className="font-mono text-xs text-slate-400">Loading historical audit record #{analysisId} from database...</span>
      </div>
    );
  }

  // Error State for Historical Record Not Found
  if (isHistoricalMode && error) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-rose-500/30 text-center max-w-lg mx-auto space-y-4 my-12">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-base font-bold text-slate-100">
          Analysis Record Not Found
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          {error.message}
        </p>
        <button
          onClick={() => navigate("/history")}
          className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 mx-auto cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to Analysis History
        </button>
      </div>
    );
  }

  if (!currentAlert) return null;

  const isAnalysisComplete = Boolean(analysisData && analysisData.analysis);

  return (
    <div className="space-y-6">
      {/* Historical Audit Banner */}
      {isHistoricalMode && (
        <div className="p-3 bg-slate-900/80 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-amber-400 shrink-0" />
            <span>
              <strong>Historical Audit Record #{analysisId}:</strong> Viewing read-only persisted analysis snapshot from database.
            </span>
          </div>
          <button
            onClick={() => navigate("/history")}
            className="text-[11px] text-amber-400 hover:text-amber-200 underline cursor-pointer shrink-0"
          >
            All History
          </button>
        </div>
      )}

      {/* Alert Metadata Panel */}
      <AlertDetails alert={currentAlert} isHistorical={isHistoricalMode} />

      {/* Two Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-top">
        
        {/* Left/Main Column - Workspace Actions & Mitigation */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Work area panels */}
          {!isAnalysisComplete && !isAnalyzing ? (
            /* Unanalyzed Action View (Live mode only) */
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
                  AlertIQ has received the threat telemetry, but has not yet retrieved corresponding organization runbooks. Run the AI RAG compiler to query matching playbooks and compile grounded mitigation.
                </p>
              </div>

              {error && (
                <div className="max-w-md w-full p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-left space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <AlertTriangle size={15} />
                    <span>{error.isRateLimit ? "AI Provider Rate Limit" : "Analysis Execution Error"}</span>
                  </div>
                  <p className="text-xs text-rose-300 leading-relaxed">
                    {error.message}
                  </p>
                  {error.isRateLimit && (
                    <p className="text-[11px] text-slate-400">
                      The AI model provider is experiencing high traffic or quota constraints. Please wait a few moments before retrying.
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleStartAnalysis}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(225,29,72,0.25)] hover:shadow-[0_0_30px_rgba(225,29,72,0.4)] flex items-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Sparkles size={14} className="text-white fill-white/10" />
                Analyze Mitigation
              </button>
            </div>
          ) : isAnalyzing ? (
            /* Live Real-Time Analysis Loader */
            <AnalysisLoader />
          ) : (
            /* Analysis Completed Views */
            <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-6">
              <MitigationResult result={analysisData} />
            </div>
          )}

          {/* Interactive Chat Dialogue */}
          {isAnalysisComplete && !isAnalyzing && (
            <FollowUpChat 
              alert={currentAlert}
              onViewSource={handleOpenSourceModal}
            />
          )}
        </div>

        {/* Right Column - Source citations list */}
        <div className="space-y-6">
          {isAnalysisComplete && !isAnalyzing ? (
            /* Real Sources List panel */
            <SourceEvidence 
              knowledgeContext={analysisData.knowledgeContext} 
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

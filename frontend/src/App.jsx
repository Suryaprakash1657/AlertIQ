import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import AlertAnalysis from "./pages/AlertAnalysis";
import KnowledgeBase from "./pages/KnowledgeBase";
import History from "./pages/History";
import Settings from "./pages/Settings";

// Seed data imports
import { mockAlerts } from "./data/mockAlerts";
import { mockDocuments } from "./data/mockDocuments";

export default function App() {
  // Global Shared States for the prototype
  const [alerts, setAlerts] = useState(mockAlerts);
  const [documents, setDocuments] = useState(mockDocuments);
  const [history, setHistory] = useState([
    {
      id: "HIST-001",
      alertId: "ALT-2026-001",
      alertTitle: "Suspicious PowerShell Activity",
      severity: "HIGH",
      status: "Completed",
      sourcesRetrieved: "3 sources",
      confidence: "High confidence",
      analyzedAt: "Aug 20, 2026, 10:42 AM"
    },
    {
      id: "HIST-002",
      alertId: "ALT-2026-004",
      alertTitle: "Critical Vulnerability Detected",
      severity: "HIGH",
      status: "Completed",
      sourcesRetrieved: "2 sources",
      confidence: "Medium confidence",
      analyzedAt: "Aug 19, 2026, 02:45 PM"
    },
    {
      id: "HIST-003",
      alertId: "ALT-2026-006",
      alertTitle: "Suspicious Registry Modification",
      severity: "CRITICAL",
      status: "Low confidence",
      sourcesRetrieved: "0 sources",
      confidence: "Low confidence",
      analyzedAt: "Aug 18, 2026, 08:12 AM"
    }
  ]);

  // Actions to mutate state dynamically during runtime
  const updateAlertStatus = (id, newStatus) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, status: newStatus } : alert
      )
    );
  };

  const addDocument = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev]);
  };

  const addHistoryEntry = (newEntry) => {
    setHistory((prev) => [newEntry, ...prev]);
  };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans scanline">
        {/* Persistent left navigation panel */}
        <Sidebar />

        {/* Dynamic content work area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header navigation bar */}
          <Header />

          {/* Core Route Pages Viewport */}
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
            <Routes>
              <Route 
                path="/" 
                element={<Dashboard alerts={alerts} documents={documents} history={history} />} 
              />
              <Route 
                path="/dashboard" 
                element={<Navigate to="/" replace />} 
              />
              <Route 
                path="/alerts" 
                element={<Alerts alerts={alerts} />} 
              />
              <Route 
                path="/analysis/:id" 
                element={
                  <AlertAnalysis 
                    alerts={alerts} 
                    updateAlertStatus={updateAlertStatus} 
                    addHistoryEntry={addHistoryEntry} 
                  />
                } 
              />
              <Route 
                path="/knowledge" 
                element={<KnowledgeBase documents={documents} addDocument={addDocument} />} 
              />
              <Route 
                path="/history" 
                element={<History history={history} />} 
              />
              <Route 
                path="/settings" 
                element={<Settings />} />
              <Route 
                path="*" 
                element={<Navigate to="/" replace />} 
              />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

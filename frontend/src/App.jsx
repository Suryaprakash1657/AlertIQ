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

// Simulated SIEM/EDR alert feed
import { mockAlerts } from "./data/mockAlerts";

export default function App() {
  // Global Shared States for incoming alert telemetry queue
  const [alerts, setAlerts] = useState(mockAlerts);

  // Action to mutate alert status dynamically during analysis runtime
  const updateAlertStatus = (id, newStatus) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, status: newStatus } : alert
      )
    );
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
                element={<Dashboard alerts={alerts} />} 
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
                path="/analysis/history/:analysisId" 
                element={<AlertAnalysis alerts={alerts} />} 
              />
              <Route 
                path="/analysis/:id" 
                element={
                  <AlertAnalysis 
                    alerts={alerts} 
                    updateAlertStatus={updateAlertStatus} 
                  />
                } 
              />
              <Route 
                path="/knowledge" 
                element={<KnowledgeBase />} 
              />
              <Route 
                path="/history" 
                element={<History />} 
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

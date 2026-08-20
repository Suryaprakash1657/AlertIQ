import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, Bell, Shield, CheckCircle, Database } from "lucide-react";

export default function Header() {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  const getPageTitleInfo = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") {
      return {
        title: "Security Overview",
        subtitle: "Monitor active alerts and quickly retrieve relevant mitigation guidance."
      };
    }
    if (path.startsWith("/alerts")) {
      return {
        title: "Active Alerts",
        subtitle: "Security alerts available for investigation and mitigation analysis."
      };
    }
    if (path.startsWith("/analysis")) {
      return {
        title: "Mitigation Analysis",
        subtitle: "AI-retrieved mitigation steps and source verification."
      };
    }
    if (path.startsWith("/knowledge")) {
      return {
        title: "Knowledge Base",
        subtitle: "Manage the security documents used by AlertIQ to retrieve mitigation guidance."
      };
    }
    if (path.startsWith("/history")) {
      return {
        title: "Analysis History",
        subtitle: "Review previous mitigation retrieval activities and confidence reports."
      };
    }
    if (path.startsWith("/settings")) {
      return {
        title: "System Settings",
        subtitle: "Configure RAG parameters, ingestion settings, and source weights."
      };
    }
    return {
      title: "AlertIQ Portal",
      subtitle: "Securing organizations through grounded RAG advisories."
    };
  };

  const pageInfo = getPageTitleInfo();

  // Mock system notifications for the bell icon
  const notifications = [
    { id: 1, text: "New high-severity alert forwarded from EDR", time: "5m ago", unread: true },
    { id: 2, text: "Knowledge Base indexing complete: 3 files added", time: "1h ago", unread: false },
    { id: 3, text: "Failed login threshold exceeded on AUTH-SERVER-04", time: "2h ago", unread: false }
  ];

  return (
    <header className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/60 backdrop-blur-md sticky top-0 z-10 w-full">
      {/* Left Title Area */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 leading-tight">
          {pageInfo.title}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">
          {pageInfo.subtitle}
        </p>
      </div>

      {/* Right Search, Notification, and User Avatar */}
      <div className="flex items-center gap-6">
        {/* Search Bar */}
        <div className="relative max-w-xs hidden md:block">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search alerts, assets, CVEs..."
            className="w-64 bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700 transition"
          />
        </div>

        {/* Notifications Icon & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300 hover:text-slate-100 transition relative"
          >
            <Bell size={16} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse-subtle" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-semibold text-slate-200">AlertIQ Notifications</span>
                <span className="text-[10px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full font-medium">
                  1 New
                </span>
              </div>
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={`p-2.5 rounded-lg text-xs leading-relaxed transition ${
                      n.unread ? "bg-slate-850/80 border border-slate-850" : "bg-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className={`font-medium ${n.unread ? "text-slate-200" : "text-slate-400"}`}>
                        {n.text}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Badge Info */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              SOC Server Status
            </span>
            <span className="text-xs text-emerald-400 font-bold flex items-center justify-end gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              RAG API Ready
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

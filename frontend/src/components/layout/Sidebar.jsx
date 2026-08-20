import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Shield, 
  LayoutDashboard, 
  AlertTriangle, 
  Database, 
  History as HistoryIcon, 
  Settings, 
  User 
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();
  
  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Active Alerts", path: "/alerts", icon: AlertTriangle },
    { name: "Knowledge Base", path: "/knowledge", icon: Database },
    { name: "History", path: "/history", icon: HistoryIcon }
  ];

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col h-screen sticky top-0 shrink-0 z-20">
      {/* Top Header Logo */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <Shield size={22} className="fill-rose-500/10" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 m-0 leading-tight">
            Alert<span className="text-rose-500">IQ</span>
          </h1>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5 tracking-wide uppercase">
            Cybersecurity Mitigation
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-slate-800/80 text-rose-400 border-l-2 border-rose-500 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              <Icon size={18} className={active ? "text-rose-500" : "text-slate-400"} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile / Settings */}
      <div className="p-4 border-t border-slate-800 space-y-4">
        {/* Settings Button */}
        <Link
          to="/settings"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 transition-all"
        >
          <Settings size={18} />
          Settings
        </Link>

        {/* User Card */}
        <div className="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-rose-500 font-bold font-mono">
            AM
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-200 truncate">
              Alex Morgan
            </h4>
            <span className="text-xs text-slate-400 truncate block">
              Security Analyst
            </span>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" title="System Connected" />
        </div>
      </div>
    </aside>
  );
}

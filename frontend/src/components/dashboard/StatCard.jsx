import React from "react";

export default function StatCard({ title, value, subtext, icon: Icon, colorClass = "text-rose-500", bgClass = "bg-rose-500/10 border-rose-500/20" }) {
  return (
    <div className="glass-panel glass-panel-hover p-6 rounded-xl flex items-center justify-between transition-all duration-300">
      <div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
          {title}
        </span>
        <h3 className="text-3xl font-extrabold text-slate-100 mt-2 tracking-tight">
          {value}
        </h3>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          {subtext}
        </p>
      </div>
      <div className={`p-3.5 rounded-xl border ${bgClass} ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
  );
}

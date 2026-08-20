import React from "react";

export default function SeverityBadge({ severity }) {
  const getStyles = () => {
    switch (severity?.toUpperCase()) {
      case "CRITICAL":
        return {
          bg: "bg-red-500/10 border-red-500/30 text-red-400",
          label: "CRITICAL"
        };
      case "HIGH":
        return {
          bg: "bg-orange-500/10 border-orange-500/30 text-orange-400",
          label: "HIGH"
        };
      case "MEDIUM":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          label: "MEDIUM"
        };
      case "LOW":
        return {
          bg: "bg-blue-500/10 border-blue-500/30 text-blue-400",
          label: "LOW"
        };
      default:
        return {
          bg: "bg-slate-500/10 border-slate-500/30 text-slate-400",
          label: severity || "UNKNOWN"
        };
    }
  };

  const styles = getStyles();

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${styles.bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {styles.label}
    </span>
  );
}

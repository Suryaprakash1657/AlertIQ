export const mockAlerts = [
  {
    id: "ALT-2026-001",
    title: "Suspicious PowerShell Activity",
    severity: "HIGH",
    affectedAsset: "PC-102",
    source: "Endpoint Detection System",
    description: "Unusual PowerShell execution was detected on the endpoint. The command attempted to bypass execution policy and download a remote script.",
    status: "New",
    detectedTime: "Aug 20, 2026, 10:42 AM",
    timestamp: "2026-08-20T10:42:00Z"
  },
  {
    id: "ALT-2026-002",
    title: "Potential Ransomware Activity",
    severity: "CRITICAL",
    affectedAsset: "SERVER-01",
    source: "Security Monitoring Platform",
    description: "Multiple suspicious file modification events were detected in quick succession within the shared drive. High CPU utilization and encryption signatures observed.",
    status: "In Progress",
    detectedTime: "Aug 20, 2026, 09:15 AM",
    timestamp: "2026-08-20T09:15:00Z"
  },
  {
    id: "ALT-2026-003",
    title: "Multiple Failed Login Attempts",
    severity: "MEDIUM",
    affectedAsset: "AUTH-SERVER-04",
    source: "Identity Monitoring System",
    description: "Repeated authentication failures were detected from an unusual source IP. Brute force behavior suspected against administrator account.",
    status: "New",
    detectedTime: "Aug 19, 2026, 11:30 PM",
    timestamp: "2026-08-19T23:30:00Z"
  },
  {
    id: "ALT-2026-004",
    title: "Critical Vulnerability Detected",
    severity: "HIGH",
    affectedAsset: "WEB-SERVER-02",
    source: "Vulnerability Scanner",
    description: "A critical remote code execution vulnerability (CVE-2026-1033) requiring immediate mitigation was identified in the web server framework.",
    status: "New",
    detectedTime: "Aug 19, 2026, 02:45 PM",
    timestamp: "2026-08-19T14:45:00Z"
  },
  {
    id: "ALT-2026-005",
    title: "Anomalous Data Outflow",
    severity: "LOW",
    affectedAsset: "WORKSTATION-88",
    source: "Network Traffic Monitor",
    description: "Minor spike in outgoing network traffic detected during off-hours. Standard backup schedule is not configured for this node.",
    status: "Resolved",
    detectedTime: "Aug 18, 2026, 04:20 PM",
    timestamp: "2026-08-18T16:20:00Z"
  },
  {
    id: "ALT-2026-006",
    title: "Suspicious Registry Modification",
    severity: "CRITICAL",
    affectedAsset: "SERVER-09",
    source: "Threat Intelligence Hub",
    description: "Attempted change to key system registry values associated with known malware. However, the system cannot correlate this with any local database logs.",
    status: "New",
    detectedTime: "Aug 18, 2026, 08:12 AM",
    timestamp: "2026-08-18T08:12:00Z",
    lowConfidenceTrigger: true // Indicates that AlertIQ will return low confidence/insufficient evidence state
  }
];

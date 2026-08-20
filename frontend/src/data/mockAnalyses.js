export const mockAnalyses = {
  "ALT-2026-001": {
    alertId: "ALT-2026-001",
    summary: "Demonstration RAG Output: Relevant response guidance was found based on the indexed security documents. These steps are simulated for the frontend prototype and should not be used as real universal cybersecurity instructions.",
    recommendedMitigations: [
      "Follow the organization's documented containment procedure for the affected endpoint. Isolate PC-102 from the network immediately to prevent potential command-and-control connection.",
      "Preserve relevant logs (PowerShell Event Log 4104 and Process Creation Event 4688) and investigation evidence before making irreversible changes, as required by the runbook.",
      "Investigate the suspicious parent process and command-and-control IP endpoints associated with the powershell.exe execution.",
      "Continue with the documented incident response and escalation procedure to Tier 2 if lateral movement is suspected."
    ],
    confidence: "High",
    retrievedSources: ["DOC-001", "DOC-002", "DOC-003"],
    followUpResponses: {
      "Why was this source selected?": "The source 'PowerShell Incident Response Runbook' (DOC-001) was selected because it matches the alert keywords (PowerShell execution, Containment) and contains specific host isolation instructions for PC hosts. 'Endpoint Threat Intelligence Report' (DOC-002) matches script signatures.",
      "Show more context": "According to the PowerShell Incident Runbook (DOC-001), executing command strings with execution bypass flags (-ep bypass) indicates an active intrusion attempt. Containment must happen within 15 minutes of detection.",
      "What evidence supports this recommendation?": "The recommendation to isolate the host is supported by DOC-001, Section: Containment Procedure. Preserving Script Block Logging (Event ID 4104) is supported by DOC-002, Section: Recommended Response."
    }
  },
  "ALT-2026-002": {
    alertId: "ALT-2026-002",
    summary: "Demonstration RAG Output: Ransomware signature mitigation procedure retrieved from incident playbook. High criticality containment required. (Demo prototype guidance - not for real operations).",
    recommendedMitigations: [
      "Perform immediate host isolation of SERVER-01. Disable the Active Directory machine account temporarily to stop lateral network encryption.",
      "Locate and terminate the parent process generating rapid file writes. Inspect high CPU processes using tasklist or EDR console.",
      "Preserve volume shadow copies and system restore states if encryption is incomplete. Do not reboot system to prevent ransomware autorun.",
      "Initiate the ransomware recovery checklist: locate clean backup sets and notify the incident management team."
    ],
    confidence: "High",
    retrievedSources: ["DOC-001", "DOC-003", "DOC-005"],
    followUpResponses: {
      "Why was this source selected?": "Selected sources cover host containment (DOC-001), security escalations (DOC-003), and account lockouts (DOC-005) which apply directly to credential misuse in network ransomware scenarios.",
      "Show more context": "The Security Operations Guide (DOC-003) indicates that high-rate file encryption on servers must be escalated directly to Tier 3 response leaders and external CSIRT teams.",
      "What evidence supports this recommendation?": "DOC-001 specifies containment procedures, and DOC-005 guides brute-force/account lockouts which typically precede ransomware deployments."
    }
  },
  "ALT-2026-003": {
    alertId: "ALT-2026-003",
    summary: "Demonstration RAG Output: Authentication brute force mitigation steps retrieved. Medium severity lockout response. (Demo prototype guidance - not for real operations).",
    recommendedMitigations: [
      "Initiate a temporary lockout on the targeted Administrator account in Active Directory.",
      "Identify the source IP from security logs on AUTH-SERVER-04 and block it at the edge firewall.",
      "Invalidate all active token sessions for the affected user and require MFA re-registration.",
      "Audit success logins from the source IP to ensure no successful brute-force compromise occurred."
    ],
    confidence: "Medium",
    retrievedSources: ["DOC-005", "DOC-003"],
    followUpResponses: {
      "Why was this source selected?": "Selected DOC-005 because it is the specialized runbook for Brute Force and Account Lockouts, containing specific IP blocking guidelines.",
      "Show more context": "Under the authentication runbook, any account with more than 10 failed login attempts within 5 minutes must undergo temporary lockout and credential invalidation.",
      "What evidence supports this recommendation?": "Runbook DOC-005, Section: Authentication Attacks outlines the lockout workflow and source IP blocking procedures."
    }
  },
  "ALT-2026-004": {
    alertId: "ALT-2026-004",
    summary: "Demonstration RAG Output: Patching and firewall mitigation steps retrieved for web application vulnerability CVE-2026-1033. (Demo prototype guidance - not for real operations).",
    recommendedMitigations: [
      "Apply the configuration hotfix immediately: set 'HeaderSanitization: true' in the web app framework config (app-config.json).",
      "Deploy a custom pattern matching rule on the Web Application Firewall (WAF) to filter malicious headers.",
      "Schedule an out-of-band upgrade for the web-framework-core dependency package to v2.5.0.",
      "Verify that WEB-SERVER-02 does not have write access to critical root directory assets."
    ],
    confidence: "High",
    retrievedSources: ["DOC-004", "DOC-003"],
    followUpResponses: {
      "Why was this source selected?": "The vulnerability advisory DOC-004 contains the specific CVE identifier CVE-2026-1033 and detailed hotfix configuration options.",
      "Show more context": "DOC-004 states that the vulnerability is exploited via unauthenticated HTTP header payloads. Enabling header sanitization is the quickest mitigation before patching.",
      "What evidence supports this recommendation?": "Advisory DOC-004, Section: Hotfix Mitigation outlines the specific steps of changing 'HeaderSanitization' to true in the configuration file."
    }
  },
  "ALT-2026-005": {
    alertId: "ALT-2026-005",
    summary: "Demonstration RAG Output: Standard operational traffic checks retrieved. Network analysis recommended. (Demo prototype guidance - not for real operations).",
    recommendedMitigations: [
      "Compare outbound traffic logs against standard host activity baseline.",
      "Identify the destination IP and cross-reference with domain reputation services.",
      "Confirm with the system owner of WORKSTATION-88 if any large files were transferred manually.",
      "Review the current backup schedule and determine if it caused the unexpected transmission."
    ],
    confidence: "Medium",
    retrievedSources: ["DOC-003"],
    followUpResponses: {
      "Why was this source selected?": "The general response guide (DOC-003) was retrieved to establish verification of true positives vs false positives.",
      "Show more context": "Anomalous outbound spikes are often false positives due to backup updates, but must be checked for potential data exfiltration indicator of compromise.",
      "What evidence supports this recommendation?": "DOC-003, Section: Severity Verification recommends checking contextual data (e.g. host utility, user history) to classify anomalies."
    }
  },
  "ALT-2026-006": {
    alertId: "ALT-2026-006",
    summary: "",
    recommendedMitigations: [],
    confidence: "Low",
    retrievedSources: [],
    lowConfidence: true,
    followUpResponses: {}
  }
};

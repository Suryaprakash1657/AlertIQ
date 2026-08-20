export const mockDocuments = [
  {
    id: "DOC-001",
    title: "PowerShell Incident Response Runbook",
    type: "Incident Runbook",
    status: "Indexed",
    chunks: 42,
    lastUpdated: "Aug 18, 2026",
    description: "Standard operating procedures for managing unauthorized PowerShell script execution, containment actions, and credential audits.",
    content: `Incident Runbook: PowerShell Threat Containment Procedures
Section: Containment Procedure

Overview:
PowerShell is frequently abused by threat actors to execute code in memory, bypass local logging, and download payloads. This runbook details isolation and triage steps.

Mitigation Actions:
1. Host Containment:
   If suspicious PowerShell activity is detected (e.g., download strings, execution policy bypass, or encoded command strings), immediately isolate the host from the network.
   Use endpoint containment software or disable the network adapter at the switch port level.
   
2. Log Preservation:
   Do not reboot the system. Reboots wipe volatile memory (RAM) and can overwrite security logs.
   Collect and export the following logs:
   - Microsoft-Windows-PowerShell/Operational (Event ID 4104 - Script Block Logging)
   - Microsoft-Windows-PowerShell/Analytic
   - Security Event Log (Event ID 4688 - Process Creation with Command Line Arguments enabled)
   
3. Process Investigation:
   Identify the parent process that spawned PowerShell. Commonly, web servers, document readers, or mail clients spawning powershell.exe indicate exploit activity.
   
4. Remediation:
   Revoke credentials of any users logged into the system during the alert window. Run a full endpoint scan using the local security agent.`
  },
  {
    id: "DOC-002",
    title: "Endpoint Threat Intelligence Report",
    type: "Threat Intelligence",
    status: "Indexed",
    chunks: 28,
    lastUpdated: "Aug 16, 2026",
    description: "Intelligence report outlining recent lateral movement techniques, PowerShell script signatures, and command-and-control server domains.",
    content: `Threat Intelligence Report: Active Host Intrusion Campaigns
Section: Recommended Response

Technical Details:
Our security research team has observed threat groups utilizing highly obfuscated PowerShell scripts for downloading loader binaries.
These campaigns use specific command arguments including:
- -ExecutionPolicy Bypass (or -ep bypass)
- -WindowStyle Hidden (or -w hidden)
- -EncodedCommand (or -enc)

Response Guidelines:
1. Block Known Command Signatures:
   Configure host-based firewall policies to block outgoing connections from powershell.exe and cmd.exe to external public IP addresses. Only authorized administration gateways should be whitelisted.
   
2. Audit Script Blocks:
   Search Script Block Logs (ID 4104) for download patterns such as 'Net.WebClient', 'DownloadString', or 'Invoke-WebRequest'.
   
3. Verify Asset Risk Profile:
   Ensure PC assets are running the latest endpoint protection agent (EDR) with script interception enabled (AMSI - Antimalware Scan Interface).`
  },
  {
    id: "DOC-003",
    title: "Security Operations Response Guide",
    type: "Incident Runbook",
    status: "Indexed",
    chunks: 35,
    lastUpdated: "Aug 15, 2026",
    description: "General SOC guidance on triage levels, escalation chains, and standard evidence preservation formats.",
    content: `SOC Response Guide: Triage and Escalation
Section: Investigation and Escalation

Procedures:
1. Severity Verification:
   Confirm whether the alert represents a true positive (TP) by reviewing contextual data like execution path, host criticality, and access history.
   
2. Escalation Hierarchy:
   - Tier 1: Initial alert detection and confirmation. Host containment of non-critical workstations.
   - Tier 2: Deeper forensic investigation. Server-level incident response.
   - Tier 3: Communication with executive team, legal department, and external CSIRT if ransomware or data exfiltration is verified.
   
3. Resolution Recording:
   Log all mitigation actions in the central ticketing system. Document which systems were isolated, which accounts were disabled, and the timestamp of resolution.`
  },
  {
    id: "DOC-004",
    title: "Critical Vulnerability Advisory: CVE-2026-1033",
    type: "Vulnerability Advisory",
    status: "Indexed",
    chunks: 15,
    lastUpdated: "Aug 12, 2026",
    description: "Advisory for CVE-2026-1033 Remote Code Execution in Web App Framework. Contains immediate hotfix configuration commands.",
    content: `Vulnerability Advisory: CVE-2026-1033 Remote Code Execution
Applies to: Web Application Server Framework v2.4.0 through v2.4.9

Background:
A remote code execution vulnerability exists in the input validation controller of the Web App Framework. An unauthenticated attacker can exploit this vulnerability by sending a crafted HTTP header request containing executable payloads.

Hotfix Mitigation:
1. Apply Configuration Workaround:
   If patching cannot be scheduled immediately, modify the application config file (app-config.json) to set 'HeaderSanitization: true' and 'ValidateInputHeaders: true'.
   Restart the application service to apply changes.
   
2. Update Dependency:
   Upgrade the framework package to version 2.5.0 or later using the package manager.
   Run: npm update web-framework-core
   
3. Web Application Firewall (WAF):
   Deploy a custom inspection rule on the WAF to block any incoming HTTP requests that contain scripting syntax in standard header fields.`
  },
  {
    id: "DOC-005",
    title: "Brute Force and Account Lockout Runbook",
    type: "Incident Runbook",
    status: "Indexed",
    chunks: 18,
    lastUpdated: "Aug 10, 2026",
    description: "Procedures for mitigating active identity attacks, resetting domain passwords, and tracking brute force sources.",
    content: `Incident Runbook: Brute Force & Identity Mitigation
Section: Authentication Attacks

Response Steps:
1. Temporary Account Lockout:
   If an account is receiving multiple failed login attempts, verify if the lockout policy has triggered automatically. If not, manually disable the account temporarily in Active Directory.
   
2. Geolocation Analysis:
   Analyze the IP addresses of the failed authentications. If they originate from outside the organization's expected geographic range, implement an IP-level block on the identity provider edge.
   
3. Password Reset:
   Force an immediate password reset and invalidate all active session tokens for the affected user account. Require multi-factor authentication (MFA) re-registration if token hijacking is suspected.`
  },
  {
    id: "DOC-006",
    title: "Active Directory Remediation Guide",
    type: "Incident Runbook",
    status: "Processing",
    chunks: 0,
    lastUpdated: "Aug 20, 2026",
    description: "Draft guide for domain controller disaster recovery and security hardening.",
    content: `Document is currently being processed by the AlertIQ indexing queue. Embedding generation is 40% complete...`
  },
  {
    id: "DOC-007",
    title: "Outdated Windows Kernel Vulnerability Advisory",
    type: "Vulnerability Advisory",
    status: "Failed",
    chunks: 0,
    lastUpdated: "Aug 05, 2026",
    description: "Failed document ingestion due to unsupported file format / encoding issues.",
    content: `Failed to index. Reason: File format parser error. Document contains corrupted binary data in header block.`
  }
];

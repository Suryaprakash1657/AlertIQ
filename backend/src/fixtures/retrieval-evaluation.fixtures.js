/**
 * Deterministic Retrieval Evaluation Fixtures for AlertIQ
 *
 * Provides curated cybersecurity benchmark knowledge documents, deterministic 768-dimensional
 * unit embeddings, and evaluation test cases across positive, multi-relevant, ambiguous,
 * negative, and not-indexed query categories.
 */

/**
 * Generates a deterministic, normalized 768-dimensional unit vector for a given cluster.
 * Ensures reproducible, provider-independent cosine similarity geometry.
 *
 * @param {number} clusterIndex - Topic cluster index (0-9).
 * @param {number} [variation=0] - Small variation offset for chunks within the same document/topic.
 * @param {number} [dimensions=768] - Total vector dimensions.
 * @returns {number[]} Normalized 768-dimensional vector.
 */
export const createDeterministicVector = (clusterIndex, variation = 0, dimensions = 768) => {
  const vec = new Array(dimensions).fill(0.001);
  const clusterSize = 48; // Each cluster dominates a 48-dimension block
  const startIdx = (clusterIndex * clusterSize) % (dimensions - clusterSize);

  for (let i = 0; i < clusterSize; i++) {
    const pos = startIdx + i;
    // Dominant signal with variation
    const signal = 1.0 + Math.sin(i * 0.5 + variation * 0.3) * 0.2;
    vec[pos] = signal;
  }

  // Add slight deterministic background noise across full vector
  for (let i = 0; i < dimensions; i++) {
    vec[i] += Math.sin(i * 1.337 + clusterIndex + variation) * 0.02;
  }

  // Normalize to unit length (magnitude = 1.0)
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vec[i] * vec[i];
  }
  const mag = Math.sqrt(sumSq) || 1.0;
  return vec.map((v) => parseFloat((v / mag).toFixed(8)));
};

/**
 * Benchmark Cybersecurity Knowledge Base Documents
 */
export const benchmarkDocuments = [
  {
    id: "doc-ir-ransomware-01",
    title: "Ransomware Incident Response & Host Isolation Runbook",
    source: "SOC Playbooks v2.4",
    category: "incident_response",
    content: "Ransomware containment requires immediate network isolation of infected hosts. Terminate suspicious processes and preserve memory artifacts before system shutdown. Check Volume Shadow Copies and disable compromised Active Directory accounts to prevent lateral movement.",
    chunks: [
      {
        id: "chunk-rw-01",
        documentId: "doc-ir-ransomware-01",
        chunkIndex: 0,
        totalChunks: 2,
        content: "Ransomware containment requires immediate network isolation of infected hosts. Terminate suspicious processes and preserve memory artifacts before system shutdown.",
        metadata: { documentTitle: "Ransomware Incident Response & Host Isolation Runbook", category: "incident_response", source: "SOC Playbooks v2.4" },
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: createDeterministicVector(0, 0),
          generatedAt: "2026-09-07T12:00:00.000Z"
        }
      },
      {
        id: "chunk-rw-02",
        documentId: "doc-ir-ransomware-01",
        chunkIndex: 1,
        totalChunks: 2,
        content: "Check Volume Shadow Copies and disable compromised Active Directory accounts to prevent lateral movement.",
        metadata: { documentTitle: "Ransomware Incident Response & Host Isolation Runbook", category: "incident_response", source: "SOC Playbooks v2.4" },
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: createDeterministicVector(0, 1),
          generatedAt: "2026-09-07T12:00:00.000Z"
        }
      }
    ]
  },
  {
    id: "doc-ir-powershell-02",
    title: "Suspicious PowerShell Execution & Obfuscation Playbook",
    source: "Endpoint Detection Runbooks",
    category: "endpoint_defense",
    content: "When base64 encoded PowerShell commands or -EncodedCommand flags are observed, decode script blocks to identify malicious payloads. Inspect ScriptBlock logging (Event ID 4104) and parent process trees.",
    chunks: [
      {
        id: "chunk-ps-01",
        documentId: "doc-ir-powershell-02",
        chunkIndex: 0,
        totalChunks: 1,
        content: "When base64 encoded PowerShell commands or -EncodedCommand flags are observed, decode script blocks to identify malicious payloads. Inspect ScriptBlock logging (Event ID 4104) and parent process trees.",
        metadata: { documentTitle: "Suspicious PowerShell Execution & Obfuscation Playbook", category: "endpoint_defense", source: "Endpoint Detection Runbooks" },
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: createDeterministicVector(1, 0),
          generatedAt: "2026-09-07T12:00:00.000Z"
        }
      }
    ]
  },
  {
    id: "doc-ir-ssh-03",
    title: "Linux SSH Brute Force Mitigation Runbook",
    source: "Infrastructure Security",
    category: "network_security",
    content: "Repeated failed authentication attempts over port 22 indicate SSH brute forcing. Deploy Fail2ban rate limiting, enforce public-key authentication, and block source IPs at the firewall perimeter.",
    chunks: [
      {
        id: "chunk-ssh-01",
        documentId: "doc-ir-ssh-03",
        chunkIndex: 0,
        totalChunks: 1,
        content: "Repeated failed authentication attempts over port 22 indicate SSH brute forcing. Deploy Fail2ban rate limiting, enforce public-key authentication, and block source IPs at the firewall perimeter.",
        metadata: { documentTitle: "Linux SSH Brute Force Mitigation Runbook", category: "network_security", source: "Infrastructure Security" },
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: createDeterministicVector(2, 0),
          generatedAt: "2026-09-07T12:00:00.000Z"
        }
      }
    ]
  },
  {
    id: "doc-ir-sqli-04",
    title: "SQL Injection Detection & WAF Remediation Guide",
    source: "AppSec Guidelines",
    category: "application_security",
    content: "Inspect web server and WAF logs for UNION SELECT, 1=1 boolean-based SQL injection, and database fingerprinting patterns. Apply parameterized queries in backend code and update WAF block rules.",
    chunks: [
      {
        id: "chunk-sqli-01",
        documentId: "doc-ir-sqli-04",
        chunkIndex: 0,
        totalChunks: 1,
        content: "Inspect web server and WAF logs for UNION SELECT, 1=1 boolean-based SQL injection, and database fingerprinting patterns. Apply parameterized queries in backend code and update WAF block rules.",
        metadata: { documentTitle: "SQL Injection Detection & WAF Remediation Guide", category: "application_security", source: "AppSec Guidelines" },
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: createDeterministicVector(3, 0),
          generatedAt: "2026-09-07T12:00:00.000Z"
        }
      }
    ]
  },
  {
    id: "doc-ir-dns-05",
    title: "DNS Tunneling & Covert Data Exfiltration Playbook",
    source: "SOC Playbooks v2.4",
    category: "network_security",
    content: "High volume of TXT queries and high-entropy subdomains indicate DNS data exfiltration or tunneling. Sinkhole malicious nameservers and review DNS resolver telemetry.",
    chunks: [
      {
        id: "chunk-dns-01",
        documentId: "doc-ir-dns-05",
        chunkIndex: 0,
        totalChunks: 1,
        content: "High volume of TXT queries and high-entropy subdomains indicate DNS data exfiltration or tunneling. Sinkhole malicious nameservers and review DNS resolver telemetry.",
        metadata: { documentTitle: "DNS Tunneling & Covert Data Exfiltration Playbook", category: "network_security", source: "SOC Playbooks v2.4" },
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: createDeterministicVector(4, 0),
          generatedAt: "2026-09-07T12:00:00.000Z"
        }
      }
    ]
  }
];

/**
 * Benchmark Evaluation Test Cases
 */
export const benchmarkTestCases = [
  {
    id: "case-01-ransomware-positive",
    type: "positive",
    name: "Ransomware containment query",
    queryText: "Ransomware detection host isolation and shadow copy check",
    queryEmbedding: createDeterministicVector(0, 0.1),
    expectedRelevantDocIds: ["doc-ir-ransomware-01"]
  },
  {
    id: "case-02-powershell-positive",
    type: "positive",
    name: "Encoded PowerShell execution investigation",
    queryText: "Base64 encoded powershell execution event 4104 scriptblock",
    queryEmbedding: createDeterministicVector(1, 0.1),
    expectedRelevantDocIds: ["doc-ir-powershell-02"]
  },
  {
    id: "case-03-ssh-positive",
    type: "positive",
    name: "SSH brute force authentication attack",
    queryText: "SSH port 22 failed authentication attempts fail2ban rate limit",
    queryEmbedding: createDeterministicVector(2, 0.1),
    expectedRelevantDocIds: ["doc-ir-ssh-03"]
  },
  {
    id: "case-04-sqli-positive",
    type: "positive",
    name: "SQL injection exploitation query",
    queryText: "SQL injection union select parameter validation WAF remediation",
    queryEmbedding: createDeterministicVector(3, 0.1),
    expectedRelevantDocIds: ["doc-ir-sqli-04"]
  },
  {
    id: "case-05-dns-positive",
    type: "positive",
    name: "DNS tunneling exfiltration query",
    queryText: "DNS tunneling high entropy subdomain TXT record exfiltration",
    queryEmbedding: createDeterministicVector(4, 0.1),
    expectedRelevantDocIds: ["doc-ir-dns-05"]
  },
  {
    id: "case-06-multi-relevant",
    type: "multi_relevant",
    name: "PowerShell ransomware dropper combination",
    queryText: "PowerShell script downloading ransomware and attempting host encryption",
    // Blend of cluster 0 (ransomware) and cluster 1 (powershell)
    queryEmbedding: (() => {
      const v0 = createDeterministicVector(0, 0.05);
      const v1 = createDeterministicVector(1, 0.05);
      const blended = v0.map((val, idx) => val * 0.7 + v1[idx] * 0.7);
      let sumSq = 0;
      for (const b of blended) sumSq += b * b;
      const mag = Math.sqrt(sumSq) || 1;
      return blended.map((b) => parseFloat((b / mag).toFixed(8)));
    })(),
    expectedRelevantDocIds: ["doc-ir-ransomware-01", "doc-ir-powershell-02"]
  },
  {
    id: "case-07-ambiguous-distractor",
    type: "ambiguous",
    name: "Ambiguous network anomaly query",
    queryText: "Network outbound anomaly and suspicious connection spike",
    // Slight alignment with cluster 4 (DNS) but lower similarity
    queryEmbedding: createDeterministicVector(4, 3.5),
    expectedRelevantDocIds: ["doc-ir-dns-05"]
  },
  {
    id: "case-08-negative-printer",
    type: "negative",
    name: "Office printer driver configuration query",
    queryText: "How to configure standard TCP/IP office printer driver on Windows 11",
    queryEmbedding: createDeterministicVector(7, 0), // Completely orthogonal cluster
    expectedRelevantDocIds: []
  },
  {
    id: "case-09-negative-marketing",
    type: "negative",
    name: "Marketing email campaign inquiry",
    queryText: "Template for Q4 newsletter email blast and customer subscriber list",
    queryEmbedding: createDeterministicVector(8, 0), // Completely orthogonal cluster
    expectedRelevantDocIds: []
  },
  {
    id: "case-10-not-indexed-cloud-iam",
    type: "not_indexed",
    name: "AWS CloudTrail IAM compromised credentials playbook",
    queryText: "AWS CloudTrail IAM role assumption anomalous credential exposure",
    queryEmbedding: createDeterministicVector(9, 0),
    expectedRelevantDocIds: ["doc-ir-aws-iam-unindexed-99"] // Intentionally not in benchmarkDocuments
  }
];

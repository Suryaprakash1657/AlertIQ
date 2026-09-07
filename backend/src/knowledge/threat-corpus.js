/**
 * Threat Knowledge Base Corpus Registry for AlertIQ
 *
 * Aggregates, validates, and exports the 8 core defensive cybersecurity threat documents.
 * Each document represents a curated synthesis of authoritative guidance from recognized
 * organizations (CISA, NIST, MITRE ATT&CK, OWASP, NSA) and preserves source attribution.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadJson = (filename) => {
  const filePath = path.join(__dirname, "sources", filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
};

const ransomwareDoc = loadJson("ransomware.json");
const powershellDoc = loadJson("powershell-execution.json");
const sshBruteforceDoc = loadJson("ssh-bruteforce.json");
const sqliDoc = loadJson("sql-injection.json");
const dnsTunnelingDoc = loadJson("dns-tunneling.json");
const phishingDoc = loadJson("phishing.json");
const credentialTheftDoc = loadJson("credential-theft.json");
const dataExfiltrationDoc = loadJson("data-exfiltration.json");

/**
 * Complete immutable list of all 8 curated threat knowledge documents.
 */
export const THREAT_CORPUS_DOCUMENTS = Object.freeze([
  ransomwareDoc,
  powershellDoc,
  sshBruteforceDoc,
  sqliDoc,
  dnsTunnelingDoc,
  phishingDoc,
  credentialTheftDoc,
  dataExfiltrationDoc
]);

/**
 * Returns a cloned array of all threat knowledge documents in the corpus.
 *
 * @returns {Array<Object>} Cloned document list.
 */
export const getAllThreatDocuments = () => {
  return JSON.parse(JSON.stringify(THREAT_CORPUS_DOCUMENTS));
};

/**
 * Retrieves a specific threat document by its stable document identifier.
 *
 * @param {string} id - Stable document ID (e.g. "doc-threat-cisa-ransomware-01").
 * @returns {Object|null} Cloned document entity or null if not found.
 */
export const getThreatDocumentById = (id) => {
  if (!id || typeof id !== "string") {
    return null;
  }
  const match = THREAT_CORPUS_DOCUMENTS.find((doc) => doc.id === id.trim());
  return match ? JSON.parse(JSON.stringify(match)) : null;
};

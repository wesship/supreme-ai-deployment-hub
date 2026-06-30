/**
 * D3VONN Enterprise Governance — SOC2 / GDPR / HIPAA Frameworks
 *
 * Pre-built compliance frameworks with control catalogs,
 * automated checks, and certification readiness scoring.
 */

import type { ComplianceControl, ComplianceFramework } from "./compliance-center";

// ─────────────────────────────────────────────────────────────────
// SOC2 Trust Service Criteria
// ─────────────────────────────────────────────────────────────────

export interface SOC2Category {
  id: string;
  name: string;
  description: string;
  controls: ComplianceControl[];
}

export const SOC2_CATEGORIES: SOC2Category[] = [
  {
    id: "cc1",
    name: "Control Environment",
    description: "Management's commitment to integrity and ethical values",
    controls: [
      makeControl("SOC2", "CC1.1", "cc1", "Integrity and Ethical Values", "Organization demonstrates commitment to integrity and ethical values", "high"),
      makeControl("SOC2", "CC1.2", "cc1", "Board Oversight", "Board of directors demonstrates independence and oversight", "medium"),
      makeControl("SOC2", "CC1.3", "cc1", "Organizational Structure", "Management establishes structure, authority, and responsibility", "medium"),
      makeControl("SOC2", "CC1.4", "cc1", "Competence Commitment", "Organization demonstrates commitment to competence", "medium"),
      makeControl("SOC2", "CC1.5", "cc1", "Accountability", "Organization holds individuals accountable for internal control", "high"),
    ],
  },
  {
    id: "cc2",
    name: "Communication and Information",
    description: "Information quality and internal/external communication",
    controls: [
      makeControl("SOC2", "CC2.1", "cc2", "Information Quality", "Organization obtains relevant quality information", "medium"),
      makeControl("SOC2", "CC2.2", "cc2", "Internal Communication", "Organization internally communicates information", "low"),
      makeControl("SOC2", "CC2.3", "cc2", "External Communication", "Organization communicates with external parties", "medium"),
    ],
  },
  {
    id: "cc6",
    name: "Logical and Physical Access",
    description: "Controls over logical and physical access to systems",
    controls: [
      makeControl("SOC2", "CC6.1", "cc6", "Access Security", "Logical and physical access security software/infrastructure/architectures", "high"),
      makeControl("SOC2", "CC6.2", "cc6", "User Registration", "Prior to issuing credentials, registered and authorized", "high"),
      makeControl("SOC2", "CC6.3", "cc6", "Access Removal", "Removal of access to protected information when no longer needed", "high"),
      makeControl("SOC2", "CC6.6", "cc6", "Threat Management", "Measures against threats from outside system boundaries", "high"),
      makeControl("SOC2", "CC6.7", "cc6", "Data Transmission", "Restriction of transmission/movement of information", "medium"),
      makeControl("SOC2", "CC6.8", "cc6", "Unauthorized Software", "Prevention of unauthorized/malicious software", "high"),
    ],
  },
  {
    id: "cc7",
    name: "System Operations",
    description: "Detection and monitoring of system operations",
    controls: [
      makeControl("SOC2", "CC7.1", "cc7", "Vulnerability Detection", "Detection of vulnerabilities and anomalies", "high"),
      makeControl("SOC2", "CC7.2", "cc7", "Incident Monitoring", "Monitoring of system components for anomalies", "high"),
      makeControl("SOC2", "CC7.3", "cc7", "Security Incident Response", "Evaluation and response to security incidents", "high"),
      makeControl("SOC2", "CC7.4", "cc7", "Incident Recovery", "Recovery from identified security incidents", "medium"),
    ],
  },
  {
    id: "cc8",
    name: "Change Management",
    description: "Controls over system changes",
    controls: [
      makeControl("SOC2", "CC8.1", "cc8", "Change Authorization", "Authorization, design, development, configuration, and testing of changes", "high"),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// GDPR Articles
// ─────────────────────────────────────────────────────────────────

export interface GDPRArticle {
  id: string;
  article: string;
  title: string;
  controls: ComplianceControl[];
}

export const GDPR_ARTICLES: GDPRArticle[] = [
  {
    id: "gdpr_art5",
    article: "Article 5",
    title: "Principles relating to processing of personal data",
    controls: [
      makeControl("GDPR", "GDPR-5.1a", "art5", "Lawfulness", "Processing must be lawful, fair, and transparent", "high"),
      makeControl("GDPR", "GDPR-5.1b", "art5", "Purpose Limitation", "Data collected for specified, explicit, and legitimate purposes", "high"),
      makeControl("GDPR", "GDPR-5.1c", "art5", "Data Minimization", "Data must be adequate, relevant, and limited to what is necessary", "medium"),
      makeControl("GDPR", "GDPR-5.1d", "art5", "Accuracy", "Personal data must be accurate and kept up to date", "medium"),
      makeControl("GDPR", "GDPR-5.1e", "art5", "Storage Limitation", "Data kept no longer than necessary for purposes", "medium"),
      makeControl("GDPR", "GDPR-5.1f", "art5", "Integrity & Confidentiality", "Appropriate security of personal data", "high"),
    ],
  },
  {
    id: "gdpr_art12_22",
    article: "Articles 12-22",
    title: "Data Subject Rights",
    controls: [
      makeControl("GDPR", "GDPR-12", "art12", "Transparent Communication", "Transparent information, communication, and modalities", "high"),
      makeControl("GDPR", "GDPR-15", "art15", "Right of Access", "Data subject's right to access their personal data", "high"),
      makeControl("GDPR", "GDPR-17", "art17", "Right to Erasure", "Right to be forgotten / erasure of personal data", "high"),
      makeControl("GDPR", "GDPR-20", "art20", "Data Portability", "Right to receive data in structured, machine-readable format", "medium"),
    ],
  },
  {
    id: "gdpr_art25",
    article: "Article 25",
    title: "Data Protection by Design and Default",
    controls: [
      makeControl("GDPR", "GDPR-25.1", "art25", "Privacy by Design", "Implement appropriate technical and organisational measures", "high"),
      makeControl("GDPR", "GDPR-25.2", "art25", "Privacy by Default", "Only personal data necessary for each purpose is processed", "high"),
    ],
  },
  {
    id: "gdpr_art32",
    article: "Article 32",
    title: "Security of Processing",
    controls: [
      makeControl("GDPR", "GDPR-32.1a", "art32", "Encryption", "Pseudonymisation and encryption of personal data", "high"),
      makeControl("GDPR", "GDPR-32.1b", "art32", "CIA Assurance", "Ensure confidentiality, integrity, availability, and resilience", "high"),
      makeControl("GDPR", "GDPR-32.1c", "art32", "Disaster Recovery", "Ability to restore availability and access in timely manner", "medium"),
      makeControl("GDPR", "GDPR-32.1d", "art32", "Testing", "Process for regularly testing, assessing, evaluating effectiveness", "medium"),
    ],
  },
  {
    id: "gdpr_art33_34",
    article: "Articles 33-34",
    title: "Breach Notification",
    controls: [
      makeControl("GDPR", "GDPR-33", "art33", "Authority Notification", "Notify supervisory authority within 72 hours of breach", "high"),
      makeControl("GDPR", "GDPR-34", "art34", "Subject Notification", "Communicate breach to data subject without undue delay", "high"),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// HIPAA Safeguards
// ─────────────────────────────────────────────────────────────────

export interface HIPAASafeguard {
  id: string;
  category: "administrative" | "physical" | "technical";
  title: string;
  controls: ComplianceControl[];
}

export const HIPAA_SAFEGUARDS: HIPAASafeguard[] = [
  {
    id: "hipaa_admin",
    category: "administrative",
    title: "Administrative Safeguards",
    controls: [
      makeControl("HIPAA", "HIPAA-164.308a1", "admin", "Security Management", "Implement policies to prevent, detect, contain, correct violations", "high"),
      makeControl("HIPAA", "HIPAA-164.308a2", "admin", "Assigned Security Responsibility", "Identify security official responsible for policies", "high"),
      makeControl("HIPAA", "HIPAA-164.308a3", "admin", "Workforce Security", "Ensure appropriate access for workforce members", "high"),
      makeControl("HIPAA", "HIPAA-164.308a4", "admin", "Information Access Management", "Authorize access to ePHI consistent with policies", "high"),
      makeControl("HIPAA", "HIPAA-164.308a5", "admin", "Security Awareness Training", "Security awareness and training program for workforce", "medium"),
      makeControl("HIPAA", "HIPAA-164.308a6", "admin", "Security Incident Procedures", "Policies to address security incidents", "high"),
      makeControl("HIPAA", "HIPAA-164.308a7", "admin", "Contingency Plan", "Establish policies for responding to emergencies", "high"),
    ],
  },
  {
    id: "hipaa_physical",
    category: "physical",
    title: "Physical Safeguards",
    controls: [
      makeControl("HIPAA", "HIPAA-164.310a", "physical", "Facility Access Controls", "Limit physical access to electronic information systems", "high"),
      makeControl("HIPAA", "HIPAA-164.310b", "physical", "Workstation Use", "Specify proper functions and physical attributes of workstations", "medium"),
      makeControl("HIPAA", "HIPAA-164.310c", "physical", "Workstation Security", "Physical safeguards for all workstations accessing ePHI", "medium"),
      makeControl("HIPAA", "HIPAA-164.310d", "physical", "Device and Media Controls", "Policies governing receipt and removal of hardware/media", "medium"),
    ],
  },
  {
    id: "hipaa_technical",
    category: "technical",
    title: "Technical Safeguards",
    controls: [
      makeControl("HIPAA", "HIPAA-164.312a", "technical", "Access Control", "Technical policies to allow access only to authorized persons", "high"),
      makeControl("HIPAA", "HIPAA-164.312b", "technical", "Audit Controls", "Hardware, software, and procedures to record and examine access", "high"),
      makeControl("HIPAA", "HIPAA-164.312c", "technical", "Integrity", "Policies to protect ePHI from improper alteration or destruction", "high"),
      makeControl("HIPAA", "HIPAA-164.312d", "technical", "Person Authentication", "Procedures to verify identity of persons seeking access", "high"),
      makeControl("HIPAA", "HIPAA-164.312e", "technical", "Transmission Security", "Technical security measures to guard against unauthorized access during transmission", "high"),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// Framework Loader
// ─────────────────────────────────────────────────────────────────

export function loadFrameworkControls(framework: ComplianceFramework): ComplianceControl[] {
  switch (framework) {
    case "SOC2": return SOC2_CATEGORIES.flatMap((c) => c.controls);
    case "GDPR": return GDPR_ARTICLES.flatMap((a) => a.controls);
    case "HIPAA": return HIPAA_SAFEGUARDS.flatMap((s) => s.controls);
    default: return [];
  }
}

export function getFrameworkSummary(framework: ComplianceFramework): { name: string; totalControls: number; categories: number } {
  switch (framework) {
    case "SOC2": return { name: "SOC 2 Type II", totalControls: SOC2_CATEGORIES.flatMap((c) => c.controls).length, categories: SOC2_CATEGORIES.length };
    case "GDPR": return { name: "General Data Protection Regulation", totalControls: GDPR_ARTICLES.flatMap((a) => a.controls).length, categories: GDPR_ARTICLES.length };
    case "HIPAA": return { name: "Health Insurance Portability and Accountability Act", totalControls: HIPAA_SAFEGUARDS.flatMap((s) => s.controls).length, categories: HIPAA_SAFEGUARDS.length };
    default: return { name: framework, totalControls: 0, categories: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────

function makeControl(
  framework: ComplianceFramework,
  id: string,
  category: string,
  title: string,
  description: string,
  risk: "high" | "medium" | "low"
): ComplianceControl {
  return {
    id,
    framework,
    category,
    title,
    description,
    status: "planned",
    owner: "",
    evidence: [],
    lastAssessed: "",
    nextReview: "",
    risk,
    automatable: risk !== "high",
  };
}

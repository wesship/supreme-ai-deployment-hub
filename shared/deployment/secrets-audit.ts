/**
 * D3VONN Secrets Audit
 *
 * Scans codebase and configuration for accidentally committed secrets,
 * validates secret rotation policies, and ensures proper secret management.
 *
 * @module shared/deployment/secrets-audit
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type SecretSeverity = "critical" | "high" | "medium" | "low";
export type SecretStatus = "clean" | "exposed" | "rotated" | "expired" | "weak";

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: SecretSeverity;
  description: string;
  remediation: string;
}

export interface SecretFinding {
  id: string;
  pattern: string;
  file: string;
  line: number;
  severity: SecretSeverity;
  snippet: string;
  timestamp: string;
  status: "open" | "resolved" | "false_positive";
}

export interface SecretRotationPolicy {
  name: string;
  secretName: string;
  maxAgeDays: number;
  lastRotated: string;
  nextRotation: string;
  status: SecretStatus;
  owner: string;
}

export interface SecretsAuditReport {
  timestamp: string;
  findings: SecretFinding[];
  rotationPolicies: SecretRotationPolicy[];
  summary: {
    totalScanned: number;
    findings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    rotationCompliant: number;
    rotationOverdue: number;
    score: number;
  };
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────
// Secret Detection Patterns
// ─────────────────────────────────────────────────────────────────

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key",
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: "critical",
    description: "AWS access key ID detected",
    remediation: "Rotate the key immediately and use IAM roles or environment variables",
  },
  {
    name: "AWS Secret Key",
    pattern: /[0-9a-zA-Z/+]{40}/,
    severity: "critical",
    description: "Potential AWS secret access key",
    remediation: "Rotate the key and store in a secrets manager",
  },
  {
    name: "OpenAI API Key",
    pattern: /sk-[a-zA-Z0-9]{20,}/,
    severity: "high",
    description: "OpenAI API key detected",
    remediation: "Rotate the key and use environment variables",
  },
  {
    name: "Supabase Service Key",
    pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
    severity: "high",
    description: "JWT token (possibly Supabase service role key) detected",
    remediation: "Rotate the key and ensure it's only in environment variables",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/,
    severity: "critical",
    description: "Private key detected in source",
    remediation: "Remove immediately and regenerate the key pair",
  },
  {
    name: "GitHub Token",
    pattern: /gh[ps]_[A-Za-z0-9_]{36,}/,
    severity: "high",
    description: "GitHub personal access token detected",
    remediation: "Revoke the token and create a new one with minimal scopes",
  },
  {
    name: "Slack Webhook",
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/,
    severity: "medium",
    description: "Slack webhook URL detected",
    remediation: "Move to environment variables",
  },
  {
    name: "Database Connection String",
    pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+/,
    severity: "critical",
    description: "Database connection string with credentials detected",
    remediation: "Use environment variables for database connections",
  },
  {
    name: "Generic Password",
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    severity: "medium",
    description: "Hardcoded password detected",
    remediation: "Remove hardcoded passwords and use a secrets manager",
  },
  {
    name: "Pinecone API Key",
    pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    severity: "medium",
    description: "Potential Pinecone or UUID-format API key",
    remediation: "Verify if this is a secret and move to environment variables if so",
  },
  {
    name: "Sentry DSN",
    pattern: /https:\/\/[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io\/[0-9]+/,
    severity: "low",
    description: "Sentry DSN detected (low risk but should be in env vars)",
    remediation: "Move to environment variables for consistency",
  },
];

// ─────────────────────────────────────────────────────────────────
// Default Rotation Policies
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_ROTATION_POLICIES: SecretRotationPolicy[] = [
  {
    name: "OpenAI API Key Rotation",
    secretName: "OPENAI_API_KEY",
    maxAgeDays: 90,
    lastRotated: "2026-04-01T00:00:00Z",
    nextRotation: "2026-07-01T00:00:00Z",
    status: "clean",
    owner: "platform-team",
  },
  {
    name: "Supabase Service Key Rotation",
    secretName: "SUPABASE_SERVICE_ROLE_KEY",
    maxAgeDays: 180,
    lastRotated: "2026-01-15T00:00:00Z",
    nextRotation: "2026-07-15T00:00:00Z",
    status: "clean",
    owner: "infrastructure-team",
  },
  {
    name: "JWT Secret Rotation",
    secretName: "JWT_SECRET",
    maxAgeDays: 365,
    lastRotated: "2026-01-01T00:00:00Z",
    nextRotation: "2027-01-01T00:00:00Z",
    status: "clean",
    owner: "security-team",
  },
  {
    name: "Database Credentials Rotation",
    secretName: "DATABASE_URL",
    maxAgeDays: 90,
    lastRotated: "2026-05-01T00:00:00Z",
    nextRotation: "2026-07-30T00:00:00Z",
    status: "clean",
    owner: "infrastructure-team",
  },
  {
    name: "Pinecone API Key Rotation",
    secretName: "PINECONE_API_KEY",
    maxAgeDays: 180,
    lastRotated: "2026-03-01T00:00:00Z",
    nextRotation: "2026-09-01T00:00:00Z",
    status: "clean",
    owner: "ai-team",
  },
  {
    name: "Sentry Auth Token Rotation",
    secretName: "SENTRY_AUTH_TOKEN",
    maxAgeDays: 365,
    lastRotated: "2026-01-01T00:00:00Z",
    nextRotation: "2027-01-01T00:00:00Z",
    status: "clean",
    owner: "monitoring-team",
  },
];

// ─────────────────────────────────────────────────────────────────
// Secrets Auditor
// ─────────────────────────────────────────────────────────────────

export class SecretsAuditor {
  private patterns: SecretPattern[];
  private rotationPolicies: SecretRotationPolicy[];
  private findings: SecretFinding[] = [];
  private excludedPaths: string[] = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
    "*.test.ts",
    "*.spec.ts",
    "*.md",
  ];

  constructor(options?: {
    patterns?: SecretPattern[];
    rotationPolicies?: SecretRotationPolicy[];
    excludedPaths?: string[];
  }) {
    this.patterns = options?.patterns ?? SECRET_PATTERNS;
    this.rotationPolicies = options?.rotationPolicies ?? [...DEFAULT_ROTATION_POLICIES];
    if (options?.excludedPaths) {
      this.excludedPaths = options.excludedPaths;
    }
  }

  scanContent(content: string, filePath: string): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of this.patterns) {
        if (pattern.pattern.test(line)) {
          const finding: SecretFinding = {
            id: `finding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            pattern: pattern.name,
            file: filePath,
            line: i + 1,
            severity: pattern.severity,
            snippet: this.redactSnippet(line),
            timestamp: new Date().toISOString(),
            status: "open",
          };
          findings.push(finding);
          this.findings.push(finding);
        }
      }
    }

    return findings;
  }

  scanFiles(files: Array<{ path: string; content: string }>): SecretFinding[] {
    const allFindings: SecretFinding[] = [];

    for (const file of files) {
      if (this.isExcluded(file.path)) continue;
      const findings = this.scanContent(file.content, file.path);
      allFindings.push(...findings);
    }

    return allFindings;
  }

  checkRotationCompliance(): SecretRotationPolicy[] {
    const now = new Date();
    return this.rotationPolicies.map((policy) => {
      const nextRotation = new Date(policy.nextRotation);
      const lastRotated = new Date(policy.lastRotated);
      const ageDays = Math.floor((now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));

      let status: SecretStatus = "clean";
      if (ageDays > policy.maxAgeDays) {
        status = "expired";
      } else if (nextRotation < now) {
        status = "expired";
      } else if (ageDays > policy.maxAgeDays * 0.8) {
        status = "rotated"; // needs rotation soon
      }

      return { ...policy, status };
    });
  }

  generateReport(): SecretsAuditReport {
    const rotationStatus = this.checkRotationCompliance();
    const rotationCompliant = rotationStatus.filter((p) => p.status === "clean").length;
    const rotationOverdue = rotationStatus.filter((p) => p.status === "expired").length;

    const totalFindings = this.findings.filter((f) => f.status === "open").length;
    const critical = this.findings.filter((f) => f.severity === "critical" && f.status === "open").length;
    const high = this.findings.filter((f) => f.severity === "high" && f.status === "open").length;
    const medium = this.findings.filter((f) => f.severity === "medium" && f.status === "open").length;
    const low = this.findings.filter((f) => f.severity === "low" && f.status === "open").length;

    // Score: 100 - (critical*25 + high*15 + medium*5 + low*2) - (overdue*10)
    const deductions = critical * 25 + high * 15 + medium * 5 + low * 2 + rotationOverdue * 10;
    const score = Math.max(0, 100 - deductions);

    const recommendations: string[] = [];
    if (critical > 0) recommendations.push("URGENT: Remove critical secrets from source code immediately");
    if (high > 0) recommendations.push("Rotate exposed high-severity secrets within 24 hours");
    if (rotationOverdue > 0) recommendations.push(`Rotate ${rotationOverdue} overdue secret(s) per rotation policy`);
    if (totalFindings === 0 && rotationOverdue === 0) recommendations.push("All clear — maintain current secret hygiene practices");

    return {
      timestamp: new Date().toISOString(),
      findings: this.findings,
      rotationPolicies: rotationStatus,
      summary: {
        totalScanned: this.findings.length > 0 ? this.findings.length : 0,
        findings: totalFindings,
        critical,
        high,
        medium,
        low,
        rotationCompliant,
        rotationOverdue,
        score,
      },
      recommendations,
    };
  }

  resolveFinding(findingId: string): void {
    const finding = this.findings.find((f) => f.id === findingId);
    if (finding) finding.status = "resolved";
  }

  markFalsePositive(findingId: string): void {
    const finding = this.findings.find((f) => f.id === findingId);
    if (finding) finding.status = "false_positive";
  }

  getFindings(): SecretFinding[] {
    return [...this.findings];
  }

  clearFindings(): void {
    this.findings = [];
  }

  private isExcluded(filePath: string): boolean {
    return this.excludedPaths.some((excluded) => {
      if (excluded.startsWith("*")) {
        return filePath.endsWith(excluded.slice(1));
      }
      return filePath.includes(excluded);
    });
  }

  private redactSnippet(line: string): string {
    // Show first 20 chars and last 10, redact the middle
    if (line.length <= 40) return line.slice(0, 10) + "***REDACTED***";
    return line.slice(0, 20) + "***REDACTED***" + line.slice(-10);
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createSecretsAuditor(options?: {
  patterns?: SecretPattern[];
  rotationPolicies?: SecretRotationPolicy[];
}): SecretsAuditor {
  return new SecretsAuditor(options);
}

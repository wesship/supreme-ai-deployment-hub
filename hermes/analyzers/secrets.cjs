"use strict";
/**
 * hermes/analyzers/secrets.js
 *
 * Secret pattern analyzer for Hermes v2.
 */

const SECRET_PATTERNS = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub PAT", pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { name: "Stripe Secret Key", pattern: /sk_live_[a-zA-Z0-9]{24,}/g },
  { name: "Private Key Header", pattern: /-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/g },
  { name: "Generic Secret", pattern: /(?:SECRET|API_KEY|PRIVATE_KEY)\s*=\s*["']?[a-zA-Z0-9+/=_\-]{16,}/gi },
  { name: "Generic Password", pattern: /(?:PASSWORD|PASSWD)\s*=\s*["']?[^\s"']{8,}/gi },
];

const SAFE_PLACEHOLDER_PATTERNS = [
  /replace-with-/i,
  /placeholder/i,
  /your[-_]/i,
  /dummy/i,
  /changeme/i,
  /postgresql:\/\/user:password@host/i,
  /rediss:\/\/default:password@host/i,
];

function sanitizeDiffForPlaceholderExamples(diff) {
  return diff
    .split("\n")
    .filter((line) => {
      const isAddedLine = line.startsWith("+") && !line.startsWith("+++");
      if (!isAddedLine) return true;
      return !SAFE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(line));
    })
    .join("\n");
}

function scanForSecrets(diff) {
  const sanitizedDiff = sanitizeDiffForPlaceholderExamples(diff);
  const findings = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    const matches = sanitizedDiff.match(pattern);
    if (matches && matches.length > 0) {
      findings.push({ name, count: matches.length });
    }
  }

  return {
    found: findings.length > 0,
    findings,
  };
}

module.exports = { scanForSecrets, sanitizeDiffForPlaceholderExamples };

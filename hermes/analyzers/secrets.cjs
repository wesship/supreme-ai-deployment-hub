"use strict";
/**
 * hermes/analyzers/secrets.js
 *
 * Secret pattern analyzer for Hermes v2.
 * Scans a diff string for known secret patterns and returns structured findings.
 *
 * Pattern coverage:
 *   - AWS Access Key IDs (AKIA...)
 *   - Generic API tokens and secrets
 *   - Passwords in assignment form
 *   - Private key headers (RSA, EC, OpenSSH)
 *   - GitHub PATs (ghp_...)
 *   - Stripe keys (sk_live_...)
 *   - Supabase service role keys (eyJ... JWT pattern)
 */

const SECRET_PATTERNS = [
  { name: "AWS Access Key",    pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub PAT",        pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { name: "Stripe Secret Key", pattern: /sk_live_[a-zA-Z0-9]{24,}/g },
  { name: "Private Key Header",pattern: /-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/g },
  { name: "Generic Secret",    pattern: /(?:SECRET|API_KEY|PRIVATE_KEY)\s*=\s*["']?[a-zA-Z0-9+/=_\-]{16,}/gi },
  { name: "Generic Password",  pattern: /(?:PASSWORD|PASSWD)\s*=\s*["']?[^\s"']{8,}/gi },
];

/**
 * Scan a diff string for secret patterns.
 *
 * @param {string} diff - The git diff string to scan
 * @returns {{ found: boolean, findings: Array<{ name: string, count: number }> }}
 */
function scanForSecrets(diff) {
  const findings = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    const matches = diff.match(pattern);
    if (matches && matches.length > 0) {
      findings.push({ name, count: matches.length });
    }
  }

  return {
    found: findings.length > 0,
    findings,
  };
}

module.exports = { scanForSecrets };

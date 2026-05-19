# hermes/policies/security.rego
# Security-focused deny rules for the Hermes policy gate.

package hermes.security

import future.keywords.if

# Deny any commit containing secret patterns
deny contains msg if {
  input.riskSignals.hasSecrets
  msg := "Secrets or credentials detected in diff — remove before merging"
}

# Deny large infrastructure changes (high blast radius)
deny contains msg if {
  input.riskSignals.touchesInfra
  input.riskSignals.largeDiff
  msg := "Large infrastructure change detected — split into smaller PRs"
}

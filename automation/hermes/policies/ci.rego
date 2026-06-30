# hermes/policies/ci.rego
# CI/CD governance rules for the Hermes policy gate.

package hermes.ci

import future.keywords.if

# Block direct pushes to main by non-bot actors
deny contains msg if {
  input.branch == "main"
  not startswith(input.actor, "github-actions")
  not startswith(input.actor, "dependabot")
  msg := "Direct pushes to main are blocked — use a pull request"
}

# Warn on workflow file modifications (security review required)
warn contains msg if {
  input.riskSignals.touchesWorkflows
  msg := "GitHub Actions workflow files modified — review for security misconfigurations"
}

# Warn on infrastructure changes
warn contains msg if {
  input.riskSignals.touchesInfra
  not input.riskSignals.largeDiff
  msg := "Infrastructure files modified — ensure Terraform plan has been reviewed"
}

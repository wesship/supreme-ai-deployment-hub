# hermes/policies/main.rego
# Main Hermes policy bundle.
# Evaluated by the OPA engine (or the deterministic fallback in opa.js).
#
# Future: compile this with `opa build` and load via @open-policy-agent/opa-wasm

package hermes

import future.keywords.if
import future.keywords.in

default allow := false

# Allow if no deny rules triggered and no secrets present
allow if {
  not input.riskSignals.hasSecrets
  not blocked_branch
}

# Block direct pushes to main by humans
blocked_branch if {
  input.branch == "main"
  not startswith(input.actor, "github-actions")
  not startswith(input.actor, "dependabot")
}

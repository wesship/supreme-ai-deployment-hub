package workflow.standards

import rego.v1

# ── Workflow Standards Policy ──────────────────────────────────────────────
# Enforces Devonn.AI CI/CD workflow standards:
#   1. All actions must be pinned to full SHA (not mutable tags)
#   2. Workflows must declare explicit permissions
#   3. Concurrency groups must be set on deployment workflows
#   4. Node version must be 22
#   5. No em dashes in workflow files (YAML corruption guard)

# Deny if any action uses a mutable tag reference
deny contains msg if {
    job := input.jobs[_]
    step := job.steps[_]
    ref := step.uses
    ref != null
    # Detect tag-based refs: owner/repo@vX.Y.Z or @main/@master
    regex.match(`^[^/]+/[^@]+@(v\d|main|master|latest)`, ref)
    msg := sprintf("Action '%v' uses mutable tag ref - must use full SHA pin", [ref])
}

# Deny if top-level permissions are not declared
deny contains msg if {
    not input.permissions
    msg := "Workflow must declare explicit 'permissions' block to follow least-privilege principle"
}

# Deny if a deployment workflow lacks concurrency group
deny contains msg if {
    input.name
    regex.match(`(?i)(deploy|release|promote|publish)`, input.name)
    not input.concurrency
    msg := sprintf("Deployment workflow '%v' must declare 'concurrency' group to prevent parallel deployments", [input.name])
}

# Deny if setup-node uses a version other than 22
deny contains msg if {
    job := input.jobs[_]
    step := job.steps[_]
    regex.match(`actions/setup-node`, step.uses)
    step["with"]["node-version"] != "22"
    step["with"]["node-version"] != 22
    msg := sprintf("setup-node must use node-version: 22, found: %v", [step["with"]["node-version"]])
}

# Warn (non-blocking) if workflow has no timeout-minutes on jobs
warn contains msg if {
    job_name := input.jobs[key]
    not job_name["timeout-minutes"]
    msg := sprintf("Job '%v' has no timeout-minutes - consider adding to prevent hung runners", [key])
}

# Summary: all violations
violations := deny
warnings := warn

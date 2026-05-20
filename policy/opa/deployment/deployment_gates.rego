package deployment.gates

import rego.v1

# ── Deployment Gate Policy ─────────────────────────────────────────────────
# Enforces Devonn.AI deployment promotion rules:
#   1. Production deployments require manual approval
#   2. Canary traffic must not exceed 25%
#   3. Rollback must be defined for every production deployment
#   4. Smoke tests must pass before promotion
#   5. Artifact SHA must be verified before deployment

# Deny production deployment without manual approval environment
deny contains msg if {
    input.environment == "production"
    not input.requires_approval
    msg := "Production deployments MUST require manual approval (environment protection rule)"
}

# Deny canary traffic above safe threshold
deny contains msg if {
    input.canary_percentage > 25
    msg := sprintf("Canary traffic percentage %v%% exceeds maximum safe threshold of 25%%", [input.canary_percentage])
}

# Deny production deployment without rollback defined
deny contains msg if {
    input.environment == "production"
    not input.rollback_ref
    msg := "Production deployments must define a rollback_ref for instant recovery"
}

# Deny deployment if smoke tests did not pass
deny contains msg if {
    input.smoke_test_status != "passed"
    msg := sprintf("Deployment blocked: smoke tests status is '%v' (must be 'passed')", [input.smoke_test_status])
}

# Deny deployment if artifact SHA is not verified
deny contains msg if {
    not input.artifact_sha_verified
    msg := "Deployment blocked: artifact SHA verification not completed"
}

# Deny deployment to production from non-main branch
deny contains msg if {
    input.environment == "production"
    input.source_branch != "main"
    msg := sprintf("Production deployments must originate from 'main' branch, not '%v'", [input.source_branch])
}

# Allow if no violations
allow if {
    count(deny) == 0
}

violations := deny

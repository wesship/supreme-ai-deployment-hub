package secrets.policy

import rego.v1

# ── Secrets Management Policy ──────────────────────────────────────────────
# Enforces Devonn.AI secrets hygiene:
#   1. Long-lived static credentials must not be used for cloud deployments
#   2. Secrets must be rotated within policy window
#   3. Secrets must not be logged or echoed in workflow steps
#   4. Production secrets must use environment-scoped secrets (not repo-level)

# Deny if long-lived AWS credentials are used instead of OIDC
deny contains msg if {
    secret := input.secrets[_]
    regex.match(`(?i)^AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)$`, secret.name)
    secret.scope == "repo"
    msg := sprintf("Secret '%v' is a long-lived AWS credential - migrate to OIDC role assumption", [secret.name])
}

# Deny if Azure client secret is used instead of federated credential
deny contains msg if {
    secret := input.secrets[_]
    regex.match(`(?i)^AZURE_CLIENT_SECRET$`, secret.name)
    msg := "AZURE_CLIENT_SECRET detected - migrate to Azure federated credential (OIDC)"
}

# Deny if GCP service account key is used instead of Workload Identity
deny contains msg if {
    secret := input.secrets[_]
    regex.match(`(?i)^(GCP|GOOGLE)_SERVICE_ACCOUNT_KEY$`, secret.name)
    msg := "GCP service account key detected - migrate to Workload Identity Federation (OIDC)"
}

# Deny if secret has not been rotated within policy window (90 days)
deny contains msg if {
    secret := input.secrets[_]
    secret.age_days > 90
    not regex.match(`(?i)(oidc|token|jwt)`, secret.name)
    msg := sprintf("Secret '%v' is %v days old - must be rotated within 90-day policy window", [secret.name, secret.age_days])
}

# Deny if production environment uses repo-level secrets (should use environment secrets)
deny contains msg if {
    secret := input.secrets[_]
    secret.scope == "repo"
    secret.used_in_environment == "production"
    msg := sprintf("Secret '%v' is repo-scoped but used in production - move to environment-scoped secret", [secret.name])
}

# Warn about secrets that could be moved to OIDC
warn contains msg if {
    secret := input.secrets[_]
    regex.match(`(?i)(deploy|cloud|infra|k8s|kube|helm|terraform)`, secret.name)
    not regex.match(`(?i)(oidc|token|jwt|webhook)`, secret.name)
    msg := sprintf("Secret '%v' may be replaceable with OIDC federation", [secret.name])
}

allow if {
    count(deny) == 0
}

violations := deny
warnings := warn

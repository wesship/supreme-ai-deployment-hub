package devonn.ai.governance

# ── AI Model Governance Policy ────────────────────────────────────────────────
# Enforces safety and compliance rules for all AI model deployments in Devonn.AI.
# This policy is evaluated by the infrastructure-ci-cd.yml pipeline before any
# model deployment is applied.
#
# Usage: opa eval --data policy/ai_model_governance.rego \
#                 --input models/llm/mistral-7b/deployment.json \
#                 "data.devonn.ai.governance.deny"

import input as deployment

# ── Approved model registry ───────────────────────────────────────────────────
# Only models from this list may be deployed to production.
approved_models = {
    "mistralai/Mistral-7B-Instruct-v0.3",
    "mistralai/Mistral-7B-Instruct-v0.2",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1-nano",
    "google/gemini-2.5-flash",
}

# ── Deny: Unapproved model in production ─────────────────────────────────────
deny[reason] {
    deployment.environment == "production"
    not approved_models[deployment.model_id]
    reason := sprintf(
        "Model '%s' is not in the approved model registry for production deployment.",
        [deployment.model_id]
    )
}

# ── Deny: Model without content filtering in production ──────────────────────
deny[reason] {
    deployment.environment == "production"
    not deployment.content_filter.enabled
    reason := sprintf(
        "Model '%s': content filtering must be enabled in production.",
        [deployment.model_id]
    )
}

# ── Deny: Model with max_tokens > 8192 without explicit approval ─────────────
deny[reason] {
    deployment.max_tokens > 8192
    not deployment.large_context_approved
    reason := sprintf(
        "Model '%s': max_tokens=%d exceeds 8192. Set large_context_approved=true with justification.",
        [deployment.model_id, deployment.max_tokens]
    )
}

# ── Deny: Missing required model metadata ────────────────────────────────────
required_fields = ["model_id", "version", "owner", "use_case", "data_classification"]

deny[reason] {
    field := required_fields[_]
    not deployment[field]
    reason := sprintf(
        "Model deployment is missing required metadata field: '%s'.",
        [field]
    )
}

# ── Deny: PII data classification without data residency config ──────────────
deny[reason] {
    deployment.data_classification == "PII"
    not deployment.data_residency
    reason := sprintf(
        "Model '%s' processes PII data but has no data_residency configuration.",
        [deployment.model_id]
    )
}

# ── Warn: No rate limiting configured ────────────────────────────────────────
warn[reason] {
    not deployment.rate_limit
    reason := sprintf(
        "Model '%s': no rate_limit configured. This may lead to unexpected cost overruns.",
        [deployment.model_id]
    )
}

# ── Warn: Temperature > 1.0 in production ────────────────────────────────────
warn[reason] {
    deployment.environment == "production"
    deployment.temperature > 1.0
    reason := sprintf(
        "Model '%s': temperature=%.1f is high for production. Consider ≤0.7 for deterministic outputs.",
        [deployment.model_id, deployment.temperature]
    )
}

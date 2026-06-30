package d3vonn.io.governance

# ── AI Model Governance Policy (OPA v1 syntax) ────────────────────────────────
# Enforces safety and compliance rules for all AI model deployments in Devonn.AI.
# Compatible with OPA >= 0.59.0 (v1 syntax: `if` and `contains` keywords required).
#
# Usage: opa eval --data policy/ai_model_governance.rego \
#                 --input models/llm/mistral-7b/deployment.json \
#                 "data.d3vonn.io.governance.deny"

import input as deployment

# ── Approved model registry ───────────────────────────────────────────────────
approved_models := {
    "mistralai/Mistral-7B-Instruct-v0.3",
    "mistralai/Mistral-7B-Instruct-v0.2",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1-nano",
    "google/gemini-2.5-flash",
}

# ── Deny: Unapproved model in production ─────────────────────────────────────
deny contains reason if {
    deployment.environment == "production"
    not approved_models[deployment.model_id]
    reason := sprintf(
        "Model '%s' is not in the approved model registry for production deployment.",
        [deployment.model_id]
    )
}

# ── Deny: Model without content filtering in production ──────────────────────
deny contains reason if {
    deployment.environment == "production"
    not deployment.content_filter.enabled
    reason := sprintf(
        "Model '%s': content filtering must be enabled in production.",
        [deployment.model_id]
    )
}

# ── Deny: Model with max_tokens > 8192 without explicit approval ─────────────
deny contains reason if {
    deployment.max_tokens > 8192
    not deployment.large_context_approved
    reason := sprintf(
        "Model '%s': max_tokens=%d exceeds 8192. Set large_context_approved=true with justification.",
        [deployment.model_id, deployment.max_tokens]
    )
}

# ── Deny: Missing required model metadata ────────────────────────────────────
deny contains reason if {
    field := ["model_id", "version", "owner", "use_case", "data_classification"][_]
    not deployment[field]
    reason := sprintf(
        "Model deployment is missing required metadata field: '%s'.",
        [field]
    )
}

# ── Deny: PII data classification without data residency config ──────────────
deny contains reason if {
    deployment.data_classification == "PII"
    not deployment.data_residency
    reason := sprintf(
        "Model '%s' processes PII data but has no data_residency configuration.",
        [deployment.model_id]
    )
}

# ── Warn: No rate limiting configured ────────────────────────────────────────
warn contains reason if {
    not deployment.rate_limit
    reason := sprintf(
        "Model '%s': no rate_limit configured. This may lead to unexpected cost overruns.",
        [deployment.model_id]
    )
}

# ── Warn: Temperature > 1.0 in production ────────────────────────────────────
warn contains reason if {
    deployment.environment == "production"
    deployment.temperature > 1.0
    reason := sprintf(
        "Model '%s': temperature=%.1f is high for production. Consider 0.7 or lower for deterministic outputs.",
        [deployment.model_id, deployment.temperature]
    )
}

# ── Allow: All checks passed ─────────────────────────────────────────────────
allow if {
    count(deny) == 0
}

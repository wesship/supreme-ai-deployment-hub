from datetime import datetime, timezone

from backend.app.security.containment_lifecycle import (
    MAX_TTL_SECONDS,
    MIN_TTL_SECONDS,
    containment_expiry,
    containment_ttl_seconds,
    matching_waf_rule,
    rollback_audit_record,
)


def test_ttl_defaults_and_bounds():
    assert containment_ttl_seconds({}) == 3600
    assert containment_ttl_seconds({"parameters": {"ttl_seconds": 1}}) == MIN_TTL_SECONDS
    assert containment_ttl_seconds({"parameters": {"ttl_seconds": 999999}}) == MAX_TTL_SECONDS
    assert containment_ttl_seconds({"parameters": {"ttl_seconds": "invalid"}}) == 3600


def test_expiry_is_deterministic_from_now():
    now = datetime(2026, 9, 12, 21, 0, tzinfo=timezone.utc)
    expires = containment_expiry({"parameters": {"ttl_seconds": 120}}, now=now)
    assert expires == "2026-09-12T21:02:00+00:00"


def test_duplicate_detection_requires_exact_enabled_block_expression():
    rules = [
        {"id": "rule-disabled", "action": "block", "enabled": False, "expression": "(ip.src eq 203.0.113.10)"},
        {"id": "rule-log", "action": "log", "enabled": True, "expression": "(ip.src eq 203.0.113.10)"},
        {"id": "rule-match", "action": "block", "enabled": True, "expression": "(ip.src eq 203.0.113.10)"},
    ]
    match = matching_waf_rule(rules, "(ip.src eq 203.0.113.10)")
    assert match is not None
    assert match["id"] == "rule-match"


def test_rollback_audit_record_keeps_exact_provider_coordinates():
    record = rollback_audit_record(
        ruleset_id="ruleset-123",
        rule_id="rule-456",
        target="203.0.113.10",
        actor_id="admin-789",
    )
    assert record["operation"] == "unblock_ip"
    assert record["provider_ruleset_id"] == "ruleset-123"
    assert record["provider_rule_id"] == "rule-456"
    assert record["target"] == "203.0.113.10"
    assert record["actor_id"] == "admin-789"
    assert record["rolled_back_at"]

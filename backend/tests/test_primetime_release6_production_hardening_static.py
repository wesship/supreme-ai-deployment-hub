from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PLAN = ROOT / "docs" / "PRIMETIME_RELEASE6_PRODUCTION_HARDENING_PLAN.md"
CHECKLIST = ROOT / "docs" / "PRIMETIME_PRODUCTION_READINESS_CHECKLIST.md"
RUNBOOK = ROOT / "docs" / "PRIMETIME_RELEASE_STACK_RUNBOOK.md"
GATES = ROOT / "config" / "primetime-release-gates.json"
SECURITY_BASELINE = ROOT / "docs" / "security" / "OPEN_SOURCE_SECURITY_BASELINE.md"
APP = ROOT / "src" / "App.tsx"
MAIN = ROOT / "backend" / "main.py"

BLOCKED_ENDPOINT_FRAGMENTS = [
    "/send",
    "/quote",
    "/recommend-policy",
    "/submit-application",
]

REQUIRED_PRIMETIME_ROUTES = [
    "/primetime",
    "/primetime/release-1",
    "/primetime/scheduling",
    "/primetime/release-2",
    "/primetime/communications",
    "/primetime/release-3",
    "/primetime/ai-assistance",
    "/primetime/release-4",
    "/primetime/executive-command-center",
    "/primetime/release-5",
]

REQUIRED_ROUTER_IMPORTS = [
    "primetime_release1",
    "primetime_release2_scheduling",
    "primetime_release3_communications",
    "primetime_release4_ai_assistance",
    "primetime_release5_analytics",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_release6_required_artifacts_exist() -> None:
    for path in [PLAN, CHECKLIST, RUNBOOK, GATES]:
        assert path.exists(), f"Missing required Release 6 artifact: {path}"


def test_release6_gate_config_is_valid_json() -> None:
    data = json.loads(read(GATES))
    assert data["project"] == "PRIMETIME"
    assert data["release_gates_version"] == "6.0.0"
    assert data["deployment_readiness"]["requires_staging_validation"] is True
    assert data["deployment_readiness"]["requires_compliance_signoff"] is True
    assert data["deployment_readiness"]["requires_rollback_plan"] is True


def test_release6_gate_config_requires_full_stack() -> None:
    data = json.loads(read(GATES))
    releases = {item["release"] for item in data["stack"]}
    assert releases == {"release-1", "release-2", "release-3", "release-4", "release-5", "release-6"}
    required_prs = [pr for item in data["stack"] for pr in item.get("required_prs", [])]
    for pr in [434, 435, 436, 437, 440, 441, 442]:
        assert pr in required_prs


def test_release6_gate_config_blocks_regulated_endpoints_and_delete() -> None:
    data = json.loads(read(GATES))
    for fragment in BLOCKED_ENDPOINT_FRAGMENTS:
        assert fragment in data["blocked_endpoint_fragments"]
    assert "DELETE" in data["blocked_http_methods_for_primetime"]


def test_release6_gate_config_has_no_legacy_scanner_exception() -> None:
    gates = json.loads(read(GATES))
    baseline = read(SECURITY_BASELINE)

    assert gates["known_blockers"] == {}
    assert gates["known_external_checks"] == []
    assert "Gitleaks" in baseline
    assert "Grype" in baseline


def test_release6_docs_preserve_non_negotiable_compliance_boundaries() -> None:
    combined = "\n".join([read(PLAN), read(CHECKLIST), read(RUNBOOK), read(GATES)])
    required_phrases = [
        "No communication without consent check",
        "No AI execution without audit",
        "No regulated recommendation without licensed human review",
        "No hard delete for regulated records",
        "No autonomous outbound sales calling",
        "No quote generation endpoint",
        "No policy recommendation endpoint",
        "No application submission endpoint",
    ]
    for phrase in required_phrases:
        assert phrase.lower() in combined.lower()


def test_release6_frontend_routes_cover_releases_1_through_5() -> None:
    app = read(APP)
    for route in REQUIRED_PRIMETIME_ROUTES:
        assert f'path="{route}"' in app


def test_release6_backend_mounts_releases_1_through_5() -> None:
    main = read(MAIN)
    for router_name in REQUIRED_ROUTER_IMPORTS:
        assert router_name in main
    assert main.count("/primetime/v1") >= 5


def test_release6_docs_define_merge_order_and_rollback_rules() -> None:
    runbook = read(RUNBOOK)
    for pr in ["#434", "#435", "#436", "#437", "#440", "#441", "#442"]:
        assert pr in runbook
    assert "Rollback must preserve regulated records" in runbook
    assert "Do not delete regulated records" in runbook
    assert "Do not truncate production audit tables" in runbook


def test_release6_hardening_has_no_runtime_send_quote_or_delete_surface() -> None:
    release6_files = [PLAN, CHECKLIST, RUNBOOK, GATES]
    combined = "\n".join(read(path) for path in release6_files)
    assert "No DELETE behavior" in combined or "no_hard_delete" in combined
    assert "No communication send endpoint" in combined or "no communication send endpoint" in combined.lower()
    assert "No quote endpoint" in combined or "no_quote_endpoint" in combined
    assert "No policy recommendation endpoint" in combined or "no_policy_recommendation_endpoint" in combined

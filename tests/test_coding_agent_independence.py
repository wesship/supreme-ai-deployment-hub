import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "CODING_AGENT_INDEPENDENCE.md"
WORKFLOWS = ROOT / ".github" / "workflows"
REQUIRED_SECRETS = ROOT / "config" / "required-secrets.json"
SECRET_INVENTORY = ROOT / "config" / "secret-inventory.json"
CLEANUP_SCRIPT = ROOT / "scripts" / "bulk-close-stale-copilot-prs.sh"
BULK_TRIAGE = ROOT / "scripts" / "bulk-triage.sh"
TRIAGE_RUNBOOK = ROOT / "docs" / "PR_TRIAGE_RUNBOOK.md"


def test_policy_preserves_agent_neutral_repository_controls() -> None:
    text = POLICY.read_text(encoding="utf-8")

    for requirement in (
        "coding-agent neutral",
        "protected CI",
        "explicit human approval",
        "Cline",
        "Ollama",
    ):
        assert requirement in text


def test_active_workflows_do_not_require_copilot() -> None:
    workflows = sorted([*WORKFLOWS.glob("*.yml"), *WORKFLOWS.glob("*.yaml")])
    assert workflows, "Expected active GitHub workflows"

    for workflow in workflows:
        text = workflow.read_text(encoding="utf-8").lower()
        assert "copilot" not in text


def test_active_secret_inventories_do_not_require_copilot() -> None:
    required = json.loads(REQUIRED_SECRETS.read_text(encoding="utf-8"))
    inventory = json.loads(SECRET_INVENTORY.read_text(encoding="utf-8"))

    assert "copilot" not in json.dumps(required).lower()
    assert all(
        "copilot" not in record["name"].lower()
        for record in inventory["records"]
    )


def test_historical_cleanup_remains_safe_and_referenced() -> None:
    cleanup = CLEANUP_SCRIPT.read_text(encoding="utf-8")
    bulk_triage = BULK_TRIAGE.read_text(encoding="utf-8")
    runbook = TRIAGE_RUNBOOK.read_text(encoding="utf-8")

    assert "APPLY=0" in cleanup
    assert '"--apply"' in cleanup
    assert "bulk-close-stale-copilot-prs.sh" in bulk_triage
    assert "bulk-close-stale-copilot-prs.sh" in runbook

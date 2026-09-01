import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "docs" / "security" / "OPEN_SOURCE_SECURITY_BASELINE.md"
WORKFLOWS_DIR = ROOT / ".github" / "workflows"
REQUIRED_SECRETS = ROOT / "config" / "required-secrets.json"
SECRET_INVENTORY = ROOT / "config" / "secret-inventory.json"
RELEASE_GATES = ROOT / "config" / "primetime-release-gates.json"


def test_open_source_security_baseline_names_retained_controls() -> None:
    text = BASELINE.read_text(encoding="utf-8")

    for control in ("CodeQL", "Dependency Review", "Gitleaks", "Grype", "Container hardening"):
        assert control in text


def test_active_workflows_do_not_depend_on_snyk() -> None:
    workflows = sorted(
        [*WORKFLOWS_DIR.glob("*.yml"), *WORKFLOWS_DIR.glob("*.yaml")]
    )
    assert workflows, "Expected at least one active workflow"

    for workflow in workflows:
        assert "snyk" not in workflow.read_text(encoding="utf-8").lower()


def test_active_secret_inventories_do_not_require_snyk_token() -> None:
    required = json.loads(REQUIRED_SECRETS.read_text(encoding="utf-8"))
    inventory = json.loads(SECRET_INVENTORY.read_text(encoding="utf-8"))

    assert "snyk" not in json.dumps(required).lower()
    assert "SNYK_TOKEN" not in {record["name"] for record in inventory["records"]}


def test_release_gates_have_no_legacy_snyk_exception() -> None:
    gates = json.loads(RELEASE_GATES.read_text(encoding="utf-8"))

    for section in ("known_blockers", "known_external_checks"):
        assert "snyk" not in json.dumps(gates.get(section, {})).lower()

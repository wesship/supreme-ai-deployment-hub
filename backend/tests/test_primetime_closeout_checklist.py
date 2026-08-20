from pathlib import Path


CHECKLIST = Path("docs/PRIMETIME_E2E_CLOSEOUT_CHECKLIST.md")


def test_closeout_checklist_covers_critical_gates():
    text = CHECKLIST.read_text()
    required = [
        "PostgreSQL idempotency is authoritative",
        "Redis lock is advisory/fast-path only",
        "Persistence and queue intent are atomic",
        "Agents cannot approve their own work",
        "RLS isolation passes cross-organization negative tests",
        "Duplicate delivery",
        "Queue unavailable after persistence",
        "Snyk security gate passes without bypass",
        "Production deployment remains blocked until all gates are green",
    ]
    for item in required:
        assert item in text

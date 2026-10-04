import json
from pathlib import Path
import subprocess
import textwrap

import pytest


@pytest.mark.parametrize("report,message", [
    ({"total": 14, "passes": 13, "errors": 0, "results": {
        "http://localhost:4173/": [{"message": "Navigation timeout of 30000 ms exceeded"}],
        "http://localhost:4173/about": [],
    }}, "Navigation timeout of 30000 ms exceeded"),
    ({"total": 1, "passes": 0, "errors": 1, "results": {
        "http://localhost:4173/": [{"code": "WCAG2AA.test", "message": "Missing label", "selector": "#input"}],
    }}, "WCAG2AA.test: Missing label"),
    ({"http://localhost:4173/": [{"code": "WCAG2AA.test", "message": "Missing label"}]},
     "WCAG2AA.test: Missing label"),
])
def test_pa11y_reports_url_failures_from_cli_json(tmp_path, report, message):
    workflow = Path(__file__).resolve().parents[2] / ".github/workflows/accessibility.yml"
    script = textwrap.dedent(workflow.read_text().split("          node - <<'NODE'\n", 1)[1].split("          NODE\n", 1)[0])
    (tmp_path / "pa11y-results.json").write_text(json.dumps(report))
    result = subprocess.run(["node", "-e", script], cwd=tmp_path,
                            text=True, capture_output=True, check=True, timeout=15)
    assert "PA11Y URL: http://localhost:4173/" in result.stderr
    assert message in result.stderr
    assert "Total pa11y issues: 1" in result.stderr

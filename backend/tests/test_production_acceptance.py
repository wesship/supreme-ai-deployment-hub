import json
from pathlib import Path
import subprocess
import textwrap

import pytest


REQUIRED = [
    "D3VONN.IO Post-Deploy Audit", "D3VONN.IO Post-Deploy Mobile Audit",
    "D3VONN.IO Authenticated Audit", "Hermes Production Lifecycle Canary",
    "Voice Live Browser Certification",
]


@pytest.mark.parametrize("case,expected", [
    ("complete", "success"), ("waiting", "pending"), ("missing", "pending"),
    ("failed", "failure"), ("wrong_commit", "pending"), ("pull_request", "pending"),
    ("newer_failure", "failure"),
    ("skipped", "failure"), ("neutral", "failure"), ("stale", "failure"),
    ("startup_failure", "failure"), ("cancelled", "failure"),
    ("timed_out", "failure"), ("action_required", "failure"),
    ("chained_success", "pending"), ("newer_chained_failure", "success"),
    ("wrong_branch", "pending"), ("manual", "success"),
])
def test_acceptance_requires_same_commit_evidence_without_failing_waits(case, expected):
    workflow = Path(__file__).resolve().parents[2] / ".github/workflows/production-acceptance.yml"
    script = textwrap.dedent(workflow.read_text().split("          script: |\n", 1)[1])
    runs = [dict(id=i, name=name, head_sha="certified", head_branch="main", event="push",
                 status="completed", conclusion="success") for i, name in enumerate(REQUIRED)]
    if case == "waiting":
        runs[-1].update(status="waiting", conclusion=None)
    elif case == "missing":
        runs.pop()
    elif case == "failed":
        runs[-1]["conclusion"] = "failure"
    elif case in {"skipped", "neutral", "stale", "startup_failure", "cancelled", "timed_out", "action_required"}:
        runs[-1]["conclusion"] = case
    elif case == "wrong_commit":
        runs[-1]["head_sha"] = "other"
    elif case == "pull_request":
        runs[-1]["event"] = "pull_request"
    elif case == "newer_failure":
        runs.append({**runs[-1], "id": 100, "conclusion": "failure"})
    elif case == "chained_success":
        runs[-1]["event"] = "workflow_run"
    elif case == "newer_chained_failure":
        runs.append({**runs[-1], "id": 100, "event": "workflow_run", "conclusion": "failure"})
    elif case == "wrong_branch":
        runs[-1]["head_branch"] = "other"
    elif case == "manual":
        runs[-1]["event"] = "workflow_dispatch"
    harness = """
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const result = {failed: false};
const summary = {addHeading() { return this; }, addTable() { return this; }, async write() {}};
const core = {summary, setFailed() {result.failed = true;}, notice() {}};
const github = {
  paginate: async (_method, query) => {
    if (query.head_sha !== 'certified') throw new Error('Wrong commit query');
    return input.runs;
  },
  rest: {actions: {listWorkflowRunsForRepo() {}}, repos: {
    async createCommitStatus(status) {result.status = status;}
  }}
};
const context = {payload: {workflow_run: {head_sha: 'certified'}}, repo: {owner: 'local', repo: 'local'}, runId: 1};
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
new AsyncFunction('github', 'context', 'core', input.script)(github, context, core)
  .then(() => process.stdout.write(JSON.stringify(result))).catch(error => {console.error(error); process.exit(1);});
"""
    output = subprocess.run(["node", "-e", harness], input=json.dumps({"script": script, "runs": runs}),
                            text=True, capture_output=True, check=True, timeout=15)
    result = json.loads(output.stdout)
    assert result["status"]["sha"] == "certified"
    assert result["status"]["state"] == expected
    assert result["failed"] == (expected == "failure")

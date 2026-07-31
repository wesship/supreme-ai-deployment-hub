#!/usr/bin/env python3
"""Generate deterministic metadata reports for GitHub Actions workflows.

This parser intentionally uses only the Python standard library. It extracts
metadata without evaluating expressions, resolving secrets, or changing any
workflow. Output is stable and sorted by workflow path.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
REPORTS = ROOT / "scripts" / "workflow-audit" / "reports"

TOP_LEVEL = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$")
JOB_KEY = re.compile(r"^  ([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$")
SECRET_REF = re.compile(r"secrets\.([A-Za-z_][A-Za-z0-9_]*)")
USES_REF = re.compile(r"^\s*-?\s*uses:\s*([^#\s]+)")
ENVIRONMENT = re.compile(r"^\s{4}environment:\s*(.+?)\s*$")
CRON = re.compile(r"cron:\s*['\"]?([^'\"#]+)")
ARTIFACT_RETENTION = re.compile(r"retention-days:\s*([^#\s]+)")
WORKFLOW_NAME = re.compile(r"^name:\s*(.+?)\s*$")
CONCURRENCY_GROUP = re.compile(r"^\s{2}group:\s*(.+?)\s*$")
CANCEL_IN_PROGRESS = re.compile(r"^\s{2}cancel-in-progress:\s*(.+?)\s*$")
PERMISSION_LINE = re.compile(r"^\s{2}([A-Za-z-]+):\s*(read|write|none)\s*$")
TRIGGER_LINE = re.compile(r"^\s{2}([A-Za-z_][A-Za-z0-9_-]*):(?:\s|$)")


def clean(value: str) -> str:
    value = value.strip().strip("'\"")
    return re.sub(r"\s+", " ", value)


def unique_sorted(values: Iterable[str]) -> list[str]:
    return sorted({clean(v) for v in values if clean(v)})


def section_lines(lines: list[str], heading: str) -> list[str]:
    start = None
    for i, line in enumerate(lines):
        if line.startswith(f"{heading}:"):
            start = i + 1
            break
    if start is None:
        return []
    result: list[str] = []
    for line in lines[start:]:
        if line and not line.startswith((" ", "\t", "#")):
            break
        result.append(line)
    return result


def parse_jobs(lines: list[str]) -> list[str]:
    jobs = section_lines(lines, "jobs")
    return unique_sorted(
        match.group(1)
        for line in jobs
        if (match := JOB_KEY.match(line)) and match.group(1) not in {"permissions", "env"}
    )


def parse_triggers(lines: list[str]) -> list[str]:
    on_section = section_lines(lines, "on")
    triggers: list[str] = []
    for line in on_section:
        if match := TRIGGER_LINE.match(line):
            triggers.append(match.group(1))
    if not triggers:
        for line in lines:
            if line.startswith("on:"):
                inline = line.split(":", 1)[1].strip().strip("[]")
                triggers.extend(part.strip() for part in inline.split(","))
                break
    return unique_sorted(triggers)


def parse_permissions(lines: list[str]) -> list[str]:
    for line in lines:
        if line.startswith("permissions:"):
            inline = clean(line.split(":", 1)[1])
            if inline:
                return [inline]
            break
    return unique_sorted(
        f"{match.group(1)}:{match.group(2)}"
        for line in section_lines(lines, "permissions")
        if (match := PERMISSION_LINE.match(line))
    )


def mutation_authority(text: str, permissions: list[str]) -> list[str]:
    findings: list[str] = []
    write_tokens = (
        "contents:write", "actions:write", "checks:write", "deployments:write",
        "issues:write", "pull-requests:write", "packages:write", "id-token:write",
    )
    if any(token in permissions for token in write_tokens) or "write-all" in permissions:
        findings.append("github-write")
    lowered = text.lower()
    for token, label in (
        ("gh pr merge", "merge-pr"),
        ("gh issue create", "create-issue"),
        ("git push", "git-push"),
        ("vercel deploy", "deploy-vercel"),
        ("railway up", "deploy-railway"),
        ("supabase db push", "mutate-supabase"),
        ("kubectl apply", "mutate-kubernetes"),
        ("terraform apply", "mutate-infrastructure"),
    ):
        if token in lowered:
            findings.append(label)
    return unique_sorted(findings)


def parse_workflow(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    workflow_name = path.name
    for line in lines:
        if match := WORKFLOW_NAME.match(line):
            workflow_name = clean(match.group(1))
            break

    jobs = parse_jobs(lines)
    triggers = parse_triggers(lines)
    permissions = parse_permissions(lines)
    schedules = unique_sorted(match.group(1) for line in lines if (match := CRON.search(line)))
    secrets = unique_sorted(SECRET_REF.findall(text))
    uses = unique_sorted(match.group(1) for line in lines if (match := USES_REF.match(line)))
    reusable = [item for item in uses if item.startswith("./.github/workflows/")]
    environments = unique_sorted(match.group(1) for line in lines if (match := ENVIRONMENT.match(line)))
    retention = unique_sorted(match.group(1) for line in lines if (match := ARTIFACT_RETENTION.search(line)))
    concurrency_group = ""
    cancel_in_progress = ""
    concurrency = section_lines(lines, "concurrency")
    for line in concurrency:
        if match := CONCURRENCY_GROUP.match(line):
            concurrency_group = clean(match.group(1))
        if match := CANCEL_IN_PROGRESS.match(line):
            cancel_in_progress = clean(match.group(1))

    return {
        "file": path.name,
        "workflow_name": workflow_name,
        "triggers": triggers,
        "schedules": schedules,
        "jobs": jobs,
        "job_count": len(jobs),
        "concurrency_group": concurrency_group,
        "cancel_in_progress": cancel_in_progress,
        "permissions": permissions,
        "environments": environments,
        "secret_names": secrets,
        "reusable_workflows": reusable,
        "artifact_retention_days": retention,
        "mutation_authority": mutation_authority(text, permissions),
        "uses": uses,
        "size_bytes": path.stat().st_size,
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
    }


def write_tsv(records: list[dict[str, object]]) -> None:
    fields = [
        "file", "workflow_name", "triggers", "schedules", "jobs", "job_count",
        "concurrency_group", "cancel_in_progress", "permissions", "environments",
        "secret_names", "reusable_workflows", "artifact_retention_days",
        "mutation_authority", "size_bytes", "sha256",
    ]
    with (REPORTS / "inventory-v2.tsv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        for record in records:
            row = dict(record)
            for field in fields:
                if isinstance(row.get(field), list):
                    row[field] = ",".join(row[field])
            writer.writerow({field: row.get(field, "") for field in fields})


def main() -> int:
    REPORTS.mkdir(parents=True, exist_ok=True)
    paths = sorted([*WORKFLOWS.glob("*.yml"), *WORKFLOWS.glob("*.yaml")], key=lambda p: p.name)
    records = [parse_workflow(path) for path in paths]
    write_tsv(records)
    (REPORTS / "inventory-v2.json").write_text(
        json.dumps({"schema_version": 2, "workflow_count": len(records), "workflows": records}, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote deterministic metadata for {len(records)} workflows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

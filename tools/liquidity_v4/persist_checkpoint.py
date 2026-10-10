#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

CERTIFICATE_SCHEMA = "d3vonn.liquidity.v4.certificate.v1"
HERMES_SCHEMA = "d3vonn.liquidity.v4.hermes-certificate.v1"
CERTIFICATE_TYPE = "liquidity_v4_simulation_certificate"
REPOSITORY = "wesship/supreme-ai-deployment-hub"
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
EXECUTION_RE = re.compile(r"^[A-Za-z0-9._:-]{1,120}$")


class PersistenceError(ValueError):
    pass


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def object_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise PersistenceError(f"missing_env:{name}")
    return value


def require_uuid(name: str) -> str:
    value = require_env(name)
    try:
        return str(uuid.UUID(value))
    except ValueError as exc:
        raise PersistenceError(f"invalid_uuid:{name}") from exc


def request_json(
    method: str,
    url: str,
    *,
    service_key: str,
    payload: dict[str, Any] | None = None,
) -> Any:
    data = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if method == "POST":
        headers["Prefer"] = "return=representation"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise PersistenceError(f"supabase_http_{exc.code}:{detail}") from exc
    except urllib.error.URLError as exc:
        raise PersistenceError(f"supabase_unavailable:{exc.reason}") from exc
    return json.loads(body) if body else None


def query_url(base: str, table: str, params: dict[str, str]) -> str:
    return f"{base.rstrip('/')}/rest/v1/{table}?{urllib.parse.urlencode(params, safe='.*,:')}"


def validate_certificate(certificate: dict[str, Any]) -> None:
    if certificate.get("schema_version") != CERTIFICATE_SCHEMA or certificate.get("status") != "pass":
        raise PersistenceError("invalid_certificate")
    report = certificate.get("report")
    report_hash = certificate.get("report_sha256")
    if not isinstance(report, dict) or not isinstance(report_hash, str) or not SHA256_RE.fullmatch(report_hash):
        raise PersistenceError("invalid_certificate_report")
    if object_sha256(report) != report_hash:
        raise PersistenceError("certificate_report_hash_mismatch")
    runner = certificate.get("runner")
    if not isinstance(runner, dict) or runner.get("repository") != REPOSITORY:
        raise PersistenceError("untrusted_certificate_runner")
    if runner.get("event_name") != "workflow_dispatch":
        raise PersistenceError("certificate_not_manual_dispatch")
    safe_draft = certificate.get("safe_proposal_draft")
    if not isinstance(safe_draft, dict):
        raise PersistenceError("safe_draft_missing")
    for key in ("submission_enabled", "signing_enabled", "broadcast_enabled", "production_execution_enabled"):
        if safe_draft.get(key) is not False:
            raise PersistenceError(f"unsafe_safe_draft_flag:{key}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Persist a passing V4 certificate to Hermes checkpoints.")
    parser.add_argument("--certificate", default="reports/certification-envelope.json")
    parser.add_argument("--output", default="reports/hermes-checkpoint.json")
    args = parser.parse_args()

    certificate_path = Path(args.certificate)
    certificate = json.loads(certificate_path.read_text(encoding="utf-8"))
    if not isinstance(certificate, dict):
        raise PersistenceError("certificate_root_must_be_object")
    validate_certificate(certificate)

    user_id = require_uuid("HERMES_USER_ID")
    goal_id = require_uuid("HERMES_GOAL_ID")
    execution_id = require_env("D3VONN_V4_EXECUTION_ID")
    if not EXECUTION_RE.fullmatch(execution_id):
        raise PersistenceError("invalid_execution_id")
    sequence = int(os.getenv("D3VONN_V4_CERTIFICATE_SEQUENCE", "1"))
    if sequence < 1 or sequence > 999_999:
        raise PersistenceError("invalid_certificate_sequence")

    supabase_url = require_env("SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    attestation_url = require_env("GITHUB_ATTESTATION_URL")
    expected_prefix = f"https://github.com/{REPOSITORY}/attestations/"
    if not attestation_url.startswith(expected_prefix):
        raise PersistenceError("invalid_github_attestation_url")

    subject_digest = require_env("CERTIFICATE_SUBJECT_SHA256").lower()
    if not SHA256_RE.fullmatch(subject_digest):
        raise PersistenceError("invalid_certificate_subject_digest")
    if file_sha256(certificate_path) != subject_digest:
        raise PersistenceError("certificate_subject_digest_mismatch")

    goal_query = query_url(
        supabase_url,
        "hermes_goals",
        {"id": f"eq.{goal_id}", "user_id": f"eq.{user_id}", "select": "id,user_id", "limit": "1"},
    )
    goals = request_json("GET", goal_query, service_key=service_key)
    if not isinstance(goals, list) or len(goals) != 1:
        raise PersistenceError("hermes_goal_user_pair_not_found")

    checkpoint = {
        "schema_version": HERMES_SCHEMA,
        "type": CERTIFICATE_TYPE,
        "status": "pass",
        "persisted": True,
        "certificate_sha256": object_sha256(certificate),
        "certificate": certificate,
        "github_attestation": {
            "url": attestation_url,
            "subject_digest_sha256": subject_digest,
            "repository": REPOSITORY,
            "run_id": os.getenv("GITHUB_RUN_ID", ""),
            "run_attempt": os.getenv("GITHUB_RUN_ATTEMPT", ""),
            "workflow": os.getenv("GITHUB_WORKFLOW", ""),
            "workflow_ref": os.getenv("GITHUB_WORKFLOW_REF", ""),
            "github_sha": os.getenv("GITHUB_SHA", ""),
        },
    }
    content = canonical_bytes(checkpoint).decode("utf-8")
    title = f"workflow:{execution_id}:checkpoint:{sequence:020d}"

    existing_url = query_url(
        supabase_url,
        "hermes_checkpoints",
        {"goal_id": f"eq.{goal_id}", "title": f"eq.{title}", "select": "id,content", "limit": "1"},
    )
    existing = request_json("GET", existing_url, service_key=service_key)
    if isinstance(existing, list) and existing:
        if existing[0].get("content") != content:
            raise PersistenceError("checkpoint_idempotency_collision")
        result = existing[0]
        persisted_mode = "existing_identical"
    else:
        insert_url = f"{supabase_url.rstrip('/')}/rest/v1/hermes_checkpoints"
        rows = request_json(
            "POST",
            insert_url,
            service_key=service_key,
            payload={"user_id": user_id, "goal_id": goal_id, "title": title, "content": content},
        )
        if not isinstance(rows, list) or len(rows) != 1:
            raise PersistenceError("checkpoint_insert_missing_response")
        result = rows[0]
        persisted_mode = "inserted"

    output = {
        **checkpoint,
        "hermes_reference": {
            "user_id": user_id,
            "goal_id": goal_id,
            "execution_id": execution_id,
            "sequence": sequence,
            "title": title,
            "checkpoint_id": result.get("id"),
            "mode": persisted_mode,
        },
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(canonical_bytes(output) + b"\n")
    print(f"persisted={persisted_mode}")
    print(f"goal_id={goal_id}")
    print(f"execution_id={execution_id}")
    print(f"sequence={sequence}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (PersistenceError, OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"checkpoint persistence failed: {exc}", file=sys.stderr)
        raise SystemExit(1)

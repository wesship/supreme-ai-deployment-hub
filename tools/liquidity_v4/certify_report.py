#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

SCHEMA = "d3vonn.liquidity.v4.simulation-report.v1"
CERTIFICATE_SCHEMA = "d3vonn.liquidity.v4.certificate.v1"
TRUSTED_REPOSITORY = "wesship/supreme-ai-deployment-hub"
POSITION_MANAGER = "0x7c5f5a4bbd8fd63184577525326123b519429bdc"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
POOL_ID_RE = re.compile(r"^0x[a-fA-F0-9]{64}$")
HEX_RE = re.compile(r"^0x(?:[a-fA-F0-9]{2})*$")


class CertificationError(ValueError):
    pass


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def object_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def _int(report: dict[str, Any], key: str) -> int:
    value = report.get(key)
    if isinstance(value, bool):
        raise CertificationError(f"invalid_integer:{key}")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise CertificationError(f"invalid_integer:{key}") from exc


def _address(report: dict[str, Any], key: str) -> str:
    value = report.get(key)
    if not isinstance(value, str) or not ADDRESS_RE.fullmatch(value):
        raise CertificationError(f"invalid_address:{key}")
    return value.lower()


def validate_report(report: dict[str, Any], *, now_epoch: int | None = None) -> None:
    if report.get("schema_version") != SCHEMA:
        raise CertificationError("invalid_report_schema")
    if report.get("status") != "pass":
        raise CertificationError("simulation_not_passing")
    if _int(report, "chain_id") != 8453:
        raise CertificationError("wrong_chain")
    if _int(report, "fork_block_number") <= 0:
        raise CertificationError("invalid_fork_block")

    pool_id = report.get("pool_id")
    if not isinstance(pool_id, str) or not POOL_ID_RE.fullmatch(pool_id):
        raise CertificationError("invalid_pool_id")

    currency0 = _address(report, "currency0")
    currency1 = _address(report, "currency1")
    if currency0 == ZERO_ADDRESS or currency1 == ZERO_ADDRESS or currency0 >= currency1:
        raise CertificationError("invalid_erc20_pool_key")
    _address(report, "hooks")
    safe_address = _address(report, "safe_address")
    if safe_address == ZERO_ADDRESS:
        raise CertificationError("zero_safe_address")

    if _int(report, "tick_spacing") <= 0:
        raise CertificationError("invalid_tick_spacing")
    tick_lower = _int(report, "tick_lower")
    tick_upper = _int(report, "tick_upper")
    if tick_lower >= tick_upper:
        raise CertificationError("invalid_tick_range")
    if _int(report, "final_position_liquidity") != 0:
        raise CertificationError("position_not_fully_exited")

    gas_ceiling = _int(report, "gas_ceiling")
    if gas_ceiling <= 0:
        raise CertificationError("invalid_gas_ceiling")
    for key in ("mint_gas", "increase_gas", "decrease_gas", "collect_gas", "exit_gas"):
        gas = _int(report, key)
        if gas <= 0 or gas >= gas_ceiling:
            raise CertificationError(f"gas_invariant_failed:{key}")

    deadline = _int(report, "proposal_deadline")
    now_value = int(time.time()) if now_epoch is None else int(now_epoch)
    if deadline <= now_value:
        raise CertificationError("candidate_deadline_expired")

    execution = report.get("execution")
    if not isinstance(execution, dict):
        raise CertificationError("execution_lock_missing")
    for key in ("private_key_access", "signing_enabled", "broadcast_enabled", "production_execution_enabled"):
        if execution.get(key) is not False:
            raise CertificationError(f"execution_lock_invalid:{key}")

    candidate = report.get("candidate_transaction")
    if not isinstance(candidate, dict):
        raise CertificationError("candidate_transaction_missing")
    target = candidate.get("to")
    if not isinstance(target, str) or target.lower() != POSITION_MANAGER:
        raise CertificationError("candidate_target_mismatch")
    if int(candidate.get("value", -1)) != 0:
        raise CertificationError("candidate_value_not_zero")
    data = candidate.get("data")
    if not isinstance(data, str) or not HEX_RE.fullmatch(data) or len(data) < 10 or len(data) > 262_146:
        raise CertificationError("invalid_candidate_calldata")


def build_certificate(report: dict[str, Any], env: dict[str, str] | None = None) -> dict[str, Any]:
    validate_report(report)
    values = os.environ if env is None else env
    repository = values.get("GITHUB_REPOSITORY", "")
    event_name = values.get("GITHUB_EVENT_NAME", "")
    if repository != TRUSTED_REPOSITORY:
        raise CertificationError("untrusted_github_repository")
    if event_name != "workflow_dispatch":
        raise CertificationError("certification_requires_workflow_dispatch")

    runner = {
        "repository": repository,
        "github_sha": values.get("GITHUB_SHA", ""),
        "run_id": values.get("GITHUB_RUN_ID", ""),
        "run_attempt": values.get("GITHUB_RUN_ATTEMPT", ""),
        "workflow": values.get("GITHUB_WORKFLOW", ""),
        "workflow_ref": values.get("GITHUB_WORKFLOW_REF", ""),
        "actor": values.get("GITHUB_ACTOR", ""),
        "event_name": event_name,
        "runner_os": values.get("RUNNER_OS", ""),
        "runner_arch": values.get("RUNNER_ARCH", ""),
    }
    if not runner["github_sha"] or not runner["run_id"] or not runner["workflow"]:
        raise CertificationError("incomplete_runner_identity")

    report_hash = object_sha256(report)
    candidate = report["candidate_transaction"]
    safe_draft = {
        "status": "safe_proposal_draft_ready",
        "chain_id": 8453,
        "safe_address": report["safe_address"].lower(),
        "operation": 0,
        "to": candidate["to"].lower(),
        "value": "0",
        "data": candidate["data"],
        "proposal_deadline": _int(report, "proposal_deadline"),
        "pool_id": report["pool_id"].lower(),
        "report_sha256": report_hash,
        "requires_human_or_multisig_approval": True,
        "requires_allowance_preconditions": True,
        "requires_onchain_reverification_before_submission": True,
        "submission_enabled": False,
        "signing_enabled": False,
        "broadcast_enabled": False,
        "production_execution_enabled": False,
    }
    return {
        "schema_version": CERTIFICATE_SCHEMA,
        "status": "pass",
        "certified_at": int(time.time()),
        "report_sha256": report_hash,
        "report": report,
        "runner": runner,
        "safe_proposal_draft": safe_draft,
    }


def write_canonical(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_bytes(value) + b"\n")


def self_test() -> None:
    now = int(time.time())
    report = {
        "schema_version": SCHEMA,
        "status": "pass",
        "chain_id": 8453,
        "fork_block_number": 40_000_000,
        "pool_id": "0x" + "11" * 32,
        "currency0": "0x1111111111111111111111111111111111111111",
        "currency1": "0x2222222222222222222222222222222222222222",
        "fee": 3000,
        "tick_spacing": 60,
        "hooks": ZERO_ADDRESS,
        "tick_lower": -600,
        "tick_upper": 600,
        "safe_address": "0x3333333333333333333333333333333333333333",
        "proposal_deadline": now + 3600,
        "gas_ceiling": 3_000_000,
        "mint_gas": 500_000,
        "increase_gas": 300_000,
        "decrease_gas": 300_000,
        "collect_gas": 250_000,
        "exit_gas": 300_000,
        "final_position_liquidity": 0,
        "candidate_transaction": {"to": POSITION_MANAGER, "value": 0, "data": "0x12345678"},
        "execution": {
            "private_key_access": False,
            "signing_enabled": False,
            "broadcast_enabled": False,
            "production_execution_enabled": False,
        },
    }
    validate_report(report, now_epoch=now)
    env = {
        "GITHUB_REPOSITORY": TRUSTED_REPOSITORY,
        "GITHUB_EVENT_NAME": "workflow_dispatch",
        "GITHUB_SHA": "a" * 40,
        "GITHUB_RUN_ID": "1",
        "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_WORKFLOW": "self-test",
        "GITHUB_WORKFLOW_REF": f"{TRUSTED_REPOSITORY}/.github/workflows/test.yml@refs/heads/main",
        "GITHUB_ACTOR": "self-test",
        "RUNNER_OS": "Linux",
        "RUNNER_ARCH": "X64",
    }
    certificate = build_certificate(report, env)
    assert certificate["status"] == "pass"
    assert certificate["safe_proposal_draft"]["submission_enabled"] is False
    tampered = json.loads(json.dumps(certificate))
    tampered["report"]["pool_id"] = "0x" + "22" * 32
    assert object_sha256(tampered["report"]) != tampered["report_sha256"]
    print("V0.5 certification self-test: PASS")


def main() -> int:
    parser = argparse.ArgumentParser(description="Certify a passing D3VONN V4 fork simulation report.")
    parser.add_argument("--report", default="reports/raw-simulation-report.json")
    parser.add_argument("--out-dir", default="reports")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return 0

    report_path = Path(args.report)
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if not isinstance(report, dict):
        raise CertificationError("report_root_must_be_object")
    certificate = build_certificate(report)
    out_dir = Path(args.out_dir)
    certificate_path = out_dir / "certification-envelope.json"
    safe_path = out_dir / "safe-proposal-draft.json"
    write_canonical(certificate_path, certificate)
    write_canonical(safe_path, certificate["safe_proposal_draft"])
    print(f"certificate={certificate_path}")
    print(f"report_sha256={certificate['report_sha256']}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (CertificationError, OSError, json.JSONDecodeError) as exc:
        print(f"certification failed: {exc}", file=sys.stderr)
        raise SystemExit(1)

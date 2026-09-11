from __future__ import annotations

import hashlib
import json
import re
import time
import uuid
from typing import Any

from backend.hermes.adapters import SupabaseCheckpointStore
from backend.hermes.dependencies import get_dependencies

from .models import V4PoolKey
from .uniswap_v4 import BASE_UNISWAP_V4_POSITION_MANAGER, normalize_pool_id

CERTIFICATE_SCHEMA = "d3vonn.liquidity.v4.certificate.v1"
HERMES_CERTIFICATE_SCHEMA = "d3vonn.liquidity.v4.hermes-certificate.v1"
CERTIFICATE_TYPE = "liquidity_v4_simulation_certificate"
TRUSTED_REPOSITORY = "wesship/supreme-ai-deployment-hub"
DEFAULT_MAX_CERTIFICATE_BLOCK_AGE = 900

_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_HEX_DATA_RE = re.compile(r"^0x(?:[a-fA-F0-9]{2})*$")
_SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
_EXECUTION_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,120}$")


class SimulationCertificateError(ValueError):
    pass


def _canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def canonical_object_sha256(value: Any) -> str:
    return hashlib.sha256(_canonical_json_bytes(value)).hexdigest()


def canonical_file_sha256(value: Any) -> str:
    """Hash the exact canonical JSON file representation emitted by the certifier."""
    return hashlib.sha256(_canonical_json_bytes(value) + b"\n").hexdigest()


def _require_mapping(value: Any, reason: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SimulationCertificateError(reason)
    return value


def _require_address(value: Any, reason: str) -> str:
    if not isinstance(value, str) or not _ADDRESS_RE.fullmatch(value):
        raise SimulationCertificateError(reason)
    return value.lower()


def _safe_int(value: Any, reason: str) -> int:
    if isinstance(value, bool):
        raise SimulationCertificateError(reason)
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise SimulationCertificateError(reason) from exc


def _assert_false(mapping: dict[str, Any], key: str) -> None:
    if mapping.get(key) is not False:
        raise SimulationCertificateError(f"certificate_execution_lock_invalid:{key}")


def _validate_pool_key(report: dict[str, Any], pool_key: V4PoolKey | None) -> None:
    if pool_key is None:
        return
    expected = {
        "currency0": pool_key.currency0_address.lower(),
        "currency1": pool_key.currency1_address.lower(),
        "fee": pool_key.fee,
        "tick_spacing": pool_key.tick_spacing,
        "hooks": pool_key.hooks_address.lower(),
    }
    for key, expected_value in expected.items():
        actual = report.get(key)
        if isinstance(expected_value, str):
            actual = str(actual).lower()
        if actual != expected_value:
            raise SimulationCertificateError(f"certificate_pool_key_mismatch:{key}")


def validate_persisted_v4_certificate(
    checkpoint: dict[str, Any],
    *,
    expected_pool_id: str,
    current_block_number: int,
    expected_pool_key: V4PoolKey | None = None,
    max_block_age: int = DEFAULT_MAX_CERTIFICATE_BLOCK_AGE,
    now_epoch: int | None = None,
) -> dict[str, Any]:
    """Validate a persisted trusted-runner certificate and return a non-submittable Safe draft."""
    if checkpoint.get("schema_version") != HERMES_CERTIFICATE_SCHEMA:
        raise SimulationCertificateError("invalid_hermes_certificate_schema")
    if checkpoint.get("type") != CERTIFICATE_TYPE or checkpoint.get("status") != "pass":
        raise SimulationCertificateError("certificate_not_passing")
    if checkpoint.get("persisted") is not True:
        raise SimulationCertificateError("certificate_not_persisted")

    certificate = _require_mapping(checkpoint.get("certificate"), "certificate_payload_missing")
    if certificate.get("schema_version") != CERTIFICATE_SCHEMA or certificate.get("status") != "pass":
        raise SimulationCertificateError("invalid_certificate_payload")
    certificate_hash = checkpoint.get("certificate_sha256")
    if not isinstance(certificate_hash, str) or not _SHA256_RE.fullmatch(certificate_hash):
        raise SimulationCertificateError("invalid_certificate_hash")
    if canonical_object_sha256(certificate) != certificate_hash:
        raise SimulationCertificateError("certificate_payload_hash_mismatch")

    report = _require_mapping(certificate.get("report"), "certificate_report_missing")
    report_hash = certificate.get("report_sha256")
    if not isinstance(report_hash, str) or not _SHA256_RE.fullmatch(report_hash):
        raise SimulationCertificateError("invalid_report_hash")
    if canonical_object_sha256(report) != report_hash:
        raise SimulationCertificateError("certificate_report_hash_mismatch")

    runner = _require_mapping(certificate.get("runner"), "runner_attestation_missing")
    if runner.get("repository") != TRUSTED_REPOSITORY:
        raise SimulationCertificateError("untrusted_runner_repository")
    if runner.get("event_name") != "workflow_dispatch":
        raise SimulationCertificateError("certificate_not_from_manual_dispatch")
    if not runner.get("github_sha") or not runner.get("run_id"):
        raise SimulationCertificateError("runner_identity_incomplete")

    attestation = _require_mapping(checkpoint.get("github_attestation"), "github_attestation_missing")
    attestation_url = attestation.get("url")
    if not isinstance(attestation_url, str) or not attestation_url.startswith(
        f"https://github.com/{TRUSTED_REPOSITORY}/attestations/"
    ):
        raise SimulationCertificateError("invalid_github_attestation_url")
    if attestation.get("repository") != TRUSTED_REPOSITORY:
        raise SimulationCertificateError("github_attestation_repository_mismatch")
    if str(attestation.get("github_sha", "")) != str(runner.get("github_sha", "")):
        raise SimulationCertificateError("github_attestation_sha_mismatch")
    if str(attestation.get("run_id", "")) != str(runner.get("run_id", "")):
        raise SimulationCertificateError("github_attestation_run_mismatch")
    subject_digest = attestation.get("subject_digest_sha256")
    if not isinstance(subject_digest, str) or not _SHA256_RE.fullmatch(subject_digest):
        raise SimulationCertificateError("invalid_github_attestation_subject_digest")
    if subject_digest != canonical_file_sha256(certificate):
        raise SimulationCertificateError("github_attestation_subject_digest_mismatch")

    pool_id = normalize_pool_id(str(report.get("pool_id", "")))
    if pool_id != normalize_pool_id(expected_pool_id):
        raise SimulationCertificateError("certificate_pool_id_mismatch")
    if _safe_int(report.get("chain_id"), "invalid_chain_id") != 8453:
        raise SimulationCertificateError("certificate_wrong_chain")

    fork_block = _safe_int(report.get("fork_block_number"), "invalid_fork_block")
    if fork_block <= 0 or current_block_number < fork_block:
        raise SimulationCertificateError("certificate_fork_block_invalid")
    bounded_max_age = max(1, min(int(max_block_age), 1800))
    if current_block_number - fork_block > bounded_max_age:
        raise SimulationCertificateError("simulation_certificate_stale")

    deadline = _safe_int(report.get("proposal_deadline"), "invalid_proposal_deadline")
    now_value = int(time.time()) if now_epoch is None else int(now_epoch)
    if deadline <= now_value:
        raise SimulationCertificateError("simulation_candidate_expired")

    _validate_pool_key(report, expected_pool_key)

    candidate = _require_mapping(report.get("candidate_transaction"), "candidate_transaction_missing")
    target = _require_address(candidate.get("to"), "invalid_candidate_target")
    if target != BASE_UNISWAP_V4_POSITION_MANAGER:
        raise SimulationCertificateError("candidate_target_not_canonical_position_manager")
    if _safe_int(candidate.get("value"), "invalid_candidate_value") != 0:
        raise SimulationCertificateError("candidate_eth_value_not_allowed_v0_5")
    data = candidate.get("data")
    if not isinstance(data, str) or not _HEX_DATA_RE.fullmatch(data) or len(data) < 10 or len(data) > 262_146:
        raise SimulationCertificateError("invalid_candidate_calldata")

    safe_address = _require_address(report.get("safe_address"), "invalid_safe_address")
    if safe_address == "0x0000000000000000000000000000000000000000":
        raise SimulationCertificateError("zero_safe_address")

    execution = _require_mapping(report.get("execution"), "execution_lock_missing")
    for key in ("private_key_access", "signing_enabled", "broadcast_enabled", "production_execution_enabled"):
        _assert_false(execution, key)

    return {
        "status": "safe_proposal_draft_ready",
        "chain_id": 8453,
        "safe_address": safe_address,
        "operation": 0,
        "to": target,
        "value": "0",
        "data": data,
        "proposal_deadline": deadline,
        "pool_id": pool_id,
        "report_sha256": report_hash,
        "certificate_sha256": certificate_hash,
        "github_attestation_url": attestation_url,
        "github_attestation_subject_digest_sha256": subject_digest,
        "requires_human_or_multisig_approval": True,
        "requires_allowance_preconditions": True,
        "requires_onchain_reverification_before_submission": True,
        "submission_enabled": False,
        "signing_enabled": False,
        "broadcast_enabled": False,
        "production_execution_enabled": False,
    }


async def load_certified_safe_draft(
    *,
    goal_id: str,
    execution_id: str,
    sequence: int,
    expected_pool_id: str,
    current_block_number: int,
    expected_pool_key: V4PoolKey | None,
    max_block_age: int = DEFAULT_MAX_CERTIFICATE_BLOCK_AGE,
) -> dict[str, Any]:
    try:
        uuid.UUID(goal_id)
    except (ValueError, AttributeError) as exc:
        raise SimulationCertificateError("invalid_certificate_goal_id") from exc
    if not _EXECUTION_ID_RE.fullmatch(execution_id):
        raise SimulationCertificateError("invalid_certificate_execution_id")
    if sequence < 1 or sequence > 999_999:
        raise SimulationCertificateError("invalid_certificate_sequence")

    repository = get_dependencies().repository
    if not getattr(repository, "configured", False):
        raise SimulationCertificateError("hermes_checkpoint_store_not_configured")
    store = SupabaseCheckpointStore(repository)  # type: ignore[arg-type]
    checkpoint = await store.get(goal_id=goal_id, execution_id=execution_id, sequence=sequence)
    if checkpoint is None:
        raise SimulationCertificateError("simulation_certificate_not_found")

    return validate_persisted_v4_certificate(
        checkpoint,
        expected_pool_id=expected_pool_id,
        current_block_number=current_block_number,
        expected_pool_key=expected_pool_key,
        max_block_age=max_block_age,
    )

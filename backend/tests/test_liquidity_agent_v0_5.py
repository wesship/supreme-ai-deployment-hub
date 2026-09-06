from __future__ import annotations

import copy

import pytest

from backend.liquidity_agent.certification import (
    CERTIFICATE_SCHEMA,
    CERTIFICATE_TYPE,
    HERMES_CERTIFICATE_SCHEMA,
    SimulationCertificateError,
    canonical_object_sha256,
    validate_persisted_v4_certificate,
)
from backend.liquidity_agent.models import V4PoolKey
from backend.liquidity_agent.uniswap_v4 import BASE_UNISWAP_V4_POSITION_MANAGER

POOL_ID = "0x" + "11" * 32
CURRENCY0 = "0x1111111111111111111111111111111111111111"
CURRENCY1 = "0x2222222222222222222222222222222222222222"
SAFE = "0x3333333333333333333333333333333333333333"
HOOKS = "0x0000000000000000000000000000000000000000"
NOW = 1_900_000_000


def _report() -> dict:
    return {
        "schema_version": "d3vonn.liquidity.v4.simulation-report.v1",
        "status": "pass",
        "chain_id": 8453,
        "fork_block_number": 40_000_000,
        "pool_id": POOL_ID,
        "currency0": CURRENCY0,
        "currency1": CURRENCY1,
        "fee": 3000,
        "tick_spacing": 60,
        "hooks": HOOKS,
        "tick_lower": -600,
        "tick_upper": 600,
        "safe_address": SAFE,
        "proposal_deadline": NOW + 3600,
        "gas_ceiling": 3_000_000,
        "mint_gas": 500_000,
        "increase_gas": 300_000,
        "decrease_gas": 300_000,
        "collect_gas": 250_000,
        "exit_gas": 300_000,
        "final_position_liquidity": 0,
        "candidate_transaction": {
            "to": BASE_UNISWAP_V4_POSITION_MANAGER,
            "value": 0,
            "data": "0x12345678",
        },
        "execution": {
            "private_key_access": False,
            "signing_enabled": False,
            "broadcast_enabled": False,
            "production_execution_enabled": False,
        },
    }


def _checkpoint() -> dict:
    report = _report()
    report_hash = canonical_object_sha256(report)
    certificate = {
        "schema_version": CERTIFICATE_SCHEMA,
        "status": "pass",
        "certified_at": NOW,
        "report_sha256": report_hash,
        "report": report,
        "runner": {
            "repository": "wesship/supreme-ai-deployment-hub",
            "github_sha": "a" * 40,
            "run_id": "1234",
            "run_attempt": "1",
            "workflow": "Liquidity V4 Simulation Certification",
            "workflow_ref": (
                "wesship/supreme-ai-deployment-hub/.github/workflows/"
                "liquidity-v4-simulation-certification.yml@refs/heads/main"
            ),
            "actor": "wesship",
            "event_name": "workflow_dispatch",
            "runner_os": "Linux",
            "runner_arch": "X64",
        },
    }
    return {
        "schema_version": HERMES_CERTIFICATE_SCHEMA,
        "type": CERTIFICATE_TYPE,
        "status": "pass",
        "persisted": True,
        "certificate_sha256": canonical_object_sha256(certificate),
        "certificate": certificate,
        "github_attestation": {
            "url": "https://github.com/wesship/supreme-ai-deployment-hub/attestations/123",
            "subject_digest_sha256": "b" * 64,
            "repository": "wesship/supreme-ai-deployment-hub",
            "run_id": "1234",
            "run_attempt": "1",
            "workflow": "Liquidity V4 Simulation Certification",
            "github_sha": "a" * 40,
        },
    }


def _pool_key() -> V4PoolKey:
    return V4PoolKey(
        currency0_address=CURRENCY0,
        currency1_address=CURRENCY1,
        fee=3000,
        tick_spacing=60,
        hooks_address=HOOKS,
    )


def _validate(checkpoint: dict, *, current_block: int = 40_000_100, pool_key: V4PoolKey | None = None):
    return validate_persisted_v4_certificate(
        checkpoint,
        expected_pool_id=POOL_ID,
        current_block_number=current_block,
        expected_pool_key=pool_key,
        max_block_age=900,
        now_epoch=NOW,
    )


def test_passing_certificate_returns_non_submittable_safe_draft() -> None:
    draft = _validate(_checkpoint(), pool_key=_pool_key())

    assert draft["status"] == "safe_proposal_draft_ready"
    assert draft["chain_id"] == 8453
    assert draft["to"] == BASE_UNISWAP_V4_POSITION_MANAGER
    assert draft["safe_address"] == SAFE
    assert draft["submission_enabled"] is False
    assert draft["signing_enabled"] is False
    assert draft["broadcast_enabled"] is False
    assert draft["production_execution_enabled"] is False
    assert draft["requires_human_or_multisig_approval"] is True
    assert draft["requires_onchain_reverification_before_submission"] is True


def test_tampered_report_is_rejected() -> None:
    checkpoint = _checkpoint()
    checkpoint["certificate"]["report"]["tick_upper"] = 1200

    with pytest.raises(SimulationCertificateError, match="certificate_report_hash_mismatch"):
        _validate(checkpoint)


def test_unpersisted_certificate_is_rejected() -> None:
    checkpoint = _checkpoint()
    checkpoint["persisted"] = False

    with pytest.raises(SimulationCertificateError, match="certificate_not_persisted"):
        _validate(checkpoint)


def test_stale_fork_certificate_is_rejected() -> None:
    with pytest.raises(SimulationCertificateError, match="simulation_certificate_stale"):
        _validate(_checkpoint(), current_block=40_001_000)


def test_expired_candidate_is_rejected_even_with_passing_simulation() -> None:
    checkpoint = _checkpoint()
    report = checkpoint["certificate"]["report"]
    report["proposal_deadline"] = NOW - 1
    checkpoint["certificate"]["report_sha256"] = canonical_object_sha256(report)

    with pytest.raises(SimulationCertificateError, match="simulation_candidate_expired"):
        _validate(checkpoint)


def test_noncanonical_position_manager_target_is_rejected() -> None:
    checkpoint = _checkpoint()
    report = checkpoint["certificate"]["report"]
    report["candidate_transaction"]["to"] = "0x4444444444444444444444444444444444444444"
    checkpoint["certificate"]["report_sha256"] = canonical_object_sha256(report)

    with pytest.raises(SimulationCertificateError, match="candidate_target_not_canonical_position_manager"):
        _validate(checkpoint)


def test_pool_key_mismatch_is_rejected() -> None:
    wrong_key = _pool_key().model_copy(update={"fee": 500})

    with pytest.raises(SimulationCertificateError, match="certificate_pool_key_mismatch:fee"):
        _validate(_checkpoint(), pool_key=wrong_key)


def test_wrong_pool_id_is_rejected() -> None:
    checkpoint = copy.deepcopy(_checkpoint())
    report = checkpoint["certificate"]["report"]
    report["pool_id"] = "0x" + "22" * 32
    checkpoint["certificate"]["report_sha256"] = canonical_object_sha256(report)

    with pytest.raises(SimulationCertificateError, match="certificate_pool_id_mismatch"):
        _validate(checkpoint)

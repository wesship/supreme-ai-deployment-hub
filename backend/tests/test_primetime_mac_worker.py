from pathlib import Path

from backend.hermes.workflows.workers import InMemoryWorkerRegistry, WorkerCapabilities


def test_mac_capabilities_select_mac_worker() -> None:
    registry = InMemoryWorkerRegistry()
    registry.register(
        worker_id="NVIDIA-01",
        hostname="nvidia",
        region="gpu",
        runtime="python",
        version="test",
        capabilities=WorkerCapabilities.from_names(("task-dispatch", "vision")),
        max_leases=1,
    )
    registry.register(
        worker_id="PRIMETIME-MAC-01",
        hostname="mac-mini",
        region="local-mac",
        runtime="python",
        version="test",
        capabilities=WorkerCapabilities.from_names(
            ("task-dispatch", "browser-control", "visual-qa", "computer-use")
        ),
        max_leases=1,
    )

    selected = registry.select_worker(
        ("task-dispatch", "browser-control", "visual-qa")
    )

    assert selected is not None
    assert selected.worker_id == "PRIMETIME-MAC-01"


def test_atomic_claim_contract_is_service_role_only() -> None:
    migration = next(
        Path("supabase/migrations").glob("*_hermes_capability_atomic_claim.sql")
    ).read_text()

    assert "hermes_claim_capability_task" in migration
    assert "required_capabilities" in migration
    assert "for update skip locked" in migration.lower()
    assert "revoke execute" in migration.lower()
    assert "grant execute" in migration.lower()

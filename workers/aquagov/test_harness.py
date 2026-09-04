"""Deterministic integration harness for the AquaGov worker contracts.

This harness uses fakes for the API, worker admission, queue, and pipeline. It
exercises the complete lifecycle without touching a GPU or external service.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from admission import AdmissionDecision, evaluate_preflight
from worker import Job, run_dry_job


@dataclass
class FakeApi:
    registered: bool = False
    claimed: bool = False
    completed: bool = False
    heartbeats: int = 0

    def register(self) -> None:
        self.registered = True

    def heartbeat(self) -> None:
        if not self.registered:
            raise RuntimeError("worker not registered")
        self.heartbeats += 1

    def claim(self) -> None:
        if not self.registered:
            raise RuntimeError("worker not registered")
        self.claimed = True

    def complete(self) -> None:
        if not self.claimed:
            raise RuntimeError("job not claimed")
        self.completed = True


def run_harness() -> dict:
    api = FakeApi()
    preflight = {"ready": True, "checks": [{"name": "gpu", "ok": True, "required": True}]}
    admission: AdmissionDecision = evaluate_preflight(preflight)
    if not admission.admitted:
        raise RuntimeError(admission.reason)

    api.register()
    api.heartbeat()
    api.claim()

    with TemporaryDirectory() as tmp:
        job = Job("integration-job", "TEST-SITE", "TEST-ASSET", "local://fixture.jpg", ["gaussian-splat"])
        result = run_dry_job(job, Path(tmp))
        api.heartbeat()
        api.complete()
        manifest = Path(result.outputs["manifest"])
        return {
            "registered": api.registered,
            "claimed": api.claimed,
            "heartbeats": api.heartbeats,
            "status": result.status,
            "stage": result.stage,
            "manifest_exists": manifest.exists(),
            "completed": api.completed,
        }


def test_end_to_end_harness():
    result = run_harness()
    assert result == {
        "registered": True,
        "claimed": True,
        "heartbeats": 2,
        "status": "review",
        "stage": "qa",
        "manifest_exists": True,
        "completed": True,
    }

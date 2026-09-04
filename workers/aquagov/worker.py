"""AquaGov local worker lifecycle reference implementation.

Dry-run by default; HTTP transport and real pipeline adapters can be added without
changing the lifecycle contract.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from time import sleep


STAGES = ("preflight", "matrix3d", "wan21", "reprojection", "colmap", "splat-training", "qa", "publish")


@dataclass
class Job:
    job_id: str
    site_id: str
    asset_id: str
    input_uri: str
    requested_outputs: list[str]
    status: str = "queued"
    stage: str | None = None
    progress: float = 0.0
    outputs: dict[str, str] = field(default_factory=dict)


class DryRunPipeline:
    """Safe adapter that creates manifests but never executes external commands."""

    def run(self, job: Job, workspace: Path) -> dict[str, str]:
        workspace.mkdir(parents=True, exist_ok=True)
        manifest = workspace / "artifact-manifest.json"
        manifest.write_text(
            '{"mode":"dry-run","evidence_state":"reconstructed",'
            f'"job_id":"{job.job_id}","site_id":"{job.site_id}","asset_id":"{job.asset_id}"}}\n',
            encoding="utf-8",
        )
        return {"manifest": str(manifest)}


def run_dry_job(job: Job, workspace: Path, delay: float = 0.0) -> Job:
    job.status = "running"
    for index, stage in enumerate(STAGES, start=1):
        job.stage = stage
        job.progress = index / len(STAGES)
        if delay:
            sleep(delay)
    job.outputs = DryRunPipeline().run(job, workspace)
    job.status = "review"
    job.stage = "qa"
    return job

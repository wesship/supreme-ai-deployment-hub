"""Local/self-hosted video worker contract for D3VONN AI Films.

The worker deliberately shells out to an operator-owned model runner rather than
embedding model-specific Python dependencies in the API process. This keeps Wan
and LTX adapters replaceable and makes the API suitable for CPU-only deployments.
"""
from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


@dataclass(frozen=True)
class LocalVideoJob:
    provider: str
    model: str
    prompt: str
    output_path: Path
    input_image: Path | None = None
    seed: int | None = None
    width: int = 1280
    height: int = 720
    fps: int = 24
    duration_seconds: float = 5.0


class LocalVideoWorker:
    """Execute an explicitly configured local model runner."""

    def __init__(self, environ: Mapping[str, str] | None = None) -> None:
        self.environ = dict(environ or os.environ)

    def _runner(self, provider: str) -> str:
        key = f"D3VONN_{provider.upper()}_VIDEO_RUNNER"
        runner = self.environ.get(key, "").strip()
        if not runner:
            raise RuntimeError(f"local video runner is not configured: {key}")
        return runner

    def command(self, job: LocalVideoJob) -> list[str]:
        provider = job.provider.strip().lower()
        if provider not in {"wan", "wan2.2", "ltx", "ltx-2", "ltx-2.5"}:
            raise ValueError(f"unsupported local video provider: {job.provider}")
        runner = self._runner("wan" if provider.startswith("wan") else "ltx")
        command: list[str] = [
            runner,
            "--model", job.model,
            "--prompt", job.prompt,
            "--output", str(job.output_path),
            "--width", str(job.width),
            "--height", str(job.height),
            "--fps", str(job.fps),
            "--duration", str(job.duration_seconds),
        ]
        if job.input_image:
            command.extend(["--input-image", str(job.input_image)])
        if job.seed is not None:
            command.extend(["--seed", str(job.seed)])
        return command

    def run(self, job: LocalVideoJob, *, timeout_seconds: int = 3600) -> Path:
        job.output_path.parent.mkdir(parents=True, exist_ok=True)
        completed = subprocess.run(
            self.command(job),
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"local video generation failed ({completed.returncode})")
        if not job.output_path.exists() or job.output_path.stat().st_size == 0:
            raise RuntimeError(f"local video runner completed without output: {job.output_path}")
        return job.output_path

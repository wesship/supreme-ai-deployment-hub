"""Gate 9 private stem worker adapter. Disabled unless reviewed configuration is supplied.

No network API, live job queue, model downloads, or production enablement.
Only a trusted operator may supply a pinned executable and checkpoint.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable
import hashlib
import os
import subprocess


class SeparationBlocked(RuntimeError):
    pass


@dataclass(frozen=True)
class WorkerQualification:
    enabled: bool = False
    operator_approved: bool = False
    license_approved: bool = False
    gpu_qa_passed: bool = False
    weights_sha256: str = ""
    expected_binary_sha256: str = ""


@dataclass(frozen=True)
class SeparationRequest:
    job_id: str
    owner_id: str
    source_file: Path
    output_dir: Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_qualified(config: WorkerQualification, *, executable: Path, checkpoint: Path) -> None:
    if not all((config.enabled, config.operator_approved, config.license_approved, config.gpu_qa_passed)):
        raise SeparationBlocked("STEM_WORKER_NOT_APPROVED")
    if not (executable.is_file() and checkpoint.is_file()):
        raise SeparationBlocked("STEM_WORKER_ARTIFACT_MISSING")
    for expected in (config.weights_sha256, config.expected_binary_sha256):
        if len(expected) != 64 or any(c not in "0123456789abcdefABCDEF" for c in expected):
            raise SeparationBlocked("STEM_WORKER_HASH_UNPINNED")
    if sha256_file(executable) != config.expected_binary_sha256.lower():
        raise SeparationBlocked("STEM_WORKER_BINARY_MISMATCH")
    if sha256_file(checkpoint) != config.weights_sha256.lower():
        raise SeparationBlocked("STEM_WORKER_CHECKPOINT_MISMATCH")


def prepare_request(request: SeparationRequest, *, private_root: Path) -> None:
    root = private_root.resolve(strict=True)
    source = request.source_file.resolve(strict=True)
    output = request.output_dir.resolve(strict=True)
    if not request.owner_id or not request.job_id or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in request.owner_id + request.job_id):
        raise SeparationBlocked("STEM_JOB_IDENTITY_INVALID")
    owner_root = root / request.owner_id
    if not owner_root.is_dir() or not source.is_file() or not source.is_relative_to(owner_root) or not output.is_relative_to(owner_root):
        raise SeparationBlocked("STEM_JOB_STORAGE_SCOPE_INVALID")
    if source.stat().st_size == 0 or source.stat().st_size > 100 * 1024 * 1024:
        raise SeparationBlocked("STEM_JOB_SOURCE_SIZE_INVALID")
    if not output.is_dir():
        raise SeparationBlocked("STEM_JOB_OUTPUT_MISSING")


def run_private_worker(
    request: SeparationRequest,
    *,
    qualification: WorkerQualification,
    executable: Path,
    checkpoint: Path,
    private_root: Path,
    execute: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> subprocess.CompletedProcess[str]:
    """Invoke an approved executable without shell/network calls.

    This is a restricted integration seam; the executable's CLI and sandbox
    still require qualification before any real audio processing.
    """
    require_qualified(qualification, executable=executable, checkpoint=checkpoint)
    prepare_request(request, private_root=private_root)
    cmd = [str(executable.resolve()), "--model", str(checkpoint.resolve()),
           "--input", str(request.source_file.resolve()),
           "--output", str(request.output_dir.resolve())]
    result = execute(cmd, check=False, capture_output=True, text=True, timeout=900,
                     env={"PATH": os.environ.get("PATH", "/usr/bin:/bin")})
    if result.returncode != 0:
        raise SeparationBlocked("STEM_WORKER_EXECUTION_FAILED")
    return result

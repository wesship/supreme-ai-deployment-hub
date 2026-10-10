"""Matrix-3D pipeline adapter.

This adapter validates a local Matrix-3D installation and constructs the
provider command contract. It intentionally does not execute the command;
execution remains owned by the worker runtime with an allowlisted launcher.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Matrix3DConfig:
    repo_dir: Path
    python_executable: Path
    resolution: int = 480
    movement_mode: str = "Straight Travel"


class Matrix3DAdapter:
    name = "matrix3d"

    def __init__(self, config: Matrix3DConfig):
        self.config = config

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not self.config.repo_dir.exists():
            errors.append(f"Matrix-3D repo not found: {self.config.repo_dir}")
        script = self.config.repo_dir / "code" / "panoramic_image_to_video.py"
        if not script.exists():
            errors.append(f"Matrix-3D video script not found: {script}")
        if not self.config.python_executable.exists():
            errors.append(f"Python executable not found: {self.config.python_executable}")
        if self.config.resolution not in (480, 720):
            errors.append("resolution must be 480 or 720")
        return errors

    def command(self, input_dir: Path, gpu_count: int = 1) -> list[str]:
        """Return an allowlisted argv; the caller decides whether to execute it."""
        script = self.config.repo_dir / "code" / "panoramic_image_to_video.py"
        return [
            str(self.config.python_executable),
            str(script),
            f"--inout_dir={input_dir}",
            f"--resolution={self.config.resolution}",
        ]

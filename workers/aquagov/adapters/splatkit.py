"""SplatKit adapter boundary for AquaGov.

SplatKit is treated as the dataset-builder stage: panorama -> generated views ->
SphereSfM/COLMAP dataset. It does not train the final Gaussian Splat itself.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SplatKitConfig:
    executable: str = "comfyui-splatkit"
    workflow: str = "1_generate-dataset-hires.json"


class SplatKitAdapter:
    """Validate and describe a SplatKit job without executing untrusted commands."""

    def __init__(self, config: SplatKitConfig | None = None):
        self.config = config or SplatKitConfig()

    def validate(self, workspace: Path) -> list[str]:
        errors: list[str] = []
        if not workspace.exists():
            errors.append("workspace does not exist")
        if not self.config.workflow.endswith(".json"):
            errors.append("workflow must be a JSON ComfyUI workflow")
        return errors

    def describe(self, input_uri: str, workspace: Path) -> dict[str, str]:
        errors = self.validate(workspace)
        if errors:
            raise ValueError("; ".join(errors))
        return {
            "adapter": "splatkit",
            "input_uri": input_uri,
            "workflow": self.config.workflow,
            "dataset_output": str(workspace / "colmap"),
            "evidence_state": "reconstructed",
        }

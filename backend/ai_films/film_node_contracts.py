from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, Field

class ResolutionSpec(BaseModel):
    width: int = Field(..., ge=64, le=16384)
    height: int = Field(..., ge=64, le=16384)

class ImagePipelineSpec(BaseModel):
    working_resolution: ResolutionSpec = Field(default_factory=lambda: ResolutionSpec(width=2048, height=1080))
    delivery_resolution: ResolutionSpec = Field(default_factory=lambda: ResolutionSpec(width=3840, height=2160))
    working_space: str = "ACEScg"
    display_target: str = "Rec.709"
    master_container: str = "OpenEXR"
    rgb_channel_type: Literal["HALF", "FLOAT"] = "HALF"
    depth_channel_type: Literal["HALF", "FLOAT"] = "FLOAT"
    render_tier: Literal["previs", "edit", "finish", "master"] = "edit"
    hdr: bool = False
    upscale_policy: Literal["none", "auto", "2x", "4x"] = "auto"

class FilmNode(BaseModel):
    node_id: str
    shot_id: str
    kind: str
    task_type: str
    depends_on: list[str] = Field(default_factory=list)
    state: Literal["pending", "queued", "running", "retrying", "blocked", "approved", "failed", "completed"] = "pending"
    queue: str = "ai-films"
    requires_gpu: bool = False
    provider: str | None = None
    inputs: dict[str, Any] = Field(default_factory=dict)
    outputs: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class CouncilMode(str, Enum):
    FAST = "fast"
    SMART = "smart"
    REDTEAM = "redteam"


class CandidateSpec(BaseModel):
    provider: str
    model: str
    weight: float = Field(default=1.0, ge=0.0)
    max_cost_usd: float | None = Field(default=None, ge=0.0)
    timeout_seconds: float = Field(default=30.0, gt=0.0, le=120.0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CouncilRequest(BaseModel):
    prompt: str = Field(min_length=1)
    mode: CouncilMode = CouncilMode.FAST
    candidates: list[CandidateSpec] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)
    max_parallel: int = Field(default=3, ge=1, le=8)
    max_total_cost_usd: float | None = Field(default=None, ge=0.0)
    require_verification: bool = True


class CandidateResult(BaseModel):
    provider: str
    model: str
    content: str = ""
    success: bool
    latency_ms: int = 0
    cost_usd: float | None = None
    error: str | None = None
    score: float = 0.0
    groundedness: float = 0.0
    task_completion: float = 0.0
    consistency: float = 0.0
    tool_correctness: float = 0.0
    confidence: float = 0.0
    safety_passed: bool = True
    verification_passed: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class CouncilResult(BaseModel):
    mode: CouncilMode
    winner: CandidateResult | None = None
    candidates: list[CandidateResult] = Field(default_factory=list)
    verification_required: bool = True
    verification_passed: bool = False
    blocked_reason: str | None = None
    total_cost_usd: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)

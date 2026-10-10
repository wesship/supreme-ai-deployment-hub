from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class IntelligenceEntity(BaseModel):
    name: str
    type: str | None = None
    external_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class IntelligenceEvidence(BaseModel):
    title: str | None = None
    url: str | None = None
    source: str | None = None
    published_at: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class IntelligenceEvent(BaseModel):
    """D3VONN-owned normalization contract for external intelligence signals."""

    schema_version: Literal["d3vonn.intelligence-event/v1"] = "d3vonn.intelligence-event/v1"
    source: Literal["worldmonitor"] = "worldmonitor"
    domain: str
    event_type: str
    title: str | None = None
    summary: str | None = None
    entities: list[IntelligenceEntity] = Field(default_factory=list)
    location: dict[str, Any] = Field(default_factory=dict)
    severity: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    evidence: list[IntelligenceEvidence] = Field(default_factory=list)
    relationships: list[dict[str, Any]] = Field(default_factory=list)
    raw_source_id: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)

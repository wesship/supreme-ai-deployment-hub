"""Typed contracts for the D3VONN Open Source Integration Layer."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class IntegrationTier(str, Enum):
    """Strategic fit tier for D3VONN.IO."""

    tier_1 = "tier_1_high_priority"
    tier_2 = "tier_2_valuable_extension"
    tier_3 = "tier_3_specialized_module"
    tier_4 = "tier_4_use_carefully"


class IntegrationStatus(str, Enum):
    """Operational lifecycle state for an integration provider."""

    planned = "planned"
    adapter_ready = "adapter_ready"
    external_service_required = "external_service_required"
    disabled = "disabled"


class IntegrationProvider(BaseModel):
    """A third-party capability provider exposed behind a D3VONN adapter."""

    key: str
    name: str
    source_url: str
    replaces: str
    tier: IntegrationTier
    status: IntegrationStatus = IntegrationStatus.planned
    capabilities: List[str] = Field(default_factory=list)
    d3vonn_use_cases: List[str] = Field(default_factory=list)
    adapter_endpoint: Optional[str] = None
    caution: Optional[str] = None
    env_vars: List[str] = Field(default_factory=list)


class CapabilityRequest(BaseModel):
    """Generic request Hermes can send to a provider adapter."""

    capability: str = Field(..., description="Capability name such as model_chat, email_triage, video_render.")
    task: str = Field(..., description="Plain-language task instruction from Hermes or the user.")
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CapabilityResponse(BaseModel):
    """Generic response returned by an adapter."""

    provider: str
    capability: str
    status: str
    message: str
    data: Dict[str, Any] = Field(default_factory=dict)

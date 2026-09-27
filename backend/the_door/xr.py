"""Provider-neutral XR contracts and Meta boundary for THE DOOR.

XR input is presentation/input only. It never authorizes progression or loads a
realm directly; authoritative game logic must validate an interaction before the
engine transitions the player.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class XRProvider(str, Enum):
    META = "meta"
    OPENXR = "openxr"
    XREAL = "xreal"
    WEBXR = "webxr"
    DESKTOP = "desktop"
    MOBILE = "mobile"


class XRInputKind(str, Enum):
    GAZE = "gaze"
    HAND = "hand"
    CONTROLLER = "controller"
    VOICE = "voice"
    SPATIAL_ANCHOR = "spatial_anchor"


class XRInteraction(BaseModel):
    schema: Literal["d3vonn.the-door.xr-interaction/v1"] = "d3vonn.the-door.xr-interaction/v1"
    project_id: str = Field(..., min_length=1)
    provider: XRProvider
    input_kind: XRInputKind
    action: str = Field(..., min_length=1, max_length=120)
    target_id: str | None = Field(default=None, max_length=200)
    session_id: str | None = Field(default=None, max_length=200)
    spatial_anchor_id: str | None = Field(default=None, max_length=300)
    payload: dict[str, Any] = Field(default_factory=dict)


class XRInteractionResult(BaseModel):
    schema: Literal["d3vonn.the-door.xr-interaction-result/v1"] = (
        "d3vonn.the-door.xr-interaction-result/v1"
    )
    accepted: bool
    authoritative: bool = False
    provider: XRProvider
    action: str
    target_id: str | None = None
    next_step: str
    reason: str | None = None
    normalized_input: dict[str, Any] = Field(default_factory=dict)


class XRProviderCapabilities(BaseModel):
    provider: XRProvider
    configured: bool
    mode: str
    capabilities: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class MetaXRAdapter:
    """Meta XR boundary.

    This adapter normalizes Meta-originated interaction into THE DOOR's governed
    control plane. It deliberately does not perform level loading, progression
    mutation, save mutation, or canon mutation.
    """

    provider = XRProvider.META

    @property
    def configured(self) -> bool:
        # Runtime SDK configuration lives in the Unreal client. The backend
        # accepts normalized interaction contracts without storing Meta secrets.
        return True

    def capabilities(self) -> XRProviderCapabilities:
        return XRProviderCapabilities(
            provider=self.provider,
            configured=self.configured,
            mode="input-presentation-adapter",
            capabilities=[
                "gaze",
                "hand-tracking",
                "controllers",
                "voice-intent",
                "spatial-anchors",
                "portal-targeting",
            ],
            notes=[
                "Unreal remains the authoritative runtime.",
                "Meta XR must route entry attempts through THE DOOR gameplay gate.",
                "No direct LoadLevel/OpenLevel operation is authorized by this adapter.",
            ],
        )

    def normalize(self, interaction: XRInteraction) -> XRInteractionResult:
        if interaction.provider is not self.provider:
            return XRInteractionResult(
                accepted=False,
                provider=interaction.provider,
                action=interaction.action,
                target_id=interaction.target_id,
                next_step="reject",
                reason="Interaction provider does not match the Meta XR adapter.",
            )

        return XRInteractionResult(
            accepted=True,
            provider=self.provider,
            action=interaction.action,
            target_id=interaction.target_id,
            next_step="authorize_in_game",
            normalized_input={
                "input_kind": interaction.input_kind.value,
                "session_id": interaction.session_id,
                "spatial_anchor_id": interaction.spatial_anchor_id,
                "payload": interaction.payload,
            },
        )

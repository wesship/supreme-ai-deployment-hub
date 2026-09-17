"""Canonical Jetson and smart-glasses control-plane contracts.

The contracts are transport-neutral. Device execution remains behind an
authenticated backend adapter and never occurs directly from the browser.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, Mapping


class DeviceClass(StrEnum):
    JETSON = "jetson"
    SMART_GLASSES = "smart_glasses"
    COMPANION = "companion"
    ROBOTICS = "robotics"


class DeviceState(StrEnum):
    ENROLLED = "enrolled"
    ONLINE = "online"
    OFFLINE = "offline"
    REVOKED = "revoked"
    QUARANTINED = "quarantined"
    PRIVACY_LOCKED = "privacy_locked"


class Capability(StrEnum):
    CAMERA = "camera"
    MICROPHONE = "microphone"
    AUDIO_OUTPUT = "audio_output"
    DISPLAY = "display"
    NOTIFICATIONS = "notifications"
    VOICE_INPUT = "voice_input"
    IMAGE_CAPTURE = "image_capture"
    VIDEO_CAPTURE = "video_capture"
    LOCATION = "location"
    EDGE_INFERENCE = "edge_inference"
    ACTUATION = "actuation"


class CommandKind(StrEnum):
    HEALTH_CHECK = "health_check"
    START_VISION_PIPELINE = "start_vision_pipeline"
    STOP_VISION_PIPELINE = "stop_vision_pipeline"
    DEPLOY_MODEL = "deploy_model"
    REBOOT = "reboot"
    ENTER_SAFE_STATE = "enter_safe_state"
    DISPLAY_NOTIFICATION = "display_notification"
    AUDIO_NOTIFICATION = "audio_notification"
    CAPTURE_IMAGE = "capture_image"
    START_CAPTURE = "start_capture"
    STOP_CAPTURE = "stop_capture"


SENSITIVE_COMMANDS = frozenset({
    CommandKind.CAPTURE_IMAGE,
    CommandKind.START_CAPTURE,
    CommandKind.STOP_CAPTURE,
})

HIGH_IMPACT_COMMANDS = frozenset({
    CommandKind.DEPLOY_MODEL,
    CommandKind.REBOOT,
    CommandKind.ENTER_SAFE_STATE,
})

PRIVACY_SENSITIVE_CAPABILITIES = frozenset({
    Capability.CAMERA,
    Capability.MICROPHONE,
    Capability.IMAGE_CAPTURE,
    Capability.VIDEO_CAPTURE,
    Capability.LOCATION,
})


@dataclass(frozen=True, slots=True)
class DeviceProfile:
    device_id: str
    device_class: DeviceClass
    model_family: str
    firmware_version: str | None
    capabilities: frozenset[Capability] = field(default_factory=frozenset)
    state: DeviceState = DeviceState.ENROLLED
    companion_device_id: str | None = None


@dataclass(frozen=True, slots=True)
class DeviceTelemetry:
    device_id: str
    device_class: DeviceClass
    state: DeviceState
    observed_at: datetime
    battery_percent: float | None = None
    cpu_percent: float | None = None
    gpu_percent: float | None = None
    memory_percent: float | None = None
    temperature_c: float | None = None
    network_state: str | None = None
    privacy_state: str | None = None
    model_version: str | None = None
    firmware_version: str | None = None


@dataclass(frozen=True, slots=True)
class ControlCommand:
    command_id: str
    device_id: str
    kind: CommandKind
    issued_at: datetime
    expires_at: datetime
    actor_id: str
    request_id: str
    payload: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class CommandDecision:
    allowed: bool
    reason: str
    safety_class: str


SAFE_STATE_COMMAND = CommandKind.ENTER_SAFE_STATE

"""Canonical Jetson Control command and telemetry contracts.

The contracts are deliberately transport-neutral so the control plane can be
backed by REST, WebSocket, MQTT, or another authenticated device adapter.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any, Mapping


class DeviceState(StrEnum):
    ENROLLED = "enrolled"
    ONLINE = "online"
    OFFLINE = "offline"
    REVOKED = "revoked"
    QUARANTINED = "quarantined"


class CommandKind(StrEnum):
    HEALTH_CHECK = "health_check"
    START_VISION_PIPELINE = "start_vision_pipeline"
    STOP_VISION_PIPELINE = "stop_vision_pipeline"
    DEPLOY_MODEL = "deploy_model"
    REBOOT = "reboot"
    ENTER_SAFE_STATE = "enter_safe_state"


@dataclass(frozen=True, slots=True)
class DeviceTelemetry:
    device_id: str
    state: DeviceState
    observed_at: datetime
    cpu_percent: float
    gpu_percent: float
    memory_percent: float
    temperature_c: float
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

# Commands that can materially alter a device require an explicit backend
# authorization decision and must never be treated as browser-safe actions.
HIGH_IMPACT_COMMANDS = frozenset(
    {
        CommandKind.DEPLOY_MODEL,
        CommandKind.REBOOT,
        CommandKind.ENTER_SAFE_STATE,
    }
)

"""Domain contracts for THE DOOR game-development runtime.

THE DOOR intentionally depends on internal engine adapter contracts instead of
binding Hermes directly to Aura or Unreal implementation details.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class EngineProvider(str, Enum):
    AURA = "aura"
    UNREAL_NATIVE = "unreal-native"


class DoorJobKind(str, Enum):
    CREATE_OR_OPEN_PROJECT = "create_or_open_project"
    CREATE_LEVEL = "create_level"
    CREATE_ACTOR = "create_actor"
    CONFIGURE_COMPONENT = "configure_component"
    AUTHOR_GAMEPLAY_LOGIC = "author_gameplay_logic"
    RUN_PLAYTEST = "run_playtest"
    CAPTURE_OBSERVATION = "capture_observation"
    DIAGNOSE_FAILURE = "diagnose_failure"
    APPLY_REPAIR = "apply_repair"
    VERIFY_RESULT = "verify_result"
    PACKAGE_BUILD = "package_build"


class DoorJobState(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    BLOCKED = "blocked"
    FAILED = "failed"
    SUCCEEDED = "succeeded"
    VERIFIED = "verified"


class CanonReference(BaseModel):
    canon_id: str = Field(..., min_length=1)
    version: str | None = None


class AssetReference(BaseModel):
    asset_id: str = Field(..., min_length=1)
    uri: str | None = None
    media_type: str | None = None


class GameProject(BaseModel):
    schema: Literal["d3vonn.the-door.game-project/v1"] = "d3vonn.the-door.game-project/v1"
    project_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    engine: Literal["unreal"] = "unreal"
    engine_version: str | None = None
    canon: list[CanonReference] = Field(default_factory=list)
    assets: list[AssetReference] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class DoorJob(BaseModel):
    schema: Literal["d3vonn.the-door.job/v1"] = "d3vonn.the-door.job/v1"
    job_id: str = Field(..., min_length=1)
    project_id: str = Field(..., min_length=1)
    kind: DoorJobKind
    provider: EngineProvider = EngineProvider.AURA
    state: DoorJobState = DoorJobState.QUEUED
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    verification: dict[str, Any] = Field(default_factory=dict)
    hermes_goal_id: str | None = None
    hermes_task_id: str | None = None


class VerificationResult(BaseModel):
    schema: Literal["d3vonn.the-door.verification/v1"] = "d3vonn.the-door.verification/v1"
    passed: bool
    checks: list[str] = Field(default_factory=list)
    failures: list[str] = Field(default_factory=list)
    observations: dict[str, Any] = Field(default_factory=dict)

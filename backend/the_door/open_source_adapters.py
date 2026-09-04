"""Provider-neutral open-source engine adapter boundaries for THE DOOR.

These adapters intentionally fail closed until a real local/remote editor or
runtime transport is configured. Capability discovery may be exposed safely;
mutation jobs must never pretend an engine operation succeeded.
"""
from __future__ import annotations

from dataclasses import dataclass

from backend.the_door.contracts import (
    DoorJob,
    DoorJobState,
    EngineProvider,
    GameProject,
    VerificationResult,
)


@dataclass(frozen=True)
class AdapterDescriptor:
    provider: EngineProvider
    engine: str
    role: str
    recommended_for: tuple[str, ...]
    transport_env: str


class UnconfiguredEngineAdapter:
    descriptor: AdapterDescriptor

    def __init__(self, descriptor: AdapterDescriptor):
        self.descriptor = descriptor

    @property
    def name(self) -> str:
        return self.descriptor.provider.value

    @property
    def configured(self) -> bool:
        return False

    def capabilities(self) -> dict[str, object]:
        return {
            "provider": self.name,
            "engine": self.descriptor.engine,
            "role": self.descriptor.role,
            "configured": self.configured,
            "mode": "adapter-boundary",
            "recommended_for": list(self.descriptor.recommended_for),
            "transport_env": self.descriptor.transport_env,
        }

    async def execute(self, project: GameProject, job: DoorJob) -> DoorJob:
        return job.model_copy(
            update={
                "state": DoorJobState.BLOCKED,
                "output": {
                    **job.output,
                    "reason": f"{self.name} transport is not configured yet.",
                    "engine": project.engine.value,
                },
            }
        )

    async def verify(self, project: GameProject, job: DoorJob) -> VerificationResult:
        return VerificationResult(
            passed=False,
            failures=[f"{self.name} transport is not configured yet."],
            observations={"provider": self.name, "engine": project.engine.value},
        )


OPEN_SOURCE_ENGINE_DESCRIPTORS = (
    AdapterDescriptor(
        EngineProvider.GODOT,
        "godot",
        "open-source general-purpose game engine",
        ("rapid prototypes", "2D/3D games", "XR", "agent-driven scene generation"),
        "THE_DOOR_GODOT_TRANSPORT_URL",
    ),
    AdapterDescriptor(
        EngineProvider.O3DE,
        "o3de",
        "open-source high-fidelity simulation and world engine",
        ("large worlds", "simulation", "robotics", "digital twins"),
        "THE_DOOR_O3DE_TRANSPORT_URL",
    ),
    AdapterDescriptor(
        EngineProvider.BEVY,
        "bevy",
        "Rust ECS simulation/runtime engine",
        ("large NPC populations", "agent simulation", "procedural systems"),
        "THE_DOOR_BEVY_TRANSPORT_URL",
    ),
    AdapterDescriptor(
        EngineProvider.STRIDE,
        "stride",
        "open-source C#/.NET game engine",
        ("C# workflows", "2D/3D games", "VR"),
        "THE_DOOR_STRIDE_TRANSPORT_URL",
    ),
    AdapterDescriptor(
        EngineProvider.GDEVELOP,
        "gdevelop",
        "open-source rapid-prototyping engine",
        ("fast prototypes", "web/mobile builds", "low-code gameplay"),
        "THE_DOOR_GDEVELOP_TRANSPORT_URL",
    ),
)


def build_open_source_adapters() -> dict[EngineProvider, UnconfiguredEngineAdapter]:
    return {
        descriptor.provider: UnconfiguredEngineAdapter(descriptor)
        for descriptor in OPEN_SOURCE_ENGINE_DESCRIPTORS
    }

"""Blender asset-pipeline boundary shared by THE DOOR and AI Films.

Blender is treated as a DCC/asset pipeline, not as a game engine. This module
keeps canonical assets engine-neutral and prepares derived variants only when a
real Blender worker/transport is configured.
"""
from __future__ import annotations

from backend.the_door.contracts import (
    AssetPipelineProvider,
    AssetPreparationRequest,
    AssetPreparationResult,
    DoorJobState,
)


class BlenderAssetPipeline:
    @property
    def name(self) -> str:
        return AssetPipelineProvider.BLENDER.value

    @property
    def configured(self) -> bool:
        return False

    def capabilities(self) -> dict[str, object]:
        return {
            "provider": self.name,
            "configured": self.configured,
            "mode": "asset-pipeline-boundary",
            "recommended_version": "5.2 LTS",
            "operations": [
                "model",
                "rig",
                "animate",
                "retarget",
                "lod",
                "collision",
                "bake_textures",
                "geometry_nodes",
                "export_gltf",
                "export_usd",
            ],
            "shared_consumers": ["ai-films", "the-door"],
            "transport_env": "THE_DOOR_BLENDER_TRANSPORT_URL",
        }

    async def prepare(self, request: AssetPreparationRequest) -> AssetPreparationResult:
        return AssetPreparationResult(
            configured=False,
            state=DoorJobState.BLOCKED,
            notes=[
                "Blender transport is not configured yet.",
                "Canonical source asset remains unchanged; no derived engine asset was created.",
                f"Target engine: {request.target_engine.value}",
            ],
        )

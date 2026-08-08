"""Compile Production Bible + Shot Manifest entries into provider-neutral generation packets."""
from __future__ import annotations

from typing import Any

from backend.ai_films.production_bible import ProductionBible, ShotManifestItem


class CanonViolation(ValueError):
    pass


def _character_map(bible: ProductionBible) -> dict[str, Any]:
    return {row.character_id: row for row in bible.characters}


def _instance_event_contradiction(action: str) -> bool:
    text = " ".join(action.lower().split())
    forbidden_positive = (
        "physically defeats",
        "physically defeat",
        "kills instance",
        "kills the instance",
    )
    if any(term in text for term in forbidden_positive):
        return True
    if "second rescue" in text and not any(
        phrase in text
        for phrase in (
            "no second rescue",
            "without a second rescue",
            "there is no second rescue",
            "not a second rescue",
        )
    ):
        return True
    if "physical defeat" in text and not any(
        phrase in text
        for phrase in (
            "no physical defeat",
            "without physical defeat",
            "not a physical defeat",
        )
    ):
        return True
    return False


def validate_shot(shot: ShotManifestItem, bible: ProductionBible) -> list[str]:
    """Return deterministic canon warnings; raise only for immutable contradictions."""
    warnings: list[str] = []
    characters = _character_map(bible)
    for character_id in shot.characters:
        if character_id not in characters:
            warnings.append(f"unknown_character:{character_id}")

    if "legend" in shot.characters:
        wardrobe = shot.wardrobe_state.get("legend") if isinstance(shot.wardrobe_state, dict) else None
        if isinstance(wardrobe, dict):
            top = str(wardrobe.get("top") or "").lower()
            if top and "white" not in top:
                raise CanonViolation("Legend wardrobe violates immutable white T-shirt lock")
            if wardrobe.get("logo") or wardrobe.get("logos"):
                raise CanonViolation("Legend wardrobe violates immutable no-logo lock")
        camera = " ".join(str(v) for v in shot.camera.values()).lower()
        if camera and not any(term in camera for term in ("center", "clean", "symmetr")):
            warnings.append("legend_camera_should_remain_centered_clean")

    if "SS-IE-J/L-001" in shot.canon_refs and _instance_event_contradiction(shot.action):
        raise CanonViolation("Shot contradicts immutable Instance Event SS-IE-J/L-001")
    return warnings


def build_generation_packet(shot: ShotManifestItem, bible: ProductionBible) -> dict[str, Any]:
    warnings = validate_shot(shot, bible)
    character_map = _character_map(bible)
    character_locks = {
        cid: character_map[cid].model_dump(mode="json")
        for cid in shot.characters
        if cid in character_map
    }
    return {
        "schema": "d3vonn.ai-films.generation-packet/v1",
        "project_id": bible.project_id,
        "bible_version": bible.version,
        "shot_id": shot.shot_id,
        "sequence_id": shot.sequence_id,
        "scene_id": shot.scene_id,
        "purpose": shot.purpose,
        "duration_target_seconds": shot.duration_target_seconds,
        "generation_prompt": shot.generation_prompt,
        "negative_prompt": shot.negative_prompt,
        "anchor_frame_asset_ids": shot.anchor_frame_asset_ids,
        "character_locks": character_locks,
        "location_id": shot.location_id,
        "wardrobe_state": shot.wardrobe_state,
        "props": shot.props,
        "action": shot.action,
        "camera": shot.camera,
        "lighting": shot.lighting,
        "visual_effects": shot.visual_effects,
        "audio": shot.audio.model_dump(mode="json"),
        "continuity_locks": shot.continuity_locks,
        "canon_refs": shot.canon_refs,
        "provider_route": shot.preferred_providers or bible.generation_policy.get("providers", []),
        "qa": {
            "twelvelabs_analyze": True,
            "jockey_corpus_reasoning": True,
            "canon_validation": True,
            "warnings": warnings,
        },
    }

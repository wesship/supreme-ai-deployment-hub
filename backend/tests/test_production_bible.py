from __future__ import annotations

import pytest

from backend.ai_films.production_bible import SOVEREIGN_SIGNAL_SEED, ShotManifestItem
from backend.ai_films.shot_compiler import CanonViolation, build_generation_packet, validate_shot


def _shot(**overrides):
    payload = {
        "shot_id": "SEQ01-SC01-SH001",
        "sequence_id": "SEQ01",
        "scene_id": "SC01",
        "order": 1,
        "purpose": "Introduce Legend as the signal resolves.",
        "duration_target_seconds": 6,
        "characters": ["legend"],
        "wardrobe_state": {"legend": {"top": "plain white T-shirt", "logos": False}},
        "action": "Legend enters and recognizes the signal.",
        "camera": {"framing": "centered clean medium", "movement": "slow dolly"},
        "generation_prompt": "Legend in a plain white T-shirt, centered, restrained prestige sci-fi.",
        "preferred_providers": ["sora", "higgsfield"],
        "canon_refs": ["legend.wardrobe"],
    }
    payload.update(overrides)
    return ShotManifestItem.model_validate(payload)


def test_generation_packet_carries_canon_and_provider_route():
    packet = build_generation_packet(_shot(), SOVEREIGN_SIGNAL_SEED)
    assert packet["schema"] == "d3vonn.ai-films.generation-packet/v1"
    assert packet["character_locks"]["legend"]["wardrobe_lock"]["top"] == "white T-shirt only"
    assert packet["provider_route"] == ["sora", "higgsfield"]
    assert packet["qa"]["twelvelabs_analyze"] is True
    assert packet["qa"]["jockey_corpus_reasoning"] is True


def test_legend_wrong_wardrobe_is_hard_canon_violation():
    shot = _shot(wardrobe_state={"legend": {"top": "black jacket", "logos": False}})
    with pytest.raises(CanonViolation, match="white T-shirt"):
        validate_shot(shot, SOVEREIGN_SIGNAL_SEED)


def test_instance_event_second_rescue_is_hard_canon_violation():
    shot = _shot(
        action="Legend returns for a second rescue during the ritual.",
        canon_refs=["SS-IE-J/L-001"],
    )
    with pytest.raises(CanonViolation, match="SS-IE-J/L-001"):
        validate_shot(shot, SOVEREIGN_SIGNAL_SEED)

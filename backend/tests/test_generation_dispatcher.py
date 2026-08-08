from backend.ai_films.generation_dispatcher_impl import dispatch_plan, rank_video_routes
from backend.ai_films.production_bible import SOVEREIGN_SIGNAL_SEED, ShotManifestItem


def _shot(shot_id: str, characters: list[str], action: str = "Canon-safe action") -> ShotManifestItem:
    return ShotManifestItem(
        shot_id=shot_id,
        sequence_id="seq",
        scene_id="scene",
        order=1,
        purpose="test",
        duration_target_seconds=6,
        characters=characters,
        wardrobe_state={"legend": {"top": "plain white T-shirt", "logos": False}} if "legend" in characters else {},
        action=action,
        camera={"framing": "centered clean"},
        lighting={},
        visual_effects={},
        generation_prompt="cinematic test",
        preferred_providers=["sora", "replicate"],
    )


def test_character_generation_blocks_without_required_anchor():
    plan = dispatch_plan(
        _shot("SS-CANON-001", ["legend"]),
        SOVEREIGN_SIGNAL_SEED,
        conform_decision="generate",
        environ={"OPENAI_API_KEY": "configured"},
    )
    assert plan["action"] == "blocked"
    assert plan["reason"] == "anchor_frames_required"
    assert plan["missing_anchor_characters"] == ["legend"]
    assert plan["selected_provider"] is None


def test_instance_event_reports_all_missing_character_anchors():
    shot = _shot(
        "SS-CANON-003",
        ["legend", "jahid"],
        "The ritual fails. There is no second rescue and no physical defeat.",
    )
    shot.canon_refs = ["SS-IE-J/L-001"]
    plan = dispatch_plan(
        shot,
        SOVEREIGN_SIGNAL_SEED,
        conform_decision="generate",
        environ={"OPENAI_API_KEY": "configured"},
    )
    assert plan["action"] == "blocked"
    assert plan["missing_anchor_characters"] == ["jahid", "legend"]


def test_manual_review_never_routes_to_paid_generation():
    plan = dispatch_plan(
        _shot("SS-CANON-002", ["nana"]),
        SOVEREIGN_SIGNAL_SEED,
        conform_decision="manual_review",
        environ={"OPENAI_API_KEY": "configured"},
    )
    assert plan == {
        "shot_id": "SS-CANON-002",
        "action": "hold",
        "reason": "conform_decision:manual_review",
        "routes": [],
    }


def test_sora_alias_ranks_as_openai_when_configured():
    packet = {
        "provider_route": ["sora", "higgsfield"],
        "character_locks": {},
        "anchor_frame_asset_ids": [],
        "audio": {},
    }
    routes = rank_video_routes(packet, {"OPENAI_API_KEY": "configured"})
    assert routes[0].provider == "openai"
    assert routes[0].configured is True

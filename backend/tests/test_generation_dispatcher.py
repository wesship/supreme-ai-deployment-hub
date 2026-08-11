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
    assert routes[0].dispatchable is True


def test_kling_alias_routes_with_anchor_and_character_continuity_fit():
    packet = {
        "provider_route": ["kling.ai", "invideo"],
        "character_locks": {"legend": {"anchor_asset_ids": ["anchor-1"]}},
        "anchor_frame_asset_ids": ["anchor-1"],
        "audio": {},
    }
    routes = rank_video_routes(
        packet,
        {"KLING_ACCESS_KEY": "access", "KLING_SECRET_KEY": "secret"},
    )
    assert routes[0].provider == "kling"
    assert routes[0].configured is True
    assert routes[0].dispatchable is False
    assert "anchor_frame_fit" in routes[0].reasons
    assert "character_continuity_fit" in routes[0].reasons
    assert "executor_not_registered" in routes[0].reasons


def test_custom_video_provider_participates_in_dispatch_ranking():
    packet = {
        "provider_route": ["studio_x"],
        "character_locks": {},
        "anchor_frame_asset_ids": [],
        "audio": {},
    }
    routes = rank_video_routes(
        packet,
        {
            "CUSTOM_VIDEO_TOKEN": "configured",
            "AI_FILM_CUSTOM_PROVIDERS_JSON": '[{"capability":"video","provider":"studio_x","required_env":["CUSTOM_VIDEO_TOKEN"]}]',
        },
    )
    selected = next(route for route in routes if route.provider == "studio_x")
    assert selected.configured is True
    assert selected.dispatchable is False
    assert "preferred_by_manifest" in selected.reasons


def test_configured_provider_without_executor_is_never_queued():
    shot = _shot("SS-EXEC-001", [])
    shot.preferred_providers = ["kling"]
    plan = dispatch_plan(
        shot,
        SOVEREIGN_SIGNAL_SEED,
        conform_decision="generate",
        environ={"KLING_ACCESS_KEY": "access", "KLING_SECRET_KEY": "secret"},
    )
    assert plan["action"] == "blocked"
    assert plan["reason"] == "configured_provider_has_no_executor"
    assert plan["selected_provider"] is None


def test_provider_can_queue_after_executor_is_explicitly_registered():
    shot = _shot("SS-EXEC-002", [])
    shot.preferred_providers = ["kling"]
    plan = dispatch_plan(
        shot,
        SOVEREIGN_SIGNAL_SEED,
        conform_decision="generate",
        environ={
            "KLING_ACCESS_KEY": "access",
            "KLING_SECRET_KEY": "secret",
            "AI_FILM_VIDEO_EXECUTOR_PROVIDERS": "openai,kling",
        },
    )
    assert plan["action"] == "queue"
    assert plan["selected_provider"] == "kling"

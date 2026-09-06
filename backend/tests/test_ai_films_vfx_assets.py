from backend.ai_films.providers import provider_health, validate_provider
from backend.ai_films.vfx_assets import (
    MAKEBIGFILMS_COLLECTIONS,
    catalog,
    normalize_camera_direction,
    resolve_vfx_assets,
)


def test_makebigfilms_provider_is_registered_as_vfx_asset_capability():
    health = provider_health({})
    entry = next(
        item
        for item in health["providers"]
        if item["provider"] == "makebigfilms" and item["capability"] == "vfx_asset"
    )
    assert entry["status"] == "configured"
    assert health["capabilities"]["vfx_asset"] is True
    assert validate_provider("vfx_asset", "makebigfilms").provider == "makebigfilms"


def test_catalog_exposes_verified_collection_count_and_guardrails():
    payload = catalog()
    assert payload["provider"] == "makebigfilms"
    assert payload["collection_count"] == 32
    assert payload["collection_count"] == len(MAKEBIGFILMS_COLLECTIONS)
    assert payload["guardrails"]["automatic_download"] is False
    assert payload["guardrails"]["license_provenance_required"] is True


def test_sovereign_signal_dimensional_event_routes_to_relevant_vfx_collections():
    result = resolve_vfx_assets(
        "Legend watches a dimensional portal fracture the sky above a futuristic city "
        "while lightning, debris, and a giant spaceship emerge.",
        camera_direction="front right",
        limit=8,
    )
    collections = {item["collection"] for item in result["candidates"]}
    assert "magic" in collections
    assert "superheroes" in collections
    assert "destruction" in collections
    assert "spaceships" in collections
    assert result["camera_direction"] == "front-right"
    assert result["handoff"]["automatic_download"] is False


def test_unknown_scene_language_falls_back_to_general_compositing_collections():
    result = resolve_vfx_assets("A quiet abstract visual beat with no explicit named effect.")
    assert [item["collection"] for item in result["candidates"]] == [
        "environments",
        "sci-fi",
        "light overlays",
    ]


def test_camera_aliases_are_normalized():
    assert normalize_camera_direction("rear left") == "back-left"
    assert normalize_camera_direction("FRONT_RIGHT") == "front-right"

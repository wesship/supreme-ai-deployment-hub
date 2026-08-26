from backend.ai_films.free_video_providers import FREE_VIDEO_PROVIDERS, free_video_provider_health


def test_all_reported_free_providers_are_non_executable_by_default():
    assert {p.status for p in FREE_VIDEO_PROVIDERS} <= {"unverified", "manual_bridge"}
    assert all(not item["production_eligible"] for item in free_video_provider_health())


def test_provider_metadata_is_safe_for_ui():
    rows = free_video_provider_health()
    assert {row["provider"] for row in rows} == {
        "vibes_meta", "symphony_tiktok", "snapgen", "zsky"
    }
    for row in rows:
        assert "api_key" not in row
        assert "secret" not in row
        assert "capabilities" in row

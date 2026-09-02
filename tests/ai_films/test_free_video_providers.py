from backend.ai_films.free_video_providers import FREE_VIDEO_PROVIDERS, free_video_provider_health


def test_candidate_video_providers_never_become_executable_from_catalog_metadata():
    assert all(not item["production_eligible"] for item in free_video_provider_health())


def test_provider_metadata_is_safe_and_evidence_backed_for_ui():
    rows = free_video_provider_health()
    assert {row["provider"] for row in rows} == {
        "vibes_meta",
        "symphony_tiktok",
        "snapgen",
        "zsky",
    }

    for row in rows:
        assert "api_key" not in row
        assert "secret" not in row
        assert row["source_url"].startswith("https://")
        assert row["verified_on"] == "2026-09-01"
        assert row["source_label"]
        assert row["automation_access"] in {
            "unverified",
            "manual_only",
            "official_api",
            "private_beta_api",
        }
        assert "capabilities" in row


def test_evidence_classification_matches_verified_access_boundaries():
    providers = {provider.provider: provider for provider in FREE_VIDEO_PROVIDERS}

    assert providers["vibes_meta"].automation_access == "manual_only"
    assert providers["vibes_meta"].status == "manual_bridge"

    assert providers["symphony_tiktok"].automation_access == "official_api"
    assert providers["symphony_tiktok"].free_tier_verified is True

    assert providers["snapgen"].cost_model == "paid_per_call"
    assert providers["snapgen"].free_tier_verified is False

    assert providers["zsky"].automation_access == "private_beta_api"
    assert providers["zsky"].cost_model == "paid_subscription"
    assert providers["zsky"].free_tier_verified is True

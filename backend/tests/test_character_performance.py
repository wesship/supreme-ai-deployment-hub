from __future__ import annotations

import pytest

from backend.ai_films import character_performance as perf
from backend.ai_films.orchestration import OrchestrationError
from backend.ai_films.providers import provider_health, validate_provider


class FakeUser:
    id = "user-1"


class FakeDB:
    inserted = None

    def __init__(self, token: str):
        self.token = token

    async def current_user(self):
        return FakeUser()

    async def insert(self, table, payload):
        assert table == "ai_film_render_jobs"
        FakeDB.inserted = payload
        return {"id": "job-1", **payload}


def test_provider_health_exposes_character_capabilities():
    health = provider_health(
        {
            "REPLICATE_API_TOKEN": "token",
            "AI_FILM_REPLICATE_AVATAR_MODEL": "owner/avatar-model",
            "AI_FILM_REPLICATE_CHARACTER_MODEL": "owner/replace-model",
            "AI_FILM_REPLICATE_LIPSYNC_MODEL": "owner/lipsync-model",
            "AI_FILM_REPLICATE_PERFORMANCE_MODEL": "owner/performance-model",
        }
    )
    assert health["capabilities"]["avatar"] is True
    assert health["capabilities"]["character_replacement"] is True
    assert health["capabilities"]["lip_sync"] is True
    assert health["capabilities"]["performance_transfer"] is True

    dreamactor = next(
        item
        for item in health["providers"]
        if item["capability"] == "performance_transfer" and item["provider"] == "dreamactor_m1"
    )
    assert dreamactor["status"] == "research_only"
    assert dreamactor["lifecycle"] == "research_watch"
    assert dreamactor["dispatchable"] is False


def test_dreamactor_research_adapter_cannot_dispatch():
    with pytest.raises(RuntimeError, match="cannot dispatch production jobs"):
        validate_provider("performance_transfer", "dreamactor_m1")


@pytest.mark.asyncio
async def test_character_replacement_requires_consent(monkeypatch):
    monkeypatch.setenv("REPLICATE_API_TOKEN", "token")
    monkeypatch.setenv("AI_FILM_REPLICATE_CHARACTER_MODEL", "owner/model")
    with pytest.raises(OrchestrationError, match="consent"):
        await perf.queue_character_performance_job(
            "access-token",
            project_id="project-1",
            capability="character_replacement",
            provider="replicate",
            source_asset_id="source-1",
            target_character_id="legend-avatar",
            consent_confirmed=False,
        )


@pytest.mark.asyncio
async def test_lipsync_queues_continuity_aware_job(monkeypatch):
    monkeypatch.setenv("REPLICATE_API_TOKEN", "token")
    monkeypatch.setenv("AI_FILM_REPLICATE_LIPSYNC_MODEL", "owner/lipsync")
    monkeypatch.setattr(perf, "SupabaseRLSClient", FakeDB)

    result = await perf.queue_character_performance_job(
        "access-token",
        project_id="project-1",
        capability="lip_sync",
        provider="replicate",
        source_asset_id="clip-1",
        dialogue_text="The signal was never lost.",
        voice_id="legend-voice",
        consent_confirmed=True,
        consent_reference="production-release-001",
    )

    assert result["status"] == "queued"
    assert FakeDB.inserted["job_type"] == "lip_sync"
    assert FakeDB.inserted["input"]["source_asset_id"] == "clip-1"
    assert FakeDB.inserted["input"]["continuity"] == {
        "preserve_body_motion": True,
        "preserve_camera": True,
        "preserve_wardrobe": True,
    }
    assert FakeDB.inserted["input"]["consent"]["confirmed"] is True


@pytest.mark.asyncio
async def test_performance_transfer_queues_motion_channels(monkeypatch):
    monkeypatch.setenv("REPLICATE_API_TOKEN", "token")
    monkeypatch.setenv("AI_FILM_REPLICATE_PERFORMANCE_MODEL", "owner/performance")
    monkeypatch.setattr(perf, "SupabaseRLSClient", FakeDB)

    result = await perf.queue_character_performance_job(
        "access-token",
        project_id="sovereign-signal",
        capability="performance_transfer",
        provider="replicate",
        target_character_id="legend",
        reference_asset_ids=["legend-canon-01"],
        driving_video_asset_id="stunt-take-14",
        transfer_face_motion=True,
        transfer_head_motion=True,
        transfer_body_motion=True,
        preserve_camera=True,
        preserve_wardrobe=True,
        consent_confirmed=True,
        consent_reference="legend-performance-release",
    )

    assert result["status"] == "queued"
    assert FakeDB.inserted["job_type"] == "performance_transfer"
    assert FakeDB.inserted["input"]["driving_video_asset_id"] == "stunt-take-14"
    assert FakeDB.inserted["input"]["motion_transfer"] == {
        "face": True,
        "head": True,
        "body": True,
    }
    assert FakeDB.inserted["input"]["target_character_id"] == "legend"

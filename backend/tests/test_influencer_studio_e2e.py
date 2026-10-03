from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest

from backend.hermes.dependencies import HermesDependencies
from backend.hermes.testing import (
    FrozenClock,
    InMemoryAgentDispatcher,
    InMemoryEventSink,
    InMemoryTaskRepository,
)
from backend.influencer_studio.assets import InMemoryCampaignAssetRepository
from backend.influencer_studio.external_providers import ComfyUIWanProvider, EromifyMCPProvider
from backend.influencer_studio.models import Campaign, CampaignState, Persona
from backend.influencer_studio.providers import (
    MediaCapability,
    MediaJob,
    MediaProvider,
    MediaRequest,
    ProviderRegistry,
)
from backend.influencer_studio.repositories import (
    InMemoryCampaignRepository,
    InMemoryPersonaRepository,
    SupabaseCampaignRepository,
    SupabasePersonaRepository,
)
from backend.influencer_studio.runtime import InfluencerCampaignRuntime


OWNER_ID = "00000000-0000-0000-0000-000000000001"


class CompletingProvider(MediaProvider):
    name = "test-media"
    capabilities = frozenset({MediaCapability.TEXT_TO_IMAGE})

    async def submit(self, request: MediaRequest) -> MediaJob:
        return MediaJob(
            provider=self.name,
            external_job_id="job-1",
            status="queued",
            provenance={"request_persona": request.persona_id},
        )

    async def get_job(self, external_job_id: str) -> MediaJob:
        return MediaJob(
            provider=self.name,
            external_job_id=external_job_id,
            status="completed",
            provenance={"result_url": "memory://asset-1"},
        )


def _runtime() -> tuple[InfluencerCampaignRuntime, InMemoryTaskRepository, InMemoryEventSink]:
    repository = InMemoryTaskRepository()
    events = InMemoryEventSink()
    deps = HermesDependencies(
        repository=repository,
        dispatcher=InMemoryAgentDispatcher(),
        event_sink=events,
        clock=FrozenClock(datetime(2026, 10, 3, 17, 30, tzinfo=timezone.utc)),
    )
    providers = ProviderRegistry()
    providers.register(CompletingProvider())
    runtime = InfluencerCampaignRuntime(
        owner_id=OWNER_ID,
        personas=InMemoryPersonaRepository(),
        campaigns=InMemoryCampaignRepository(),
        assets=InMemoryCampaignAssetRepository(),
        providers=providers,
        hermes=deps,
    )
    return runtime, repository, events


@pytest.mark.asyncio
async def test_runtime_certifies_full_loop_without_external_publish() -> None:
    runtime, repository, events = _runtime()

    persona = await runtime.create_persona(
        Persona(
            display_name="Ari",
            character_bible="Synthetic fashion and technology presenter.",
            niche="fashion-tech",
            provenance={"origin": "d3vonn"},
        )
    )
    campaign = await runtime.create_campaign(
        Campaign(persona_id=persona.persona_id, objective="Create launch portrait")
    )
    campaign = await runtime.start_planning(campaign)

    assert campaign.state == CampaignState.PLANNING
    assert campaign.hermes_goal_id
    assert campaign.hermes_task_id
    assert repository.tables["hermes_goals"][0]["metadata"]["source"] == "influencer_studio"
    assert repository.tables["hermes_tasks"][0]["correlation_id"] == campaign.campaign_id

    campaign, asset = await runtime.generate(
        campaign,
        provider_name="test-media",
        request=MediaRequest(
            capability=MediaCapability.TEXT_TO_IMAGE,
            prompt="Editorial portrait in natural light",
            persona_id=persona.persona_id,
        ),
    )
    assert campaign.state == CampaignState.GENERATING
    assert asset.status == "queued"

    asset = await runtime.refresh_asset_status(campaign, asset_id=asset.asset_id)
    assert asset.status == "succeeded"

    campaign = await runtime.enter_qa(campaign)
    assert campaign.state == CampaignState.QA

    asset = await runtime.certify_asset(
        campaign,
        asset_id=asset.asset_id,
        rights_verified=True,
        qa_passed=True,
    )
    assert asset.rights_verified is True
    assert asset.qa_passed is True

    campaign = await runtime.request_approval(campaign)
    assert campaign.state == CampaignState.APPROVAL

    campaign = await runtime.certify_ready_to_publish(campaign, approved_by=OWNER_ID)
    assert campaign.state == CampaignState.READY_TO_PUBLISH

    snapshot = await runtime.snapshot(campaign)
    assert snapshot["external_publish_executed"] is False
    assert snapshot["asset_count"] == 1
    assert snapshot["assets"][0]["rights_verified"] is True
    assert any(
        event.get("event") == "influencer_studio.campaign.transitioned"
        and event.get("to_state") == "ready_to_publish"
        for event in events.events
    )


@pytest.mark.asyncio
async def test_qa_fails_closed_until_provider_job_succeeds() -> None:
    runtime, _, _ = _runtime()
    persona = await runtime.create_persona(
        Persona(display_name="Ari", character_bible="Synthetic presenter", niche="tech")
    )
    campaign = await runtime.create_campaign(
        Campaign(persona_id=persona.persona_id, objective="Portrait")
    )
    campaign = await runtime.start_planning(campaign)
    campaign, _ = await runtime.generate(
        campaign,
        provider_name="test-media",
        request=MediaRequest(
            capability=MediaCapability.TEXT_TO_IMAGE,
            prompt="Portrait",
            persona_id=persona.persona_id,
        ),
    )
    with pytest.raises(ValueError, match="must succeed"):
        await runtime.enter_qa(campaign)


@pytest.mark.asyncio
async def test_owner_scoped_supabase_adapters_roundtrip_hermes_bindings() -> None:
    repository = InMemoryTaskRepository()
    personas = SupabasePersonaRepository(repository, OWNER_ID)
    campaigns = SupabaseCampaignRepository(repository, OWNER_ID)

    persona = await personas.save(
        Persona(display_name="Nova", character_bible="Synthetic creator", niche="education")
    )
    campaign = await campaigns.save(
        Campaign(
            persona_id=persona.persona_id,
            objective="Teach one concept",
            hermes_goal_id="00000000-0000-0000-0000-000000000010",
            hermes_task_id="00000000-0000-0000-0000-000000000011",
        )
    )

    loaded = await campaigns.get(campaign.campaign_id)
    assert loaded is not None
    assert loaded.hermes_goal_id == "00000000-0000-0000-0000-000000000010"
    assert loaded.hermes_task_id == "00000000-0000-0000-0000-000000000011"

    other_owner = SupabaseCampaignRepository(
        repository, "00000000-0000-0000-0000-000000000002"
    )
    assert await other_owner.get(campaign.campaign_id) is None


@pytest.mark.asyncio
async def test_comfyui_wan_adapter_submit_and_refresh() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/system_stats":
            return httpx.Response(200, json={"system": {"os": "linux"}})
        if request.url.path == "/prompt":
            return httpx.Response(200, json={"prompt_id": "prompt-1", "node_errors": {}})
        if request.url.path == "/history/prompt-1":
            return httpx.Response(
                200,
                json={"prompt-1": {"status": {"completed": True}, "outputs": {}}},
            )
        return httpx.Response(404)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://comfy")
    provider = ComfyUIWanProvider(base_url="http://comfy", client=client)

    assert (await provider.probe())["system"]["os"] == "linux"
    job = await provider.submit(
        MediaRequest(
            capability=MediaCapability.TEXT_TO_IMAGE,
            prompt="Portrait",
            persona_id="persona-1",
            options={"workflow": {"1": {"class_type": "TestNode", "inputs": {}}}},
        )
    )
    assert job.external_job_id == "prompt-1"
    refreshed = await provider.get_job(job.external_job_id)
    assert refreshed.status == "succeeded"
    await client.aclose()


@pytest.mark.asyncio
async def test_eromify_adapter_discovers_mcp_tool_and_calls_it() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = __import__("json").loads(request.content.decode("utf-8"))
        method = payload.get("method")
        calls.append(str(method))
        if method == "initialize":
            return httpx.Response(
                200,
                headers={"mcp-session-id": "session-1"},
                json={"jsonrpc": "2.0", "id": payload["id"], "result": {"protocolVersion": "2025-03-26"}},
            )
        if method == "notifications/initialized":
            assert request.headers.get("mcp-session-id") == "session-1"
            return httpx.Response(202)
        if method == "tools/list":
            return httpx.Response(
                200,
                json={
                    "jsonrpc": "2.0",
                    "id": payload["id"],
                    "result": {
                        "tools": [
                            {
                                "name": "generate_image",
                                "description": "Generate an image from a prompt",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {"prompt": {"type": "string"}},
                                },
                            }
                        ]
                    },
                },
            )
        if method == "tools/call":
            assert payload["params"]["name"] == "generate_image"
            return httpx.Response(
                200,
                json={
                    "jsonrpc": "2.0",
                    "id": payload["id"],
                    "result": {
                        "structuredContent": {
                            "generation_id": "ero-1",
                            "status": "completed",
                        }
                    },
                },
            )
        return httpx.Response(400, json={"error": "unexpected"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = EromifyMCPProvider(
        api_key="test-key",
        base_url="https://api.eromify.in/mcp",
        client=client,
    )
    job = await provider.submit(
        MediaRequest(
            capability=MediaCapability.TEXT_TO_IMAGE,
            prompt="Editorial portrait",
            persona_id="persona-1",
        )
    )
    assert job.external_job_id == "ero-1"
    assert job.status == "completed"
    assert calls == [
        "initialize",
        "notifications/initialized",
        "tools/list",
        "tools/call",
    ]
    await client.aclose()


def test_influencer_studio_migration_is_owner_scoped_and_fail_closed() -> None:
    root = Path(__file__).resolve().parents[2]
    migration = (
        root / "supabase/migrations/20261003171500_influencer_studio.sql"
    ).read_text(encoding="utf-8")

    for table in (
        "influencer_personas",
        "influencer_campaigns",
        "influencer_campaign_assets",
    ):
        assert f"create table if not exists public.{table}" in migration
        assert f"alter table public.{table} enable row level security" in migration

    assert migration.count("owner_id = (select auth.uid())") >= 6
    assert "declared_age >= 21" in migration
    assert "synthetic_disclosure = true" in migration
    assert "ready_to_publish" in migration
    assert "rights_verified boolean not null default false" in migration
    assert "qa_passed boolean not null default false" in migration

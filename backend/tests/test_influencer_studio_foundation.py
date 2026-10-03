import pytest

from backend.influencer_studio.hermes_bridge import InfluencerHermesBridge
from backend.influencer_studio.models import Campaign, CampaignState, Persona
from backend.influencer_studio.providers import (
    MediaCapability,
    MediaJob,
    MediaProvider,
    MediaRequest,
    ProviderRegistry,
)
from backend.influencer_studio.repositories import InMemoryCampaignRepository


class FakeProvider(MediaProvider):
    name = "fake"
    capabilities = frozenset(
        {
            MediaCapability.TEXT_TO_IMAGE,
            MediaCapability.IMAGE_TO_VIDEO,
        }
    )

    async def submit(self, request: MediaRequest) -> MediaJob:
        return MediaJob(
            provider=self.name,
            external_job_id="job-1",
            status="queued",
            provenance={
                "persona_id": request.persona_id,
                "capability": request.capability.value,
            },
        )

    async def get_job(self, external_job_id: str) -> MediaJob:
        return MediaJob(
            provider=self.name,
            external_job_id=external_job_id,
            status="succeeded",
            provenance={"provider": self.name},
        )


class FakeSink:
    def __init__(self) -> None:
        self.events: list[dict] = []

    async def emit(self, event: dict) -> None:
        self.events.append(event)


def test_persona_requires_adult_declaration_and_synthetic_disclosure():
    with pytest.raises(ValueError, match="21 or older"):
        Persona(
            display_name="Test",
            character_bible="Synthetic test persona",
            niche="fashion",
            declared_age=20,
        )

    with pytest.raises(ValueError, match="disclosure"):
        Persona(
            display_name="Test",
            character_bible="Synthetic test persona",
            niche="fashion",
            synthetic_disclosure=False,
        )


def test_campaign_rejects_invalid_transition():
    campaign = Campaign(persona_id="persona-1", objective="Launch")
    with pytest.raises(ValueError, match="Invalid campaign transition"):
        campaign.transition(CampaignState.PUBLISHED)


def test_campaign_happy_path_reaches_ready_to_publish():
    campaign = Campaign(persona_id="persona-1", objective="Launch")
    for state in (
        CampaignState.PLANNING,
        CampaignState.GENERATING,
        CampaignState.QA,
        CampaignState.APPROVAL,
        CampaignState.READY_TO_PUBLISH,
    ):
        campaign.transition(state)
    assert campaign.state == CampaignState.READY_TO_PUBLISH


@pytest.mark.asyncio
async def test_provider_registry_routes_by_capability_and_preserves_provenance():
    registry = ProviderRegistry()
    provider = FakeProvider()
    registry.register(provider)

    assert registry.capable(MediaCapability.TEXT_TO_IMAGE) == [provider]
    assert registry.capable(MediaCapability.MOTION_TRANSFER) == []

    job = await provider.submit(
        MediaRequest(
            capability=MediaCapability.TEXT_TO_IMAGE,
            prompt="Editorial portrait",
            persona_id="persona-1",
        )
    )
    assert job.provenance["persona_id"] == "persona-1"
    assert job.provenance["capability"] == "text_to_image"


@pytest.mark.asyncio
async def test_hermes_bridge_fails_closed_without_qa_provenance_and_approval():
    campaign = Campaign(persona_id="persona-1", objective="Launch")
    for state in (
        CampaignState.PLANNING,
        CampaignState.GENERATING,
        CampaignState.QA,
        CampaignState.APPROVAL,
    ):
        campaign.transition(state)

    repository = InMemoryCampaignRepository()
    sink = FakeSink()
    bridge = InfluencerHermesBridge(campaigns=repository, event_sink=sink)

    with pytest.raises(ValueError, match="provenance"):
        await bridge.mark_ready_to_publish(
            campaign,
            approved_by="operator",
            provenance_verified=False,
            qa_passed=True,
        )

    with pytest.raises(ValueError, match="QA"):
        await bridge.mark_ready_to_publish(
            campaign,
            approved_by="operator",
            provenance_verified=True,
            qa_passed=False,
        )

    saved = await bridge.mark_ready_to_publish(
        campaign,
        approved_by="operator",
        provenance_verified=True,
        qa_passed=True,
    )
    assert saved.state == CampaignState.READY_TO_PUBLISH
    assert sink.events[-1]["event"] == "influencer_studio.campaign.transitioned"
    assert sink.events[-1]["metadata"]["external_publish_executed"] is False

from __future__ import annotations

from typing import Any, Protocol

from .models import Campaign, CampaignState
from .repositories import CampaignRepository


class EventSink(Protocol):
    async def emit(self, event: dict[str, Any]) -> None: ...


class InfluencerHermesBridge:
    """Emit auditable Influencer Studio lifecycle events through Hermes' event sink.

    The bridge owns no orchestration logic. It records validated state changes so the
    canonical Hermes event stream can observe and later coordinate the campaign.
    """

    def __init__(
        self,
        *,
        campaigns: CampaignRepository,
        event_sink: EventSink,
    ) -> None:
        self._campaigns = campaigns
        self._event_sink = event_sink

    async def transition(
        self,
        campaign: Campaign,
        target: CampaignState,
        *,
        actor: str = "hermes",
        metadata: dict[str, Any] | None = None,
    ) -> Campaign:
        previous = campaign.state
        campaign.transition(target)
        saved = await self._campaigns.save(campaign)
        await self._event_sink.emit(
            {
                "event": "influencer_studio.campaign.transitioned",
                "campaign_id": campaign.campaign_id,
                "persona_id": campaign.persona_id,
                "from_state": previous.value,
                "to_state": target.value,
                "actor": actor,
                "metadata": metadata or {},
            }
        )
        return saved

    async def mark_ready_to_publish(
        self,
        campaign: Campaign,
        *,
        approved_by: str,
        provenance_verified: bool,
        qa_passed: bool,
    ) -> Campaign:
        if not approved_by.strip():
            raise ValueError("approved_by is required")
        if not provenance_verified:
            raise ValueError("provenance verification is required")
        if not qa_passed:
            raise ValueError("QA must pass before READY_TO_PUBLISH")
        if campaign.state != CampaignState.APPROVAL:
            raise ValueError("campaign must be in approval state")

        return await self.transition(
            campaign,
            CampaignState.READY_TO_PUBLISH,
            actor=approved_by,
            metadata={
                "provenance_verified": True,
                "qa_passed": True,
                "external_publish_executed": False,
            },
        )

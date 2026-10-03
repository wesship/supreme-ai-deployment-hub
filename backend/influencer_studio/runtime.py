from __future__ import annotations

from typing import Any

from backend.hermes.dependencies import HermesDependencies

from .assets import CampaignAssetRepository, asset_from_job, normalize_status
from .hermes_bridge import InfluencerHermesBridge
from .models import Campaign, CampaignState, Persona
from .providers import MediaProvider, MediaRequest, ProviderRegistry
from .repositories import CampaignRepository, PersonaRepository


class InfluencerCampaignRuntime:
    """End-to-end Influencer Studio runtime through READY_TO_PUBLISH.

    External publishing is deliberately outside this runtime. The final certified
    state proves the persona, campaign, generation, provenance, QA, and human
    approval loop without taking an irreversible action on a social platform.
    """

    def __init__(
        self,
        *,
        owner_id: str,
        personas: PersonaRepository,
        campaigns: CampaignRepository,
        assets: CampaignAssetRepository,
        providers: ProviderRegistry,
        hermes: HermesDependencies,
    ) -> None:
        if not owner_id.strip():
            raise ValueError("owner_id is required")
        self.owner_id = owner_id
        self.personas = personas
        self.campaigns = campaigns
        self.assets = assets
        self.providers = providers
        self.hermes = hermes
        self.bridge = InfluencerHermesBridge(
            campaigns=campaigns,
            event_sink=hermes.event_sink,
        )

    async def create_persona(self, persona: Persona) -> Persona:
        saved = await self.personas.save(persona)
        await self.hermes.event_sink.emit(
            {
                "event": "influencer_studio.persona.created",
                "persona_id": saved.persona_id,
                "user_id": self.owner_id,
                "synthetic_disclosure": saved.synthetic_disclosure,
                "declared_age": saved.declared_age,
            }
        )
        return saved

    async def create_campaign(self, campaign: Campaign) -> Campaign:
        persona = await self.personas.get(campaign.persona_id)
        if persona is None:
            raise ValueError("campaign persona does not exist for this owner")
        saved = await self.campaigns.save(campaign)
        await self.hermes.event_sink.emit(
            {
                "event": "influencer_studio.campaign.created",
                "campaign_id": saved.campaign_id,
                "persona_id": saved.persona_id,
                "user_id": self.owner_id,
            }
        )
        return saved

    async def start_planning(self, campaign: Campaign) -> Campaign:
        if campaign.state != CampaignState.DRAFT:
            raise ValueError("campaign must be draft before planning")

        goal = await self.hermes.repository.create_row(
            "hermes_goals",
            {
                "user_id": self.owner_id,
                "title": f"Influencer campaign: {campaign.objective[:120]}",
                "description": "Plan and govern one D3VONN Influencer Studio campaign.",
                "status": "active",
                "metadata": {
                    "source": "influencer_studio",
                    "campaign_id": campaign.campaign_id,
                    "persona_id": campaign.persona_id,
                },
            },
        )
        goal_id = str(goal.get("id") or "")
        if not goal_id:
            raise RuntimeError("Hermes goal creation returned no id")

        task = await self.hermes.repository.create_row(
            "hermes_tasks",
            {
                "user_id": self.owner_id,
                "goal_id": goal_id,
                "kind": "influencer_campaign",
                "title": f"Plan influencer campaign {campaign.campaign_id}",
                "task_type": "influencer_campaign.plan",
                "status": "PENDING",
                "priority": 5,
                "source": "influencer_studio",
                "agent_name": "HERMES",
                "input_data": {
                    "campaign_id": campaign.campaign_id,
                    "persona_id": campaign.persona_id,
                    "objective": campaign.objective,
                    "mode": "proposal_only",
                },
                "correlation_id": campaign.campaign_id,
            },
        )
        task_id = str(task.get("id") or "")
        if not task_id:
            raise RuntimeError("Hermes task creation returned no id")

        campaign.hermes_goal_id = goal_id
        campaign.hermes_task_id = task_id
        campaign.metadata = {
            **campaign.metadata,
            "planning": {
                "mode": "proposal_only",
                "hermes_goal_id": goal_id,
                "hermes_task_id": task_id,
            },
        }
        return await self.bridge.transition(
            campaign,
            CampaignState.PLANNING,
            metadata={"hermes_goal_id": goal_id, "hermes_task_id": task_id},
        )

    async def generate(
        self,
        campaign: Campaign,
        *,
        provider_name: str,
        request: MediaRequest,
    ):
        if campaign.state == CampaignState.PLANNING:
            campaign = await self.bridge.transition(campaign, CampaignState.GENERATING)
        elif campaign.state != CampaignState.GENERATING:
            raise ValueError("campaign must be planning or generating before media generation")

        if request.persona_id != campaign.persona_id:
            raise ValueError("media request persona does not match campaign persona")
        provider: MediaProvider = self.providers.get(provider_name)
        if not provider.supports(request.capability):
            raise ValueError(
                f"provider {provider_name} does not support {request.capability.value}"
            )

        job = await provider.submit(request)
        asset = asset_from_job(campaign_id=campaign.campaign_id, request=request, job=job)
        saved = await self.assets.save(asset)
        await self.hermes.event_sink.emit(
            {
                "event": "influencer_studio.media.submitted",
                "campaign_id": campaign.campaign_id,
                "persona_id": campaign.persona_id,
                "provider": job.provider,
                "provider_job_id": job.external_job_id,
                "capability": request.capability.value,
            }
        )
        return campaign, saved


    async def refresh_asset_status(
        self,
        campaign: Campaign,
        *,
        asset_id: str,
    ):
        assets = await self.assets.list_for_campaign(campaign.campaign_id)
        asset = next((item for item in assets if item.asset_id == asset_id), None)
        if asset is None:
            raise ValueError("campaign asset not found")
        provider = self.providers.get(asset.provider)
        job = await provider.get_job(asset.provider_job_id)
        asset.status = normalize_status(job.status)
        asset.provenance = {
            **asset.provenance,
            "provider_refresh": dict(job.provenance),
        }
        saved = await self.assets.save(asset)
        await self.hermes.event_sink.emit(
            {
                "event": "influencer_studio.media.refreshed",
                "campaign_id": campaign.campaign_id,
                "asset_id": asset.asset_id,
                "provider": asset.provider,
                "provider_job_id": asset.provider_job_id,
                "status": asset.status,
            }
        )
        return saved

    async def enter_qa(self, campaign: Campaign) -> Campaign:
        if campaign.state != CampaignState.GENERATING:
            raise ValueError("campaign must be generating before QA")
        assets = await self.assets.list_for_campaign(campaign.campaign_id)
        if not assets:
            raise ValueError("campaign has no generated assets")
        if any(asset.status != "succeeded" for asset in assets):
            raise ValueError("all campaign assets must succeed before QA")
        return await self.bridge.transition(campaign, CampaignState.QA)

    async def certify_asset(
        self,
        campaign: Campaign,
        *,
        asset_id: str,
        rights_verified: bool,
        qa_passed: bool,
        ai_film_asset_id: str | None = None,
        storage_path: str | None = None,
    ):
        assets = await self.assets.list_for_campaign(campaign.campaign_id)
        asset = next((item for item in assets if item.asset_id == asset_id), None)
        if asset is None:
            raise ValueError("campaign asset not found")
        asset.rights_verified = rights_verified
        asset.qa_passed = qa_passed
        if ai_film_asset_id:
            rows = await self.hermes.repository.list_rows(
                "ai_film_assets",
                {
                    "id": f"eq.{ai_film_asset_id}",
                    "owner_id": f"eq.{self.owner_id}",
                    "limit": "1",
                },
            )
            if not rows:
                raise ValueError("AI Films asset is not owned by this campaign owner")
            asset.ai_film_asset_id = ai_film_asset_id
        if storage_path:
            asset.storage_path = storage_path
        saved = await self.assets.save(asset)
        await self.hermes.event_sink.emit(
            {
                "event": "influencer_studio.asset.certified",
                "campaign_id": campaign.campaign_id,
                "asset_id": asset.asset_id,
                "rights_verified": rights_verified,
                "qa_passed": qa_passed,
                "ai_film_asset_id": ai_film_asset_id,
            }
        )
        return saved

    async def request_approval(self, campaign: Campaign) -> Campaign:
        if campaign.state != CampaignState.QA:
            raise ValueError("campaign must be in QA before approval")
        assets = await self.assets.list_for_campaign(campaign.campaign_id)
        if not assets:
            raise ValueError("campaign has no assets")
        if any(not asset.rights_verified or not asset.qa_passed for asset in assets):
            raise ValueError("all campaign assets must pass rights and QA certification")
        return await self.bridge.transition(campaign, CampaignState.APPROVAL)

    async def certify_ready_to_publish(
        self,
        campaign: Campaign,
        *,
        approved_by: str,
    ) -> Campaign:
        assets = await self.assets.list_for_campaign(campaign.campaign_id)
        if not assets:
            raise ValueError("campaign has no assets")
        if any(not asset.rights_verified for asset in assets):
            raise ValueError("provenance/rights verification is incomplete")
        if any(not asset.qa_passed for asset in assets):
            raise ValueError("QA is incomplete")
        updated = await self.bridge.mark_ready_to_publish(
            campaign,
            approved_by=approved_by,
            provenance_verified=True,
            qa_passed=True,
        )
        for asset in assets:
            asset.approved_by = approved_by
            await self.assets.save(asset)
        return updated

    async def snapshot(self, campaign: Campaign) -> dict[str, Any]:
        assets = await self.assets.list_for_campaign(campaign.campaign_id)
        return {
            "campaign_id": campaign.campaign_id,
            "persona_id": campaign.persona_id,
            "state": campaign.state.value,
            "hermes_goal_id": campaign.hermes_goal_id,
            "hermes_task_id": campaign.hermes_task_id,
            "asset_count": len(assets),
            "assets": [
                {
                    "id": asset.asset_id,
                    "provider": asset.provider,
                    "capability": asset.capability,
                    "provider_job_id": asset.provider_job_id,
                    "status": asset.status,
                    "rights_verified": asset.rights_verified,
                    "qa_passed": asset.qa_passed,
                    "ai_film_asset_id": asset.ai_film_asset_id,
                    "storage_path": asset.storage_path,
                }
                for asset in assets
            ],
            "external_publish_executed": False,
        }

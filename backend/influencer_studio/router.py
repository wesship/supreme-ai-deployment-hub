from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import OCCPrincipal, require_occ_access
from backend.hermes.dependencies import get_dependencies

from .assets import SupabaseCampaignAssetRepository
from .external_providers import (
    ComfyUIWanProvider,
    EromifyMCPProvider,
    configured_provider_health,
)
from .models import Campaign, CampaignState, Persona
from .providers import MediaCapability, MediaRequest, ProviderRegistry
from .repositories import SupabaseCampaignRepository, SupabasePersonaRepository
from .runtime import InfluencerCampaignRuntime


router = APIRouter(prefix="/api/influencer-studio", tags=["influencer-studio"])


class PersonaCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=120)
    character_bible: str = Field(..., min_length=1, max_length=20000)
    niche: str = Field(..., min_length=1, max_length=200)
    declared_age: int = Field(default=21, ge=21, le=120)
    synthetic_disclosure: bool = True
    appearance_spec: dict[str, Any] = Field(default_factory=dict)
    voice_spec: dict[str, Any] = Field(default_factory=dict)
    reference_assets: list[str] = Field(default_factory=list)
    allowed_content: list[str] = Field(default_factory=list)
    forbidden_content: list[str] = Field(default_factory=list)
    provenance: dict[str, Any] = Field(default_factory=dict)


class CampaignCreate(BaseModel):
    persona_id: str
    objective: str = Field(..., min_length=1, max_length=4000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class GenerateRequest(BaseModel):
    provider: str
    capability: MediaCapability
    prompt: str = Field(..., min_length=1, max_length=20000)
    reference_assets: list[str] = Field(default_factory=list)
    options: dict[str, Any] = Field(default_factory=dict)


class AssetCertificationRequest(BaseModel):
    rights_verified: bool
    qa_passed: bool
    ai_film_asset_id: str | None = None
    storage_path: str | None = None


class ApprovalRequest(BaseModel):
    approved_by: str | None = None


_PROVIDER_REGISTRY: ProviderRegistry | None = None


def _provider_registry() -> ProviderRegistry:
    global _PROVIDER_REGISTRY
    if _PROVIDER_REGISTRY is not None:
        return _PROVIDER_REGISTRY

    registry = ProviderRegistry()
    eromify_key = os.getenv("EROMIFY_API_KEY", "").strip()
    if eromify_key:
        registry.register(EromifyMCPProvider.from_env())
    comfy_url = os.getenv("COMFYUI_BASE_URL", "").strip()
    if comfy_url:
        registry.register(ComfyUIWanProvider.from_env())
    _PROVIDER_REGISTRY = registry
    return registry


def _runtime(principal: OCCPrincipal) -> InfluencerCampaignRuntime:
    deps = get_dependencies()
    return InfluencerCampaignRuntime(
        owner_id=principal.user_id,
        personas=SupabasePersonaRepository(deps.repository, principal.user_id),
        campaigns=SupabaseCampaignRepository(deps.repository, principal.user_id),
        assets=SupabaseCampaignAssetRepository(deps.repository, principal.user_id),
        providers=_provider_registry(),
        hermes=deps,
    )


async def _campaign_or_404(runtime: InfluencerCampaignRuntime, campaign_id: str) -> Campaign:
    campaign = await runtime.campaigns.get(campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    return campaign


@router.get("/health")
async def health(_: OCCPrincipal = Depends(require_occ_access)):
    return {
        "status": "ok",
        "providers": configured_provider_health(),
        "certification_boundary": CampaignState.READY_TO_PUBLISH.value,
        "external_publish_enabled": False,
    }


@router.post("/personas", status_code=201)
async def create_persona(
    body: PersonaCreate,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    try:
        persona = await runtime.create_persona(Persona(**body.model_dump()))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"persona": persona}


@router.get("/personas/{persona_id}")
async def get_persona(
    persona_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    persona = await runtime.personas.get(persona_id)
    if persona is None:
        raise HTTPException(404, "Persona not found")
    return {"persona": persona}


@router.post("/campaigns", status_code=201)
async def create_campaign(
    body: CampaignCreate,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    try:
        campaign = await runtime.create_campaign(Campaign(**body.model_dump()))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"campaign": campaign}


@router.post("/campaigns/{campaign_id}/plan")
async def plan_campaign(
    campaign_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    campaign = await _campaign_or_404(runtime, campaign_id)
    try:
        updated = await runtime.start_planning(campaign)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"campaign": updated}


@router.post("/campaigns/{campaign_id}/generate")
async def generate_campaign_asset(
    campaign_id: str,
    body: GenerateRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    campaign = await _campaign_or_404(runtime, campaign_id)
    try:
        campaign, asset = await runtime.generate(
            campaign,
            provider_name=body.provider,
            request=MediaRequest(
                capability=body.capability,
                prompt=body.prompt,
                persona_id=campaign.persona_id,
                reference_assets=tuple(body.reference_assets),
                options=body.options,
            ),
        )
    except (ValueError, RuntimeError, KeyError) as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"campaign": campaign, "asset": asset}


@router.post("/campaigns/{campaign_id}/assets/{asset_id}/refresh")
async def refresh_asset(
    campaign_id: str,
    asset_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    campaign = await _campaign_or_404(runtime, campaign_id)
    try:
        asset = await runtime.refresh_asset_status(campaign, asset_id=asset_id)
    except (ValueError, RuntimeError, KeyError) as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"asset": asset}


@router.post("/campaigns/{campaign_id}/qa")
async def enter_qa(
    campaign_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    campaign = await _campaign_or_404(runtime, campaign_id)
    try:
        updated = await runtime.enter_qa(campaign)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"campaign": updated}


@router.patch("/campaigns/{campaign_id}/assets/{asset_id}/certify")
async def certify_asset(
    campaign_id: str,
    asset_id: str,
    body: AssetCertificationRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    campaign = await _campaign_or_404(runtime, campaign_id)
    try:
        asset = await runtime.certify_asset(
            campaign,
            asset_id=asset_id,
            rights_verified=body.rights_verified,
            qa_passed=body.qa_passed,
            ai_film_asset_id=body.ai_film_asset_id,
            storage_path=body.storage_path,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"asset": asset}


@router.post("/campaigns/{campaign_id}/approval")
async def request_approval(
    campaign_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    campaign = await _campaign_or_404(runtime, campaign_id)
    try:
        updated = await runtime.request_approval(campaign)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"campaign": updated}


@router.post("/campaigns/{campaign_id}/ready")
async def certify_ready(
    campaign_id: str,
    body: ApprovalRequest,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    campaign = await _campaign_or_404(runtime, campaign_id)
    approver = body.approved_by or principal.user_id
    if approver != principal.user_id and principal.role != "admin":
        raise HTTPException(403, "Only admins can record approval on behalf of another user")
    try:
        updated = await runtime.certify_ready_to_publish(
            campaign,
            approved_by=approver,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"campaign": updated, "external_publish_executed": False}


@router.get("/campaigns/{campaign_id}")
async def campaign_snapshot(
    campaign_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    runtime = _runtime(principal)
    campaign = await _campaign_or_404(runtime, campaign_id)
    return await runtime.snapshot(campaign)

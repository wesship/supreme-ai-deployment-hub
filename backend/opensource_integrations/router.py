"""FastAPI router for the D3VONN Open Source Integration Layer."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from .adapters import route_capability
from .models import CapabilityRequest, CapabilityResponse, IntegrationProvider, IntegrationTier
from .registry import get_provider, list_providers

router = APIRouter(prefix="/api/opensource", tags=["open-source-integrations"])


@router.get("/providers", response_model=list[IntegrationProvider])
async def providers(tier: IntegrationTier | None = Query(default=None)):
    """List capability providers Hermes can orchestrate."""
    return list_providers(tier=tier)


@router.get("/providers/{provider_key}", response_model=IntegrationProvider)
async def provider_detail(provider_key: str):
    """Return one provider's registry contract."""
    provider = get_provider(provider_key)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.post("/invoke", response_model=CapabilityResponse)
async def invoke_capability(request: CapabilityRequest):
    """Hermes entrypoint for invoking a capability by name."""
    return route_capability(request)


@router.post("/providers/{provider_key}/invoke", response_model=CapabilityResponse)
async def invoke_provider(provider_key: str, request: CapabilityRequest):
    """Provider-specific entrypoint with registry validation."""
    provider = get_provider(provider_key)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    if request.capability not in provider.capabilities:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Capability is not exposed by this provider.",
                "provider": provider_key,
                "available_capabilities": provider.capabilities,
            },
        )
    return route_capability(request)

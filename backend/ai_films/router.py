"""AI Film Studio production-integration API."""

from typing import Literal

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from backend.ai_films.orchestration import (
    OrchestrationError,
    SupabaseRLSClient,
    create_test_production,
)
from backend.ai_films.providers import provider_health, validate_provider
from backend.ai_films.twelvelabs import (
    TwelveLabsClient,
    TwelveLabsConfigurationError,
    TwelveLabsError,
)
from backend.ai_films.vfx_assets import catalog as makebigfilms_catalog
from backend.ai_films.vfx_assets import resolve_vfx_assets

router = APIRouter(prefix="/ai-films", tags=["ai-films"])


class TestProductionRequest(BaseModel):
    title: str = Field(default="Sovereign Signal — E2E Acceptance", min_length=3, max_length=160)


class VFXResolveRequest(BaseModel):
    scene_description: str = Field(default="", max_length=8000)
    requested_effects: list[str] = Field(default_factory=list, max_length=24)
    camera_direction: str | None = Field(default=None, max_length=80)
    limit: int = Field(default=6, ge=1, le=12)


class TwelveLabsSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    page_size: int = Field(default=10, ge=1, le=50)
    modalities: list[Literal["visual", "audio"]] = Field(
        default_factory=lambda: ["visual", "audio"], min_length=1, max_length=2
    )
    group_by: Literal["none", "item"] = "none"
    include_metadata: bool = True


class TwelveLabsReasonRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    session_id: str | None = Field(default=None, max_length=200)
    instructions: str | None = Field(default=None, max_length=2000)
    include_intermediate: bool = False


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase bearer token required",
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token is empty")
    return token


async def _require_authenticated_user(authorization: str | None) -> None:
    token = _bearer_token(authorization)
    try:
        await SupabaseRLSClient(token).current_user()
    except OrchestrationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid Supabase bearer token required",
        ) from exc


def _twelvelabs_client() -> TwelveLabsClient:
    try:
        return TwelveLabsClient()
    except TwelveLabsConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.get("/providers/health")
def get_provider_health() -> dict[str, object]:
    """Return configuration-only health without exposing secret values."""
    return provider_health()


@router.get("/providers/{capability}/{provider}/validate")
def validate_provider_configuration(capability: str, provider: str) -> dict[str, str]:
    """Validate that a supported adapter has all required server-side secrets."""
    try:
        spec = validate_provider(capability, provider)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "capability": spec.capability,
        "provider": spec.provider,
        "status": "configured",
    }


@router.get("/vfx/makebigfilms/catalog")
def get_makebigfilms_vfx_catalog() -> dict[str, object]:
    """Expose the governed MakeBIGFILMS catalog-routing surface."""
    return makebigfilms_catalog()


@router.post("/vfx/makebigfilms/resolve")
def resolve_makebigfilms_vfx(request: VFXResolveRequest) -> dict[str, object]:
    """Rank MakeBIGFILMS collections for a shot without downloading assets."""
    try:
        return resolve_vfx_assets(
            request.scene_description,
            requested_effects=tuple(request.requested_effects),
            camera_direction=request.camera_direction,
            limit=request.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/intelligence/twelvelabs/status")
async def get_twelvelabs_status(
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Validate the configured TwelveLabs knowledge store without exposing secrets."""
    await _require_authenticated_user(authorization)
    client = _twelvelabs_client()
    try:
        store = await client.retrieve_knowledge_store()
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "provider": "twelvelabs",
        "status": "ready",
        "knowledge_store": {
            "id": store.get("_id") or store.get("id") or client.knowledge_store_id,
            "name": store.get("name"),
            "item_count": store.get("item_count"),
            "updated_at": store.get("updated_at"),
        },
    }


@router.post("/intelligence/twelvelabs/search")
async def search_twelvelabs_knowledge_store(
    request: TwelveLabsSearchRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Return ranked film clips/images from the configured TwelveLabs store."""
    await _require_authenticated_user(authorization)
    client = _twelvelabs_client()
    try:
        return await client.search(
            request.query,
            page_size=request.page_size,
            modalities=tuple(request.modalities),
            group_by=request.group_by,
            include_metadata=request.include_metadata,
        )
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/intelligence/twelvelabs/reason")
async def reason_over_twelvelabs_knowledge_store(
    request: TwelveLabsReasonRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Use Jockey to reason across the configured AI Film knowledge store."""
    await _require_authenticated_user(authorization)
    client = _twelvelabs_client()
    try:
        return await client.reason(
            request.message,
            session_id=request.session_id,
            instructions=request.instructions,
            include_intermediate=request.include_intermediate,
        )
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/orchestrations/test-production", status_code=status.HTTP_201_CREATED)
async def orchestrate_test_production(
    request: TestProductionRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Create a complete authenticated scene-to-release acceptance chain.

    The operation creates control-plane records and queues render jobs. It does
    not spend provider credits or publish externally.
    """
    try:
        return await create_test_production(_bearer_token(authorization), request.title)
    except OrchestrationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

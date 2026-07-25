"""AI Film Studio production-integration API."""

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from backend.ai_films.orchestration import OrchestrationError, create_test_production
from backend.ai_films.providers import provider_health, validate_provider

router = APIRouter(prefix="/ai-films", tags=["ai-films"])


class TestProductionRequest(BaseModel):
    title: str = Field(default="Sovereign Signal — E2E Acceptance", min_length=3, max_length=160)


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

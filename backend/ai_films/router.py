"""AI Film Studio production-integration API."""

from fastapi import APIRouter, HTTPException

from backend.ai_films.providers import provider_health, validate_provider

router = APIRouter(prefix="/api/ai-films", tags=["ai-films"])


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

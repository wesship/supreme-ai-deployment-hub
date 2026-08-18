"""Standalone smoke check for AI Films router registration.

Run with ``python -m backend.tests.validate_ai_films_router_registration`` after
installing backend requirements. It validates the fully resolved OpenAPI surface,
including FastAPI's lazy included-router representation.
"""
from backend.main import app

required = {
    "/api/ai-films/providers/health",
    "/api/ai-films/openmontage/dispatch",
    "/api/ai-films/commerce/campaigns/render",
}
paths = set(app.openapi()["paths"])
missing = sorted(required - paths)
print("Registered AI Films paths:", sorted(path for path in paths if "ai-films" in path))
if missing:
    raise SystemExit(f"AI Films routes are missing: {', '.join(missing)}")
print("AI Films router registration passed")

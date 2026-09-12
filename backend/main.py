"""backend/main.py — D3VONN.IO FastAPI Application Entry Point."""
import logging
import os
from contextlib import asynccontextmanager

import httpx
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from backend.observability.wandb_weave import init_weave
except ModuleNotFoundError:
    from observability.wandb_weave import init_weave

SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.2, environment=os.getenv("ENVIRONMENT", "production"))

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("D3VONN.IO backend starting up…")
    if init_weave():
        logger.info("W&B Weave initialized successfully.")
    yield
    logger.info("D3VONN.IO backend shutting down…")


app = FastAPI(title="D3VONN.IO API", description="Multi-agent orchestration platform", version="2.0.0", docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json", lifespan=lifespan)

PRODUCTION_ORIGINS = [
    "https://d3vonn.io",
    "https://www.d3vonn.io",
    "https://app.d3vonn.io",
    "https://supreme-ai-deployment-hub.vercel.app",
    "https://supreme-ai-deployment-hub.lovable.app",
]
CONFIGURED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys([*PRODUCTION_ORIGINS, *CONFIGURED_ORIGINS]))
DEFAULT_PREVIEW_ORIGIN_REGEX = (
    r"https://(?:supreme-ai-deployment-hub(?:-[a-z0-9-]+)?\.vercel\.app|"
    r"[a-z0-9-]+--supreme-ai-deployment-hub\.lovable\.app)"
)
ALLOWED_ORIGIN_REGEX = os.getenv("ALLOWED_ORIGIN_REGEX", "").strip() or DEFAULT_PREVIEW_ORIGIN_REGEX
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID", "X-Workspace-ID"],
)

_REQUIRED_MIDDLEWARE = (
    ("backend.middleware.request_context", "RequestContextMiddleware"),
    ("backend.middleware.logging", "LoggingMiddleware"),
    ("backend.middleware.rate_limit", "RateLimitMiddleware"),
    ("backend.middleware.multi_tenancy", "MultiTenancyMiddleware"),
)
_environment = os.getenv("ENVIRONMENT", "production").lower()
for module_name, middleware_name in _REQUIRED_MIDDLEWARE:
    try:
        module = __import__(module_name, fromlist=[middleware_name])
        app.add_middleware(getattr(module, middleware_name))
    except (ImportError, AttributeError) as exc:
        if _environment not in {"development", "dev", "test", "local"}:
            raise RuntimeError(f"Required middleware {middleware_name} unavailable") from exc
        logger.warning("%s unavailable — skipping in %s only.", middleware_name, _environment)

_OPTIONAL_ROUTERS = (
    ("backend.app.routers", "proxy_router", None),
    ("backend.api.v1.router", "router", "/api/v1"),
    ("backend.api.v2.router", "router", "/api/v2"),
    ("backend.agents.router", "router", "/api/agents"),
    ("backend.marketplace.router", "router", None),
    ("backend.occ_operator.router", "router", "/api/operator"),
    ("backend.occ_operator.market_intelligence_router", "router", "/api/operator"),
    ("backend.hermes.router", "router", None),
    ("backend.hermes.recency_router", "router", None),
    ("backend.intelligence.api_router", "router", "/api"),
    ("backend.visual_intelligence.router", "router", "/api"),
    ("backend.ai_films.policy_promotion_review_router", "router", "/api"),
    ("backend.rag.router", "router", None),
    ("backend.knowledge.router", "router", None),
    ("backend.research_os.router", "router", None),
    ("backend.research_os.leads_router", "router", None),
    ("backend.market_intelligence.router", "router", None),
    ("backend.app.security.router", "router", None),
    ("backend.app.security.admin_approval_router", "router", None),
    ("backend.app.security.tool_registry_router", "router", "/api/security"),
    ("backend.app.assurance.router", "router", None),
    ("backend.opensource_integrations.router", "router", None),
    ("backend.liquidity_agent.router", "router", None),
)
for module_name, attr, prefix in _OPTIONAL_ROUTERS:
    try:
        module = __import__(module_name, fromlist=[attr])
        router = getattr(module, attr)
        app.include_router(router, prefix=prefix) if prefix else app.include_router(router)
    except (ImportError, AttributeError):
        pass

try:
    from backend.app.routers.primetime_release1 import router as primetime_release1_router

    app.include_router(primetime_release1_router)
    logger.info("PRIMETIME Release 1 router registered at /primetime/v1")
except ImportError as exc:
    if _environment not in {"development", "dev", "test", "local"}:
        raise RuntimeError("Required PRIMETIME Release 1 router unavailable") from exc
    logger.warning("PRIMETIME Release 1 router unavailable — skipping in %s only. (%s)", _environment, exc)


def _feature_enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


# Releases 2–7 write governed records through the service-role backend. They
# remain closed until their migrations, RLS policies, audit triggers, staging
# validation, compliance sign-off, and rollback plans are explicitly verified.
if _feature_enabled("PRIMETIME_RELEASES_ENABLED"):
    try:
        from backend.app.routers.primetime_release2_scheduling import router as primetime_release2_scheduling_router
        from backend.app.routers.primetime_release3_communications import router as primetime_release3_communications_router
        from backend.app.routers.primetime_release4_ai_assistance import router as primetime_release4_ai_assistance_router
        from backend.app.routers.primetime_release5_analytics import router as primetime_release5_analytics_router
        from backend.app.routers.primetime_release7_observability import router as primetime_release7_observability_router

        app.include_router(primetime_release2_scheduling_router)
        logger.info("PRIMETIME Release 2 scheduling router registered at /primetime/v1")
        app.include_router(primetime_release3_communications_router)
        logger.info("PRIMETIME Release 3 communications router registered at /primetime/v1")
        app.include_router(primetime_release4_ai_assistance_router)
        logger.info("PRIMETIME Release 4 AI assistance router registered at /primetime/v1")
        app.include_router(primetime_release5_analytics_router)
        logger.info("PRIMETIME Release 5 analytics router registered at /primetime/v1")
        app.include_router(primetime_release7_observability_router)
        logger.info("PRIMETIME Release 7 observability router registered at /primetime/v1")
    except ImportError as exc:
        raise RuntimeError("Enabled PRIMETIME release router is unavailable") from exc
else:
    logger.info("PRIMETIME Releases 2–7 remain disabled pending explicit production-readiness enablement.")

try:
    from backend.optimization.api import router as optimization_router
    app.include_router(optimization_router)
    logger.info("Optimization router registered at /api/v1/optimization")
except ImportError as exc:
    logger.warning("Optimization router unavailable — skipping. (%s)", exc)


def _env_configured(*names: str) -> bool:
    return all(bool(os.getenv(name)) for name in names)


def _redis_status() -> str:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return "not_configured"
    try:
        import redis
        client = redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        return "reachable"
    except Exception:
        return "unreachable"


async def _supabase_status() -> str:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return "not_configured"
    try:
        async with httpx.AsyncClient(timeout=3.0, follow_redirects=True) as client:
            response = await client.get(f"{url}/rest/v1/", headers={"apikey": key, "Authorization": f"Bearer {key}"})
        return "reachable" if response.is_success else "unreachable"
    except Exception:
        return "unreachable"


@app.get("/health", tags=["ops"])
@app.get("/health/live", tags=["ops"])
async def health_check():
    return {"status": "ok", "version": app.version}


@app.get("/ready", tags=["ops"])
@app.get("/health/ready", tags=["ops"])
async def readiness_check():
    supabase_status = await _supabase_status()
    services = {
        "supabase": supabase_status,
        "openai": "configured" if _env_configured("OPENAI_API_KEY") else "not_configured",
        "anthropic": "configured" if _env_configured("ANTHROPIC_API_KEY") else "not_configured",
        "google_ai": "configured" if _env_configured("GOOGLE_AI_API_KEY") else "not_configured",
    }
    redis_status = _redis_status()
    ready = supabase_status == "reachable" and redis_status == "reachable"
    body = {"status": "ready" if ready else "not_ready", "version": app.version, "environment": os.getenv("ENVIRONMENT", "unknown"), "services": {"api": "healthy", "redis": redis_status, **services}}
    return JSONResponse(status_code=200 if ready else 503, content=body)

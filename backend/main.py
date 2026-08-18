"""
backend/main.py — D3VONN.IO FastAPI Application Entry Point

This is the canonical backend entry point for the supreme-ai-deployment-hub.
It registers all API routers, middleware, and lifecycle hooks.

Run locally:
    uvicorn backend.main:app --reload --port 8000

Run in Docker:
    CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
"""

import logging
import os
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from backend.observability.wandb_weave import init_weave
except ModuleNotFoundError:  # Allows `cd backend && uvicorn main:app` local startup.
    from observability.wandb_weave import init_weave

SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.2,
        environment=os.getenv("ENVIRONMENT", "production"),
    )

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: connect pools on startup, close on shutdown."""
    logger.info("D3VONN.IO backend starting up…")
    if init_weave():
        logger.info("W&B Weave initialized successfully.")

    try:
        from backend.db.pool import init_pool, close_pool  # type: ignore

        await init_pool()
        logger.info("Database pool initialised.")
    except ImportError:
        logger.warning("backend.db.pool not found — skipping DB pool init.")

    yield

    logger.info("D3VONN.IO backend shutting down…")
    try:
        from backend.db.pool import close_pool  # type: ignore

        await close_pool()
    except ImportError:
        pass


app = FastAPI(
    title="D3VONN.IO API",
    description=(
        "Multi-agent orchestration platform — unified gateway for AI models, "
        "agents, feature flags, task queues, and real-time WebSocket communication."
    ),
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

PRODUCTION_ORIGINS = "https://d3vonn.io,https://www.d3vonn.io,https://app.d3vonn.io"

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", PRODUCTION_ORIGINS).split(",")
    if origin.strip()
]

ALLOWED_ORIGIN_REGEX = os.getenv("ALLOWED_ORIGIN_REGEX", "").strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
)

try:
    from backend.middleware.request_context import RequestContextMiddleware  # type: ignore

    app.add_middleware(RequestContextMiddleware)
    logger.info("RequestContextMiddleware registered.")
except ImportError:
    logger.warning("RequestContextMiddleware not found — skipping.")

try:
    from backend.middleware.logging import LoggingMiddleware  # type: ignore

    app.add_middleware(LoggingMiddleware)
    logger.info("LoggingMiddleware registered.")
except ImportError:
    logger.warning("LoggingMiddleware not found — skipping.")

try:
    from backend.middleware.rate_limit import RateLimitMiddleware  # type: ignore

    app.add_middleware(RateLimitMiddleware)
    logger.info("RateLimitMiddleware registered.")
except ImportError:
    logger.warning("RateLimitMiddleware not found — skipping.")

try:
    from backend.middleware.multi_tenancy import MultiTenancyMiddleware  # type: ignore

    app.add_middleware(MultiTenancyMiddleware)
    logger.info("MultiTenancyMiddleware registered.")
except ImportError:
    logger.warning("MultiTenancyMiddleware not found — skipping.")

# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------
# AI Films is a first-class API surface. Each router is registered independently
# so an optional studio integration cannot make the core API unavailable.
_AI_FILMS_ROUTERS = (
    ("core", "backend.ai_films.router", "router"),
    ("commerce", "backend.ai_films.commerce_router", "router"),
    ("openmontage", "backend.ai_films.openmontage_router", "router"),
    ("director", "backend.ai_films.director_router", "router"),
    ("production_bible", "backend.ai_films.bible_router", "router"),
    ("anchor_frames", "backend.ai_films.anchor_router", "router"),
    ("index", "backend.ai_films.index_router", "router"),
    ("performance", "backend.ai_films.performance_router", "router"),
    ("mastering", "backend.ai_films.mastering_router", "router"),
)
for _ai_films_name, _ai_films_module, _ai_films_attr in _AI_FILMS_ROUTERS:
    try:
        _module = __import__(_ai_films_module, fromlist=[_ai_films_attr])
        app.include_router(getattr(_module, _ai_films_attr), prefix="/api")
        logger.info("AI Films %s router registered.", _ai_films_name)
    except (ImportError, AttributeError) as _ai_films_err:
        logger.warning("AI Films %s router unavailable — skipping. (%s)", _ai_films_name, _ai_films_err)

try:
    from backend.app.routers import proxy_router  # type: ignore

    app.include_router(proxy_router)
    logger.info("Proxy router registered: /api/chat, /api/rag/*, /api/tools/*")
except ImportError as _proxy_err:
    logger.warning("Proxy router not found — skipping. (%s)", _proxy_err)

try:
    from backend.app.routers.primetime_release1 import router as primetime_release1_router  # type: ignore

    app.include_router(primetime_release1_router)
    logger.info("PRIMETIME Release 1 router registered at /primetime/v1")
except ImportError as _primetime_release1_err:
    logger.warning("PRIMETIME Release 1 router not found — skipping. (%s)", _primetime_release1_err)

try:
    from backend.app.routers.primetime_release2_scheduling import router as primetime_release2_scheduling_router  # type: ignore

    app.include_router(primetime_release2_scheduling_router)
    logger.info("PRIMETIME Release 2 scheduling router registered at /primetime/v1")
except ImportError as _primetime_release2_scheduling_err:
    logger.warning("PRIMETIME Release 2 scheduling router not found — skipping. (%s)", _primetime_release2_scheduling_err)

try:
    from backend.app.routers.primetime_release3_communications import router as primetime_release3_communications_router  # type: ignore

    app.include_router(primetime_release3_communications_router)
    logger.info("PRIMETIME Release 3 communications router registered at /primetime/v1")
except ImportError as _primetime_release3_communications_err:
    logger.warning("PRIMETIME Release 3 communications router not found — skipping. (%s)", _primetime_release3_communications_err)

try:
    from backend.app.routers.primetime_release4_ai_assistance import router as primetime_release4_ai_assistance_router  # type: ignore

    app.include_router(primetime_release4_ai_assistance_router)
    logger.info("PRIMETIME Release 4 AI assistance router registered at /primetime/v1")
except ImportError as _primetime_release4_ai_assistance_err:
    logger.warning("PRIMETIME Release 4 AI assistance router not found — skipping. (%s)", _primetime_release4_ai_assistance_err)

try:
    from backend.app.routers.primetime_release5_analytics import router as primetime_release5_analytics_router  # type: ignore

    app.include_router(primetime_release5_analytics_router)
    logger.info("PRIMETIME Release 5 analytics router registered at /primetime/v1")
except ImportError as _primetime_release5_analytics_err:
    logger.warning("PRIMETIME Release 5 analytics router not found — skipping. (%s)", _primetime_release5_analytics_err)

try:
    from backend.api.v1.router import router as v1_router  # type: ignore

    app.include_router(v1_router, prefix="/api/v1", tags=["v1"])
    logger.info("API v1 router registered at /api/v1")
except ImportError:
    logger.warning("backend.api.v1.router not found — skipping v1 router.")

try:
    from backend.api.v2.router import router as v2_router  # type: ignore

    app.include_router(v2_router, prefix="/api/v2", tags=["v2"])
    logger.info("API v2 router registered at /api/v2")
except ImportError:
    logger.warning("backend.api.v2.router not found — skipping v2 router.")

try:
    from backend.agents.router import router as agent_router  # type: ignore

    app.include_router(agent_router, prefix="/api/agents", tags=["agents"])
    logger.info("Agent mesh router registered at /api/agents")
except ImportError:
    logger.warning("backend.agents.router not found — skipping agent router.")

try:
    from backend.occ_operator.router import router as operator_router  # type: ignore

    app.include_router(operator_router, prefix="/api/operator", tags=["operator"])
    logger.info("Operator console router registered at /api/operator")
except ImportError:
    logger.warning("backend.operator.router not found — skipping operator router.")

try:
    from backend.intelligence.api_router import router as intelligence_router  # type: ignore

    app.include_router(intelligence_router, prefix="/api", tags=["intelligence"])
    logger.info("Intelligence layer router registered at /api/intelligence")
except ImportError:
    logger.warning("backend.intelligence.api_router not found — skipping intelligence router.")

try:
    from backend.occ_operator.occ_router import router as occ_router  # type: ignore

    app.include_router(occ_router)
    logger.info("OCC Supabase data router registered at /api/occ/*")
except ImportError as _occ_err:
    logger.warning("backend.operator.occ_router not found — skipping OCC router. (%s)", _occ_err)

try:
    from backend.occ_operator.public_stats_router import router as public_stats_router  # type: ignore

    app.include_router(public_stats_router)
    logger.info("Public stats router registered at /api/public/*")
except ImportError as _pub_err:
    logger.warning("backend.occ_operator.public_stats_router not found — skipping. (%s)", _pub_err)

try:
    from backend.rag.router import router as rag_router  # type: ignore

    app.include_router(rag_router)
    logger.info("RAG ingestion router registered at /api/rag/*")
except ImportError as _rag_err:
    logger.warning("backend.rag.router not found — skipping RAG router. (%s)", _rag_err)

try:
    from backend.occ_operator.hermes_router import router as hermes_router  # type: ignore

    app.include_router(hermes_router)
    logger.info("Hermes Intelligence Fabric router registered at /api/hermes/*")
except ImportError as _hermes_err:
    logger.warning("backend.operator.hermes_router not found — skipping Hermes router. (%s)", _hermes_err)

try:
    from backend.hermes.router import router as hermes_tasks_router  # type: ignore

    app.include_router(hermes_tasks_router)
    logger.info("Hermes Task Engine router registered at /api/hermes/tasks/*")
except ImportError as _hermes_tasks_err:
    logger.warning("backend.hermes.router not found — skipping Hermes task engine. (%s)", _hermes_tasks_err)

try:
    from backend.hermes.recency_router import router as hermes_recency_router  # type: ignore

    app.include_router(hermes_recency_router)
    logger.info("Hermes recency acknowledgement router registered at /api/hermes/recency/*")
except ImportError as _hermes_recency_err:
    logger.warning("backend.hermes.recency_router not found — skipping recency write-back. (%s)", _hermes_recency_err)

try:
    from backend.knowledge.router import router as knowledge_router  # type: ignore

    app.include_router(knowledge_router)
    logger.info("DKOS Knowledge API router registered at /api/knowledge/*")
except ImportError as _knowledge_err:
    logger.warning("backend.knowledge.router not found — skipping DKOS Knowledge API. (%s)", _knowledge_err)

try:
    from backend.research_os.router import router as research_os_router  # type: ignore

    app.include_router(research_os_router)
    logger.info("Hermes Research OS router registered at /api/research/*")
except ImportError as _research_os_err:
    logger.warning("backend.research_os.router not found — skipping Research OS. (%s)", _research_os_err)

try:
    from backend.research_os.leads_router import router as research_os_leads_router  # type: ignore

    app.include_router(research_os_leads_router)
    logger.info("Hermes Research OS lead router registered at /api/leads/*")
except ImportError as _research_os_leads_err:
    logger.warning("backend.research_os.leads_router not found — skipping Research OS leads. (%s)", _research_os_leads_err)

try:
    from backend.app.security.router import router as security_router  # type: ignore

    app.include_router(security_router)
    logger.info("D3VONN Security Operations router registered at /api/security/*")
except ImportError as _security_err:
    logger.warning("backend.app.security.router not found — skipping Security Operations. (%s)", _security_err)

try:
    from backend.app.security.router_v2 import router as security_v2_router  # type: ignore

    app.include_router(security_v2_router)
    logger.info("D3VONN Security Operations v2 router registered at /api/security/v2/*")
except ImportError as _security_v2_err:
    logger.warning("backend.app.security.router_v2 not found — skipping Security Ops v2. (%s)", _security_v2_err)

try:
    from backend.app.assurance.router import router as assurance_router  # type: ignore

    app.include_router(assurance_router)
    logger.info("Assurance platform router registered at /api/assurance/*")
except ImportError as _assurance_err:
    logger.warning("Assurance platform router not found — skipping. (%s)", _assurance_err)


def _env_configured(*names: str) -> bool:
    return all(bool(os.getenv(name)) for name in names)


def _redis_status() -> str:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return "not_configured"

    try:
        import redis  # type: ignore

        client = redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        return "reachable"
    except Exception as exc:  # pragma: no cover - health endpoint defensive guard
        logger.warning("Redis readiness check failed: %s", exc)
        return "unreachable"


def _service_config_status() -> dict[str, str]:
    return {
        "supabase": "configured"
        if _env_configured("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
        else "not_configured",
        "openai": "configured" if _env_configured("OPENAI_API_KEY") else "not_configured",
        "anthropic": "configured" if _env_configured("ANTHROPIC_API_KEY") else "not_configured",
        "google_ai": "configured" if _env_configured("GOOGLE_AI_API_KEY") else "not_configured",
        "pinecone": "configured"
        if _env_configured("PINECONE_API_KEY", "PINECONE_HOST", "PINECONE_INDEX")
        else "not_configured",
        "twilio": "configured"
        if _env_configured("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER")
        else "not_configured",
    }


@app.get("/health", tags=["ops"])
@app.get("/health/live", tags=["ops"])
async def health_check():
    """Liveness probe — returns 200 when the process is alive."""
    return {"status": "ok", "version": app.version}


@app.get("/ready", tags=["ops"])
@app.get("/health/ready", tags=["ops"])
async def readiness_check():
    """Readiness probe — confirms critical runtime dependencies are available."""
    services = _service_config_status()
    redis_status = _redis_status()
    ready = services["supabase"] == "configured" and redis_status == "reachable"

    body = {
        "status": "ready" if ready else "not_ready",
        "version": app.version,
        "environment": os.getenv("ENVIRONMENT", "unknown"),
        "services": {
            "api": "healthy",
            "redis": redis_status,
            **services,
        },
    }
    return JSONResponse(status_code=200 if ready else 503, content=body)


@app.get("/health/deep", tags=["ops"])
async def health_deep():
    """Deep health check — returns service-level status for monitoring."""
    vault_secret_set = bool(os.getenv("API_KEY_VAULT_SECRET"))
    vault_dir = os.getenv("KEYS_FILE", ".devonn/api-vault/keys.json")
    vault_dir_writable: bool
    try:
        import pathlib

        pathlib.Path(vault_dir).parent.mkdir(parents=True, exist_ok=True)
        vault_dir_writable = os.access(pathlib.Path(vault_dir).parent, os.W_OK)
    except Exception:
        vault_dir_writable = False

    vault_status = "ready" if vault_dir_writable else "not_writable"
    vault_encryption = "enabled" if vault_secret_set else "disabled (set API_KEY_VAULT_SECRET)"

    return {
        "status": "ok",
        "version": app.version,
        "environment": os.getenv("ENVIRONMENT", "unknown"),
        "services": {
            "api": "healthy",
            "redis": _redis_status(),
            **_service_config_status(),
        },
        "rag": {
            "pinecone_index": os.getenv("PINECONE_INDEX", "not_configured"),
            "embedding_model": os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
        },
        "proxy_vault": {
            "status": vault_status,
            "encryption": vault_encryption,
        },
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)

    try:
        from backend.occ_operator.occ_logger import fire_log_error  # type: ignore
        from backend.middleware.request_context import get_request_id  # type: ignore

        fire_log_error(
            error_type="runtime",
            message=str(exc),
            exc=exc,
            severity="error",
            service="backend",
            endpoint=str(request.url.path),
            request_id=get_request_id(),
            metadata={"method": request.method, "url": str(request.url)},
        )
    except Exception:
        pass

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. The incident has been logged."},
    )

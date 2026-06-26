"""
backend/main.py — Devonn.AI FastAPI Application Entry Point

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

# ---------------------------------------------------------------------------
# Sentry initialisation (must happen before app creation)
# ---------------------------------------------------------------------------
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.2,
        environment=os.getenv("ENVIRONMENT", "production"),
    )

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: connect pools on startup, close on shutdown."""
    logger.info("Devonn.AI backend starting up…")
    if init_weave():
        logger.info("W&B Weave initialized successfully.")

    # Import here to avoid circular imports at module load time
    try:
        from backend.db.pool import init_pool, close_pool  # type: ignore

        await init_pool()
        logger.info("Database pool initialised.")
    except ImportError:
        logger.warning("backend.db.pool not found — skipping DB pool init.")

    yield

    logger.info("Devonn.AI backend shutting down…")
    try:
        from backend.db.pool import close_pool  # type: ignore

        await close_pool()
    except ImportError:
        pass


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Devonn.AI API",
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

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,https://d3vonn.io,https://www.d3vonn.io,https://app.d3vonn.io,https://supreme-ai-deployment-hub.vercel.app,https://supreme-ai-deployment-hub.lovable.app",
    ).split(",")
    if o.strip()
]

# Regex covers all Lovable preview/published URLs (id-preview--*, feature branches, etc.)
# and all Vercel preview deploys, without requiring future code edits.
ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"https://([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com|vercel\.app)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Custom middleware (order matters — outermost first)
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Proxy router — /api/chat, /api/rag/*, /api/tools/*
# ---------------------------------------------------------------------------
try:
    from backend.app.routers import proxy_router  # type: ignore

    app.include_router(proxy_router)
    logger.info("Proxy router registered: /api/chat, /api/rag/*, /api/tools/*")
except ImportError as _proxy_err:
    logger.warning("Proxy router not found — skipping. (%s)", _proxy_err)

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
    from backend.knowledge.router import router as knowledge_router  # type: ignore

    app.include_router(knowledge_router)
    logger.info("DKOS Knowledge API router registered at /api/knowledge/*")
except ImportError as _knowledge_err:
    logger.warning("backend.knowledge.router not found — skipping DKOS Knowledge API. (%s)", _knowledge_err)

# ---------------------------------------------------------------------------
# Health & readiness endpoints
# ---------------------------------------------------------------------------


@app.get("/health", tags=["ops"])
async def health_check():
    """Liveness probe — returns 200 when the process is alive."""
    return {"status": "ok", "version": app.version}


@app.get("/ready", tags=["ops"])
async def readiness_check():
    """Readiness probe — returns 200 when the app is ready to serve traffic."""
    return {"status": "ready"}


@app.get("/health/deep", tags=["ops"])
async def health_deep():
    """Deep health check — returns service-level status for monitoring."""
    supabase_configured = bool(
        os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )
    openai_configured = bool(os.getenv("OPENAI_API_KEY"))
    pinecone_configured = bool(os.getenv("PINECONE_API_KEY") and os.getenv("PINECONE_INDEX"))

    # Proxy-vault readiness: check whether the vault file directory is writable
    # and whether encryption is configured.  This never exposes key values.
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
            "supabase": "configured" if supabase_configured else "not_configured",
            "openai": "configured" if openai_configured else "not_configured",
            "pinecone": "configured" if pinecone_configured else "not_configured",
        },
        "proxy_vault": {
            "status": vault_status,
            "encryption": vault_encryption,
        },
    }


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)

    # Fire-and-forget OCC error log (never blocks the response)
    try:
        import traceback as _tb
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
        pass  # OCC logging must never crash the error handler

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. The incident has been logged."},
    )
# build-trigger: force Railway rebuild from d374e66 — 2026-06-24

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
try:
    from backend.app.routers import proxy_router  # type: ignore

    app.include_router(proxy_router)
    logger.info("Proxy router registered: /api/chat, /api/rag/*, /api/tools/*")
except ImportError:
    logger.warning("Proxy router not found — skipping.")

try:
    from backend.routers.health import router as health_router  # type: ignore

    app.include_router(health_router)
    logger.info("Health router registered.")
except ImportError:
    logger.warning("Health router not found — skipping.")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

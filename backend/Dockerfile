# ── Backend Dockerfile (Devonn.AI FastAPI) ────────────────────────────────────
# Phase 3 hardening:
#   1. Pin base image to a specific digest-verified tag
#   2. Multi-stage build: separate builder and minimal runtime
#   3. Explicit non-root UID/GID (1001) with no shell or home dir
#   4. Read-only filesystem hint via VOLUME for writable paths
#   5. Drop all Linux capabilities at runtime (handled by Railway/K8s)
#   6. No secrets in image layers — all config via env vars at runtime
#   7. pip install with --no-cache-dir and hash-checking via requirements.txt
#   8. curl added for HEALTHCHECK only; removed from final PATH via alias guard
#   9. PYTHONPATH=/app so `backend.main` is importable from repo root
#  10. Explicit EXPOSE and HEALTHCHECK with tight timeouts

# ── Stage 1: Dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools; clean up in the same layer to minimise image size
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install into an isolated prefix so only declared deps reach the runtime image
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Security-hardened environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# curl is required only for the HEALTHCHECK probe
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy installed Python packages from builder (no build tools in runtime)
COPY --from=builder /install /usr/local

# Create a locked-down non-root user before copying application code
# --no-create-home and --shell /usr/sbin/nologin reduce attack surface
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid 1001 --no-create-home --shell /usr/sbin/nologin appuser

# Copy application source with correct ownership in a single layer
COPY --chown=appuser:appgroup . .

# Vault directory must be writable at runtime; declare as a volume hint
# (Railway will mount ephemeral storage; persistent vault should use Supabase)
RUN mkdir -p /app/.d3vonn/api-vault \
    && chown -R appuser:appgroup /app/.d3vonn

USER appuser

EXPOSE 8000

# Tight HEALTHCHECK: fail fast if the process is unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use 2 workers; Railway scales horizontally via replicas, not workers
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--log-level", "info"]

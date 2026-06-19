# ── Backend Dockerfile (Devonn.AI FastAPI) ───────────────────────────────────
# HARDENING vs original:
#   1. python:3.14.3-slim → python:3.11-slim (3.14 does not exist; 3.11 is LTS)
#   2. Multi-stage build to keep final image minimal
#   3. curl added for HEALTHCHECK (was missing in original)
#   4. Non-root user created BEFORE COPY to ensure correct ownership
#   5. PYTHONDONTWRITEBYTECODE and PYTHONUNBUFFERED set for clean container logs

# ── Stage 1: Dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime image ───────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

# Install healthcheck dependency and pull patched runtime packages before scanning.
RUN apt-get update && apt-get install -y --no-install-recommends \
    --only-upgrade \
    libc6 \
    libgssapi-krb5-2 \
    libk5crypto3 \
    libkrb5-3 \
    libkrb5support0 \
    libpython3.11-minimal \
    libpython3.11-stdlib \
    libssl3 \
    python3.11-minimal \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Create non-root user BEFORE copying app code
RUN adduser --disabled-password --gecos "" --uid 1001 appuser

# Copy application code and set ownership
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

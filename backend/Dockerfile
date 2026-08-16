FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/backend \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

COPY --from=builder /install /usr/local

RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid 1001 --no-create-home --shell /usr/sbin/nologin appuser

# Railway may configure this directory as the service root. Preserve the
# canonical Python package layout so imports such as `backend.app.routers`
# resolve instead of being silently skipped by backend/main.py.
COPY --chown=appuser:appgroup . ./backend/

RUN mkdir -p /app/.devonn/api-vault \
    && chown -R appuser:appgroup /app/.devonn /app/backend

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f "http://localhost:${PORT:-8000}/health/live" || exit 1

CMD ["sh", "-c", "uvicorn backend.railway_app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2 --log-level info"]

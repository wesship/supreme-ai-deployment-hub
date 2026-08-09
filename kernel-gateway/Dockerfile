FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system kernel \
    && useradd --system --gid kernel --create-home --home-dir /home/kernel kernel

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=kernel:kernel kernel_service.py .

USER kernel

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "kernel_service:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

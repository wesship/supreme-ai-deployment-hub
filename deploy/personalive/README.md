# D3VONN.IO PersonaLive Avatar Stack

This folder contains an isolated Docker Compose stack for running PersonaLive beside D3VONN.IO without touching the main app deployment.

## Services

- `personalive` — GPU-enabled PersonaLive all-in-one container exposed on port `7870`.
- `avatar-gateway` — small FastAPI gateway exposed on port `8100` for Devonn-facing health checks and avatar session forwarding.

## Files

- `docker-compose.yml` — clean Compose stack.
- `Dockerfile.gateway` — gateway image definition.
- `requirements.gateway.txt` — gateway Python dependencies.
- `gateway/main.py` — FastAPI gateway.
- `.env.example` — safe environment template.

## Run locally

```bash
cd deploy/personalive
cp .env.example .env
docker compose up --build
```

Health checks:

```bash
curl http://localhost:7870/health
curl http://localhost:8100/health
```

## GPU requirement

The PersonaLive service reserves one NVIDIA GPU:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

For local Docker Compose, make sure the NVIDIA Container Toolkit is installed and Docker can access the GPU.

## Devonn integration path

The gateway reads:

- `PERSONALIVE_URL`, default `http://personalive:7870`
- `ORCHESTRATOR_URL`, default `http://host.docker.internal:8000`
- `DEVONN_API_KEY`, optional
- `OPENAI_API_KEY`, optional
- `ELEVENLABS_API_KEY`, optional

The initial gateway endpoint is intentionally conservative:

```http
POST /avatar/session
```

It forwards to:

```http
POST ${PERSONALIVE_URL}/api/avatar/session
```

If PersonaLive uses a different endpoint shape, update `gateway/main.py` after confirming the upstream API.

## Safety notes

Do not commit `.env` or real API keys. Use `.env.example` only as a template.

# D3VONN Backend Proxy

Production-ready FastAPI backend that acts as the **secure execution layer** for the D3VONN platform. All sensitive API keys are held server-side here — never in the browser bundle.

## Architecture

```
d3vonn.io frontend (Vite + React)
        ↓  VITE_API_URL only
api.d3vonn.io  ← this service
        ↓  server-side env vars only
OpenAI / Pinecone / GitHub / n8n / ElevenLabs / AssemblyAI
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe |
| `GET` | `/ready` | Readiness probe |
| `POST` | `/api/chat` | Streaming LLM proxy (OpenAI) |
| `POST` | `/api/rag/ingest` | Embed + upsert document chunks to Pinecone |
| `POST` | `/api/rag/retrieve` | Query Pinecone for relevant context |
| `POST` | `/api/rag/delete` | Delete document vectors from Pinecone |
| `POST` | `/api/tools/voice/tts` | ElevenLabs text-to-speech |
| `POST` | `/api/tools/voice/stt-token` | AssemblyAI real-time token |
| `POST` | `/api/tools/github/workflows/trigger` | Trigger GitHub Actions workflow |
| `GET` | `/api/tools/github/runs/status` | Get recent workflow run statuses |
| `POST` | `/api/tools/n8n/execute` | Execute n8n workflow by name |

All routes except `/health` and `/ready` require a valid **Supabase JWT** in the `Authorization: Bearer <token>` header.

## Local Development

```bash
# 1. Clone and enter the backend directory
cd backend/

# 2. Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements-dev.txt

# 4. Set up environment variables
cp .env.example .env
# Edit .env and fill in real values (never commit .env)

# 5. Run the server
uvicorn backend.main:app --reload --port 8000

# 6. View API docs
open http://localhost:8000/api/docs
```

## Running Tests

```bash
cd backend/
python3 -m pytest tests/test_proxy_routes.py -v
```

All 16 tests should pass. Tests mock all external API calls — no real keys needed to run tests.

## Setting Backend Environment Variables

### On AWS ECS / EC2 (api.d3vonn.io)

Add these as **task definition environment variables** or **Secrets Manager** references:

```
OPENAI_API_KEY
ELEVENLABS_API_KEY
ASSEMBLYAI_API_KEY
GITHUB_TOKEN
N8N_API_KEY
N8N_BASE_URL
PINECONE_API_KEY
PINECONE_HOST
PINECONE_INDEX_NAME
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ALLOWED_ORIGINS
SENTRY_DSN
```

### On Railway / Render / Fly.io

Use the platform's environment variable dashboard. Never use `.env` files in production containers.

## Deployment

### Docker

```bash
# Build
docker build -t d3vonn-backend .

# Run
docker run -p 8000:8000 \
  -e OPENAI_API_KEY=sk-... \
  -e PINECONE_API_KEY=pcsk_... \
  # ... other vars
  d3vonn-backend
```

### Dockerfile (create at backend/Dockerfile)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### GitHub Actions CI

The existing `.github/workflows/` CI pipeline will run `pytest tests/test_proxy_routes.py` on every push.

## Security Notes

- `GITHUB_TOKEN` should be a **fine-grained PAT** scoped to `wesship/supreme-ai-deployment-hub` only with `Actions: read/write` and `Contents: read` permissions.
- `SUPABASE_SERVICE_ROLE_KEY` has admin access to your Supabase project — treat it like a root password.
- `REQUIRE_AUTH=true` must be set in production. Setting it to `false` disables JWT validation (dev only).
- CORS is restricted to the approved frontend domains in `ALLOWED_ORIGINS`.
- Rate limiting: 60 req/min general, 20 req/min for `/api/chat`.

## Variable Security Classification

| Variable | Location | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | Backend only | Never in `VITE_` prefix |
| `ELEVENLABS_API_KEY` | Backend only | Never in `VITE_` prefix |
| `ASSEMBLYAI_API_KEY` | Backend only | Never in `VITE_` prefix |
| `GITHUB_TOKEN` | Backend only | Fine-grained PAT |
| `N8N_API_KEY` | Backend only | Never in `VITE_` prefix |
| `PINECONE_API_KEY` | Backend only | Never in `VITE_` prefix |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Admin key — never expose |
| `VITE_API_URL` | Frontend (Vercel) | Public backend URL |
| `VITE_SUPABASE_URL` | Frontend (Vercel) | Public Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend (Vercel) | Anon key (public by design) |

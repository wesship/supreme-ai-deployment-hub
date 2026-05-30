"""
Devonn.ai Backend Proxy — Configuration
All secrets loaded from environment variables only. Never hardcoded.
"""
import json
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── LLM ────────────────────────────────────────────────────────────────────
    openai_api_key: str = ""
    openai_default_model: str = "gpt-4.1-mini"
    openai_max_tokens: int = 2048
    openai_temperature: float = 0.7

    # ── Voice ──────────────────────────────────────────────────────────────────
    elevenlabs_api_key: str = ""
    elevenlabs_default_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_default_model: str = "eleven_turbo_v2_5"
    assemblyai_api_key: str = ""

    # ── CI/CD ──────────────────────────────────────────────────────────────────
    github_token: str = ""
    github_repo: str = "wesship/supreme-ai-deployment-hub"

    # ── Automation ─────────────────────────────────────────────────────────────
    n8n_api_key: str = ""
    n8n_base_url: str = "https://n8n.devonn.ai"

    # ── Vector DB ──────────────────────────────────────────────────────────────
    pinecone_api_key: str = ""
    pinecone_host: str = ""
    pinecone_index_name: str = "document-store"
    pinecone_dimension: int = 768
    pinecone_namespace: str = "documents"
    rag_top_k: int = 5
    rag_min_score: float = 0.70
    embedding_model: str = "text-embedding-3-small"
    embed_batch_size: int = 20

    # ── Auth ───────────────────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    # Set to False to disable auth in local dev (never False in production)
    require_auth: bool = True

    # ── CORS ───────────────────────────────────────────────────────────────────
    # Stored as a raw string to avoid pydantic-settings JSON-parsing a
    # comma-separated env var.  Use the `allowed_origins` property below.
    # In Railway, set ALLOWED_ORIGINS_RAW to a comma-separated list or JSON array.
    allowed_origins_raw: str = (
        "https://devonn.ai,"
        "https://www.devonn.ai,"
        "https://app.devonn.ai,"
        "https://supreme-ai-deployment-hub.vercel.app"
    )

    @property
    def allowed_origins(self) -> list[str]:
        """Return CORS origins as a list.

        Accepts either a JSON array (["https://a.com","https://b.com"])
        or a comma-separated string (https://a.com,https://b.com).
        """
        raw = self.allowed_origins_raw.strip()
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    # ── Rate limiting ──────────────────────────────────────────────────────────
    rate_limit_per_minute: int = 60
    rate_limit_chat_per_minute: int = 20

    # ── App ────────────────────────────────────────────────────────────────────
    app_env: str = "production"
    debug: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()

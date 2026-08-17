"""
Devonn.ai Backend Proxy — Configuration
All secrets loaded from environment variables only. Never hardcoded.
"""
import json
from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── LLM ────────────────────────────────────────────────────────────────────
    # Railway production currently stores the OpenAI project key as `OpenAiKey`.
    # Prefer that exact name when present, while retaining the conventional
    # `OPENAI_API_KEY` name and direct Python field construction as fallbacks.
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("OpenAiKey", "OPENAI_API_KEY", "openai_api_key"),
    )
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
    n8n_base_url: str = "https://n8n.d3vonn.io"

    # ── Vector DB ──────────────────────────────────────────────────────────────
    # Accept both the current proxy names and the established Railway/VPS names.
    # `PINECONE_INDEX` is preferred over the newer static `PINECONE_INDEX_NAME`
    # because existing deployments use it to identify the live index.
    pinecone_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("PineconeApiKey", "PINECONE_API_KEY", "pinecone_api_key"),
    )
    pinecone_host: str = Field(
        default="",
        validation_alias=AliasChoices("PineconeHost", "PINECONE_HOST", "pinecone_host"),
    )
    pinecone_index_name: str = Field(
        default="document-store",
        validation_alias=AliasChoices(
            "PineconeIndex",
            "PINECONE_INDEX",
            "PINECONE_INDEX_NAME",
            "pinecone_index_name",
        ),
    )
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
        "https://d3vonn.io,"
        "https://www.d3vonn.io,"
        "https://app.d3vonn.io,"
        "https://supreme-ai-deployment-hub.vercel.app,"
        "https://supreme-ai-deployment-hub.lovable.app"
    )
    # Regex matches all Lovable preview/published URLs and Vercel previews.
    allowed_origin_regex: str = (
        r"https://([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com|vercel\.app)"
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

    # ── Assurance platform ─────────────────────────────────────────────────────
    canonical_site_origin: str = "https://www.d3vonn.io"
    assurance_admin_ids_raw: str = ""
    mcp_audit_retention_days: int = 365
    mcp_gateway_timeout_seconds: float = 15.0
    status_email_delivery_url: str = ""
    status_email_delivery_token: str = ""
    status_webhook_signing_secret: str = ""

    @property
    def assurance_admin_ids(self) -> set[str]:
        return {value.strip() for value in self.assurance_admin_ids_raw.split(",") if value.strip()}

    # ── App ────────────────────────────────────────────────────────────────────
    app_env: str = "production"
    debug: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()

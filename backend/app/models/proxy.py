"""
D3VONN Backend Proxy — Pydantic Models
Request and response schemas for all proxy routes.
"""
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1, max_length=32_000)


class ToolFunction(BaseModel):
    name: str
    description: str
    parameters: dict[str, Any]


class Tool(BaseModel):
    type: Literal["function"] = "function"
    function: ToolFunction


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=100)
    model: str = Field(default="gpt-4.1-mini", max_length=64)
    provider: Literal["openai", "gemini", "ollama"] = "openai"
    stream: bool = True
    max_tokens: int = Field(default=2048, ge=1, le=16_384)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    tools: Optional[list[Tool]] = None
    tool_choice: Optional[str] = None

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        allowed = {
            "gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini",
            "gpt-4-turbo", "gpt-4.1-turbo",
        }
        if v not in allowed:
            raise ValueError(f"Model '{v}' not in allowed list: {allowed}")
        return v


# ─── RAG ──────────────────────────────────────────────────────────────────────

class ChunkMetadata(BaseModel):
    source: str
    filename: str
    chunkIndex: int
    totalChunks: int
    userId: Optional[str] = None
    uploadedAt: str


class DocumentChunk(BaseModel):
    id: str
    text: str = Field(..., min_length=1, max_length=4_000)
    metadata: ChunkMetadata


class RAGIngestRequest(BaseModel):
    chunks: list[DocumentChunk] = Field(..., min_length=1, max_length=500)
    filename: str = Field(..., max_length=256)
    userId: Optional[str] = None


class RAGIngestResponse(BaseModel):
    success: bool
    chunksIngested: int
    filename: str
    error: Optional[str] = None


class RAGRetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2_000)
    topK: int = Field(default=5, ge=1, le=20)
    minScore: float = Field(default=0.70, ge=0.0, le=1.0)


class RetrievedContext(BaseModel):
    text: str
    source: str
    score: float


class RAGRetrieveResponse(BaseModel):
    results: list[RetrievedContext]
    query: str


class RAGDeleteRequest(BaseModel):
    filename: str = Field(..., max_length=256)


# ─── Voice ────────────────────────────────────────────────────────────────────

class VoiceSettings(BaseModel):
    stability: float = Field(default=0.5, ge=0.0, le=1.0)
    similarity_boost: float = Field(default=0.75, ge=0.0, le=1.0)
    speed: float = Field(default=1.0, ge=0.7, le=1.2)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5_000)
    voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM", max_length=64)
    model: str = Field(default="eleven_turbo_v2_5", max_length=64)
    voice_settings: VoiceSettings = Field(default_factory=VoiceSettings)


class STTTokenRequest(BaseModel):
    expires_in: int = Field(default=480, ge=60, le=3600)


class STTTokenResponse(BaseModel):
    token: str


# ─── GitHub ───────────────────────────────────────────────────────────────────

class GitHubWorkflowTriggerRequest(BaseModel):
    workflow: str = Field(..., max_length=128, description="Workflow filename, e.g. deploy.yml")
    branch: str = Field(default="main", max_length=128)
    inputs: dict[str, Any] = Field(default_factory=dict)


class GitHubWorkflowTriggerResponse(BaseModel):
    success: bool
    message: str
    timestamp: str


class GitHubRunsStatusRequest(BaseModel):
    workflow: Optional[str] = Field(default=None, max_length=128)
    limit: int = Field(default=5, ge=1, le=50)


class WorkflowRun(BaseModel):
    name: str
    status: str
    conclusion: Optional[str]
    created_at: str
    url: str


class GitHubRunsStatusResponse(BaseModel):
    runs: list[WorkflowRun]
    total: int


# ─── n8n ──────────────────────────────────────────────────────────────────────

class N8NExecuteRequest(BaseModel):
    workflow_name: str = Field(..., max_length=256)
    payload: dict[str, Any] = Field(default_factory=dict)


class N8NExecuteResponse(BaseModel):
    success: bool
    workflow: str
    result: Any = None
    timestamp: str
    error: Optional[str] = None

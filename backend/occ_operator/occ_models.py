"""
backend/operator/occ_models.py — Pydantic models for OCC Supabase table inserts.

These models define the exact shape of data written to each OCC table.
All fields match the column definitions in supabase/migrations/20260528_occ_tables.sql.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 1. AI Request Logs
# ---------------------------------------------------------------------------

class AIRequestLogInsert(BaseModel):
    """Insert model for ai_request_logs."""
    model: str
    provider: str = "openai"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: Optional[int] = None
    status: str = "success"          # success | error | timeout
    error_message: Optional[str] = None
    request_id: Optional[str] = None
    endpoint: Optional[str] = None
    user_id: Optional[str] = None    # UUID string
    tenant_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 2. Tool Call Logs
# ---------------------------------------------------------------------------

class ToolCallLogInsert(BaseModel):
    """Insert model for tool_call_logs."""
    agent_id: str
    tool_name: str
    session_id: Optional[str] = None
    tool_input: Dict[str, Any] = Field(default_factory=dict)
    tool_output: Dict[str, Any] = Field(default_factory=dict)
    status: str = "success"          # success | error | timeout
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 3. Agent Activity Logs
# ---------------------------------------------------------------------------

class AgentActivityLogInsert(BaseModel):
    """Insert model for agent_activity_logs."""
    agent_id: str
    event_type: str                  # started | completed | failed | paused | resumed
    agent_name: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    duration_ms: Optional[int] = None
    tokens_used: int = 0
    cost_usd: float = 0.0
    status: str = "success"
    error_message: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 4. Error Logs
# ---------------------------------------------------------------------------

class ErrorLogInsert(BaseModel):
    """Insert model for error_logs."""
    error_type: str                  # runtime | api | auth | validation | system
    message: str
    severity: str = "error"          # debug | info | warning | error | critical
    stack_trace: Optional[str] = None
    service: Optional[str] = "backend"
    endpoint: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    request_id: Optional[str] = None
    resolved: bool = False
    occurrence_count: int = 1
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 5. Approval Queue
# ---------------------------------------------------------------------------

class ApprovalQueueInsert(BaseModel):
    """Insert model for approval_queue."""
    title: str
    action_type: str                 # deploy | config_change | agent_action | data_access
    description: Optional[str] = None
    requested_by: Optional[str] = None   # UUID string
    status: str = "pending"          # pending | approved | rejected | expired
    priority: str = "normal"         # low | normal | high | critical
    expires_at: Optional[str] = None # ISO 8601 timestamp string
    payload: Dict[str, Any] = Field(default_factory=dict)
    tenant_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 6. User Plans (upsert)
# ---------------------------------------------------------------------------

class UserPlanUpsert(BaseModel):
    """Upsert model for user_plans."""
    user_id: str                     # UUID string — required for upsert
    plan_name: str = "free"          # free | starter | pro | enterprise
    plan_tier: int = 0               # 0=free, 1=starter, 2=pro, 3=enterprise
    status: str = "active"           # active | suspended | cancelled | trial
    tokens_limit: int = 100_000
    tokens_used: int = 0
    requests_limit: int = 1_000
    requests_used: int = 0
    billing_period: str = "monthly"
    trial_ends_at: Optional[str] = None
    reset_at: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 7. RAG Documents
# ---------------------------------------------------------------------------

class RAGDocumentInsert(BaseModel):
    """Insert model for rag_documents."""
    title: str
    description: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None  # pdf | txt | md | docx | html | url
    file_size_bytes: Optional[int] = None
    storage_path: Optional[str] = None
    public_url: Optional[str] = None
    status: str = "processing"       # processing | indexed | failed | archived
    chunk_count: int = 0
    embedding_model: str = "text-embedding-3-small"
    namespace: str = "default"
    tags: list[str] = Field(default_factory=list)
    uploaded_by: Optional[str] = None  # UUID string
    tenant_id: Optional[str] = None
    indexed_at: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

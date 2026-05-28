-- =============================================================================
-- Devonn.AI — Operator Command Center (OCC) Database Migration
-- Migration: 20260528_occ_tables.sql
-- Description: Creates all 7 OCC tables required by the admin dashboard
-- Run: Apply via Supabase Dashboard → SQL Editor, or via supabase db push
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. AI Request Logs — tracks all LLM API calls (cost, tokens, latency)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_request_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id       TEXT,
    model           TEXT NOT NULL,                    -- e.g. "gpt-4o", "claude-3-5-sonnet"
    provider        TEXT NOT NULL DEFAULT 'openai',   -- openai | anthropic | gemini
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10, 6) NOT NULL DEFAULT 0, -- cost in USD
    latency_ms      INTEGER,                          -- response time in ms
    status          TEXT NOT NULL DEFAULT 'success',  -- success | error | timeout
    error_message   TEXT,
    request_id      TEXT,                             -- upstream request ID
    endpoint        TEXT,                             -- /api/chat, /api/rag, etc.
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_request_logs_created_at ON ai_request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_user_id ON ai_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_model ON ai_request_logs(model);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_status ON ai_request_logs(status);

-- =============================================================================
-- 2. Tool Call Logs — tracks all agent tool invocations
-- =============================================================================
CREATE TABLE IF NOT EXISTS tool_call_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    agent_id        TEXT NOT NULL,
    session_id      TEXT,
    tool_name       TEXT NOT NULL,
    tool_input      JSONB DEFAULT '{}'::jsonb,
    tool_output     JSONB DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'success',  -- success | error | timeout
    duration_ms     INTEGER,
    error_message   TEXT,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id       TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tool_call_logs_created_at ON tool_call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_agent_id ON tool_call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_tool_name ON tool_call_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_status ON tool_call_logs(status);

-- =============================================================================
-- 3. Agent Activity Logs — tracks agent lifecycle events
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_activity_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    agent_id        TEXT NOT NULL,
    agent_name      TEXT,
    event_type      TEXT NOT NULL,  -- started | completed | failed | paused | resumed
    session_id      TEXT,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id       TEXT,
    duration_ms     INTEGER,
    tokens_used     INTEGER DEFAULT 0,
    cost_usd        NUMERIC(10, 6) DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'success',
    error_message   TEXT,
    payload         JSONB DEFAULT '{}'::jsonb,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_created_at ON agent_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_agent_id ON agent_activity_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_event_type ON agent_activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_user_id ON agent_activity_logs(user_id);

-- =============================================================================
-- 4. Error Logs — centralized error tracking for the OCC error monitor
-- =============================================================================
CREATE TABLE IF NOT EXISTS error_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    error_type      TEXT NOT NULL,          -- runtime | api | auth | validation | system
    severity        TEXT NOT NULL DEFAULT 'error',  -- debug | info | warning | error | critical
    message         TEXT NOT NULL,
    stack_trace     TEXT,
    service         TEXT,                   -- backend | frontend | agent | worker
    endpoint        TEXT,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id       TEXT,
    request_id      TEXT,
    resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_note TEXT,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_service ON error_logs(service);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);

-- =============================================================================
-- 5. Approval Queue — human-in-the-loop approval workflow
-- =============================================================================
CREATE TABLE IF NOT EXISTS approval_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    title           TEXT NOT NULL,
    description     TEXT,
    action_type     TEXT NOT NULL,          -- deploy | config_change | agent_action | data_access
    requested_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | expired
    priority        TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high | critical
    expires_at      TIMESTAMPTZ,
    payload         JSONB DEFAULT '{}'::jsonb,        -- the action to execute on approval
    review_note     TEXT,
    tenant_id       TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_created_at ON approval_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_priority ON approval_queue(priority);
CREATE INDEX IF NOT EXISTS idx_approval_queue_requested_by ON approval_queue(requested_by);

-- =============================================================================
-- 6. User Plans — subscription and usage tracking per user
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_name       TEXT NOT NULL DEFAULT 'free',     -- free | starter | pro | enterprise
    plan_tier       INTEGER NOT NULL DEFAULT 0,       -- 0=free, 1=starter, 2=pro, 3=enterprise
    status          TEXT NOT NULL DEFAULT 'active',   -- active | suspended | cancelled | trial
    trial_ends_at   TIMESTAMPTZ,
    billing_period  TEXT DEFAULT 'monthly',           -- monthly | annual
    tokens_limit    INTEGER NOT NULL DEFAULT 100000,  -- monthly token limit
    tokens_used     INTEGER NOT NULL DEFAULT 0,       -- tokens used this period
    requests_limit  INTEGER NOT NULL DEFAULT 1000,    -- monthly request limit
    requests_used   INTEGER NOT NULL DEFAULT 0,
    reset_at        TIMESTAMPTZ,                      -- next usage reset date
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_plan_name ON user_plans(plan_name);
CREATE INDEX IF NOT EXISTS idx_user_plans_status ON user_plans(status);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_plans_updated_at ON user_plans;
CREATE TRIGGER update_user_plans_updated_at
    BEFORE UPDATE ON user_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 7. RAG Documents — document store for retrieval-augmented generation
-- =============================================================================
CREATE TABLE IF NOT EXISTS rag_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title           TEXT NOT NULL,
    description     TEXT,
    file_name       TEXT,
    file_type       TEXT,                   -- pdf | txt | md | docx | html | url
    file_size_bytes INTEGER,
    storage_path    TEXT,                   -- Supabase Storage path
    public_url      TEXT,
    status          TEXT NOT NULL DEFAULT 'processing',  -- processing | indexed | failed | archived
    chunk_count     INTEGER DEFAULT 0,
    embedding_model TEXT DEFAULT 'text-embedding-3-small',
    namespace       TEXT DEFAULT 'default', -- for multi-tenant RAG isolation
    tags            TEXT[] DEFAULT '{}',
    uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id       TEXT,
    indexed_at      TIMESTAMPTZ,
    error_message   TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at ON rag_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_namespace ON rag_documents(namespace);
CREATE INDEX IF NOT EXISTS idx_rag_documents_uploaded_by ON rag_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_rag_documents_tags ON rag_documents USING GIN(tags);

DROP TRIGGER IF EXISTS update_rag_documents_updated_at ON rag_documents;
CREATE TRIGGER update_rag_documents_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security (RLS) — admin-only access for OCC tables
-- =============================================================================

-- Enable RLS on all OCC tables
ALTER TABLE ai_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

-- Admin role policy: service_role bypasses RLS automatically in Supabase
-- For authenticated admin users, check a custom claim or admin table

-- Users can read their own plan
DROP POLICY IF EXISTS "Users can read own plan" ON user_plans;
CREATE POLICY "Users can read own plan"
    ON user_plans FOR SELECT
    USING (auth.uid() = user_id);

-- Users can read their own RAG documents
DROP POLICY IF EXISTS "Users can read own documents" ON rag_documents;
CREATE POLICY "Users can read own documents"
    ON rag_documents FOR SELECT
    USING (auth.uid() = uploaded_by);

-- Service role (backend) has full access via service_role key (bypasses RLS)
-- Admin dashboard must use SUPABASE_SERVICE_ROLE_KEY, never anon key

-- =============================================================================
-- Seed: default admin user plan (optional — run manually if needed)
-- =============================================================================
-- INSERT INTO user_plans (user_id, plan_name, plan_tier, tokens_limit, requests_limit)
-- VALUES ('<your-admin-user-uuid>', 'enterprise', 3, 10000000, 100000)
-- ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- Migration complete
-- =============================================================================
SELECT 'OCC tables migration complete' AS status,
       NOW() AS applied_at;

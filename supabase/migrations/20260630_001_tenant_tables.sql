-- ═══════════════════════════════════════════════════════════════════════════════
-- D3VONN Multi-Tenant Foundations — Database Schema
-- Migration: 20260630_001_tenant_tables
--
-- Creates the multi-tenant hierarchy tables with Row-Level Security (RLS).
-- Hierarchy: Platform → Tenant → Workspace → User → Resources
--
-- All tables enforce tenant isolation via RLS policies.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: tenants
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    plan        VARCHAR(50) NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free', 'starter', 'professional', 'enterprise', 'custom')),
    status      VARCHAR(50) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'trial', 'suspended', 'deactivated')),
    settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: workspaces
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) NOT NULL,
    settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    status      VARCHAR(50) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived', 'suspended')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_workspaces_tenant ON workspaces(tenant_id);
CREATE INDEX idx_workspaces_status ON workspaces(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email           VARCHAR(320) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_workspace ON users(workspace_id);
CREATE INDEX idx_users_email ON users(email);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: user_roles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL
                    CHECK (role IN ('super_admin', 'tenant_admin', 'workspace_admin', 'agent_operator', 'data_analyst')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tenant_id, workspace_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_tenant ON user_roles(tenant_id);
CREATE INDEX idx_user_roles_workspace ON user_roles(workspace_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: roles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(50) NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    description     TEXT,
    level           INTEGER NOT NULL DEFAULT 0,
    scope           VARCHAR(20) NOT NULL CHECK (scope IN ('platform', 'tenant', 'workspace')),
    permissions     JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default roles
INSERT INTO roles (name, display_name, description, level, scope, permissions) VALUES
    ('super_admin', 'Super Admin', 'Platform-wide access', 100, 'platform',
     '["platform:manage","tenant:create","tenant:delete","tenant:suspend","system:configure","system:audit","billing:manage"]'::jsonb),
    ('tenant_admin', 'Tenant Admin', 'Full tenant management', 80, 'tenant',
     '["tenant:read","tenant:update","tenant:settings","workspace:create","workspace:delete","user:invite","user:remove","user:roles","api-key:manage","billing:read","audit:read","agent:deploy","agent:delete"]'::jsonb),
    ('workspace_admin', 'Workspace Admin', 'Workspace management', 60, 'workspace',
     '["workspace:read","workspace:update","workspace:settings","workspace:members","agent:create","agent:update","agent:configure","workflow:create","workflow:update","workflow:delete","integration:manage","knowledge:manage"]'::jsonb),
    ('agent_operator', 'Agent Operator', 'Agent execution', 40, 'workspace',
     '["agent:execute","agent:read","task:create","task:cancel","task:read","workflow:execute","workflow:read","tool:use","memory:read","memory:write","event:publish","event:subscribe"]'::jsonb),
    ('data_analyst', 'Data Analyst', 'Read-only data access', 20, 'workspace',
     '["data:read","report:read","report:create","dashboard:read","event:read","knowledge:read","agent:status","task:status","audit:read"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: events (tenant-aware)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type            VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    version         VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    correlation_id  VARCHAR(100),
    causation_id    VARCHAR(100),
    user_id         UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_tenant ON events(tenant_id);
CREATE INDEX idx_events_workspace ON events(workspace_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_correlation ON events(correlation_id);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE INDEX idx_events_tenant_type ON events(tenant_id, type, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: agent_memory (tenant-isolated)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_memory (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL,
    memory_key      VARCHAR(500) NOT NULL,
    memory_value    JSONB NOT NULL,
    memory_type     VARCHAR(50) NOT NULL DEFAULT 'episodic'
                    CHECK (memory_type IN ('episodic', 'semantic', 'procedural', 'working')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    UNIQUE(tenant_id, agent_id, memory_key)
);

CREATE INDEX idx_agent_memory_tenant ON agent_memory(tenant_id);
CREATE INDEX idx_agent_memory_agent ON agent_memory(agent_id);
CREATE INDEX idx_agent_memory_tenant_agent ON agent_memory(tenant_id, agent_id);
CREATE INDEX idx_agent_memory_type ON agent_memory(memory_type);
CREATE INDEX idx_agent_memory_expires ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: agents (tenant-scoped)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    manifest        JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          VARCHAR(50) NOT NULL DEFAULT 'inactive'
                    CHECK (status IN ('active', 'inactive', 'deploying', 'error', 'suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, workspace_id, name)
);

CREATE INDEX idx_agents_tenant ON agents(tenant_id);
CREATE INDEX idx_agents_workspace ON agents(workspace_id);
CREATE INDEX idx_agents_status ON agents(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: audit_logs (tenant-scoped)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(100) NOT NULL,
    resource_id     VARCHAR(255),
    details         JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tenant-scoped tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ─── Tenant Isolation Policies ─────────────────────────────────────────────

-- Workspaces: Users can only see workspaces in their tenant
CREATE POLICY tenant_isolation_workspaces ON workspaces
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Users: Users can only see users in their tenant
CREATE POLICY tenant_isolation_users ON users
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- User Roles: Users can only see roles in their tenant
CREATE POLICY tenant_isolation_user_roles ON user_roles
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Events: Users can only see events in their tenant
CREATE POLICY tenant_isolation_events ON events
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Agent Memory: Users can only see memory in their tenant
CREATE POLICY tenant_isolation_agent_memory ON agent_memory
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Agents: Users can only see agents in their tenant
CREATE POLICY tenant_isolation_agents ON agents
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Audit Logs: Users can only see audit logs in their tenant
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ─── Service Role Bypass ───────────────────────────────────────────────────

-- Allow service role to bypass RLS (for system operations)
CREATE POLICY service_bypass_workspaces ON workspaces
    FOR ALL TO service_role USING (true);

CREATE POLICY service_bypass_users ON users
    FOR ALL TO service_role USING (true);

CREATE POLICY service_bypass_user_roles ON user_roles
    FOR ALL TO service_role USING (true);

CREATE POLICY service_bypass_events ON events
    FOR ALL TO service_role USING (true);

CREATE POLICY service_bypass_agent_memory ON agent_memory
    FOR ALL TO service_role USING (true);

CREATE POLICY service_bypass_agents ON agents
    FOR ALL TO service_role USING (true);

CREATE POLICY service_bypass_audit_logs ON audit_logs
    FOR ALL TO service_role USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to set tenant context for RLS
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current tenant ID
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::uuid;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agent_memory_updated_at
    BEFORE UPDATE ON agent_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE tenants IS 'D3VONN tenant organizations. Root of the multi-tenant hierarchy.';
COMMENT ON TABLE workspaces IS 'Workspaces within a tenant. Provides sub-isolation for teams.';
COMMENT ON TABLE users IS 'Users belonging to a tenant and workspace.';
COMMENT ON TABLE user_roles IS 'Role assignments scoped to tenant and workspace.';
COMMENT ON TABLE roles IS 'Role definitions with permission sets.';
COMMENT ON TABLE events IS 'Tenant-isolated event store for the D3VONN event bus.';
COMMENT ON TABLE agent_memory IS 'Tenant-isolated agent memory (episodic, semantic, procedural, working).';
COMMENT ON TABLE agents IS 'Tenant-scoped agent instances with manifests.';
COMMENT ON TABLE audit_logs IS 'Tenant-scoped audit trail for compliance.';
COMMENT ON FUNCTION set_tenant_context IS 'Sets the current tenant context for RLS policy evaluation.';
COMMENT ON FUNCTION get_current_tenant_id IS 'Returns the current tenant ID from session settings.';

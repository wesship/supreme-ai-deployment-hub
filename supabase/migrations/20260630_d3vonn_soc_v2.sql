-- =============================================================================
-- D3VONN Cyber Command Center v2 — Expanded Security Operations Schema
-- Migration: 20260630_d3vonn_soc_v2.sql
-- Description: Extends the SOC schema to ~25 tables supporting a full
--              commercial-grade SIEM with AI agent workforce, SOAR playbooks,
--              threat intelligence, risk scoring, knowledge graph, and compliance.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. security_assets — tracked infrastructure and application assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    name            TEXT NOT NULL,
    asset_type      TEXT NOT NULL CHECK (asset_type IN ('server','service','database','api','container','endpoint','network','cloud_resource','repository')),
    environment     TEXT DEFAULT 'production',
    owner           TEXT,
    criticality     TEXT DEFAULT 'medium' CHECK (criticality IN ('low','medium','high','critical')),
    metadata        JSONB DEFAULT '{}'::jsonb,
    tenant_id       UUID
);

-- ---------------------------------------------------------------------------
-- 2. security_users — enriched user profiles for security context
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id         UUID,                            -- links to auth.users
    email           TEXT,
    display_name    TEXT,
    role            TEXT DEFAULT 'user',
    risk_score      INT DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors    JSONB DEFAULT '[]'::jsonb,
    last_login      TIMESTAMPTZ,
    last_ip         INET,
    mfa_enabled     BOOLEAN DEFAULT false,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','locked','under_investigation')),
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_users_email ON public.security_users (email);
CREATE INDEX IF NOT EXISTS idx_security_users_risk ON public.security_users (risk_score DESC);

-- ---------------------------------------------------------------------------
-- 3. security_identities — identity federation and session tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id         UUID REFERENCES public.security_users(id),
    provider        TEXT NOT NULL,                    -- 'supabase', 'github', 'google', 'saml'
    provider_id     TEXT,
    last_used       TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'::jsonb,
    tenant_id       UUID
);

-- ---------------------------------------------------------------------------
-- 4. security_sessions — active and historical session tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id         UUID REFERENCES public.security_users(id),
    ip              INET,
    user_agent      TEXT,
    country         TEXT,
    city            TEXT,
    device_type     TEXT,
    is_active       BOOLEAN DEFAULT true,
    ended_at        TIMESTAMPTZ,
    risk_flags      JSONB DEFAULT '[]'::jsonb,
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_sessions_user ON public.security_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_security_sessions_active ON public.security_sessions (is_active) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 5. security_devices — known devices per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id         UUID REFERENCES public.security_users(id),
    device_fingerprint TEXT,
    device_type     TEXT,
    os              TEXT,
    browser         TEXT,
    is_trusted      BOOLEAN DEFAULT false,
    first_seen      TIMESTAMPTZ DEFAULT now(),
    last_seen       TIMESTAMPTZ DEFAULT now(),
    tenant_id       UUID
);

-- ---------------------------------------------------------------------------
-- 6. security_ip_history — IP address history and reputation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_ip_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip              INET NOT NULL,
    asn             TEXT,
    organization    TEXT,
    country         TEXT,
    city            TEXT,
    is_vpn          BOOLEAN DEFAULT false,
    is_tor          BOOLEAN DEFAULT false,
    is_proxy        BOOLEAN DEFAULT false,
    abuse_score     INT DEFAULT 0 CHECK (abuse_score >= 0 AND abuse_score <= 100),
    whois_data      JSONB DEFAULT '{}'::jsonb,
    reverse_dns     TEXT,
    first_seen      TIMESTAMPTZ DEFAULT now(),
    last_seen       TIMESTAMPTZ DEFAULT now(),
    event_count     INT DEFAULT 0,
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_ip_history_ip ON public.security_ip_history (ip);
CREATE INDEX IF NOT EXISTS idx_security_ip_history_abuse ON public.security_ip_history (abuse_score DESC);

-- ---------------------------------------------------------------------------
-- 7. security_geolocation — geolocation cache for IPs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_geolocation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip              INET NOT NULL,
    country_code    TEXT,
    country_name    TEXT,
    region          TEXT,
    city            TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    timezone        TEXT,
    cached_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_geolocation_ip ON public.security_geolocation (ip);

-- ---------------------------------------------------------------------------
-- 8. security_threat_feeds — external threat intelligence feed configs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_threat_feeds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    name            TEXT NOT NULL,
    feed_type       TEXT NOT NULL CHECK (feed_type IN ('ip_blocklist','domain_blocklist','malware_hashes','cve_feed','exploit_feed','abuse_feed')),
    url             TEXT,
    format          TEXT DEFAULT 'json',
    refresh_interval_seconds INT DEFAULT 3600,
    last_synced     TIMESTAMPTZ,
    enabled         BOOLEAN DEFAULT true,
    ioc_count       INT DEFAULT 0,
    metadata        JSONB DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 9. security_iocs — Indicators of Compromise
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_iocs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    feed_id         UUID REFERENCES public.security_threat_feeds(id),
    ioc_type        TEXT NOT NULL CHECK (ioc_type IN ('ip','domain','hash_md5','hash_sha256','url','email','cve','file_path','registry_key')),
    value           TEXT NOT NULL,
    severity        TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    confidence      INT DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    description     TEXT,
    tags            TEXT[] DEFAULT '{}',
    first_seen      TIMESTAMPTZ DEFAULT now(),
    last_seen       TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_security_iocs_value ON public.security_iocs (value);
CREATE INDEX IF NOT EXISTS idx_security_iocs_type ON public.security_iocs (ioc_type);

-- ---------------------------------------------------------------------------
-- 10. security_playbooks — SOAR automation playbook definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_playbooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    name            TEXT NOT NULL,
    description     TEXT,
    trigger_type    TEXT NOT NULL,                    -- alert rule_id or event_type
    trigger_severity TEXT DEFAULT 'high',
    steps           JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ordered action steps
    enabled         BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    cooldown_seconds INT DEFAULT 300,
    last_executed   TIMESTAMPTZ,
    execution_count INT DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- 11. security_rule_sets — grouped detection rule collections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_rule_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT,                            -- 'authentication', 'network', 'application', 'compliance'
    rule_ids        TEXT[] DEFAULT '{}',
    enabled         BOOLEAN DEFAULT true
);

-- ---------------------------------------------------------------------------
-- 12. security_cases — investigation case management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    title           TEXT NOT NULL,
    description     TEXT,
    severity        TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    status          TEXT DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','pending_review','closed')),
    assigned_to     TEXT,
    incident_ids    UUID[] DEFAULT '{}',
    alert_ids       UUID[] DEFAULT '{}',
    evidence_ids    UUID[] DEFAULT '{}',
    mitre_tactics   TEXT[] DEFAULT '{}',
    mitre_techniques TEXT[] DEFAULT '{}',
    timeline        JSONB DEFAULT '[]'::jsonb,
    notes           TEXT,
    closed_at       TIMESTAMPTZ,
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_cases_status ON public.security_cases (status);

-- ---------------------------------------------------------------------------
-- 13. security_evidence — collected evidence for cases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    case_id         UUID REFERENCES public.security_cases(id),
    evidence_type   TEXT NOT NULL CHECK (evidence_type IN ('log','screenshot','packet_capture','memory_dump','file','config','api_response','email','chat_message')),
    title           TEXT NOT NULL,
    description     TEXT,
    content         JSONB DEFAULT '{}'::jsonb,
    file_url        TEXT,
    hash_sha256     TEXT,
    collected_by    TEXT,                            -- agent name or analyst
    tenant_id       UUID
);

-- ---------------------------------------------------------------------------
-- 14. security_logs — system-level security audit logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    log_source      TEXT NOT NULL,                    -- 'cloudflare', 'supabase', 'railway', 'github', 'kubernetes'
    log_level       TEXT DEFAULT 'info',
    message         TEXT,
    structured_data JSONB DEFAULT '{}'::jsonb,
    correlation_id  TEXT,
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_logs_source ON public.security_logs (log_source);
CREATE INDEX IF NOT EXISTS idx_security_logs_created ON public.security_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- 15. security_risk_scores — historical risk score snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_risk_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('user','ip','asset','session','tenant')),
    entity_id       TEXT NOT NULL,
    score           INT NOT NULL CHECK (score >= 0 AND score <= 100),
    factors         JSONB DEFAULT '[]'::jsonb,        -- array of {factor, weight, value}
    model_version   TEXT DEFAULT '1.0',
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_risk_scores_entity ON public.security_risk_scores (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 16. security_models — ML/AI model registry for detection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    name            TEXT NOT NULL,
    model_type      TEXT NOT NULL CHECK (model_type IN ('anomaly_detection','classification','risk_scoring','nlp','correlation')),
    version         TEXT NOT NULL,
    description     TEXT,
    accuracy        DOUBLE PRECISION,
    parameters      JSONB DEFAULT '{}'::jsonb,
    is_active       BOOLEAN DEFAULT true,
    last_trained    TIMESTAMPTZ,
    training_data_range JSONB DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 17. security_attack_chains — MITRE ATT&CK kill chain tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_attack_chains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    incident_id     UUID REFERENCES public.security_incidents(id),
    case_id         UUID REFERENCES public.security_cases(id),
    name            TEXT,
    description     TEXT,
    mitre_tactics   TEXT[] DEFAULT '{}',              -- TA0001, TA0002, etc.
    mitre_techniques TEXT[] DEFAULT '{}',             -- T1078, T1110, etc.
    kill_chain_phase TEXT,                            -- reconnaissance, weaponization, delivery, exploitation, installation, c2, actions
    confidence      INT DEFAULT 50,
    evidence_ids    UUID[] DEFAULT '{}',
    timeline        JSONB DEFAULT '[]'::jsonb,
    tenant_id       UUID
);

-- ---------------------------------------------------------------------------
-- 18. security_graph_nodes — knowledge graph nodes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_graph_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    node_type       TEXT NOT NULL CHECK (node_type IN ('user','ip','device','session','alert','incident','asset','ioc','country','organization','technique','tactic')),
    node_id         TEXT NOT NULL,                    -- reference to the entity
    label           TEXT,
    properties      JSONB DEFAULT '{}'::jsonb,
    risk_score      INT DEFAULT 0,
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_graph_nodes_type ON public.security_graph_nodes (node_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_graph_nodes_unique ON public.security_graph_nodes (node_type, node_id);

-- ---------------------------------------------------------------------------
-- 19. security_graph_edges — knowledge graph relationships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_graph_edges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_node_id  UUID REFERENCES public.security_graph_nodes(id),
    target_node_id  UUID REFERENCES public.security_graph_nodes(id),
    relationship    TEXT NOT NULL,                    -- 'logged_in_from', 'triggered', 'attacked', 'owns', 'associated_with'
    weight          DOUBLE PRECISION DEFAULT 1.0,
    properties      JSONB DEFAULT '{}'::jsonb,
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_graph_edges_source ON public.security_graph_edges (source_node_id);
CREATE INDEX IF NOT EXISTS idx_security_graph_edges_target ON public.security_graph_edges (target_node_id);
CREATE INDEX IF NOT EXISTS idx_security_graph_edges_rel ON public.security_graph_edges (relationship);

-- ---------------------------------------------------------------------------
-- 20. security_reports — generated incident and compliance reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    report_type     TEXT NOT NULL CHECK (report_type IN ('incident','executive','compliance','threat_brief','investigation','weekly','monthly')),
    title           TEXT NOT NULL,
    content_md      TEXT,                            -- Markdown content
    content_json    JSONB DEFAULT '{}'::jsonb,       -- Structured data
    generated_by    TEXT DEFAULT 'hermes-analyst',
    case_id         UUID REFERENCES public.security_cases(id),
    incident_id     UUID REFERENCES public.security_incidents(id),
    mitre_mapping   JSONB DEFAULT '{}'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    tenant_id       UUID
);

-- ---------------------------------------------------------------------------
-- 21. security_compliance — compliance framework mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_compliance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    framework       TEXT NOT NULL CHECK (framework IN ('soc2','iso27001','cis','nist_csf','pci_dss','hipaa','gdpr')),
    control_id      TEXT NOT NULL,                    -- e.g. 'CC6.1', 'A.12.4.1'
    control_name    TEXT NOT NULL,
    status          TEXT DEFAULT 'not_assessed' CHECK (status IN ('not_assessed','compliant','partial','non_compliant','not_applicable')),
    evidence_ids    UUID[] DEFAULT '{}',
    notes           TEXT,
    last_assessed   TIMESTAMPTZ,
    assessor        TEXT,
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_compliance_framework ON public.security_compliance (framework);

-- ---------------------------------------------------------------------------
-- 22. security_agent_workforce — agent registry and status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_agent_workforce (
    id              TEXT PRIMARY KEY,                 -- 'sentinel', 'guardian', 'hunter', etc.
    name            TEXT NOT NULL,
    description     TEXT,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active','idle','busy','error','disabled')),
    capabilities    TEXT[] DEFAULT '{}',
    last_heartbeat  TIMESTAMPTZ DEFAULT now(),
    tasks_completed INT DEFAULT 0,
    tasks_failed    INT DEFAULT 0,
    current_task    TEXT,
    config          JSONB DEFAULT '{}'::jsonb,
    version         TEXT DEFAULT '0.1.0'
);

-- ---------------------------------------------------------------------------
-- 23. security_agent_tasks — task queue for agent workforce
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_agent_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    agent_id        TEXT REFERENCES public.security_agent_workforce(id),
    task_type       TEXT NOT NULL,
    priority        INT DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    status          TEXT DEFAULT 'queued' CHECK (status IN ('queued','assigned','running','completed','failed','cancelled')),
    input_data      JSONB DEFAULT '{}'::jsonb,
    output_data     JSONB DEFAULT '{}'::jsonb,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    parent_task_id  UUID,
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_agent_tasks_status ON public.security_agent_tasks (status);
CREATE INDEX IF NOT EXISTS idx_security_agent_tasks_agent ON public.security_agent_tasks (agent_id);

-- ---------------------------------------------------------------------------
-- 24. security_correlations — event correlation results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_correlations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_type TEXT NOT NULL,                   -- 'temporal', 'actor', 'ip', 'technique', 'campaign'
    event_ids       UUID[] DEFAULT '{}',
    alert_ids       UUID[] DEFAULT '{}',
    confidence      INT DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
    description     TEXT,
    mitre_campaign  TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb,
    tenant_id       UUID
);

-- ---------------------------------------------------------------------------
-- 25. security_metrics — MTTD, MTTR, and operational metrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    metric_type     TEXT NOT NULL CHECK (metric_type IN ('mttd','mttr','alert_volume','false_positive_rate','coverage','risk_trend')),
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    value           DOUBLE PRECISION NOT NULL,
    unit            TEXT DEFAULT 'seconds',
    dimensions      JSONB DEFAULT '{}'::jsonb,        -- e.g. {severity: 'high', rule_id: '...'}
    tenant_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_security_metrics_type ON public.security_metrics (metric_type, period_start DESC);

-- ---------------------------------------------------------------------------
-- Seed agent workforce
-- ---------------------------------------------------------------------------
INSERT INTO public.security_agent_workforce (id, name, description, capabilities, version)
VALUES
    ('soc_commander', 'Hermes SOC Commander', 'Coordinates all security agents, prioritizes tasks, and manages escalations.', ARRAY['orchestration','prioritization','escalation','reporting'], '0.1.0'),
    ('sentinel', 'Sentinel', 'Log analysis agent — ingests, classifies, normalizes, and prioritizes security logs.', ARRAY['log_ingestion','classification','normalization','prioritization'], '0.1.0'),
    ('guardian', 'Guardian', 'Identity monitoring agent — detects impossible travel, privilege escalation, MFA removal, token theft.', ARRAY['identity_monitoring','impossible_travel','privilege_detection','mfa_monitoring'], '0.1.0'),
    ('hunter', 'Hunter', 'Threat hunting agent — searches for persistence, lateral movement, ransomware indicators, beaconing.', ARRAY['threat_hunting','persistence_detection','lateral_movement','ransomware_detection','beaconing'], '0.1.0'),
    ('oracle', 'Oracle', 'Threat intelligence agent — imports known bad IPs, CVEs, exploit feeds, malware hashes.', ARRAY['threat_intel','ioc_import','cve_tracking','feed_management'], '0.1.0'),
    ('analyst', 'Analyst', 'Investigation and reporting agent — writes executive summaries, timelines, MITRE mappings, recommendations.', ARRAY['report_generation','timeline_construction','mitre_mapping','executive_summary'], '0.1.0'),
    ('engineer', 'Engineer', 'Remediation agent — suggests firewall rules, IAM changes, Kubernetes fixes, Docker hardening.', ARRAY['firewall_rules','iam_recommendations','kubernetes_fixes','docker_hardening'], '0.1.0'),
    ('compliance', 'Compliance', 'Compliance mapping agent — maps findings to SOC 2, ISO 27001, CIS, NIST CSF, PCI DSS, HIPAA.', ARRAY['soc2','iso27001','cis','nist_csf','pci_dss','hipaa'], '0.1.0')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed SOAR playbooks
-- ---------------------------------------------------------------------------
INSERT INTO public.security_playbooks (name, description, trigger_type, trigger_severity, steps, enabled)
VALUES
    ('Credential Stuffing Response', 'Automated response to brute force / credential stuffing attacks.', 'brute_force_login', 'high',
     '[{"action":"disable_account","params":{"duration":"1h"}},{"action":"revoke_sessions","params":{}},{"action":"notify_user","params":{"channel":"email"}},{"action":"create_incident","params":{"severity":"high"}},{"action":"generate_report","params":{"type":"incident"}}]'::jsonb, true),
    ('API Abuse Containment', 'Automated containment for API abuse / rate limit violations.', 'api_abuse', 'high',
     '[{"action":"block_ip","params":{"duration":"24h"}},{"action":"increase_rate_limit","params":{"factor":0.5}},{"action":"notify_admin","params":{"channel":"slack"}},{"action":"save_evidence","params":{}}]'::jsonb, true),
    ('Token Theft Response', 'Immediate response to detected token theft or reuse.', 'token_reuse', 'critical',
     '[{"action":"revoke_jwt","params":{}},{"action":"rotate_refresh_token","params":{}},{"action":"invalidate_sessions","params":{}},{"action":"alert_soc","params":{"priority":"critical"}}]'::jsonb, true),
    ('GitHub Secret Leak', 'Response to leaked secrets detected in GitHub repositories.', 'secret_leak', 'critical',
     '[{"action":"revoke_secret","params":{}},{"action":"rotate_credentials","params":{}},{"action":"notify_repo_owner","params":{}},{"action":"create_ticket","params":{"system":"github"}}]'::jsonb, true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Enable RLS on all new tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.security_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_ip_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_geolocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_threat_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_iocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_attack_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_agent_workforce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_metrics ENABLE ROW LEVEL SECURITY;

-- Service role full access policies for all new tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'security_assets','security_users','security_identities','security_sessions',
            'security_devices','security_ip_history','security_geolocation','security_threat_feeds',
            'security_iocs','security_playbooks','security_rule_sets','security_cases',
            'security_evidence','security_logs','security_risk_scores','security_models',
            'security_attack_chains','security_graph_nodes','security_graph_edges',
            'security_reports','security_compliance','security_agent_workforce',
            'security_agent_tasks','security_correlations','security_metrics'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY "service_role_full_%s" ON public.%I FOR ALL USING (auth.role() = ''service_role'')',
            tbl, tbl
        );
        EXECUTE format(
            'CREATE POLICY "authenticated_read_%s" ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')',
            tbl, tbl
        );
    END LOOP;
END $$;

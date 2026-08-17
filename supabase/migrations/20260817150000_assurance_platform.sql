-- D3VONN.IO Assurance Platform
-- Server-side service-role access only. Browser clients do not receive direct table policies.

create table if not exists public.assurance_mcp_gateways (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 3 and 100),
  origin text not null unique,
  hostname text not null,
  approved_addresses jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  approved_by uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_mcp_audit_log (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid references public.assurance_mcp_gateways(id) on delete restrict,
  actor_user_id uuid,
  goal_digest text not null,
  request_id uuid not null unique,
  decision text not null check (decision in ('allowed', 'denied')),
  deny_reason text,
  target_origin text,
  resolved_addresses jsonb not null default '[]'::jsonb,
  http_status integer,
  created_at timestamptz not null default now()
);

create table if not exists public.assurance_csp_reports (
  id uuid primary key default gen_random_uuid(),
  document_uri text not null,
  violated_directive text not null,
  blocked_uri text,
  source_file text,
  line_number integer,
  created_at timestamptz not null default now()
);

create table if not exists public.assurance_route_audits (
  id uuid primary key default gen_random_uuid(),
  executed_at timestamptz not null default now(),
  passed boolean not null,
  result jsonb not null
);

create table if not exists public.assurance_performance_samples (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  metric_name text not null check (metric_name in ('LCP', 'INP', 'CLS')),
  metric_value numeric not null check (metric_value >= 0),
  source text not null check (source in ('rum', 'synthetic')),
  navigation_type text not null default 'navigate',
  deployment text not null default 'production',
  user_agent_family text,
  created_at timestamptz not null default now()
);

create table if not exists public.assurance_accessibility_audits (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  passed boolean not null,
  violation_count integer not null check (violation_count >= 0),
  result jsonb not null,
  executed_at timestamptz not null default now()
);

create table if not exists public.assurance_status_components (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  status text not null default 'operational' check (status in ('operational', 'degraded', 'partial_outage', 'maintenance')),
  uptime_30d numeric(5,2) not null default 100.00 check (uptime_30d >= 0 and uptime_30d <= 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  impact text not null check (impact in ('none', 'minor', 'major', 'critical')),
  status text not null check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  summary text,
  started_at timestamptz not null,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_status_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text,
  webhook_url text,
  webhook_secret text,
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation', 'verified', 'unsubscribed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((email is not null and webhook_url is null) or (email is null and webhook_url is not null))
);

create table if not exists public.assurance_remediation_items (
  id text primary key,
  priority text not null check (priority in ('P0', 'P1', 'P2')),
  title text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  owner text,
  target_date timestamptz,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assurance_mcp_audit_gateway_created_idx on public.assurance_mcp_audit_log (gateway_id, created_at desc);
create index if not exists assurance_mcp_audit_actor_created_idx on public.assurance_mcp_audit_log (actor_user_id, created_at desc);
create index if not exists assurance_csp_reports_created_idx on public.assurance_csp_reports (created_at desc);
create index if not exists assurance_performance_route_metric_created_idx on public.assurance_performance_samples (route, metric_name, created_at desc);
create index if not exists assurance_accessibility_route_executed_idx on public.assurance_accessibility_audits (route, executed_at desc);
create index if not exists assurance_incidents_started_idx on public.assurance_incidents (started_at desc);
create index if not exists assurance_maintenance_starts_idx on public.assurance_maintenance_windows (starts_at);
create index if not exists assurance_remediation_priority_status_idx on public.assurance_remediation_items (priority, status, target_date);

create or replace function public.assurance_prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'assurance_mcp_audit_log is append-only';
end;
$$;

drop trigger if exists assurance_mcp_audit_log_immutable on public.assurance_mcp_audit_log;
create trigger assurance_mcp_audit_log_immutable
before update or delete on public.assurance_mcp_audit_log
for each row execute function public.assurance_prevent_audit_mutation();

alter table public.assurance_mcp_gateways enable row level security;
alter table public.assurance_mcp_audit_log enable row level security;
alter table public.assurance_csp_reports enable row level security;
alter table public.assurance_route_audits enable row level security;
alter table public.assurance_performance_samples enable row level security;
alter table public.assurance_accessibility_audits enable row level security;
alter table public.assurance_status_components enable row level security;
alter table public.assurance_incidents enable row level security;
alter table public.assurance_maintenance_windows enable row level security;
alter table public.assurance_status_subscriptions enable row level security;
alter table public.assurance_remediation_items enable row level security;

revoke all on public.assurance_mcp_gateways, public.assurance_mcp_audit_log, public.assurance_csp_reports,
  public.assurance_route_audits, public.assurance_performance_samples, public.assurance_accessibility_audits,
  public.assurance_status_components, public.assurance_incidents, public.assurance_maintenance_windows,
  public.assurance_status_subscriptions, public.assurance_remediation_items from anon, authenticated;

insert into public.assurance_remediation_items (id, priority, title, status, owner, target_date, acceptance_criteria)
values
  ('SEO-01', 'P0', 'Canonical host alignment', 'in_progress', 'Web Platform', now() + interval '7 days', '["One canonical host in redirects, sitemaps, metadata, and structured data", "Server response tests pass for every sitemap route"]'::jsonb),
  ('SEC-03', 'P0', 'Secure MCP gateway execution', 'in_progress', 'Platform Security', now() + interval '7 days', '["Authentication and registered-gateway allowlist enforced", "Pre- and post-resolution SSRF protection validated", "Append-only audit log present"]'::jsonb),
  ('SEO-02', 'P1', 'Initial-response metadata validation', 'in_progress', 'Web Platform', now() + interval '30 days', '["Route-specific metadata exists before hydration", "Automated validator is green"]'::jsonb),
  ('SEC-01', 'P1', 'Strict CSP with reporting', 'in_progress', 'Platform Security', now() + interval '30 days', '["No unsafe-eval in enforced policy", "Per-request nonce header deployed", "Report endpoint stores violations"]'::jsonb),
  ('PERF-01', 'P1', 'Public route performance budgets', 'open', 'Frontend', now() + interval '30 days', '["RUM LCP INP CLS captured", "Synthetic budget report available"]'::jsonb),
  ('TRUST-01', 'P1', 'Vulnerability disclosure process', 'in_progress', 'Security Operations', now() + interval '7 days', '["security.txt resolves", "Public policy includes safe harbor and SLAs"]'::jsonb),
  ('A11Y-01', 'P2', 'WCAG 2.2 AA automated audits', 'open', 'Quality Engineering', now() + interval '60 days', '["axe reports generated for critical public routes", "Known findings are tracked"]'::jsonb),
  ('OPS-01', 'P2', 'Operational transparency and subscriptions', 'in_progress', 'Site Reliability', now() + interval '60 days', '["Incident history and maintenance calendar shown", "Component uptime and subscription controls available"]'::jsonb)
on conflict (id) do nothing;

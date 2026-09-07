-- D3VONN.IO normalized external intelligence event store.
-- Server-side service-role writes only; no browser policies are granted.

create table if not exists public.intelligence_events (
    id uuid primary key default gen_random_uuid(),
    schema_version text not null default 'd3vonn.intelligence-event/v1',
    source text not null,
    domain text not null,
    event_type text not null,
    title text,
    summary text,
    entities jsonb not null default '[]'::jsonb,
    location jsonb not null default '{}'::jsonb,
    severity double precision not null default 0 check (severity >= 0 and severity <= 1),
    confidence double precision not null default 0.5 check (confidence >= 0 and confidence <= 1),
    observed_at timestamptz not null default now(),
    evidence jsonb not null default '[]'::jsonb,
    relationships jsonb not null default '[]'::jsonb,
    raw_source_id text,
    fingerprint text not null,
    raw jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (source, fingerprint)
);

create index if not exists intelligence_events_observed_at_idx
    on public.intelligence_events (observed_at desc);

create index if not exists intelligence_events_domain_type_idx
    on public.intelligence_events (domain, event_type, observed_at desc);

create index if not exists intelligence_events_severity_idx
    on public.intelligence_events (severity desc, observed_at desc);

alter table public.intelligence_events enable row level security;

comment on table public.intelligence_events is
    'Server-side normalized external intelligence signals used by Hermes and D3VONN intelligence workflows.';

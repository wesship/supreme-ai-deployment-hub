create table if not exists public.connector_environment_policies (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  environment text not null,
  allow_personal_identity boolean not null default false,
  require_business_identity boolean not null default true,
  writes_enabled boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  unique(provider, environment)
);

alter table public.connector_environment_policies enable row level security;

insert into public.connector_environment_policies(provider,environment,allow_personal_identity,require_business_identity,writes_enabled,notes)
values
 ('gmail','staging',false,true,false,'Personal Gmail write testing retired after reversible connectivity canary.'),
 ('google_calendar','staging',false,true,false,'Personal Calendar write testing retired after reversible connectivity canary.'),
 ('gmail','production',false,true,false,'Enable only after dedicated DEVONN business identity and production approval.'),
 ('google_calendar','production',false,true,false,'Enable only after dedicated DEVONN business identity and production approval.')
on conflict(provider,environment) do update set
 allow_personal_identity=excluded.allow_personal_identity,
 require_business_identity=excluded.require_business_identity,
 writes_enabled=excluded.writes_enabled,
 notes=excluded.notes,
 updated_at=now();

create policy "owners read connector environment policies"
on public.connector_environment_policies for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.user_id=(select auth.uid()) and m.role='owner'
  )
);

revoke all on public.connector_environment_policies from anon, authenticated;
grant select on public.connector_environment_policies to authenticated;

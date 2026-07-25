begin;

create table if not exists public.user_plan_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  plan_type text not null,
  title text not null,
  description text,
  steps jsonb default '[]'::jsonb,
  status text not null default 'active',
  completed_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_user_plan_logs_user_id
  on public.user_plan_logs(user_id);

alter table public.user_plan_logs enable row level security;
revoke all privileges on table public.user_plan_logs from public, anon, authenticated;
grant all privileges on table public.user_plan_logs to service_role;

commit;

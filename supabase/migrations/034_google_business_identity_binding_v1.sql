alter table public.connector_environment_policies
  add column if not exists business_identity text;

update public.connector_environment_policies
set business_identity='support@d3vonn.io', updated_at=now()
where provider in ('gmail','google_calendar')
  and environment in ('staging','production');

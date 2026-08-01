-- Restore the normalized event label expected by the Executive Command Center.
alter table public.agent_activity_logs
  add column if not exists event_type text;

update public.agent_activity_logs
set event_type = coalesce(nullif(action, ''), nullif(agent_type, ''), 'activity')
where event_type is null;

alter table public.agent_activity_logs
  alter column event_type set default 'activity',
  alter column event_type set not null;

comment on column public.agent_activity_logs.event_type is
  'Normalized activity event label used by the executive dashboard.';

notify pgrst, 'reload schema';

-- Restore the normalized event label expected by the Executive Command Center.
alter table public.agent_activity_logs
  add column if not exists event_type text;

update public.agent_activity_logs as activity
set event_type = coalesce(
  nullif(to_jsonb(activity)->>'action', ''),
  nullif(to_jsonb(activity)->>'agent_type', ''),
  'activity'
)
where event_type is null;

alter table public.agent_activity_logs
  alter column event_type set default 'activity',
  alter column event_type set not null;

comment on column public.agent_activity_logs.event_type is
  'Normalized activity event label used by the executive dashboard.';

notify pgrst, 'reload schema';

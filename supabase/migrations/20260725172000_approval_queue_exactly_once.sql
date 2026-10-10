-- Enforce immutable terminal approval decisions and retain one audit record per review.

create table if not exists public.approval_queue_audit (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null unique references public.approval_queue(id) on delete cascade,
  previous_status text not null,
  decision text not null check (decision in ('approved', 'rejected')),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  review_note text,
  reviewed_at timestamptz not null,
  action_type text not null,
  action_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.approval_queue_audit enable row level security;
revoke all on table public.approval_queue_audit from public, anon, authenticated;
grant select, insert on table public.approval_queue_audit to service_role;

comment on table public.approval_queue_audit is
  'Immutable one-row-per-approval audit ledger for approved or rejected decisions.';

create or replace function public.enforce_approval_queue_exactly_once()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.status in ('approved', 'rejected') then
    raise exception 'approval % is already terminal with status %', old.id, old.status
      using errcode = '55000';
  end if;

  if new.status not in ('pending', 'approved', 'rejected') then
    raise exception 'unsupported approval status: %', new.status
      using errcode = '23514';
  end if;

  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    if new.reviewed_by is null then
      raise exception 'reviewed_by is required for terminal approval decisions'
        using errcode = '23502';
    end if;

    -- Ignore client-supplied timestamp strings and use the database clock.
    new.reviewed_at := clock_timestamp();

    insert into public.approval_queue_audit (
      approval_id,
      previous_status,
      decision,
      reviewed_by,
      review_note,
      reviewed_at,
      action_type,
      action_data
    ) values (
      old.id,
      old.status,
      new.status,
      new.reviewed_by,
      new.review_note,
      new.reviewed_at,
      old.action_type,
      old.action_data
    );
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_approval_queue_exactly_once() from public, anon, authenticated;
grant execute on function public.enforce_approval_queue_exactly_once() to service_role;

drop trigger if exists approval_queue_exactly_once_review on public.approval_queue;
create trigger approval_queue_exactly_once_review
before update of status, reviewed_by, review_note, reviewed_at
on public.approval_queue
for each row
execute function public.enforce_approval_queue_exactly_once();

comment on function public.enforce_approval_queue_exactly_once() is
  'Allows one pending-to-approved/rejected transition, records it, and makes the terminal decision immutable.';

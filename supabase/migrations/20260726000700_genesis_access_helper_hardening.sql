-- Harden the Genesis RLS access helper against caller-supplied user impersonation.
-- Authenticated callers are always evaluated as auth.uid(); only service_role may
-- provide an explicit actor for trusted backend diagnostics.

create or replace function public.genesis_has_project_access(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with effective_actor as (
    select case
      when auth.role() = 'service_role' then coalesce(p_user_id, auth.uid())
      else auth.uid()
    end as user_id
  )
  select exists (
    select 1
    from public.genesis_projects p
    cross join effective_actor actor
    where p.id = p_project_id
      and actor.user_id is not null
      and (
        p.owner_id = actor.user_id
        or exists (
          select 1
          from public.genesis_project_members m
          where m.project_id = p.id
            and m.user_id = actor.user_id
        )
      )
  );
$$;

revoke all on function public.genesis_has_project_access(uuid, uuid) from public;
revoke all on function public.genesis_has_project_access(uuid, uuid) from anon;
grant execute on function public.genesis_has_project_access(uuid, uuid) to authenticated;
grant execute on function public.genesis_has_project_access(uuid, uuid) to service_role;

comment on function public.genesis_has_project_access(uuid, uuid) is
  'RLS access helper. Authenticated callers are always evaluated as auth.uid(); only service_role may supply an explicit actor.';

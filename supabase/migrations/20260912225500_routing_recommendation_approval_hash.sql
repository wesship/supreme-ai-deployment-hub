create extension if not exists pgcrypto with schema extensions;

alter table public.ai_film_routing_recommendation_approvals
  alter column evidence_hash drop not null;

create or replace function public.set_ai_film_routing_recommendation_evidence_hash()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.evidence_hash := encode(extensions.digest(convert_to(new.evidence::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$$;

revoke all on function public.set_ai_film_routing_recommendation_evidence_hash() from public, anon, authenticated;

drop trigger if exists set_ai_film_routing_recommendation_evidence_hash on public.ai_film_routing_recommendation_approvals;
create trigger set_ai_film_routing_recommendation_evidence_hash
before insert on public.ai_film_routing_recommendation_approvals
for each row execute function public.set_ai_film_routing_recommendation_evidence_hash();

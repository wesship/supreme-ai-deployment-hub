alter table public.ai_film_routing_recommendation_approvals
  alter column owner_id set default auth.uid(),
  alter column reviewer_id set default auth.uid();

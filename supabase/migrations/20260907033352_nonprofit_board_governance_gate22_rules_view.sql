create or replace view public.nonprofit_board_rules_v1
with (security_invoker=true)
as
select
  organization_id,
  quorum_mode,
  vote_mode,
  written_consent_mode,
  recused_counts_for_quorum,
  effective,
  status,
  authority_basis,
  adopted_at
from nonprofit_security.board_governance_rules;

grant select on public.nonprofit_board_rules_v1 to authenticated;
revoke all on public.nonprofit_board_rules_v1 from anon;

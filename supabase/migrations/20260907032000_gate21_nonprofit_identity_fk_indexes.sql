create index if not exists membership_invites_created_by_idx
  on nonprofit_security.membership_invites(created_by);

create index if not exists membership_invites_claimed_by_idx
  on nonprofit_security.membership_invites(claimed_by);

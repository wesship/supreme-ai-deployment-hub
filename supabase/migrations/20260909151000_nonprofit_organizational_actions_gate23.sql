create table if not exists nonprofit_security.organizational_action_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references nonprofit.organizations(id) on delete cascade,
  title text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','READY','ADOPTED','VOID')),
  formation_document_id uuid references nonprofit_vault.documents(id),
  bylaws_document_id uuid references nonprofit_vault.documents(id),
  board_resolution_id uuid references nonprofit_security.board_resolutions(id),
  authority_basis text,
  effective boolean not null default false,
  adopted_at timestamptz,
  evidence_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, title),
  check ((effective = false and status <> 'ADOPTED') or (effective = true and status = 'ADOPTED' and board_resolution_id is not null and formation_document_id is not null and bylaws_document_id is not null and authority_basis is not null and adopted_at is not null))
);

create table if not exists nonprofit_security.organizational_action_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references nonprofit_security.organizational_action_packages(id) on delete cascade,
  organization_id uuid not null references nonprofit.organizations(id) on delete cascade,
  action_code text not null,
  title text not null,
  sequence_no integer not null,
  required boolean not null default true,
  status text not null default 'PENDING' check (status in ('PENDING','READY','ADOPTED','NOT_APPLICABLE')),
  document_id uuid references nonprofit_vault.documents(id),
  resolution_id uuid references nonprofit_security.board_resolutions(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, action_code),
  unique (package_id, sequence_no),
  check (status <> 'ADOPTED' or resolution_id is not null)
);

create index if not exists organizational_action_packages_org_idx on nonprofit_security.organizational_action_packages(organization_id);
create index if not exists organizational_action_items_org_idx on nonprofit_security.organizational_action_items(organization_id);
create index if not exists organizational_action_items_package_idx on nonprofit_security.organizational_action_items(package_id);
create index if not exists organizational_action_items_resolution_idx on nonprofit_security.organizational_action_items(resolution_id) where resolution_id is not null;

alter table nonprofit_security.organizational_action_packages enable row level security;
alter table nonprofit_security.organizational_action_items enable row level security;
revoke all on nonprofit_security.organizational_action_packages from public, anon, authenticated;
revoke all on nonprofit_security.organizational_action_items from public, anon, authenticated;
grant all on nonprofit_security.organizational_action_packages to service_role;
grant all on nonprofit_security.organizational_action_items to service_role;
grant select on nonprofit_security.organizational_action_packages to authenticated;
grant select on nonprofit_security.organizational_action_items to authenticated;

create policy organizational_action_packages_member_read on nonprofit_security.organizational_action_packages for select to authenticated using (nonprofit_security.is_member(organization_id, null));
create policy organizational_action_items_member_read on nonprofit_security.organizational_action_items for select to authenticated using (nonprofit_security.is_member(organization_id, null));

insert into nonprofit_security.organizational_action_packages (organization_id, title, status, effective, authority_basis)
select id, 'Initial Organizational Action Package', 'DRAFT', false, null from nonprofit.organizations where legal_name='D3VONN.IO Institute, Inc.'
on conflict (organization_id, title) do nothing;

insert into nonprofit_security.organizational_action_items (package_id, organization_id, action_code, title, sequence_no, required, status, notes)
select p.id, p.organization_id, v.action_code, v.title, v.sequence_no, v.required, 'PENDING', v.notes
from nonprofit_security.organizational_action_packages p
cross join (values
 ('VERIFY_FORMATION','Verify Delaware formation evidence',1,true,'Requires filed Delaware formation evidence before organizational actions can become effective.'),
 ('ADOPT_BYLAWS','Adopt bylaws',2,true,'Drafting may occur before the meeting, but adoption requires valid board action.'),
 ('APPOINT_OFFICERS','Appoint initial officers',3,true,'Officer appointments require real directors and valid board action.'),
 ('ADOPT_CONFLICT_POLICY','Adopt conflict-of-interest policy',4,true,'Required governance control for related-party review.'),
 ('ADOPT_FINANCIAL_CONTROLS','Adopt financial controls and banking authority',5,true,'No bank authority is created until adopted by authorized humans.'),
 ('AUTHORIZE_EIN','Authorize EIN application',6,true,'EIN filing remains a human-authorized action.'),
 ('AUTHORIZE_BANK','Authorize nonprofit bank account and signers',7,true,'Bank signers must be explicitly named by valid board action.'),
 ('AUTHORIZE_NY','Authorize New York foreign qualification and charitable registration',8,true,'No filing is represented as completed until evidence is stored.'),
 ('AUTHORIZE_1023','Authorize full IRS Form 1023 application',9,true,'No submission occurs without final human review and authorization.'),
 ('ADOPT_AI_DATA_POLICY','Adopt AI and data governance policy',10,true,'Agents remain advisory and cannot create their own authority.'),
 ('ADOPT_INTL_POLICY','Adopt Ghana/international-program controls',11,true,'International activity remains subject to due diligence, sanctions screening, and related-party controls.')
) as v(action_code,title,sequence_no,required,notes)
where p.title='Initial Organizational Action Package'
on conflict (package_id, action_code) do nothing;

create or replace view public.nonprofit_organizational_actions_v1 with (security_invoker=true) as
select p.organization_id,p.id as package_id,p.title as package_title,p.status as package_status,p.effective,p.formation_document_id,p.bylaws_document_id,p.board_resolution_id,p.authority_basis,p.adopted_at,i.id as item_id,i.action_code,i.title as item_title,i.sequence_no,i.required,i.status as item_status,i.document_id,i.resolution_id,i.notes
from nonprofit_security.organizational_action_packages p join nonprofit_security.organizational_action_items i on i.package_id=p.id;
grant select on public.nonprofit_organizational_actions_v1 to authenticated;
revoke all on public.nonprofit_organizational_actions_v1 from anon;
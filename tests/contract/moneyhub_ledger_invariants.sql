\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222')
on conflict (id) do nothing;

do $$
declare
  v_owner1 constant uuid := '11111111-1111-1111-1111-111111111111';
  v_owner2 constant uuid := '22222222-2222-2222-2222-222222222222';
  v_cash uuid;
  v_revenue uuid;
  v_other_cash uuid;
  v_journal uuid;
  v_same_journal uuid;
  v_reversal uuid;
  v_balance numeric(24,8);
  v_failed boolean;
begin
  insert into public.moneyhub_accounts (
    owner_id, code, name, account_type, normal_balance, currency, agent_name
  ) values (
    v_owner1, '1000', 'Cash', 'asset', 'debit', 'USD', 'HERMES'
  ) returning id into v_cash;

  insert into public.moneyhub_accounts (
    owner_id, code, name, account_type, normal_balance, currency, agent_name
  ) values (
    v_owner1, '4000', 'Revenue', 'revenue', 'credit', 'USD', 'HERMES'
  ) returning id into v_revenue;

  insert into public.moneyhub_accounts (
    owner_id, code, name, account_type, normal_balance, currency
  ) values (
    v_owner2, '1000', 'Other Cash', 'asset', 'debit', 'USD'
  ) returning id into v_other_cash;

  -- Balanced posting must succeed.
  v_journal := public.moneyhub_post_journal(
    v_owner1,
    'contract-balanced-1',
    'Contract test revenue',
    'USD',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cash, 'direction', 'debit', 'amount', 100.00, 'memo', 'cash received'),
      jsonb_build_object('account_id', v_revenue, 'direction', 'credit', 'amount', 100.00, 'memo', 'revenue earned')
    ),
    'contract-test',
    'moneyhub-ledger-invariants',
    'HERMES',
    'corr-contract-1'
  );

  if v_journal is null then
    raise exception 'balanced posting did not return a journal id';
  end if;

  -- Same owner + idempotency key must return the original journal.
  v_same_journal := public.moneyhub_post_journal(
    v_owner1,
    'contract-balanced-1',
    'Contract test revenue',
    'USD',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cash, 'direction', 'debit', 'amount', 100.00),
      jsonb_build_object('account_id', v_revenue, 'direction', 'credit', 'amount', 100.00)
    )
  );

  if v_same_journal <> v_journal then
    raise exception 'idempotency failed: expected %, received %', v_journal, v_same_journal;
  end if;

  if (select count(*) from public.moneyhub_journals where owner_id = v_owner1 and idempotency_key = 'contract-balanced-1') <> 1 then
    raise exception 'idempotency produced duplicate journals';
  end if;

  if (select count(*) from public.moneyhub_entries where journal_id = v_journal) <> 2 then
    raise exception 'balanced journal did not contain exactly two entries';
  end if;

  if (
    select coalesce(sum(case when direction = 'debit' then amount else 0 end), 0)
    from public.moneyhub_entries where journal_id = v_journal
  ) <> (
    select coalesce(sum(case when direction = 'credit' then amount else 0 end), 0)
    from public.moneyhub_entries where journal_id = v_journal
  ) then
    raise exception 'persisted journal is not balanced';
  end if;

  -- Unbalanced posting must be rejected.
  v_failed := false;
  begin
    perform public.moneyhub_post_journal(
      v_owner1,
      'contract-unbalanced',
      'Must fail',
      'USD',
      jsonb_build_array(
        jsonb_build_object('account_id', v_cash, 'direction', 'debit', 'amount', 100.00),
        jsonb_build_object('account_id', v_revenue, 'direction', 'credit', 'amount', 99.00)
      )
    );
  exception when others then
    if sqlerrm like 'unbalanced journal:%' then
      v_failed := true;
    else
      raise;
    end if;
  end;

  if not v_failed then
    raise exception 'unbalanced journal was accepted';
  end if;

  -- Cross-owner account mixing must be rejected.
  v_failed := false;
  begin
    perform public.moneyhub_post_journal(
      v_owner1,
      'contract-cross-owner',
      'Must fail ownership isolation',
      'USD',
      jsonb_build_array(
        jsonb_build_object('account_id', v_other_cash, 'direction', 'debit', 'amount', 25.00),
        jsonb_build_object('account_id', v_revenue, 'direction', 'credit', 'amount', 25.00)
      )
    );
  exception when others then
    if sqlerrm = 'cross-owner journal entries are prohibited' then
      v_failed := true;
    else
      raise;
    end if;
  end;

  if not v_failed then
    raise exception 'cross-owner journal was accepted';
  end if;

  -- Derived balances must follow account normal-balance semantics.
  select balance into v_balance
  from public.moneyhub_account_balances
  where account_id = v_cash;
  if v_balance <> 100.00 then
    raise exception 'cash balance incorrect before reversal: %', v_balance;
  end if;

  select balance into v_balance
  from public.moneyhub_account_balances
  where account_id = v_revenue;
  if v_balance <> 100.00 then
    raise exception 'revenue balance incorrect before reversal: %', v_balance;
  end if;

  -- Posted journals and entries are immutable.
  v_failed := false;
  begin
    update public.moneyhub_journals set description = 'mutated' where id = v_journal;
  exception when others then
    if sqlerrm like 'MoneyHub posted ledger records are immutable%' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'posted journal mutation was accepted';
  end if;

  v_failed := false;
  begin
    update public.moneyhub_entries set amount = 1 where journal_id = v_journal;
  exception when others then
    if sqlerrm like 'MoneyHub posted ledger records are immutable%' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'posted entry mutation was accepted';
  end if;

  -- Reversal must create a separate opposite journal and net balances to zero.
  v_reversal := public.moneyhub_reverse_journal(
    v_owner1,
    v_journal,
    'contract-reversal-1',
    'Reverse contract test',
    'corr-contract-reversal'
  );

  if v_reversal is null or v_reversal = v_journal then
    raise exception 'reversal did not create a distinct journal';
  end if;

  if (select source_type from public.moneyhub_journals where id = v_reversal) <> 'reversal' then
    raise exception 'reversal journal source_type is incorrect';
  end if;

  if (select source_ref from public.moneyhub_journals where id = v_reversal) <> v_journal::text then
    raise exception 'reversal journal source_ref does not point to original';
  end if;

  select balance into v_balance
  from public.moneyhub_account_balances
  where account_id = v_cash;
  if v_balance <> 0 then
    raise exception 'cash balance did not net to zero after reversal: %', v_balance;
  end if;

  select balance into v_balance
  from public.moneyhub_account_balances
  where account_id = v_revenue;
  if v_balance <> 0 then
    raise exception 'revenue balance did not net to zero after reversal: %', v_balance;
  end if;

  -- Client-facing roles must not be able to invoke financial mutation RPCs.
  if has_function_privilege(
    'authenticated',
    'public.moneyhub_post_journal(uuid,text,text,text,jsonb,text,text,text,text,timestamp with time zone,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated role unexpectedly has execute on moneyhub_post_journal';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.moneyhub_post_journal(uuid,text,text,text,jsonb,text,text,text,text,timestamp with time zone,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role is missing execute on moneyhub_post_journal';
  end if;
end
$$;

select 'MoneyHub ledger invariants: PASS' as result;

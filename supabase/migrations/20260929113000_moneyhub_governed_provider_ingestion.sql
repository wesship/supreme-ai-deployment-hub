-- MoneyHub governed normalized ingestion.
-- Backend/service-role only. No provider-side payment, transfer, lending, or brokerage execution.

create unique index if not exists ux_moneyhub_financial_sources_owner_provider
  on public.moneyhub_financial_sources(user_id, source_kind, provider);

create or replace function public.moneyhub_ingest_provider_batch(
  p_user_id uuid,
  p_source_kind text,
  p_provider text,
  p_cursor text default null,
  p_accounts jsonb default '[]'::jsonb,
  p_transactions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_id uuid;
  v_account jsonb;
  v_txn jsonb;
  v_account_id uuid;
  v_accounts_upserted integer := 0;
  v_transactions_inserted integer := 0;
  v_transactions_reconciled integer := 0;
  v_transactions_duplicate integer := 0;
  v_existing_status text;
  v_idempotency_key text;
begin
  if p_user_id is null then
    raise exception 'moneyhub_user_required' using errcode = '22023';
  end if;

  p_source_kind := lower(btrim(coalesce(p_source_kind, '')));
  p_provider := lower(btrim(coalesce(p_provider, '')));

  if p_source_kind not in ('bank','payment','accounting','brokerage','manual') then
    raise exception 'moneyhub_invalid_source_kind' using errcode = '22023';
  end if;
  if p_provider = '' or length(p_provider) > 80 then
    raise exception 'moneyhub_invalid_provider' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_accounts, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_transactions, '[]'::jsonb)) <> 'array' then
    raise exception 'moneyhub_invalid_batch' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_accounts, '[]'::jsonb)) > 200
     or jsonb_array_length(coalesce(p_transactions, '[]'::jsonb)) > 5000 then
    raise exception 'moneyhub_batch_too_large' using errcode = '22023';
  end if;

  insert into public.moneyhub_financial_sources (
    user_id, source_kind, provider, status, last_cursor, last_synced_at
  )
  values (p_user_id, p_source_kind, p_provider, 'active', p_cursor, now())
  on conflict (user_id, source_kind, provider)
  do update set
    status = 'active',
    last_cursor = excluded.last_cursor,
    last_synced_at = now(),
    updated_at = now()
  returning id into v_source_id;

  for v_account in select value from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb))
  loop
    if lower(btrim(coalesce(v_account->>'provider', ''))) <> p_provider then
      raise exception 'moneyhub_provider_mismatch' using errcode = '22023';
    end if;

    insert into public.moneyhub_financial_accounts (
      user_id, source_id, provider_account_id, account_name, account_type, currency,
      current_balance, available_balance, balance_observed_at, metadata, updated_at
    )
    values (
      p_user_id,
      v_source_id,
      btrim(v_account->>'provider_account_id'),
      nullif(v_account->>'account_name', ''),
      v_account->>'account_type',
      upper(coalesce(v_account->>'currency', 'USD')),
      nullif(v_account->>'current_balance', '')::numeric,
      nullif(v_account->>'available_balance', '')::numeric,
      nullif(v_account->>'balance_observed_at', '')::timestamptz,
      coalesce(v_account->'metadata', '{}'::jsonb),
      now()
    )
    on conflict (source_id, provider_account_id)
    do update set
      account_name = excluded.account_name,
      account_type = excluded.account_type,
      currency = excluded.currency,
      current_balance = excluded.current_balance,
      available_balance = excluded.available_balance,
      balance_observed_at = excluded.balance_observed_at,
      metadata = excluded.metadata,
      updated_at = now();

    v_accounts_upserted := v_accounts_upserted + 1;
  end loop;

  for v_txn in select value from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb))
  loop
    if lower(btrim(coalesce(v_txn->>'provider', ''))) <> p_provider then
      raise exception 'moneyhub_provider_mismatch' using errcode = '22023';
    end if;

    select id into v_account_id
    from public.moneyhub_financial_accounts
    where user_id = p_user_id
      and source_id = v_source_id
      and provider_account_id = btrim(v_txn->>'provider_account_id');

    if v_account_id is null then
      raise exception 'moneyhub_account_not_found' using errcode = 'P0002';
    end if;

    v_idempotency_key :=
      p_provider || ':' ||
      btrim(v_txn->>'provider_account_id') || ':' ||
      btrim(v_txn->>'provider_transaction_id');

    select status into v_existing_status
    from public.moneyhub_financial_transactions
    where user_id = p_user_id
      and idempotency_key = v_idempotency_key;

    if v_existing_status is null then
      insert into public.moneyhub_financial_transactions (
        user_id, account_id, provider, provider_transaction_id, idempotency_key,
        amount, currency, direction, status, occurred_at, posted_at, description,
        merchant, category, is_transfer, transfer_group_id, confidence, raw_metadata
      )
      values (
        p_user_id,
        v_account_id,
        p_provider,
        btrim(v_txn->>'provider_transaction_id'),
        v_idempotency_key,
        abs((v_txn->>'amount')::numeric),
        upper(coalesce(v_txn->>'currency', 'USD')),
        v_txn->>'direction',
        v_txn->>'status',
        (v_txn->>'occurred_at')::timestamptz,
        nullif(v_txn->>'posted_at', '')::timestamptz,
        nullif(v_txn->>'description', ''),
        nullif(v_txn->>'merchant', ''),
        nullif(v_txn->>'category', ''),
        coalesce((v_txn->>'is_transfer')::boolean, false),
        nullif(v_txn->>'transfer_group_id', ''),
        coalesce(v_txn->>'confidence', 'high'),
        coalesce(v_txn->'metadata', '{}'::jsonb)
      );
      v_transactions_inserted := v_transactions_inserted + 1;
    elsif v_existing_status = 'pending' and (v_txn->>'status') = 'posted' then
      update public.moneyhub_financial_transactions
      set
        account_id = v_account_id,
        amount = abs((v_txn->>'amount')::numeric),
        currency = upper(coalesce(v_txn->>'currency', 'USD')),
        direction = v_txn->>'direction',
        status = 'posted',
        occurred_at = (v_txn->>'occurred_at')::timestamptz,
        posted_at = nullif(v_txn->>'posted_at', '')::timestamptz,
        description = nullif(v_txn->>'description', ''),
        merchant = nullif(v_txn->>'merchant', ''),
        category = nullif(v_txn->>'category', ''),
        is_transfer = coalesce((v_txn->>'is_transfer')::boolean, false),
        transfer_group_id = nullif(v_txn->>'transfer_group_id', ''),
        confidence = coalesce(v_txn->>'confidence', 'high'),
        raw_metadata = coalesce(v_txn->'metadata', '{}'::jsonb),
        updated_at = now()
      where user_id = p_user_id and idempotency_key = v_idempotency_key;
      v_transactions_reconciled := v_transactions_reconciled + 1;
    else
      v_transactions_duplicate := v_transactions_duplicate + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'source_id', v_source_id,
    'accounts_upserted', v_accounts_upserted,
    'transactions_inserted', v_transactions_inserted,
    'transactions_reconciled', v_transactions_reconciled,
    'transactions_duplicate', v_transactions_duplicate,
    'cursor', p_cursor
  );
end;
$$;

revoke all on function public.moneyhub_ingest_provider_batch(uuid,text,text,text,jsonb,jsonb) from public;
revoke all on function public.moneyhub_ingest_provider_batch(uuid,text,text,text,jsonb,jsonb) from anon;
revoke all on function public.moneyhub_ingest_provider_batch(uuid,text,text,text,jsonb,jsonb) from authenticated;
grant execute on function public.moneyhub_ingest_provider_batch(uuid,text,text,text,jsonb,jsonb) to service_role;

comment on function public.moneyhub_ingest_provider_batch(uuid,text,text,text,jsonb,jsonb)
  is 'Service-role-only normalized ingestion. Idempotent transaction storage with pending-to-posted reconciliation; no money movement.';

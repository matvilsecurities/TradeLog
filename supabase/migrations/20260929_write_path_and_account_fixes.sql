-- TradeLog 2026-09-29: write-path and account-integrity fixes from the pre-launch audit.
--
--   TL-001  Edits were silently discarded: the operation-id "retry" shortcut ran for edits too.
--           It now applies to INSERTS only.
--   TL-004  SECURITY DEFINER upsert (`on conflict (id) do update`) could overwrite another
--           user's row when p_expected_updated_at was null. Insert and update are now separate
--           statements and an update ALWAYS requires `user_id = auth.uid()`.
--   TL-005  Drops the `default 'primary'` on account_id so a missing account is rejected by the
--           existing validation trigger instead of being silently filed under "primary".
--   TL-007  Adds an atomic account-delete RPC that refuses to orphan trades.
--
-- Apply AFTER 20260926_production_hardening_v2.sql. Test in staging first.
-- Function signatures are unchanged, so the existing client keeps working.

-- The 3-argument overload from hardening v1 is superseded; remove it so only one version exists.
drop function if exists public.tradelog_save_trade_with_mistakes(jsonb, text[], timestamptz);

-- ---------------------------------------------------------------------------
-- Trade save
-- ---------------------------------------------------------------------------
create or replace function public.tradelog_save_trade_with_mistakes(
  p_trade jsonb,
  p_mistakes text[] default '{}',
  p_expected_updated_at timestamptz default null,
  p_client_operation_id text default null
)
returns setof public.trades
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id text;
  v_account_uuid uuid;
  v_trade_id uuid;
  v_is_update boolean := false;
  v_current_updated_at timestamptz;
  v_keys text[];
  v_sql text;
  v_operation_id text := nullif(btrim(coalesce(p_client_operation_id, p_trade->>'client_operation_id')), '');
  v_quantity numeric;
  v_direction text;
  v_symbol text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_trade is null or jsonb_typeof(p_trade) <> 'object' then
    raise exception using errcode = '22023', message = 'Trade payload must be a JSON object.';
  end if;
  if v_operation_id is not null and length(v_operation_id) > 128 then
    raise exception using errcode = '22023', message = 'Client operation ID is too long.';
  end if;

  if nullif(trim(p_trade->>'id'), '') is not null then
    begin
      v_trade_id := (p_trade->>'id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Invalid trade ID.';
    end;
    v_is_update := true;
  end if;

  -- Idempotent retry: INSERTS only. (Applying this to edits made every edit a no-op.)
  if not v_is_update and v_operation_id is not null then
    select t.id into v_trade_id
    from public.trades t
    where t.user_id = v_user_id and t.client_operation_id = v_operation_id
    limit 1;
    if v_trade_id is not null then
      return query select t.* from public.trades t where t.id = v_trade_id and t.user_id = v_user_id;
      return;
    end if;
  end if;

  v_account_id := nullif(btrim(p_trade->>'account_id'), '');
  if v_account_id is null or v_account_id = '[object Object]' or length(v_account_id) > 200 then
    raise exception using errcode = '22023', message = 'Trade account could not be resolved to a valid account ID.';
  end if;
  if not exists (select 1 from public.accounts a where a.user_id = v_user_id and a.account_id = v_account_id) then
    raise exception using errcode = '42501', message = 'The selected trading account does not belong to the authenticated user.';
  end if;

  if nullif(trim(p_trade->>'account_uuid'), '') is not null then
    begin
      v_account_uuid := (p_trade->>'account_uuid')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Invalid account UUID.';
    end;
    if not exists (
      select 1 from public.accounts a
      where a.user_id = v_user_id and a.id = v_account_uuid and a.account_id = v_account_id
    ) then
      raise exception using errcode = '42501', message = 'The account UUID does not match the selected trading account.';
    end if;
  end if;

  v_direction := nullif(btrim(p_trade->>'direction'), '');
  if v_direction is null or v_direction not in ('Long', 'Short') then
    raise exception using errcode = '22023', message = 'Trade direction must be Long or Short.';
  end if;
  v_symbol := nullif(btrim(p_trade->>'symbol'), '');
  if v_symbol is null or length(v_symbol) > 32 then
    raise exception using errcode = '22023', message = 'A valid trade symbol is required.';
  end if;
  begin
    v_quantity := (p_trade->>'quantity')::numeric;
  exception when others then
    raise exception using errcode = '22023', message = 'Trade quantity must be numeric.';
  end;
  if v_quantity is null or v_quantity < 1 or v_quantity > 1000000 then
    raise exception using errcode = '22023', message = 'Trade quantity is outside the allowed range.';
  end if;
  if nullif(trim(p_trade->>'trade_date'), '') is null then
    raise exception using errcode = '22023', message = 'Trade date is required.';
  end if;

  -- Only accept payload keys that are real trades columns. Never let the client set ownership,
  -- the primary key, or creation time through the payload.
  select coalesce(array_agg(k order by k), '{}'::text[]) into v_keys
  from jsonb_object_keys(p_trade) as k
  where k not in ('user_id', 'id', 'client_operation_id', 'created_at')
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'trades' and c.column_name = k
    );

  if v_is_update then
    -- Ownership is ALWAYS enforced, whether or not an optimistic-lock timestamp was sent.
    select t.updated_at into v_current_updated_at
    from public.trades t
    where t.id = v_trade_id and t.user_id = v_user_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'Trade was not found or is not owned by this user.';
    end if;
    if p_expected_updated_at is not null and v_current_updated_at <> p_expected_updated_at then
      raise exception using errcode = '40001', message = 'This trade was changed elsewhere since it was loaded. Refresh and re-apply your edits before saving.';
    end if;

    if array_length(v_keys, 1) is null then
      update public.trades set updated_at = now() where id = v_trade_id and user_id = v_user_id;
    else
      v_sql := format(
        'update public.trades t set %s from jsonb_populate_record(null::public.trades, $1) r where t.id = $2 and t.user_id = $3',
        (select string_agg(format('%1$I = r.%1$I', k), ', ' order by k) from unnest(v_keys) as k)
      );
      execute v_sql using p_trade, v_trade_id, v_user_id;
    end if;
  else
    v_sql := format(
      'insert into public.trades (user_id, client_operation_id%s) select $2, $3%s from jsonb_populate_record(null::public.trades, $1) r returning id',
      case when array_length(v_keys, 1) is null then '' else ', ' || (select string_agg(quote_ident(k), ', ' order by k) from unnest(v_keys) as k) end,
      case when array_length(v_keys, 1) is null then '' else ', ' || (select string_agg(format('r.%I', k), ', ' order by k) from unnest(v_keys) as k) end
    );
    execute v_sql into v_trade_id using p_trade, v_user_id, v_operation_id;
  end if;

  if v_trade_id is null then
    raise exception using errcode = 'P0002', message = 'Trade was not saved.';
  end if;

  -- Ownership of v_trade_id is established above on both paths.
  delete from public.trade_mistakes where trade_id = v_trade_id;
  if p_mistakes is not null and cardinality(p_mistakes) > 0 then
    insert into public.trade_mistakes (trade_id, mistake_type)
    select v_trade_id, trim(mistake)
    from unnest(p_mistakes) as mistake
    where nullif(trim(mistake), '') is not null;
  end if;

  return query select t.* from public.trades t where t.id = v_trade_id and t.user_id = v_user_id;
exception
  when unique_violation then
    if not v_is_update and v_operation_id is not null then
      return query
        select t.* from public.trades t
        where t.user_id = v_user_id and t.client_operation_id = v_operation_id
        limit 1;
      if found then return; end if;
    end if;
    raise;
end;
$$;

revoke all on function public.tradelog_save_trade_with_mistakes(jsonb, text[], timestamptz, text) from public;
grant execute on function public.tradelog_save_trade_with_mistakes(jsonb, text[], timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Missed-trade save (same two fixes)
-- ---------------------------------------------------------------------------
create or replace function public.tradelog_save_missed_trade(
  p_trade jsonb,
  p_client_operation_id text default null
)
returns setof public.missed_trades
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation_id text := nullif(btrim(coalesce(p_client_operation_id, p_trade->>'client_operation_id')), '');
  v_account_id text;
  v_id bigint;
  v_is_update boolean := false;
  v_keys text[];
  v_sql text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_trade is null or jsonb_typeof(p_trade) <> 'object' then
    raise exception using errcode = '22023', message = 'Missed trade payload must be a JSON object.';
  end if;
  if v_operation_id is not null and length(v_operation_id) > 128 then
    raise exception using errcode = '22023', message = 'Client operation ID is too long.';
  end if;

  if nullif(trim(p_trade->>'id'), '') is not null then
    begin
      v_id := (p_trade->>'id')::bigint;
    exception when others then
      raise exception using errcode = '22023', message = 'Invalid missed trade ID.';
    end;
    v_is_update := true;
  end if;

  if not v_is_update and v_operation_id is not null then
    select m.id into v_id from public.missed_trades m
    where m.user_id = v_user_id and m.client_operation_id = v_operation_id limit 1;
    if v_id is not null then
      return query select m.* from public.missed_trades m where m.id = v_id and m.user_id = v_user_id;
      return;
    end if;
  end if;

  v_account_id := nullif(btrim(p_trade->>'account_id'), '');
  if v_account_id is null or v_account_id = '[object Object]' then
    raise exception using errcode = '22023', message = 'A valid trading account is required.';
  end if;
  if not exists (select 1 from public.accounts a where a.user_id = v_user_id and a.account_id = v_account_id) then
    raise exception using errcode = '42501', message = 'The selected trading account does not belong to this user.';
  end if;
  if nullif(trim(p_trade->>'trade_date'), '') is null then
    raise exception using errcode = '22023', message = 'Missed trade date is required.';
  end if;
  if nullif(trim(p_trade->>'direction'), '') is not null and (p_trade->>'direction') not in ('Long', 'Short') then
    raise exception using errcode = '22023', message = 'Missed trade direction must be Long or Short.';
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_keys
  from jsonb_object_keys(p_trade) as k
  where k not in ('user_id', 'id', 'client_operation_id', 'created_at', 'account_id')
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'missed_trades' and c.column_name = k
    );

  if v_is_update then
    perform 1 from public.missed_trades where id = v_id and user_id = v_user_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Missed trade was not found or is not owned by this user.';
    end if;
    v_sql := format(
      'update public.missed_trades m set account_id = $4%s from jsonb_populate_record(null::public.missed_trades, $1) r where m.id = $2 and m.user_id = $3',
      case when array_length(v_keys, 1) is null then '' else ', ' || (select string_agg(format('%1$I = r.%1$I', k), ', ' order by k) from unnest(v_keys) as k) end
    );
    execute v_sql using p_trade, v_id, v_user_id, v_account_id;
  else
    v_sql := format(
      'insert into public.missed_trades (user_id, account_id, client_operation_id%s) select $2, $3, $4%s from jsonb_populate_record(null::public.missed_trades, $1) r returning id',
      case when array_length(v_keys, 1) is null then '' else ', ' || (select string_agg(quote_ident(k), ', ' order by k) from unnest(v_keys) as k) end,
      case when array_length(v_keys, 1) is null then '' else ', ' || (select string_agg(format('r.%I', k), ', ' order by k) from unnest(v_keys) as k) end
    );
    execute v_sql into v_id using p_trade, v_user_id, v_account_id, v_operation_id;
  end if;

  return query select m.* from public.missed_trades m where m.id = v_id and m.user_id = v_user_id;
exception
  when unique_violation then
    if not v_is_update and v_operation_id is not null then
      return query select m.* from public.missed_trades m where m.user_id = v_user_id and m.client_operation_id = v_operation_id limit 1;
      if found then return; end if;
    end if;
    raise;
end;
$$;

revoke all on function public.tradelog_save_missed_trade(jsonb, text) from public;
grant execute on function public.tradelog_save_missed_trade(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic account delete. Refuses to touch accounts that still have trades: deleting must never
-- orphan history or move it into another account. Use archive for accounts with history.
-- ---------------------------------------------------------------------------
create or replace function public.tradelog_delete_account(p_account_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trades bigint;
  v_missed bigint := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_account_id is null or btrim(p_account_id) = '' or p_account_id = 'primary' then
    raise exception using errcode = '22023', message = 'This account cannot be deleted.';
  end if;
  if not exists (select 1 from public.accounts where user_id = v_user_id and account_id = p_account_id) then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;

  select count(*) into v_trades from public.trades where user_id = v_user_id and account_id = p_account_id;
  if to_regclass('public.missed_trades') is not null then
    select count(*) into v_missed from public.missed_trades where user_id = v_user_id and account_id = p_account_id;
  end if;
  if v_trades > 0 or v_missed > 0 then
    return jsonb_build_object('deleted', false, 'reason', 'has_trades', 'trade_count', v_trades, 'missed_trade_count', v_missed);
  end if;

  if to_regclass('public.broker_connections') is not null then
    delete from public.broker_connections where user_id = v_user_id and account_id = p_account_id;
  end if;
  if to_regclass('public.connector_sync_runs') is not null then
    delete from public.connector_sync_runs where user_id = v_user_id and account_id = p_account_id;
  end if;
  delete from public.accounts where user_id = v_user_id and account_id = p_account_id;
  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.tradelog_delete_account(text) from public;
grant execute on function public.tradelog_delete_account(text) to authenticated;

-- ---------------------------------------------------------------------------
-- TL-005: no silent default account. With the default gone, an insert that omits account_id
-- is rejected by tradelog_validate_account_reference instead of landing in "primary".
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.trades') is not null then
    alter table public.trades alter column account_id drop default;
  end if;
  if to_regclass('public.missed_trades') is not null then
    alter table public.missed_trades alter column account_id drop default;
  end if;
end $$;

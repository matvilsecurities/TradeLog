-- TradeLog Production Hardening v2
--
-- Adds the remaining production safeguards:
--   * idempotent trade/missed-trade writes
--   * server-side field validation
--   * account ownership triggers for direct table writes
--   * atomic DB deletes for trades/missed trades
--   * trade-image ownership/link integrity
--   * uniqueness constraints that make retries safe
--
-- This migration is intentionally additive/idempotent. Apply it after the
-- existing 20260926 production_hardening and scalability migrations.

-- ---------------------------------------------------------------------------
-- Idempotency columns + indexes
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.trades') is not null then
    alter table public.trades
      add column if not exists client_operation_id text;
    create unique index if not exists trades_user_client_operation_unique_idx
      on public.trades (user_id, client_operation_id)
      where client_operation_id is not null and client_operation_id <> '';
  end if;

  if to_regclass('public.missed_trades') is not null then
    alter table public.missed_trades
      add column if not exists client_operation_id text;
    create unique index if not exists missed_trades_user_client_operation_unique_idx
      on public.missed_trades (user_id, client_operation_id)
      where client_operation_id is not null and client_operation_id <> '';
  end if;

  if to_regclass('public.trade_images') is not null then
    create unique index if not exists trade_images_trade_type_unique_idx
      on public.trade_images (trade_id, image_type)
      where trade_id is not null;
    create unique index if not exists trade_images_missed_type_unique_idx
      on public.trade_images (missed_trade_id, image_type)
      where missed_trade_id is not null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Generic account ownership validation for direct table writes.
-- RLS protects row ownership; these triggers additionally ensure an owned row
-- cannot point at an account belonging to another user or a nonexistent one.
-- ---------------------------------------------------------------------------

create or replace function public.tradelog_validate_account_reference()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.account_id is null or btrim(new.account_id::text) = '' or new.account_id::text = '[object Object]' then
    raise exception using errcode = '22023', message = 'A valid trading account is required.';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.user_id = new.user_id
      and a.account_id = new.account_id::text
  ) then
    raise exception using errcode = '42501', message = 'The selected trading account does not belong to this user.';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.trades') is not null
     and to_regclass('public.accounts') is not null then
    drop trigger if exists trades_validate_account_reference on public.trades;
    create trigger trades_validate_account_reference
      before insert or update of user_id, account_id on public.trades
      for each row execute function public.tradelog_validate_account_reference();
  end if;

  if to_regclass('public.missed_trades') is not null
     and to_regclass('public.accounts') is not null then
    drop trigger if exists missed_trades_validate_account_reference on public.missed_trades;
    create trigger missed_trades_validate_account_reference
      before insert or update of user_id, account_id on public.missed_trades
      for each row execute function public.tradelog_validate_account_reference();
  end if;

  if to_regclass('public.broker_connections') is not null
     and to_regclass('public.accounts') is not null then
    drop trigger if exists broker_connections_validate_account_reference on public.broker_connections;
    create trigger broker_connections_validate_account_reference
      before insert or update of user_id, account_id on public.broker_connections
      for each row execute function public.tradelog_validate_account_reference();
  end if;

  if to_regclass('public.connector_sync_runs') is not null
     and to_regclass('public.accounts') is not null then
    drop trigger if exists connector_sync_runs_validate_account_reference on public.connector_sync_runs;
    create trigger connector_sync_runs_validate_account_reference
      before insert or update of user_id, account_id on public.connector_sync_runs
      for each row execute function public.tradelog_validate_account_reference();
  end if;

  if to_regclass('public.trade_executions') is not null
     and to_regclass('public.accounts') is not null then
    drop trigger if exists trade_executions_validate_account_reference on public.trade_executions;
    create trigger trade_executions_validate_account_reference
      before insert or update of user_id, account_id on public.trade_executions
      for each row execute function public.tradelog_validate_account_reference();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Trade-image link integrity. The row owner must also own the linked parent.
-- ---------------------------------------------------------------------------

create or replace function public.tradelog_validate_trade_image_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.trade_id is not null then
    if not exists (
      select 1 from public.trades t
      where t.id = new.trade_id and t.user_id = new.user_id
    ) then
      raise exception using errcode = '42501', message = 'Trade image is not linked to an owned trade.';
    end if;
  end if;

  if new.missed_trade_id is not null then
    if not exists (
      select 1 from public.missed_trades mt
      where mt.id = new.missed_trade_id and mt.user_id = new.user_id
    ) then
      raise exception using errcode = '42501', message = 'Trade image is not linked to an owned missed trade.';
    end if;
  end if;

  if new.trade_id is null and new.missed_trade_id is null then
    raise exception using errcode = '22023', message = 'Trade image must reference a trade or missed trade.';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.trade_images') is not null then
    drop trigger if exists trade_images_validate_parent on public.trade_images;
    create trigger trade_images_validate_parent
      before insert or update of user_id, trade_id, missed_trade_id on public.trade_images
      for each row execute function public.tradelog_validate_trade_image_link();
  end if;
end $$;

-- Ensure the screenshot bucket exists and is private. The Storage policies in
-- the previous hardening migration then enforce per-user object access.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('trade-images', 'trade-images', false)
    on conflict (id) do update set public = false;
    update storage.buckets
    set public = false,
        file_size_limit = 10485760,
        allowed_mime_types = array['image/png','image/jpeg','image/webp']::text[]
    where id = 'trade-images';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Atomic trade save with idempotency + validation.
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
  v_current_updated_at timestamptz;
  v_keys text[];
  v_insert_columns text;
  v_select_columns text;
  v_update_set text;
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

  -- A retry with the same operation ID returns the original row instead of
  -- creating a duplicate trade.
  if v_operation_id is not null then
    select t.id into v_trade_id
    from public.trades t
    where t.user_id = v_user_id
      and t.client_operation_id = v_operation_id
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

  if not exists (
    select 1 from public.accounts a
    where a.user_id = v_user_id and a.account_id = v_account_id
  ) then
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
      where a.user_id = v_user_id
        and a.id = v_account_uuid
        and a.account_id = v_account_id
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

  if nullif(trim(p_trade->>'id'), '') is not null then
    begin
      v_trade_id := (p_trade->>'id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Invalid trade ID.';
    end;
  end if;

  if v_trade_id is not null and p_expected_updated_at is not null then
    select t.updated_at into v_current_updated_at
    from public.trades t
    where t.id = v_trade_id and t.user_id = v_user_id
    for update;

    if v_current_updated_at is null then
      raise exception using errcode = 'P0002', message = 'Trade was not found or is no longer owned by this user.';
    end if;

    if v_current_updated_at <> p_expected_updated_at then
      raise exception using errcode = '40001', message = 'This trade was changed elsewhere since it was loaded. Refresh and re-apply your edits before saving.';
    end if;
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_keys
  from jsonb_object_keys(p_trade) as k
  where k <> 'user_id'
    and k <> 'client_operation_id'
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'trades' and c.column_name = k
    );

  v_insert_columns := 'user_id';
  v_select_columns := 'auth.uid()';

  if v_operation_id is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'client_operation_id'
  ) then
    v_insert_columns := v_insert_columns || ', client_operation_id';
    v_select_columns := v_select_columns || ', $2';
  end if;

  if array_length(v_keys, 1) is not null then
    v_insert_columns := v_insert_columns || ', ' || array_to_string(array(select quote_ident(k) from unnest(v_keys) as k), ', ');
    v_select_columns := v_select_columns || ', ' || array_to_string(array(select format('r.%I', k) from unnest(v_keys) as k), ', ');
  end if;

  select string_agg(format('%1$I = excluded.%1$I', k), ', ' order by k)
    into v_update_set
  from unnest(v_keys) as k
  where k <> 'id' and k <> 'user_id' and k <> 'client_operation_id';

  if v_trade_id is null then
    v_sql := format(
      'insert into public.trades (%s)
       select %s
       from jsonb_populate_record(null::public.trades, $1) r
       returning id',
      v_insert_columns, v_select_columns
    );
  else
    if v_update_set is null or v_update_set = '' then
      v_update_set := 'updated_at = now()';
    end if;
    v_sql := format(
      'insert into public.trades (%s)
       select %s
       from jsonb_populate_record(null::public.trades, $1) r
       on conflict (id) do update set %s
       returning id',
      v_insert_columns, v_select_columns, v_update_set
    );
  end if;

  if v_operation_id is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'client_operation_id'
  ) then
    execute v_sql into v_trade_id using p_trade, v_operation_id;
  else
    execute v_sql into v_trade_id using p_trade;
  end if;

  if v_trade_id is null then
    raise exception using errcode = 'P0002', message = 'Trade was not saved.';
  end if;

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
    -- Concurrent identical operation: return the already-created row.
    if v_operation_id is not null then
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
-- Atomic missed-trade save with idempotency.
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
  v_keys text[];
  v_columns text;
  v_values text;
  v_updates text;
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

  if v_operation_id is not null then
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
  if nullif(trim(p_trade->>'direction'), '') is not null
     and (p_trade->>'direction') not in ('Long', 'Short') then
    raise exception using errcode = '22023', message = 'Missed trade direction must be Long or Short.';
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_keys
  from jsonb_object_keys(p_trade) as k
  where k <> 'user_id'
    and k <> 'client_operation_id'
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'missed_trades' and c.column_name = k
    );

  v_columns := 'user_id, account_id';
  v_values := 'auth.uid(), $2';
  if v_operation_id is not null then
    v_columns := v_columns || ', client_operation_id';
    v_values := v_values || ', $3';
  end if;

  if array_length(v_keys, 1) is not null then
    v_columns := v_columns || ', ' || array_to_string(array(select quote_ident(k) from unnest(v_keys) as k), ', ');
    v_values := v_values || ', ' || array_to_string(array(select format('r.%I', k) from unnest(v_keys) as k), ', ');
  end if;

  select string_agg(format('%1$I = excluded.%1$I', k), ', ' order by k)
    into v_updates
  from unnest(v_keys) as k
  where k <> 'id' and k <> 'user_id' and k <> 'account_id' and k <> 'client_operation_id';

  if v_updates is null or v_updates = '' then v_updates := 'account_id = excluded.account_id'; end if;

  v_sql := format(
    'insert into public.missed_trades (%s)
     select %s from jsonb_populate_record(null::public.missed_trades, $1) r
     on conflict (id) do update set %s
     returning id',
    v_columns, v_values, v_updates
  );

  if v_operation_id is not null then
    execute v_sql into v_id using p_trade, v_account_id, v_operation_id;
  else
    execute v_sql into v_id using p_trade, v_account_id;
  end if;

  return query select m.* from public.missed_trades m where m.id = v_id and m.user_id = v_user_id;
exception
  when unique_violation then
    if v_operation_id is not null then
      return query select m.* from public.missed_trades m where m.user_id = v_user_id and m.client_operation_id = v_operation_id limit 1;
      if found then return; end if;
    end if;
    raise;
end;
$$;

revoke all on function public.tradelog_save_missed_trade(jsonb, text) from public;
grant execute on function public.tradelog_save_missed_trade(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic deletes. Storage files are intentionally cleaned up by the client
-- after the DB transaction succeeds; a Storage failure can then be retried
-- without resurrecting deleted trading data.
-- ---------------------------------------------------------------------------

create or replace function public.tradelog_delete_trade(p_trade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_paths text[] := '{}';
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  if not exists (select 1 from public.trades where id = p_trade_id and user_id = v_user_id) then
    return jsonb_build_object('deleted', false, 'storage_paths', '[]'::jsonb);
  end if;
  select coalesce(array_agg(storage_path) filter (where storage_path is not null), '{}')
    into v_paths
  from public.trade_images
  where trade_id = p_trade_id and user_id = v_user_id;
  delete from public.trade_mistakes where trade_id = p_trade_id;
  delete from public.trades where id = p_trade_id and user_id = v_user_id;
  return jsonb_build_object('deleted', true, 'storage_paths', to_jsonb(v_paths));
end;
$$;
revoke all on function public.tradelog_delete_trade(uuid) from public;
grant execute on function public.tradelog_delete_trade(uuid) to authenticated;

create or replace function public.tradelog_delete_missed_trade(p_trade_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_paths text[] := '{}';
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  if not exists (select 1 from public.missed_trades where id = p_trade_id and user_id = v_user_id) then
    return jsonb_build_object('deleted', false, 'storage_paths', '[]'::jsonb);
  end if;
  select coalesce(array_agg(storage_path) filter (where storage_path is not null), '{}')
    into v_paths
  from public.trade_images
  where missed_trade_id = p_trade_id and user_id = v_user_id;
  delete from public.missed_trades where id = p_trade_id and user_id = v_user_id;
  return jsonb_build_object('deleted', true, 'storage_paths', to_jsonb(v_paths));
end;
$$;
revoke all on function public.tradelog_delete_missed_trade(bigint) from public;
grant execute on function public.tradelog_delete_missed_trade(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Direct-write validation on core numeric fields. This protects paths that do
-- not use the RPC (imports/connectors) from obviously invalid data.
-- ---------------------------------------------------------------------------

create or replace function public.tradelog_validate_trade_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.direction is null or new.direction not in ('Long', 'Short') then
    raise exception using errcode = '22023', message = 'Trade direction must be Long or Short.';
  end if;
  if new.quantity is null or new.quantity < 1 or new.quantity > 1000000 then
    raise exception using errcode = '22023', message = 'Trade quantity is outside the allowed range.';
  end if;
  if new.symbol is null or btrim(new.symbol::text) = '' or length(new.symbol::text) > 32 then
    raise exception using errcode = '22023', message = 'A valid trade symbol is required.';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.trades') is not null then
    drop trigger if exists trades_validate_fields on public.trades;
    create trigger trades_validate_fields
      before insert or update of direction, quantity, symbol on public.trades
      for each row execute function public.tradelog_validate_trade_fields();
  end if;
end $$;

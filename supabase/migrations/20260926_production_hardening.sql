-- TradeLog Production Hardening: atomic trade writes + server-side ownership.

create or replace function public.tradelog_save_trade_with_mistakes(
  p_trade jsonb,
  p_mistakes text[] default '{}',
  p_expected_updated_at timestamptz default null
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
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_trade is null or jsonb_typeof(p_trade) <> 'object' then
    raise exception using errcode = '22023', message = 'Trade payload must be a JSON object.';
  end if;

  v_account_id := nullif(trim(p_trade->>'account_id'), '');
  if v_account_id is null or v_account_id = '[object Object]' then
    raise exception using errcode = '22023', message = 'Trade account could not be resolved to a valid account ID.';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.user_id = v_user_id and a.account_id = v_account_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'The selected trading account does not belong to the authenticated user.';
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
      raise exception using
        errcode = '42501',
        message = 'The account UUID does not match the selected trading account.';
    end if;
  end if;

  if nullif(trim(p_trade->>'id'), '') is not null then
    begin
      v_trade_id := (p_trade->>'id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Invalid trade ID.';
    end;
  end if;

  -- The concurrency check and write are in the same transaction.
  if v_trade_id is not null and p_expected_updated_at is not null then
    select t.updated_at into v_current_updated_at
    from public.trades t
    where t.id = v_trade_id and t.user_id = v_user_id
    for update;

    if v_current_updated_at is null then
      raise exception using
        errcode = 'P0002',
        message = 'Trade was not found or is no longer owned by this user.';
    end if;

    if v_current_updated_at <> p_expected_updated_at then
      raise exception using
        errcode = '40001',
        message = 'This trade was changed elsewhere since it was loaded. Refresh and re-apply your edits before saving.';
    end if;
  end if;

  -- Only accept payload keys that are actual trades columns. This keeps the
  -- RPC compatible with optional live-capture columns in mixed environments.
  select coalesce(array_agg(k order by k), '{}'::text[]) into v_keys
  from jsonb_object_keys(p_trade) as k
  where k <> 'user_id'
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'trades'
        and c.column_name = k
    );

  v_insert_columns := 'user_id';
  v_select_columns := 'auth.uid()';

  if array_length(v_keys, 1) is not null then
    v_insert_columns := v_insert_columns || ', ' || array_to_string(
      array(select quote_ident(k) from unnest(v_keys) as k), ', '
    );
    v_select_columns := v_select_columns || ', ' || array_to_string(
      array(select format('r.%I', k) from unnest(v_keys) as k), ', '
    );
  end if;

  select string_agg(format('%1$I = excluded.%1$I', k), ', ' order by k)
    into v_update_set
  from unnest(v_keys) as k
  where k <> 'id' and k <> 'user_id';

  if v_trade_id is null then
    v_sql := format(
      'insert into public.trades (%s)
       select %s
       from jsonb_populate_record(null::public.trades, $1)
       returning id',
      v_insert_columns, v_select_columns
    );
  else
    if v_update_set is null or v_update_set = '' then
      v_update_set := 'updated_at = excluded.updated_at';
    end if;

    v_sql := format(
      'insert into public.trades (%s)
       select %s
       from jsonb_populate_record(null::public.trades, $1)
       on conflict (id) do update set %s
       returning id',
      v_insert_columns, v_select_columns, v_update_set
    );
  end if;

  execute v_sql into v_trade_id using p_trade;

  if v_trade_id is null then
    raise exception using errcode = 'P0002', message = 'Trade was not saved.';
  end if;

  -- Mistake replacement is part of the same transaction. A failure rolls
  -- back the trade write too.
  delete from public.trade_mistakes where trade_id = v_trade_id;

  if p_mistakes is not null and cardinality(p_mistakes) > 0 then
    insert into public.trade_mistakes (trade_id, mistake_type)
    select v_trade_id, trim(mistake)
    from unnest(p_mistakes) as mistake
    where nullif(trim(mistake), '') is not null;
  end if;

  return query
    select t.* from public.trades t
    where t.id = v_trade_id and t.user_id = v_user_id;
end;
$$;

revoke all on function public.tradelog_save_trade_with_mistakes(jsonb, text[], timestamptz) from public;
grant execute on function public.tradelog_save_trade_with_mistakes(jsonb, text[], timestamptz) to authenticated;

-- Keep trade screenshots private and restrict object access to the first path
-- segment, which is always the authenticated user's UUID in TradeLog.
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'SKIP: storage.objects does not exist.';
    return;
  end if;

  update storage.buckets set public = false where id = 'trade-images';

  drop policy if exists tradelog_trade_images_select_own on storage.objects;
  create policy tradelog_trade_images_select_own
    on storage.objects for select to authenticated
    using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);

  drop policy if exists tradelog_trade_images_insert_own on storage.objects;
  create policy tradelog_trade_images_insert_own
    on storage.objects for insert to authenticated
    with check (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);

  drop policy if exists tradelog_trade_images_update_own on storage.objects;
  create policy tradelog_trade_images_update_own
    on storage.objects for update to authenticated
    using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);

  drop policy if exists tradelog_trade_images_delete_own on storage.objects;
  create policy tradelog_trade_images_delete_own
    on storage.objects for delete to authenticated
    using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);
end $$;

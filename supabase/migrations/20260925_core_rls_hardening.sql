-- TradeLog: verify/enforce row level security on every core table, and add
-- the updated_at plumbing needed for optimistic-concurrency checks on trades.
--
-- WHY THIS MIGRATION EXISTS
-- The tables `trades`, `trade_mistakes`, `trade_images`, `account_settings`,
-- and `missed_trades` are referenced throughout src/supabase.js but their
-- CREATE TABLE statements are not present in this migrations folder -- they
-- must have been created by an earlier, unincluded migration. Every query in
-- the app filters by `.eq("user_id", userId)` client-side, but that is a
-- convenience filter only, NOT a security boundary: the anon key used by the
-- browser is public. If row level security is not actually enabled on any of
-- these tables, any signed-in user can bypass the client-side filter entirely
-- (e.g. from devtools) and read or write every other user's data.
--
-- This migration is idempotent and safe to run even if RLS is already
-- correctly configured -- it only (re)asserts owner-only policies and skips
-- any table that doesn't exist in this database yet. Run it in the Supabase
-- SQL Editor and read the NOTICEs it prints; each one tells you exactly what
-- state that table was found in.

do $$
declare
  tbl text;
  has_user_id boolean;
begin
  foreach tbl in array array['trades', 'trade_images', 'account_settings', 'missed_trades'] loop
    if to_regclass('public.' || tbl) is null then
      raise notice 'SKIP: public.% does not exist in this database.', tbl;
      continue;
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'user_id'
    ) into has_user_id;

    if not has_user_id then
      raise notice 'SKIP: public.% has no user_id column -- cannot apply an owner-only policy automatically.', tbl;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    execute format('drop policy if exists %I on public.%I', tbl || '_select_own', tbl);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      tbl || '_select_own', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_insert_own', tbl);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      tbl || '_insert_own', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_update_own', tbl);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      tbl || '_update_own', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_delete_own', tbl);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      tbl || '_delete_own', tbl
    );

    raise notice 'OK: public.% now has RLS enabled with owner-only select/insert/update/delete policies.', tbl;
  end loop;
end $$;

-- trade_mistakes has no user_id column of its own (it only carries trade_id +
-- mistake_type), so ownership has to be checked by joining back to the parent
-- trade's user_id instead of a direct column comparison.
do $$
begin
  if to_regclass('public.trade_mistakes') is null then
    raise notice 'SKIP: public.trade_mistakes does not exist in this database.';
    return;
  end if;

  if to_regclass('public.trades') is null then
    raise notice 'SKIP: public.trade_mistakes RLS needs public.trades to exist for the ownership join.';
    return;
  end if;

  alter table public.trade_mistakes enable row level security;

  drop policy if exists trade_mistakes_select_own on public.trade_mistakes;
  create policy trade_mistakes_select_own
    on public.trade_mistakes for select
    using (exists (
      select 1 from public.trades t
      where t.id = trade_mistakes.trade_id and t.user_id = auth.uid()
    ));

  drop policy if exists trade_mistakes_insert_own on public.trade_mistakes;
  create policy trade_mistakes_insert_own
    on public.trade_mistakes for insert
    with check (exists (
      select 1 from public.trades t
      where t.id = trade_mistakes.trade_id and t.user_id = auth.uid()
    ));

  drop policy if exists trade_mistakes_update_own on public.trade_mistakes;
  create policy trade_mistakes_update_own
    on public.trade_mistakes for update
    using (exists (
      select 1 from public.trades t
      where t.id = trade_mistakes.trade_id and t.user_id = auth.uid()
    ))
    with check (exists (
      select 1 from public.trades t
      where t.id = trade_mistakes.trade_id and t.user_id = auth.uid()
    ));

  drop policy if exists trade_mistakes_delete_own on public.trade_mistakes;
  create policy trade_mistakes_delete_own
    on public.trade_mistakes for delete
    using (exists (
      select 1 from public.trades t
      where t.id = trade_mistakes.trade_id and t.user_id = auth.uid()
    ));

  raise notice 'OK: public.trade_mistakes now has RLS enabled, scoped via its parent trade''s user_id.';
end $$;

-- ─────────────────────────────────────────────────────────────
-- Optimistic concurrency: add updated_at to trades + auto-touch trigger.
-- ─────────────────────────────────────────────────────────────
-- src/supabase.js now compares a trade's updated_at (loaded with the record)
-- against the current value immediately before saving an edit, so two tabs or
-- devices editing the same trade get a clear conflict error instead of one
-- silently overwriting the other with no warning.

do $$
begin
  if to_regclass('public.trades') is null then
    raise notice 'SKIP: public.trades does not exist -- cannot add updated_at.';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'updated_at'
  ) then
    alter table public.trades add column updated_at timestamptz not null default now();
    raise notice 'OK: public.trades.updated_at added.';
  end if;
end $$;

create or replace function public.tradelog_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.trades') is not null then
    drop trigger if exists trades_touch_updated_at on public.trades;
    create trigger trades_touch_updated_at
      before update on public.trades
      for each row execute function public.tradelog_touch_updated_at();
  end if;
end $$;

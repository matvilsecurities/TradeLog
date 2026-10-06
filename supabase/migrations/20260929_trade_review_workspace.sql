-- TradeLog Trade Review workspace persistence.
-- Stores one review record per journaled trade, including review state and notes.
-- Apply after the core trades table exists.

create table if not exists public.trade_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id text not null,
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','needs_follow_up')),
  notes text not null default '',
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, trade_id)
);

create index if not exists idx_trade_reviews_user_status_updated
  on public.trade_reviews(user_id, review_status, updated_at desc);
create index if not exists idx_trade_reviews_user_trade
  on public.trade_reviews(user_id, trade_id);

alter table public.trade_reviews enable row level security;

 drop policy if exists "trade_reviews_select_own" on public.trade_reviews;
create policy "trade_reviews_select_own"
  on public.trade_reviews for select
  using (user_id = auth.uid());

 drop policy if exists "trade_reviews_insert_own_trade" on public.trade_reviews;
create policy "trade_reviews_insert_own_trade"
  on public.trade_reviews for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.trades t
      where t.id::text = trade_id and t.user_id = auth.uid()
    )
  );

 drop policy if exists "trade_reviews_update_own" on public.trade_reviews;
create policy "trade_reviews_update_own"
  on public.trade_reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

 drop policy if exists "trade_reviews_delete_own" on public.trade_reviews;
create policy "trade_reviews_delete_own"
  on public.trade_reviews for delete
  using (user_id = auth.uid());

create or replace function public.tradelog_touch_trade_review_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_trade_reviews_updated_at on public.trade_reviews;
create trigger trg_trade_reviews_updated_at
before update on public.trade_reviews
for each row execute function public.tradelog_touch_trade_review_updated_at();

comment on table public.trade_reviews is 'Per-trade review status and review notes for TradeLog.';
comment on column public.trade_reviews.notes is 'Trader review notes stored server-side; never treated as business account state.';

-- Extend the production schema gate so the review workspace cannot silently
-- ship without its persistent review store.
create or replace function public.tradelog_verify_release_schema()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_required_tables text[] := array['accounts','trades','missed_trades','trade_mistakes','trade_images','account_settings','trade_executions','broker_connections','connector_sync_runs','trade_reviews'];
  v_table text;
  v_checks jsonb := '{}'::jsonb;
  v_ok boolean := true;
  v_present boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  foreach v_table in array v_required_tables loop
    v_present := to_regclass('public.' || v_table) is not null;
    v_checks := v_checks || jsonb_build_object('table:' || v_table, v_present);
    if not v_present then v_ok := false; end if;
  end loop;

  v_checks := v_checks || jsonb_build_object(
    'function:tradelog_save_trade_with_mistakes', to_regprocedure('public.tradelog_save_trade_with_mistakes(jsonb,text[],timestamptz,text)') is not null,
    'function:tradelog_save_missed_trade', to_regprocedure('public.tradelog_save_missed_trade(jsonb,text)') is not null,
    'function:tradelog_delete_trade', to_regprocedure('public.tradelog_delete_trade(uuid)') is not null,
    'function:tradelog_delete_missed_trade', to_regprocedure('public.tradelog_delete_missed_trade(bigint)') is not null,
    'function:tradelog_delete_account', to_regprocedure('public.tradelog_delete_account(text)') is not null,
    'function:tradelog_dashboard_summary', to_regprocedure('public.tradelog_dashboard_summary(text,text[],text,date,date)') is not null,
    'rls:trades', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname='trades'), false),
    'rls:accounts', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname='accounts'), false),
    'rls:trade_reviews', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname='trade_reviews'), false),
    'index:trade_reviews_user_status_updated', exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_trade_reviews_user_status_updated'),
    'index:trade_reviews_user_trade', exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_trade_reviews_user_trade'),
    'index:trades_user_trade_date', exists(select 1 from pg_indexes where schemaname='public' and indexname='trades_user_trade_date_id_idx'),
    'index:trades_user_account_trade_date', exists(select 1 from pg_indexes where schemaname='public' and indexname='trades_user_account_trade_date_id_idx')
  );

  if not (v_checks->>'function:tradelog_save_trade_with_mistakes')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_save_missed_trade')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_delete_trade')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_delete_missed_trade')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_delete_account')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_dashboard_summary')::boolean then v_ok := false; end if;
  if not (v_checks->>'rls:trades')::boolean or not (v_checks->>'rls:accounts')::boolean or not (v_checks->>'rls:trade_reviews')::boolean then v_ok := false; end if;
  if not (v_checks->>'index:trade_reviews_user_status_updated')::boolean or not (v_checks->>'index:trade_reviews_user_trade')::boolean then v_ok := false; end if;

  return jsonb_build_object('ok', v_ok, 'checks', v_checks, 'checkedAt', now());
end;
$$;

revoke all on function public.tradelog_verify_release_schema() from public;
grant execute on function public.tradelog_verify_release_schema() to authenticated;

-- TradeLog Trading Plan -> Trade Log integration.
-- New trades may point to the plan that was active on their trade date.
-- A compact JSON snapshot preserves the plan as it existed when the trade was logged.

alter table public.trades
  add column if not exists trading_plan_id uuid references public.trading_plans(id) on delete set null,
  add column if not exists trading_plan_snapshot jsonb;

create index if not exists idx_trades_trading_plan_id
  on public.trades(trading_plan_id)
  where trading_plan_id is not null;

create or replace function public.tradelog_verify_trading_plan_schema()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_table boolean := to_regclass('public.trading_plans') is not null;
  v_rls boolean := coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname='trading_plans'), false);
  v_index boolean := exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_trading_plans_user_date');
  v_policies integer := (select count(*) from pg_policies where schemaname='public' and tablename='trading_plans');
  v_plan_link boolean := exists(select 1 from information_schema.columns where table_schema='public' and table_name='trades' and column_name='trading_plan_id');
  v_plan_snapshot boolean := exists(select 1 from information_schema.columns where table_schema='public' and table_name='trades' and column_name='trading_plan_snapshot');
  v_plan_checklist boolean := exists(select 1 from information_schema.columns where table_schema='public' and table_name='trading_plans' and column_name='setup_checklist');
  v_link_index boolean := exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_trades_trading_plan_id');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  return jsonb_build_object(
    'ok', v_table and v_rls and v_index and v_policies >= 4 and v_plan_link and v_plan_snapshot and v_link_index and v_plan_checklist,
    'checks', jsonb_build_object(
      'table:trading_plans', v_table,
      'rls:trading_plans', v_rls,
      'index:trading_plans_user_date', v_index,
      'policies:trading_plans', v_policies,
      'column:trades.trading_plan_id', v_plan_link,
      'column:trades.trading_plan_snapshot', v_plan_snapshot,
      'column:trading_plans.setup_checklist', v_plan_checklist,
      'index:trades_trading_plan_id', v_link_index
    ),
    'checkedAt', now()
  );
end;
$$;

revoke all on function public.tradelog_verify_trading_plan_schema() from public;
grant execute on function public.tradelog_verify_trading_plan_schema() to authenticated;

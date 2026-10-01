-- TradeLog Trading Plan persistence.
-- One user-owned daily plan per calendar date.

create table if not exists public.trading_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  market_bias text,
  key_levels text not null default '',
  setup_focus text not null default '',
  max_risk numeric(14,2) not null default 300,
  max_trades integer not null default 3,
  news_focus text not null default '',
  notes text not null default '',
  rules_confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, plan_date),
  check (max_risk >= 0),
  check (max_trades >= 0)
);

create index if not exists idx_trading_plans_user_date
  on public.trading_plans(user_id, plan_date desc);

alter table public.trading_plans enable row level security;

drop policy if exists "trading_plans_select_own" on public.trading_plans;
create policy "trading_plans_select_own"
  on public.trading_plans for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "trading_plans_insert_own" on public.trading_plans;
create policy "trading_plans_insert_own"
  on public.trading_plans for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "trading_plans_update_own" on public.trading_plans;
create policy "trading_plans_update_own"
  on public.trading_plans for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "trading_plans_delete_own" on public.trading_plans;
create policy "trading_plans_delete_own"
  on public.trading_plans for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.trading_plans to authenticated;

create or replace function public.tradelog_touch_trading_plan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_trading_plans_updated_at on public.trading_plans;
create trigger trg_trading_plans_updated_at
before update on public.trading_plans
for each row execute function public.tradelog_touch_trading_plan_updated_at();

comment on table public.trading_plans is 'User-owned daily trading plans for TradeLog.';

-- Explicit Trading Plan schema gate used by release QA.
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
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  return jsonb_build_object(
    'ok', v_table and v_rls and v_index and v_policies >= 4,
    'checks', jsonb_build_object(
      'table:trading_plans', v_table,
      'rls:trading_plans', v_rls,
      'index:trading_plans_user_date', v_index,
      'policies:trading_plans', v_policies
    ),
    'checkedAt', now()
  );
end;
$$;

revoke all on function public.tradelog_verify_trading_plan_schema() from public;
grant execute on function public.tradelog_verify_trading_plan_schema() to authenticated;

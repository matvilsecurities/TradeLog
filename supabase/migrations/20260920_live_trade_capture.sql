-- TradeLog Phase 39: durable execution ledger for live auto-journaling.

alter table public.trades
  add column if not exists capture_status text,
  add column if not exists execution_ids jsonb not null default '[]'::jsonb,
  add column if not exists execution_count integer not null default 0,
  add column if not exists live_trade_key text;

create index if not exists trades_live_trade_key_idx
  on public.trades (user_id, live_trade_key)
  where live_trade_key is not null;
-- Run once in Supabase SQL Editor after the Phase 25 connector migration.

create table if not exists public.trade_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null default 'primary',
  connector_id text not null,
  external_execution_id text not null,
  external_order_id text,
  external_account_id text,
  symbol text,
  action text,
  quantity numeric not null default 0,
  price numeric,
  event_time timestamptz not null default now(),
  journal_trade_id uuid,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, connector_id, external_execution_id)
);

create index if not exists trade_executions_user_account_time_idx
  on public.trade_executions (user_id, account_id, event_time desc);

create index if not exists trade_executions_journal_idx
  on public.trade_executions (user_id, journal_trade_id, event_time asc);

alter table public.trade_executions enable row level security;

drop policy if exists trade_executions_select_own on public.trade_executions;
create policy trade_executions_select_own
  on public.trade_executions for select
  using (auth.uid() = user_id);

drop policy if exists trade_executions_insert_own on public.trade_executions;
create policy trade_executions_insert_own
  on public.trade_executions for insert
  with check (auth.uid() = user_id);

drop policy if exists trade_executions_update_own on public.trade_executions;
create policy trade_executions_update_own
  on public.trade_executions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists trade_executions_delete_own on public.trade_executions;
create policy trade_executions_delete_own
  on public.trade_executions for delete
  using (auth.uid() = user_id);

-- TradeLog Phase 25: durable multi-account + connector persistence.
-- Run once in Supabase SQL Editor against the TradeLog project.

alter table public.trades
  add column if not exists account_id text default 'primary',
  add column if not exists external_trade_id text,
  add column if not exists external_account_id text,
  add column if not exists connector_id text,
  add column if not exists source text;

update public.trades
set account_id = 'primary'
where account_id is null;

create index if not exists trades_user_account_idx
  on public.trades (user_id, account_id, trade_date desc);

create index if not exists trades_connector_external_idx
  on public.trades (user_id, connector_id, external_trade_id)
  where external_trade_id is not null;

create unique index if not exists trades_connector_external_unique_idx
  on public.trades (user_id, connector_id, external_trade_id)
  where external_trade_id is not null;

create table if not exists public.broker_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  connector_id text not null,
  status text not null default 'disconnected',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id, connector_id)
);

create index if not exists broker_connections_user_account_idx
  on public.broker_connections (user_id, account_id);

alter table public.broker_connections enable row level security;

drop policy if exists "Users can read own broker connections" on public.broker_connections;
drop policy if exists "Users can insert own broker connections" on public.broker_connections;
drop policy if exists "Users can update own broker connections" on public.broker_connections;
drop policy if exists "Users can delete own broker connections" on public.broker_connections;

create policy "Users can read own broker connections"
  on public.broker_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own broker connections"
  on public.broker_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own broker connections"
  on public.broker_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own broker connections"
  on public.broker_connections for delete
  using (auth.uid() = user_id);

-- The existing trades RLS remains authoritative. This index/column migration
-- does not broaden access to another user's trades.

-- TradeLog Foundation: authoritative multi-account persistence.
-- Run this migration BEFORE using the updated account portfolio code.
-- It is intentionally additive and does not delete existing account_settings data.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  name text not null default 'Trading Account',
  status text not null default 'active',
  stage text not null default 'evaluation',
  account_number text,
  prop_firm_id text,
  prop_program_id text,
  platform text,
  market text,
  vendor text,
  account_size numeric,
  timezone text not null default 'Asia/Kolkata',
  settings jsonb not null default '{}'::jsonb,
  rule_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (user_id, account_id)
);

create index if not exists accounts_user_status_idx
  on public.accounts (user_id, status, created_at);

create index if not exists accounts_user_firm_idx
  on public.accounts (user_id, prop_firm_id, prop_program_id);

alter table public.accounts enable row level security;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
  on public.accounts for select
  using (auth.uid() = user_id);

drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own
  on public.accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists accounts_delete_own on public.accounts;
create policy accounts_delete_own
  on public.accounts for delete
  using (auth.uid() = user_id);

-- Backfill the legacy primary account. The existing account_settings row is
-- still retained for compatibility with the current settings UI and older data.
insert into public.accounts (
  user_id,
  account_id,
  name,
  status,
  stage,
  account_number,
  platform,
  account_size,
  timezone,
  settings
)
select
  s.user_id,
  'primary',
  coalesce(nullif(s.account_name, ''), 'Primary Trading Account'),
  'active',
  'evaluation',
  null,
  s.platform,
  s.account_size,
  'Asia/Kolkata',
  jsonb_build_object(
    'accountName', coalesce(nullif(s.account_name, ''), 'Primary Trading Account'),
    'platform', s.platform,
    'accountSize', s.account_size,
    'maxDrawdown', s.max_trailing_drawdown,
    'dailyLossLimit', s.daily_loss_limit,
    'perTradeRiskLimit', s.per_trade_risk_limit,
    'minTradingDays', s.minimum_trading_days,
    'minProfitableDays', s.minimum_profitable_days,
    'minDailyProfit', s.min_daily_profit,
    'minEquityForPayout', s.equity_required_for_payout,
    'minPayout', s.minimum_payout,
    'unloggedProfitOffset', s.unlogged_profit_offset,
    'profitTarget', s.profit_target,
    'consistencyRule', s.consistency_rule,
    'accountStatus', 'active',
    'accountStage', 'evaluation',
    'accountTimezone', 'Asia/Kolkata'
  )
from public.account_settings s
on conflict (user_id, account_id) do nothing;

-- Existing tables already carry account_id as text. We deliberately do NOT add
-- a foreign key in this migration because older secondary account IDs may exist
-- only in browser storage. The application migrates those IDs first. After the
-- migration is verified, the optional validation statement below can be run:
--
-- alter table public.trades
--   add constraint trades_account_fk
--   foreign key (user_id, account_id)
--   references public.accounts(user_id, account_id)
--   not valid;
--
-- alter table public.trade_executions
--   add constraint trade_executions_account_fk
--   foreign key (user_id, account_id)
--   references public.accounts(user_id, account_id)
--   not valid;
--
-- Do not run VALIDATE until every existing account_id has a corresponding row.

-- Missed trades must also be account-scoped so they cannot leak into the wrong
-- account's analytics after multi-account adoption.
alter table public.missed_trades
  add column if not exists account_id text default 'primary';

update public.missed_trades
set account_id = 'primary'
where account_id is null;

create index if not exists missed_trades_user_account_idx
  on public.missed_trades (user_id, account_id, trade_date desc);

-- TradeLog account/trade integrity diagnostics — READ ONLY.
-- These queries do not UPDATE/DELETE/INSERT any production data.

-- 1) Map every trade bucket to its authoritative account row.
select
  t.account_id as trade_account_id,
  t.account_uuid as trade_account_uuid,
  count(*) as trade_count,
  coalesce(sum(t.pnl), 0) as total_pnl,
  a.id as matched_account_uuid,
  a.account_id as matched_account_id,
  a.name as account_name,
  a.status,
  a.stage
from public.trades t
left join public.accounts a
  on a.id = t.account_uuid
where t.user_id = auth.uid()
group by
  t.account_id,
  t.account_uuid,
  a.id,
  a.account_id,
  a.name,
  a.status,
  a.stage
order by trade_count desc;

-- 2) Find trades whose canonical account UUID no longer resolves to accounts.id.
select
  t.id,
  t.account_id,
  t.account_uuid,
  t.trade_date,
  t.symbol,
  t.pnl
from public.trades t
left join public.accounts a
  on a.id = t.account_uuid
 and a.user_id = t.user_id
where t.user_id = auth.uid()
  and t.account_uuid is not null
  and a.id is null
order by t.trade_date desc, t.id desc;

-- 3) Account-level trade summary using the canonical UUID relationship.
select
  a.id as account_uuid,
  a.account_id,
  a.name,
  a.status,
  a.stage,
  count(t.id) as trade_count,
  coalesce(sum(t.pnl), 0) as total_pnl
from public.accounts a
left join public.trades t
  on t.user_id = a.user_id
 and t.account_uuid = a.id
where a.user_id = auth.uid()
group by a.id, a.account_id, a.name, a.status, a.stage
order by a.created_at;

-- 4) Duplicate display names. Duplicate names are allowed; this query is only
-- to make the distinction visible before any account cleanup is considered.
select
  lower(trim(name)) as normalized_name,
  count(*) as account_count,
  array_agg(account_id order by created_at) as account_ids
from public.accounts
where user_id = auth.uid()
group by lower(trim(name))
having count(*) > 1
order by account_count desc, normalized_name;

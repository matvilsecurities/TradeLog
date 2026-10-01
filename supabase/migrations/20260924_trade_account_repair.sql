-- TradeLog production repair: canonicalize legacy trade account identity.
-- Safe to run once after 20260924_foundation_accounts.sql.
-- It only repairs rows when the relationship is unambiguous.
--
-- FIX (2026-09-25): every statement below previously filtered on
-- `t.user_id = auth.uid()`. This script is meant to be run once, for every
-- user, from the Supabase SQL Editor -- but SQL Editor queries execute as the
-- `postgres`/service role, which has no request JWT, so `auth.uid()`
-- evaluates to NULL there. `column = NULL` is never true in Postgres, so
-- every UPDATE silently touched 0 rows and the final diagnostic SELECT
-- silently returned 0 rows too -- looking exactly like "nothing needed
-- repair" when in fact the script never saw any data at all. The
-- `auth.uid()` predicates are removed below so this repairs every affected
-- user's rows when run with elevated privileges, which is what "run once in
-- the SQL Editor" actually requires. (If you instead want to scope this to a
-- single user, replace `auth.uid()` with an explicit literal UUID, not the
-- auth.uid() function, since there is no authenticated request context here.)

-- 1) Backfill the canonical UUID from a valid legacy account_id.
update public.trades t
set account_uuid = a.id
from public.accounts a
where a.user_id = t.user_id
  and a.account_id = t.account_id
  and t.account_uuid is null
  and t.account_id is not null
  and t.account_id <> '[object Object]';

-- 2) Repair the legacy account_id when account_uuid already identifies the account.
update public.trades t
set account_id = a.account_id
from public.accounts a
where a.user_id = t.user_id
  and a.id = t.account_uuid
  and t.account_id = '[object Object]';

-- 3) Report anything still unresolved. This final query is intentionally read-only.
select
  t.id,
  t.user_id,
  t.trade_date,
  t.symbol,
  t.pnl,
  t.account_id,
  t.account_uuid
from public.trades t
left join public.accounts a
  on a.user_id = t.user_id
 and a.id = t.account_uuid
where (
    t.account_id = '[object Object]'
    or t.account_uuid is null
    or a.id is null
  )
order by t.user_id, t.created_at desc, t.id desc;

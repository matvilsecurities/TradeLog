-- READ-ONLY. Run in the Supabase SQL editor BEFORE adding NOT NULL / a foreign key on
-- trades.account_id. Every row returned is a trade whose account does not exist for that user.
select t.id, t.user_id, t.trade_date, t.symbol, t.pnl, t.account_id
from public.trades t
left join public.accounts a on a.user_id = t.user_id and a.account_id = t.account_id
where t.account_id is null or t.account_id = '[object Object]' or a.id is null
order by t.user_id, t.trade_date desc;

-- Same check for missed trades.
select m.id, m.user_id, m.trade_date, m.account_id
from public.missed_trades m
left join public.accounts a on a.user_id = m.user_id and a.account_id = m.account_id
where m.account_id is null or m.account_id = '[object Object]' or a.id is null;

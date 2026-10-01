-- TradeLog 2026-09-29 production remediation pass.
-- Apply AFTER 20260929_write_path_and_account_fixes.sql.
--
-- Goals:
--   * remove silent Primary defaults from connector/execution persistence
--   * add a server-side Dashboard aggregate so large histories do not need to
--     be downloaded into the browser
--   * expose a tightly-scoped schema verification RPC for release checks
--
-- IMPORTANT: run the readonly orphan diagnostic before making legacy
-- account_id NOT NULL/FK changes. This migration intentionally does not
-- rewrite historical rows.

-- ---------------------------------------------------------------------------
-- Business-data account references must never be silently defaulted to Primary.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.trade_executions') is not null then
    alter table public.trade_executions alter column account_id drop default;
  end if;
  if to_regclass('public.connector_sync_runs') is not null then
    alter table public.connector_sync_runs alter column account_id drop default;
  end if;
  if to_regclass('public.broker_connections') is not null then
    alter table public.broker_connections alter column account_id drop default;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Secure Dashboard aggregate.
-- Returns only derived metrics + daily data + a small recent-trade window.
-- Account scope is the application account_id. auth.uid() is always applied.
-- ---------------------------------------------------------------------------

create or replace function public.tradelog_dashboard_summary(
  p_account_id text default null,
  p_account_ids text[] default null,
  p_date_mode text default 'latest-month',
  p_date_from date default null,
  p_date_to date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  with base as (
    select
      t.id,
      t.account_id,
      t.trade_date,
      t.entry_time,
      t.exit_time,
      t.created_at,
      coalesce(t.pnl, 0)::numeric as pnl,
      coalesce(t.planned_risk, 0)::numeric as planned_risk,
      case
        when nullif(to_jsonb(t)->>'rr', '') is not null
        then nullif(to_jsonb(t)->>'rr', '')::numeric
        else null
      end as rr,
      t.symbol,
      t.direction,
      t.entry_price,
      t.exit_price,
      t.quantity,
      case when nullif(to_jsonb(t)->>'setup_score', '') is not null then nullif(to_jsonb(t)->>'setup_score', '')::numeric else null end as setup_score,
      row_number() over (
        order by t.trade_date asc, t.entry_time asc nulls first, t.created_at asc nulls first, t.id asc
      ) as sequence_no
    from public.trades t
    where t.user_id = v_user_id
      and (
        (p_account_ids is not null and cardinality(p_account_ids) > 0 and t.account_id = any(p_account_ids))
        or ((p_account_ids is null or cardinality(p_account_ids) = 0) and (p_account_id is null or p_account_id = '' or p_account_id = 'all' or t.account_id = p_account_id))
      )
  ),
  latest as (
    select max(trade_date) as latest_trade_date from base
  ),
  scoped as (
    select b.*
    from base b
    cross join latest l
    where
      (
        p_date_from is not null
        and b.trade_date >= p_date_from
        and (p_date_to is null or b.trade_date < p_date_to)
      )
      or (
        p_date_from is null
        and (
          lower(coalesce(p_date_mode, 'latest-month')) = 'all'
          or (
            lower(coalesce(p_date_mode, 'latest-month')) = 'latest-month'
            and l.latest_trade_date is not null
            and b.trade_date >= date_trunc('month', l.latest_trade_date)::date
            and b.trade_date < (date_trunc('month', l.latest_trade_date) + interval '1 month')::date
          )
          or (
            lower(coalesce(p_date_mode, 'latest-month')) = 'this'
            and b.trade_date >= date_trunc('month', current_date)::date
            and b.trade_date < (date_trunc('month', current_date) + interval '1 month')::date
          )
          or (
            lower(coalesce(p_date_mode, 'latest-month')) = 'previous'
            and b.trade_date >= (date_trunc('month', current_date) - interval '1 month')::date
            and b.trade_date < date_trunc('month', current_date)::date
          )
        )
      )
  ),
  typed as (
    select s.*,
      case when pnl > 0 then 'win' when pnl < 0 then 'loss' else 'neutral' end as outcome,
      case
        when exit_time is not null and entry_time is not null
        then case
          when exit_time >= entry_time then extract(epoch from (exit_time - entry_time)) / 60.0
          else extract(epoch from (exit_time - entry_time + interval '24 hours')) / 60.0
        end
        else null
      end as hold_minutes
    from scoped s
  ),
  with_prev as (
    select t.*,
      lag(outcome) over (order by sequence_no) as prev_outcome
    from typed t
  ),
  grouped as (
    select w.*,
      sum(case when prev_outcome is null or prev_outcome <> outcome then 1 else 0 end)
        over (order by sequence_no rows unbounded preceding) as streak_group
    from with_prev w
  ),
  trade_groups as (
    select streak_group, outcome, count(*)::int as group_count, max(sequence_no) as max_sequence
    from grouped
    group by streak_group, outcome
  ),
  last_row as (
    select outcome, streak_group from grouped order by sequence_no desc limit 1
  ),
  streak_stats as (
    select
      coalesce((
        select case when g.outcome = 'neutral' or g.outcome is null then 0 else g.group_count end
        from trade_groups g
        where g.streak_group = (select streak_group from last_row)
        limit 1
      ), 0) as current_streak,
      coalesce((select outcome from last_row where outcome <> 'neutral'), '') as current_streak_type,
      coalesce((select max(group_count) from trade_groups where outcome <> 'neutral'), 0) as best_trade_streak
  ),
  daily as (
    select trade_date as date,
      sum(pnl)::numeric as pnl,
      count(*)::int as trades,
      count(*) filter (where pnl > 0)::int as wins,
      count(*) filter (where pnl < 0)::int as losses
    from typed
    where trade_date is not null
    group by trade_date
  ),
  daily_seq as (
    select d.*,
      case when pnl > 0 then 'win' when pnl < 0 then 'loss' else 'neutral' end as outcome,
      lag(case when pnl > 0 then 'win' when pnl < 0 then 'loss' else 'neutral' end)
        over (order by date) as prev_outcome
    from daily d
  ),
  daily_grouped as (
    select ds.*,
      sum(case when prev_outcome is null or prev_outcome <> outcome then 1 else 0 end)
        over (order by date rows unbounded preceding) as streak_group
    from daily_seq ds
  ),
  daily_groups as (
    select streak_group, outcome, count(*)::int as group_count, max(date) as max_date
    from daily_grouped
    group by streak_group, outcome
  ),
  daily_last as (
    select outcome, streak_group from daily_grouped order by date desc limit 1
  ),
  daily_streak_stats as (
    select
      coalesce((
        select case when g.outcome = 'neutral' or g.outcome is null then 0 else g.group_count end
        from daily_groups g
        where g.streak_group = (select streak_group from daily_last)
        limit 1
      ), 0) as current_day_streak,
      coalesce((select outcome from daily_last where outcome <> 'neutral'), '') as current_day_streak_type,
      coalesce((select max(group_count) from daily_groups where outcome <> 'neutral'), 0) as best_day_streak
  ),
  equity_seq as (
    select typed.*,
      sum(pnl) over (order by sequence_no rows unbounded preceding) as cumulative_pnl
    from typed
  ),
  equity_curve as (
    select e.*,
      max(cumulative_pnl) over (order by sequence_no rows unbounded preceding) as peak_pnl
    from equity_seq e
  ),
  drawdown_stats as (
    select
      coalesce(max(greatest(0, peak_pnl - cumulative_pnl)), 0)::numeric as max_drawdown,
      coalesce(max(case when peak_pnl > 0 then ((greatest(0, peak_pnl - cumulative_pnl) / peak_pnl) * 100) else case when cumulative_pnl < 0 then 100 else 0 end end), 0)::numeric as max_drawdown_percent,
      coalesce(max(cumulative_pnl), 0)::numeric as peak_cumulative_pnl,
      coalesce(max(cumulative_pnl) filter (where sequence_no = (select max(sequence_no) from equity_curve)), 0)::numeric as ending_pnl
    from equity_curve
  ),
  totals as (
    select
      coalesce(sum(pnl), 0)::numeric as total_pnl,
      count(*) filter (where pnl > 0)::int as wins,
      count(*) filter (where pnl < 0)::int as losses,
      count(*) filter (where pnl = 0)::int as break_even,
      coalesce(sum(pnl) filter (where pnl > 0), 0)::numeric as gross_profit,
      coalesce(sum(abs(pnl)) filter (where pnl < 0), 0)::numeric as gross_loss,
      coalesce(avg(rr) filter (where rr > 0), 0)::numeric as avg_rr,
      coalesce(avg(hold_minutes) filter (where hold_minutes > 0), 0)::numeric as avg_hold
    from typed
  ),
  consistency as (
    select
      case
        when count(*) = 0 then 0
        else
          case
            when avg(pnl) < 0 or sum(pnl) <= 0 then 0
            when count(*) = 1 then 100
            else greatest(0, least(100, 100 - ((sqrt(greatest(0, avg(pnl * pnl) - power(avg(pnl), 2))) / abs(sum(pnl))) * 100)))
          end
      end as score
    from daily
  ),
  recent as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'date', trade_date,
        'trade_date', trade_date,
        'time', entry_time,
        'symbol', symbol,
        'dir', direction,
        'direction', direction,
        'entry', entry_price,
        'exit', exit_price,
        'qty', quantity,
        'quantity', quantity,
        'pnl', pnl,
        'setup_score', setup_score
      ) order by trade_date desc, entry_time desc nulls last, created_at desc nulls last, id desc
    ) filter (where id is not null), '[]'::jsonb) as recent_trades
    from (select * from typed order by trade_date desc, entry_time desc nulls last, created_at desc nulls last, id desc limit 5) r
  ),
  latest_trade as (
    select trade_date, coalesce(created_at, (trade_date::text || 'T' || coalesce(entry_time::text, '12:00:00'))::timestamptz) as latest_timestamp
    from scoped
    order by trade_date desc, entry_time desc nulls last, created_at desc nulls last, id desc
    limit 1
  )
  select jsonb_build_object(
    'totalPnl', t.total_pnl,
    'wins', t.wins,
    'losses', t.losses,
    'breakEvenTrades', t.break_even,
    'avgWin', case when t.wins > 0 then t.gross_profit / t.wins else 0 end,
    'avgLoss', case when t.losses > 0 then -(t.gross_loss / t.losses) else 0 end,
    'avgWinLossRatio', case when t.wins > 0 and t.losses > 0 and t.gross_profit > 0 and t.gross_loss > 0 then (t.gross_profit / t.wins) / (t.gross_loss / t.losses) else null end,
    'profitFactor', case when t.gross_loss > 0 then (t.gross_profit / t.gross_loss)::text when t.gross_profit > 0 then 'Infinity' else '0' end,
    'avgRR', t.avg_rr,
    'avgHold', t.avg_hold,
    'winRate', case when (t.wins + t.losses) > 0 then (t.wins::numeric / (t.wins + t.losses)) * 100 else 0 end,
    'currentStreak', ss.current_streak,
    'streakType', ss.current_streak_type,
    'bestTradeStreak', ss.best_trade_streak,
    'currentDayStreak', dss.current_day_streak,
    'currentDayStreakType', dss.current_day_streak_type,
    'bestDayStreak', dss.best_day_streak,
    'dailyPerformance', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'pnl', pnl) order by date) from daily), '[]'::jsonb),
    'dailyData', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'pnl', pnl, 'trades', trades, 'wins', wins, 'losses', losses) order by date) from daily), '[]'::jsonb),
    'latestTradeDate', (select trade_date from latest_trade),
    'latestTradeTimestamp', (select latest_timestamp from latest_trade),
    'recentTrades', r.recent_trades,
    'zella', jsonb_build_object(
      'raw', jsonb_build_object(
        'winRate', case when (t.wins + t.losses) > 0 then (t.wins::numeric / (t.wins + t.losses)) * 100 else 0 end,
        'profitFactor', case when t.gross_loss > 0 then (t.gross_profit / t.gross_loss)::text when t.gross_profit > 0 then 'Infinity' else '0' end,
        'avgWinLoss', case when t.wins > 0 and t.losses > 0 and t.gross_profit > 0 and t.gross_loss > 0 then (t.gross_profit / t.wins) / (t.gross_loss / t.losses) else 0 end,
        'recoveryFactor', case when ds.max_drawdown > 0 then (t.total_pnl / ds.max_drawdown)::text when t.total_pnl > 0 then 'Infinity' else '0' end,
        'maxDrawdownPercent', ds.max_drawdown_percent,
        'consistency', c.score
      )
    )
  ) into v_result
  from totals t
  cross join streak_stats ss
  cross join daily_streak_stats dss
  cross join drawdown_stats ds
  cross join consistency c
  cross join recent r;

  return v_result;
end;
$$;

revoke all on function public.tradelog_dashboard_summary(text, text, text[], date, date) from public;
grant execute on function public.tradelog_dashboard_summary(text, text, text[], date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Release schema verification helper.
-- This returns only a fixed allow-list of object checks; it does not expose
-- arbitrary SQL or table contents.
-- ---------------------------------------------------------------------------

create or replace function public.tradelog_verify_release_schema()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_required_tables text[] := array['accounts','trades','missed_trades','trade_mistakes','trade_images','account_settings','trade_executions','broker_connections','connector_sync_runs'];
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
    'function:tradelog_dashboard_summary', to_regprocedure('public.tradelog_dashboard_summary(text,text,text[],date,date)') is not null,
    'rls:trades', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname='trades'), false),
    'rls:accounts', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname='accounts'), false),
    'index:trades_user_trade_date', exists(select 1 from pg_indexes where schemaname='public' and indexname='trades_user_trade_date_id_idx'),
    'index:trades_user_account_trade_date', exists(select 1 from pg_indexes where schemaname='public' and indexname='trades_user_account_trade_date_id_idx')
  );

  if not (v_checks->>'function:tradelog_save_trade_with_mistakes')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_save_missed_trade')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_delete_trade')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_delete_missed_trade')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_delete_account')::boolean then v_ok := false; end if;
  if not (v_checks->>'function:tradelog_dashboard_summary')::boolean then v_ok := false; end if;
  if not (v_checks->>'rls:trades')::boolean or not (v_checks->>'rls:accounts')::boolean then v_ok := false; end if;

  return jsonb_build_object('ok', v_ok, 'checks', v_checks, 'checkedAt', now());
end;
$$;

revoke all on function public.tradelog_verify_release_schema() from public;
grant execute on function public.tradelog_verify_release_schema() to authenticated;

-- TradeLog: account deletion RPC
-- Required by Prop Firm Setup -> Remove Account.
-- Safe behavior: permanently deletes only accounts with no trades/missed trades.
-- Accounts with journal history are preserved and the client will instruct the user to archive them.

create or replace function public.tradelog_delete_account(p_account_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trades bigint := 0;
  v_missed bigint := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_account_id is null
     or btrim(p_account_id) = ''
     or p_account_id = 'primary' then
    raise exception using errcode = '22023', message = 'This account cannot be deleted.';
  end if;

  if not exists (
    select 1
    from public.accounts
    where user_id = v_user_id
      and account_id = p_account_id
  ) then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;

  if to_regclass('public.trades') is not null then
    select count(*) into v_trades
    from public.trades
    where user_id = v_user_id
      and account_id = p_account_id;
  end if;

  if to_regclass('public.missed_trades') is not null then
    select count(*) into v_missed
    from public.missed_trades
    where user_id = v_user_id
      and account_id = p_account_id;
  end if;

  if v_trades > 0 or v_missed > 0 then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'has_trades',
      'trade_count', v_trades,
      'missed_trade_count', v_missed
    );
  end if;

  if to_regclass('public.broker_connections') is not null then
    delete from public.broker_connections
    where user_id = v_user_id
      and account_id = p_account_id;
  end if;

  if to_regclass('public.connector_sync_runs') is not null then
    delete from public.connector_sync_runs
    where user_id = v_user_id
      and account_id = p_account_id;
  end if;

  delete from public.accounts
  where user_id = v_user_id
    and account_id = p_account_id;

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.tradelog_delete_account(text) from public;
grant execute on function public.tradelog_delete_account(text) to authenticated;

-- Ask PostgREST to refresh its function/schema cache immediately.
notify pgrst, 'reload schema';

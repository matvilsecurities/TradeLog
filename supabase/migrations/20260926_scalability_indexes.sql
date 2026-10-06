-- TradeLog scalability indexes
--
-- These indexes match the application's most frequent user-scoped access
-- patterns. Guards keep this migration safe when an older environment does
-- not yet have an optional table.

create index if not exists trades_user_date_id_idx
  on public.trades (user_id, trade_date desc, id desc);

create index if not exists trades_user_account_date_id_idx
  on public.trades (user_id, account_id, trade_date desc, id desc);


do $$
begin
  if to_regclass('public.trade_mistakes') is not null then
    create index if not exists trade_mistakes_trade_id_idx
      on public.trade_mistakes (trade_id);
  end if;

  if to_regclass('public.trade_images') is not null then
    create index if not exists trade_images_user_trade_id_idx
      on public.trade_images (user_id, trade_id);
    create index if not exists trade_images_user_missed_trade_id_idx
      on public.trade_images (user_id, missed_trade_id);
  end if;

  if to_regclass('public.missed_trades') is not null then
    create index if not exists missed_trades_user_date_id_idx
      on public.missed_trades (user_id, trade_date desc, id desc);
  end if;
end
$$;

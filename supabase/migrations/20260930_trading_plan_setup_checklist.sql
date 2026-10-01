-- Persist the Trading Plan setup checklist so the plan keeps the same setup-validation context as Log Trade.
alter table public.trading_plans
  add column if not exists setup_checklist jsonb not null default '{}'::jsonb;

comment on column public.trading_plans.setup_checklist is 'Daily setup-validation checklist snapshot used by the Trading Plan workspace.';

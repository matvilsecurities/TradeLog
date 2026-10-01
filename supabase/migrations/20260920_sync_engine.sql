create table if not exists public.connector_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null default 'primary',
  connector_id text not null,
  mode text not null default 'manual',
  status text not null default 'success',
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  message text,
  duration_ms integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);
create index if not exists connector_sync_runs_user_account_idx on public.connector_sync_runs(user_id, account_id, completed_at desc);
alter table public.connector_sync_runs enable row level security;
drop policy if exists connector_sync_runs_select_own on public.connector_sync_runs;
create policy connector_sync_runs_select_own on public.connector_sync_runs for select using (auth.uid() = user_id);
drop policy if exists connector_sync_runs_insert_own on public.connector_sync_runs;
create policy connector_sync_runs_insert_own on public.connector_sync_runs for insert with check (auth.uid() = user_id);

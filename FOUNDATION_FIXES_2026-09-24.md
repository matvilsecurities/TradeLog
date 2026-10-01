# TradeLog Foundation Fixes — 2026-09-24

This build is the post-baseline stabilization pass. The goal is to make account data durable, remove runtime historical migrations, harden compliance calculations, and document the Supabase work required before production use.

## 1. What changed

### Account persistence
- Added a first-class `accounts` table integration.
- The account portfolio now treats Supabase as the authoritative source of truth.
- Browser storage is only a cache for migration fallback and the last selected account.
- The legacy `primary` account is preserved as an ID for compatibility, but secondary accounts are no longer browser-only.
- Account creation/update/archive writes to Supabase.
- Legacy account records found in the previous localStorage portfolio are migrated into Supabase by ID.
- Account removal is now an archive operation. Existing trades are not deleted.

### Authentication
- Supabase session persistence is enabled.
- Token refresh remains enabled.

### Compliance
- Centralized futures instrument metadata.
- Micro contracts are evaluated against `maxMicros`; full contracts are evaluated against `maxContracts`.
- Added account-timezone-aware trading-day calculations.
- Added rule-version warning support.
- Split equity/position calculations into testable functions.

### Data ownership
- Missed trades now carry `account_id`.
- Runtime one-time The5ers migration/import code was removed from `App.jsx`.
- Historical data migrations should be run as explicit migrations/scripts, not on every application boot.

### QA
- The old phase-based verification scripts are still present as historical checks, but the repository now needs a consolidated current QA suite before those scripts can be considered authoritative.

## 2. Supabase migration required

Run:

`supabase/migrations/20260924_foundation_accounts.sql`

in the Supabase SQL Editor.

It:
- creates `public.accounts`;
- enables RLS and owner-only policies;
- backfills the `primary` account from `account_settings`;
- adds `account_id` to `missed_trades`;
- indexes account-scoped missed trades.

It intentionally does **not** add foreign keys from existing account-scoped tables yet because old browser-only secondary account IDs may exist in existing users' localStorage.

## 3. After deployment: validate orphan account IDs

Run this query:

```sql
select distinct t.user_id, t.account_id
from public.trades t
left join public.accounts a
  on a.user_id = t.user_id
 and a.account_id = t.account_id
where t.account_id is not null
  and a.account_id is null;
```

Do the same for executions:

```sql
select distinct e.user_id, e.account_id
from public.trade_executions e
left join public.accounts a
  on a.user_id = e.user_id
 and a.account_id = e.account_id
where e.account_id is not null
  and a.account_id is null;
```

If both return zero rows, you can add and later validate composite foreign keys.

## 4. Recommended final constraints

After all users have opened the new build and legacy account migration has completed, add:

```sql
alter table public.trades
  add constraint trades_account_fk
  foreign key (user_id, account_id)
  references public.accounts(user_id, account_id)
  not valid;

alter table public.trade_executions
  add constraint trade_executions_account_fk
  foreign key (user_id, account_id)
  references public.accounts(user_id, account_id)
  not valid;
```

Then validate only after the orphan queries return zero rows:

```sql
alter table public.trades validate constraint trades_account_fk;
alter table public.trade_executions validate constraint trade_executions_account_fk;
```

## 5. Security notes

- Never put a Supabase service-role key in the Vite client.
- Never put Tradovate/NinjaTrader client secrets in `VITE_*` variables.
- The existing Netlify OAuth function must keep the client secret server-side.
- `accounts.settings` is user-owned data and protected by RLS; do not expose service-role access to the browser.

## 6. Production acceptance checklist

Before calling this production-ready:

- [ ] Run the new SQL migration.
- [ ] Log in and refresh the browser; the session survives.
- [ ] Create two secondary accounts.
- [ ] Log out/in; both accounts remain.
- [ ] Open the app from a second browser/device; both accounts remain.
- [ ] Edit a secondary account; refresh; edit persists.
- [ ] Archive an account; its trades remain but the account disappears from active selectors.
- [ ] Select All Accounts; only active accounts aggregate.
- [ ] Verify trades are attached to the intended account.
- [ ] Verify missed trades are account-scoped.
- [ ] Test MNQ against `maxMicros`.
- [ ] Test a full contract such as NQ against `maxContracts`.
- [ ] Test daily-loss calculation across midnight in the configured account timezone.
- [ ] Test drawdown after a new equity high.
- [ ] Test partial live execution capture and reconciliation.
- [ ] Run the orphan-account SQL queries.
- [ ] Only then add the composite foreign keys.

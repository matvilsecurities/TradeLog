# TradeLog

TradeLog is a React/Vite trading journal for Matvil Securities.

## Structure

- `src/App.jsx` — application state and view routing
- `src/supabase.js` — Supabase authentication and data access
- `src/constants.js` — shared constants and calculations
- `src/setupChecklist.js` — user setup checklists
- `src/tradeStats.js` — trade statistics helpers
- `src/components/` — feature and shared components
- `src/styles/` — canonical CSS files; duplicate/versioned CSS copies were removed

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies:

```bash
npm install
```

4. Start development:

```bash
npm run dev
```

5. Create a production build:

```bash
npm run build
```

## Logo

The supplied source files did not contain the original binary `matvil-logo.png`, so this package includes a small SVG fallback at `src/assets/matvil-logo.svg`. Replace that file with the original Matvil logo if you have it; no other code changes are required.

## CSS cleanup

The CSS cleanup removes exact duplicate/versioned copies while retaining the canonical styles currently imported by the React components. No visual redesign was intentionally applied in this phase.

## Foundation stabilization (2026-09-24)

The current baseline includes the TradeLog foundation hardening pass. See `FOUNDATION_FIXES_2026-09-24.md` for the migration checklist and production acceptance criteria.

Key architectural rule:

- Supabase is authoritative for accounts, trades, executions, connector metadata and durable account state.
- Browser `localStorage` is used only for UI preferences, last-selected account, temporary connector/live-capture configuration and migration cache.
- Account IDs are stable text identifiers so existing trade records can be migrated without rewriting historical trade IDs.
- The `primary` account remains as a compatibility ID for the legacy `account_settings` row, but secondary accounts are no longer browser-only.

Before deploying the new build, run `supabase/migrations/20260924_foundation_accounts.sql` in the Supabase SQL Editor.

## Security hardening (2026-09-25)

Run `supabase/migrations/20260925_core_rls_hardening.sql` in the Supabase SQL
Editor before deploying this build, and read the `NOTICE` output it prints.
It (re)asserts row-level security and owner-only policies on `trades`,
`trade_mistakes`, `trade_images`, `account_settings`, and `missed_trades` —
tables whose original `CREATE TABLE` statements predate this migrations
folder, so their RLS status could not otherwise be verified from source. It
also adds `trades.updated_at` (with an auto-touch trigger), which the app
now uses to detect if a trade was edited elsewhere before overwriting it.

The previous `20260924_trade_account_repair.sql` has also been corrected:
every statement in it was filtered by `auth.uid()`, which is `NULL` when run
from the SQL Editor (no authenticated request context there), so the repair
silently updated zero rows. If you ran it before, it did nothing — re-run the
corrected version in this build.

Verification commands:

```bash
npm run verify:foundation
npm run verify:all
npm run build
```

`npm run verify:all` is a static/contract verification suite. A successful verification run does not replace a browser smoke test against a real Supabase project.

## 2026-09-24 account mapping fix
See `FIXES_2026-09-24.md` and `PROJECT_STATUS_2026-09-24.md` for the current account identity contract, Journal Ledger fix, manual-save compatibility fix, QA results, and next rollout steps.

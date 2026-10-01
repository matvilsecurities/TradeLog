# TradeLog Audit & Repair Report — 2026-09-24

## Status

**Application code: stabilized for the next local QA cycle.**

The repository's 42 static verification scripts pass after this repair pass. A production Vite build could not be independently executed in the sandbox because dependency installation timed out; the user's normal VS Code environment remains the authoritative build test.

## Repairs made

### 1. Account updates were not reliably persisted

`useAccountPortfolio.updateAccount()` previously derived `nextAccount` inside a React state updater and then attempted to persist that variable immediately afterwards. With React's deferred/concurrent state scheduling, the persistence call could run before `nextAccount` was assigned. This affected edits such as price paid, activation fee, Passed/Blown state and other account settings.

The function now constructs the complete next account first, updates React state with that object, and persists that exact object to Supabase.

### 2. Review Trades routing was made deterministic

The historical ledger previously rejected review requests unless the account was already classified by the historical-account filter. Review now resolves the requested account directly from the authoritative account list and opens a ledger scoped to that exact account. This removes a render-cycle/status race from the Review Trades path.

### 3. Analysis context was standardized

Analytics, Calendar, Edge Analysis, Trade Intelligence, Journal Intelligence, Trading Plan, Risk Manager, Trade Review and Chart Workspace now use the Dashboard's selected account context. When Dashboard is set to All Accounts, these views receive the active-account aggregate rather than an unrelated Account Center selection.

### 4. Edge Analysis empty-state crash repaired

Edge Analysis referenced `byGrade[0].count` even when no grade data existed. It now safely resolves the A+ row and returns zero when there is no data.

### 5. Prop-firm financial data visibility repaired

The portfolio now explicitly shows:
- Total Purchase Cost
- Activation Fees Paid
- Total Invested

Individual account cards and account details also show Price Paid, Activation Fee Paid and Total Invested. Program rule pricing is kept separate from the amount actually paid.

## Database findings that still require production-side action

### A. Existing corrupted trade rows

Earlier production evidence showed rows with `account_id = '[object Object]'` and missing `account_uuid`. New application code blocks this corruption, but existing rows cannot be safely assigned to an account without an unambiguous relationship.

A safe repair migration is included at:

`supabase/migrations/20260924_trade_account_repair.sql`

It backfills `account_uuid` from a valid account_id and repairs `[object Object]` only when `account_uuid` already identifies an account. It then reports unresolved rows instead of guessing.

### B. Phase 39 live-capture schema is not fully deployed

Production evidence showed `public.trade_executions` did not exist, and the `capture_status` column was previously missing. The application now avoids sending optional live-capture fields during ordinary manual trades, but live auto-journaling is not production-ready until the Phase 39 migration is applied.

### C. Existing orphan account UUIDs

Earlier production evidence showed a separate trade bucket whose `account_uuid` did not match an existing `accounts.id`. That must be mapped only after identifying the intended account; the repair package does not guess.

## QA result

`node scripts/verify-all.mjs` → **42/42 verification scripts passed.**

## Required production verification

1. Run the account repair SQL migration.
2. Run the existing read-only account integrity diagnostics.
3. Confirm no new `[object Object]` account IDs exist.
4. Save a trade in PA-APEX-18 and verify both `account_id` and `account_uuid` in `public.trades`.
5. Save/edit an account's Price Paid and Activation Fee and reload; verify values survive from Supabase.
6. Open a blown account → Review Trades and confirm only that account's trades appear.
7. Open Analysis with a selected account and with All Accounts; verify metrics change accordingly.
8. Only then apply and verify the Phase 39 live-capture migration.

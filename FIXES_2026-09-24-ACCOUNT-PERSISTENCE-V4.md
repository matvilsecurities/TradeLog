# TradeLog — Account Persistence Fix V4 — 2026-09-24

## Confirmed production symptom

A newly saved trade could still reach `public.trades` as:

- `account_id = [object Object]`
- `account_uuid = NULL`

This means an account object was crossing the trade-entry boundary instead of a canonical account identifier.

## V4 changes

### 1. Canonical account resolution in `App.jsx`

All trade-entry paths now resolve an account reference against the authoritative in-memory account list before saving. Supported inputs include:

- `account.id` / legacy application account ID
- `account.account_id`
- `account.accountId`
- `account.uuid`
- `account.accountUuid`
- `account.account_uuid`
- nested `account`, `value`, or `option` references

The selected account is resolved in this order:

1. Existing trade's own persisted account when editing
2. Explicit Journal Ledger/Add Trade account context
3. Dashboard selected account
4. Account Center active account

The saved payload always contains the selected account's string `account_id` and canonical `account_uuid`.

### 2. Database-boundary defense in `supabase.js`

`saveTradeDb()` now recursively normalizes account references and explicitly rejects unresolved `[object Object]` account IDs instead of allowing corrupted rows to be created.

### 3. Existing trade edits

Editing a trade preserves its original account mapping and resolves it back to the authoritative account record before persistence.

### 4. Verification

The complete repository verification suite passes:

- 42/42 verification scripts
- 7/7 trade-entry account-context checks
- 6/6 trade-account persistence checks
- 8/8 account/trade mapping checks

The Vite production build was not executed because dependencies are not installed in the verification container and the dependency installation attempt timed out. No claim of a successful production build is made.

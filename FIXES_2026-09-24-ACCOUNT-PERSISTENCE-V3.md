# TradeLog — Account Persistence Fix v3 — 2026-09-24

## Confirmed production symptom
A newly saved trade showed:
- `account_id = [object Object]`
- `account_uuid = NULL`

This means a UI account object was reaching the persistence boundary instead of its string account key/canonical UUID.

## Fix
1. `App.jsx` now normalizes `trade.accountId` / `trade.account_id` when a full account object is supplied.
2. The explicit trade-entry account remains authoritative for a new manual trade.
3. The selected account's `accountUuid` / canonical `accounts.id` is always used when available.
4. `supabase.js` now has a final defensive normalization layer so an account object can never be persisted as `[object Object]`.
5. `account_uuid` is only written when it is a valid UUID. The legacy `account_id` is never copied into `account_uuid`.
6. Existing trades continue to preserve their persisted account identity.

## Verification
- Trade entry account-context QA: 7/7 passed.
- Trade-account persistence QA: 6/6 passed.
- Dashboard/sidebar QA: 10/10 passed.
- Full repository verification was attempted; the aggregate runner exited because one script requires a `TERM` environment variable in this shell. The targeted account persistence and account-context checks passed.

## Database action
No SQL migration is required for this fix.
Do not modify existing PA-APEX-18, APEX-21, or The5ers trades as part of this fix.

## Required manual test
Select PA-APEX-18 → Log Trade → save one test trade → verify `trades.account_id` is the PA-APEX-18 account key and `trades.account_uuid` equals that account's `accounts.id`.

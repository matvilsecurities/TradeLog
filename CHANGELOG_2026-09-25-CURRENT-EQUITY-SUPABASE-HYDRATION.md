# Current Equity Fix — 2026-09-25

## Root cause
Journal Ledger received account records from Supabase where `accounts.account_size` was not copied into the normalized account object. The Current Equity calculation therefore saw no starting account size and displayed only realized P&L.

## Fix
- Hydrate `accounts.account_size` into both `account.account_size` and `account.settings.accountSize` when rows are loaded from Supabase.
- Normalize cached account records using the same account-size fallback chain.
- Preserve the normalized account size when accounts are written back to Supabase.
- Added a deep-QA regression check ensuring a 25K Supabase account produces 25K + P&L on first-load account hydration.

## Expected behavior
- 25K account + $375 P&L = $25,375 Current Equity.
- 50K account + $1,200 P&L = $51,200 Current Equity.
- All Accounts aggregates the starting sizes and corresponding P&L of the displayed accounts.
- Journal filters do not change Current Equity.

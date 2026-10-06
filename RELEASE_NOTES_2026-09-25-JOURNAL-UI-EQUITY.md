# TradeLog Journal Ledger UI + Current Equity Update

## Changes

### Journal Ledger header
- Reworked the Ledger header controls to visually match the Dashboard header control family.
- Added the compact Account selector treatment with ACCOUNT eyebrow, account name, icon, and chevron.
- Standardized date, Filters, theme, Export, and profile controls to the Dashboard-style 34px/8px control language.
- Added working CSV export for the currently filtered Journal Ledger view.
- Preserved existing account, date, direction, sorting, profile, and theme behavior.

### Current Equity KPI
- Added a fifth Journal Ledger KPI card: **Current Equity**.
- Equity is account-scoped and intentionally independent of the Ledger's search, direction, and date filters.
- For a selected account: `accountSize + initialProfit/unloggedProfitOffset + all account P&L`.
- For All Accounts: starting equity and P&L are aggregated across the visible accounts.
- The card shows starting equity, current equity change, and a compact progress bar.
- Equity respects both legacy account IDs and canonical account UUIDs when matching trades.

## Validation
- TypeScript parser validation: 101 JS/JSX/MJS files, no parse diagnostics.
- Full active verification suite: 34/34 passed.
- Deep QA: 11/11 passed.
- 100,000-trade statistics stress test: passed.
- 10,000 execution stress test: passed.
- Multi-user isolation model: passed.

Production Vite compilation was not run in this environment because the release package does not contain node_modules and external npm registry access is unavailable here.

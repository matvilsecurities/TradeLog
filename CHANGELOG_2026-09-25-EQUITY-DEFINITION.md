# Current Equity Definition — 2026-09-25

The main Journal Ledger Current Equity KPI now follows the prop-firm account definition:

**Current Equity = Prop Firm Account Size + Realized Journal P&L**

Example:
- Apex Tradovate 25K account → starting equity `$25,000`
- Journal P&L `+$500` → Current Equity `$25,500`
- Journal P&L `-$200` → Current Equity `$24,800`

The KPI is independent of the Journal Ledger's date, direction, search, and sort filters.
For All Accounts, starting account sizes and account-specific P&L are aggregated.
Legacy `initialProfit` / `unloggedProfitOffset` values are intentionally excluded from this KPI.

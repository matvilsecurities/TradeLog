# Journal Ledger KPI Order — 2026-09-25

The main Journal Ledger KPI row now uses the fixed five-card order:

1. Current Equity
2. Net P&L
3. Profit Factor
4. Wins
5. Avg Win/Loss Trade

The five-card grid is responsive: 5 columns on desktop, 3 on medium widths, 2 on smaller desktop/tablet widths, and 1 on mobile.

The Current Equity card remains account-scoped and independent of the Ledger's date, direction, and search filters.

Verification: `node scripts/verify-all.mjs` passed all 34 active verification suites. Broker-sync verification remains intentionally deferred because broker synchronization is not part of the current launch scope.

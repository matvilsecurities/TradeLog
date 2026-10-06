# Phase 5E — Dashboard QA & Hardening

## Included
- Hardened dashboard date parsing against malformed calendar dates.
- Centralized date-key normalization for dashboard statistics, calendar, P&L chart, and recent trades.
- Kept dashboard month win-rate semantics aligned with the main dashboard: break-even trades are excluded from the decisive-trade denominator.
- Removed remaining reliance on `trade.date` where `trade_date` is also supported.
- Added a lightweight `npm run verify:dashboard` static sanity check.
- No dashboard visual redesign or CSS changes.

## Verification
- Required dashboard component files are checked.
- Known historical demo values are checked for absence.
- Full Vite build should still be run locally with `npm run build` on the user's Windows environment.

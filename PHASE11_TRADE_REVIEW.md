# Phase 11 — Trade Review & Execution Review

## Scope
Phase 11 adds a read-only trade review workspace on top of the existing journal data. It does not introduce a new database table or change the trade schema.

## Added
- Trade Review sidebar view.
- All-time / 7-day / 30-day / 90-day review filters.
- Win / loss / breakeven filtering.
- Grade filtering.
- Review queue sorted by most recent trade.
- Selected-trade execution metrics: entry, SL, TP, R:R and risk.
- Checklist completion and setup-grade context.
- Mistake chips for recorded mistakes.
- Before-entry and after-exit screenshot review.
- Notes and emotion review.
- Review summary counts for trades, wins/losses, mistakes and clean trades.

## Design constraint
The review workspace is intentionally read-only. Existing edit/delete behavior remains in Journal Ledger, preventing review screens from accidentally mutating trade records.

## QA
Run:

```bash
npm run verify:review
npm run build
```

No database migration is required.

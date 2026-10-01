# Scalability Hardening — 2026-09-26

## Changes

- Reduced the default trade-history page from 2,000 rows to 100.
- Added a 500-row hard cap for a single trade-history request.
- Added keyset pagination using `trade_date DESC, id DESC` for older trade pages.
- Initial trade and missed-trade loads no longer request signed screenshot URLs.
- Added progressive background hydration of older journal pages after the initial render.
- Added lazy screenshot loading for Trade Review and Calendar day details.
- Added database indexes for user/date pagination, user/account/date access, mistake lookup, image lookup, and missed-trade history.

## Compatibility

The existing `fetchTradesDb({ offset })` and `fetchMissedTradesDb({ offset })` calling style remains supported. New code should use the returned `nextCursor` for trade history pagination.

## Important deployment step

Apply `supabase/migrations/20260926_scalability_indexes.sql` to the target Supabase database before production traffic. The migration is intentionally guarded for optional tables.

## Not changed

- Account/trade mapping logic.
- RLS ownership rules.
- Manual trade-save data model.
- Broker connector exposure.

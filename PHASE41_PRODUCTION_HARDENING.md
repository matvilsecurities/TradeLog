# TradeLog — Phase 41 Production Hardening

Date: 2026-09-26

## Implemented

1. Trade + trade_mistakes persistence moved to a single Postgres RPC transaction.
2. Account ownership is checked server-side against `auth.uid()` before a trade can be written.
3. `account_uuid` is checked against the authenticated user's authoritative account row when supplied.
4. Optimistic concurrency checking moved into the same database transaction as the trade write.
5. Trade screenshot Storage bucket is explicitly made private by migration when present.
6. Storage object policies restrict screenshot paths to the authenticated user's UUID prefix.
7. Production hardening QA was added to `npm run verify:all` through the automatic `verify-*.mjs` discovery.

## Important deployment step

Apply `supabase/migrations/20260926_production_hardening.sql` to the target Supabase project before enabling this build in production.

The migration expects the authoritative `public.accounts` table from the foundation migration and the existing `public.trades` / `public.trade_mistakes` tables.

## Intentionally not claimed here

- No real Supabase network load test was run from this environment.
- No production database migration was applied automatically.
- Storage policies should still be reviewed in the Supabase dashboard after migration because existing policies from an earlier deployment may also be present.

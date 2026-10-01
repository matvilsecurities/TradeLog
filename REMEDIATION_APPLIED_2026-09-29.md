# TradeLog remediation applied — 2026-09-29

Base: `TradeLog-FIXED-2026-09-29.zip`
Reference: `TradeLog Production Remediation Report — 29 Sep 2026`

## Applied in this build

### P0
- Removed silent `primary` fallback from trade reads/filtering where missing account data could be mis-attributed.
- Removed Primary defaults from missed-trade, execution, connector sync persistence boundaries.
- Connector normalizers now require an explicit TradeLog account.
- Added `20260929_production_remediation.sql` to drop connector account defaults and add server-side Dashboard aggregation/schema verification.
- Fixed malformed Dashboard CSV quote escaping and centralized CSV escaping in `src/utils/csv.js`.
- Updated permanent-account-delete QA to the safe policy: non-empty accounts are rejected; archive instead.
- Account deletion now rolls back local state on server rejection and the Prop Firm UI reports the real failure.

### P1
- Account create/update persistence now reconciles local state with the server result and rolls back on failure.
- Account deletion is awaited by Prop Firm Setup and reports server errors instead of false success.
- Added `scripts/verify-production-schema.mjs` for release-time schema verification when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present.
- Enforced the existing CSP in `netlify/_headers` after the hardening pass.
- Added a telemetry abstraction and global error/unhandled-rejection capture compatible with an externally loaded Sentry-style reporter without sending sensitive trade payloads.

### P2
- Dashboard now has a secure server-side aggregate RPC with account/date scoping, daily data, streaks, recent trades and Zella raw metrics.
- Dashboard charts/calendar/recent trades consume aggregate data instead of requiring the full historical trade set.
- Initial Dashboard load no longer background-hydrates the entire trade history; full history hydration is reserved for non-Dashboard views that still need local trade analysis.
- Dashboard statistics fallback was optimized to reduce repeated sorting/grouping work.

## Still requires real environment execution

These cannot be truthfully certified from the local ZIP alone:
- Applying the new migration to the real Supabase project.
- Running the two-user cross-account authorization attack test against real auth/RLS.
- Running the readonly orphan-data diagnostic against the real database and repairing deterministic legacy anomalies.
- Running the production build and browser E2E in the actual CI/staging environment.
- Reviewing enforced CSP against all production third-party resources.
- Running mixed read/write k6 load tests against the staging Supabase project.

The application must not be marked production-ready until those environment-level gates pass.

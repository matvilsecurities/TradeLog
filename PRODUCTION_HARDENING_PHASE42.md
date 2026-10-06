# TradeLog — Production Hardening Phase 42

Implemented in this build:

- Idempotent trade and missed-trade persistence using `client_operation_id`.
- UI save locks for Trade Modal, Guided Entry, and Missed Trade Modal.
- Retry/backoff for transient Supabase reads/writes and signed-URL generation.
- Server-side trade validation for direction, quantity, symbol, date, and account ownership.
- Database triggers that enforce account ownership for direct writes to trades, missed trades, broker connections, sync runs, and executions.
- Database trigger that prevents trade images from referencing another user's trade/missed trade.
- Unique trade-image type indexes so retrying an upload cannot create duplicate metadata rows.
- Atomic DB deletion for trades and missed trades; Storage cleanup happens only after the database deletion succeeds.
- GitHub Actions production QA workflow.
- k6 staging load-test harness for 1,000 authenticated virtual users.

## Required Supabase work

Apply the migrations in order, including:

- `supabase/migrations/20260926_scalability_indexes.sql`
- `supabase/migrations/20260926_production_hardening.sql`
- `supabase/migrations/20260926_production_hardening_v2.sql`

After applying them, verify the policies/triggers/indexes and run the staging load test before production traffic.

## Load test

The k6 scenario expects:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TRADELOG_TEST_TOKENS_JSON` — JSON array of pre-created staging-user JWT access tokens.

Run against staging first. Do not use real production user credentials for the test.

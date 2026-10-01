# TradeLog — Production Hardening Final Block

## Implemented

### Data integrity
- Atomic trade + mistake persistence through PostgreSQL RPC.
- Atomic missed-trade persistence.
- Atomic trade and missed-trade database deletion.
- Server-side account ownership validation.
- Server-side trade field validation.
- Server-side trade-image parent ownership validation.
- Optimistic concurrency protection inside the transaction.

### Duplicate protection
- `client_operation_id` on trades and missed trades.
- Unique per-user operation indexes.
- Save buttons lock while a request is in progress.
- Idempotent retry behavior for ambiguous network failures.

### Reliability
- Exponential backoff for transient Supabase/network failures.
- Signed image URL generation retries.
- Database deletion commits before Storage cleanup so a Storage failure cannot leave a deleted trade record behind.

### Storage security
- `trade-images` bucket is private.
- Per-user Storage policies remain enforced.
- Parent trade/missed-trade ownership is enforced in the database.
- Screenshot uploads are restricted to PNG/JPEG/WebP and 10 MB per object by the final migration.

### Deployment / QA
- GitHub Actions production QA workflow added.
- k6 staging load-test harness added for 1,000 authenticated VUs.
- 37/37 active verification suites passed.
- 13/13 deep QA checks passed.
- 24/24 production-hardening checks passed.
- 149 JS/JSX/MJS files parsed with zero syntax diagnostics.

## Supabase actions required before production

Apply these migrations in this order:

1. `supabase/migrations/20260926_scalability_indexes.sql`
2. `supabase/migrations/20260926_production_hardening.sql`
3. `supabase/migrations/20260926_production_hardening_v2.sql`

If using Supabase CLI, run the project's normal migration deployment flow from the repository. If using the Supabase SQL Editor, execute the migration SQL in order and verify that no statement reports an error.

After migration, verify:

- RLS is enabled on core user-owned tables.
- `trade-images` is private.
- Storage policies exist for the authenticated user's UUID path.
- The new indexes exist.
- The new RPC functions exist and are executable by `authenticated`.
- No service-role key is present in Vite client environment variables.

Then run the 1,000-user k6 test against staging with 1,000 pre-created staging-user access tokens. Do not use real production credentials for load testing.

# Phase 25 — Durable Connector & Multi-Account Persistence

## Scope

Phase 25 moves connector identity, external trade IDs, and TradeLog account association from browser-only state into Supabase.

### Implemented
- `trades.account_id` persists the TradeLog account assignment.
- `trades.connector_id`, `trades.external_trade_id`, `trades.external_account_id`, and `trades.source` persist broker/prop-firm provenance.
- Unique per-user connector/external-trade index prevents duplicate connector imports.
- `broker_connections` persists per-user/per-account connector state and metadata.
- RLS policies restrict connector records to the authenticated user.
- Connector metadata persistence explicitly strips access tokens, refresh tokens, passwords, and client secrets.
- Existing Phase 23 localStorage connector state remains as a compatibility fallback.
- Tradovate import deduplication now queries Supabase first.
- Existing manually entered trades default to the `primary` TradeLog account when no account ID is present.

## Supabase migration

Run:

`supabase/migrations/20260920_connector_persistence.sql`

once in the Supabase SQL Editor.

The migration is additive: it does not delete or rewrite existing trade records except to assign `account_id = 'primary'` where the new nullable field has no value.

## Security

OAuth access/refresh tokens are not persisted by this phase. Connector metadata is intentionally filtered before database persistence.

## Result

Account association and connector external IDs survive browser reloads and device changes, provided the same authenticated Supabase user is used. The connector UI remains read-only.

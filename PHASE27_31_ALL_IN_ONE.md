# Phases 27–31 — Unified Operations, Live Events, Compliance, Intelligence & Security

## Phase 27 — Unified Live Sync Engine
Centralizes manual and automatic synchronization for connected read-only connectors, records imported/skipped/error counts, and persists sync history in `connector_sync_runs`.

## Phase 28 — Event Processing Foundation
Adds a connector event normalizer/classifier and a WebSocket event-stream hook. It is deliberately endpoint-driven: TradeLog does not invent a BlackArrow stream or claim a provider supports WebSockets unless an approved endpoint is supplied.

## Phase 29 — Live Compliance Monitoring
Adds threshold monitoring for daily loss, drawdown, and position risk. Alerts are advisory/monitoring only; no automatic liquidation or order blocking is implemented.

## Phase 30 — Advanced Account Intelligence
Adds expectancy, recovery factor, clean-trade rate, process efficiency, imported-data freshness, and account-health signals using existing TradeLog statistics. These are descriptive/rule-based metrics, not predictive claims.

## Phase 31 — Production Security Audit
Adds a runtime security-audit utility and QA checks covering client-side secret exposure patterns, OAuth state validation, read-only connector posture, and existing Netlify security headers. OAuth client secrets remain server-side.

### Required Supabase migration
Run `supabase/migrations/20260920_sync_engine.sql` once in the Supabase SQL Editor to persist sync history.

### Important scope boundary
Phases 27–31 provide the orchestration and production foundation. Actual external synchronization still requires valid provider authorization/bridge configuration. No unsupported BlackArrow trader API is invented, and no connector gains order-placement capability.

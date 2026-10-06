# Phase 23 — Broker & Prop-Firm Data Connectors

## Scope

Phase 23 introduces a read-only connector architecture and starts with The5ers Futures on BlackArrow. The design is intentionally adapter-based so Tradovate and NinjaTrader can be added without changing the journal's trade model.

## BlackArrow rollout

The5ers currently lists BlackArrow as the supported Futures trading platform. TradeLog therefore provides a dedicated `the5ers-blackarrow` connector profile, normalized trade ingestion, account-scoped connection state, duplicate tracking, bridge synchronization hooks, and JSON/CSV import.

The public BlackArrow documentation reviewed for this phase did not expose a documented trader-facing API contract for The5ers users. BlackArrow's B2B material advertises REST API and webhook capabilities for prop-firm integrations, but TradeLog does not assume that those interfaces are available to an individual trader account. No undocumented endpoint, password flow, or session-token scraping is implemented.

## Connector contract

A local or officially approved bridge may expose:

- `GET /health` — returns HTTP 2xx when reachable.
- `GET /snapshot` — returns either an array of trades or `{ trades: [...] }` / `{ fills: [...] }` / `{ data: [...] }`.

TradeLog normalizes common fields including symbol, direction, quantity, entry/exit, P&L, timestamp, and external trade/fill ID.

## Safety

- Read-only connector phase; no order placement, cancellation, or position management.
- Browser local storage contains connection metadata and imported external IDs only; passwords/session tokens are not stored.
- Duplicate imports are skipped using external IDs tracked per user/account/connector.
- Connector state is isolated by TradeLog user and active account.

## Next connector rollout

Apex Tradovate is next. The official NinjaTrader/Tradovate API exposes account, order, fill, position, accounting, REST and WebSocket capabilities. NinjaTrader Desktop connectivity to Apex Tradovate accounts is also documented by Apex. Those APIs will be added as separate adapters after BlackArrow validation.

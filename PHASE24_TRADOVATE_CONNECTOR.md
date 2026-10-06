# Phase 24 — Apex · Tradovate Read-Only Connector

## Scope

This phase adds a real OAuth-based, read-only Tradovate connector using the official NinjaTrader Trade API.

### Implemented
- NinjaTrader/Tradovate OAuth authorization-code flow.
- Server-side OAuth code exchange in Netlify; the client secret never enters React code.
- Access token kept in browser memory only; it is not written to localStorage.
- Dynamic API host support from authentication responses, with official live/demo fallbacks.
- Account discovery and explicit external-account → active TradeLog-account mapping.
- Read-only retrieval of accounts, orders, fills, positions, cash balances and contract metadata.
- FIFO pairing of Tradovate fills into completed TradeLog trades.
- MNQ and MGC futures point-value P&L normalization.
- Duplicate protection using connector external IDs in the existing connection state.
- No order placement, cancellation, liquidation, or account mutation endpoints.

## Official sources used
- NinjaTrader Authentication & Access: https://docs.ninjatrader.com/api/authentication
- NinjaTrader OAuth Integration: https://docs.ninjatrader.com/api/oauth
- NinjaTrader Dynamic API Hosts: https://docs.ninjatrader.com/api/dynamic-api-hosts
- NinjaTrader API Conventions: https://docs.ninjatrader.com/api/conventions
- NinjaTrader Fill List: https://docs.ninjatrader.com/api/rest-api-endpoints/orders/fill-list
- NinjaTrader WebSockets: https://docs.ninjatrader.com/api/websockets

## Required deployment configuration

### Vite / browser environment
`VITE_NT_CLIENT_ID` and `VITE_NT_ENVIRONMENT`.

### Netlify environment
`NT_CLIENT_ID`, `NT_CLIENT_SECRET`, `NT_OAUTH_REDIRECT_URI`, and `NT_ENVIRONMENT`.

The redirect URI must exactly match the URI registered for the NinjaTrader OAuth application.

Example:
`https://YOUR-SITE.netlify.app/.netlify/functions/tradovate-oauth-callback`

For local Netlify development, register the corresponding local callback if the OAuth application supports it.

## Security

Do not put `NT_CLIENT_SECRET` or a Tradovate password in `VITE_*` variables. Do not commit either secret. OAuth is intentionally used so the user authenticates on the NinjaTrader domain instead of giving TradeLog their password.

## Multi-account behavior

If the connected Tradovate user has multiple accounts, TradeLog requires an explicit external-account selection before importing trades. This prevents fills from one Apex/Tradovate account being silently assigned to another TradeLog account.

## Current limitation

The existing `trades` Supabase table predates the connector architecture and does not yet contain durable `account_id` / `external_trade_id` columns. Phase 24 therefore keeps connector deduplication and account mapping in the existing per-account connection state. A later persistence migration should move external IDs and account mapping into Supabase for cross-device durable synchronization.

# Phase 26 — Apex · NinjaTrader Connector

## Scope
Read-only NinjaTrader Trade API connector for Apex-linked NinjaTrader/Tradovate accounts.

## Verified architecture
- NinjaTrader documents OAuth authorization-code flow for third-party applications.
- Access tokens are used with the official Trade API.
- API hosts returned by authentication are authoritative and are used for subsequent calls.
- TradeLog reads accounts, orders, fills, positions, cash balances and contract metadata.
- Completed trades are normalized using the existing FIFO fill engine and stored with connector identity `apex-ninjatrader` and source `NinjaTrader`.
- Existing Supabase external-trade-ID dedupe is reused.
- No order placement, cancellation, liquidation, or other write endpoint is implemented.

## Apex relationship
Apex documents that Tradovate accounts can be accessed through NinjaTrader Desktop. The TradeLog connector therefore uses the official NinjaTrader Trade API infrastructure rather than inventing a separate undocumented Apex API.

## Security
- Client ID may be exposed through Vite configuration.
- Client secret remains server-side in Netlify environment variables.
- OAuth access tokens remain in browser session memory only and are not written to localStorage/sessionStorage.
- This phase does not require a new Supabase migration.

## Required environment
Browser/local:
- `VITE_NT_CLIENT_ID`
- `VITE_NT_ENVIRONMENT=live` or `demo`

Netlify server-side:
- `NT_CLIENT_ID`
- `NT_CLIENT_SECRET`
- `NT_OAUTH_REDIRECT_URI`
- `NT_ENVIRONMENT`

## Testing
Run:
- `npm run verify:ninjatrader`
- `npm run verify:tradovate`
- `npm run build`

Do not claim a live OAuth connection until a valid NinjaTrader OAuth application and redirect URI are configured.

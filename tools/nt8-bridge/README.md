# TradeLog NinjaTrader 8 Local Bridge

Read-only local bridge for the TradeLog NinjaTrader Desktop Add-On.

## Start

From the TradeLog project root:

```powershell
npm run bridge:nt8
```

Default endpoints:

- `GET http://127.0.0.1:4815/health`
- `GET http://127.0.0.1:4815/snapshot`
- `WS ws://127.0.0.1:4815/events`
- `POST http://127.0.0.1:4815/ingest`

The bridge binds to loopback by default and is intended for the same Windows machine running NinjaTrader Desktop.

## Security boundary

The bridge is local-only by default. It does not accept broker credentials and it does not expose order-placement endpoints. The Add-On only publishes account/order/execution/position/account-value observations.

## Environment

```text
TRADELOG_BRIDGE_HOST=127.0.0.1
TRADELOG_BRIDGE_PORT=4815
```

# Phase 38 — Live Broker Integration & Auto-Journaling

## Scope

Phase 38 adds the first actual NinjaTrader Desktop observation path to TradeLog. It is deliberately read-only.

### Verified platform capability

NinjaTrader's official Add-On documentation states that AddOns can access account information and monitor account, position, and order information. The Account API exposes `Executions`, `Orders`, `Positions`, `ExecutionUpdate`, `OrderUpdate`, `PositionUpdate`, and `AccountItemUpdate`. NinjaTrader also documents `Account.ExecutionUpdate` for observing fills and notes that execution pairing can be used to reconstruct trades.

Sources:
- https://developer.ninjatrader.com/docs/desktop/addon_development_overview
- https://docs.ninjatrader.com/ninjascript/executionupdate
- https://ninjatrader.com/support/helpguides/nt8/account_class.htm

## Architecture

NinjaTrader 8 → TradeLog Add-On → local loopback bridge → WebSocket event stream → TradeLog sync/event processor → Supabase.

## Read-only boundary

The Add-On does not call `Account.Submit`, `Account.Change`, `Account.Cancel`, or `Account.Flatten`. It only subscribes to account events and reads account collections.

## Files

- `ninjatrader/TradeLogBridgeAddOn/TradeLogBridgeAddOn.cs`
- `tools/nt8-bridge/server.mjs`
- `tools/nt8-bridge/README.md`

## Local bridge

Run from the project root:

```powershell
npm run bridge:nt8
```

Then verify:

```powershell
Invoke-RestMethod http://127.0.0.1:4815/health
Invoke-RestMethod http://127.0.0.1:4815/snapshot
```

## NinjaTrader installation

The C# file is a NinjaScript Add-On source. NinjaTrader's official Add-On documentation supports developing AddOns in the NinjaScript Editor or a Visual Studio solution. Import/compile it using the NinjaTrader-supported workflow for the installed version. Do not install it into the web project's `src` directory.

## Acceptance test

1. Start `npm run bridge:nt8`.
2. Confirm `/health` returns `ok: true`.
3. Compile/load the Add-On in NinjaTrader Desktop.
4. Connect an account.
5. Confirm `/snapshot` contains the account.
6. Execute a small permitted test trade only if desired; TradeLog must receive an execution event.
7. Confirm the Trading Operations → NinjaTrader Bridge tab reports a connected event stream.
8. Confirm no order-placement endpoint exists in the local bridge.

## Limitations

- This phase does not claim that the Add-On has been compiled against the user's exact NinjaTrader build.
- NinjaTrader version/provider-specific behavior must be tested on the user's Windows installation.
- The Add-On observes execution/order/position/account events; TradeLog still performs its own FIFO trade reconstruction.

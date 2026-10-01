# Phase 39 — Live Trade Capture & Execution Analytics

## Scope
Phase 39 turns the existing NinjaTrader read-only event bridge into an execution-driven TradeLog journal workflow.

### Implemented
- Automatic NinjaTrader execution event capture over the local `/events` WebSocket.
- Execution-ID based duplicate protection.
- FIFO position-lot aggregation.
- Multiple entries / scale-ins with weighted-average entry price.
- Partial exits and cumulative realized P&L.
- Final-exit detection when captured quantity reaches zero.
- Reversal handling: closing lifecycle is finalized and the opposite position starts a new journal lifecycle.
- Automatic account mapping through the selected NinjaTrader external account.
- Live journal records are created/updated without manual journal entry.
- Execution IDs and capture metadata are attached to captured trades.
- Durable `trade_executions` ledger with user/account/connector RLS.
- Local execution-state fallback so the feature remains useful if the Phase 39 migration has not yet been applied.
- State recovery from the durable execution ledger when local state is unavailable.
- Position reconciliation between captured lots and NinjaTrader position events.
- Live Capture workspace inside Trading Operations.
- Read-only posture retained: no order placement, modification, cancellation, or liquidation.

## Supabase migration
Run:

`supabase/migrations/20260920_live_trade_capture.sql`

This adds live-trade metadata columns to `trades` and creates the `trade_executions` table with RLS and unique execution-ID protection.

## Usage
1. Run the existing local NT8 bridge.
2. Install/enable the TradeLog NinjaTrader Add-On.
3. Open **Trading Operations → Live Capture**.
4. Confirm the bridge URL (`http://127.0.0.1:4815` by default).
5. Test the bridge.
6. Select the correct NinjaTrader account in **Connections** if multiple accounts exist.
7. Enable **Auto-capture**.
8. New executions are journaled automatically.

## Lifecycle model

`Execution → FIFO lots → Open journal → Scale-in / partial exit → Final exit → Finalized journal`

A reversal is represented as two lifecycles: the existing position is closed, then the remaining quantity opens a new opposite-direction journal.

## Validation
Run:

`npm run verify:live-trade-capture`

The verifier checks the aggregation engine, duplicate protection, reconciliation, WebSocket capture, durable ledger, UI integration, App wiring, and NinjaTrader order-action payload.

## Build status
Static Phase 39 QA can be run independently. A full Vite production build should still be run on the user's Windows environment because the development environment may not contain the user's Windows-native Vite/Rolldown binary.

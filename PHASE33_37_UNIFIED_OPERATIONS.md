# Major Phase — Unified Trading Operations Suite (Phases 33–37)

This release consolidates the planned desktop bridge, automated trade lifecycle, real-time risk/compliance, advanced account intelligence, and multi-account command center into one operational workspace.

## Included
- Trading Operations Center with Overview, Live Risk, Trade Lifecycle, Intelligence, Accounts, and NinjaTrader Desktop Bridge tabs.
- Read-only NinjaTrader Desktop Bridge contract with configurable local `/health` and `/events` endpoints.
- Trade lifecycle classification for unresolved, open, partially filled, and closed journal records.
- Daily P&L, daily-loss remaining, drawdown remaining, open-risk and compliance status calculations.
- Historical expectancy, win rate, profit factor, average R:R, clean-trade rate, and recovery-factor metrics.
- Multi-account P&L/trade-count overview.
- Existing connector sync engine, durable connector persistence, and security audit remain intact.
- No order placement, cancellation, liquidation, or predictive trading signals are introduced.

## Important boundary
The NinjaTrader Desktop Bridge tab is an integration contract and local endpoint tester. It does not fabricate or claim a trader-facing NinjaTrader Add-On API. A real NT8 Add-On/local adapter must be installed and expose the documented read-only endpoints before the bridge can connect.

# TradeLog Playbook UI/UX Redesign — 29 Sep 2026

## Source of truth
The Dashboard UI is the canonical visual reference for Playbook in both light and dark themes.

## Implemented
- Rebuilt Playbook visual hierarchy around the Dashboard header, KPI, card, border, spacing and control system.
- Net P&L remains the first KPI, followed by Playbooks, Journaled trades, Win rate and Profit factor.
- KPI typography increased by 0.5px where requested while preserving compact sizing.
- Account selector defaults to All active accounts while retaining All accounts and grouped active/blown account choices.
- Blown accounts remain accessible in the selector.
- Reworked control/popover/card/modal styling for both themes.
- Compare workspace includes strategy picker, per-strategy KPI cards, cumulative P&L chart, expanded comparison analytics, and trade sample.
- Added wins/losses, average R, maximum drawdown and maximum loss streak to strategy comparison metrics when source trade data supports them.
- Fixed invalid trade-date presentation in Trade Sample; undated/invalid values now display as Undated.
- Preserved actual journal trade data as the source for comparison curves; no decorative performance data is generated.
- Core sidebar workspace chunks are prefetched after authentication to reduce first-click route latency.
- Removed `view` from the `useTradeData` reload dependency so switching between Dashboard, Journal Ledger and Playbook no longer restarts the main data load.

## Verification
- `npm test`: PASS
- `verify:all`: 38/38 active suites PASS
- Professional UI: PASS (12/12)
- Responsive UX: PASS (7/7)
- Account selector: PASS (7/7)
- Production hardening: PASS (28/28)
- `npm run build`: could not execute because the provided environment's Vite binary is unavailable; `npm ci --ignore-scripts` timed out. Build remains an environment-level release gate.

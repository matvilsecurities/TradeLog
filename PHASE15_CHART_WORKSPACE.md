# Phase 15 — Chart Workspace & TradingView Integration

## Scope
Adds a dedicated Chart Workspace for visual post-trade review using the existing TradingView loader, trade metadata, TradingView URLs, and stored screenshots.

## Features
- Dedicated Chart Workspace navigation.
- Search and symbol filtering across recorded trades.
- 5-minute TradingView chart using existing symbol mapping.
- Entry, SL, TP, exit, risk, R:R and session metadata.
- Before-entry and after-exit screenshot evidence.
- Direct Open My Chart action when a chart URL exists.
- Direct Trade Review → Chart Workspace handoff.
- No database schema changes or data mutation.

## QA
Run `npm run verify:charts` and `npm run build` on the target Windows environment.

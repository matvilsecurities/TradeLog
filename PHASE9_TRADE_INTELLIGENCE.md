# Phase 9 — Advanced Trade Intelligence

## Purpose
Phase 9 adds a descriptive intelligence layer on top of the centralized Phase 7 performance engine. It does not change stored trade data or invent a new database schema.

## Added
- `src/hooks/useTradeIntelligence.js`
  - expectancy per trade and decisive expectancy
  - profitable-day consistency
  - recovery factor
  - win/loss streaks
  - session, symbol, setup and direction expectancy
  - setup × session edge matrix
  - checklist impact / win-rate delta
  - mistake impact / average P&L
  - setup-grade comparison
  - news-check comparison
  - deterministic descriptive signals with minimum-sample guardrails
- `src/components/analytics/TradeIntelligence.jsx`
  - Overview
  - Edge Map
  - Behavior & Risk
- Added Trade Intelligence to the sidebar and App routing.
- Added `npm run verify:intelligence`.

## Data integrity
No Supabase schema changes. Existing trade records remain compatible. The feature is read-only over the journal data.

## Interpretation
Statistics are descriptive. Small samples can be unstable; the UI avoids treating groups with fewer than 3 trades as repeatable edges and setup/session combinations require at least 2 trades for the matrix.

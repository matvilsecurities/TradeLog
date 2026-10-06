# Phase 7 — Analytics & Performance Intelligence

## Scope
Centralize performance calculations so Dashboard, Analytics, Edge Analysis, Day Detail, and the application-level stats object use one shared performance layer.

## Changes
- Added `src/hooks/usePerformanceStats.js`.
- Centralized P&L classification, win/loss/breakeven counts, win rate, profit factor, averages, R:R, hold time, equity curve, drawdown, daily performance, weekday performance, setup/symbol/direction/session performance, monthly performance, checklist performance, grade performance, and mistake performance.
- Updated `App.jsx` to use `usePerformanceStats` instead of the legacy `calcStats` calculation for the application stats object.
- Updated `Analytics.jsx` to consume shared performance data.
- Updated `EdgeAnalysis.jsx` to consume shared checklist/grade/mistake performance data.
- Updated `DayDetail.jsx` to use the same decisive-trade win-rate logic as the shared performance layer.
- Existing visual structure and CSS were preserved.
- Existing `tradeStats.js` and legacy `calcStats` remain for compatibility with any future/hidden consumers; App no longer depends on it.

## Verification
- `verify:performance` passed.
- TypeScript parser checked all 47 JS/JSX source files: 0 syntax errors.
- No external dependencies were added.

## Note
A full Vite production build still needs to be run in the user's Windows environment, where the project's native dependency environment is authoritative.

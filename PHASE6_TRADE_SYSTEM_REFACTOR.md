# Phase 6 — Trade System Refactor

Implemented in one pass from the verified Phase 5E baseline.

## Changes
- Added `src/components/trades/tradeUtils.js` as the shared calculation/validation layer.
- Centralized symbol multipliers, P&L, risk, reward, R:R, holding time, formatting, notes, and grade helpers.
- Hardened Trade Log filtering/sorting/pagination against missing values.
- Added trade-entry validation for required fields, quantity, SL side, and TP side.
- Trade modal now displays validation errors and prevents invalid saves.
- Trade modal calculations use the shared trade calculation layer.
- Mistake selections are explicitly included in the save payload.
- Removed the duplicate modal close call; the parent now owns modal lifecycle.
- `useTradeData` now resolves the previous trade from current state for screenshot-removal detection instead of relying on an editing prop closure.
- Hardened trade list sorting when dates are missing.
- Preserved Supabase schema, authentication, existing TradingView integration, screenshots, guided entry, and existing CSS/UI.

## Deliberately not changed
- No new database columns or migrations were introduced.
- Multiple-position/leg persistence was not invented because the current Supabase schema exposed by the project does not define a position-leg table. Existing quantity-based sizing remains intact.
- No visual redesign was performed in this phase.

## Verification
A static source scan should be followed by `npm install`, `npm run build`, and manual trade-flow QA on Windows.

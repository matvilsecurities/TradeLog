# Phase 10 — Risk & Position Management

## Scope
Phase 10 adds a dedicated pre-trade risk workspace without changing the existing Supabase schema or trade records.

## Added
- Risk & Position Manager sidebar view.
- Symbol-aware point-value calculations for MNQ and MGC.
- Long/Short stop and target distance calculations.
- Dollar risk and reward calculations.
- Planned R:R calculation.
- Optional weighted-average scale-in entries.
- Maximum quantity based on a user-defined per-trade risk limit.
- Account-risk percentage.
- Today's logged risk and projected daily risk after the planned trade.
- Pre-trade guard indicators for per-trade risk, daily risk, and R:R.

## Safety behavior
The workspace is advisory: it does not silently block trade saving or mutate existing trades. It gives explicit pre-trade warnings when the planned risk exceeds the limits entered by the user.

## Verification
`npm run verify:risk` checks the required files and risk-management integration points.

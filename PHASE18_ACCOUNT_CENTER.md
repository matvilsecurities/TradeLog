# Phase 18 — Account Center & Prop-Firm Command Center

Phase 18 consolidates account-level status into a dedicated Account Center while preserving the existing Apex dashboard and settings calculations.

## Added
- Account Center navigation and workspace
- Current equity, logged P&L and high-water mark
- Available drawdown and daily loss capacity
- Trading-day, profitable-day and consistency requirements
- Profit-target progress
- Payout eligibility/requestable amount context
- Equity progression chart
- Account Settings remains the configuration source
- New `useAccountCenter` derived-state hook

## Data safety
No database schema changes were introduced. Account Center derives its values from the existing authenticated trade data and account settings.

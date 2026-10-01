# TradeLog Test Build — Playbook + Multi-Account Fixes

## Playbook
- Removed the hard-coded sample playbook dataset.
- Playbook cards are now generated from the real `trades` prop.
- Existing human-readable setup/playbook fields are used when present.
- Older trades fall back to their persisted setup checklist.
- Stats are calculated from real journal P&L: trade count, win rate, net P&L, profit factor, expectancy, average winner and average loser.
- The Playbook account selector now filters the real trade set by `accountId` and supports All accounts.

## Multi-account
- Fixed the authentication hydration race that could load the anonymous portfolio and overwrite the authenticated user's stored account list.
- Account portfolio is now hydrated when the authenticated Supabase user ID becomes available before persistence starts.
- Creating a secondary account no longer writes its settings into the legacy/global primary settings record.
- Switching/saving a secondary account keeps its settings scoped to that account.
- Dashboard account dropdown receives the complete account list from the portfolio hook.

## Testing
- `node --check src/hooks/useAccountPortfolio.js` passed.
- `node --check src/supabase.js` passed.
- `node scripts/verify-account-selector.mjs` passed.
- A production Vite build could not be executed in this environment because dependency installation timed out; run `npm install` then `npm run build` locally.

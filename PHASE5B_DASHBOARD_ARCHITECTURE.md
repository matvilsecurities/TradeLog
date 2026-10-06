# TradeLog — Phase 5B Dashboard Architecture

Implemented:

- Added `src/hooks/useDashboardStats.js` as the centralized dashboard statistics layer.
- Moved dashboard P&L, win/loss, averages, profit factor, R:R, holding-time, trade-streak, day-streak, and daily-performance calculations into the hook.
- Updated `TradeJournalDashboard.jsx` to consume the centralized statistics object.
- Updated `DailyBars` to consume centralized `dailyPerformance` rather than recalculating the trade array.
- Preserved existing dashboard UI/CSS and existing P&L chart implementation.

Verification note:
- The source was prepared from the Phase 4 project baseline.
- A local Vite build could not be completed in this Linux environment because the supplied `node_modules` archive contains Windows-native executables (`vite` permission/native binary mismatch). Run `npm install` and `npm run build` on Windows before accepting the phase.

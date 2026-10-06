# Phase 5D Refresh Fix

## Issue
The Dashboard Refresh button used `window.location.reload()`. A full browser reload could reset the in-memory Supabase session before the auth session was restored, sending the user to the Login screen.

## Fix
Refresh is now an in-app data refresh:
- `useTradeData` exposes `refreshData()`.
- `refreshData()` refetches trades, missed trades, and settings from Supabase.
- `App.jsx` passes `refreshData` to `TradeJournalDashboard`.
- `DashboardHeader` calls the callback instead of `window.location.reload()`.

No browser/page reload occurs.

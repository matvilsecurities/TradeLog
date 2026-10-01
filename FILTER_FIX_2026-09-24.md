# Dashboard Filters Fix — 2026-09-24

## Problem
The Dashboard header Filters button was a non-functional button. It had no click handler and did not affect Dashboard/Analysis data.

## Fix
Implemented a functional account-status filter with:
- Active Accounts
- Blown Accounts
- Passed Accounts
- All Account Statuses

The filter is wired to the same canonical account objects used by the Dashboard account selector and trade-account mapping.

## Behavior
- Default remains Active Accounts, preserving the previous Dashboard behavior.
- All Accounts + Blown Accounts shows trades belonging to historical blown/failed/closed/inactive accounts.
- All Accounts + Passed Accounts shows trades belonging to passed/cleared historical evaluations.
- All Accounts + All Account Statuses aggregates every account.
- Selecting a specific account resets the status filter to Active and locks status filtering because the selected account is already explicit.
- The active filter shows a count badge and highlighted button state.
- Analysis views receive the same filtered Dashboard trade set, so filtering is not merely cosmetic.

## Verification limitation
The sandbox did not have node_modules. `npm run build` could not execute because Vite was unavailable; `npm ci` timed out in the sandbox. The source changes were inspected statically.

# Phase 40 — TradeLog Sidebar Redesign

## Scope
Full sidebar customization with a light-theme professional layout and a real Account Settings dropdown.

## Navigation
- Workspace
- Analysis
- Account
- Account Settings
  - Account Alerts
  - Compliance Center
  - Prop Firm Setup
  - Trading Operations
  - Connections
  - Multi-Account Center
  - Data Center
- Tools

## UX
- Account Settings opens/closes with local React state.
- Current child route automatically keeps the menu open.
- Submenu has an indented guide line and active state.
- Data Center was moved out of Workspace into Account Settings.
- Independent sidebar scrolling is preserved.
- Existing account selector, Log Trade, theme toggle, Guided Entry and all routes are preserved. The Account Settings parent opens the existing Apex Settings route while also controlling the dropdown.

## Visual system
- 280px desktop sidebar.
- Light white/slate surface.
- Purple accent system.
- Larger brand/account/action treatment.
- Two-line settings items with descriptions.
- Compact scrollbar and fixed footer.
- Dark-theme counterpart retained.

## Validation
`npm run verify:sidebar-redesign` passes with 16 checks.

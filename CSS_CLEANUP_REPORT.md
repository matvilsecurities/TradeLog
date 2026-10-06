# TradeLog CSS Cleanup — Phase 2

## What was changed

- Removed the confirmed 1,501-line duplicated block from `TradeJournalDashboard.css`.
- Removed a second duplicated trading-calendar control block from `TradeJournalDashboard.css`.
- Removed 15 exact duplicate calendar rules from the dashboard stylesheet where the later copies were redundant.
- Centralized shared motion/interaction rules into `src/styles/animations.css`.
- Centralized login-screen styles into `src/styles/login.css`.
- Removed duplicated login styles from `TradeJournalDashboard.css`.
- Reduced `app.css` to the remaining global App-shell styles instead of mixing login/animation concerns into it.
- Added the new CSS imports to `App.jsx`.
- Kept the existing component-specific stylesheet names and visual rules otherwise intact.
- Verified all CSS files have balanced braces.
- Verified all relative JS/JSX/CSS imports resolve.

## Size impact

`TradeJournalDashboard.css`: 5,354 → 3,569 lines.

`app.css`: 227 → 41 lines.

Two dedicated stylesheets were added:

- `animations.css`
- `login.css`

## Build note

The project was checked with the supplied dependency tree. The local build environment cannot execute Vite's Rolldown native Linux binding because the supplied `node_modules` was installed for Windows. This is an environment/platform issue, not a source import error.

Run locally on Windows:

```bash
npm install
npm run build
npm run dev
```

Do not copy the supplied Windows `node_modules` into a Linux environment.

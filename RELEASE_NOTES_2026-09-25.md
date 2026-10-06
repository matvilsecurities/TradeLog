# TradeLog Release Candidate — 2026-09-25

## Scope
This release intentionally removes broker synchronization from the active product surface. NinjaTrader, Tradovate, local bridge and live auto-journaling code is retained only as deferred integration work and is no longer wired into the main App or Sidebar.

## Repairs
- Removed active broker/synchronization hooks and routes from `App.jsx`.
- Removed Trading Operations and Connections from the active Sidebar.
- Added a functional Dashboard CSV Export button for the currently visible account/date dataset.
- Added a functional Dashboard date menu that switches between latest trading month and all dates.
- Added actions to the Dashboard calendar toolbar: weekly-summary toggle, compact view toggle and calendar information panel.
- Added a local QA dashboard server at `http://127.0.0.1:4173` via `npm run qa:dashboard`.
- Added `npm run qa:deep` for independent high-level, stress and isolation checks.
- Updated `npm run verify:all` so deferred broker tests do not block the current release.
- Removed broker OAuth variables from `.env.example` so a future integration cannot be accidentally enabled by configuration alone.

## Verification
- Active built-in verification: **34/34 passed**.
- Independent deep QA: **11/11 passed**.
- Dashboard statistics load test: **100,000 synthetic trades processed in ~1.41s** in the audit runtime.
- Execution stress: **5,000 synthetic executions** processed with lifecycle aggregation and deduplication checks.
- Multi-user isolation simulation: **5 users × 1,000 synthetic trades** with no cross-user leakage in the model test.
- Dashboard dead-control scan: no dashboard `<button>` without an action handler was found in the audited dashboard component set.
- Local QA server was started and HTTP-verified successfully.

## Known environment limitation
A production Vite build could not be executed in the audit container because the uploaded project did not contain a usable dependency installation and npm registry access timed out. The source/import/static QA suite passes, but `npm run build` must still be run in an environment with npm dependencies available.

## Deferred
- NinjaTrader OAuth
- Tradovate synchronization
- Broker account mapping
- Live execution capture
- NinjaTrader desktop bridge
- Automatic broker trade import

These should be reintroduced as a separate integration phase after the core manual-journaling release is stable.

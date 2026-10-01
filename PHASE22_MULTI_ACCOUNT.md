# Phase 22 — Multi-Account Command Center

## Scope
Phase 22 extends the Phase 21 compliance/alert system from a single active account into a persistent multi-account workspace.

## Delivered
- Persistent per-user account registry using localStorage.
- Active-account selector in the main sidebar.
- Multi-Account Command Center with account cards and aggregate portfolio KPIs.
- Account creation, switching, renaming and removal (primary account protected).
- Account-specific trade filtering. Existing unassigned trades remain mapped to the primary account for backward compatibility.
- New trades are tagged with the active `accountId` without requiring a new database column.
- Account-specific settings, prop-firm rules, compliance and alert history.
- Account-specific Account Center, Risk Manager, Compliance Center, Account Alerts, analytics and journal views through the active-account context.
- Phase 19 rule snapshots and Phase 20/21 compliance logic preserved.
- Switching accounts synchronizes the active account settings through the existing settings persistence path.

## Data model
No Supabase schema migration was introduced. Account profiles and active-account selection are stored locally per authenticated user. Existing trade records without `accountId` are treated as belonging to the protected `primary` account.

## QA
- Multi-account QA: 10 checks passed.
- Compliance QA: 10 checks passed.
- Compliance alerts QA: 10 checks passed.
- Prop-firm rules QA: 10 checks passed.

A Vite production build was not executed in the build container because the extracted archive does not contain a runnable Vite binary in `node_modules/.bin`. The source and project-level QA checks passed; run `npm install` followed by `npm run build` in the Windows project environment.

# Phase 20 — Prop-Firm Rule Enforcement & Live Compliance

Phase 20 connects the active Phase 19 firm/program rule snapshot to the journal's live risk and trade-entry workflow.

## Added
- Central compliance engine: `src/services/propFirmCompliance.js`
- React hook: `src/hooks/usePropFirmCompliance.js`
- Compliance Center: `src/components/apex/ComplianceCenter.jsx`
- Trade-entry preflight guard in `TradeModal.jsx`
- Account Center compliance summary
- Risk Manager active prop-firm guard
- Sidebar navigation for Compliance Center
- `verify:compliance` QA script

## Enforcement model
Hard guards are applied only when the active rule snapshot explicitly provides the relevant limit:
- Daily loss limit / percentage
- Maximum drawdown / maximum loss percentage
- Maximum contracts
- Maximum micros

The pre-trade guard uses the journaled current state plus the draft trade's planned risk as downside exposure. It does not predict the trade outcome.

Consistency, trading-day, profitable-day and profit-target rules are monitored as live status/warnings rather than treated as entry-time hard blocks because their qualification depends on realized results or account progression.

## Rule integrity
No missing rule is invented. The compliance engine reads `settings.propRules` from Phase 19 and retains the configured source and verification timestamp.

## QA
Run:

```bash
npm run verify:compliance
```

Expected:

`Compliance QA passed: 8 required files present; 10 compliance checks passed.`

A full Vite production build was not executed in the assistant environment because the Phase 19 archive does not include installed `node_modules`; Windows-native Vite/Rolldown dependencies therefore cannot be claimed as verified here.

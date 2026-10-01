# Prop Firm Cost Editor Fix — 2026-09-25

## What changed
- Added an **Edit Costs** action to each existing account in Prop Firm Setup.
- Added **Edit Costs** to the account detail view.
- Added a compact modal for editing actual amounts paid:
  - Price Paid
  - Activation Fee Paid
- Saves both canonical and legacy settings fields for compatibility:
  - `purchasePrice`
  - `accountPurchasePrice`
  - `activationFeePaid`
  - `accountActivationFeePaid`
- Portfolio financial totals continue to aggregate these per-account paid values.
- Existing account update persistence uses the canonical `onUpdateAccount` / `persistAccount` path.
- No catalog/official pricing is silently overwritten: the editor records the user's actual amount paid for each account.

## QA
- Prop-firm rules: 17/17
- Account center: 10/10
- Multi-account: 15/15
- Cost editor: 12/12
- PropFirmSetup JSX parser: PASS
- Prop firm CSS brace validation: PASS

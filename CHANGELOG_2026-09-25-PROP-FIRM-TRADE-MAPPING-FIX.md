# TradeLog — Prop Firm Setup Trade Mapping Fix — 2026-09-25

## Root cause

Prop Firm Setup and Portfolio Center were calling `filterTradesForAccount(trades, account.id)`. That passed only the legacy/application account ID and discarded the canonical Supabase account UUID available on the hydrated account object.

Journal Ledger already has the ability to resolve both identifiers. When a trade is associated by `trades.account_uuid`, Prop Firm Setup could therefore show zero trades even though the same trades were visible elsewhere.

## Fix

Both consumers now pass the complete account object:

```js
filterTradesForAccount(trades, account)
```

The shared resolver can then match using:

- `account.id` → `trades.account_id`
- `account.uuid` / `account.accountUuid` → `trades.account_uuid`
- established UUID-to-legacy-ID relationships

No The5ers-specific or Apex-specific hard-coding was added.

## Regression coverage

Account/trade mapping QA increased from 8 to 10 checks, including explicit checks that Prop Firm Setup and Portfolio Center pass the full account object.

Verified:

- Prop firm rules QA: 17 checks passed
- Multi-account QA: 15 checks passed
- Account center QA: 10 checks passed
- Account/trade mapping QA: 10 checks passed

The Vite production build remains unverified in this environment because the uploaded project does not contain an installed Vite executable (`vite: not found`).

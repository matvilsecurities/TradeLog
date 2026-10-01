# Audit fixes — 2026-09-29

Full findings: `TradeLog-Production-Audit-2026-09-29.md` (in this zip).

## Fixed in this build

| ID | What changed | Verified how |
|---|---|---|
| TL-009 | `package-lock.json` regenerated; records every platform's native bindings. | Clean `npm ci` + `npm run build` on Linux, no manual patching. |
| TL-003 | OAuth callback escapes `<`, `>`, `&` in inline JSON. `netlify.toml` added (build + SPA fallback). CSP added as **Report-Only**. | `npm test` (payload with `</script>` no longer breaks out). |
| TL-002 | `sortKey` always returns a number; chronological comparator with created_at/id tie-breaks; Account Center curve uses it too. | `tests/equity-order.test.mjs` (any input order gives the same HWM). |
| TL-001 | Modals no longer reuse a row's stored operation id; RPC applies the retry shortcut to inserts only; client uses the saved row's `updated_at`. | Static guard + SQL parse. **Needs the staging test below.** |
| TL-004 | Save RPCs rewritten: separate insert/update, update always scoped to `user_id = auth.uid()`, no `on conflict (id)`. | SQL parses; **needs the staging test below.** |
| TL-005 | Client no longer falls back to `"primary"` on save; editing a trade whose account can't be resolved is refused instead of re-homing it; `default 'primary'` dropped from `trades.account_id`/`missed_trades.account_id`. | Static guards; **needs staging test.** |
| TL-006 | "All Accounts" now includes blown/passed accounts by default. | Static guard. |
| TL-007 | New `tradelog_delete_account` RPC: atomic, refuses (with a clear message) if the account has trades. Archive instead. | SQL parses; **needs staging test.** |
| TL-020 | Playbook shows ∞ instead of "Infinity". | — |

## How to apply

1. Staging first. Run `supabase/migrations/20260929_write_path_and_account_fixes.sql` in the SQL editor (after the v2 hardening file).
2. Run `supabase/diagnostics/20260929_orphan_trades_readonly.sql`. Fix any rows it returns before you add NOT NULL / a foreign key on `account_id` (not done here on purpose).
3. Deploy the app. Watch the browser console for CSP Report-Only violations for a few days, then rename the header in `netlify/_headers` to `Content-Security-Policy`.
4. `npm ci && npm test && npm run build`.

## Staging tests you must run (I could not run a database)

1. Create a trade, edit its P&L, reload. The edit must persist.
2. As user B, call `tradelog_save_trade_with_mistakes` with user A's trade `id`, with and without `p_expected_updated_at`. Must error; A's row unchanged.
3. Send the same insert twice with one operation id. Exactly one row.
4. Insert into `trades` with no `account_id`. Must be rejected.
5. Delete an account that has trades: refused with a message. Delete an empty one: works.
6. 2 accounts x 10 trades: check Dashboard A, B and All Accounts.

## NOT fixed (needs a decision or more work)

- **TL-008** database baseline / uuid-vs-numeric `accounts.id`: needs `supabase db dump` from your real project.
- **TL-010** equity computed on partial history while older pages load.
- **TL-011** fractional quantity (CFD lots): blocked in 4 places; decide whether CFDs are in scope.
- **TL-012** per-firm trailing rules (lock at start balance, EOD trailing, payouts): need your rules.
- `"primary"` display fallback when *reading* trades with a null account (`fetchTradesDb`, `tradeAccountId`), and `saveMissedTradeDb`'s fallback.
- TL-013 to TL-019, TL-021, TL-022, and the areas I did not audit (PropFirmSetup, ledger filters/export, analytics, responsive, accessibility).
- Load testing: the k6 script is unchanged.

# TradeLog — Production Readiness Audit

**Build audited:** `TradeLog-LOADTEST-SEED-FIXED-2026-09-27.zip` (`tradelogv6/`, ~38k lines)
**Date:** 2026-09-29
**Verdict: NOT READY — BLOCKERS EXIST**

---

## 0. How much to trust this report (read first)

You asked me not to guess, so here is exactly what I did and did not do.

**Verified by running code:**
- TL-002 (trailing/high-water-mark ordering): I imported `src/services/propFirmCompliance.js` and ran it with real numbers. Results are below.
- TL-009 (build): I ran `npm ci` and `vite build` on Linux and it failed. After adding the missing native packages by hand, the build succeeded (1.35 s).

**Verified by reading source, not executed** (I had no Postgres, no Supabase project, no browser):
- Everything about the SQL functions, RLS policies, triggers and client save flow.
- Each item marked *(static)* below needs the regression test listed with it before you treat it as confirmed.

**Files I read closely:**
- All Supabase migrations except the NinjaTrader/sync ones (only their RLS lines).
- `src/supabase.js` (account, trade-save, delete and fetch sections).
- `src/App.jsx` (account selection and `saveTrade`).
- `src/hooks/useTradeData.js`, `useDashboardStats.js`, `useAccountPortfolio.js` (filter functions).
- `src/services/propFirmCompliance.js`.
- `TradeModal.jsx` (save path).
- The three Netlify functions.
- The k6 test, seed script and load-test README.

**Not audited (no findings does not mean no bugs):**
- `PropFirmSetup.jsx` (928 lines), the Journal Ledger filters, export, and the Analysis/EdgeAnalysis/Calendar/Zella components.
- Timezone handling beyond the compliance file.
- Responsive CSS, accessibility, and dark/light theme.
- The NinjaTrader C# add-on and the NT8 bridge.
- The 40+ `scripts/verify-*.mjs` files. I did not open them, so I can't say whether they test behavior or only grep source text.
- Lint. There is no lint script or test framework in `package.json`.
- Live database state. The migrations are written to *skip* missing tables and to be re-runnable, so the repo cannot prove what is deployed.

---

## 1. Executive summary

1. **Not safe to launch.** There are 6 P0 issues, and three of them can silently produce wrong or lost trading data.
2. **Trade edits can be silently discarded (TL-001).** The edit form reuses the trade's stored idempotency key, and the save function treats that as a retry and returns the old row. The UI shows the edited values and a success toast, but the database is unchanged. *(static)*
3. **Drawdown and trailing-threshold math depends on trade order, and the sort is broken (TL-002).** Manual trades are processed newest-first. Reproduced: a +$1,000 then −$500 history gives a high-water mark of $25,500 and drawdown $0 instead of $26,000 and $500. That overstates your buffer. It also drives the auto-"account blown" logic.
4. **A cross-user write hole exists in the `SECURITY DEFINER` save function (TL-004).** It upserts on a client-supplied trade `id` and only checks ownership when an optimistic-lock timestamp is sent. *(static)* It needs a victim's trade UUID, so it is hard to exploit, but it is a real broken-access-control bug.
5. **Reflected XSS on the app's own origin (TL-003).** The Tradovate OAuth callback writes attacker-controlled query parameters into an inline `<script>`. The Supabase session lives in that origin's localStorage.
6. **Cross-account contamination still has several live paths (TL-005).** Silent `"primary"` fallbacks exist in four places. There is also a `default 'primary'` on the DB column and a save-time fallback to the dashboard/active account.
7. **"All Accounts" is not all accounts (TL-006).** It defaults to a status filter of `active`, so blown and passed accounts are excluded from the aggregate.
8. **Account deletion is broken or corrupting (TL-007).** It nulls `trades.account_id`. The v2 trigger rejects null, so the delete fails. Without the trigger, the orphaned trades reappear inside the `primary` account.
9. **The database cannot be rebuilt from the repo (TL-008).** The core tables and `trades.account_uuid` have no CREATE/ALTER. Your own seed-fix note says staging's `accounts.id` is numeric while the migration says uuid.
10. **The production build fails on Linux CI (and very likely Netlify) (TL-009).** The lockfile only contains Windows native bindings.
11. **Load testing proves very little.** The one k6 script does read-only `GET /trades` with 10 tokens. No results are included, and login, writes and dashboard aggregation are untested.
12. **Biggest architectural risk:** account identity is a free-text string (`account_id`) with defaults and fallbacks, no foreign key, and a duplicate UUID column. Every "wrong account" symptom traces back to it.
13. **Good news:** RLS policies are written for every table I checked, and the service-role key is not in `src`. Saves go through a transactional RPC. Private storage, retries and keyset pagination are in place. The direction is right. The gaps are in the details.

---

## 2. Critical findings (P0 / P1)

### TL-001 — Trade edits silently not saved · P0 · Data Integrity *(static)*

- **Location:** `src/components/trades/TradeModal.jsx:14`; `src/supabase.js` (`saveTradeDb`, ~L841 and ~L605); RPC `tradelog_save_trade_with_mistakes` in `20260926_production_hardening_v2.sql`; `src/hooks/useTradeData.js` `saveTrade`.
- **Root cause:**
  1. `fetchTradesDb` does `select *` and spreads the row, so the stored `client_operation_id` is on the trade object.
  2. `TradeModal` initialises `clientOperationId: trade?.clientOperationId || trade?.client_operation_id || <new uuid>`, so an edit reuses the stored key.
  3. The RPC's first step is "if this operation id already exists, return the existing row and stop". That happens before the update runs.
- **Impact:** every edit to a trade created since v2 is thrown away in the database. `useTradeData.saveTrade` builds `updatedTrade` from the *submitted* form, not the returned row, so the UI looks correct until the next refresh. It also keeps the old `updatedAt`, so a second edit may hit the optimistic-lock error (40001).
- **Repro:** create a trade, edit P&L from 100 to 250, save, and see the toast. Reload. It shows 100.
- **Fix:**
  - In the modal, generate a fresh operation id per save *attempt* (kept stable across automatic retries only). Never seed it from the row.
  - In the RPC, apply the operation-id shortcut only when `p_trade->>'id'` is null (an insert).
  - In `useTradeData.saveTrade`, build `updatedTrade` from `savedTrade` (including `updated_at`).
- **Risk of fix:** Low.
- **Test:** create, edit, and reload; the value must persist. Edit twice in a row; there must be no false conflict. Double-submit an *insert* with the same key; there must be exactly one row.

### TL-002 — Equity path / high-water mark computed in wrong order · P0 · Calculation *(verified by execution)*

- **Location:** `src/services/propFirmCompliance.js` — `sortKey()` and `calculateEquityState()`.
- **Root cause:** `sortKey` returns a number when a trade has an `eventTime`, otherwise a *string* (`"2026-09-01T"`). The comparator does `sortKey(a) - sortKey(b)`. String minus string is `NaN`, and a `NaN` comparator result is treated as "equal", so nothing is sorted. Manual trades have no `eventTime`, so they keep the fetch order, which is newest-first.
- **Reproduced** (25K account; +$1,000 on Sep 1, then −$500 on Sep 2):

| Input order | Current equity | High-water mark | Drawdown |
|---|---|---|---|
| Oldest→newest (correct) | 25,500 | **26,000** | **500** |
| Newest→oldest (what the app passes) | 25,500 | **25,500** | **0** |

- **Impact:**
  - Current equity is still right, because it is a sum.
  - HWM, drawdown, trailing threshold, "remaining buffer", the pre-trade compliance check and the automatic "account blown" decision in `App.jsx saveTrade` are wrong.
  - The error is on the unsafe side: it understates drawdown.
- **Fix:**
  - Make `sortKey` always return a comparable string, `YYYY-MM-DDTHH:MM:SS`, with `created_at` and `id` as tie-breakers.
  - Use a comparator with `<` and `>` instead of subtraction.
  - Sort once, at the top of `calculatePropFirmCompliance` and `calculateEquityState`.
- **Risk of fix:** Low, but drawdown numbers will change for existing accounts. Announce it.
- **Test:** unit test with the table above. Add cases for same-day trades, a new high then a loss then a higher high, and unsorted input. Assert the result is identical for any input permutation.

### TL-003 — Reflected XSS in the Tradovate OAuth callback · P0 · Security *(static)*

- **Location:** `netlify/functions/tradovate-oauth-callback.js`, function `send()`.
- **Root cause:** `JSON.stringify(payload)` is embedded inside an inline `<script>`. `JSON.stringify` does not escape `<`, so `error_description` (or `state`, `error`) from the URL containing `</script><script>…` breaks out and runs. The callback is served from the same origin as the SPA.
- **Impact:** an attacker who gets a logged-in user to open a crafted link can run script on your origin and read the Supabase session from localStorage, which gives full account takeover.
- **Fix:**
  - Escape when serialising: `.replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')`.
  - Better: don't reflect `error_description` at all.
  - Validate `state` server-side, or against a value stored before the redirect.
  - Add a `Content-Security-Policy` in `netlify/_headers` (none exists today), with no `unsafe-inline` on this route.
- **Risk of fix:** Low.
- **Test:** request `?error=x&error_description=</script><script>window.__x=1</script>`. The page source must contain no injected script, and `window.__x` must be undefined.

### TL-004 — `SECURITY DEFINER` upsert lets a caller overwrite another user's trade · P0 · Security/RLS *(static)*

- **Location:** RPCs `tradelog_save_trade_with_mistakes` and `tradelog_save_missed_trade` (v2 migration).
- **Root cause:**
  - For an edit, the SQL is `insert … on conflict (id) do update set …`, with `id` taken from the client payload.
  - The ownership `select … for update` runs only when `p_expected_updated_at` is not null.
  - The function is `SECURITY DEFINER`, so RLS is bypassed on the conflict update.
  - `delete from trade_mistakes where trade_id = v_trade_id` then runs unconditionally.
- **Impact:** any authenticated user who knows another user's trade UUID can overwrite that trade's columns and replace its mistake tags. The attacker's payload sets `account_id` and other fields, and the `user_id` column is left alone. UUIDs are not guessable, but they are not secrets (they appear in exports, logs and shared links). This is still broken access control.
- **Fix:** replace the upsert with an explicit two-path function.
  ```sql
  if v_trade_id is not null then
    perform 1 from public.trades where id = v_trade_id and user_id = v_user_id for update;
    if not found then raise exception using errcode='P0002', message='Trade not found'; end if;
    -- (optional) expected-updated_at check, then UPDATE ... WHERE id = v_trade_id AND user_id = v_user_id
  else
    -- INSERT only
  end if;
  ```
  Do the same for missed trades, and add `and user_id = auth.uid()` to the mistakes delete.
- **Risk of fix:** Medium (core write path).
- **Test:** as user B, call the RPC with user A's trade `id` (with and without `p_expected_updated_at`). Expect an error and zero changes in A's row and mistakes.

### TL-005 — Cross-account contamination paths remain · P0 · Data Integrity *(static)*

These are the root cause of the "trade saved into the wrong account" incidents recorded in your own repair scripts (`account_id = '[object Object]'`).

| # | Location | What it does |
|---|---|---|
| a | `supabase.js` `saveTradeDb` (`account_id` IIFE, ~L529) | If no reference is found, returns `"primary"` instead of failing. |
| b | `supabase.js` `fetchTradesDb` (~L437) and `useAccountPortfolio.js tradeAccountId` (L453) | `row.account_id \|\| "primary"`. A trade with no account is displayed and counted as belonging to *primary*. |
| c | `App.jsx saveTrade` (~L340) | `explicit \|\| entry \|\| dashboardTarget \|\| activeTarget`. If the trade's own account can't be resolved (deleted or unloaded), the save silently lands in whichever account is selected. |
| d | `20260920_connector_persistence.sql` | `trades.account_id default 'primary'` plus a backfill of NULLs to `'primary'`. Any direct insert (connectors, imports) is assigned to `primary`. |
| e | No foreign key from `trades` to `accounts`; `account_id` is free text. | Nothing in the schema prevents a mismatch, and the `account_uuid` column is only checked inside the RPC. |

- **Impact:** an edited or added trade can move into a different account with no error, changing that account's equity, drawdown and payout status. The RPC only checks that the account belongs to *you*, which every one of these fallbacks satisfies.
- **Repro (edit):** open an orphaned trade (its account was deleted, so its account id no longer resolves), change a value and save. It is re-homed to the dashboard-selected account.
- **Repro (add):** with the dashboard on "All Accounts", click Add Trade. Unless the entry modal forces an account choice, it goes to the Account Center's "active" account, which can differ from what you were looking at. I did not read the entry modals' account picker, so confirm this.
- **Fix:**
  1. Remove the `"primary"` fallbacks in (a) and (b). Missing account should be an error state, not a bucket.
  2. In `saveTrade`, require an explicit account. For edits, use only the trade's own account and refuse the save if it can't be resolved. For adds from "All Accounts", require the user to pick one.
  3. `alter column account_id drop default`, and make it `NOT NULL` after cleanup.
  4. Add a real foreign key: `(user_id, account_id) → accounts(user_id, account_id)` (see TL-008 first).
  5. Make `account_uuid` either authoritative (with a FK) or delete it. Two identifiers is the root problem.
- **Risk of fix:** Medium, because existing NULL/orphan rows must be cleaned up first.
- **Test:** for each path (a–d), attempt a save with a missing or unresolvable account and expect an error and zero rows written. Then run your section-33 consistency test with 2 accounts × 10 trades.

### TL-006 — "All Accounts" excludes non-active accounts · P1 · Dashboard *(static)*

- **Location:** `App.jsx:68` (`useState("active")`) and `dashboardFilterAccounts` (~L129–145).
- **Root cause:** when "All Accounts" is chosen, the account list is filtered by `dashboardAccountStatusFilter`, which defaults to `"active"`. Blown and passed accounts drop out of KPIs, equity, charts and the ledger.
- **Impact:** "All Accounts" totals don't equal the sum of the accounts. Historical P&L from blown accounts silently disappears from the aggregate.
- **Fix:** default the filter to `"all"`, and label the control clearly when it narrows the aggregate.
- **Risk of fix:** Low.
- **Test:** 2 active plus 1 blown account: All Accounts net P&L must equal the sum of all three.

### TL-007 — Account delete fails or corrupts · P1 · Database *(static)*

- **Location:** `supabase.js deleteAccountDb` (~L335) and the v2 trigger `tradelog_validate_account_reference`.
- **Root cause:** the function sets `trades.account_id = null` (twice) and then deletes the account, as three separate client calls. The v2 trigger fires on `update of account_id` and raises "A valid trading account is required" when it is null. So the delete throws before the account is removed. If the trigger isn't installed (or the column is non-nullable), the outcome is a different failure (an error, or orphan trades that then show up as `primary` via TL-005b).
- **Impact:** users can't permanently delete accounts. Partial runs can leave trades detached.
- **Fix:** don't null the account reference. Either soft-archive, or make delete a single server-side RPC that moves or deletes trades explicitly (with an "are you sure, N trades" step).
- **Risk of fix:** Medium.
- **Test:** delete an account that has trades: nothing lands in `primary`, and other accounts' numbers are unchanged.

### TL-008 — Database is not reproducible from the repo; schema has drifted · P1 · Database

- **Evidence:**
  - `trades`, `trade_mistakes`, `trade_images`, `account_settings` and `missed_trades` have no CREATE TABLE in `supabase/migrations`. The RLS migration says so in a comment.
  - `trades.account_uuid` is used everywhere and is created nowhere.
  - `SEED-FIX-2026-09-27.md` says staging returned a *numeric* `accounts.id`, but `20260924_foundation_accounts.sql` defines it as uuid. `create table if not exists` silently skipped an older table.
- **Impact:**
  - You can't stand up a clean staging or production database from the repo.
  - The RPC's `a.id = v_account_uuid` check and the repair script assume uuid.
  - You can't tell which migration variants are live.
- **Fix:**
  - Run `supabase db dump --schema public` against the real database and commit it as a baseline migration.
  - Reconcile `accounts.id` (uuid vs numeric).
  - Add CHECK constraints (`quantity > 0`, `direction in ('Long','Short')`, finite `pnl`) and NOT NULLs.
- **Risk of fix:** Medium. Do it against a copy first.
- **Test:** build an empty project from migrations only and run the whole app against it.

### TL-009 — Production build fails on Linux (CI and likely Netlify) · P0 · DevOps *(reproduced)*

- **Location:** `package-lock.json`.
- **Root cause:** the lockfile has entries only for Windows native bindings (`@rolldown/binding-win32-*`, `lightningcss-win32-*`). It lists the Linux ones only as optional dependencies without their own entries. This is the known npm optional-dependency bug.
- **Repro:** `npm ci && npx vite build` on Ubuntu fails with "Cannot find native binding". `.github/workflows/production-qa.yml` uses exactly this.
- **Fix:** regenerate the lockfile so all platforms are recorded (delete `package-lock.json` and `node_modules`, run `npm install` on Linux or CI, and commit). Alternatively add explicit `optionalDependencies` entries for the Linux packages.
- **Risk of fix:** Low.
- **Test:** clean Linux container: `npm ci && npm run build` succeeds.
- **Once fixed:** the build completed in 1.35 s. The largest chunks are `GuidedEntryModal` at 620 kB (182 kB gzip) and `index` at 505 kB. Worth code-splitting later, not a blocker.

### TL-010 — Partial history is treated as complete · P1 · Frontend *(static)*

- **Location:** `useTradeData.js` (first page of 100 rows, then background hydration), `App.jsx saveTrade`, `calculatePropFirmCompliance`.
- **Root cause:** `loaded` becomes true after the first page. Older pages stream in afterwards.
- **Impact:** until hydration finishes, equity, high-water mark and drawdown are computed from the latest 100 trades only. A user with more history sees a wrong equity and buffer, and the post-save auto-blown and "evaluation passed" checks can fire on partial data.
- **Fix:** expose `historyComplete` and don't compute or act on equity or compliance until it is true (show a loading state). Better: compute per-account totals on the server (a view or RPC) and use those for equity and HWM.
- **Risk of fix:** Medium.
- **Test:** an account with 350 trades: equity and HWM must never flash intermediate values; the compliance decision must be identical before and after hydration.

### TL-011 — Fractional quantity blocked everywhere (CFD accounts) · P1 · Business logic *(static)*

- **Location:** `tradeUtils.js` L125 (`Number.isInteger(qty)`), `TradeModal.jsx` (`parseInt(f.qty)||1`), RPC (`v_quantity < 1`) and trigger `tradelog_validate_trade_fields`.
- **Impact:** your setup lists CFD/FTMO/The5ers accounts, where lot sizes like 0.01–0.5 are normal. They can't be journaled, and connector inserts that hit the trigger are rejected.
- **Fix:** if CFDs are in scope for launch, allow `numeric` quantity `> 0` in all four places. If not, hide CFD account types.
- **Risk of fix:** Low.
- **Test:** save a 0.10-lot EURUSD trade.

### TL-012 — Trailing-threshold rules are incomplete · P1 · Calculation *(static)*

- **Location:** `propFirmCompliance.js calculatePropFirmCompliance`.
- **What's missing:**
  - `trailingThreshold = highWaterMark − drawdownLimit` is computed only for *intraday* trailing. For end-of-day trailing it is `null`.
  - There is no lock at starting balance (the "stops trailing once it reaches balance + $100" rule). Your own example in the audit brief, HWM $152,000 with threshold $150,100, can't be produced by this code.
  - No payout or reset events adjust the HWM, and fees/withdrawals aren't part of equity.
- **Decision needed from you:** each firm's exact rule. Encode them as data plus tests, not code branches.
- **Test:** table-driven cases per firm, including new high, drop, higher high, payout, and reset.

---

## 3. Bug inventory

| ID | Sev | Category | Location | Summary |
|---|---|---|---|---|
| TL-001 | P0 | Data Integrity | TradeModal.jsx:14, RPC v2 | Edits silently discarded (idempotency key reuse) |
| TL-002 | P0 | Calculation | propFirmCompliance.js | Sort by string subtraction → HWM/drawdown wrong *(verified)* |
| TL-003 | P0 | Security | netlify/functions/tradovate-oauth-callback.js | Reflected XSS on app origin |
| TL-004 | P0 | Security/RLS | RPC `tradelog_save_*` | DEFINER upsert can overwrite another user's row |
| TL-005 | P0 | Data Integrity | supabase.js, App.jsx, useAccountPortfolio.js, migration | Silent `"primary"` / stale-account fallbacks |
| TL-009 | P0 | DevOps | package-lock.json | `npm ci` + build fails on Linux *(reproduced)* |
| TL-006 | P1 | Dashboard | App.jsx:68,129 | All Accounts defaults to active-only |
| TL-007 | P1 | Database | supabase.js deleteAccountDb | Delete fails or moves trades to primary |
| TL-008 | P1 | Database | migrations/ | Schema not reproducible; uuid/numeric drift |
| TL-010 | P1 | Frontend | useTradeData.js | Equity/compliance computed on partial history |
| TL-011 | P1 | Business logic | tradeUtils, RPC, trigger | No fractional lots (CFDs) |
| TL-012 | P1 | Calculation | propFirmCompliance.js | No trailing lock / EOD threshold / payouts |
| TL-013 | P2 | Frontend | useTradeData.js `load()` | On load failure: blocking `alert()`, then `loaded=true` with empty data (looks like $0 trades) |
| TL-014 | P2 | Calculation | TradeModal.jsx, useDashboardStats.js | Blank/NaN P&L saved and counted as 0 (break-even); confirm form validation covers P&L |
| TL-015 | P2 | Security | netlify/_headers | No CSP; no `netlify.toml` in repo, so build/redirect settings live only in the Netlify UI |
| TL-016 | P2 | Business logic | propFirmCompliance.js | "Today" and daily-loss window use IST midnight, not the firm's trading day |
| TL-017 | P2 | Performance | RPC v2 | Per-call `information_schema.columns` lookups for every payload key; slow on the hot write path |
| TL-018 | P2 | Load test | load-tests/ | See section 11 |
| TL-019 | P3 | Calculation | useDashboardStats.js | Streaks ordered by date only; same-day order undefined |
| TL-020 | P3 | UI | Playbook.jsx L177 | Profit factor renders `"Infinity"` when there are no losses (dashboard/ledger handle it correctly) |
| TL-021 | P3 | Security | useBrokerConnections.js, connector hooks | Verify where the Tradovate/NT access tokens are persisted; if localStorage, prefer memory-only or server-side |
| TL-022 | P3 | Code quality | repo root | ~60 phase/changelog `.md` files plus `component.txt`, `prop.txt`, `pf.txt`, `style.txt` (copied source) in the repo root |

---

## 4. Root-cause groups

- **A. Account identity is a loose string with fallbacks** → TL-005, TL-006 (partly), TL-007, TL-008. Symptoms: wrong account on save, wrong dashboard, orphaned trades in `primary`, delete failures. Fix once at the schema plus the save boundary.
- **B. Idempotency was added to the wrong layer** → TL-001, and the client-supplied `id` in TL-004. Both come from one function that mixes "insert", "edit" and "retry" in a single upsert.
- **C. Calculations trust input order and completeness** → TL-002, TL-010, TL-012. Symptoms: wrong HWM and buffer, false blown/passed prompts. Compute from a sorted, complete set, ideally server-side.
- **D. Environment and lockfile** → TL-009, TL-008.

---

## 5. Security audit

| Area | Finding |
|---|---|
| RLS | Owner-only select/insert/update/delete policies are written for `accounts`, `trades`, `trade_images`, `account_settings`, `missed_trades`, `trade_executions`, `broker_connections` and `connector_sync_runs` (select/insert only), plus a join-based policy for `trade_mistakes`. **Not verified against the live DB.** Several migrations are written to *skip* missing tables and only print a NOTICE. Run the RLS test below in staging and production. |
| Definer functions | `tradelog_save_*` bypass RLS. See TL-004. The delete RPCs check `user_id = auth.uid()` correctly. |
| Secrets | No service-role or `sb_secret` value in `src`. The load-test scripts read it from environment variables, and `.gitignore` covers `.env`, `test-tokens.json` and `load-tests/.env`. |
| XSS | TL-003. No `dangerouslySetInnerHTML` found; `innerHTML = ""` is only used to clear chart containers. |
| Storage | `trade-images` bucket is private with per-user path policies. Good. |
| Sign-out | Clears user-scoped localStorage keys (`supabase.js signOut`). A cleared session state on user switch was not tested in a browser. |
| Headers | HSTS, nosniff and frame options present. No CSP (TL-015). |

---

## 6. Database audit

- Good: composite `unique (user_id, account_id)`; indexes matching the app's queries (`trades (user_id, trade_date desc, id desc)`, `(user_id, account_id, trade_date desc, id desc)`); a unique index on `(user_id, client_operation_id)` for idempotency; `updated_at` trigger; account-reference and field-validation triggers (v2).
- Gaps: TL-005e (no FK), TL-005d (default `'primary'`), TL-008 (no baseline, uuid/numeric drift), no CHECK constraints on `pnl`/`quantity`/`direction` at table level, and `trades.account_uuid` is undefined in migrations.
- `20260924_trade_account_repair.sql` is a data-repair script written to run as the postgres role. Keep it out of the automatic migration path.
- Migration order: several files share a date prefix (`20260926_*`, `20260924_*`) and the hardening v1 and v2 define the *same function name* with different signatures. Confirm both overloads aren't callable, and that clients call only the 4-argument version.

---

## 7. Business logic audit

- **Equity** = `accountSize + initialProfit + Σ pnl` (`calculateEquityState`). This matches your rule (25K + 1,250 = 26,250). Fees, payouts and withdrawals are not modeled.
- **Profit factor:** `grossProfit / |grossLoss|`, with `Infinity` when there are no losses and `0` when there are no trades, so no NaN. Dashboard, ledger and KPI components render `∞`. The Playbook does not (TL-020).
- **Wins/avg win/avg loss** are computed correctly. Break-even trades are excluded from the win-rate denominator.
- **Trailing threshold and drawdown:** see TL-002 and TL-012.
- **Account isolation in the UI:** filtering is by string id plus a uuid-expansion step (`filterTradesForAccount`). It works only if TL-005 is closed.
- **Not audited:** Journal Ledger filters and export, analytics (weekly/monthly, sessions, setups), calendar day boundaries, blown-account lifecycle in `PropFirmSetup`.

---

## 8–10. Frontend, backend and performance (partial)

- Save flow is transactional server-side (trade plus mistakes in one RPC), retried with backoff, and idempotent for inserts. This is well designed apart from TL-001 and TL-004.
- Every save does several round trips after the RPC (image upload, `getTradeImages`, account settings update). A failure between them leaves a saved trade plus a stale UI.
- Post-save "auto-blown" logic runs in the browser and writes account settings in a separate call. It is not atomic, and it relies on the buggy calculation (TL-002) and partial data (TL-010).
- Empty catches and `console.warn`-only paths exist in cleanup code. I didn't count them.
- Performance: default page of 100 rows, cap 500, keyset pagination, and lazy screenshot loading are all good. Whole-history client-side aggregation means dashboards get heavier as accounts grow. Move totals server-side when you see it.

---

## 11. Load-test audit

- **What `tradelog.k6.js` does:** one scenario. It picks a token (`tokens[__VU % tokens.length]`) and does `GET /rest/v1/trades?select=…&limit=100` with 1–3 s think time. It ramps 0→100→500→1000 VUs over ~5 min, holds 1,000 for 10 min, then ramps down. Thresholds: failure rate < 1%, p95 < 1 s, p99 < 2 s.
- **What it does not test:**
  - Login (Supabase Auth rate limits).
  - Accounts, dashboard, or "All Accounts" queries.
  - The write path (`tradelog_save_trade_with_mistakes`), which is the expensive one (TL-017).
  - Realistic page load. The app's first-load query is `select *`, not the narrow column list used here.
  - Many distinct users: the README's staging setup is **10 users × 100 trades**, so 1,000 VUs share 10 identities, all hot in cache.
- **Evidence of a run:** none in the zip. No result files or summaries, so scalability is unproven.
- **Recommended ladder** (10 → 50 → 100 → 250 → 500 → 1,000 users), with each step run against staging on the same compute tier as production:
  1. Realistic session mix: login, load accounts, load first 100 trades, a dashboard read, 5% saving a trade, 1% edit or delete.
  2. Seed at least one user with 5,000 trades and several with multiple accounts.
  3. Record p50/p90/p95/p99, requests/s, error rate, Postgres CPU, connection count and slow queries at each step.
  4. Stop at the first step that breaks a threshold and fix it before going higher.
- I can't give you p50/p99 numbers for any level, because none were measured.

---

## 12. Production readiness scorecard

I have used **NOT VERIFIED** where I did not test, rather than an unearned PASS.

| Area | Status | Evidence / risk |
|---|---|---|
| Authentication | NOT VERIFIED | Sign-out cache clearing reviewed; login, expiry, and user switching not tested |
| Authorization | **FAIL** | TL-004 |
| RLS | NOT VERIFIED | Policies written for all core tables; live state unproven |
| Database | **FAIL** | TL-005e, TL-007, TL-008 |
| Account Isolation | **FAIL** | TL-005 |
| Trade Persistence | **FAIL** | TL-001 |
| Financial Calculations | **FAIL** | TL-002, TL-012 |
| Dashboard | **FAIL** | TL-006, TL-010 |
| Journal Ledger | NOT VERIFIED | Not audited |
| Analytics | NOT VERIFIED | Not audited |
| Prop Firm Setup | NOT VERIFIED | Not audited (TL-007 affects delete) |
| Error Handling | **FAIL** (partial) | TL-013; retry logic is good |
| Performance | NOT VERIFIED | Good pagination/indexes; no measurements |
| Load Testing | **FAIL** | Section 11 |
| Responsive UI | NOT VERIFIED | Not audited |
| Accessibility | NOT VERIFIED | Not audited (the trade drawer does declare `role="dialog"` and `aria-modal`) |
| Build | **FAIL** on Linux, **PASS** with bindings | TL-009 |
| Deployment | **FAIL** | TL-009; no `netlify.toml`; no CSP |

---

## 13. Repair order (dependency-aware)

**Day 1, independent quick wins (no dependencies, do in parallel):**
1. **TL-009** lockfile. Nothing can be deployed or tested in CI until this works.
2. **TL-003** XSS fix plus CSP. It is a small, isolated change with real downside if left.

**Stage 1, establish database truth (blocks everything else):**
3. **TL-008** dump and commit the real schema. Reconcile `accounts.id` type. Build an empty staging DB from the repo. Every later fix needs a DB you can reproduce.

**Stage 2, fix the write path:**
4. **TL-004 and TL-001** together, in one new migration: explicit insert/update paths, ownership checks, idempotency only for inserts. Then the client changes (fresh op id, use the returned row and `updated_at`). Do this before account cleanup so edits during cleanup are safe.

**Stage 3, fix account identity:**
5. **TL-005 and TL-007:** remove fallbacks, require an explicit account, drop the default, clean orphans, add NOT NULL and the composite FK, and replace delete with an atomic server-side operation or soft-archive.

**Stage 4, fix the numbers:**
6. **TL-002** (order), then **TL-010** (complete-history gate), then **TL-012** (rules as data). Compute in this order because 010 and 012 both assume 002's output is right.
7. **TL-006** (All Accounts filter), **TL-011** (lots), **TL-014** (P&L validation).

**Stage 5, prove it:**
8. Run the regression suite (section 15) and RLS tests on staging, then the k6 ladder.

**After launch:** TL-013 to TL-022.

---

## 14. File-by-file repair plan

| Priority | File | Problem | Required change | Depends on | Risk |
|---|---|---|---|---|---|
| 1 | `package-lock.json` | Windows-only native bindings | Regenerate on Linux; commit; CI green | none | Low |
| 1 | `netlify/functions/tradovate-oauth-callback.js` | XSS via inline JSON | Escape `<`, `>`, `&`; drop `error_description`; validate `state` | none | Low |
| 1 | `netlify/_headers` | No CSP | Add CSP; add `netlify.toml` with build/publish | none | Low |
| 2 | `supabase/migrations/` | No baseline; uuid/numeric drift | Add dump baseline; reconcile `accounts.id` | none | Med |
| 3 | new migration | Definer upsert + idempotency | Rewrite `tradelog_save_trade_with_mistakes` and `tradelog_save_missed_trade` as insert-or-owned-update; ownership check always; idempotency only for inserts; owned mistakes delete | 2 | Med |
| 3 | `src/components/trades/TradeModal.jsx` | Reuses stored op id | New op id per save attempt; don't read `client_operation_id` from the row | 3 | Low |
| 3 | `src/hooks/useTradeData.js` | Builds state from form, not saved row; `alert()` on failure; `loaded` true on error | Use `savedTrade` (`updated_at`); show an error state; add `historyComplete` | 3 | Med |
| 4 | `src/supabase.js` | `"primary"` fallbacks; non-atomic delete | Throw on missing account; drop fallbacks; call an atomic delete/archive RPC | 2 | Med |
| 4 | `src/hooks/useAccountPortfolio.js` | `tradeAccountId` defaults to primary | Return `null`/`"unassigned"`; surface orphans in UI | 4 | Med |
| 4 | `src/App.jsx` | Save fallback chain; `"active"` default filter | Require explicit account; default filter `"all"` | 4 | Med |
| 4 | new migration | Free-text `account_id`, default `'primary'` | Drop default; NOT NULL; FK `(user_id, account_id)`; CHECKs | 2 | Med |
| 5 | `src/services/propFirmCompliance.js` | Unsorted equity path; missing trailing rules | Fix `sortKey`/comparator; rules-as-data; unit tests | none (calc) | Low/Med |
| 5 | `src/components/trades/tradeUtils.js`, RPC, trigger | Integer-only quantity | Allow numeric `> 0` if CFDs are in scope | 3 | Low |
| 6 | `load-tests/` | Read-only, 10 users | Add mixed session scenario, more users, write path | 3–5 | Low |

---

## 15. Regression test plan (minimum)

- **Calculation unit tests (no DB needed, start here):**
  - Equity path: the +1,000 / −500 case, in ascending, descending and shuffled input order. Result must be identical.
  - Same-day trades; new high, drop, higher high; zero trades; only wins (profit factor `Infinity`, rendered `∞`); only losses (0).
  - Threshold cases per firm once TL-012 rules are defined.
- **RLS / security (run as two real users against staging):**
  - B cannot select, update or delete A's accounts, trades, images, mistakes, or broker connections.
  - B calling the save RPC with A's trade `id` (with and without `p_expected_updated_at`) must fail and change nothing.
  - B calling the save RPC with A's `account_id` must fail.
  - Storage: B cannot read A's screenshot path.
  - XSS: crafted callback URL yields no script execution.
- **Trade persistence:**
  - Create → edit → reload: the edit persists.
  - Edit twice in a row: no false conflict.
  - Same insert key sent twice: one row.
  - Two tabs editing the same trade: the second gets a clear conflict.
- **Account isolation (your section-33 script):** 2 accounts × 10 trades. Check Dashboard A, B and All Accounts. Edit and delete in A, and B must not change. Add a blown account and confirm All Accounts still includes it.
- **Account lifecycle:** delete an account with trades: nothing moves to `primary`. Edit an orphaned trade: refused, not re-homed. Add from "All Accounts": forced to choose.
- **Data completeness:** 350-trade account: no intermediate equity values shown; the compliance decision is identical before and after hydration.
- **Network:** kill the connection mid-save and mid-edit, and slow the API. Expect a visible error, no duplicate trade, and a working retry.
- **Build:** clean Linux container `npm ci && npm run build`.
- **Load:** the ladder in section 11, run on staging.
- **Not yet covered because I did not audit them:** Journal Ledger filters and export, analytics, mobile layout, and accessibility. Add tests for these after a review pass.

---

## 16. Final launch gate — **BLOCKED**

Launch only when **all** of these are true:

1. TL-001, TL-002, TL-003, TL-004, TL-005 and TL-009 are fixed and each has a passing test.
2. The database is rebuilt from committed migrations in a clean project, and the app works against it (TL-008).
3. RLS tests pass with two real users in the **production** project, not only staging.
4. TL-006, TL-007 and TL-010 are fixed, or you have consciously accepted them in writing.
5. Trailing-threshold behavior is defined per firm you support at launch, and tested (TL-012).
6. Quantity rules match the account types you actually offer (TL-011).
7. A mixed read/write load test has been run and its results kept.
8. Backups are enabled in Supabase, and you have restored one successfully at least once.
9. Production environment variables point to production (no test/staging Supabase URL). I couldn't check this from the repo.

**Also review the sections I did not audit** (Section 0) before you call the launch safe. The most important gap is `PropFirmSetup.jsx`, which handles blown/restore/delete and payout logic.

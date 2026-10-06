# TradeLog — Audit Bugfix Pass

Date: 2026-09-25

This addresses every issue raised in the 2026-09-25 code audit (concurrency,
security, and scaling review). Each fix below is scoped and additive — no
intentional UI/visual changes.

**Action required before deploying:** run
`supabase/migrations/20260925_core_rls_hardening.sql` in the Supabase SQL
Editor and read its `NOTICE` output. See the README's new "Security
hardening" section for details. If you ever ran the old
`20260924_trade_account_repair.sql`, re-run the corrected version in this
package — the old one silently did nothing (see #1 below).

## Critical

### 1. `20260924_trade_account_repair.sql` was a no-op
Every statement was filtered by `t.user_id = auth.uid()`. That script is
meant to be run once from the Supabase SQL Editor, which executes as the
`postgres`/service role — there's no authenticated request there, so
`auth.uid()` evaluates to `NULL` and `column = NULL` is never true in
Postgres. Every UPDATE silently affected 0 rows, and the diagnostic SELECT at
the end returned 0 rows too, which looked exactly like "nothing needed
repair." **Fixed:** removed the `auth.uid()` predicates so the script
actually repairs affected rows when run with elevated privileges, which is
what running it in the SQL Editor requires.

### 2. RLS on the core tables was unverifiable from source — now explicitly enforced
`trades`, `trade_mistakes`, `trade_images`, `account_settings`, and
`missed_trades` are queried throughout `supabase.js` but their `CREATE TABLE`
statements aren't in this migrations folder — they predate it. Every query
filters by `.eq("user_id", userId)` client-side, which is a convenience
filter, not a security boundary (the anon key is public). **Fixed:** new
migration `20260925_core_rls_hardening.sql` (re)enables row level security
and asserts owner-only select/insert/update/delete policies on all five
tables — including `trade_mistakes`, which has no `user_id` column of its
own, so its policy is scoped via a join back to the parent trade's owner. The
migration is idempotent and prints a `NOTICE` per table stating exactly what
it found and did.

## Performance / correctness

### 3. Every DB call made an extra network round-trip to re-validate the session
`getCurrentUserId()` (called by nearly every function in `supabase.js`) used
`supabase.auth.getUser()`, which always hits the Auth server to revalidate
the JWT. Saving one trade could mean 3+ of these round-trips stacked on top
of the actual DB calls. **Fixed:** switched to `supabase.auth.getSession()`,
which reads the session from local state and only touches the network when
the token is actually near expiry. `fetchSettingsDb`/`saveSettingsDb` were
also switched off their own direct `getUser()` calls onto the same helper.
Postgres RLS still independently re-checks the JWT server-side regardless, so
this changes nothing about security — only redundant client-side round-trips.

### 4. No pagination on trade/missed-trade fetches
`fetchTradesDb()` and `fetchMissedTradesDb()` fetched a user's entire history
with no bound, every load. **Fixed:** both now accept `{ limit, offset }`
(default limit 2000, matching prior effective behavior for typical account
sizes) and use `.range()`. If a fetch hits the limit, a `console.warn` says
so and tells you the offset to call next, instead of silently capping
history with no signal.

### 5. Screenshot signed-URL batching was unbounded
`attachImagesBatched` requested signed URLs for every trade image in one
`createSignedUrls` call, sized to a user's entire screenshot history, with no
chunking. **Fixed:** now batches in chunks of 200 paths; one failed chunk no
longer blanks out every other trade's screenshots either.

### 6. No conflict detection when editing the same trade from two places
`saveTradeDb` did a plain upsert — the last save silently won, with no
warning if someone else's edit (or another tab) had changed the trade in the
meantime. **Fixed:** `fetchTradesDb` now carries each trade's `updatedAt`;
`saveTradeDb` compares it against the current DB value immediately before
writing an edit, and throws a clear "changed elsewhere" error on mismatch
instead of overwriting silently. Backed by a new `trades.updated_at` column +
auto-touch trigger added in the RLS migration. New trades (no `id` yet) are
unaffected; this is only checked when editing.

### 7. Client-side auto-sync had no jitter and kept polling backgrounded tabs
`useSyncEngine`'s auto-sync timer fired on a fixed interval regardless of tab
visibility, and every tab that started auto-sync around the same moment would
hit connector APIs/the DB on the same clock tick. **Fixed:** the timer now
skips ticks while `document.hidden`, and adds up to 20% random jitter to the
interval.

## Security / privacy

### 8. Live-capture config and execution cache leaked across users on shared browsers
`useLiveTradeCapture`'s `localStorage` keys were scoped only by `accountId`
("primary" for nearly every account) — **not** by user id. On a shared
machine, or simply switching which account is logged into the same browser,
one user's NinjaTrader bridge URL, enabled flag, and cached execution ledger
could surface in another user's session. Same issue in
`TradingOperationsCenter`'s separately-cached bridge URL. **Fixed:** both are
now namespaced by `userId` first. `signOut()` also now proactively sweeps and
clears every `tradelog:*` localStorage key scoped to the signing-out user
(sync-run history, live-capture state, cached account list, etc.) before
dropping the session, rather than leaving it to linger indefinitely on a
shared machine.

## UX bug: false "success" toasts after a failed delete

`deleteTrade` and `deleteMissedTrade` in `useTradeData.js` caught their own
errors internally (`alert()` + `console.error`) without re-throwing. Their
callers in `App.jsx` `await` the call and then unconditionally show a
"deleted" success toast — since the promise resolved normally even on
failure, a failed delete showed both a native `alert()` *and* a false
"Trade deleted." success toast, with no actual error surfaced through the
app's own notification system. Same double-notification issue existed on
`saveTrade`/`saveMissedTrade` (which did rethrow, but also alerted first).
**Fixed:** removed the `alert()` calls from all four CRUD paths (they're
already caught and shown via toast by every caller) and added the missing
`throw error` to `deleteTrade`/`deleteMissedTrade` so failures are reported
accurately instead of showing a false success message. The initial-load path
in `useTradeData` (which has no other error surface) still alerts on failure,
intentionally.

## Not fixed in this pass — needs a product decision, not a code fix

- **No self-service signup.** Only `signIn()` exists in `supabase.js`. Onboarding
  1000 users requires a registration/invite flow; that's new product surface,
  not a bug fix, and wasn't built here.
- **No error monitoring (Sentry/etc.).** Errors still only go to `console.error`
  and in-app toasts — you won't have visibility into production failures across
  many users without wiring up a reporting service, which needs a DSN/account
  you'll need to provide.

## 2026-09-25 — Dashboard Reference Calendar JSX build fix

Fixed a production build blocker in `src/components/dashboard/DashboardReferenceCalendar.jsx`.

### Root cause
The `showWeekSummary && <aside>` JSX conditional was missing its closing `}` after `</aside>`. Vite/Rolldown therefore parsed the following `</div>` as an invalid token and reported:

`[vite:transform] Unterminated regular expression`

### Fix
Changed:

`</aside>`

 to:

`</aside>}`

### Verification
- `node scripts/verify-all.mjs` — 34/34 active verification suites passed.
- `node scripts/qa-deep.mjs` — 11/11 passed.
- Dashboard local QA server starts at `http://127.0.0.1:4173`.

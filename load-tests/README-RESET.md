# TradeLog Load Test — Clean Restart

This directory is a clean staging load-test workflow. It deliberately separates:

1. **Admin user creation** — server-only secret key.
2. **User token generation** — publishable/anon key + each test user's password.
3. **k6 traffic** — real user JWTs so RLS is exercised.

## Safety

- Run this only against a staging/test Supabase project.
- Never put `sb_secret_...` in the React/Vite frontend or commit it to Git.
- Never put `test-tokens.json` into Git. It contains real access tokens.
- The scripts do not print secret keys or access tokens.

## 0. Install dependencies

From the project root:

```powershell
npm install
```

## 1. Set staging variables in the current PowerShell session

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_ANON_KEY = "YOUR_PUBLISHABLE_OR_ANON_KEY"
$env:SUPABASE_SECRET_KEY = "YOUR_SERVER_ONLY_SECRET_KEY"
$env:TRADELOG_TEST_PASSWORD = "STAGING_ONLY_PASSWORD"
$env:TRADELOG_TEST_USER_COUNT = "10"
```

Do not paste secret values into chat.

## 2. Create test users

```powershell
node load-tests/create-test-users.mjs
```

Expected:

```text
Created: 10
Failed: 0
```

## 3. Generate real user JWTs

```powershell
node load-tests/get-test-tokens.mjs
```

Expected:

```text
Tokens written: 10
Failures: 0
```

The output file is `load-tests/test-tokens.json`. Keep it local.

## 4. Run the smoke test first

Load the token JSON into a PowerShell variable without printing it:

```powershell
$env:TRADELOG_TEST_TOKENS_JSON = Get-Content load-tests/test-tokens.json -Raw
```

Then:

```powershell
k6 run load-tests/tradelog.smoke.k6.js
```

Only after the smoke test passes should the 1,000-VU test be run:

```powershell
k6 run load-tests/tradelog.k6.js
```

## 5. What the existing 1,000-VU test measures

`tradelog.k6.js` exercises authenticated reads of `public.trades` through the Supabase REST API. It ramps to 1,000 VUs, sustains 1,000 VUs for 10 minutes, then ramps down.

Thresholds:

- HTTP failure rate < 1%
- p95 < 1 second
- p99 < 2 seconds

This is a **read-load test**, not a full mixed read/write certification. Write-load testing should be added separately after the read path is clean.

## Seed 10 users × 100 trades

After `create-test-users.mjs` and `get-test-tokens.mjs` succeed, set:

```powershell
$env:TRADELOG_TRADES_PER_USER = "100"
```

Then run:

```powershell
node .\load-tests\seed-load-test-data.mjs
```

The seed script signs each test user in with the publishable key and writes trades through the same authenticated `tradelog_save_trade_with_mistakes` RPC used by the application. It does not use the secret key to bypass RLS for trade creation.

Expected first-stage result:

```text
Users targeted: 10
Trades created: 1000
Expected trades: 1000
Failures: 0
```

Do not scale to 100 or 1,000 users until this stage passes.

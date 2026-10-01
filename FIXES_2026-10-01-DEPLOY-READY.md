# TradeLog — Deploy-Readiness Pass

Date: 2026-10-01

This package was checked end-to-end for the issues that broke the last two
Netlify build attempts, plus a final hygiene pass before shipping.

## Verified clean (no action needed)
- **No merge-conflict markers anywhere.** The `package.json` corruption from
  the earlier `git pull --allow-unrelated-histories` is not present in this
  package — checked every file, not just `package.json`.
- **`package-lock.json` has full entries for every platform**, including
  `@rolldown/binding-linux-x64-gnu` — the Windows-only lockfile that broke
  the first Netlify build is not the one in this package.
- **`npm install` + `npm run build` succeed** in a clean environment with no
  errors (only a standard "large chunk" performance warning, not an error).
- **`npm test` passes** (equity-order, security-regression, CSV export).
- No real secrets found anywhere in source — the one `SUPABASE_SERVICE_ROLE`
  match is inside `securityAudit.js`'s own detection regex, not a leaked key.

## Fixed in this pass

### `netlify.toml` build command
Was `npm run build`. Netlify defaults to `npm ci` for the install step when a
command isn't specified, which is what caused the earlier build failure on a
lockfile that was missing Linux-specific entries. That specific lockfile
problem isn't present in this package, but the install command is still
changed to `npm install && npm run build` here so the fix is committed in the
repo itself rather than depending only on a Netlify dashboard setting that
doesn't survive relinking to a new repo or recreating the site.

### Missing `.env.example`
There was no `.env.example` in this package, so the required environment
variables weren't documented anywhere a new checkout could discover them.
Reconstructed one by grepping every `import.meta.env.*` and `process.env.*`
reference actually used in `src/` and `netlify/functions/`:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_VERSION`,
`VITE_NT_CLIENT_ID`, `VITE_NT_ENVIRONMENT` (browser-side), and
`NT_CLIENT_ID`/`NT_CLIENT_SECRET`/`NT_OAUTH_REDIRECT_URI`/`NT_ENVIRONMENT`
(Netlify Functions server-side — set these in Netlify's dashboard, never in
a committed file).

## Before you deploy this
1. In Netlify, confirm environment variables are set (Site configuration →
   Environment variables): at minimum `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`, plus the `NT_*` ones if the broker OAuth
   callback is in use.
2. If you haven't already, run `supabase/migrations/20260925_core_rls_hardening.sql`
   in the Supabase SQL Editor and read its `NOTICE` output — see
   `FIXES_2026-09-25-AUDIT-BUGFIXES.md` for why this matters.

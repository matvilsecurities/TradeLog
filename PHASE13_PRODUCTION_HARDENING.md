# Phase 13 — Production Hardening

## Scope
- Root-level React error boundary with a recoverable fallback UI.
- Centralized runtime environment configuration for Supabase public client settings.
- Explicitly avoid service-role key usage in the browser runtime.
- Netlify security response headers.
- Production hardening verification script.

## Verification
Run:

```bash
npm run verify:production
npm run build
```

The build must be verified in the user's Windows environment before Phase 13 is marked passed.

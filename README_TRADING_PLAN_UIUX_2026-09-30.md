# Trading Plan UI/UX + Persistence Update — 2026-09-30

- Rebuilt Trading Plan around the Dashboard KPI/card design language.
- Compact 72px KPI cards with Dashboard-style hover elevation and purple focus border.
- Compact Dashboard-style primary/secondary buttons with hover states.
- Added custom Market Bias dropdown with directional descriptions and visual bias dots.
- Added dedicated Session Setup and Risk & Execution Rules cards.
- Added compact Session Notes card with character count and Supabase save state.
- Added light/dark theme bridge driven by the app's actual `theme` prop.
- Replaced UTC `toISOString()` date derivation with local calendar date via `toLocalISODate()`.
- Added Supabase-backed `trading_plans` table with per-user/per-date uniqueness, RLS, grants, indexes and timestamp trigger.
- LocalStorage remains a graceful fallback when Supabase is unavailable; Supabase is the primary persistence path.
- Added `tradelog_verify_trading_plan_schema()` for explicit schema QA.

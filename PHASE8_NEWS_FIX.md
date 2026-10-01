# Phase 8 News Feed Fix

The browser was attempting to fetch the Forex Factory JSON endpoint directly during Vite development. That can fail because the upstream feed is not guaranteed to permit browser cross-origin requests.

## Fix
- Vite development now proxies `/api/forexfactory` to `https://nfs.faireconomy.media/ff_calendar_thisweek.json`.
- The production build continues to use the Netlify function `/.netlify/functions/forexfactory`.
- The direct upstream URL remains a fallback.
- Trade News Context no longer reports a failed feed as a clean-news result; it explicitly says the news could not be verified.

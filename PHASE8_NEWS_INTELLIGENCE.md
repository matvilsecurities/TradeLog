# Phase 8 — News & Economic Calendar Intelligence

## Scope

Phase 8 adds a Forex Factory economic-news layer to TradeLog without adding a new Supabase schema.

### Implemented
- Uses the official Forex Factory weekly JSON feed linked from the Forex Factory calendar.
- Normalizes event date, currency, impact, title, forecast, previous, actual and source URL.
- Caches the weekly feed locally for 10 minutes to reduce repeated requests.
- Adds a Netlify Function proxy for production deployments so the browser does not have to call the feed directly.
- Adds a dedicated **News Intelligence** sidebar view.
- Defaults the News Intelligence view to **High Impact + USD**, with an option to show all impacts and all currencies.
- Shows event date/time in IST.
- Adds automatic news context to the Trade Entry modal for MNQ/MGC around the entered trade time (±90 minutes).
- Keeps the existing `news_checked` checklist field intact; the trader can explicitly mark it checked after reviewing the detected news context.
- Does not write a new database field, avoiding schema changes to existing trade records.
- Adds cached/stale/error states so a failed refresh is not silently treated as confirmation that there was no news.

## Source

The Forex Factory calendar exposes a Weekly Export JSON link to `nfs.faireconomy.media/ff_calendar_thisweek.json`. The application uses that weekly feed as the sole economic-calendar source.

## Deliberate limitation

The public weekly export is a current-week feed. Historical trade dates outside the published week are not reconstructed from another provider. The trade-entry panel therefore reports only events available in the current weekly feed and never fabricates historical news data.

## Verification

Run:

```bash
npm run verify:news
```

Then:

```bash
npm run build
npm run dev
```

const FF_WEEKLY_JSON = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const CACHE_KEY = "tradelog.forexfactory.weekly.v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

const safeArray = (value) => Array.isArray(value) ? value : [];

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.events)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(events, source) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      fetchedAt: new Date().toISOString(),
      source,
      events,
    }));
  } catch {
    // Local storage is optional; live data remains usable without it.
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Forex Factory feed returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Forex Factory feed returned an unexpected format");
  return payload;
}

export function normalizeForexFactoryEvent(event, index = 0) {
  const date = event?.date || event?.datetime || event?.time;
  const parsedDate = date ? new Date(date) : null;
  return {
    id: String(event?.id ?? `${date || "event"}-${event?.title || "unknown"}-${index}`),
    title: String(event?.title || event?.event || "Economic event"),
    country: String(event?.country || event?.currency || ""),
    impact: String(event?.impact || "Unknown"),
    date,
    timestamp: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getTime() : null,
    forecast: event?.forecast ?? "",
    previous: event?.previous ?? "",
    actual: event?.actual ?? "",
    url: event?.url || "https://www.forexfactory.com/calendar",
  };
}

export async function fetchForexFactoryCalendar({ force = false } = {}) {
  const cached = readCache();
  const cacheFresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS;

  if (!force && cacheFresh) {
    return {
      events: cached.events,
      fetchedAt: cached.fetchedAt,
      source: cached.source || "cache",
      cached: true,
    };
  }

  const urls = import.meta.env.PROD
    ? ["/.netlify/functions/forexfactory", FF_WEEKLY_JSON]
    : ["/api/forexfactory", FF_WEEKLY_JSON];

  let lastError = null;
  for (const url of urls) {
    try {
      const raw = await fetchJson(url);
      const events = safeArray(raw)
        .map(normalizeForexFactoryEvent)
        .filter((event) => event.timestamp != null)
        .sort((a, b) => a.timestamp - b.timestamp);
      const fetchedAt = new Date().toISOString();
      writeCache(events, url);
      return { events, fetchedAt, source: url, cached: false };
    } catch (error) {
      lastError = error;
    }
  }

  if (cached) {
    return {
      events: cached.events,
      fetchedAt: cached.fetchedAt,
      source: cached.source || "cache",
      cached: true,
      stale: true,
      error: lastError?.message || "Unable to refresh Forex Factory data",
    };
  }

  throw lastError || new Error("Unable to load Forex Factory calendar");
}

export const isHighImpact = (event) => String(event?.impact).toLowerCase() === "high";

export function eventMatchesDate(event, dateString, timeZone = "Asia/Kolkata") {
  if (!event?.timestamp || !dateString) return false;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(event.timestamp)) === dateString;
}

export function getNewsForTrade(events, trade, {
  beforeMinutes = 90,
  afterMinutes = 90,
  currencyMap = { MNQ: ["USD"], MGC: ["USD"] },
} = {}) {
  if (!trade?.date || !trade?.time) return [];
  const tradeTime = new Date(`${trade.date}T${trade.time}:00+05:30`).getTime();
  if (Number.isNaN(tradeTime)) return [];

  const currencies = currencyMap[trade.symbol] || ["USD"];
  const start = tradeTime - beforeMinutes * 60_000;
  const end = tradeTime + afterMinutes * 60_000;

  return safeArray(events)
    .filter((event) => isHighImpact(event))
    .filter((event) => currencies.includes(String(event.country).toUpperCase()))
    .filter((event) => event.timestamp >= start && event.timestamp <= end)
    .sort((a, b) => Math.abs(a.timestamp - tradeTime) - Math.abs(b.timestamp - tradeTime));
}

export function getTodayHighImpactNews(events, timeZone = "Asia/Kolkata") {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = formatter.format(now);
  return safeArray(events)
    .filter(isHighImpact)
    .filter((event) => eventMatchesDate(event, today, timeZone))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function formatNewsTime(timestamp, timeZone = "Asia/Kolkata") {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatNewsDate(timestamp, timeZone = "Asia/Kolkata") {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

export { FF_WEEKLY_JSON };

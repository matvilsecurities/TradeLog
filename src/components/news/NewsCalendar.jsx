import { useCallback, useEffect, useMemo, useState } from "react";
import { V, GRN, RED, AMBER, BLU } from "../../constants.js";
import {
  fetchForexFactoryCalendar,
  formatNewsDate,
  formatNewsTime,
  isHighImpact,
} from "../../services/forexFactory.js";

const impactColor = (impact) => {
  const value = String(impact).toLowerCase();
  if (value === "high") return RED;
  if (value === "medium") return AMBER;
  return V.muted;
};

function NewsCalendar({ s }) {
  const [events, setEvents] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [currency, setCurrency] = useState("USD");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchForexFactoryCalendar({ force });
      setEvents(result.events || []);
      setFetchedAt(result.fetchedAt || null);
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err?.message || "Unable to load Forex Factory news");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const filtered = useMemo(() => events.filter((event) => {
    if (!showAll && !isHighImpact(event)) return false;
    if (currency !== "ALL" && event.country !== currency) return false;
    return true;
  }), [events, showAll, currency]);

  const upcoming = useMemo(() => filtered.filter((event) => event.timestamp >= Date.now()), [filtered]);

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: V.text }}>News Intelligence</div>
          <div style={{ marginTop: 5, fontSize: 13, color: V.muted }}>
            Live economic calendar from the Forex Factory weekly feed. Times shown in IST.
          </div>
        </div>
        <button type="button" onClick={() => load(true)} disabled={loading} style={{ ...s?.inp, width: "auto", cursor: loading ? "wait" : "pointer", color: V.text, background: V.surface }}>
          {loading ? "Refreshing…" : "↻ Refresh News"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
        <div style={{ padding: 16, borderRadius: V.radiusLg, border: `1px solid ${V.border}`, background: V.surface }}>
          <div style={{ fontSize: 11, color: V.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>Upcoming events</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 700, color: V.text }}>{upcoming.length}</div>
        </div>
        <div style={{ padding: 16, borderRadius: V.radiusLg, border: `1px solid ${V.border}`, background: V.surface }}>
          <div style={{ fontSize: 11, color: V.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>High impact</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 700, color: RED }}>{upcoming.filter(isHighImpact).length}</div>
        </div>
        <div style={{ padding: 16, borderRadius: V.radiusLg, border: `1px solid ${V.border}`, background: V.surface }}>
          <div style={{ fontSize: 11, color: V.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>Feed status</div>
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: error ? AMBER : GRN }}>{error ? "Cached / warning" : "Live"}</div>
          {fetchedAt && <div style={{ marginTop: 4, fontSize: 11, color: V.muted }}>Updated {new Date(fetchedAt).toLocaleTimeString()}</div>}
        </div>
      </div>

      {error && <div style={{ marginBottom: 14, padding: 12, borderRadius: V.radius, border: `1px solid rgba(245,158,11,.35)`, background: "rgba(245,158,11,.08)", color: AMBER, fontSize: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={() => setShowAll(false)} style={{ padding: "8px 12px", borderRadius: V.radius, border: `1px solid ${!showAll ? BLU : V.border}`, background: !showAll ? "rgba(77,138,255,.1)" : V.surface, color: V.text, cursor: "pointer" }}>High Impact</button>
        <button type="button" onClick={() => setShowAll(true)} style={{ padding: "8px 12px", borderRadius: V.radius, border: `1px solid ${showAll ? BLU : V.border}`, background: showAll ? "rgba(77,138,255,.1)" : V.surface, color: V.text, cursor: "pointer" }}>All Impact</button>
        {[
          ["USD", "USD"], ["ALL", "All currencies"],
        ].map(([value, label]) => <button key={value} type="button" onClick={() => setCurrency(value)} style={{ padding: "8px 12px", borderRadius: V.radius, border: `1px solid ${currency === value ? GRN : V.border}`, background: currency === value ? "rgba(0,217,160,.08)" : V.surface, color: V.text, cursor: "pointer" }}>{label}</button>)}
      </div>

      <div style={{ border: `1px solid ${V.border}`, borderRadius: V.radiusLg, overflow: "hidden", background: V.bg }}>
        {loading && events.length === 0 ? (
          <div style={{ padding: 28, color: V.muted }}>Loading Forex Factory calendar…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 28, color: V.muted }}>No matching events in the current weekly feed.</div>
        ) : filtered.map((event) => (
          <div key={event.id} style={{ display: "grid", gridTemplateColumns: "110px 72px 1fr 90px 90px", gap: 12, alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${V.border}` }}>
            <div><div style={{ color: V.text, fontWeight: 650, fontSize: 13 }}>{formatNewsDate(event.timestamp)}</div><div style={{ color: V.muted, fontSize: 12, marginTop: 3 }}>{formatNewsTime(event.timestamp)}</div></div>
            <div style={{ fontSize: 12, fontWeight: 700, color: V.text }}>{event.country || "—"}</div>
            <div><div style={{ color: V.text, fontSize: 13 }}>{event.title}</div><div style={{ color: V.muted, fontSize: 11, marginTop: 3 }}>Forecast {event.forecast || "—"} · Previous {event.previous || "—"}</div></div>
            <div style={{ fontSize: 11, fontWeight: 700, color: impactColor(event.impact), textTransform: "uppercase" }}>{event.impact}</div>
            <a href={event.url || "https://www.forexfactory.com/calendar"} target="_blank" rel="noreferrer" style={{ color: BLU, fontSize: 12, textAlign: "right" }}>Forex Factory ↗</a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NewsCalendar;

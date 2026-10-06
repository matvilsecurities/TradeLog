import { useEffect, useMemo, useState } from "react";
import { V, GRN, RED, BLU, PURPLE, fp, fd } from "../../constants.js";
import Badge from "../shared/Badge";
import { getTVSymbol, loadTradingViewScript } from "./tradingView.js";

const pnl = (trade) => Number(trade?.pnl) || 0;

function Meta({ label, value, tone }) {
  return (
    <div style={{ padding: "10px 12px", border: `1px solid ${V.border}`, borderRadius: V.radius, background: V.surface }}>
      <div style={{ fontSize: 10, color: V.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: tone || V.text, fontVariantNumeric: "tabular-nums" }}>{value ?? "—"}</div>
    </div>
  );
}

function Evidence({ label, src }) {
  return (
    <div style={{ border: `1px solid ${V.border}`, borderRadius: V.radius, overflow: "hidden", background: V.surface }}>
      <div style={{ padding: "9px 11px", fontSize: 11, color: V.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      {src ? (
        <button type="button" onClick={() => window.open(src, "_blank", "noopener,noreferrer")} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "#080b10", cursor: "pointer" }} title="Open screenshot">
          <img src={src} alt={label} style={{ display: "block", width: "100%", height: 150, objectFit: "contain" }} />
        </button>
      ) : <div style={{ height: 150, display: "grid", placeItems: "center", color: V.muted, fontSize: 12 }}>No screenshot recorded</div>}
    </div>
  );
}

function ChartPanel({ trade }) {
  const symbol = getTVSymbol(trade?.symbol);
  const widgetId = `chart_workspace_${String(trade?.id || "active").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadTradingViewScript().then(() => {
      if (cancelled) return;
      const el = document.getElementById(widgetId);
      if (!el || !window.TradingView) throw new Error("TradingView unavailable");
      el.innerHTML = "";
      new window.TradingView.widget({
        container_id: widgetId,
        symbol,
        interval: "5",
        timezone: "Asia/Kolkata",
        theme: V.bg === "#ffffff" ? "light" : "dark",
        style: "1",
        locale: "en",
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        allow_symbol_change: true,
        height: 520,
        width: "100%",
      });
      setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => {
      cancelled = true;
      const el = document.getElementById(widgetId);
      if (el) el.innerHTML = "";
    };
  }, [trade?.id, symbol, widgetId]);

  return (
    <div style={{ position: "relative", minHeight: 520, background: "#080b10", borderRadius: V.radius, overflow: "hidden", border: `1px solid ${V.border}` }}>
      <div id={widgetId} style={{ height: 520 }} />
      {status !== "ready" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: V.muted, background: "rgba(8,11,16,.88)", fontSize: 13 }}>
        {status === "error" ? "TradingView could not be loaded. Use Open My Chart to continue." : "Loading TradingView chart…"}
      </div>}
    </div>
  );
}

export default function ChartWorkspace({ trades = [], onAdd, s }) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState("All");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...safeTrades]
      .filter((t) => symbol === "All" || t?.symbol === symbol)
      .filter((t) => !q || [t?.symbol, t?.setup, t?.dir, t?.date, t?.time].join(" ").toLowerCase().includes(q))
      .sort((a, b) => `${b?.date || ""}${b?.time || ""}`.localeCompare(`${a?.date || ""}${a?.time || ""}`));
  }, [safeTrades, query, symbol]);

  const selected = useMemo(() => filtered.find((t) => String(t?.id) === String(selectedId)) || filtered[0] || null, [filtered, selectedId]);
  const symbols = useMemo(() => [...new Set(safeTrades.map((t) => t?.symbol).filter(Boolean))], [safeTrades]);

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 750, color: V.text }}>Chart Workspace</div>
          <div style={{ marginTop: 4, fontSize: 13, color: V.muted }}>Review execution in chart context with trade levels, evidence and notes.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected?.chart_url && <button type="button" onClick={() => window.open(selected.chart_url, "_blank", "noopener,noreferrer")} style={{ padding: "9px 13px", border: 0, borderRadius: V.radius, background: BLU, color: "#fff", cursor: "pointer", fontWeight: 650 }}>Open My Chart ↗</button>}
          <button type="button" onClick={onAdd} style={{ padding: "9px 13px", border: `1px solid ${V.border}`, borderRadius: V.radius, background: V.surface, color: V.text, cursor: "pointer" }}>＋ Log Trade</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "310px minmax(0,1fr)", gap: 14, minHeight: 650 }}>
        <aside style={{ ...s.card, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${V.border}` }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trades…" style={s.inp} />
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ ...s.inp, marginTop: 8 }}>
              <option value="All">All symbols</option>
              {symbols.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length ? filtered.map((trade) => {
              const active = String(selected?.id) === String(trade?.id);
              const value = pnl(trade);
              return <button key={trade.id} type="button" onClick={() => setSelectedId(trade.id)} style={{ width: "100%", textAlign: "left", padding: "12px 13px", border: 0, borderBottom: `1px solid ${V.border}`, borderLeft: active ? `3px solid ${BLU}` : "3px solid transparent", background: active ? V.surface : "transparent", color: V.text, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{trade.symbol || "—"}</strong><span style={{ color: value >= 0 ? GRN : RED, fontWeight: 700 }}>{fp(value)}</span></div>
                <div style={{ marginTop: 4, display: "flex", gap: 7, alignItems: "center", color: V.muted, fontSize: 11 }}><span>{trade.date || "—"}</span><span>·</span><span>{trade.time || "—"}</span><span>·</span><span>{trade.dir || "—"}</span></div>
              </button>;
            }) : <div style={{ padding: 25, textAlign: "center", color: V.muted, fontSize: 12 }}>No trades match your filters.</div>}
          </div>
        </aside>

        <section style={{ minWidth: 0 }}>
          {!selected ? <div style={{ ...s.card, minHeight: 650, display: "grid", placeItems: "center", color: V.muted }}>No trade available for chart review.</div> : <>
            <div style={{ ...s.card, marginBottom: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}><strong style={{ fontSize: 20 }}>{selected.symbol}</strong><Badge dir={selected.dir} /><span style={{ color: V.muted, fontSize: 12 }}>{fd(selected.date)} {selected.time || ""}</span><span style={{ color: V.muted, fontSize: 12 }}>· {selected.setup || "No setup"}</span></div>
                <strong style={{ color: pnl(selected) >= 0 ? GRN : RED, fontSize: 18 }}>{fp(pnl(selected))}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(90px,1fr))", gap: 8, marginTop: 12 }}>
                <Meta label="Entry" value={selected.entry} />
                <Meta label="SL" value={selected.sl} tone={RED} />
                <Meta label="TP" value={selected.tp} tone={GRN} />
                <Meta label="Exit" value={selected.exit} />
                <Meta label="Risk" value={selected.risk ? `$${selected.risk}` : "—"} />
                <Meta label="R:R" value={selected.rr ? `${selected.rr}R` : "—"} />
                <Meta label="Session" value={selected.session || "—"} />
              </div>
            </div>

            <ChartPanel trade={selected} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              <Evidence label="Before Entry" src={selected.screenshot_before} />
              <Evidence label="After Exit" src={selected.screenshot_after} />
              <div style={{ ...s.card, minHeight: 190 }}>
                <div style={{ fontSize: 11, color: V.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>Execution Context</div>
                <div style={{ display: "grid", gap: 7, fontSize: 12, color: V.text }}>
                  <div><span style={{ color: V.muted }}>Timeframe:</span> {selected.timeframe || "Not recorded"}</div>
                  <div><span style={{ color: V.muted }}>Chart URL:</span> {selected.chart_url ? "Available" : "Not recorded"}</div>
                  <div><span style={{ color: V.muted }}>News checked:</span> {selected.news_checked ? "Yes" : "No / not recorded"}</div>
                  <div><span style={{ color: V.muted }}>Notes:</span> {Array.isArray(selected.notes_log) ? selected.notes_log.filter((n) => n?.text).length : 0} entries</div>
                </div>
              </div>
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}

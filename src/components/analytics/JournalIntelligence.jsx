import { memo, useMemo, useState } from "react";
import { AMBER, BLU, GRN, RED, V, fp } from "../../constants.js";
import { useJournalIntelligence } from "../../hooks/useJournalIntelligence.js";

const money = (n) => fp(Number(n) || 0);

function Stat({ label, value, sub, color = V.text }) {
  return <div style={{ padding: "14px 15px", background: V.surface, border: `0.5px solid ${V.border}`, borderRadius: V.radius }}>
    <div style={{ fontSize: 9, color: V.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
    <div style={{ marginTop: 6, fontSize: 20, fontWeight: 750, color }}>{value}</div>
    {sub && <div style={{ marginTop: 4, fontSize: 10, color: V.muted }}>{sub}</div>}
  </div>;
}

function Flag({ flag }) {
  const warning = flag.severity === "warning";
  return <div style={{ padding: "10px 11px", borderRadius: V.radius, border: `0.5px solid ${warning ? "rgba(245,158,11,.28)" : V.border}`, background: warning ? "rgba(245,158,11,.07)" : V.surface }}>
    <span style={{ color: warning ? AMBER : BLU, fontSize: 10, fontWeight: 750, textTransform: "uppercase" }}>{warning ? "Review" : "Info"}</span>
    <div style={{ marginTop: 4, color: V.text, fontSize: 11, lineHeight: 1.45 }}>{flag.text}</div>
  </div>;
}

function JournalIntelligence({ trades = [], onViewTrade, onViewChart, s }) {
  const [tab, setTab] = useState("queue");
  const intelligence = useJournalIntelligence(trades);
  const tabs = [["queue", "Review Queue"], ["daily", "Daily Summary"], ["patterns", "Patterns"]];
  const topPatterns = useMemo(() => intelligence.recurringMistakes.slice(0, 8), [intelligence.recurringMistakes]);

  return <div style={{ height: "100%", overflowY: "auto", background: V.bg }}>
    <div style={{ padding: "1.5rem 1.75rem 0", borderBottom: `0.5px solid ${V.border}`, background: `linear-gradient(135deg,${V.surface},${V.bg})` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: "-.02em" }}>Journal Intelligence</div>
          <div style={{ marginTop: 4, marginBottom: 16, fontSize: 12, color: V.muted }}>Automatic process checks built from your recorded trades, rules and news context.</div>
        </div>
        <div style={{ padding: "8px 12px", marginBottom: 16, border: `0.5px solid ${V.border}`, borderRadius: 999, color: V.muted, fontSize: 10 }}>News feed: {intelligence.newsStatus}</div>
      </div>
      <div style={{ display: "flex", gap: 2 }}>{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} style={{ padding: "10px 16px", border: 0, borderBottom: tab === id ? `2px solid ${BLU}` : "2px solid transparent", background: "transparent", color: tab === id ? BLU : V.muted, fontSize: 12, fontWeight: tab === id ? 650 : 450, cursor: "pointer" }}>{label}</button>)}</div>
    </div>

    <div style={{ padding: "1.25rem 1.75rem 2rem", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 10 }}>
        <Stat label="Trades" value={trades.length} sub="Recorded journal history" />
        <Stat label="Review Queue" value={intelligence.flagged.length} color={intelligence.flagged.length ? AMBER : GRN} sub="Trades with automatic flags" />
        <Stat label="Today P&L" value={money(intelligence.todayPnl)} color={intelligence.todayPnl >= 0 ? GRN : RED} sub={`${intelligence.todayTrades.length} trades today`} />
        <Stat label="Avg Process Score" value={`${intelligence.avgQuality}/100`} color={intelligence.avgQuality >= 80 ? GRN : intelligence.avgQuality >= 60 ? AMBER : RED} sub="Rule-based, not predictive" />
        <Stat label="Avg Planned R:R" value={intelligence.avgRR == null ? "—" : `${intelligence.avgRR.toFixed(2)}R`} color={intelligence.avgRR != null && intelligence.avgRR >= 3 ? GRN : AMBER} sub="From recorded SL / TP" />
      </div>

      {tab === "queue" && <>
        <div style={{ ...s.card, padding: 15 }}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 5 }}>Automatic Review Queue</div>
          <div style={{ fontSize: 10, color: V.muted, marginBottom: 14 }}>Flags are evidence-based prompts. They do not predict trade outcomes or replace your own review.</div>
          {!intelligence.reviewQueue.length ? <div style={{ padding: 20, color: V.muted, fontSize: 12 }}>No trades currently require automatic review.</div> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {intelligence.reviewQueue.map((trade) => <div key={trade.id || `${trade.date}-${trade.time}`} style={{ padding: 13, border: `0.5px solid ${V.border}`, borderRadius: V.radiusLg, background: V.surface }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 15, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{trade.symbol} · {trade.dir} · {trade.date || "—"} {trade.time || ""}</div>
                  <div style={{ marginTop: 3, fontSize: 10, color: V.muted }}>Session: {trade.session || trade.inferredSession} · Grade: {trade.grade || "—"} · Quality: {trade.quality}/100</div>
                </div>
                <div style={{ color: trade.pnl >= 0 ? GRN : RED, fontSize: 13, fontWeight: 750 }}>{money(trade.pnl)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8, marginTop: 11 }}>{trade.flags.map((flag, i) => <Flag key={`${flag.key}-${i}`} flag={flag} />)}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                {onViewTrade && <button type="button" onClick={() => onViewTrade(trade)} style={{ padding: "7px 10px", border: `0.5px solid ${V.border}`, background: V.bg, color: V.text, borderRadius: V.radius, cursor: "pointer", fontSize: 10 }}>Review Trade</button>}
                {onViewChart && <button type="button" onClick={() => onViewChart(trade)} style={{ padding: "7px 10px", border: `0.5px solid ${V.border}`, background: V.bg, color: BLU, borderRadius: V.radius, cursor: "pointer", fontSize: 10 }}>Open Chart</button>}
              </div>
            </div>)}
          </div>}
        </div>
      </>}

      {tab === "daily" && <div style={{ ...s.card, padding: 15 }}>
        <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 12 }}>Daily Trading Summary</div>
        {!intelligence.daily.length ? <div style={{ color: V.muted, fontSize: 12 }}>No dated trades available.</div> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Date", "Trades", "Wins", "Losses", "P&L", "Flagged"].map((h) => <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: V.muted, fontSize: 9, textTransform: "uppercase" }}>{h}</th>)}</tr></thead><tbody>{intelligence.daily.map((row) => <tr key={row.date}>{[row.date, row.trades, row.wins, row.losses, money(row.pnl), row.flagged].map((value, i) => <td key={i} style={{ padding: "10px", borderTop: `0.5px solid ${V.border}`, fontSize: 11, color: i === 4 ? (row.pnl >= 0 ? GRN : RED) : V.text }}>{value}</td>)}</tr>)}</tbody></table></div>}
      </div>}

      {tab === "patterns" && <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(280px,.8fr)", gap: 16 }}>
        <div style={{ ...s.card, padding: 15 }}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 5 }}>Recurring Mistakes</div>
          <div style={{ fontSize: 10, color: V.muted, marginBottom: 12 }}>Frequency and aggregate P&L for mistakes you explicitly recorded.</div>
          {!topPatterns.length ? <div style={{ color: V.muted, fontSize: 12 }}>No recorded mistakes yet.</div> : topPatterns.map((item) => <div key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: 15, padding: "11px 0", borderTop: `0.5px solid ${V.border}` }}><div style={{ fontSize: 11, color: V.text }}>{item.label}</div><div style={{ display: "flex", gap: 14, fontSize: 11 }}><span>{item.count}×</span><span style={{ color: item.pnl >= 0 ? GRN : RED }}>{money(item.pnl)}</span></div></div>)}
        </div>
        <div style={{ ...s.card, padding: 15 }}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 8 }}>How to read this</div>
          <div style={{ color: V.muted, fontSize: 11, lineHeight: 1.65 }}>Journal Intelligence is intentionally rule-based. It detects conditions from your recorded data — session timing, checklist completion, planned R:R, recorded mistakes and nearby high-impact news. It does not infer your intent or predict whether a trade will win.</div>
        </div>
      </div>}
    </div>
  </div>;
}

export default memo(JournalIntelligence);

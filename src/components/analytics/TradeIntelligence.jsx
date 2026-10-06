import { memo, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { V, GRN, RED, BLU, PURPLE, TEAL, AMBER, fp } from "../../constants.js";
import { usePerformanceStats } from "../../hooks/usePerformanceStats.js";
import { useTradeIntelligence } from "../../hooks/useTradeIntelligence.js";

const money = n => fp(Number(n) || 0);
const pct = n => `${Math.round(Number(n) || 0)}%`;

function Metric({ label, value, sub, color = V.text }) {
  return <div style={{ padding: "12px 14px", background: V.surface, border: `0.5px solid ${V.border}`, borderRadius: V.radius }}>
    <div style={{ fontSize: 9, color: V.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
    <div style={{ marginTop: 5, fontSize: 18, fontWeight: 750, color }}>{value}</div>
    {sub && <div style={{ marginTop: 3, fontSize: 10, color: V.muted }}>{sub}</div>}
  </div>;
}

function MiniTable({ title, rows, columns, empty = "Not enough data yet." }) {
  return <div style={{ ...V.card, background: V.surface, border: `0.5px solid ${V.border}`, borderRadius: V.radiusLg, overflow: "hidden" }}>
    <div style={{ padding: "13px 15px", borderBottom: `0.5px solid ${V.border}`, fontSize: 13, fontWeight: 650 }}>{title}</div>
    {!rows.length ? <div style={{ padding: 18, color: V.muted, fontSize: 12 }}>{empty}</div> : <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{columns.map(c => <th key={c.key} style={{ padding: "9px 12px", color: V.muted, fontSize: 9, textTransform: "uppercase", textAlign: c.align || "left", whiteSpace: "nowrap" }}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={`${row.key || row.label || row.setup || row.session || i}`}>
          {columns.map(c => <td key={c.key} style={{ padding: "10px 12px", borderTop: `0.5px solid ${V.border}`, fontSize: 11, color: c.color ? c.color(row) : V.text, textAlign: c.align || "left", whiteSpace: "nowrap" }}>{c.render ? c.render(row) : row[c.key]}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
  </div>;
}

function TradeIntelligence({ trades = [], s, checklist = [] }) {
  const [tab, setTab] = useState("overview");
  const performance = usePerformanceStats(trades, checklist);
  const intelligence = useTradeIntelligence(trades, performance, checklist);

  const edgeChart = useMemo(() => intelligence.sessionPerformance.filter(x => x.trades >= 2).slice(0, 6), [intelligence.sessionPerformance]);
  const mistakeChart = useMemo(() => intelligence.mistakeImpact.filter(x => x.trades > 0).slice(0, 6).map(x => ({ ...x, short: x.label.split("—")[0].trim() })), [intelligence.mistakeImpact]);

  const tabs = [
    ["overview", "Overview"],
    ["edges", "Edge Map"],
    ["behavior", "Behavior & Risk"],
  ];

  return <div style={{ height: "100%", overflowY: "auto", background: V.bg }}>
    <div style={{ padding: "1.5rem 1.75rem 0", borderBottom: `0.5px solid ${V.border}`, background: `linear-gradient(135deg,${V.surface},${V.bg})` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: "-.02em" }}>Trade Intelligence</div>
          <div style={{ marginTop: 4, marginBottom: 16, fontSize: 12, color: V.muted }}>Turn your journal history into repeatable edge, behavior and risk signals.</div>
        </div>
        <div style={{ padding: "8px 12px", marginBottom: 16, border: `0.5px solid ${V.border}`, borderRadius: 999, color: V.muted, fontSize: 10 }}>{trades.length} trades analyzed</div>
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} style={{ padding: "10px 16px", border: 0, borderBottom: tab === id ? `2px solid ${BLU}` : "2px solid transparent", background: "transparent", color: tab === id ? BLU : V.muted, fontSize: 12, fontWeight: tab === id ? 650 : 450, cursor: "pointer" }}>{label}</button>)}
      </div>
    </div>

    <div style={{ padding: "1.25rem 1.75rem 2rem", display: "flex", flexDirection: "column", gap: 16 }}>
      {tab === "overview" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 10 }}>
          <Metric label="Expectancy / Trade" value={money(intelligence.expectancyPerTrade)} color={intelligence.expectancyPerTrade >= 0 ? GRN : RED} sub="Net P&L ÷ all trades" />
          <Metric label="Decisive Expectancy" value={money(intelligence.decisiveExpectancy)} color={intelligence.decisiveExpectancy >= 0 ? GRN : RED} sub="Excludes breakeven" />
          <Metric label="Day Consistency" value={pct(intelligence.dayConsistency)} color={BLU} sub={`${intelligence.profitableDays}/${intelligence.activeDays} profitable days`} />
          <Metric label="Recovery Factor" value={intelligence.recoveryFactor == null ? "—" : intelligence.recoveryFactor.toFixed(2)} color={PURPLE} sub="Net P&L ÷ max DD" />
          <Metric label="Best Win Streak" value={`${intelligence.streaks.maxWin}`} color={GRN} sub="Consecutive winning trades" />
          <Metric label="Worst Loss Streak" value={`${intelligence.streaks.maxLoss}`} color={RED} sub="Consecutive losing trades" />
        </div>

        <div style={{ ...s.card, padding: "15px" }}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 12 }}>Actionable Signals</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
            {intelligence.insights.map((item, i) => <div key={i} style={{ padding: "12px 13px", borderRadius: V.radius, border: `0.5px solid ${item.type === "negative" ? "rgba(255,64,96,.25)" : item.type === "positive" ? "rgba(0,217,160,.25)" : V.border}`, background: item.type === "negative" ? "rgba(255,64,96,.05)" : item.type === "positive" ? "rgba(0,217,160,.05)" : V.surface }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: item.type === "negative" ? RED : item.type === "positive" ? GRN : V.text }}>{item.title}</div>
              <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.55, color: V.muted }}>{item.text}</div>
            </div>)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16 }}>
          <MiniTable title="Strongest Repeatable Groups" rows={[...intelligence.sessionPerformance, ...intelligence.symbolPerformance, ...intelligence.directionPerformance, ...intelligence.setupPerformance].filter(x => x.trades >= 3).sort((a,b) => b.expectancy-a.expectancy).slice(0,7)} columns={[
            { key: "label", label: "Group" },
            { key: "trades", label: "Trades", align: "right" },
            { key: "winRate", label: "Win Rate", align: "right", render: r => pct(r.winRate) },
            { key: "expectancy", label: "Exp.", align: "right", render: r => money(r.expectancy), color: r => r.expectancy >= 0 ? GRN : RED },
            { key: "pnl", label: "P&L", align: "right", render: r => money(r.pnl), color: r => r.pnl >= 0 ? GRN : RED },
          ]} />
          <div style={{ ...s.card }}>
            <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 8 }}>Session Expectancy</div>
            <div style={{ height: 230 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={edgeChart} layout="vertical" margin={{ left: 5, right: 15 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.1)" horizontal={false}/><XAxis type="number" tick={{fontSize:9,fill:V.muted}} tickFormatter={v=>`$${Math.round(v)}`} /><YAxis type="category" dataKey="label" width={90} tick={{fontSize:9,fill:V.muted}}/><Tooltip formatter={(v)=>money(v)} /><Bar dataKey="expectancy" radius={[0,4,4,0]}>{edgeChart.map((d,i)=><Cell key={i} fill={d.expectancy >= 0 ? GRN : RED}/>)}</Bar></BarChart></ResponsiveContainer></div>
          </div>
        </div>
      </>}

      {tab === "edges" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
          <Metric label="Best Session" value={intelligence.sessionPerformance[0]?.label || "—"} sub={intelligence.sessionPerformance[0] ? money(intelligence.sessionPerformance[0].pnl) : "No data"} color={TEAL}/>
          <Metric label="Best Symbol" value={intelligence.symbolPerformance[0]?.label || "—"} sub={intelligence.symbolPerformance[0] ? money(intelligence.symbolPerformance[0].pnl) : "No data"} color={BLU}/>
          <Metric label="Best Direction" value={intelligence.directionPerformance[0]?.label || "—"} sub={intelligence.directionPerformance[0] ? pct(intelligence.directionPerformance[0].winRate) : "No data"} color={PURPLE}/>
          <Metric label="Best Setup" value={intelligence.setupPerformance[0]?.label || "—"} sub={intelligence.setupPerformance[0] ? money(intelligence.setupPerformance[0].pnl) : "No data"} color={GRN}/>
        </div>
        <MiniTable title="Setup × Session Edge Map" rows={intelligence.edgeMatrix} columns={[
          { key: "setup", label: "Setup" },
          { key: "session", label: "Session" },
          { key: "trades", label: "Trades", align: "right" },
          { key: "winRate", label: "Win Rate", align: "right", render: r => pct(r.winRate) },
          { key: "expectancy", label: "Expectancy", align: "right", render: r => money(r.expectancy), color: r => r.expectancy >= 0 ? GRN : RED },
          { key: "pnl", label: "P&L", align: "right", render: r => money(r.pnl), color: r => r.pnl >= 0 ? GRN : RED },
        ]} empty="At least 2 trades are required for a setup/session combination." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <MiniTable title="Grade Performance" rows={intelligence.gradePerformance.filter(x => x.trades)} columns={[
            { key: "grade", label: "Grade" }, { key: "trades", label: "Trades", align: "right" }, { key: "winRate", label: "Win Rate", align: "right", render: r => pct(r.winRate) }, { key: "pnl", label: "P&L", align: "right", render: r => money(r.pnl), color: r => r.pnl >= 0 ? GRN : RED },
          ]}/>
          <MiniTable title="Direction Performance" rows={intelligence.directionPerformance} columns={[
            { key: "label", label: "Direction" }, { key: "trades", label: "Trades", align: "right" }, { key: "winRate", label: "Win Rate", align: "right", render: r => pct(r.winRate) }, { key: "expectancy", label: "Expectancy", align: "right", render: r => money(r.expectancy), color: r => r.expectancy >= 0 ? GRN : RED },
          ]}/>
        </div>
      </>}

      {tab === "behavior" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <MiniTable title="Checklist Impact" rows={intelligence.checklistImpact.filter(x => x.total > 0)} columns={[
            { key: "label", label: "Checklist Rule" }, { key: "compliance", label: "Compliance", align: "right", render: r => pct(r.compliance) }, { key: "winRateWhenChecked", label: "Checked WR", align: "right", render: r => pct(r.winRateWhenChecked) }, { key: "winRateDelta", label: "Delta", align: "right", render: r => `${r.winRateDelta >= 0 ? "+" : ""}${Math.round(r.winRateDelta)}pp`, color: r => r.winRateDelta >= 0 ? GRN : RED },
          ]}/>
          <MiniTable title="Mistake Impact" rows={intelligence.mistakeImpact.filter(x => x.trades > 0)} columns={[
            { key: "label", label: "Mistake" }, { key: "trades", label: "Count", align: "right" }, { key: "lossRate", label: "Loss Rate", align: "right", render: r => pct(r.lossRate) }, { key: "avgPnl", label: "Avg P&L", align: "right", render: r => money(r.avgPnl), color: r => r.avgPnl >= 0 ? GRN : RED },
          ]}/>
        </div>
        <div style={{ ...s.card }}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 8 }}>Mistake Frequency vs. Average P&L</div>
          <div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={mistakeChart} layout="vertical" margin={{ left: 5, right: 15 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.1)" horizontal={false}/><XAxis type="number" tick={{fontSize:9,fill:V.muted}} tickFormatter={v=>`$${Math.round(v)}`} /><YAxis type="category" dataKey="short" width={105} tick={{fontSize:9,fill:V.muted}}/><Tooltip formatter={(v)=>money(v)} /><Bar dataKey="avgPnl" radius={[0,4,4,0]}>{mistakeChart.map((d,i)=><Cell key={i} fill={d.avgPnl >= 0 ? GRN : RED}/>)}</Bar></BarChart></ResponsiveContainer></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <MiniTable title="News Checklist Comparison" rows={[{ label: "News Checked", ...intelligence.newsComparison.checked }, { label: "News Not Checked", ...intelligence.newsComparison.notChecked }]} columns={[
            { key: "label", label: "Group" }, { key: "trades", label: "Trades", align: "right" }, { key: "winRate", label: "Win Rate", align: "right", render: r => pct(r.winRate) }, { key: "avgPnl", label: "Avg P&L", align: "right", render: r => money(r.avgPnl), color: r => r.avgPnl >= 0 ? GRN : RED },
          ]}/>
          <div style={{ ...s.card }}>
            <div style={{ fontSize: 13, fontWeight: 650 }}>How to read this page</div>
            <p style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.6, color: V.muted }}>These are descriptive journal statistics, not guarantees. Small samples can look extreme. Use repeated observations and your existing setup rules before changing the trading plan.</p>
          </div>
        </div>
      </>}
    </div>
  </div>;
}

export default memo(TradeIntelligence);

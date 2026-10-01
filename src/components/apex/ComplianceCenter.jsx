import { useMemo } from "react";
import { V, GRN, RED, AMBER, BLU, fp } from "../../constants.js";
import { usePropFirmCompliance } from "../../hooks/usePropFirmCompliance.js";

const money = (v) => Number.isFinite(Number(v)) ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";
const pct = (v) => Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}%` : "—";

function Meter({ label, used, limit, color }) {
  const configured = Number.isFinite(Number(limit)) && Number(limit) > 0;
  const value = configured ? Math.max(0, Math.min(100, Number(used) / Number(limit) * 100)) : 0;
  return <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, marginBottom: 6 }}><span style={{ color: V.muted }}>{label}</span><b style={{ color }}>{configured ? `${money(used)} / ${money(limit)}` : "Not configured"}</b></div>
    {configured && <div style={{ height: 7, background: V.bg, border: `1px solid ${V.border}`, borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${value}%`, height: "100%", background: color }} /></div>}
  </div>;
}

export default function ComplianceCenter({ trades = [], settings = {}, s }) {
  const c = usePropFirmCompliance(trades, settings);
  const statusColor = c.hardViolations.length ? RED : c.warnings.length ? AMBER : GRN;
  const statusText = c.hardViolations.length ? "COMPLIANCE BLOCK" : c.warnings.length ? "REVIEW REQUIRED" : c.hasRules ? "WITHIN RULES" : "NO RULE SET";
  const card = { ...s.card, minWidth: 0 };

  return <div style={{ padding: "1.25rem", maxWidth: 1180, overflowY: "auto", maxHeight: "100vh" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: "1.25rem" }}>
      <div><p style={{ margin: 0, fontSize: 21, fontWeight: 700, color: V.text }}>Prop-Firm Compliance</p><p style={{ margin: "4px 0 0", fontSize: 12, color: V.muted }}>{c.firm && c.program ? `${c.firm} · ${c.program}` : "Select a prop-firm program in Prop Firm Setup to activate live rules."}</p></div>
      <span style={{ padding: "7px 10px", borderRadius: 999, background: `${statusColor}18`, border: `1px solid ${statusColor}55`, color: statusColor, fontSize: 10, fontWeight: 700, letterSpacing: ".06em" }}>{statusText}</span>
    </header>

    {!c.hasRules ? <div style={{ ...card, borderColor: `${AMBER}55`, color: AMBER, fontSize: 12 }}>No versioned prop-firm rule snapshot is active. Open <b>Prop Firm Setup</b>, select the exact program, review the rules and apply them.</div> : <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        {[['Current Equity', money(c.currentEquity), V.text], ["Today's P&L", fp(c.todayPnl), c.todayPnl >= 0 ? GRN : RED], ['Drawdown Buffer', c.drawdownRemaining != null ? money(c.drawdownRemaining) : "—", c.drawdownRemaining != null && c.drawdownRemaining < 0 ? RED : GRN], ['Daily Loss Remaining', c.dailyLossRemaining != null ? money(c.dailyLossRemaining) : "—", c.dailyLossRemaining != null && c.dailyLossRemaining < 0 ? RED : GRN]].map(([label, value, color]) => <div key={label} style={card}><div style={{ fontSize: 10, color: V.muted, textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 6, fontSize: 21, fontWeight: 700, color }}>{value}</div></div>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 16 }}>
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: V.text }}>Live loss guards</p>
          <Meter label="Daily loss used" used={c.dailyLossUsed} limit={c.dailyLossLimit} color={c.dailyLossRemaining != null && c.dailyLossRemaining < 0 ? RED : c.dailyLossRemaining != null && c.dailyLossRemaining < c.dailyLossLimit * .25 ? AMBER : GRN} />
          <Meter label="Drawdown used" used={c.currentDrawdown} limit={c.drawdownLimit} color={c.drawdownRemaining != null && c.drawdownRemaining < 0 ? RED : c.drawdownRemaining != null && c.drawdownRemaining < c.drawdownLimit * .25 ? AMBER : GRN} />
          <div style={{ padding: 11, borderRadius: V.radius, background: c.projectedDailyRemaining != null && c.projectedDailyRemaining < 0 ? `${RED}12` : `${GRN}10`, border: `1px solid ${c.projectedDailyRemaining != null && c.projectedDailyRemaining < 0 ? RED : GRN}44`, fontSize: 11, color: V.muted }}>Pre-trade planning uses the logged trade risk as downside exposure. This is a guard, not a prediction of the trade outcome.</div>
        </div>

        <div style={card}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: V.text }}>Rule progress</p>
          <div style={{ display: "grid", gap: 10, fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: V.muted }}>Consistency</span><b style={{ color: c.consistencyExceeded ? RED : GRN }}>{pct(c.consistencyPct)} {c.rules.consistencyRule != null ? `/ ${c.rules.consistencyRule}%` : ""}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: V.muted }}>Trading days</span><b style={{ color: V.text }}>{c.tradingDays}{c.rules.minTradingDays != null ? ` / ${c.rules.minTradingDays}` : ""}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: V.muted }}>Profitable days</span><b style={{ color: V.text }}>{c.profitableDays}{c.rules.minProfitableDays != null ? ` / ${c.rules.minProfitableDays}` : ""}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: V.muted }}>Profit target</span><b style={{ color: BLU }}>{c.profitProgress != null ? `${c.profitProgress.toFixed(0)}%` : "—"}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: V.muted }}>Max contracts</span><b style={{ color: V.text }}>{c.rules.maxContracts ?? "—"}</b></div>
          </div>
        </div>
      </div>

      {(c.hardViolations.length || c.warnings.length) > 0 && <div style={{ marginTop: 16, ...card }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: V.text }}>Rule alerts</p>
        {[...c.hardViolations.map(x => ({ ...x, severity: "BLOCK" })), ...c.warnings.map(x => ({ ...x, severity: "WARN" }))].map((x, i) => <div key={`${x.key}-${i}`} style={{ padding: "10px 12px", marginTop: 8, borderRadius: V.radius, background: x.severity === "BLOCK" ? `${RED}10` : `${AMBER}10`, border: `1px solid ${x.severity === "BLOCK" ? RED : AMBER}44` }}><b style={{ fontSize: 10, color: x.severity === "BLOCK" ? RED : AMBER }}>{x.severity} · {x.rule}</b><div style={{ marginTop: 3, fontSize: 11, color: V.muted }}>{x.detail}</div></div>)}
      </div>}

      <p style={{ margin: "14px 0 0", fontSize: 10, color: V.muted }}>Rules source: {c.source || "—"}{c.verifiedAt ? ` · verified ${new Date(c.verifiedAt).toLocaleString()}` : ""}. Rule enforcement uses the active versioned snapshot; it does not invent missing limits.</p>
    </>}
  </div>;
}

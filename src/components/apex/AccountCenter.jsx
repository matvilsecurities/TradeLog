import { useMemo } from "react";
import { V, GRN, RED, BLU, fp, fd } from "../../constants.js";
import { useAccountCenter } from "../../hooks/useAccountCenter.js";
import { usePropFirmCompliance } from "../../hooks/usePropFirmCompliance.js";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const pct = (value) => `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;

export default function AccountCenter({ trades = [], settings = {}, s }) {
  const a = useAccountCenter(trades, settings);
  const compliance = usePropFirmCompliance(trades, settings);
  const accountLabel = useMemo(() => `${a.accountName} · ${a.platform}`, [a.accountName, a.platform]);
  const riskColor = a.dailyRiskPct >= 90 ? RED : a.dailyRiskPct >= 60 ? "#f59e0b" : GRN;
  const ddColor = a.drawdownPct >= 90 ? RED : a.drawdownPct >= 60 ? "#f59e0b" : GRN;

  const Stat = ({ label, value, note, color = V.text }) => (
    <div style={{ ...s.card, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, color: V.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</p>
      <p style={{ margin: "7px 0 0", fontSize: 22, fontWeight: 600, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
      {note && <p style={{ margin: "4px 0 0", fontSize: 10, color: V.muted }}>{note}</p>}
    </div>
  );

  return (
    <div style={{ padding: "1.25rem", overflowY: "auto", maxHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: "1.25rem" }}>
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: V.text }}>Account Center</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: V.muted }}>{accountLabel}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 600, color: a.loggedPnl >= 0 ? GRN : RED }}>{fp(a.loggedPnl)}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: V.muted }}>Net logged P&L</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: "1.25rem" }}>
        <Stat label="Current Equity" value={`$${Math.round(a.currentEquity).toLocaleString()}`} note={`Start $${Math.round(a.accountSize).toLocaleString()}`} />
        <Stat label="High-Water Mark" value={`$${Math.round(a.highWaterMark).toLocaleString()}`} />
        <Stat label="Available Drawdown" value={`$${Math.round(a.availableDrawdown).toLocaleString()}`} color={ddColor} note={`${pct(a.drawdownPct)} of DD used`} />
        <Stat label="Today's P&L" value={fp(a.todayPnl)} color={a.todayPnl >= 0 ? GRN : RED} note={`${a.todayTrades} trade${a.todayTrades === 1 ? "" : "s"}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr .65fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div><p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: V.text }}>Equity progression</p><p style={{ margin: "3px 0 0", fontSize: 10, color: V.muted }}>Recorded trades only</p></div>
            <span style={{ fontSize: 11, color: V.muted }}>{a.equityCurve.length} data points</span>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={a.equityCurve.length ? a.equityCurve : [{ date: "Start", equity: a.accountSize, drawdownFloor: a.accountSize - a.maxDrawdown }]}>
                <defs><linearGradient id="accountCenterEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GRN} stopOpacity={0.2}/><stop offset="95%" stopColor={GRN} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: V.muted }} tickLine={false} axisLine={false} tickFormatter={fd} />
                <YAxis tick={{ fontSize: 10, fill: V.muted }} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} />
                <Tooltip formatter={(value) => [`$${Math.round(value).toLocaleString()}`, "Equity"]} labelFormatter={fd} contentStyle={{ background: V.bg, border: `1px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 12 }} />
                <Area type="monotone" dataKey="equity" stroke={GRN} fill="url(#accountCenterEquity)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="drawdownFloor" stroke={RED} fill="none" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: V.text }}>Risk status</p>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}><span style={{ color: V.muted }}>Daily loss used</span><span style={{ color: riskColor, fontWeight: 600 }}>${Math.round(a.dailyLossUsed).toLocaleString()} / ${Math.round(a.dailyLossLimit).toLocaleString()}</span></div>
              <div style={{ height: 7, background: V.surface, borderRadius: 5, overflow: "hidden", border: `1px solid ${V.border}` }}><div style={{ width: `${a.dailyRiskPct}%`, height: "100%", background: riskColor, borderRadius: 5 }} /></div>
              <p style={{ margin: "5px 0 0", fontSize: 10, color: V.muted }}>${Math.round(a.dailyLossRemaining).toLocaleString()} daily loss capacity remaining</p>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}><span style={{ color: V.muted }}>Trailing DD used</span><span style={{ color: ddColor, fontWeight: 600 }}>${Math.round(a.currentDrawdown).toLocaleString()} / ${Math.round(a.maxDrawdown).toLocaleString()}</span></div>
              <div style={{ height: 7, background: V.surface, borderRadius: 5, overflow: "hidden", border: `1px solid ${V.border}` }}><div style={{ width: `${a.drawdownPct}%`, height: "100%", background: ddColor, borderRadius: 5 }} /></div>
            </div>
          </div>

          <div style={s.card}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: V.text }}>Account requirements</p>
            <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: V.muted }}>Trading days</span><b style={{ color: a.tradingDaysOk ? GRN : V.text }}>{a.tradingDays} / {a.minTradingDays} {a.tradingDaysOk ? "✓" : ""}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: V.muted }}>Profitable days</span><b style={{ color: a.profitableDaysOk ? GRN : V.text }}>{a.profitableDays} / {a.minProfitableDays} {a.profitableDaysOk ? "✓" : ""}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: V.muted }}>Consistency</span><b style={{ color: a.consistencyOk ? GRN : RED }}>{a.consistencyPct.toFixed(1)}% / {a.consistencyRule}% {a.consistencyOk ? "✓" : "!"}</b></div>
            </div>
          </div>
        </div>
      </div>

      {compliance.hasRules && <div style={{ ...s.card, marginBottom: 12, borderColor: compliance.hardViolations.length ? `${RED}66` : compliance.warnings.length ? `#f59e0b66` : `${GRN}55` }}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><p style={{margin:0,fontSize:12,fontWeight:700,color:V.text}}>Prop-firm compliance</p><p style={{margin:"3px 0 0",fontSize:10,color:V.muted}}>{compliance.firm} · {compliance.program}</p></div><span style={{fontSize:10,fontWeight:700,color:compliance.hardViolations.length?RED:compliance.warnings.length?"#f59e0b":GRN}}>{compliance.hardViolations.length?"BLOCKED":compliance.warnings.length?"REVIEW":"WITHIN RULES"}</span></div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}><span style={{padding:"6px 9px",background:V.bg,border:`1px solid ${V.border}`,borderRadius:999,fontSize:10,color:V.muted}}>Daily loss remaining: {compliance.dailyLossRemaining != null ? money(compliance.dailyLossRemaining) : "—"}</span><span style={{padding:"6px 9px",background:V.bg,border:`1px solid ${V.border}`,borderRadius:999,fontSize:10,color:V.muted}}>Drawdown buffer: {compliance.drawdownRemaining != null ? money(compliance.drawdownRemaining) : "—"}</span><span style={{padding:"6px 9px",background:V.bg,border:`1px solid ${V.border}`,borderRadius:999,fontSize:10,color:V.muted}}>Consistency: {compliance.rules.consistencyRule != null ? `${compliance.consistencyPct.toFixed(1)}% / ${compliance.rules.consistencyRule}%` : "—"}</span></div></div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Stat label="Profit Target" value={a.profitTarget > 0 ? `${pct(a.profitProgress)}` : "Not configured"} note={a.profitTarget > 0 ? `${fp(a.profitRemaining)} remaining` : "Set target in Account Settings"} color={a.profitProgress >= 100 ? GRN : BLU} />
        <Stat label="Payout Status" value={a.payoutEligible ? "Eligible" : "Not eligible"} note={a.payoutEligible ? `Requestable ${fp(a.requestableAmount)}` : `Threshold $${Math.round(a.minEquityForPayout).toLocaleString()}`} color={a.payoutEligible ? GRN : V.muted} />
        <Stat label="Per-Trade Risk Limit" value={`$${Math.round(a.perTradeRiskLimit).toLocaleString()}`} note="Configured account guard" color={V.text} />
      </div>
    </div>
  );
}

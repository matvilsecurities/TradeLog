import { useMemo, useState } from "react";
import { V, GRN, RED, AMBER, BLU } from "../../constants.js";
import { calculatePropFirmCompliance } from "../../services/propFirmCompliance.js";
import { filterTradesForAccount } from "../../hooks/useAccountPortfolio.js";

const money = (v) => Number.isFinite(Number(v)) ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—";
const pct = (v) => Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}%` : "—";

export default function PortfolioCenter({ accounts = [], activeAccountId, selectAccount, createAccount, removeAccount, renameAccount, trades = [], s }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [program, setProgram] = useState("");
  const [notice, setNotice] = useState("");

  const rows = useMemo(() => accounts.map((account) => {
    const accountTrades = filterTradesForAccount(trades, account);
    const compliance = calculatePropFirmCompliance(accountTrades, account.settings);
    const loggedPnl = accountTrades.reduce((sum, trade) => sum + Number(trade?.pnl ?? trade?.profit_loss ?? 0), 0);
    const hasRules = compliance.hasRules;
    const status = !hasRules ? "SETUP" : compliance.hardViolations.length ? "BREACH" : compliance.warnings.length ? "REVIEW" : "HEALTHY";
    const statusColor = status === "BREACH" ? RED : status === "REVIEW" ? AMBER : status === "SETUP" ? V.muted : GRN;
    return { account, accountTrades, compliance, loggedPnl, status, statusColor };
  }), [accounts, trades]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.pnl += row.loggedPnl;
    acc.alerts += row.compliance.hardViolations.length + row.compliance.warnings.length;
    acc.healthy += row.status === "HEALTHY" ? 1 : 0;
    acc.breach += row.status === "BREACH" ? 1 : 0;
    return acc;
  }, { pnl: 0, alerts: 0, healthy: 0, breach: 0 }), [rows]);

  const addAccount = () => {
    const account = createAccount({ accountName: name.trim() || "New Trading Account", propFirm: firm.trim() || undefined, propProgram: program.trim() || undefined });
    setName(""); setFirm(""); setProgram(""); setShowCreate(false);
    selectAccount(account.id);
  };

  return <div style={{ padding: "1.25rem", maxWidth: 1280, overflowY: "auto", maxHeight: "100vh" }}>
    {notice && <div role="status" style={{ marginBottom: 12, padding: 10, border: `1px solid ${RED}55`, borderRadius: 10, color: RED, fontSize: 12 }}>{notice}</div>}
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
      <div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: V.text }}>Multi-Account Command Center</p>
        <p style={{ margin: "5px 0 0", fontSize: 12, color: V.muted }}>Monitor every prop account from one workspace while keeping each account's rules and performance separate.</p>
      </div>
      <button type="button" onClick={() => setShowCreate((v) => !v)} style={button(BLU)}>＋ Add account</button>
    </header>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
      <Kpi label="Accounts" value={accounts.length} />
      <Kpi label="Combined logged P&L" value={money(totals.pnl)} color={totals.pnl >= 0 ? GRN : RED} />
      <Kpi label="Healthy accounts" value={totals.healthy} color={GRN} />
      <Kpi label="Active alerts" value={totals.alerts} color={totals.alerts ? AMBER : GRN} />
    </div>

    {showCreate && <div style={{ ...s.card, marginBottom: 16, borderColor: `${BLU}55` }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: V.text }}>Add account profile</p>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <Field label="Account name" value={name} onChange={setName} placeholder="Apex 50K #2" s={s} />
        <Field label="Prop firm" value={firm} onChange={setFirm} placeholder="Apex Trader Funding" s={s} />
        <Field label="Program" value={program} onChange={setProgram} placeholder="EOD Performance 50K" s={s} />
        <button type="button" onClick={addAccount} style={button(GRN)}>Create</button>
      </div>
      <p style={{ margin: "9px 0 0", fontSize: 10, color: V.muted }}>After creation, open Prop Firm Setup to apply the exact versioned rule snapshot for that account.</p>
    </div>}

    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => {
        const active = row.account.id === activeAccountId;
        const c = row.compliance;
        return <div key={row.account.id} style={{ ...s.card, borderColor: active ? `${BLU}77` : V.border }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ fontSize: 15, color: V.text }}>{row.account.name}</b>
                {active && <span style={{ fontSize: 9, fontWeight: 700, color: BLU, background: `${BLU}12`, padding: "4px 7px", borderRadius: 999 }}>ACTIVE</span>}
                <span style={{ fontSize: 9, fontWeight: 700, color: row.statusColor, background: `${row.statusColor}12`, padding: "4px 7px", borderRadius: 999 }}>{row.status}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: V.muted }}>{row.account.settings.propFirm || "Prop firm not configured"} · {row.account.settings.propProgram || "Program not configured"}</p>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              {!active && <button type="button" onClick={() => selectAccount(row.account.id)} style={button(BLU)}>Switch</button>}
              <button type="button" onClick={() => { const next = window.prompt("Account name", row.account.name); if (next) renameAccount(row.account.id, next); }} style={button(V.text)}>Rename</button>
              <button type="button" onClick={async () => {
                if (!window.confirm(`Permanently remove ${row.account.name}? Accounts with trades or missed trades must be archived instead.`)) return;
                try { await removeAccount(row.account.id); setNotice("Account removed successfully."); }
                catch (error) { setNotice(error?.message || "Account could not be permanently removed. Archive it instead if it contains history."); }
              }} style={button(RED)}>Remove</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 8, marginTop: 14 }}>
            <Metric label="Equity" value={money(c.currentEquity)} />
            <Metric label="Logged P&L" value={money(row.loggedPnl)} color={row.loggedPnl >= 0 ? GRN : RED} />
            <Metric label="Daily buffer" value={money(c.dailyLossRemaining)} color={c.dailyLossRemaining != null && c.dailyLossRemaining <= 0 ? RED : V.text} />
            <Metric label="Drawdown buffer" value={money(c.drawdownRemaining)} color={c.drawdownRemaining != null && c.drawdownRemaining <= 0 ? RED : V.text} />
            <Metric label="Profit target" value={c.profitProgress == null ? "—" : pct(c.profitProgress)} />
            <Metric label="Trades" value={row.accountTrades.length} />
          </div>

          {c.hasRules && <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Tag text={`Trading days ${c.tradingDays}`} />
            <Tag text={`Profitable days ${c.profitableDays}`} />
            <Tag text={`Consistency ${pct(c.consistencyPct)}`} />
            {c.rules.maxContracts != null && <Tag text={`Max contracts ${c.rules.maxContracts}`} />}
            {c.rules.maxMicros != null && <Tag text={`Max micros ${c.rules.maxMicros}`} />}
            {c.hardViolations.length > 0 && <Tag text={`${c.hardViolations.length} hard breach${c.hardViolations.length === 1 ? "" : "es"}`} color={RED} />}
            {c.warnings.length > 0 && <Tag text={`${c.warnings.length} warning${c.warnings.length === 1 ? "" : "s"}`} color={AMBER} />}
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

function Kpi({ label, value, color = V.text }) { return <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: V.radiusLg, padding: 13 }}><div style={{ fontSize: 9, color: V.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div><div style={{ marginTop: 6, fontSize: 20, fontWeight: 700, color }}>{value}</div></div>; }
function Metric({ label, value, color = V.text }) { return <div style={{ padding: 10, background: V.bg, border: `1px solid ${V.border}`, borderRadius: V.radius }}><div style={{ fontSize: 9, color: V.muted }}>{label}</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color }}>{value}</div></div>; }
function Tag({ text, color = V.muted }) { return <span style={{ padding: "5px 8px", borderRadius: 999, border: `1px solid ${color}33`, background: `${color}09`, fontSize: 9, color }}>{text}</span>; }
function Field({ label, value, onChange, placeholder, s }) { return <div><label style={s.ilbl}>{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={s.inp} /></div>; }
function button(color) { return { padding: "7px 10px", borderRadius: 8, border: `1px solid ${V.border}`, background: V.surface, color, fontSize: 10, fontWeight: 700, cursor: "pointer" }; }

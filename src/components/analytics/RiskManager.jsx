import { useMemo, useState } from "react";
import { V, GRN, RED, AMBER, BLU, SYMBOLS } from "../../constants.js";
import { calculatePositionRisk } from "../../hooks/useRiskManagement.js";
import { usePropFirmCompliance } from "../../hooks/usePropFirmCompliance.js";
import "./RiskManager.css";

const card = { background: V.surface, border: `0.5px solid ${V.border}`, borderRadius: V.radiusLg, padding: "18px" };
const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, outline: "none" };
const label = { display: "block", marginBottom: 6, fontSize: 11, color: V.muted, textTransform: "uppercase", letterSpacing: "0.06em" };

function money(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function RiskManager({ trades = [], settings = {} }) {
  const [symbol, setSymbol] = useState("MNQ");
  const [dir, setDir] = useState("Long");
  const [account, setAccount] = useState("50000");
  const [maxRisk, setMaxRisk] = useState("250");
  const [entry, setEntry] = useState(20000);
  const [stop, setStop] = useState(19950);
  const [target, setTarget] = useState(20100);
  const [quantity, setQuantity] = useState(1);
  const [entries, setEntries] = useState([]);
  const [dailyLimit, setDailyLimit] = useState("300");
  const compliance = usePropFirmCompliance(trades, settings, { risk: 0, qty: quantity, symbol });
  const ruleRisk = compliance.dailyLossLimit;
  const ruleMaxContracts = compliance.rules.maxContracts ?? compliance.rules.maxMicros;
  const plan = useMemo(() => calculatePositionRisk({ symbol, dir, entry, stop, target, quantity, entries }), [symbol, dir, entry, stop, target, quantity, entries]);
  const accountNum = Number(account);
  const maxRiskNum = Number(maxRisk);
  const dailyLimitNum = Number(dailyLimit);
  const activeDailyLimit = ruleRisk != null ? ruleRisk : dailyLimitNum;
  const riskPct = accountNum > 0 && plan.risk != null ? (plan.risk / accountNum) * 100 : null;
  const maxQty = plan.stopPoints && plan.multiplier && maxRiskNum > 0 ? Math.floor(maxRiskNum / (plan.stopPoints * plan.multiplier)) : null;
  const dailyUsed = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (trades || []).filter(t => String(t?.date || t?.trade_date || "").slice(0, 10) === today).reduce((sum, t) => {
      const r = Number(t?.risk); return Number.isFinite(r) && r > 0 ? sum + r : sum;
    }, 0);
  }, [trades]);
  const dailyAfter = dailyUsed + (plan.risk || 0);
  const riskState = plan.risk == null ? "neutral" : maxRiskNum > 0 && plan.risk > maxRiskNum ? "danger" : "safe";
  const dailyState = activeDailyLimit > 0 && dailyAfter > activeDailyLimit ? "danger" : "safe";

  const addEntry = () => setEntries(prev => [...prev, { price: "", qty: "1" }]);
  const updateEntry = (index, field, value) => setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  const removeEntry = (index) => setEntries(prev => prev.filter((_, i) => i !== index));
  const clearEntries = () => setEntries([]);

  const field = (labelText, value, setter, placeholder = "") => (
    <div className="risk-field"><label>{labelText}</label><input type="number" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)} /></div>
  );

  const kpi = (title, value, subtitle, tone = "neutral") => (
    <div className={`risk-kpi ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{subtitle}</small>
    </div>
  );

  return (
    <div className="risk-manager-page">
      <header className="risk-manager-header">
        <div>
          <h1>Risk &amp; Position Manager</h1>
          <p>Plan the position before entry: size, dollar risk, reward and daily exposure.</p>
        </div>
      </header>

      <section className="risk-input-card">
        <div className="risk-input-grid risk-input-grid-top">
          <div className="risk-field">
            <label>Symbol</label>
            <select value={symbol} onChange={e => setSymbol(e.target.value)}>
              {SYMBOLS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="risk-field">
            <label>Direction</label>
            <div className="risk-segmented">
              <button className={dir === "Long" ? "active long" : ""} onClick={() => setDir("Long")}>Long</button>
              <button className={dir === "Short" ? "active short" : ""} onClick={() => setDir("Short")}>Short</button>
            </div>
          </div>
          {field("Quantity", quantity, setQuantity, "1")}
        </div>

        <div className="risk-input-grid risk-input-grid-prices">
          {field("Entry", entry, setEntry)}
          {field("Stop Loss", stop, setStop)}
          {field("Take Profit", target, setTarget)}
        </div>

        <div className="risk-scale-row">
          <div>
            <strong>Scale-in entries</strong>
            <span>Optional. Weighted average replaces the single entry price.</span>
          </div>
          <div className="risk-inline-actions">
            <button className="risk-small-btn accent" onClick={addEntry}>+ Add</button>
            {entries.length > 0 && <button className="risk-small-btn" onClick={clearEntries}>Clear</button>}
          </div>
        </div>

        {entries.length > 0 && (
          <div className="risk-entry-list">
            {entries.map((e, i) => (
              <div key={i} className="risk-entry-row">
                <input type="number" placeholder="Price" value={e.price} onChange={ev => updateEntry(i, "price", ev.target.value)} />
                <input type="number" placeholder="Qty" value={e.qty} onChange={ev => updateEntry(i, "qty", ev.target.value)} />
                <button onClick={() => removeEntry(i)} aria-label="Remove scale-in entry">×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="risk-kpi-grid">
        {kpi("Planned risk", money(plan.risk), plan.stopPoints ? `${plan.stopPoints.toFixed(2)} pts × ${plan.quantity} × $${plan.multiplier}/pt` : "Enter a valid stop", riskState === "danger" ? "danger" : "green")}
        {kpi("Reward", money(plan.reward), "Planned reward")}
        {kpi("R:R", plan.rr ? `${plan.rr.toFixed(2)}R` : "—", "Risk / reward", plan.rr >= 2 ? "green" : plan.rr >= 1 ? "amber" : "danger")}
        {kpi("Average entry", plan.avgEntry != null ? plan.avgEntry.toFixed(2) : "—", entries.length ? "Weighted average" : "Single entry")}
        {kpi("Max quantity", maxQty != null ? maxQty : "—", maxQty != null ? "By risk limit" : "Set risk + stop")}
      </section>

      <section className="risk-settings-grid">
        <div className="risk-panel">
          {field("Account Size", account, setAccount)}
          <small>Planned risk is <b>{riskPct != null ? `${riskPct.toFixed(2)}%` : "—"}</b> of account.</small>
        </div>
        <div className="risk-panel">
          {field("Max Risk / Trade", maxRisk, setMaxRisk)}
          <small className={riskState === "danger" ? "danger-text" : "green-text"}>{maxQty != null ? `At this stop, max quantity: ${maxQty}` : "Set a valid risk limit and stop."}</small>
        </div>
        <div className="risk-panel">
          {field("Daily Risk Limit", ruleRisk != null ? ruleRisk : dailyLimit, ruleRisk != null ? () => {} : setDailyLimit)}
          <small className={dailyState === "danger" ? "danger-text" : ""}>Today: {money(dailyUsed)} · After trade: {money(dailyAfter)}{ruleRisk != null ? " · Prop-firm rule" : ""}</small>
        </div>
      </section>

      {compliance.hasRules && (
        <section className="risk-status-card">
          <div className="risk-status-head">
            <div>
              <strong>Prop-firm guard</strong>
              <span>{compliance.firm} · {compliance.program}</span>
            </div>
            <b className={compliance.canEnter ? "green-text" : "danger-text"}>{compliance.canEnter ? "✓ No hard rule breach" : "✕ Hard rule breach"}</b>
          </div>
          <div className="risk-badges">
            <span>Daily loss: {ruleRisk != null ? money(ruleRisk) : "Not configured"}</span>
            <span>Max contracts: {ruleMaxContracts ?? "Not configured"}</span>
            <span>DD buffer: {compliance.drawdownRemaining != null ? money(compliance.drawdownRemaining) : "Not configured"}</span>
          </div>
        </section>
      )}

      <section className={`risk-guard-card ${dailyState === "danger" || riskState === "danger" ? "danger" : "safe"}`}>
        <div className="risk-guard-title">Pre-trade guard</div>
        <div className="risk-guard-items">
          <span className={riskState === "danger" ? "danger" : "safe"}>{riskState === "danger" ? "✕ Trade risk exceeds limit" : "✓ Trade risk within limit"}</span>
          <span className={dailyState === "danger" ? "danger" : "safe"}>{dailyState === "danger" ? "✕ Daily risk would exceed limit" : "✓ Daily risk within limit"}</span>
          <span className={plan.rr >= 2 ? "safe" : "amber"}>{plan.rr ? `${plan.rr.toFixed(2)}R planned` : "R:R not available"}</span>
        </div>
      </section>
    </div>
  );
}

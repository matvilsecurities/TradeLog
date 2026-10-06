import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BarChart3, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, History, Plus, Save, ShieldCheck, Target, X } from "lucide-react";
import { useTradingPlan } from "../../hooks/useTradingPlan.js";
import { getSetupRating, toLocalISODate } from "../../constants.js";
import { SETUP_CHECKS_DEFAULT } from "../../setupChecklist.js";
import "../../styles/tradingPlan.css";

const BIAS_OPTIONS = [
  { value: "Strong bullish", description: "Clear upside structure and momentum." },
  { value: "Bullish", description: "Upside bias, but confirmation still required." },
  { value: "Neutral", description: "No directional edge until structure resolves." },
  { value: "Bearish", description: "Downside bias, but confirmation still required." },
  { value: "Strong bearish", description: "Clear downside structure and momentum." },
];

const biasClass = (value = "") => value.toLowerCase().replace(/\s+/g, "-");
const dateKey = (value) => String(value || "").slice(0, 10);
const money = (value) => `${Number(value || 0) < 0 ? "-" : ""}$${Math.abs(Number(value || 0)).toFixed(2)}`;
const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};
function Field({ label, children }) {
  return <label className="trading-plan-field"><span className="trading-plan-label">{label}</span>{children}</label>;
}

function Kpi({ label, value, sub, tone = "" }) {
  return <div className={`trading-plan-kpi ${tone}`}><span className="trading-plan-kpi-label">{label}</span><strong className="trading-plan-kpi-value">{value}</strong>{sub && <small className="trading-plan-kpi-sub">{sub}</small>}</div>;
}

function BiasSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const selected = BIAS_OPTIONS.find((item) => item.value === value);
  return (
    <div className="trading-plan-field" ref={ref}>
      <span className="trading-plan-label">Market bias</span>
      <button type="button" className="trading-plan-select-trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="trading-plan-select-value"><i className={`trading-plan-bias-dot ${biasClass(value)}`} />{selected?.value || "Select bias"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && <div className="trading-plan-select-menu" role="listbox">
        <button type="button" className={`trading-plan-select-option ${!value ? "selected" : ""}`} onClick={() => { onChange(""); setOpen(false); }}>
          <i className="trading-plan-bias-dot" /><span><b>Select bias</b><small>Choose the directional context before trading.</small></span>{!value && <Check size={13} />}
        </button>
        {BIAS_OPTIONS.map((option) => {
          const selectedOption = option.value === value;
          return <button key={option.value} type="button" role="option" aria-selected={selectedOption} className={`trading-plan-select-option ${selectedOption ? "selected" : ""}`} onClick={() => { onChange(option.value); setOpen(false); }}>
            <i className={`trading-plan-bias-dot ${biasClass(option.value)}`} /><span><b>{option.value}</b><small>{option.description}</small></span>{selectedOption && <Check size={13} />}
          </button>;
        })}
      </div>}
    </div>
  );
}

function PlanReadOnly({ plan, tradeCount, pnl, onClose }) {
  if (!plan) return null;
  return (
    <section className="trading-plan-detail-card">
      <div className="trading-plan-detail-head">
        <div><div className="trading-plan-card-title">Trading plan · {formatDate(plan.date)}</div><div className="trading-plan-card-sub">Saved session context and execution limits.</div></div>
        <button type="button" className="trading-plan-icon-btn" onClick={onClose} aria-label="Close plan"><X size={14} /></button>
      </div>
      <div className="trading-plan-detail-grid">
        <Kpi label="Market bias" value={plan.marketBias || "Not set"} />
        <Kpi label="Setup focus" value={plan.setupFocus || "Not set"} />
        <Kpi label="Max risk" value={money(plan.maxRisk)} sub="Daily limit" />
        <Kpi label="Max trades" value={plan.maxTrades} sub="Daily limit" />
        <Kpi label="Trades executed" value={tradeCount} sub={money(pnl)} tone={pnl >= 0 ? "positive" : "warning"} />
        <Kpi label="Rules confirmed" value={plan.rulesConfirmed ? "Yes" : "No"} />
      </div>
      <div className="trading-plan-detail-columns">
        <div><span className="trading-plan-label">Key levels</span><p>{plan.keyLevels || "No levels recorded."}</p></div>
        <div><span className="trading-plan-label">News focus</span><p>{plan.newsFocus || "No news focus recorded."}</p></div>
        <div className="trading-plan-detail-notes"><span className="trading-plan-label">Session notes</span><p>{plan.notes || "No notes recorded."}</p></div>
      </div>
    </section>
  );
}

export default function TradingPlan({ trades = [], userId, s, theme = "light" }) {
  const today = toLocalISODate();
  const { plan, updatePlan, savePlan, clearPlan, savedAt, saving, storageError, loadHistory } = useTradingPlan(userId, today);
  const [section, setSection] = useState("overview");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${today}T00:00:00`));

  const tradesByDate = useMemo(() => {
    const map = new Map();
    (Array.isArray(trades) ? trades : []).forEach((trade) => {
      const key = dateKey(trade?.trade_date || trade?.date);
      if (!key) return;
      const current = map.get(key) || { count: 0, pnl: 0 };
      current.count += 1;
      current.pnl += Number(trade?.pnl) || 0;
      map.set(key, current);
    });
    return map;
  }, [trades]);

  const todayTrades = (Array.isArray(trades) ? trades : []).filter((t) => dateKey(t?.trade_date || t?.date) === today);
  const todayStats = tradesByDate.get(today) || { count: 0, pnl: 0 };
  const todayRisk = todayTrades.reduce((sum, t) => sum + (Number(t?.risk_amount ?? t?.risk) || 0), 0);
  const maxRisk = Number(plan.maxRisk) || 0;
  const maxTrades = Number(plan.maxTrades) || 0;
  const riskRemaining = Math.max(0, maxRisk - todayRisk);
  const tradesRemaining = Math.max(0, maxTrades - todayStats.count);
  const noteLength = String(plan.notes || "").length;
  const setupChecklist = plan.setupChecklist && typeof plan.setupChecklist === "object" ? plan.setupChecklist : {};
  const checkedSetupCount = SETUP_CHECKS_DEFAULT.filter((item) => Boolean(setupChecklist[item.key])).length;
  const setupRating = getSetupRating(setupChecklist);

  useEffect(() => {
    if (!plan.setupChecklist || Object.keys(plan.setupChecklist).length === 0) {
      updatePlan({ setupChecklist: Object.fromEntries(SETUP_CHECKS_DEFAULT.map((item) => [item.key, false])) });
    }
  }, [plan.setupChecklist, updatePlan]);

  const refreshHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const rows = await loadHistory();
      setHistory(rows);
      if (selectedHistory) setSelectedHistory(rows.find((row) => row.date === selectedHistory.date) || null);
    } catch (error) {
      setHistoryError(error?.message || "Unable to load trading plan history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { refreshHistory(); }, [userId]);

  const handleSave = async () => {
    const saved = await savePlan();
    setSavedNotice(true);
    setSection("today");
    await refreshHistory();
    setTimeout(() => setSavedNotice(false), 3500);
    return saved;
  };

  const handleClear = async () => {
    await clearPlan();
    await refreshHistory();
  };

  const previousPlan = useMemo(() => history.find((item) => item.date !== today) || null, [history, today]);
  const monthKey = today.slice(0, 7);
  const plansThisMonth = history.filter((item) => String(item.date || "").startsWith(monthKey)).length;
  const planStreak = useMemo(() => {
    const savedDates = new Set(history.map((item) => item.date));
    let cursor = new Date(`${today}T00:00:00`);
    let streak = 0;
    while (savedDates.has(toLocalISODate(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [history, today]);
  const todayPlanSaved = Boolean(plan.id || savedAt);
  const todayRiskUsedPct = maxRisk > 0 ? Math.min(100, Math.round((todayRisk / maxRisk) * 100)) : 0;
  const previousPlanStats = previousPlan ? (tradesByDate.get(previousPlan.date) || { count: 0, pnl: 0 }) : { count: 0, pnl: 0 };

  const monthLabel = calendarMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const savedPlan = history.find((item) => item.date === key);
      return { key, day: d.getDate(), inMonth: d.getMonth() === month, savedPlan, stats: tradesByDate.get(key) || { count: 0, pnl: 0 } };
    });
  }, [calendarMonth, history, tradesByDate]);

  return (
    <section className={`trading-plan-workspace ${theme === "dark" ? "trading-plan-dark" : ""}`} data-theme={theme}>
      <header className="trading-plan-header">
        <div>
          <div className="trading-plan-eyebrow">Daily workspace</div>
          <h1 className="trading-plan-title">Trading Plan</h1>
          <div className="trading-plan-subtitle">{today} · Plan the session before the first trade.</div>
        </div>
        <div className="trading-plan-actions">
          <button type="button" className="trading-plan-btn" onClick={handleClear}>Clear</button>
          <button type="button" className="trading-plan-btn primary" onClick={handleSave} disabled={saving}><Save size={13} />{saving ? "Saving…" : "Save Plan"}</button>
        </div>
      </header>

      {savedNotice && <div className="trading-plan-saved-banner"><Check size={14} /><span><strong>Plan saved.</strong> Today's plan is stored in Supabase.</span><button type="button" onClick={() => { setSection("history"); setSelectedHistory(history.find((item) => item.date === today) || { ...plan, date: today }); }}>View today's plan</button></div>}

      <nav className="trading-plan-tabs" aria-label="Trading plan sections">
        <button className={section === "overview" ? "active" : ""} onClick={() => setSection("overview")}><BarChart3 size={13} />Overview</button>
        <button className={section === "today" ? "active" : ""} onClick={() => setSection("today")}><FileText size={13} />Today's plan</button>
        <button className={section === "history" ? "active" : ""} onClick={() => { setSection("history"); refreshHistory(); }}><History size={13} />Plan history</button>
        <button className={section === "calendar" ? "active" : ""} onClick={() => { setSection("calendar"); refreshHistory(); }}><CalendarDays size={13} />Calendar</button>
      </nav>

      {section === "overview" && <>
        <section className="trading-plan-overview-kpis" aria-label="Trading plan dashboard metrics">
          <Kpi label="Today's plan" value={todayPlanSaved ? "Ready" : "Not created"} sub={todayPlanSaved ? "Saved session" : "Build before trading"} tone={todayPlanSaved ? "positive" : "warning"} />
          <Kpi label="Plans this month" value={plansThisMonth} sub="Saved trading sessions" />
          <Kpi label="Plan streak" value={`${planStreak} day${planStreak === 1 ? "" : "s"}`} sub="Consecutive saved plans" />
          <Kpi label="Today's P&L" value={money(todayStats.pnl)} sub={`${todayStats.count} trade${todayStats.count === 1 ? "" : "s"} journaled`} tone={todayStats.pnl >= 0 ? "positive" : "warning"} />
          <Kpi label="Risk limit" value={money(maxRisk)} sub={`${money(todayRisk)} used · ${money(riskRemaining)} left`} tone={riskRemaining <= 0 ? "warning" : "positive"} />
          <Kpi label="Trade capacity" value={`${todayStats.count}/${maxTrades || 0}`} sub={`${tradesRemaining} remaining today`} tone={tradesRemaining <= 0 ? "warning" : ""} />
        </section>

        <div className="trading-plan-dashboard-grid">
          <div className="trading-plan-dashboard-main">
            <section className="trading-plan-dashboard-card trading-plan-today-preview">
              <div className="trading-plan-dashboard-card-head">
                <div>
                  <div className="trading-plan-card-title">Today's trading plan</div>
                  <div className="trading-plan-card-sub">Your live session command centre for {formatDate(today)}.</div>
                </div>
                <button type="button" className="trading-plan-btn primary" onClick={() => setSection("today")}>
                  {todayPlanSaved ? <FileText size={13} /> : <Plus size={13} />} {todayPlanSaved ? "Open Plan" : "Make Trading Plan"} <ArrowRight size={12} />
                </button>
              </div>
              <div className="trading-plan-dashboard-card-body">
                <div className="trading-plan-plan-hero">
                  <div className="trading-plan-plan-hero-icon"><Target size={18} /></div>
                  <div className="trading-plan-plan-hero-copy">
                    <span className="trading-plan-label">Market bias</span>
                    <strong>{plan.marketBias || "No directional bias set"}</strong>
                    <small>{plan.setupFocus || "Define your setup focus before the first trade."}</small>
                  </div>
                  <span className={`trading-plan-status-pill ${todayPlanSaved ? "ready" : "pending"}`}><i />{todayPlanSaved ? "Ready" : "Draft"}</span>
                </div>
                <div className="trading-plan-overview-metrics">
                  <div><span>Max daily risk</span><strong>{money(maxRisk)}</strong></div>
                  <div><span>Max trades</span><strong>{maxTrades || 0}</strong></div>
                  <div><span>News focus</span><strong>{plan.newsFocus || "Not specified"}</strong></div>
                  <div><span>Rules confirmed</span><strong>{plan.rulesConfirmed ? "Yes" : "Pending"}</strong></div>
                </div>
                <div className="trading-plan-progress-block">
                  <div className="trading-plan-progress-head"><span>Today's risk usage</span><strong>{todayRiskUsedPct}%</strong></div>
                  <div className="trading-plan-progress"><span style={{ width: `${todayRiskUsedPct}%` }} /></div>
                  <small>{money(todayRisk)} of {money(maxRisk)} used from today's risk plan.</small>
                </div>
              </div>
            </section>

            <section className="trading-plan-dashboard-card">
              <div className="trading-plan-dashboard-card-head">
                <div><div className="trading-plan-card-title">Previous trading plan</div><div className="trading-plan-card-sub">Your latest completed session plan and its journal outcome.</div></div>
                {previousPlan && <button type="button" className="trading-plan-text-link" onClick={() => { setSelectedHistory(previousPlan); setSection("history"); }}>View plan <ArrowRight size={11} /></button>}
              </div>
              {previousPlan ? <div className="trading-plan-previous-body">
                <div className="trading-plan-previous-top">
                  <div><span className="trading-plan-label">{formatDate(previousPlan.date)}</span><strong>{previousPlan.marketBias || "No bias"}</strong></div>
                  <div className={`trading-plan-previous-pnl ${previousPlanStats.pnl >= 0 ? "positive" : "negative"}`}>{money(previousPlanStats.pnl)}<small>{previousPlanStats.count} trade{previousPlanStats.count === 1 ? "" : "s"}</small></div>
                </div>
                <div className="trading-plan-previous-grid">
                  <div><span>Setup focus</span><strong>{previousPlan.setupFocus || "Not recorded"}</strong></div>
                  <div><span>Max risk</span><strong>{money(previousPlan.maxRisk)}</strong></div>
                  <div><span>Max trades</span><strong>{previousPlan.maxTrades}</strong></div>
                  <div><span>Rules</span><strong>{previousPlan.rulesConfirmed ? "Confirmed" : "Not confirmed"}</strong></div>
                </div>
              </div> : <div className="trading-plan-empty compact"><History size={17} /><strong>No previous plan</strong><span>Save today's plan and this dashboard will build your history automatically.</span></div>}
            </section>
          </div>

          <aside className="trading-plan-dashboard-side">
            <section className="trading-plan-dashboard-card trading-plan-mini-calendar">
              <div className="trading-plan-dashboard-card-head">
                <div><div className="trading-plan-card-title">Plan calendar</div><div className="trading-plan-card-sub">Saved sessions and daily P&L.</div></div>
                <button type="button" className="trading-plan-text-link" onClick={() => setSection("calendar")}>Full calendar <ArrowRight size={11} /></button>
              </div>
              <div className="trading-plan-mini-calendar-head"><button className="trading-plan-icon-btn" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft size={13} /></button><strong>{monthLabel}</strong><button className="trading-plan-icon-btn" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight size={13} /></button></div>
              <div className="trading-plan-mini-calendar-grid">
                {['S','M','T','W','T','F','S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
                {calendarCells.map((cell) => <button key={cell.key} className={`${cell.inMonth ? "" : "muted"} ${cell.key === today ? "today" : ""} ${cell.savedPlan ? "has-plan" : ""}`} onClick={() => { if (cell.savedPlan) { setSelectedHistory(cell.savedPlan); setSection("history"); } }}><b>{cell.day}</b>{cell.savedPlan && <i />}{cell.stats.count > 0 && <small className={cell.stats.pnl >= 0 ? "positive" : "negative"}>{cell.stats.pnl >= 0 ? "+" : "−"}</small>}</button>)}
              </div>
              <div className="trading-plan-calendar-legend"><span><i className="plan" /> Plan saved</span><span><i className="today" /> Today</span><span><i className="pnl" /> P&L</span></div>
            </section>

            <section className="trading-plan-dashboard-card trading-plan-quick-actions">
              <div className="trading-plan-dashboard-card-head"><div><div className="trading-plan-card-title">Quick actions</div><div className="trading-plan-card-sub">Move directly into the planning workflow.</div></div></div>
              <button type="button" className="trading-plan-quick-action primary" onClick={() => setSection("today")}><span className="icon"><Plus size={14} /></span><span><strong>{todayPlanSaved ? "Edit today's plan" : "Make today's plan"}</strong><small>Set bias, levels, risk and execution rules.</small></span><ArrowRight size={13} /></button>
              <button type="button" className="trading-plan-quick-action" onClick={() => { setSection("history"); refreshHistory(); }}><span className="icon"><History size={14} /></span><span><strong>Review plan history</strong><small>Compare previous sessions and journal results.</small></span><ArrowRight size={13} /></button>
              <button type="button" className="trading-plan-quick-action" onClick={() => { setSection("calendar"); refreshHistory(); }}><span className="icon"><CalendarDays size={14} /></span><span><strong>Open plan calendar</strong><small>See planned and traded days at a glance.</small></span><ArrowRight size={13} /></button>
            </section>
          </aside>
        </div>

        <section className="trading-plan-dashboard-bottom">
          <div className="trading-plan-dashboard-card trading-plan-command-card"><div className="trading-plan-dashboard-card-head"><div><div className="trading-plan-card-title">Execution readiness</div><div className="trading-plan-card-sub">A quick check before you move from planning into Log Trade.</div></div><ShieldCheck size={17} /></div><div className="trading-plan-readiness-list"><div className={plan.marketBias ? "complete" : "pending"}><i />Market bias <b>{plan.marketBias ? "Set" : "Pending"}</b></div><div className={plan.setupFocus ? "complete" : "pending"}><i />Setup focus <b>{plan.setupFocus ? "Set" : "Pending"}</b></div><div className={plan.keyLevels ? "complete" : "pending"}><i />Key levels <b>{plan.keyLevels ? "Set" : "Pending"}</b></div><div className={plan.rulesConfirmed ? "complete" : "pending"}><i />Rules confirmation <b>{plan.rulesConfirmed ? "Confirmed" : "Pending"}</b></div></div></div>
          <div className="trading-plan-dashboard-card trading-plan-link-card"><div><span className="trading-plan-label">Trade Log integration</span><strong>Plan → Execution → Result</strong><p>New trades logged on a planned date keep a snapshot of that day's plan, so the original context stays attached to the trade.</p></div><button type="button" className="trading-plan-btn" onClick={() => setSection("today")}>Open plan <ArrowRight size={12} /></button></div>
        </section>
      </>}

      {section === "today" && <>
        <section className="trading-plan-kpis" aria-label="Trading plan summary">
          <Kpi label="Today P&L" value={money(todayStats.pnl)} sub="Today's journal performance" tone={todayStats.pnl >= 0 ? "positive" : "warning"} />
          <Kpi label="Trades" value={todayStats.count} sub="Journaled today" />
          <Kpi label="Risk remaining" value={money(riskRemaining)} sub={`Max daily risk ${money(maxRisk)}`} tone={riskRemaining <= 0 ? "warning" : "positive"} />
          <Kpi label="Trades remaining" value={tradesRemaining} sub={`Max ${maxTrades} trades`} tone={tradesRemaining <= 0 ? "warning" : ""} />
        </section>

        <div className="trading-plan-grid">
          <section className="trading-plan-card">
            <div className="trading-plan-card-head"><div className="trading-plan-card-title">Session setup</div><div className="trading-plan-card-sub">Define the market context before the first trade.</div></div>
            <div className="trading-plan-card-body">
              <BiasSelect value={plan.marketBias} onChange={(value) => updatePlan({ marketBias: value })} />
              <Field label="Key levels"><textarea className="trading-plan-textarea" value={plan.keyLevels} onChange={(e) => updatePlan({ keyLevels: e.target.value })} placeholder="Asian high/low, London high/low, HTF levels…" /></Field>
              <Field label="News focus"><input className="trading-plan-input" value={plan.newsFocus} onChange={(e) => updatePlan({ newsFocus: e.target.value })} placeholder="CPI, FOMC, NFP, or no major news" /></Field>
            </div>
          </section>

          <section className="trading-plan-card">
            <div className="trading-plan-card-head"><div className="trading-plan-card-title">Risk & execution rules</div><div className="trading-plan-card-sub">Set today's hard limits and confirmation rule.</div></div>
            <div className="trading-plan-card-body">
              <div className="trading-plan-two">
                <Field label="Max daily risk"><input className="trading-plan-input" type="number" min="0" value={plan.maxRisk} onChange={(e) => updatePlan({ maxRisk: e.target.value })} /></Field>
                <Field label="Max trades"><input className="trading-plan-input" type="number" min="0" value={plan.maxTrades} onChange={(e) => updatePlan({ maxTrades: e.target.value })} /></Field>
              </div>
              <label className="trading-plan-confirm"><input type="checkbox" checked={Boolean(plan.rulesConfirmed)} onChange={(e) => updatePlan({ rulesConfirmed: e.target.checked })} /> I confirmed my setup, session and risk rules before trading.</label>
            </div>
          </section>
        </div>

        <section className="trading-plan-card trading-plan-setup-focus-card">
          <div className="trading-plan-card-head"><div><div className="trading-plan-card-title">Setup focus</div><div className="trading-plan-card-sub">Confirm the same setup conditions you use in Log Trade before committing to today's plan.</div></div><span className="trading-plan-setup-score-pill">{checkedSetupCount} / {SETUP_CHECKS_DEFAULT.length} confirmed</span></div>
          <div className="trading-plan-setup-focus-layout">
            <div className="trading-plan-setup-checklist">
              {SETUP_CHECKS_DEFAULT.map((item) => {
                const selected = Boolean(setupChecklist[item.key]);
                return <button key={item.key} type="button" className={`trading-plan-check ${selected ? "is-checked" : ""}`} onClick={() => updatePlan({ setupChecklist: { ...setupChecklist, [item.key]: !selected } })}>
                  <span className="trading-plan-check-box">{selected ? "✓" : ""}</span><span>{item.label}</span><span className="trading-plan-check-info">i</span>
                </button>;
              })}
            </div>
            <div className="trading-plan-setup-side">
              <div className="trading-plan-setup-quality"><div><strong>Setup Quality</strong><b>{checkedSetupCount} / {SETUP_CHECKS_DEFAULT.length}</b></div><div className="trading-plan-quality-bars">{SETUP_CHECKS_DEFAULT.map((item) => <span key={item.key} className={setupChecklist[item.key] ? "is-filled" : ""} />)}</div></div>
              <Field label="Setup focus"><input className="trading-plan-input" value={plan.setupFocus} onChange={(e) => updatePlan({ setupFocus: e.target.value })} placeholder="e.g. NY liquidity sweep + FVG" /></Field>
              <label className="trading-plan-side-notes"><span>Notes <em>(Optional)</em></span><textarea maxLength={300} value={plan.notes} onChange={(e) => updatePlan({ notes: e.target.value })} placeholder="Add notes about today's setup, market context, invalidation or execution reasoning…" /><small>{noteLength}/300</small></label>
              <div className="trading-plan-setup-grade"><div className="trading-plan-setup-grade-head"><strong>Setup Grade</strong><span title="Grade is informational only and never blocks the Trading Plan workflow.">i</span></div><div className="trading-plan-grade-circle" style={{ "--grade-color": setupRating.color }}><strong>{setupRating.grade}</strong></div><b>{setupRating.label}</b><p>Checklist grade is for review only. You can continue and save the Trading Plan with any grade, including B, C or D.</p><small className="trading-plan-grade-note">No Trading Plan step is blocked by setup grade.</small></div>
            </div>
          </div>
        </section>

        <section className="trading-plan-note-card">
          <div className="trading-plan-note-body">
            <div className="trading-plan-note-footer"><span className="trading-plan-char">Plan changes are saved when you click Save Plan. {savedAt ? `Last saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not saved yet"}</span><span className="trading-plan-saved">{saving ? "Saving to Supabase…" : storageError ? "Storage needs attention" : savedAt ? "Saved to Supabase" : "Ready to save"}</span></div>
            {storageError && <div className="trading-plan-error">{storageError}</div>}
            <div className="trading-plan-footer-actions"><button type="button" className="trading-plan-btn" onClick={handleClear}>Clear plan</button><button type="button" className="trading-plan-btn primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Plan"}</button></div>
          </div>
        </section>

        {todayStats.count > 0 && <section className="trading-plan-linked-card"><div><div className="trading-plan-card-title">Trade Log connection</div><div className="trading-plan-card-sub">New trades logged today are automatically linked to today's saved plan.</div></div><span className="trading-plan-linked-pill"><Check size={12} /> {todayStats.count} trade{todayStats.count === 1 ? "" : "s"} linked</span></section>}
      </>}

      {section === "history" && <section className="trading-plan-history-section">
        <div className="trading-plan-section-head"><div><div className="trading-plan-card-title">Trading plan history</div><div className="trading-plan-card-sub">Review today's plan and previous sessions without overwriting the original record.</div></div><button className="trading-plan-btn" onClick={refreshHistory} disabled={historyLoading}>{historyLoading ? "Refreshing…" : "Refresh"}</button></div>
        {historyError && <div className="trading-plan-error">{historyError}</div>}
        {history.length === 0 && !historyLoading ? <div className="trading-plan-empty"><History size={18} /><strong>No saved plans yet</strong><span>Save today's plan to start building your daily history.</span></div> : <div className="trading-plan-history-list">
          {history.map((item) => {
            const stats = tradesByDate.get(item.date) || { count: 0, pnl: 0 };
            return <article key={item.date} className={`trading-plan-history-row ${selectedHistory?.date === item.date ? "selected" : ""}`} onClick={() => setSelectedHistory(item)}>
              <div className="trading-plan-history-date"><strong>{formatDate(item.date)}</strong><small>{item.date === today ? "Today" : "Saved session"}</small></div>
              <span className={`trading-plan-history-bias ${biasClass(item.marketBias)}`}>{item.marketBias || "No bias"}</span>
              <div className="trading-plan-history-meta"><span>{stats.count} trade{stats.count === 1 ? "" : "s"}</span><strong className={stats.pnl >= 0 ? "positive" : "negative"}>{money(stats.pnl)}</strong></div>
              <button className="trading-plan-icon-btn" onClick={(event) => { event.stopPropagation(); setSelectedHistory(item); }} title="View plan"><Eye size={14} /></button>
            </article>;
          })}
        </div>}
        {selectedHistory && <PlanReadOnly plan={selectedHistory} tradeCount={(tradesByDate.get(selectedHistory.date) || { count: 0 }).count} pnl={(tradesByDate.get(selectedHistory.date) || { pnl: 0 }).pnl} onClose={() => setSelectedHistory(null)} />}
      </section>}

      {section === "calendar" && <section className="trading-plan-calendar-section">
        <div className="trading-plan-section-head"><div><div className="trading-plan-card-title">Plan calendar</div><div className="trading-plan-card-sub">See which sessions were planned and how the journal performed.</div></div><div className="trading-plan-calendar-nav"><button className="trading-plan-icon-btn" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft size={14} /></button><strong>{monthLabel}</strong><button className="trading-plan-icon-btn" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight size={14} /></button></div></div>
        <div className="trading-plan-calendar-grid">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <span key={day} className="trading-plan-calendar-weekday">{day}</span>)}
          {calendarCells.map((cell) => <button key={cell.key} className={`trading-plan-calendar-day ${cell.inMonth ? "" : "muted"} ${cell.savedPlan ? "has-plan" : ""} ${cell.key === today ? "today" : ""}`} onClick={() => { if (cell.savedPlan) { setSelectedHistory(cell.savedPlan); setSection("history"); } }}>
            <strong>{cell.day}</strong>
            {cell.savedPlan && <i title="Plan saved" />}
            {cell.stats.count > 0 && <small className={cell.stats.pnl >= 0 ? "positive" : "negative"}>{money(cell.stats.pnl)}</small>}
          </button>)}
        </div>
      </section>}
    </section>
  );
}

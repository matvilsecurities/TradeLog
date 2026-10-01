import React from "react";
import "../../styles/tradeLog.css";
import { fetchTradingPlanByDateDb } from "../../supabase.js";
import {
  getPnl,
  calculateCurrentEquity,
  formatMoney as money,
  formatDate,
  getTradeNotes as notes,
  getTradeGrade as gradeOf,
  formatHoldTime as hold,
} from "./tradeUtils.js";

const planGrade = (checklist, checks = []) => {
  const total = Math.max(0, checks.length);
  const checked = checks.reduce((count, item) => count + (checklist?.[item.key] ? 1 : 0), 0);
  const ratio = total ? checked / total : 0;
  const grade = checked >= 10 ? "A+" : checked >= 8 ? "A" : checked >= 6 ? "B" : checked >= 4 ? "C" : "D";
  return { checked, total, grade, ratio };
};

const gradeTone = (grade) => {
  const value = String(grade || "").toUpperCase();
  if (value === "A" || value === "A+") return "a";
  if (value === "B") return "b";
  if (value === "C") return "c";
  if (value === "D") return "d";
  return "empty";
};

function CumulativeChart({ trades }) {
  const ordered = [...trades].sort((a, b) =>
    `${a?.date || ""}${a?.time || ""}`.localeCompare(`${b?.date || ""}${b?.time || ""}`)
  );
  let cumulative = 0;
  const values = ordered.map((t) => (cumulative += getPnl(t)));
  if (!values.length) return <div className="tl-chart-empty">No trading data</div>;

  const W = 500, H = 76, pad = 6;
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const range = max - min || 1;
  const x = (i) => values.length === 1 ? W / 2 : pad + i * (W - pad * 2) / (values.length - 1);
  const y = (v) => pad + (max - v) * (H - pad * 2) / range;
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${pad},${H - pad} ${points} ${W - pad},${H - pad}`;

  return (
    <svg className="tl-cumulative-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="tlPnlFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7b6ff0" stopOpacity=".30" />
          <stop offset="100%" stopColor="#7b6ff0" stopOpacity=".03" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#tlPnlFill)" />
      <polyline points={points} className="tl-cumulative-line" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="2.7" className="tl-cumulative-dot" />
    </svg>
  );
}

function ProfitFactorGauge({ value }) {
  const numeric = Number(value);
  const ratio = Number.isFinite(numeric) ? Math.max(0, Math.min(numeric / 3, 1)) : 0;
  const r = 28;
  const c = Math.PI * r;
  const green = c * ratio;
  return (
    <svg className="tl-pf-gauge" viewBox="0 0 70 42">
      <path d="M 7 35 A 28 28 0 0 1 63 35" className="tl-gauge-track" />
      <path d="M 7 35 A 28 28 0 0 1 63 35" className="tl-gauge-red"
        strokeDasharray={`${c - green} ${c}`} strokeDashoffset={-green} />
      <path d="M 7 35 A 28 28 0 0 1 63 35" className="tl-gauge-green"
        strokeDasharray={`${green} ${c}`} />
    </svg>
  );
}

function WinGauge({ wins, losses }) {
  const total = Math.max(1, wins + losses);
  const win = wins / total;
  const r = 23, c = 2 * Math.PI * r;
  return (
    <svg className="tl-win-gauge" viewBox="0 0 58 58">
      <circle cx="29" cy="29" r={r} className="tl-donut-track" />
      <circle cx="29" cy="29" r={r} className="tl-donut-red"
        strokeDasharray={`${c * (1 - win)} ${c}`} strokeDashoffset={-c * win} />
      <circle cx="29" cy="29" r={r} className="tl-donut-green"
        strokeDasharray={`${c * win} ${c}`} />
    </svg>
  );
}

function TradeLog({
  trades = [],
  onEdit,
  onDelete,
  onAdd,
  onViewChart,
  theme,
  toggleTheme,
  accounts = [],
  onOpenProfile,
  onSignOut,
  onBack,
  backLabel = "Back to Account Center",
  initialAccountId = "all",
  initialMonthFilter = "all",
  userId,
  checklist = [],
  todayPlanMode = "unset",
  onPlanModeChange,
  onOpenTradingPlan,
}) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const [search, setSearch] = React.useState("");
  const [direction, setDirection] = React.useState("All");
  const [sort, setSort] = React.useState("date");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [accountId, setAccountId] = React.useState(initialAccountId || "all");
  const [monthFilter, setMonthFilter] = React.useState(initialMonthFilter || "all");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [monthOpen, setMonthOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const filterRef = React.useRef(null);
  const monthRef = React.useRef(null);
  const accountRef = React.useRef(null);
  const profileRef = React.useRef(null);
  const [todayPlan, setTodayPlan] = React.useState(null);
  const [todayPlanLoading, setTodayPlanLoading] = React.useState(false);
  const [todayPlanError, setTodayPlanError] = React.useState("");

  const todayIso = React.useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const todayPlanChecks = Array.isArray(checklist) ? checklist : [];
  const todayPlanGrade = React.useMemo(
    () => planGrade(todayPlan?.setup_checklist || {}, todayPlanChecks),
    [todayPlan?.setup_checklist, todayPlanChecks]
  );

  React.useEffect(() => {
    let cancelled = false;
    const loadTodayPlan = async () => {
      setTodayPlanError("");
      if (!userId) {
        setTodayPlan(null);
        return;
      }
      setTodayPlanLoading(true);
      try {
        const data = await fetchTradingPlanByDateDb(todayIso);
        if (!cancelled) setTodayPlan(data);
      } catch (error) {
        if (!cancelled) {
          setTodayPlan(null);
          setTodayPlanError(error?.message || "Unable to load today's Trading Plan.");
        }
      } finally {
        if (!cancelled) setTodayPlanLoading(false);
      }
    };
    loadTodayPlan();
    return () => { cancelled = true; };
  }, [userId, todayIso]);

  const choosePlanMode = React.useCallback((mode) => {
    onPlanModeChange?.(mode);
  }, [onPlanModeChange]);

  // Dashboard is the source of the default Ledger context. If the user changes
  // the Dashboard account, the next Ledger visit follows that selection.
  React.useEffect(() => {
    setAccountId(initialAccountId || "all");
    setMonthFilter(initialMonthFilter || "all");
  }, [initialAccountId, initialMonthFilter]);

  React.useEffect(() => {
    const closeMenus = (event) => {
      const targets = [filterRef, monthRef, accountRef, profileRef];
      if (!targets.some((ref) => ref.current?.contains(event.target))) {
        setFilterOpen(false);
        setMonthOpen(false);
        setAccountOpen(false);
        setProfileOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setFilterOpen(false); setMonthOpen(false); setAccountOpen(false); setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", closeMenus); document.removeEventListener("keydown", onKey); };
  }, []);

  const monthLabel = { all: "All Time", this: "This Month", last: "Last Month", three: "Last 3 Months" }[monthFilter] || "This Month";
  const accountLabel = accountId === "all" ? "All Accounts" : accounts.find((a) => a.id === accountId)?.name || "Account";
  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const threeMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const selectedAccount = accounts.find((account) => String(account.id) === String(accountId)) || null;
    const selectedAccountId = selectedAccount ? String(selectedAccount.id || "") : String(accountId || "");
    const selectedAccountUuid = selectedAccount ? String(selectedAccount.accountUuid || selectedAccount.uuid || "") : "";

    const filtered = safeTrades.filter((t) => {
      const tradeAccountId = String(t?.accountId || t?.account_id || "");
      const tradeAccountUuid = String(t?.accountUuid || t?.account_uuid || "");
      if (accountId !== "all"
        && tradeAccountId !== selectedAccountId
        && tradeAccountUuid !== selectedAccountUuid
      ) return false;
      if (direction !== "All" && t?.dir !== direction) return false;
      if (monthFilter !== "all") {
        const date = new Date(`${t?.date || ""}T00:00:00`);
        if (Number.isNaN(date.getTime())) return false;
        if (monthFilter === "this" && date < monthStart) return false;
        if (monthFilter === "last" && (date < lastMonthStart || date >= monthStart)) return false;
        if (monthFilter === "three" && date < threeMonthStart) return false;
      }
      if (!q) return true;
      return [t?.symbol, t?.setup, t?.dir, notes(t)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    return filtered.sort((a, b) => {
      if (sort === "pnl") return getPnl(b) - getPnl(a);
      if (sort === "rr") return (Number(b?.rr) || 0) - (Number(a?.rr) || 0);
      return `${b?.date || ""}${b?.time || ""}`.localeCompare(`${a?.date || ""}${a?.time || ""}`);
    });
  }, [safeTrades, search, direction, sort, accountId, monthFilter]);

  React.useEffect(() => setPage(1), [search, direction, sort, pageSize, accountId, monthFilter]);

  const netPnl = rows.reduce((sum, t) => sum + getPnl(t), 0);
  const wins = rows.filter((t) => getPnl(t) > 0).length;
  const losses = rows.filter((t) => getPnl(t) < 0).length;
  const decisive = wins + losses;
  const winRate = decisive ? wins / decisive * 100 : 0;
  const grossWin = rows.filter((t) => getPnl(t) > 0).reduce((s, t) => s + getPnl(t), 0);
  const grossLoss = Math.abs(rows.filter((t) => getPnl(t) < 0).reduce((s, t) => s + getPnl(t), 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0;
  const avgWin = wins ? grossWin / wins : 0;
  const avgLoss = losses ? grossLoss / losses : 0;

  const { accountSize: equityStart, pnl: equityPnl, currentEquity } = calculateCurrentEquity(
    accounts,
    safeTrades,
    accountId
  );
  const equityDelta = equityPnl;

  const exportRows = () => {
    if (!rows.length || typeof document === "undefined") return;
    const columns = ["date", "symbol", "dir", "session", "entry", "exit", "qty", "pnl", "rr", "grade"];
    const escapeCsv = (value) => {
      const text = value == null ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [columns.join(","), ...rows.map((trade) => columns.map((key) => escapeCsv(trade?.[key] ?? trade?.[`trade_${key}`] ?? "")).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tradelog-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={`trade-log-page ${theme === "dark" ? "trade-log-dark" : "trade-log-light"}`} data-theme={theme}>
      <header className="trade-log-topbar">
        <div className="trade-log-title">
          {onBack && <button type="button" className="trade-log-back" onClick={onBack}>← {backLabel}</button>}
          <h1>Trade Log</h1>
        </div>
        <div className="trade-log-top-controls">
          <div className="trade-log-control-wrap" ref={accountRef}>
            <button type="button" className="trade-log-account-select" aria-expanded={accountOpen}
              onClick={() => { setAccountOpen(v => !v); setFilterOpen(false); setMonthOpen(false); setProfileOpen(false); }}>
              <span className="trade-log-account-icon" aria-hidden="true">▦</span>
              <span className="trade-log-account-copy"><small>ACCOUNT</small><strong>{accountLabel}</strong></span>
              <span className="trade-log-account-chevron">⌄</span>
            </button>
            {accountOpen && (
              <div className="trade-log-popover trade-log-account-popover">
                <div className="trade-log-popover-title">Account</div>
                <button type="button" className={accountId === "all" ? "selected" : ""} onClick={() => { setAccountId("all"); setAccountOpen(false); }}><span>All Accounts</span><span>{accountId === "all" ? '✓' : ''}</span></button>
                {accounts.map((account) => (
                  <button key={account.id} type="button" className={accountId === account.id ? "selected" : ""} onClick={() => { setAccountId(account.id); setAccountOpen(false); }}><span>{account.name}</span><span>{accountId === account.id ? '✓' : ''}</span></button>
                ))}
                {!accounts.length && <div className="trade-log-popover-empty">No accounts configured</div>}
              </div>
            )}
          </div>

          <div className="trade-log-control-wrap" ref={monthRef}>
            <button type="button" aria-expanded={monthOpen}
              onClick={() => { setMonthOpen(v => !v); setFilterOpen(false); setAccountOpen(false); setProfileOpen(false); }}>▣ <span>{monthLabel}</span><b>⌄</b></button>
            {monthOpen && (
              <div className="trade-log-popover">
                <div className="trade-log-popover-title">Date range</div>
                {[['this','This Month'],['last','Last Month'],['three','Last 3 Months'],['all','All Time']].map(([value,label]) => (
                  <button key={value} type="button" className={monthFilter === value ? "selected" : ""} onClick={() => { setMonthFilter(value); setMonthOpen(false); }}><span>{label}</span><span>{monthFilter === value ? '✓' : ''}</span></button>
                ))}
              </div>
            )}
          </div>

          <div className="trade-log-control-wrap" ref={filterRef}>
            <button type="button" aria-expanded={filterOpen}
              onClick={() => { setFilterOpen(v => !v); setMonthOpen(false); setAccountOpen(false); setProfileOpen(false); }}>⚑ <span>Filters</span><b>⌄</b></button>
            {filterOpen && (
              <div className="trade-log-popover trade-log-filter-popover">
                <div className="trade-log-popover-title">Filter trades</div>
                <button type="button" className={direction === "All" ? "selected" : ""} onClick={() => { setDirection("All"); setFilterOpen(false); }}>All directions <span>✓</span></button>
                <button type="button" className={direction === "Long" ? "selected" : ""} onClick={() => { setDirection("Long"); setFilterOpen(false); }}>Long only <span>✓</span></button>
                <button type="button" className={direction === "Short" ? "selected" : ""} onClick={() => { setDirection("Short"); setFilterOpen(false); }}>Short only <span>✓</span></button>
                <div className="trade-log-popover-divider" />
                <button type="button" onClick={() => { setSort("date"); setFilterOpen(false); }}>Newest first</button>
                <button type="button" onClick={() => { setSort("pnl"); setFilterOpen(false); }}>Highest P&amp;L</button>
                <button type="button" onClick={() => { setSort("rr"); setFilterOpen(false); }}>Highest R:R</button>
              </div>
            )}
          </div>

          <button type="button" className="trade-log-theme-toggle" onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}>
            <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
          </button>

          <button type="button" className="trade-log-export" onClick={exportRows} title="Export the current journal view as CSV">⇧ <span>Export</span></button>

          <div className="trade-log-control-wrap" ref={profileRef}>
            <button type="button" className="trade-log-profile-button" onClick={() => { setProfileOpen(v => !v); setFilterOpen(false); setMonthOpen(false); setAccountOpen(false); }} aria-label="Open profile menu">
              <span className="trade-log-profile">P<i /></span><span className="trade-log-profile-arrow">⌄</span>
            </button>
            {profileOpen && (
              <div className="trade-log-popover trade-log-profile-popover">
                <div className="trade-log-profile-mini">
                  <div className="trade-log-profile-mini-avatar">P</div>
                  <div><strong>TradeLog Profile</strong><small>Account preferences</small></div>
                </div>
                <div className="trade-log-popover-divider" />
                <button type="button" onClick={() => { setProfileOpen(false); onOpenProfile?.(); }}>My Profile <span>→</span></button>
                <button type="button" onClick={() => { toggleTheme?.(); setProfileOpen(false); }}>Appearance <span>{theme === "light" ? "Light" : "Dark"}</span></button>
                <button type="button" className="danger" onClick={() => { setProfileOpen(false); onSignOut?.(); }}>Sign out <span>→</span></button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="trade-log-workspace">
        <section className="trade-log-plan-gate" aria-label="Today's Trading Plan">
          <div className="trade-log-plan-gate-head">
            <div>
              <span className="trade-log-plan-eyebrow">TODAY'S TRADING PLAN</span>
              <h2>How do you want to record today's trades?</h2>
              <p>Use the exact checklist you prepared today, or intentionally journal this session without a Trading Plan.</p>
            </div>
            <div className={`trade-log-plan-mode-pill ${todayPlanMode === "with-plan" && todayPlan ? "linked" : todayPlanMode === "without-plan" ? "free" : "pending"}`}>
              <i />
              {todayPlanMode === "with-plan" && todayPlan ? "Plan linked" : todayPlanMode === "without-plan" ? "No plan" : "Choose recording mode"}
            </div>
          </div>

          {todayPlanLoading ? <div className="trade-log-plan-loading">Loading today's saved plan…</div> : todayPlan ? <div className="trade-log-plan-gate-body">
            <div className="trade-log-plan-summary">
              <div className="trade-log-plan-summary-top">
                <div><span>Market bias</span><strong>{todayPlan.market_bias || "No bias set"}</strong></div>
                <div><span>Setup focus</span><strong>{todayPlan.setup_focus || "Not specified"}</strong></div>
                <div><span>Max risk</span><strong>{money(todayPlan.max_risk)}</strong></div>
                <div><span>Max trades</span><strong>{todayPlan.max_trades || 0}</strong></div>
              </div>
              <div className="trade-log-plan-checklist-head"><div><strong>Today's setup checklist</strong><span>{todayPlanGrade.checked}/{todayPlanGrade.total} confirmed</span></div><b className={`tl-grade ${gradeTone(todayPlanGrade.grade)}`}>{todayPlanGrade.grade}</b></div>
              <div className="trade-log-plan-checklist">
                {todayPlanChecks.map((item) => {
                  const checked = Boolean(todayPlan.setup_checklist?.[item.key]);
                  return <div key={item.key} className={`trade-log-plan-check-item ${checked ? "checked" : ""}`}><span>{checked ? "✓" : ""}</span><strong>{item.label}</strong></div>;
                })}
              </div>
              {todayPlan.notes && <div className="trade-log-plan-notes"><span>Plan notes</span><p>{todayPlan.notes}</p></div>}
            </div>

            <aside className="trade-log-plan-choice">
              <div className="trade-log-plan-choice-icon">✓</div>
              <strong>{todayPlanMode === "with-plan" ? "Today's plan is active" : todayPlanMode === "without-plan" ? "Journaling without the plan" : "Choose how to record"}</strong>
              <p>{todayPlanMode === "with-plan" ? "New trades dated today will keep this plan and checklist snapshot." : todayPlanMode === "without-plan" ? "New trades dated today will not receive a Trading Plan link." : "Your choice controls whether new trades today receive this plan snapshot."}</p>
              <div className="trade-log-plan-choice-actions">
                <button type="button" className={`trade-log-plan-choice-btn primary ${todayPlanMode === "with-plan" ? "selected" : ""}`} onClick={() => choosePlanMode("with-plan")}>Record with today's plan</button>
                <button type="button" className={`trade-log-plan-choice-btn ${todayPlanMode === "without-plan" ? "selected" : ""}`} onClick={() => choosePlanMode("without-plan")}>Go without trading plan</button>
                <button type="button" className="trade-log-plan-link" onClick={onOpenTradingPlan}>Edit today's plan →</button>
              </div>
            </aside>
          </div> : <div className="trade-log-plan-empty">
            <div><strong>No Trading Plan saved for today</strong><p>Create today's plan first if you want the checklist and plan context attached to your trades.</p>{todayPlanError && <small>{todayPlanError}</small>}</div>
            <div className="trade-log-plan-empty-actions"><button type="button" className="trade-log-plan-choice-btn primary" onClick={onOpenTradingPlan}>Make today's plan</button><button type="button" className={`trade-log-plan-choice-btn ${todayPlanMode === "without-plan" ? "selected" : ""}`} onClick={() => choosePlanMode("without-plan")}>Go without trading plan</button></div>
          </div>}
        </section>

        <section className="trade-log-kpis">
          {/* KPI order is intentional and shared with the main Journal Ledger specification. */}
          <article className="trade-log-kpi trade-log-equity">
            <div className="trade-log-kpi-label">Current Equity <small>{accountId === "all" ? "ALL ACCOUNTS" : "ACCOUNT EQUITY"}</small></div>
            <strong className={equityDelta >= 0 ? "tl-green-text" : "tl-red-text"}>{money(currentEquity)}</strong>
            <div className="trade-log-equity-meta"><span>Start {money(equityStart)}</span><span className={equityDelta >= 0 ? "tl-green-text" : "tl-red-text"}>{equityDelta >= 0 ? "+" : ""}{money(equityDelta)}</span></div>
            <div className="trade-log-equity-bar" aria-hidden="true"><i style={{ width: `${equityStart > 0 ? Math.max(0, Math.min((currentEquity / equityStart) * 100, 100)) : 0}%` }} /></div>
          </article>

          <article className="trade-log-kpi">
            <div className="trade-log-kpi-label">Net P&amp;L <small>{rows.length}</small></div>
            <strong className={netPnl >= 0 ? "tl-green-text" : "tl-red-text"}>{money(netPnl)}</strong>
            <CumulativeChart trades={rows} />
          </article>

          <article className="trade-log-kpi trade-log-pf">
            <div className="trade-log-kpi-label">Profit Factor <small>ⓘ</small></div>
            <strong>{profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)}</strong>
            <ProfitFactorGauge value={profitFactor} />
          </article>

          <article className="trade-log-kpi trade-log-win">
            <div className="trade-log-kpi-label">Wins <small>{wins}</small><em>{losses} loss{losses === 1 ? "" : "es"}</em></div>
            <strong>{wins}</strong>
            <WinGauge wins={wins} losses={losses} />
          </article>

          <article className="trade-log-kpi trade-log-avglw">
            <div className="trade-log-kpi-label">Avg Win/Loss Trade <small>ⓘ</small></div>
            <strong>{avgLoss ? (avgWin / avgLoss).toFixed(2) : "—"}</strong>
            <div className="tl-avglw-bar"><i style={{ width: `${avgWin + avgLoss ? avgWin / (avgWin + avgLoss) * 100 : 50}%` }} /></div>
            <div className="tl-avglw-values"><span>{money(avgWin)}</span><span>{money(-avgLoss)}</span></div>
          </article>
        </section>

        <section className="trade-log-report">
          <div className="trade-log-report-head">
            <h2>Your Trades Report</h2>
            <div className="trade-log-tools">
              <div className="trade-log-search">⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trades..." /></div>
              <div className="trade-log-direction">
                {["All", "Long", "Short"].map((d) => (
                  <button key={d} className={direction === d ? "active" : ""} onClick={() => setDirection(d)}>{d}</button>
                ))}
              </div>
              <button className="trade-log-add" onClick={() => onAdd?.(accountId === "all" ? null : accountId)}>+ Add Trade</button>
              <button className="trade-log-more">•••</button>
            </div>
          </div>

          <div className="trade-log-table-scroll">
            <table className="trade-log-table">
              <thead>
                <tr>
                  <th>□</th>
                  <th onClick={() => setSort("date")}>Open Date</th>
                  <th>Symbol</th>
                  <th>Plan</th>
                  <th>Hold Time</th>
                  <th>Status</th>
                  <th>Initial Risk</th>
                  <th onClick={() => setSort("pnl")}>Net P&L</th>
                  <th>Grade</th>
                  <th>Zella Scale</th>
                  <th>Mistakes</th>
                  <th>•••</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((trade) => {
                  const pnl = getPnl(trade);
                  const entry = Number(trade?.entry);
                  const exit = Number(trade?.exit);
                  const risk = Number(trade?.risk);
                  const rr = Number(trade?.rr);
                  const mistakes = Array.isArray(trade?.mistakes) ? trade.mistakes.length : Number(trade?.mistakes_count) || 0;
                  const status = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BE";

                  return (
                    <tr key={trade?.id ?? `${trade?.date}-${trade?.symbol}-${trade?.time}`}>
                      <td><input type="checkbox" /></td>
                      <td>{formatDate(trade?.date)}</td>
                      <td><strong>{trade?.symbol || "—"}</strong></td>
                      <td>{trade?.tradingPlanId || trade?.trading_plan_id ? <span className="tl-plan-badge" title="Linked to the Trading Plan for this trade date">Plan</span> : <span className="tl-plan-empty">—</span>}</td>
                      <td className="tl-hold-time">{hold(trade?.time ?? trade?.entry_time ?? trade?.entryTime, trade?.exit_time ?? trade?.exitTime ?? trade?.exitTimeLocal)}</td>
                      <td><span className={`tl-status ${status.toLowerCase()}`}>{status}</span></td>
                      <td>{Number.isFinite(risk) ? money(-Math.abs(risk)) : "—"}</td>
                      <td className={pnl >= 0 ? "tl-green-text" : "tl-red-text"}><strong>{money(pnl)}</strong></td>
                      <td><span className={`tl-grade ${gradeTone(gradeOf(trade))}`}>{gradeOf(trade)}</span></td>
                      <td>
  <span
    className="tl-zella-scale"
    style={{
  "--score": `${Math.max(
    0,
    Math.min(
      100,
      Number(trade?.setup_score ?? trade?.setupScore ?? 0)
    )
  )}%`,

  "--zella-progress": `${(
  Math.max(
    1,
    Math.min(
      10,
      Number(trade?.setup_score ?? trade?.setupScore ?? 1)
    )
  ) / 10
) * 100}%`,

"--zella-color": (() => {
  const score = Math.max(
    1,
    Math.min(
      10,
      Number(trade?.setup_score ?? trade?.setupScore ?? 1)
    )
  );

  const colors = [
    "#8f1d2c",
    "#b52b3b",
    "#d94d45",
    "#e5793f",
    "#e5b84a",
    "#b8c84f",
    "#7fc45b",
    "#55b99e",
    "#42ad8a",
    "#26966f",
  ];

  return colors[score - 1];
})(),
}}
    title={`Trade Score: ${
      Number.isFinite(Number(trade?.setup_score))
        ? Number(trade.setup_score).toFixed(0)
        : "—"
    }/100`}
  >
    <i>
      {Number.isFinite(Number(trade?.setup_score))
        ? Math.round(Number(trade.setup_score))
        : "—"}
    </i>
  </span>
</td>
                      <td>{mistakes ? (
  <span className="tl-mistake">{mistakes}</span>
) : (
  <span className="tl-no-mistake">✓</span>
)}</td>
                      <td>
                        <div className="tl-row-actions">
                          {onViewChart && <button onClick={() => onViewChart(trade)} title="View chart">↗</button>}
                          {onEdit && <button onClick={() => onEdit(trade)} title="Edit">⋮</button>}
                          {onDelete && <button onClick={() => onDelete(trade?.id)} title="Delete">×</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!visible.length && <tr><td colSpan="12" className="tl-empty">No trades found</td></tr>}
              </tbody>
            </table>
          </div>

          <footer className="trade-log-footer">
            <span>Trades per page: <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></span>
            <span>{rows.length ? `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, rows.length)}` : "0"} of {rows.length} trades</span>
            <div className="trade-log-page-controls">
              <button disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
              <b>{currentPage}</b>
              <span>of {pages} pages</span>
              <button disabled={currentPage === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>›</button>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default React.memo(TradeLog);

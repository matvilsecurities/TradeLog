import { useEffect, useMemo, useRef, useState } from "react";
import {
  DollarSign,
  Filter,
  ChevronDown,
  CalendarRange,
  Wallet,
  Bell,
  ExternalLink,
  List,
  LayoutGrid,
  Plus,
  Lock,
  Users,
  MoreHorizontal,
  GitCompareArrows,
  TrendingUp,
  BarChart3,
  Check,
  X,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import "../../styles/TradeJournalDashboard.css";
import "../../styles/playbook.css";
import { SETUP_CHECKS_DEFAULT } from "../../setupChecklist.js";

function slugify(value) {
  return String(value || "no-setup")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "no-setup";
}

function isMeaningfulSetup(value) {
  if (value == null || value === "") return false;
  if (typeof value === "number") return false;
  const text = String(value).trim();
  if (!text || text === "—" || text === "-" || /^\d+(\.\d+)?$/.test(text)) return false;
  return true;
}

function getPlaybookName(trade) {
  const explicit = [
    trade?.playbook,
    trade?.playbookName,
    trade?.playbook_name,
    trade?.setupName,
    trade?.setup_name,
  ].find(isMeaningfulSetup);
  if (explicit) return String(explicit).trim();
  if (isMeaningfulSetup(trade?.setup)) return String(trade.setup).trim();

  const checklist = trade?.setup_checklist;
  if (checklist && typeof checklist === "object") {
    const labels = Object.entries(checklist)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => SETUP_CHECKS_DEFAULT.find((item) => item.key === key)?.label || key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()));
    if (labels.length) return labels.slice(0, 2).join(" · ");
  }
  return "No Setup";
}

function emojiForPlaybook(name) {
  if (name === "No Setup") return "×";
  const icons = ["↗", "↻", "⚡", "□", "◎", "↯", "▰", "◇"];
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return icons[hash % icons.length];
}

function tradePnl(trade) {
  return Number(trade?.pnl ?? trade?.profit_loss ?? 0);
}

function tradeR(trade) {
  const value = trade?.rMultiple ?? trade?.r_multiple ?? trade?.rr ?? trade?.riskReward ?? trade?.risk_reward;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function tradeTimestamp(trade) {
  return trade?.entryTime || trade?.entry_time || trade?.date || trade?.created_at || trade?.timestamp || null;
}

function formatTradeDate(value) {
  if (!value) return "Undated";
  const raw = String(value).trim();
  if (!raw) return "Undated";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(raw.replace(/\//g, "-"));
    if (Number.isNaN(fallback.getTime())) return "Undated";
    return fallback.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildPlaybooks(trades) {
  const groups = new Map();
  (Array.isArray(trades) ? trades : []).forEach((trade) => {
    const name = getPlaybookName(trade);
    const key = name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name, trades: [] });
    groups.get(key).trades.push(trade);
  });

  return Array.from(groups.values()).map(({ name, trades: groupTrades }) => {
    const pnlValues = groupTrades.map(tradePnl).filter(Number.isFinite);
    const winners = pnlValues.filter((pnl) => pnl > 0);
    const losers = pnlValues.filter((pnl) => pnl < 0);
    const netPnl = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
    const grossWin = winners.reduce((sum, pnl) => sum + pnl, 0);
    const grossLoss = Math.abs(losers.reduce((sum, pnl) => sum + pnl, 0));
    const avgWinner = winners.length ? grossWin / winners.length : 0;
    const avgLoser = losers.length ? grossLoss / losers.length : 0;
    const winRate = groupTrades.length ? (winners.length / groupTrades.length) * 100 : 0;
    const rValues = groupTrades.map(tradeR).filter(Number.isFinite);
    const avgR = rValues.length ? rValues.reduce((sum, value) => sum + value, 0) / rValues.length : null;
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let lossStreak = 0;
    let maxLossStreak = 0;
    [...groupTrades].sort((a, b) => new Date(tradeTimestamp(a) || 0) - new Date(tradeTimestamp(b) || 0)).forEach((trade) => {
      const pnl = tradePnl(trade);
      equity += Number.isFinite(pnl) ? pnl : 0;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      if (pnl < 0) { lossStreak += 1; maxLossStreak = Math.max(maxLossStreak, lossStreak); }
      else if (pnl > 0) lossStreak = 0;
    });

    return {
      id: slugify(name),
      emoji: emojiForPlaybook(name),
      name,
      trades: groupTrades.length,
      tradeRows: groupTrades,
      visibility: "private",
      winRate,
      netPnl,
      description: `Derived from ${groupTrades.length} journaled trade${groupTrades.length === 1 ? "" : "s"}.`,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
      missedTrades: 0,
      expectancy: groupTrades.length ? netPnl / groupTrades.length : 0,
      avgWinner,
      avgLoser,
      wins: winners.length,
      losses: losers.length,
      avgR,
      maxDrawdown,
      maxLossStreak,
    };
  });
}

const SORTS = {
  "Name A-Z": (a, b) => a.name.localeCompare(b.name),
  "Name Z-A": (a, b) => b.name.localeCompare(a.name),
  "Win rate": (a, b) => b.winRate - a.winRate,
  "Net P&L": (a, b) => b.netPnl - a.netPnl,
};

function currency(value) {
  const numeric = Number(value) || 0;
  const sign = numeric < 0 ? "-" : "";
  return `${sign}$${Math.abs(numeric).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortCurrency(value) {
  const numeric = Number(value) || 0;
  const sign = numeric < 0 ? "-" : "";
  return `${sign}$${Math.abs(numeric).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function accountStatus(account) {
  const settings = account?.settings || {};
  const status = String(settings.accountStatus || account?.status || "active").trim().toLowerCase();
  const stage = String(settings.accountStage || "evaluation").trim().toLowerCase();
  const evaluationStatus = String(settings.evaluationStatus || "").trim().toLowerCase();
  if (["blown", "failed", "closed", "inactive", "disabled"].some((value) => status.includes(value))) return "blown";
  if (stage !== "funded" && ["passed", "cleared", "complete", "completed"].some((value) => evaluationStatus.includes(value))) return "passed";
  return "active";
}

function WinRateRing({ value }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, value)) / 100 * c;
  return (
    <svg className="pb-ring" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
      <circle cx="22" cy="22" r={r} className="pb-ring-track" fill="none" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} className="pb-ring-value" fill="none" strokeWidth="4" strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round" transform="rotate(-90 22 22)" />
    </svg>
  );
}

function PlaybookCard({ playbook, openMenuId, setOpenMenuId, onCompare, onViewTrades }) {
  const positive = playbook.netPnl >= 0;
  return (
    <article className="pb-card td-card">
      <div className="pb-card-head">
        <span className="pb-card-icon" aria-hidden="true">{playbook.emoji}</span>
        <div className="pb-card-title-wrap"><h3>{playbook.name}</h3><span>{playbook.trades} journaled {playbook.trades === 1 ? "trade" : "trades"}</span></div>
        <div className="pb-card-menu-wrap">
          <button type="button" className="pb-card-menu" aria-label={`More options for ${playbook.name}`} aria-expanded={openMenuId === playbook.id} onClick={() => setOpenMenuId(openMenuId === playbook.id ? null : playbook.id)}><MoreHorizontal size={15} strokeWidth={2} /></button>
          {openMenuId === playbook.id && <div className="pb-card-menu-popover" role="menu">
            <button type="button" onClick={() => { onCompare?.(playbook.id); setOpenMenuId(null); }}><GitCompareArrows size={12} /> Compare strategy</button>
            <button type="button" onClick={() => { onViewTrades?.(playbook); setOpenMenuId(null); }}><TrendingUp size={12} /> View journaled trades</button>
          </div>}
        </div>
      </div>
      <div className="pb-card-body">
        <div className="pb-primary-stat"><WinRateRing value={playbook.winRate} /><div><span>Win rate</span><strong>{playbook.winRate.toFixed(0)}%</strong></div></div>
        <div className="pb-primary-stat pb-pnl-stat"><span>Net P&amp;L</span><strong className={positive ? "is-positive" : "is-negative"}>{currency(playbook.netPnl)}</strong></div>
      </div>
      <div className="pb-card-footer">
        <div><span>Profit factor</span><strong>{Number.isFinite(playbook.profitFactor) ? playbook.profitFactor.toFixed(2) : "∞"}</strong></div>
        <div><span>Expectancy</span><strong className={playbook.expectancy >= 0 ? "is-positive" : "is-negative"}>{currency(playbook.expectancy)}</strong></div>
        <div className="pb-card-visibility">{playbook.visibility === "shared" ? <><Users size={11} /> Shared</> : <><Lock size={11} /> Private</>}</div>
      </div>
    </article>
  );
}

function PlaybookRow({ playbook, openMenuId, setOpenMenuId, onCompare, onViewTrades }) {
  const positive = playbook.netPnl >= 0;
  return (
    <div className="pb-row">
      <span className="pb-row-icon" aria-hidden="true">{playbook.emoji}</span>
      <span className="pb-row-name">{playbook.name}</span>
      <span className="pb-row-trades">{playbook.trades} trades</span>
      <span className="pb-row-visibility">{playbook.visibility === "shared" ? <><Users size={11} /> Shared</> : <><Lock size={11} /> Private</>}</span>
      <span className="pb-row-winrate">{playbook.winRate.toFixed(0)}%</span>
      <span className={`pb-row-pnl ${positive ? "is-positive" : "is-negative"}`}>{currency(playbook.netPnl)}</span>
      <div className="pb-card-menu-wrap">
        <button type="button" className="pb-card-menu" aria-label={`More options for ${playbook.name}`} aria-expanded={openMenuId === playbook.id} onClick={() => setOpenMenuId(openMenuId === playbook.id ? null : playbook.id)}><MoreHorizontal size={15} /></button>
        {openMenuId === playbook.id && <div className="pb-card-menu-popover" role="menu">
          <button type="button" onClick={() => { onCompare?.(playbook.id); setOpenMenuId(null); }}><GitCompareArrows size={12} /> Compare strategy</button>
          <button type="button" onClick={() => { onViewTrades?.(playbook); setOpenMenuId(null); }}><TrendingUp size={12} /> View journaled trades</button>
        </div>}
      </div>
    </div>
  );
}

function buildCompareSeries(selectedPlaybooks) {
  const events = new Map();
  selectedPlaybooks.forEach((playbook) => {
    const sorted = [...playbook.tradeRows].sort((a, b) => {
      const at = new Date(tradeTimestamp(a) || 0).getTime();
      const bt = new Date(tradeTimestamp(b) || 0).getTime();
      return at - bt;
    });
    let cumulative = 0;
    sorted.forEach((trade, index) => {
      cumulative += tradePnl(trade);
      const rawDate = tradeTimestamp(trade);
      const date = rawDate ? new Date(rawDate) : null;
      const label = date && !Number.isNaN(date.getTime()) ? formatTradeDate(date).replace(/, \d{4}$/, "") : `Trade ${index + 1}`;
      const key = `${label}-${index}-${playbook.id}`;
      if (!events.has(key)) events.set(key, { label, sort: date && !Number.isNaN(date.getTime()) ? date.getTime() : index, [playbook.id]: cumulative });
    });
  });

  const allDates = [];
  selectedPlaybooks.forEach((playbook) => {
    let cumulative = 0;
    [...playbook.tradeRows].sort((a, b) => new Date(tradeTimestamp(a) || 0) - new Date(tradeTimestamp(b) || 0)).forEach((trade, index) => {
      cumulative += tradePnl(trade);
      const date = new Date(tradeTimestamp(trade) || 0);
      allDates.push({
        sort: Number.isNaN(date.getTime()) ? index : date.getTime(),
        label: Number.isNaN(date.getTime()) ? `Trade ${index + 1}` : formatTradeDate(date).replace(/, \d{4}$/, ""),
        strategyId: playbook.id,
        cumulative,
      });
    });
  });

  allDates.sort((a, b) => a.sort - b.sort);
  const lastValues = Object.fromEntries(selectedPlaybooks.map((p) => [p.id, 0]));
  const points = [];
  allDates.forEach((event, index) => {
    lastValues[event.strategyId] = event.cumulative;
    points.push({ label: event.label, index: index + 1, ...lastValues });
  });
  return points;
}

function CompareView({ playbooks, theme }) {
  const [selectedIds, setSelectedIds] = useState(() => playbooks.slice(0, 3).map((p) => p.id));

  useEffect(() => {
    const handleCompare = (event) => {
      const id = event.detail?.id;
      if (!id) return;
      setSelectedIds((current) => current.includes(id) ? current : [...current, id].slice(-4));
    };
    window.addEventListener("tradelog:playbook-compare", handleCompare);
    return () => window.removeEventListener("tradelog:playbook-compare", handleCompare);
  }, []);

  const selected = useMemo(() => selectedIds.map((id) => playbooks.find((p) => p.id === id)).filter(Boolean), [selectedIds, playbooks]);
  const chartData = useMemo(() => buildCompareSeries(selected), [selected]);

  const toggleStrategy = (id) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  };

  return (
    <div className="pb-compare">
      <div className="pb-compare-intro">
        <div><span className="pb-section-eyebrow">STRATEGY ANALYTICS</span><h2>Compare strategies</h2><p>Compare the real journal performance of your setups side-by-side.</p></div>
        <div className="pb-compare-count">{selected.length} selected <span>·</span> max 4</div>
      </div>

      <div className="pb-strategy-picker" aria-label="Select strategies to compare">
        <div className="pb-picker-label"><GitCompareArrows size={14} /> Select strategies</div>
        <div className="pb-picker-options">
          {playbooks.map((playbook) => {
            const checked = selectedIds.includes(playbook.id);
            const disabled = !checked && selectedIds.length >= 4;
            return (
              <button key={playbook.id} type="button" className={`pb-strategy-chip ${checked ? "selected" : ""}`} disabled={disabled} onClick={() => toggleStrategy(playbook.id)}>
                <span className="pb-chip-icon">{playbook.emoji}</span><span>{playbook.name}</span>{checked ? <Check size={13} /> : <span className="pb-chip-add">+</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="pb-compare-empty"><BarChart3 size={20} /><strong>Select at least one strategy</strong><span>Choose the playbooks you want to analyze together.</span></div>
      ) : (
        <>
          <div className="pb-compare-kpis">
            {selected.map((playbook) => (
              <article key={playbook.id} className="pb-compare-kpi td-card">
                <div className="pb-compare-kpi-head"><span className="pb-card-icon">{playbook.emoji}</span><div><strong>{playbook.name}</strong><small>{playbook.trades} trades</small></div><button type="button" aria-label={`Remove ${playbook.name}`} onClick={() => toggleStrategy(playbook.id)}><X size={13} /></button></div>
                <div className={`pb-compare-kpi-pnl ${playbook.netPnl >= 0 ? "is-positive" : "is-negative"}`}>{currency(playbook.netPnl)}</div>
                <div className="pb-compare-kpi-grid"><span>Win rate <strong>{playbook.winRate.toFixed(0)}%</strong></span><span>PF <strong>{Number.isFinite(playbook.profitFactor) ? playbook.profitFactor.toFixed(2) : "∞"}</strong></span><span>Avg trade <strong>{currency(playbook.expectancy)}</strong></span></div>
              </article>
            ))}
          </div>

          <section className="pb-compare-panel td-card">
            <div className="pb-compare-panel-head"><div><h3><TrendingUp size={14} /> Cumulative P&amp;L</h3><span>Trade-by-trade strategy performance</span></div><span className="pb-compare-badge">Journal data</span></div>
            <div className="pb-chart-wrap">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={270}>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#2b3037" : "#edf0f4"} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: theme === "dark" ? "#727a85" : "#8a96a8" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 9, fill: theme === "dark" ? "#727a85" : "#8a96a8" }} axisLine={false} tickLine={false} width={54} />
                    <Tooltip formatter={(value, name) => [currency(value), playbooks.find((p) => p.id === name)?.name || name]} contentStyle={{ borderRadius: 8, borderColor: theme === "dark" ? "#2b3037" : "#dfe5ed", background: theme === "dark" ? "#111417" : "#fff", fontSize: 10 }} />
                    {selected.map((playbook, index) => <Line key={playbook.id} type="monotone" dataKey={playbook.id} name={playbook.name} stroke={index === 0 ? "#6255c7" : index === 1 ? "#35c997" : index === 2 ? "#e39a4d" : "#5f86d9"} strokeWidth={2} dot={false} connectNulls />)}
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="pb-chart-empty">No dated trade history is available for the selected strategies.</div>}
            </div>
          </section>

          <section className="pb-compare-panel td-card">
            <div className="pb-compare-panel-head"><div><h3><BarChart3 size={14} /> Strategy comparison</h3><span>Core performance metrics</span></div></div>
            <div className="pb-compare-table-wrap">
              <table className="pb-compare-table"><thead><tr><th>Metric</th>{selected.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead><tbody>
                <tr><td>Journaled trades</td>{selected.map((p) => <td key={p.id}>{p.trades}</td>)}</tr>
                <tr><td>Win rate</td>{selected.map((p) => <td key={p.id}>{p.winRate.toFixed(1)}%</td>)}</tr>
                <tr><td>Net P&amp;L</td>{selected.map((p) => <td key={p.id} className={p.netPnl >= 0 ? "is-positive" : "is-negative"}>{currency(p.netPnl)}</td>)}</tr>
                <tr><td>Profit factor</td>{selected.map((p) => <td key={p.id}>{Number.isFinite(p.profitFactor) ? p.profitFactor.toFixed(2) : "∞"}</td>)}</tr>
                <tr><td>Expectancy / trade</td>{selected.map((p) => <td key={p.id} className={p.expectancy >= 0 ? "is-positive" : "is-negative"}>{currency(p.expectancy)}</td>)}</tr>
                <tr><td>Wins / losses</td>{selected.map((p) => <td key={p.id}>{p.wins} / {p.losses}</td>)}</tr>
                <tr><td>Average winner</td>{selected.map((p) => <td key={p.id}>{currency(p.avgWinner)}</td>)}</tr>
                <tr><td>Average loser</td>{selected.map((p) => <td key={p.id}>{currency(p.avgLoser ? -p.avgLoser : 0)}</td>)}</tr>
                <tr><td>Average R</td>{selected.map((p) => <td key={p.id}>{p.avgR === null ? "—" : `${p.avgR.toFixed(2)}R`}</td>)}</tr>
                <tr><td>Max drawdown</td>{selected.map((p) => <td key={p.id} className={p.maxDrawdown > 0 ? "is-negative" : ""}>{currency(-p.maxDrawdown)}</td>)}</tr>
                <tr><td>Max loss streak</td>{selected.map((p) => <td key={p.id}>{p.maxLossStreak}</td>)}</tr>
              </tbody></table>
            </div>
          </section>

          <section className="pb-compare-panel td-card">
            <div className="pb-compare-panel-head"><div><h3>Trade sample</h3><span>Latest journaled trades from selected strategies</span></div></div>
            <div className="pb-trade-sample">
              {selected.flatMap((playbook) => playbook.tradeRows.map((trade, index) => ({ playbook, trade, index }))).sort((a, b) => new Date(tradeTimestamp(b.trade) || 0) - new Date(tradeTimestamp(a.trade) || 0)).slice(0, 12).map(({ playbook, trade, index }) => {
                const pnl = tradePnl(trade);
                const date = tradeTimestamp(trade);
                return <div className="pb-trade-sample-row" key={`${playbook.id}-${trade?.id || index}`}><span className="pb-trade-dot" style={{ background: playbook.id === selected[0]?.id ? "#6255c7" : playbook.id === selected[1]?.id ? "#35c997" : playbook.id === selected[2]?.id ? "#e39a4d" : "#5f86d9" }} /><strong>{playbook.name}</strong><span>{formatTradeDate(date)}</span><span className={pnl >= 0 ? "is-positive" : "is-negative"}>{currency(pnl)}</span></div>;
              })}
              {selected.every((p) => p.tradeRows.length === 0) && <div className="pb-chart-empty">No trades available for the selected strategies.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function Playbook({ trades = [], accounts = [], activeAccount = null, theme = "light", onNavigate = null, onAdd = null }) {
  const [tab, setTab] = useState("mine");
  const [layout, setLayout] = useState("grid");
  const [sort, setSort] = useState("Name A-Z");
  const [sortOpen, setSortOpen] = useState(false);
  const [accountScope, setAccountScope] = useState("active");
  const [accountOpen, setAccountOpen] = useState(false);
  const [mode, setMode] = useState("overview");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [openCardMenuId, setOpenCardMenuId] = useState(null);
  const headerMenuRef = useRef(null);

  useEffect(() => {
    if (!filterOpen && !dateOpen && !currencyOpen && !notificationOpen && !templatesOpen && !createOpen && !openCardMenuId && !accountOpen) return undefined;
    const closeMenus = (event) => {
      if (!headerMenuRef.current?.contains(event.target) && !event.target.closest?.(".pb-modal-backdrop")) {
        setFilterOpen(false); setDateOpen(false); setCurrencyOpen(false); setNotificationOpen(false); setTemplatesOpen(false); setAccountOpen(false); setOpenCardMenuId(null);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") { setFilterOpen(false); setDateOpen(false); setCurrencyOpen(false); setNotificationOpen(false); setTemplatesOpen(false); setAccountOpen(false); setCreateOpen(false); setHelpOpen(false); setOpenCardMenuId(null); }
    };
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeMenus); document.removeEventListener("keydown", closeOnEscape); };
  }, [filterOpen, dateOpen, currencyOpen, notificationOpen, templatesOpen, createOpen, openCardMenuId, accountOpen]);

  const activeAccounts = useMemo(() => accounts.filter((account) => accountStatus(account) === "active"), [accounts]);
  const blownAccounts = useMemo(() => accounts.filter((account) => accountStatus(account) === "blown"), [accounts]);

  const accountScopedTrades = useMemo(() => {
    if (accountScope === "active") {
      const activeIds = new Set(activeAccounts.map((account) => String(account.id)));
      return (Array.isArray(trades) ? trades : []).filter((trade) => activeIds.has(String(trade?.accountId || trade?.account_id || "")));
    }
    if (accountScope === "all") return Array.isArray(trades) ? trades : [];
    return (Array.isArray(trades) ? trades : []).filter((trade) => String(trade?.accountId || trade?.account_id || "") === String(accountScope));
  }, [trades, accountScope, activeAccounts]);

  const scopedTrades = useMemo(() => {
    const now = new Date();
    const cutoff = dateRange === "7d" ? new Date(now.getTime() - 7 * 86400000)
      : dateRange === "30d" ? new Date(now.getTime() - 30 * 86400000)
      : dateRange === "90d" ? new Date(now.getTime() - 90 * 86400000)
      : dateRange === "year" ? new Date(now.getFullYear(), 0, 1)
      : null;
    return accountScopedTrades.filter((trade) => {
      if (!cutoff) return true;
      const timestamp = tradeTimestamp(trade);
      if (!timestamp) return false;
      const date = new Date(timestamp);
      return !Number.isNaN(date.getTime()) && date >= cutoff;
    });
  }, [accountScopedTrades, dateRange]);

  const playbooks = useMemo(() => {
    const generated = buildPlaybooks(scopedTrades);
    const filtered = tab === "shared" ? [] : generated.filter((playbook) => {
      if (performanceFilter === "profitable") return playbook.netPnl > 0;
      if (performanceFilter === "losing") return playbook.netPnl < 0;
      if (performanceFilter === "win50") return playbook.winRate >= 50;
      return true;
    });
    return [...filtered].sort(SORTS[sort]);
  }, [scopedTrades, tab, sort, performanceFilter]);

  const totals = useMemo(() => {
    const pnlValues = scopedTrades.map(tradePnl).filter(Number.isFinite);
    const pnl = pnlValues.reduce((sum, value) => sum + value, 0);
    const tradesCount = pnlValues.length;
    const winners = pnlValues.filter((value) => value > 0).length;
    const grossWin = pnlValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const grossLoss = Math.abs(pnlValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
    const winRate = tradesCount ? (winners / tradesCount) * 100 : 0;
    const factor = grossLoss > 0 ? grossWin / grossLoss : 0;
    const best = [...playbooks].sort((a, b) => b.netPnl - a.netPnl)[0];
    return { pnl, tradesCount, winRate, factor, best };
  }, [playbooks, scopedTrades]);

  const accountLabel = accountScope === "active"
    ? "All active accounts"
    : accountScope === "all"
      ? "All accounts"
      : accounts.find((account) => String(account.id) === String(accountScope))?.name || "Trading account";
  const filteredLabel = performanceFilter === "profitable" ? "Profitable strategies" : performanceFilter === "losing" ? "Losing strategies" : performanceFilter === "win50" ? "Win rate ≥ 50%" : "All strategies";
  const dateLabel = { all: "All dates", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", year: "This year" }[dateRange];
  const displayValue = (value) => displayCurrency === "USD" ? currency(value) : currency(value);

  const compareStrategy = (id) => { setMode("compare"); setTab("mine"); window.setTimeout(() => window.dispatchEvent(new CustomEvent("tradelog:playbook-compare", { detail: { id } })), 0); };
  const viewTrades = () => onNavigate?.("trades");

  return (
    <div className={`pb-page td-theme-${theme}`}>
      <header className="td-header pb-header">
        <div><h1>Playbook</h1><p>Strategy performance overview</p></div>
        <div className="td-header-actions pb-header-actions" ref={headerMenuRef}>
          <div className="pb-control-menu-wrap">
            <button type="button" className="pb-header-icon" aria-label="Currency display" aria-expanded={currencyOpen} onClick={() => { setCurrencyOpen((v) => !v); setFilterOpen(false); setDateOpen(false); setNotificationOpen(false); }}><DollarSign size={14} /></button>
            {currencyOpen && <div className="pb-header-popover pb-currency-popover" role="menu"><div className="pb-popover-title">Display currency</div><button type="button" className={displayCurrency === "USD" ? "selected" : ""} onClick={() => { setDisplayCurrency("USD"); setCurrencyOpen(false); }}><span>USD</span><small>US dollars</small>{displayCurrency === "USD" && <Check size={12} />}</button><div className="pb-popover-note">Trade journal P&amp;L is currently stored in USD.</div></div>}
          </div>
          <div className="pb-control-menu-wrap">
            <button type="button" className={filterOpen ? "is-open" : ""} onClick={() => { setFilterOpen((v) => !v); setDateOpen(false); setCurrencyOpen(false); setNotificationOpen(false); }}><Filter size={13} /> Filters <ChevronDown size={12} /></button>
            {filterOpen && <div className="pb-header-popover pb-filter-popover" role="menu"><div className="pb-popover-title">Filter strategies</div><button type="button" className={performanceFilter === "all" ? "selected" : ""} onClick={() => { setPerformanceFilter("all"); setFilterOpen(false); }}>All strategies {performanceFilter === "all" && <Check size={12} />}</button><button type="button" className={performanceFilter === "profitable" ? "selected" : ""} onClick={() => { setPerformanceFilter("profitable"); setFilterOpen(false); }}>Profitable only {performanceFilter === "profitable" && <Check size={12} />}</button><button type="button" className={performanceFilter === "losing" ? "selected" : ""} onClick={() => { setPerformanceFilter("losing"); setFilterOpen(false); }}>Losing only {performanceFilter === "losing" && <Check size={12} />}</button><button type="button" className={performanceFilter === "win50" ? "selected" : ""} onClick={() => { setPerformanceFilter("win50"); setFilterOpen(false); }}>Win rate ≥ 50% {performanceFilter === "win50" && <Check size={12} />}</button><div className="pb-popover-summary"><span>Showing</span><strong>{filteredLabel}</strong></div></div>}
          </div>
          <div className="pb-control-menu-wrap">
            <button type="button" className={dateOpen ? "is-open" : ""} onClick={() => { setDateOpen((v) => !v); setFilterOpen(false); setCurrencyOpen(false); setNotificationOpen(false); }}><CalendarRange size={13} /> {dateLabel} <ChevronDown size={12} /></button>
            {dateOpen && <div className="pb-header-popover pb-date-popover" role="menu"><div className="pb-popover-title">Date range</div>{[["all","All dates"],["7d","Last 7 days"],["30d","Last 30 days"],["90d","Last 90 days"],["year","This year"]].map(([value,label]) => <button key={value} type="button" className={dateRange === value ? "selected" : ""} onClick={() => { setDateRange(value); setDateOpen(false); }}>{label}{dateRange === value && <Check size={12} />}</button>)}</div>}
          </div>
          <div className="pb-account-menu-wrap"><button type="button" className={`pb-account-select ${accountOpen ? "is-open" : ""}`} onClick={() => { setAccountOpen((v) => !v); setFilterOpen(false); setDateOpen(false); setCurrencyOpen(false); setNotificationOpen(false); }} aria-haspopup="listbox" aria-expanded={accountOpen}><Wallet size={13} /><span>{accountLabel}</span><ChevronDown size={12} /></button>{accountOpen && <div className="pb-account-dropdown" role="listbox" aria-label="Select playbook account"><button type="button" className={accountScope === "active" ? "active" : ""} onClick={() => { setAccountScope("active"); setAccountOpen(false); }}><span className="pb-account-avatar">ACT</span><span><strong>All active accounts</strong><small>Current evaluations and funded accounts</small></span>{accountScope === "active" && <Check size={12} />}</button><button type="button" className={accountScope === "all" ? "active" : ""} onClick={() => { setAccountScope("all"); setAccountOpen(false); }}><span className="pb-account-avatar">ALL</span><span><strong>All accounts</strong><small>Active + historical accounts</small></span>{accountScope === "all" && <Check size={12} />}</button>{activeAccounts.length > 0 && <div className="pb-account-group-label">ACTIVE ACCOUNTS</div>}{activeAccounts.map((account) => <button key={account.id} type="button" className={String(accountScope) === String(account.id) ? "active" : ""} onClick={() => { setAccountScope(account.id); setAccountOpen(false); }}><span className="pb-account-avatar">{(account.name || "A").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "A"}</span><span><strong>{account.name || "Trading Account"}</strong><small>Active account</small></span>{String(accountScope) === String(account.id) && <Check size={12} />}</button>)}{blownAccounts.length > 0 && <div className="pb-account-group-label">BLOWN ACCOUNTS</div>}{blownAccounts.map((account) => <button key={account.id} type="button" className={String(accountScope) === String(account.id) ? "active" : ""} onClick={() => { setAccountScope(account.id); setAccountOpen(false); }}><span className="pb-account-avatar blown">{(account.name || "B").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "B"}</span><span><strong>{account.name || "Trading Account"}</strong><small>Blown / historical account</small></span>{String(accountScope) === String(account.id) && <Check size={12} />}</button>)}</div>}</div>
          <div className="pb-control-menu-wrap"><button type="button" aria-label="Notifications" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen((v) => !v); setFilterOpen(false); setDateOpen(false); setCurrencyOpen(false); }}><Bell size={14} /></button>{notificationOpen && <div className="pb-header-popover pb-notification-popover"><div className="pb-popover-title">Notifications</div><div className="pb-notification-empty"><Bell size={16} /><strong>No new playbook notifications</strong><span>Account and compliance alerts are available in Account Alerts.</span><button type="button" onClick={() => { setNotificationOpen(false); onNavigate?.("alerts"); }}>Open Account Alerts</button></div></div>}</div>
        </div>
      </header>

      <section className="td-kpis pb-kpis" aria-label="Playbook summary">
        <div className={`td-kpi ${totals.pnl >= 0 ? "green" : "loss"}`}><span>Net P&amp;L</span><strong>{currency(totals.pnl)}</strong><small>Combined strategy result</small></div>
        <div className="td-kpi"><span>Playbooks</span><strong>{playbooks.length}</strong><small>Active strategies</small></div>
        <div className="td-kpi"><span>Journaled trades</span><strong>{totals.tradesCount}</strong><small>Included in playbooks</small></div>
        <div className="td-kpi td-kpi-violet"><span>Win rate</span><strong>{totals.winRate.toFixed(0)}%</strong><small>Strategy performance</small></div>
        <div className="td-kpi td-kpi-violet"><span>Profit factor</span><strong>{totals.factor ? totals.factor.toFixed(2) : "—"}</strong><small>{totals.best ? `Best: ${totals.best.name}` : "No performance yet"}</small></div>
      </section>

      <section className="pb-toolbar">
        <div className="pb-tabs" role="tablist" aria-label="Playbook scope">
          <button type="button" className={tab === "mine" ? "active" : ""} onClick={() => { setTab("mine"); setMode("overview"); }}>My playbooks</button>
          <button type="button" className={tab === "shared" ? "active" : ""} onClick={() => { setTab("shared"); setMode("overview"); }}>Shared playbooks</button>
          <button type="button" className={mode === "compare" ? "active" : ""} onClick={() => { setMode("compare"); setTab("mine"); }}><GitCompareArrows size={12} /> Compare</button>
        </div>
        <div className="pb-toolbar-actions">
          <button type="button" className="pb-learn-more" onClick={() => setHelpOpen((v) => !v)}>Learn more <ExternalLink size={11} /></button>
          <div className="pb-view-toggle" role="group" aria-label="Playbook layout">
            <button type="button" className={layout === "list" ? "active" : ""} onClick={() => setLayout("list")} aria-label="List view"><List size={14} /></button>
            <button type="button" className={layout === "grid" ? "active" : ""} onClick={() => setLayout("grid")} aria-label="Grid view"><LayoutGrid size={14} /></button>
          </div>
          <button type="button" className="pb-secondary-btn" onClick={() => setTemplatesOpen(true)}>Templates</button>
          <button type="button" className="pb-primary-btn" onClick={() => setCreateOpen(true)}><Plus size={13} /> Create playbook</button>
        </div>
      </section>

      {mode === "compare" ? (
        <CompareView playbooks={playbooks} theme={theme} />
      ) : (
        <section className="pb-section td-card">
          <div className="td-card-head pb-section-head">
            <div><h2>Playbook performance</h2><span>{playbooks.length} strategies · {totals.tradesCount} trades · {accountLabel}</span></div>
            <div className="pb-sort-select">
              <button type="button" className="pb-sort-trigger" onClick={() => setSortOpen((v) => !v)} aria-expanded={sortOpen}>Sort by <strong>{sort}</strong> <ChevronDown size={12} /></button>
              {sortOpen && <div className="pb-sort-menu">{Object.keys(SORTS).map((label) => <button key={label} type="button" className={label === sort ? "active" : ""} onClick={() => { setSort(label); setSortOpen(false); }}>{label}</button>)}</div>}
            </div>
          </div>
          <div className="pb-section-body">
            {playbooks.length === 0 ? <div className="pb-empty"><strong>No playbooks yet</strong><span>Journal trades with a setup or playbook name to build strategy performance here.</span></div> : layout === "grid" ? <div className="pb-grid">{playbooks.map((p) => <PlaybookCard key={p.id} playbook={p} openMenuId={openCardMenuId} setOpenMenuId={setOpenCardMenuId} onCompare={compareStrategy} onViewTrades={viewTrades} />)}</div> : <div className="pb-list">{playbooks.map((p) => <PlaybookRow key={p.id} playbook={p} openMenuId={openCardMenuId} setOpenMenuId={setOpenCardMenuId} onCompare={compareStrategy} onViewTrades={viewTrades} />)}</div>}
          </div>
        </section>
      )}
      {helpOpen && <section className="pb-help-panel td-card"><div><strong>How Playbooks work</strong><span>Playbook performance is derived from the setup/playbook names attached to your journaled trades. Use Compare to evaluate strategies side by side.</span></div><button type="button" onClick={() => setHelpOpen(false)}>Close</button></section>}
      {templatesOpen && <div className="pb-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTemplatesOpen(false); }}><section className="pb-modal" role="dialog" aria-modal="true" aria-labelledby="pb-template-title"><div className="pb-modal-head"><div><span className="pb-section-eyebrow">STRATEGY TEMPLATES</span><h2 id="pb-template-title">Start with a proven structure</h2><p>Use a template as a checklist when logging the next strategy trade.</p></div><button type="button" onClick={() => setTemplatesOpen(false)} aria-label="Close templates"><X size={15} /></button></div><div className="pb-template-grid">{[["BoS · FVG","Structure break + fair value gap"],["FVG · OTE","Fair value gap + optimal entry"],["Risk Under $250","Risk-first execution filter"]].map(([name,desc]) => <button key={name} type="button" className="pb-template-card" onClick={() => { setTemplatesOpen(false); setCreateOpen(true); }}><span className="pb-card-icon">{emojiForPlaybook(name)}</span><div><strong>{name}</strong><small>{desc}</small></div><Plus size={13} /></button>)}</div></section></div>}
      {createOpen && <div className="pb-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section className="pb-modal pb-create-modal" role="dialog" aria-modal="true" aria-labelledby="pb-create-title"><div className="pb-modal-head"><div><span className="pb-section-eyebrow">CREATE PLAYBOOK</span><h2 id="pb-create-title">Create a strategy from your journal</h2><p>Playbooks are generated from the setup/playbook name on journaled trades.</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Close create playbook"><X size={15} /></button></div><div className="pb-create-info"><strong>How it works</strong><span>Enter the strategy name when logging a trade. Once trades use that name, the strategy automatically appears here with performance analytics.</span></div><div className="pb-modal-actions"><button type="button" className="pb-secondary-btn" onClick={() => setCreateOpen(false)}>Cancel</button><button type="button" className="pb-primary-btn" onClick={() => { setCreateOpen(false); onAdd?.(); }}><Plus size={13} /> Log trade</button></div></section></div>}
      <div id="playbook-help" className="pb-help-anchor" aria-hidden="true" />
    </div>
  );
}

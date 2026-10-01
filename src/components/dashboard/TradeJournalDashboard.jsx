import React from "react";
import { useDashboardStats } from "../../hooks/useDashboardStats";
import "../../styles/TradeJournalDashboard.css";
import "../../styles/tradeJournalWinRateGauge.css";
import "../../styles/tradeJournalAvgWinLoss.css";
import "../../styles/tradeJournalProfitFactor.css";
import "../../styles/tradeJournalCurrentStreakHorizontal.css";
import "../../styles/tradeJournalPnlChart.css";
import "../../styles/tradeJournalLedgerReference.css";
import "../../styles/dashboardReferenceCalendar.css";
import "../../styles/zellaScore.css";

import DashboardHeader from "./DashboardHeader";
import DashboardKpis from "./DashboardKpis";
import DashboardCard from "./DashboardCard";
import PnlChart from "./PnlChart";
import DailyPerformance from "./DailyPerformance";
import RecentTrades from "./RecentTrades";
import DashboardReferenceCalendar from "./DashboardReferenceCalendar";
import ZellaScore from "./ZellaScore";
import DashboardDropdown from "./DashboardDropdown";
import { readAccountNotifications, writeAccountNotifications } from "../../utils/accountNotifications.js";
import { exportRowsToCsv } from "../../utils/csv.js";
import { useDashboardSummary } from "../../hooks/useDashboardSummary.js";

function TradeJournalDashboard({
  trades = [],
  allTrades = [],
  stats = {},
  apexSettings = {},
  missedTrades = [],
  onAdd,
  setView,
  theme = "dark",
  toggleTheme,
  onRefresh,
  accounts = [],
  filterAccounts = [],
  activeAccount = null,
  activeAccountId = "all",
  accountStatusFilter = "active",
  onAccountStatusFilterChange = null,
  onSelectAccount = null,
  session = null,
  onOpenProfile = null,
}) {
  const sourceTrades = Array.isArray(trades) ? trades : [];
  const [dashboardDateMode, setDashboardDateMode] = React.useState("latest-month");
  const dashboardAccountIds = React.useMemo(() => accounts.map((account) => String(account.id)).filter(Boolean), [accounts]);
  const dashboardSummary = useDashboardSummary({ accountId: activeAccountId, accountIds: activeAccountId === "all" ? dashboardAccountIds : null, dateMode: dashboardDateMode });
  const safeTrades = sourceTrades;
  // The server summary is the authoritative Dashboard dataset. The client
  // calculation remains as a graceful fallback while the release migration is
  // being applied or if a staging database does not yet expose the RPC.
  const fallbackDashboardStats = useDashboardStats(safeTrades);
  const dashboardStats = dashboardSummary.data || fallbackDashboardStats;

  const {
    totalPnl,
    wins,
    losses,
    breakEvenTrades,
    avgWin,
    avgLoss,
    avgWinLossRatio,
    profitFactor,
    winRate,
    orderedTrades,
    currentStreak,
    bestTradeStreak,
    currentDayStreak,
    bestDayStreak,
    dailyPerformance,
    latestTradeDate,
    latestTradeTimestamp,
  } = dashboardStats;

  const [dailyPnlPeriod, setDailyPnlPeriod] = React.useState("all");
  const exportTradesCsv = React.useCallback(() => {
    if (!safeTrades.length) return;
    const columns = ["date", "symbol", "direction", "session", "entry", "exit", "quantity", "pnl", "grade"];
    const rows = safeTrades.map((trade) => Object.fromEntries(columns.map((key) => [key, trade?.[key] ?? trade?.[`trade_${key}`] ?? ""])));
    const csv = exportRowsToCsv(rows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `tradelog-dashboard-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }, [safeTrades]);

  React.useEffect(() => {
    const handler = (event) => {
      if (event.detail?.mode === "latest-month") setDashboardDateMode("latest-month");
      if (event.detail?.mode === "all") setDashboardDateMode("all");
    };
    window.addEventListener("tradelog:dashboard-date", handler);
    return () => window.removeEventListener("tradelog:dashboard-date", handler);
  }, []);
  const [accountNotifications, setAccountNotifications] = React.useState(() => readAccountNotifications(session?.user?.id));

  React.useEffect(() => {
    setAccountNotifications(readAccountNotifications(session?.user?.id));
  }, [session?.user?.id]);

  const dismissNotification = React.useCallback((id) => {
    setAccountNotifications((current) => {
      const next = current.filter((item) => item.id !== id);
      writeAccountNotifications(session?.user?.id, next);
      return next;
    });
  }, [session?.user?.id]);
  const pnlAccountOptions = React.useMemo(() => [
    { value: "all", label: "All Accounts" },
    ...accounts.map((account) => ({ value: account.id, label: account.name || "Trading Account" })),
  ], [accounts]);

  const pnlTrades = React.useMemo(() => safeTrades, [safeTrades]);

  const dailyPnlPeriodOptions = [
    { value: "this", label: "This Month" },
    { value: "previous", label: "Previous Month" },
    { value: "all", label: "All Months" },
  ];

  const filteredDailyPerformance = React.useMemo(() => {
    if (dailyPnlPeriod === "all") return dailyPerformance;
    const now = new Date();
    const target = dailyPnlPeriod === "this"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (dailyPerformance || []).filter((item) => {
      const date = new Date(`${item.date}T12:00:00`);
      return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
    });
  }, [dailyPerformance, dailyPnlPeriod]);


  return (
    <div className={`td-app td-theme-${theme}`}>
      <main className="td-main">
        <DashboardHeader
          latestTradeTimestamp={latestTradeTimestamp}
          latestTradeDate={latestTradeDate}
          onRefresh={onRefresh}
          onExport={exportTradesCsv}
          accounts={accounts}
          filterAccounts={filterAccounts}
          activeAccount={activeAccount}
          activeAccountId={activeAccountId}
          accountStatusFilter={accountStatusFilter}
          onAccountStatusFilterChange={onAccountStatusFilterChange}
          onSelectAccount={onSelectAccount}
          session={session}
          onOpenProfile={onOpenProfile}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <DashboardKpis
          totalPnl={totalPnl}
          wins={wins}
          losses={losses}
          breakEvenTrades={breakEvenTrades}
          avgWin={avgWin}
          avgLoss={avgLoss}
          avgWinLossRatio={avgWinLossRatio}
          profitFactor={profitFactor}
          winRate={winRate}
          currentStreak={currentStreak}
          currentDayStreak={currentDayStreak}
          bestDayStreak={bestDayStreak}
          bestTradeStreak={bestTradeStreak}
        />

        {accountNotifications.length > 0 && (
          <section className="td-dashboard-notifications" aria-label="Notifications">
            <div className="td-dashboard-notifications-head">
              <div><span className="td-dashboard-notifications-eyebrow">NOTIFICATIONS</span><h2>Account Updates</h2><p>Important account milestones and confirmations.</p></div>
              <span className="td-dashboard-notification-count">{accountNotifications.length}</span>
            </div>
            <div className="td-dashboard-notification-list">
              {accountNotifications.slice(0, 5).map((item) => (
                <div className="td-dashboard-notification" key={item.id}>
                  <div className="td-dashboard-notification-icon">✓</div>
                  <div className="td-dashboard-notification-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</small></div>
                  <button type="button" onClick={() => dismissNotification(item.id)} aria-label="Dismiss notification">×</button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="td-layout">
          <div className="td-left">
            <DashboardCard
              title="Daily Net Cumulative P&L"
              right={
                <DashboardDropdown
                  value={activeAccountId}
                  options={pnlAccountOptions}
                  onChange={onSelectAccount}
                  ariaLabel="Daily Net Cumulative P&L account"
                  className="td-account-chart-dropdown"
                />
              }
            >
              <PnlChart trades={pnlTrades} dailyPerformance={dashboardStats.dailyPerformance} />
            </DashboardCard>

            <ZellaScore trades={safeTrades} accountId={activeAccountId} accountIds={activeAccountId === "all" ? dashboardAccountIds : null} />

            <DashboardCard
              title="Recent trades"
              right={
                <button
                  className="td-link"
                  onClick={() => setView?.("trades")}
                  type="button"
                >
                  View all
                </button>
              }
            >
              <RecentTrades trades={dashboardStats.recentTrades || orderedTrades} />
            </DashboardCard>
          </div>

          <div className="td-right">
            <DashboardReferenceCalendar trades={safeTrades} dailyData={dashboardStats.dailyData || []} latestTradeDate={dashboardStats.latestTradeDate} />

            <div className="td-bottom-grid">
              <DashboardCard
                title="Net daily P&L"
                right={
                  <DashboardDropdown
                    value={dailyPnlPeriod}
                    options={dailyPnlPeriodOptions}
                    onChange={setDailyPnlPeriod}
                    ariaLabel="Net daily P&L period"
                    className="td-period-chart-dropdown"
                  />
                }
              >
                <DailyPerformance dailyPerformance={filteredDailyPerformance} />
              </DashboardCard>

              <DashboardCard title="External links">
                <div className="td-links">
                  <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
                    TradingView <small>Chart analysis</small> ↗
                  </a>
                  <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noreferrer">
                    Forex Factory <small>News & events</small> ↗
                  </a>
                  <a href="https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html" target="_blank" rel="noreferrer">
                    CME FedWatch <small>Rate probabilities</small> ↗
                  </a>
                  <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noreferrer">
                    Economic Calendar <small>Key events</small> ↗
                  </a>
                </div>
              </DashboardCard>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default React.memo(TradeJournalDashboard);

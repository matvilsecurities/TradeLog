import React from "react";
import "../../styles/dashboardReferenceCalendar.css";
import { normalizeDateKey, parseDateKey } from "./dashboardUtils";

function getPnl(trade) {
  const value = Number(trade?.pnl ?? trade?.profit ?? trade?.net_pnl);
  return Number.isFinite(value) ? value : 0;
}

function formatCompactMoney(value) {
  const n = Number(value) || 0;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2).replace(/\.00$/, "")}K`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function DashboardReferenceCalendar({ trades = [], dailyData = [], latestTradeDate: latestTradeDateProp = null, onDayClick } = {}) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const dates = safeTrades.map(t => normalizeDateKey(t?.date ?? t?.trade_date)).filter(Boolean).sort();
  const latestTradeDate = latestTradeDateProp || dates[dates.length - 1] || null;
  const [currentDate, setCurrentDate] = React.useState(() => latestTradeDate ? parseDateKey(latestTradeDate) : new Date());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const [showCalendarInfo, setShowCalendarInfo] = React.useState(false);
  const [compactWeeks, setCompactWeeks] = React.useState(false);
  const [showWeekSummary, setShowWeekSummary] = React.useState(true);

  React.useEffect(() => {
    if (latestTradeDate) setCurrentDate(parseDateKey(latestTradeDate));
  }, [latestTradeDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const dailyMap = {};
  if (Array.isArray(dailyData) && dailyData.length) {
    dailyData.forEach((item) => {
      const date = normalizeDateKey(item?.date);
      if (!date) return;
      dailyMap[date] = {
        pnl: Number(item?.pnl) || 0,
        trades: Number(item?.trades) || 0,
        wins: Number(item?.wins) || 0,
        losses: Number(item?.losses) || 0,
      };
    });
  } else {
    safeTrades.forEach(trade => {
      const date = normalizeDateKey(trade?.date ?? trade?.trade_date);
      if (!date) return;
      const pnl = getPnl(trade);
      if (!dailyMap[date]) dailyMap[date] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
      dailyMap[date].pnl += pnl;
      dailyMap[date].trades += 1;
      if (pnl > 0) dailyMap[date].wins += 1;
      if (pnl < 0) dailyMap[date].losses += 1;
    });
  }

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthDailyRows = Object.entries(dailyMap).filter(([date]) => date.startsWith(monthPrefix)).map(([date, value]) => ({ date, ...value }));
  const monthPnl = monthDailyRows.reduce((sum, row) => sum + Number(row.pnl || 0), 0);
  const monthTradingDays = monthDailyRows.filter((row) => Number(row.trades || 0) > 0).length;
  const monthWins = monthDailyRows.reduce((sum, row) => sum + Number(row.wins || 0), 0);
  const monthLosses = monthDailyRows.reduce((sum, row) => sum + Number(row.losses || 0), 0);
  const monthTradesCount = monthDailyRows.reduce((sum, row) => sum + Number(row.trades || 0), 0);
  const monthDecisiveTrades = monthWins + monthLosses;
  const monthWinRate = monthDecisiveTrades ? (monthWins / monthDecisiveTrades) * 100 : 0;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarCells.push(day);

  const weekCount = Math.ceil((firstDay + daysInMonth) / 7);
  const weeks = [];
  for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
    const rowStart = weekIndex * 7 - firstDay + 1;
    const rowEnd = rowStart + 6;
    let pnl = 0;
    let tradingDays = 0;
    for (let day = Math.max(1, rowStart); day <= Math.min(daysInMonth, rowEnd); day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (dailyMap[dateKey]) {
        pnl += dailyMap[dateKey].pnl;
        tradingDays += 1;
      }
    }
    weeks.push({ label: `Week ${weekIndex + 1}`, pnl, tradingDays });
  }

  const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const goPreviousMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setShowMonthPicker(false); };
  const goNextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setShowMonthPicker(false); };
  const goThisMonth = () => { const today = new Date(); setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setShowMonthPicker(false); };
  const selectMonth = selectedMonth => { setCurrentDate(new Date(year, selectedMonth, 1)); setShowMonthPicker(false); };
  const tradeYears = Array.from(new Set(Object.keys(dailyMap).map((date) => Number(String(date).slice(0, 4))).filter(Number.isFinite))).sort((a, b) => b - a);

  return (
    <section className={`td-reference-calendar${compactWeeks ? " is-compact-weeks" : ""}`}>
      <header className="td-reference-calendar-head">
        <div className="td-reference-calendar-left">
          <button type="button" className="td-reference-calendar-nav" onClick={goPreviousMonth} aria-label="Previous month">‹</button>
          <div className="td-reference-month-picker">
            <button type="button" className="td-reference-month-label" onClick={() => setShowMonthPicker(open => !open)} aria-label="Select month and year">{monthName}</button>
            {showMonthPicker && (
              <div className="td-reference-month-menu">
                <div className="td-reference-year-row">
                  <span>YEAR</span>
                  <select value={year} onChange={e => setCurrentDate(new Date(Number(e.target.value), month, 1))}>
                    {tradeYears.length ? tradeYears.map(value => <option key={value} value={value}>{value}</option>) : <option value={year}>{year}</option>}
                  </select>
                </div>
                <div className="td-reference-month-grid">
                  {Array.from({ length: 12 }, (_, index) => (
                    <button type="button" key={index} className={index === month ? "active" : ""} onClick={() => selectMonth(index)}>
                      {new Date(2000, index, 1).toLocaleDateString("en-US", { month: "short" })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button type="button" className="td-reference-calendar-nav" onClick={goNextMonth} aria-label="Next month">›</button>
          <button type="button" className="td-reference-calendar-this-month" onClick={goThisMonth}>This month</button>
        </div>

        <div className="td-reference-calendar-tools">
          <div className="td-reference-stat-cards">
            <div className="td-reference-stat-card">
              <span>Month P&amp;L</span>
              <strong className={monthPnl < 0 ? "negative" : monthPnl > 0 ? "positive" : ""}>{formatCompactMoney(monthPnl)}</strong>
            </div>
            <div className="td-reference-stat-card">
              <span>Trades</span>
              <strong>{monthTradesCount}</strong>
            </div>
            <div className="td-reference-stat-card">
              <span>Win Rate</span>
              <strong className={monthWinRate >= 50 ? "positive" : monthTradesCount > 0 ? "negative" : ""}>{monthWinRate.toFixed(0)}%</strong>
            </div>
            <div className="td-reference-stat-card">
              <span>Trading Days</span>
              <strong>{monthTradingDays}</strong>
            </div>
          </div>
          <button type="button" aria-label="Calendar settings" title="Calendar settings" onClick={() => setShowWeekSummary(v => !v)}>⚙</button>
          <button type="button" aria-label="Calendar view" title="Toggle compact weekly summary" onClick={() => setCompactWeeks(v => !v)}>◉</button>
          <button type="button" aria-label="Calendar information" title="Calendar information" onClick={() => setShowCalendarInfo(v => !v)}>ⓘ</button>
        </div>
      </header>

      <div className="td-reference-calendar-body">
        <div className="td-reference-calendar-main">
          <div className="td-reference-weekdays">{weekdayLabels.map(day => <div key={day}>{day}</div>)}</div>
          {showCalendarInfo && <div style={{ gridColumn: "1 / -1", padding: "8px 12px", borderBottom: "1px solid var(--td-border, #e5e7eb)", fontSize: 11, color: "var(--td-muted, #6b7280)" }}>Each day shows net P&amp;L, trade count and decisive-trade win rate. Click a trading day to inspect its trades when a day action is available.</div>}
          <div className="td-reference-calendar-grid">
            {calendarCells.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="td-reference-calendar-day empty" />;
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const data = dailyMap[dateKey];
              const tradeCount = data?.trades ?? 0;
              const pnl = tradeCount ? data.pnl : null;
              const winRate = tradeCount ? (data.wins / tradeCount) * 100 : 0;
              let tone = "empty";
              if (tradeCount) tone = Math.abs(pnl) <= 30 ? "neutral" : pnl > 0 ? "win" : "loss";
              return (
                <div
                  key={dateKey}
                  className={`td-reference-calendar-day ${tone} ${tradeCount ? "has-trades" : ""}`}
                  onClick={tradeCount && onDayClick ? () => onDayClick(dateKey) : undefined}
                >
                  <span className="td-reference-calendar-date">{day}</span>
                  {tradeCount > 0 && (
                    <div className="td-reference-calendar-info">
                      <strong>{formatCompactMoney(pnl)}</strong>
                      <small>{tradeCount} {tradeCount === 1 ? "trade" : "trades"}</small>
                      <small>{winRate.toFixed(1)}%</small>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showWeekSummary && <aside className="td-reference-calendar-weeks">
          {weeks.map(week => (
            <div className="td-reference-calendar-week" key={week.label}>
              <span>{week.label}</span>
              <strong className={week.pnl < 0 ? "negative" : week.pnl > 0 ? "positive" : ""}>{formatCompactMoney(week.pnl)}</strong>
              <small>{week.tradingDays} {week.tradingDays === 1 ? "day" : "days"}</small>
            </div>
          ))}
        </aside>}
      </div>

      <footer className="td-reference-calendar-footer">
        <span>{monthTradesCount} trades</span>
        <span>{monthWinRate.toFixed(1)}% win rate</span>
      </footer>
    </section>
  );
}

import React from "react";
import { formatMoney } from "./dashboardUtils";

function DailyBars({ dailyPerformance = [] }) {
  const values = Array.isArray(dailyPerformance) ? dailyPerformance : [];

  if (!values.length) {
    return (
      <div className="td-chart-empty">
        <div className="td-chart-empty-icon">⌁</div>
        <div>No trading data yet</div>
        <small>Your daily P&L will appear here.</small>
      </div>
    );
  }

  const maxAbs = Math.max(100, ...values.map((item) => Math.abs(Number(item.pnl) || 0)));
  const chartMax = Math.ceil(maxAbs / 100) * 100;
  const gridValues = [chartMax, chartMax / 2, 0, -chartMax / 2, -chartMax];

  const formatAxis = (value) =>
    value === 0
      ? "$0"
      : `${value < 0 ? "-$" : "$"}${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const formatDate = (date) =>
    new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const getIndex = (ratio) =>
    values[Math.floor((values.length - 1) * ratio)]?.date;

  return (
    <div className="td-daily-pnl-chart">
      <div className="td-daily-pnl-y-axis">
        {gridValues.map((value) => (
          <span key={value}>{formatAxis(value)}</span>
        ))}
      </div>

      <div className="td-daily-pnl-plot">
        <div className="td-daily-pnl-grid">
          {gridValues.map((value) => (
            <span key={value} className={value === 0 ? "zero" : ""} />
          ))}
        </div>

        <div className="td-bars">
          {values.map((item) => {
            const pnl = Number(item.pnl) || 0;
            const height = (Math.abs(pnl) / chartMax) * 50;

            return (
              <span
                key={item.date}
                className={pnl >= 0 ? "positive" : "negative"}
                style={{ height: `${Math.max(4, height)}%` }}
                data-tooltip={`${formatDate(item.date)} • ${formatMoney(pnl)}`}
              />
            );
          })}
        </div>
      </div>

      <div className="td-axis">
        {[values[0]?.date, getIndex(0.33), getIndex(0.66), values[values.length - 1]?.date].map(
          (date, index) => <span key={`${date || "empty"}-${index}`}>{date ? formatDate(date) : "—"}</span>
        )}
      </div>
    </div>
  );
}

function DailyPerformance({ dailyPerformance }) {
  return <DailyBars dailyPerformance={dailyPerformance} />;
}

export default React.memo(DailyPerformance);

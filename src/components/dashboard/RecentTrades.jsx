import React from "react";
import { getPnl } from "../../hooks/useDashboardStats";
import { formatMoney, normalizeDateKey, parseDateKey } from "./dashboardUtils";

function RecentTrades({ trades = [] }) {
  const recentTrades = [...trades].reverse().slice(0, 5);

  return (
    <div className="td-table">
      <div className="td-tr th">
        <span>Date</span>
        <span>Symbol</span>
        <span>P&L</span>
        <span>Zella Score</span>
      </div>

      {recentTrades.length === 0 ? (
        <div className="td-empty-row">
          <span>No trades logged yet</span>
        </div>
      ) : (
        recentTrades.map((trade) => {
          const pnl = getPnl(trade);
          const setupScore = trade?.setup_score ?? trade?.setupScore;
          const score = Number(setupScore);
          const progress = Number.isFinite(score)
            ? `${Math.max(1, Math.min(10, score)) * 10}%`
            : "10%";

          return (
            <div
              className="td-tr"
              key={trade?.id || `${trade?.date}-${trade?.symbol}-${trade?.time}`}
            >
              <span>
                {normalizeDateKey(trade?.date ?? trade?.trade_date)
                  ? parseDateKey(trade?.date ?? trade?.trade_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </span>

              <span>{trade?.symbol || "—"}</span>

              <span className={pnl < 0 ? "loss" : "profit"}>
                {formatMoney(pnl)}
              </span>

              <span
                className="td-recent-zella"
                style={{ "--zella-progress": progress }}
              >
                <i>{setupScore ?? "—"}</i>
              </span>
            </div>
          );
        })
      )}    </div>
  );
}

export default React.memo(RecentTrades);

import React from "react";
import { formatMoney } from "./dashboardUtils";

function WinRateGauge({ wins, losses, breakeven }) {
  const decisiveTrades = wins + losses;
  const totalTrades = decisiveTrades + breakeven;
  const radius = 39;
  const circumference = Math.PI * radius;
  const gap = 1.5;
  const greenAngle = decisiveTrades > 0 ? (wins / decisiveTrades) * 180 : 0;
  const blueAngle = totalTrades > 0 ? (breakeven / totalTrades) * 180 : 0;
  const redAngle = Math.max(0, 180 - greenAngle - blueAngle);
  const greenLength = Math.max(0, (greenAngle / 180) * circumference - gap);
  const blueLength = Math.max(0, (blueAngle / 180) * circumference - gap);
  const redLength = Math.max(0, (redAngle / 180) * circumference - gap);
  const blueOffset = -(greenAngle / 180) * circumference;
  const redOffset = -((greenAngle + blueAngle) / 180) * circumference;

  const cx = 48;
  const arcRadius = 39;
  const viewBoxWidth = 96;

  const angleToXPercent = (angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    const x = cx + arcRadius * Math.cos(rad);
    const percent = (x / viewBoxWidth) * 100;
    return Math.min(94, Math.max(6, percent));
  };

  const greenMidAngle = 180 - greenAngle / 2;
  const blueMidAngle = 180 - greenAngle - blueAngle / 2;
  const redMidAngle = redAngle / 2;

  return (
    <div
      className="td-winrate-gauge"
      aria-label={`${wins} wins, ${breakeven} break-even trades, ${losses} losses`}
    >
      <svg viewBox="0 0 96 56" role="img" aria-hidden="true">
        <path className="td-gauge-track" d="M 9 48 A 39 39 0 0 1 87 48" />
        <path className="td-gauge-segment td-gauge-win" d="M 9 48 A 39 39 0 0 1 87 48" strokeDasharray={`${greenLength} ${circumference}`} strokeDashoffset="0" />
        <path className="td-gauge-segment td-gauge-break" d="M 9 48 A 39 39 0 0 1 87 48" strokeDasharray={`${blueLength} ${circumference}`} strokeDashoffset={blueOffset} />
        <path className="td-gauge-segment td-gauge-loss" d="M 9 48 A 39 39 0 0 1 87 48" strokeDasharray={`${redLength} ${circumference}`} strokeDashoffset={redOffset} />
      </svg>

      <div className="td-gauge-counts">
        <span className="td-gauge-count win" style={{ left: `${angleToXPercent(greenMidAngle)}%` }}>{wins}</span>
        <span className="td-gauge-count break" style={{ left: `${angleToXPercent(blueMidAngle)}%` }}>{breakeven}</span>
        <span className="td-gauge-count loss" style={{ left: `${angleToXPercent(redMidAngle)}%` }}>{losses}</span>
      </div>
    </div>
  );
}

function ProfitFactorGauge({ value }) {
  const numericValue = Number(value);
  const hasValue = Number.isFinite(numericValue) && numericValue > 0;
  const greenRatio = hasValue ? Math.min(numericValue / 3, 1) : 0;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const gap = 1.8;
  const greenLength = hasValue ? Math.max(0, circumference * greenRatio - gap) : 0;
  const redLength = hasValue ? Math.max(0, circumference * (1 - greenRatio) - gap) : circumference;
  const redOffset = hasValue ? -(circumference * greenRatio) : 0;

  return (
    <div
      className="td-profit-factor-gauge"
      aria-label={hasValue ? `Profit factor ${numericValue.toFixed(2)}` : "Profit factor unavailable"}
    >
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <circle className="td-pf-track" cx="24" cy="24" r={radius} />
        <circle className="td-pf-segment td-pf-green" cx="24" cy="24" r={radius} strokeDasharray={`${greenLength} ${circumference}`} strokeDashoffset="0" />
        <circle className="td-pf-segment td-pf-red" cx="24" cy="24" r={radius} strokeDasharray={`${redLength} ${circumference}`} strokeDashoffset={redOffset} />
      </svg>
    </div>
  );
}

function DashboardKpis({
  totalPnl,
  wins,
  losses,
  breakEvenTrades,
  avgWin,
  avgLoss,
  avgWinLossRatio,
  profitFactor,
  winRate,
  currentStreak,
  currentDayStreak,
  bestDayStreak,
  bestTradeStreak,
}) {
  return (
    <section className="td-kpis">
      <div className={`td-kpi ${totalPnl >= 0 ? "green" : "loss"}`}>
        <span>Net P&L</span>
        <strong>{formatMoney(totalPnl)}</strong>
        <small>Net performance</small>
      </div>

      <div className="td-kpi td-kpi-winrate violet">
        <div className="td-kpi-winrate-copy">
          <span>Win Rate</span>
          <strong>{winRate.toFixed(0)}%</strong>
          <small>Actual trade performance</small>
        </div>

        <WinRateGauge wins={wins} losses={losses} breakeven={breakEvenTrades} />
      </div>

      <div className="td-kpi td-kpi-avglw">
        <span>Avg win/loss trade</span>

        <div className="td-avglw-body">
          <strong>{avgWinLossRatio !== null ? avgWinLossRatio.toFixed(2) : "—"}</strong>

          <div className="td-avglw-right">
            <div className="td-avglw-bar">
              <i
                className="win"
                style={{
                  width: `${((Math.abs(avgWin) / Math.max(1, Math.abs(avgWin) + Math.abs(avgLoss))) * 100).toFixed(2)}%`,
                }}
              />
              <i
                className="loss"
                style={{
                  width: `${((Math.abs(avgLoss) / Math.max(1, Math.abs(avgWin) + Math.abs(avgLoss))) * 100).toFixed(2)}%`,
                }}
              />
            </div>

            <div className="td-avglw-values">
              <b>{formatMoney(avgWin)}</b>
              <b>{formatMoney(avgLoss)}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="td-kpi td-kpi-profit-factor violet">
        <div className="td-profit-factor-copy">
          <span>Profit factor</span>
          <strong>{profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)}</strong>
        </div>
        <ProfitFactorGauge value={profitFactor} />
      </div>

      <div className="td-kpi td-kpi-streak">
        <div className="td-streak-title">
          <span>Current streak</span>
        </div>

        <div className="td-streak-stats">
          <div className="td-streak-stat">
            <span className="td-streak-label">DAYS</span>
            <div className="td-streak-content">
              <div className="td-streak-circle"><strong>{currentDayStreak || 0}</strong></div>
              <div className="td-streak-pills">
                <span className="td-streak-pill current">{currentDayStreak || 0} {currentDayStreak === 1 ? "day" : "days"}</span>
                <span className="td-streak-pill best">{bestDayStreak || 0} {bestDayStreak === 1 ? "day" : "days"}</span>
              </div>
            </div>
          </div>

          <div className="td-streak-stat">
            <span className="td-streak-label">TRADES</span>
            <div className="td-streak-content">
              <div className="td-streak-circle"><strong>{currentStreak || 0}</strong></div>
              <div className="td-streak-pills">
                <span className="td-streak-pill current">{currentStreak || 0} {currentStreak === 1 ? "trade" : "trades"}</span>
                <span className="td-streak-pill best">{bestTradeStreak || 0} {bestTradeStreak === 1 ? "trade" : "trades"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default React.memo(DashboardKpis);

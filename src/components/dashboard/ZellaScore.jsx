import React from "react";
import "../../styles/zellaScore.css";
import { useDashboardSummary } from "../../hooks/useDashboardSummary.js";

function getPnl(trade) {
  const value = Number(trade?.pnl ?? trade?.profit ?? trade?.net_pnl);
  return Number.isFinite(value) ? value : 0;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function interpolateScore(value, points, floor = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return floor;

  const sorted = points;

  if (n >= sorted[0][0]) return sorted[0][1];
  if (n < sorted[sorted.length - 1][0]) return floor;

  for (let i = 0; i < sorted.length - 1; i++) {
    const [highValue, highScore] = sorted[i];
    const [lowValue, lowScore] = sorted[i + 1];

    if (n <= highValue && n >= lowValue) {
      const ratio = (n - lowValue) / (highValue - lowValue);
      return lowScore + ratio * (highScore - lowScore);
    }
  }

  return floor;
}

function scoreWinRate(winRate) {
  return clampScore((Number(winRate) / 60) * 100);
}

function scoreAvgWinLoss(ratio) {
  return clampScore(
    interpolateScore(
      ratio,
      [
        [2.6, 100],
        [2.4, 90],
        [2.2, 80],
        [2.0, 70],
        [1.9, 60],
        [1.8, 50],
      ],
      20
    )
  );
}

function scoreProfitFactor(value) {
  if (value === Infinity) return 100;

  return clampScore(
    interpolateScore(
      value,
      [
        [2.6, 100],
        [2.4, 90],
        [2.2, 80],
        [2.0, 70],
        [1.9, 60],
        [1.8, 50],
      ],
      20
    )
  );
}

function scoreRecoveryFactor(value) {
  if (!Number.isFinite(value) || value < 1) return 0;
  if (value >= 3.5) return 100;
  if (value >= 3.0) return 70 + ((value - 3.0) / 0.5) * 30;
  if (value >= 2.5) return 60 + ((value - 2.5) / 0.5) * 10;
  if (value >= 2.0) return 50 + ((value - 2.0) / 0.5) * 10;
  if (value >= 1.5) return 30 + ((value - 1.5) / 0.5) * 20;
  if (value >= 1.0) return ((value - 1.0) / 0.5) * 29;
  return 0;
}

function scoreMaxDrawdown(drawdownPercent) {
  if (!Number.isFinite(drawdownPercent)) return 0;
  return clampScore(100 - Math.max(0, drawdownPercent));
}

function scoreConsistency(dailyProfits) {
  if (!dailyProfits.length) return 0;

  const totalProfit = dailyProfits.reduce((sum, value) => sum + value, 0);
  const averageProfit = totalProfit / dailyProfits.length;

  if (averageProfit < 0 || totalProfit <= 0) return 0;
  if (dailyProfits.length === 1) return 100;

  const variance =
    dailyProfits.reduce(
      (sum, value) => sum + Math.pow(value - averageProfit, 2),
      0
    ) / dailyProfits.length;

  const standardDeviation = Math.sqrt(variance);
  const variationPercent =
    (standardDeviation / Math.abs(totalProfit)) * 100;

  return clampScore(100 - variationPercent);
}

function scoreZellaRaw(raw = {}) {
  const metrics = {
    winRate: scoreWinRate(raw.winRate),
    profitFactor: scoreProfitFactor(raw.profitFactor),
    avgWinLoss: scoreAvgWinLoss(raw.avgWinLoss),
    recoveryFactor: scoreRecoveryFactor(raw.recoveryFactor),
    maxDrawdown: scoreMaxDrawdown(raw.maxDrawdownPercent),
    consistency: clampScore(raw.consistency),
  };
  const score =
    metrics.recoveryFactor * 0.10 +
    metrics.winRate * 0.15 +
    metrics.avgWinLoss * 0.20 +
    metrics.profitFactor * 0.25 +
    metrics.maxDrawdown * 0.20 +
    metrics.consistency * 0.10;
  return { score: clampScore(score), metrics, raw };
}

function calculateZellaScore(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const pnls = safeTrades.map((trade) => getPnl(trade));

  const wins = pnls.filter((value) => value > 0);
  const losses = pnls.filter((value) => value < 0);
  const decisive = wins.length + losses.length;

  const totalProfit = wins.reduce((sum, value) => sum + value, 0);
  const totalLoss = Math.abs(
    losses.reduce((sum, value) => sum + value, 0)
  );

  const winRate = decisive > 0 ? (wins.length / decisive) * 100 : 0;
  const avgWin = wins.length ? totalProfit / wins.length : 0;
  const avgLoss = losses.length ? totalLoss / losses.length : 0;
  const avgWinLoss = avgLoss > 0 ? avgWin / avgLoss : 0;

  const profitFactor =
    totalLoss > 0
      ? totalProfit / totalLoss
      : totalProfit > 0
        ? Infinity
        : 0;

  const ordered = [...safeTrades].sort((a, b) => {
    const dateA = new Date(
      a?.date ?? a?.trade_date ?? a?.created_at ?? 0
    ).getTime();

    const dateB = new Date(
      b?.date ?? b?.trade_date ?? b?.created_at ?? 0
    ).getTime();

    return dateA - dateB;
  });

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  ordered.forEach((trade) => {
    cumulative += getPnl(trade);

    if (cumulative > peak) {
      peak = cumulative;
    }

    const drawdown = Math.max(0, peak - cumulative);

    maxDrawdown = Math.max(maxDrawdown, drawdown);

    if (peak > 0) {
      maxDrawdownPercent = Math.max(
        maxDrawdownPercent,
        (drawdown / peak) * 100
      );
    } else if (drawdown > 0) {
      maxDrawdownPercent = 100;
    }
  });

  const recoveryFactor =
    maxDrawdown > 0
      ? cumulative / maxDrawdown
      : cumulative > 0
        ? Infinity
        : 0;

  const dailyMap = {};

  ordered.forEach((trade) => {
    const date = trade?.date ?? trade?.trade_date;
    if (!date) return;

    dailyMap[date] = (dailyMap[date] || 0) + getPnl(trade);
  });

  const dailyProfits = Object.values(dailyMap);

  const metrics = {
    winRate: scoreWinRate(winRate),
    profitFactor: scoreProfitFactor(profitFactor),
    avgWinLoss: scoreAvgWinLoss(avgWinLoss),
    recoveryFactor: scoreRecoveryFactor(recoveryFactor),
    maxDrawdown: scoreMaxDrawdown(maxDrawdownPercent),
    consistency: scoreConsistency(dailyProfits),
  };

  const score =
    metrics.recoveryFactor * 0.10 +
    metrics.winRate * 0.15 +
    metrics.avgWinLoss * 0.20 +
    metrics.profitFactor * 0.25 +
    metrics.maxDrawdown * 0.20 +
    metrics.consistency * 0.10;

  return {
    score: clampScore(score),
    metrics,
    raw: {
      winRate,
      profitFactor,
      avgWinLoss,
      recoveryFactor,
      maxDrawdownPercent,
      consistency: scoreConsistency(dailyProfits),
    },
  };
}

function getTradeCalendarDate(trade) {
  const raw =
    trade?.date ??
    trade?.trade_date ??
    trade?.created_at;

  if (!raw) return null;

  const value = String(raw);
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const Radar = React.memo(function Radar({ metrics }) {
  const center = 150;
  const centerY = 125;
  const radius = 94;

  const rings = [20, 40, 60, 80, 100];

  const axes = [
    { key: "winRate", label: "Win %", angle: -90, labelRadius: 111 },
    { key: "profitFactor", label: "Profit factor", angle: -30, labelRadius: 114 },
    { key: "avgWinLoss", label: "Avg win/loss", angle: 30, labelRadius: 114 },
    { key: "recoveryFactor", label: "Recovery factor", angle: 90, labelRadius: 111 },
    { key: "maxDrawdown", label: "Max drawdown", angle: 150, labelRadius: 114 },
    { key: "consistency", label: "Consistency", angle: 210, labelRadius: 114 },
  ];

  const point = (angle, value, scale = radius) => {
    const radians = (angle * Math.PI) / 180;
    const r = (clampScore(value) / 100) * scale;

    return `${center + Math.cos(radians) * r},${centerY + Math.sin(radians) * r}`;
  };

  const polygon = (value) =>
    axes.map((axis) => point(axis.angle, value)).join(" ");

  const performanceShape = axes
    .map((axis) => point(axis.angle, metrics?.[axis.key] ?? 0))
    .join(" ");

  return (
    <div className="zella-radar-wrap">
      <svg
        className="zella-radar"
        viewBox="0 0 300 250"
        role="img"
        aria-label="Zella Score performance radar"
      >
        <defs>
          <linearGradient
            id="zellaRadarFill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#8d6cff" stopOpacity="0.10" />
            <stop offset="55%" stopColor="#7654ef" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#6844e8" stopOpacity="0.34" />
          </linearGradient>
        </defs>

        {rings.map((value) => (
          <polygon
            key={value}
            className="zella-radar-ring"
            points={polygon(value)}
          />
        ))}

        {axes.map((axis) => {
          const end = point(axis.angle, 100);
          const [x, y] = end.split(",");

          return (
            <line
              key={`axis-${axis.key}`}
              className="zella-radar-axis"
              x1={center}
              y1={centerY}
              x2={x}
              y2={y}
            />
          );
        })}

        {axes.map((axis) => {
          const end = point(axis.angle, 100);
          const [x, y] = end.split(",").map(Number);

          return (
            <circle
              key={`outer-point-${axis.key}`}
              className="zella-radar-outer-point"
              cx={x}
              cy={y}
              r="2"
            />
          );
        })}

        <polygon
          className="zella-radar-shape"
          points={performanceShape}
        />

        {axes.map((axis) => {
          const value = metrics?.[axis.key] ?? 0;
          const radians = (axis.angle * Math.PI) / 180;
          const r = (clampScore(value) / 100) * radius;

          const x = center + Math.cos(radians) * r;
          const y = centerY + Math.sin(radians) * r;

          return (
            <circle
              key={`performance-point-${axis.key}`}
              className="zella-radar-point"
              cx={x}
              cy={y}
              r="3"
            />
          );
        })}

        {axes.map((axis) => {
          const radians = (axis.angle * Math.PI) / 180;
          const x = center + Math.cos(radians) * axis.labelRadius;
          const y = centerY + Math.sin(radians) * axis.labelRadius;

          return (
            <text key={`label-${axis.key}`} x={x} y={y}>
              {axis.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
});

function ZellaCard({ children, right }) {
  return (
    <section className="td-card zella-score-card">
      <div className="td-card-head">
        <h2>Zella Score</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const ZellaScore = React.memo(function ZellaScore({ trades = [], accountId = "all", accountIds = null }) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const [zellaPeriod, setZellaPeriod] = React.useState("all");
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const periodRef = React.useRef(null);

  const periodOptions = [
    { value: "this", label: "This month" },
    { value: "previous", label: "Previous Month" },
    { value: "all", label: "All Months" },
  ];

  const selectedPeriod =
    periodOptions.find((option) => option.value === zellaPeriod) ??
    periodOptions[0];

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        periodRef.current &&
        !periodRef.current.contains(event.target)
      ) {
        setPeriodOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const zellaSummary = useDashboardSummary({ accountId, accountIds, dateMode: zellaPeriod });

  const zellaTrades = React.useMemo(() => safeTrades.filter((trade) => {
    if (zellaPeriod === "all") return true;

    const tradeDate = getTradeCalendarDate(trade);
    if (!tradeDate) return false;

    if (zellaPeriod === "this") {
      return tradeDate.getFullYear() === currentYear && tradeDate.getMonth() === currentMonth;
    }

    const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
    return tradeDate.getFullYear() === previousMonthDate.getFullYear() && tradeDate.getMonth() === previousMonthDate.getMonth();
  }), [safeTrades, zellaPeriod]);

  const zellaScore = React.useMemo(() => {
    if (zellaSummary.data?.zella?.raw) return scoreZellaRaw(zellaSummary.data.zella.raw);
    return calculateZellaScore(zellaTrades);
  }, [zellaSummary.data, zellaTrades]);

  return (
    <ZellaCard
      right={
        <div
          ref={periodRef}
          className={`zella-period-dropdown ${
            periodOpen ? "is-open" : ""
          }`}
        >
          <button
            type="button"
            className="zella-period-trigger"
            onClick={() => setPeriodOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={periodOpen}
          >
            <span>{selectedPeriod.label}</span>
            <span className="zella-period-chevron" aria-hidden="true" />
          </button>

          {periodOpen && (
            <div
              className="zella-period-menu"
              role="listbox"
              aria-label="Zella Score period"
            >
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={zellaPeriod === option.value}
                  className={`zella-period-option ${
                    zellaPeriod === option.value ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    setZellaPeriod(option.value);
                    setPeriodOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      <Radar metrics={zellaScore.metrics} />

      <div className="zella-score-divider" />

      <div className="zella-score-row">
        <div className="zella-score-value">
          <span>Your Zella Score</span>
          <strong>{zellaScore.score.toFixed(2)}</strong>
        </div>

        <div className="zella-score-scale">
          <div className="zella-score-track">
            <i
              style={{
                left: `${zellaScore.score}%`,
              }}
            />
          </div>

          <div className="zella-score-labels">
            <span>0</span>
            <span>20</span>
            <span>40</span>
            <span>60</span>
            <span>80</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </ZellaCard>
  );
});

export default ZellaScore;

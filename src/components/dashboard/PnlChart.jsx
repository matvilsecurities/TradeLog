import React from "react";
import { getPnl } from "../../hooks/useDashboardStats";
import { formatMoney, normalizeDateKey, parseDateKey } from "./dashboardUtils";

function PnlChart({ trades = [], dailyPerformance = null }) {
  const dailyMap = {};

  if (Array.isArray(dailyPerformance) && dailyPerformance.length) {
    dailyPerformance.forEach((item) => {
      const date = normalizeDateKey(item?.date);
      if (date) dailyMap[date] = Number(item?.pnl) || 0;
    });
  } else {
    trades.forEach((trade) => {
      const date = normalizeDateKey(trade?.date ?? trade?.trade_date);
      if (!date) return;
      const pnl = getPnl(trade);
      dailyMap[date] = (dailyMap[date] || 0) + pnl;
    });
  }

  const dailyResults = Object.entries(dailyMap)
    .map(([date, pnl]) => ({ date, pnl }))
    .sort(
      (a, b) =>
        (parseDateKey(a.date)?.getTime() ?? 0) -
        (parseDateKey(b.date)?.getTime() ?? 0)
    );

  const points = [];
  let cumulative = 0;

  dailyResults.forEach(({ date, pnl }) => {
    cumulative += pnl;
    points.push({ date, dailyPnl: pnl, value: cumulative });
  });

  if (!points.length) {
    return (
      <div className="td-chart-empty">
        <div className="td-chart-empty-icon">⌁</div>
        <div>No trading data yet</div>
        <small>Your cumulative P&L will appear here.</small>
      </div>
    );
  }

  const width = 620;
  const height = 230;
  const padLeft = 48;
  const padRight = 10;
  const padTop = 20;
  const padBottom = 28;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const values = points.map((point) => point.value);
  let minValue = Math.min(0, ...values);
  let maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const padding = range * 0.12;
  minValue -= padding;
  maxValue += padding;
  const valueRange = maxValue - minValue || 1;

  const getX = (index) => {
    if (points.length === 1) return padLeft + chartWidth / 2;
    return padLeft + (index / (points.length - 1)) * chartWidth;
  };

  const getY = (value) =>
    padTop + ((maxValue - value) / valueRange) * chartHeight;

  const linePoints = points
    .map((point, index) => `${getX(index)},${getY(point.value)}`)
    .join(" ");

  const firstX = getX(0);
  const lastX = getX(points.length - 1);
  const zeroY = getY(0);

  const areaPath = `M ${firstX} ${zeroY} L ${linePoints} L ${lastX} ${zeroY} Z`;

  const gridValues = [
    maxValue,
    minValue + valueRange * 0.833,
    minValue + valueRange * 0.666,
    minValue + valueRange * 0.5,
    minValue + valueRange * 0.333,
    minValue + valueRange * 0.166,
    minValue,
  ];

  const formatAxisValue = (value) => {
    const abs = Math.abs(value);
    if (abs >= 1000) {
      return `${value < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}K`;
    }
    return `${value < 0 ? "-" : ""}$${Math.round(abs)}`;
  };

  const formatDate = (date) => {
    const [, month, day] = String(date).slice(0, 10).split("-");
    return `${day}/${month}`;
  };

  const maxVisibleLabels = 8;
  const labelStep =
    points.length <= maxVisibleLabels
      ? 1
      : Math.ceil((points.length - 1) / (maxVisibleLabels - 1));

  const labelIndexes = [];
  for (let i = 0; i < points.length; i += labelStep) {
    labelIndexes.push(i);
  }

  if (labelIndexes[labelIndexes.length - 1] !== points.length - 1) {
    labelIndexes.push(points.length - 1);
  }

  const currentValue = points[points.length - 1]?.value ?? 0;

  return (
    <svg
      className="td-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="tdArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(73,196,145,.42)" />
          <stop offset="100%" stopColor="rgba(73,196,145,0)" />
        </linearGradient>
      </defs>

      <text className="td-current-pnl" x={width - padRight} y={14} textAnchor="end">
        {formatMoney(currentValue)}
      </text>

      <g className="td-grid">
        {gridValues.map((value, index) => {
          const y = padTop + (index / (gridValues.length - 1)) * chartHeight;
          return (
            <line
              key={index}
              x1={padLeft}
              y1={y}
              x2={width - padRight}
              y2={y}
            />
          );
        })}
      </g>

      {zeroY >= padTop && zeroY <= padTop + chartHeight && (
        <line
          className="td-zero-line"
          x1={padLeft}
          y1={zeroY}
          x2={width - padRight}
          y2={zeroY}
        />
      )}

      <path className="td-area" d={areaPath} />
      <polyline className="td-line" points={linePoints} fill="none" />

      <circle
        className="td-chart-dot"
        cx={lastX}
        cy={getY(points[points.length - 1].value)}
        r="3.5"
      />

      {gridValues.map((value, index) => {
        const y = padTop + (index / (gridValues.length - 1)) * chartHeight;
        return (
          <text key={`y-${index}`} x="8" y={y + 4}>
            {formatAxisValue(value)}
          </text>
        );
      })}

      {labelIndexes.map((index) => {
        const point = points[index];
        return (
          <text
            key={`x-${index}`}
            x={getX(index)}
            y={height - 4}
            textAnchor="middle"
          >
            {formatDate(point.date)}
          </text>
        );
      })}
    </svg>
  );
}

export default React.memo(PnlChart);

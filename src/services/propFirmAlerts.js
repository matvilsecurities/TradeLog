const n = (v, fallback = null) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export const ALERT_THRESHOLDS = {
  dailyLoss: [75, 90, 100],
  drawdown: [75, 90, 100],
  consistency: [80, 90, 100],
  profitTarget: [80, 100],
};

const money = (v) => Number.isFinite(Number(v)) ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";

function thresholdKey(prefix, pct) {
  return `${prefix}-${pct}`;
}

function thresholdAlerts({ valuePct, thresholds, prefix, label, detailFor }) {
  if (!Number.isFinite(valuePct)) return [];
  return thresholds.filter((threshold) => valuePct >= threshold).map((threshold) => ({
    key: thresholdKey(prefix, threshold),
    severity: threshold >= 100 ? "critical" : threshold >= 90 ? "warning" : "notice",
    title: `${label} at ${threshold}%`,
    detail: detailFor(threshold),
  }));
}

export function buildComplianceAlerts(compliance, now = new Date()) {
  if (!compliance?.hasRules) return [];
  const alerts = [];
  const accountKey = `${compliance.firm || "firm"}:${compliance.program || "program"}`;
  const dateKey = compliance.today || now.toISOString().slice(0, 10);

  if (compliance.hardViolations?.length) {
    compliance.hardViolations.forEach((item) => alerts.push({
      key: `hard-${item.key}`,
      severity: "critical",
      title: `Rule breach: ${item.rule}`,
      detail: item.detail,
    }));
  }

  const dailyLimit = n(compliance.dailyLossLimit);
  if (dailyLimit > 0) {
    const usedPct = Math.max(0, compliance.dailyLossUsed / dailyLimit * 100);
    alerts.push(...thresholdAlerts({
      valuePct: usedPct,
      thresholds: ALERT_THRESHOLDS.dailyLoss,
      prefix: "daily-loss",
      label: "Daily loss",
      detailFor: (threshold) => threshold >= 100
        ? `Daily loss has reached ${money(dailyLimit)}.`
        : `Daily loss usage is ${usedPct.toFixed(1)}% (${money(compliance.dailyLossUsed)} of ${money(dailyLimit)}).`,
    }));
  }

  const ddLimit = n(compliance.drawdownLimit);
  if (ddLimit > 0) {
    const usedPct = Math.max(0, compliance.currentDrawdown / ddLimit * 100);
    alerts.push(...thresholdAlerts({
      valuePct: usedPct,
      thresholds: ALERT_THRESHOLDS.drawdown,
      prefix: "drawdown",
      label: "Drawdown",
      detailFor: (threshold) => threshold >= 100
        ? `Drawdown has reached ${money(ddLimit)}.`
        : `Drawdown usage is ${usedPct.toFixed(1)}% (${money(compliance.currentDrawdown)} of ${money(ddLimit)}).`,
    }));
  }

  const consistencyLimit = n(compliance.rules?.consistencyRule);
  if (consistencyLimit > 0) {
    const usedPct = Math.max(0, compliance.consistencyPct / consistencyLimit * 100);
    alerts.push(...thresholdAlerts({
      valuePct: usedPct,
      thresholds: ALERT_THRESHOLDS.consistency,
      prefix: "consistency",
      label: "Consistency",
      detailFor: (threshold) => threshold >= 100
        ? `Best-day concentration is ${compliance.consistencyPct.toFixed(1)}%, at or above the ${consistencyLimit}% rule.`
        : `Best-day concentration is ${compliance.consistencyPct.toFixed(1)}% against the ${consistencyLimit}% limit.`,
    }));
  }

  if (Number.isFinite(compliance.profitProgress)) {
    alerts.push(...thresholdAlerts({
      valuePct: compliance.profitProgress,
      thresholds: ALERT_THRESHOLDS.profitTarget,
      prefix: "profit-target",
      label: "Profit target",
      detailFor: (threshold) => threshold >= 100
        ? `Profit target reached: ${money(compliance.target)}.`
        : `Profit target progress is ${compliance.profitProgress.toFixed(1)}%.`,
    }));
  }

  if (compliance.rules?.minTradingDays != null && compliance.tradingDays >= compliance.rules.minTradingDays) {
    alerts.push({ key: "trading-days-met", severity: "notice", title: "Minimum trading days met", detail: `${compliance.tradingDays} qualifying trading days recorded.` });
  }
  if (compliance.rules?.minProfitableDays != null && compliance.profitableDays >= compliance.rules.minProfitableDays) {
    alerts.push({ key: "profitable-days-met", severity: "notice", title: "Minimum profitable days met", detail: `${compliance.profitableDays} qualifying profitable days recorded.` });
  }

  return alerts.map((alert) => ({
    ...alert,
    id: `${accountKey}|${dateKey}|${alert.key}`,
    accountKey,
    date: dateKey,
    createdAt: now.toISOString(),
  }));
}

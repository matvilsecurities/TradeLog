import { useMemo } from "react";

export function useLiveComplianceMonitor({ compliance = {}, trades = [], settings = {}, latestPosition = null } = {}) {
  return useMemo(() => {
    const alerts = [];
    const dailyLimit = Number(settings.dailyLossLimit || compliance.dailyLossLimit || 0);
    const dailyUsed = Number(compliance.dailyLossUsed || 0);
    const drawdown = Number(compliance.currentDrawdown || 0);
    const maxDrawdown = Number(settings.maxDrawdown || compliance.maxDrawdown || 0);
    const perTradeRisk = Number(settings.perTradeRiskLimit || compliance.perTradeRiskLimit || 0);

    if (dailyLimit > 0 && dailyUsed >= dailyLimit) alerts.push({ severity: "critical", code: "DAILY_LOSS_LIMIT", message: "Daily loss limit reached." });
    else if (dailyLimit > 0 && dailyUsed >= dailyLimit * 0.8) alerts.push({ severity: "warning", code: "DAILY_LOSS_WARNING", message: "Daily loss usage is at or above 80%." });
    if (maxDrawdown > 0 && drawdown >= maxDrawdown) alerts.push({ severity: "critical", code: "MAX_DRAWDOWN", message: "Maximum drawdown threshold reached." });
    else if (maxDrawdown > 0 && drawdown >= maxDrawdown * 0.8) alerts.push({ severity: "warning", code: "DRAWDOWN_WARNING", message: "Drawdown is at or above 80% of the configured limit." });
    if (latestPosition?.risk != null && perTradeRisk > 0 && Math.abs(Number(latestPosition.risk)) > perTradeRisk) alerts.push({ severity: "warning", code: "POSITION_RISK", message: "Latest position risk exceeds the configured per-trade limit." });

    return { alerts, critical: alerts.filter((a) => a.severity === "critical").length, warnings: alerts.filter((a) => a.severity === "warning").length, monitoredTrades: trades.length, status: alerts.some((a) => a.severity === "critical") ? "critical" : alerts.length ? "warning" : "clear" };
  }, [compliance, latestPosition, settings, trades.length]);
}

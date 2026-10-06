import { compareTradesChronologically } from "../services/propFirmCompliance.js";
import { useMemo } from "react";
import { toLocalISODate } from "../constants.js";
import { calculatePropFirmCompliance } from "../services/propFirmCompliance.js";

const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function useAccountCenter(trades = [], settings = {}) {
  return useMemo(() => {
    const accountSize = n(settings.accountSize, 0);
    const maxDrawdown = n(settings.maxDrawdown, 0);
    const dailyLossLimit = n(settings.dailyLossLimit, 0);
    const perTradeRiskLimit = n(settings.perTradeRiskLimit, 0);
    const initialProfit = n(settings.initialProfit ?? settings.unloggedProfitOffset, 0);
    const profitTarget = n(settings.profitTarget, 0);
    const minTradingDays = n(settings.minTradingDays, 0);
    const minProfitableDays = n(settings.minProfitableDays, 0);
    const minDailyProfit = n(settings.minDailyProfit, 0);
    const minEquityForPayout = n(settings.minEquityForPayout, 0);
    const minPayout = n(settings.minPayout, 0);
    const consistencyRule = n(settings.consistencyRule, 40);

    const sorted = [...trades].filter(Boolean).sort((a, b) => compareTradesChronologically(a, b));
    const pnlOf = (trade) => n(trade.pnl ?? trade.profit_loss, 0);
    let equity = accountSize + initialProfit;
    let highWaterMark = equity;
    const equityCurve = sorted.map((trade) => {
      equity += pnlOf(trade);
      highWaterMark = Math.max(highWaterMark, equity);
      return { date: trade.date || trade.trade_date || "", equity, drawdownFloor: highWaterMark - maxDrawdown };
    });

    const loggedPnl = trades.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const currentEquity = accountSize + initialProfit + loggedPnl;
    const compliance = calculatePropFirmCompliance(trades, settings);
    // Keep Account Center aligned with the compliance engine. For intraday-trailing
    // accounts this includes favorable intratrade excursions captured in Log Trade,
    // rather than only realized closing equity.
    highWaterMark = Number.isFinite(Number(compliance?.highWaterMark))
      ? Number(compliance.highWaterMark)
      : (equityCurve.length ? Math.max(...equityCurve.map((point) => point.equity), accountSize + initialProfit) : accountSize + initialProfit);
    const effectiveDrawdown = Number.isFinite(Number(compliance?.drawdownLimit)) ? Number(compliance.drawdownLimit) : maxDrawdown;
    const availableDrawdown = Math.max(highWaterMark - effectiveDrawdown - currentEquity, 0);
    const currentDrawdown = Number.isFinite(Number(compliance?.currentDrawdown))
      ? Number(compliance.currentDrawdown)
      : Math.max(highWaterMark - currentEquity, 0);
    const today = toLocalISODate();
    const todayTrades = trades.filter((trade) => (trade.date || trade.trade_date) === today);
    const todayPnl = todayTrades.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const dailyLossUsed = Math.abs(Math.min(todayPnl, 0));
    const dailyLossRemaining = Math.max(dailyLossLimit - dailyLossUsed, 0);

    const dayPnls = {};
    trades.forEach((trade) => {
      const date = trade.date || trade.trade_date;
      if (!date) return;
      dayPnls[date] = (dayPnls[date] || 0) + pnlOf(trade);
    });
    const tradingDays = Object.keys(dayPnls).length;
    const profitableDays = Object.values(dayPnls).filter((value) => value >= minDailyProfit).length;
    const bestDayPnl = Object.values(dayPnls).length ? Math.max(...Object.values(dayPnls)) : 0;
    const totalProfit = Math.max(loggedPnl + initialProfit, 0);
    const consistencyPct = totalProfit > 0 ? (Math.max(bestDayPnl, 0) / totalProfit) * 100 : 0;

    const equityEligible = currentEquity >= minEquityForPayout;
    const tradingDaysOk = tradingDays >= minTradingDays;
    const profitableDaysOk = profitableDays >= minProfitableDays;
    const consistencyOk = consistencyPct <= consistencyRule || totalProfit <= 0;
    const safetyNet = minEquityForPayout - minPayout;
    const requestableAmount = Math.max(currentEquity - safetyNet, 0);

    const profitProgress = profitTarget > 0 ? Math.max(0, Math.min((loggedPnl / profitTarget) * 100, 100)) : 0;
    const dailyRiskPct = dailyLossLimit > 0 ? Math.min((dailyLossUsed / dailyLossLimit) * 100, 100) : 0;
    const drawdownPct = maxDrawdown > 0 ? Math.min((currentDrawdown / maxDrawdown) * 100, 100) : 0;

    return {
      accountName: settings.accountName || "Trading Account",
      platform: settings.platform || "—",
      accountSize, maxDrawdown, dailyLossLimit, perTradeRiskLimit,
      currentEquity, loggedPnl, highWaterMark, currentDrawdown, availableDrawdown,
      todayPnl, todayTrades: todayTrades.length, dailyLossUsed, dailyLossRemaining, dailyRiskPct,
      tradingDays, minTradingDays, profitableDays, minProfitableDays, minDailyProfit,
      consistencyPct, consistencyRule, consistencyOk,
      equityEligible, tradingDaysOk, profitableDaysOk,
      payoutEligible: equityEligible && tradingDaysOk && profitableDaysOk && consistencyOk,
      minEquityForPayout, minPayout, safetyNet, requestableAmount,
      profitTarget, profitProgress, profitRemaining: Math.max(profitTarget - loggedPnl, 0),
      drawdownPct, equityCurve,
    };
  }, [trades, settings]);
}

import { useMemo } from "react";
import { normalizeDateKey, parseDateKey } from "../components/dashboard/dashboardUtils";

function getPnl(trade) {
  const value = Number(trade?.pnl ?? trade?.profit ?? trade?.net_pnl);
  return Number.isFinite(value) ? value : 0;
}

function getHoldMinutes(trade) {
  const entry = trade?.time || trade?.entry_time || trade?.entryTime || trade?.entry_time_local;
  const exit = trade?.exit_time || trade?.exitTime || trade?.exit_time_local;
  if (!entry || !exit || !String(entry).includes(":") || !String(exit).includes(":")) return null;
  const [eh, em] = String(entry).split(":").map(Number);
  const [xh, xm] = String(exit).split(":").map(Number);
  if (![eh, em, xh, xm].every(Number.isFinite)) return null;
  let diff = xh * 60 + xm - (eh * 60 + em);
  if (diff < 0) diff += 24 * 60;
  return diff > 0 ? diff : null;
}

function compareTradeChronologically(a, b) {
  const dateA = parseDateKey(a?.date ?? a?.trade_date)?.getTime() ?? new Date(a?.created_at ?? 0).getTime();
  const dateB = parseDateKey(b?.date ?? b?.trade_date)?.getTime() ?? new Date(b?.created_at ?? 0).getTime();
  if (dateA !== dateB) return (Number.isFinite(dateA) ? dateA : 0) - (Number.isFinite(dateB) ? dateB : 0);
  const timeA = String(a?.time || a?.entry_time || "");
  const timeB = String(b?.time || b?.entry_time || "");
  if (timeA !== timeB) return timeA.localeCompare(timeB);
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function useDashboardStats(trades = []) {
  return useMemo(() => {
    const safeTrades = Array.isArray(trades) ? trades : [];
    let totalPnl = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;
    let breakEvenTrades = 0;
    let rrTotal = 0;
    let rrCount = 0;
    let holdTotal = 0;
    let holdCount = 0;
    const dailyPnlMap = Object.create(null);

    for (const trade of safeTrades) {
      const pnl = getPnl(trade);
      totalPnl += pnl;
      if (pnl > 0) { wins += 1; grossProfit += pnl; }
      else if (pnl < 0) { losses += 1; grossLoss += Math.abs(pnl); }
      else breakEvenTrades += 1;

      const rr = Number(trade?.rr);
      if (rr > 0) { rrTotal += rr; rrCount += 1; }
      const hold = getHoldMinutes(trade);
      if (Number.isFinite(hold) && hold > 0) { holdTotal += hold; holdCount += 1; }

      const dateKey = normalizeDateKey(trade?.date ?? trade?.trade_date);
      if (dateKey) dailyPnlMap[dateKey] = (dailyPnlMap[dateKey] || 0) + pnl;
    }

    const decisiveTrades = wins + losses;
    const avgWin = wins ? grossProfit / wins : 0;
    const avgLoss = losses ? -(grossLoss / losses) : 0;
    const avgWinLossRatio = avgWin > 0 && avgLoss < 0 ? avgWin / Math.abs(avgLoss) : null;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const winRate = decisiveTrades ? (wins / decisiveTrades) * 100 : 0;
    const avgRR = rrCount ? rrTotal / rrCount : 0;
    const avgHold = holdCount ? holdTotal / holdCount : 0;

    const orderedTrades = [...safeTrades].sort(compareTradeChronologically);

    let currentStreak = 0;
    let streakType = "";
    let bestTradeStreak = 0;
    let runningTradeStreak = 0;
    let runningTradeStreakType = "";
    for (const trade of orderedTrades) {
      const pnl = getPnl(trade);
      const type = pnl > 0 ? "win" : pnl < 0 ? "loss" : "neutral";
      if (type === "neutral") {
        runningTradeStreak = 0;
        runningTradeStreakType = "";
      } else if (type === runningTradeStreakType) {
        runningTradeStreak += 1;
      } else {
        runningTradeStreakType = type;
        runningTradeStreak = 1;
      }
      if (type !== "neutral") bestTradeStreak = Math.max(bestTradeStreak, runningTradeStreak);
    }

    for (let i = orderedTrades.length - 1; i >= 0; i -= 1) {
      const pnl = getPnl(orderedTrades[i]);
      const type = pnl > 0 ? "win" : pnl < 0 ? "loss" : "neutral";
      if (type === "neutral") break;
      if (!streakType) streakType = type;
      if (type !== streakType) break;
      currentStreak += 1;
    }

    const orderedDays = Object.keys(dailyPnlMap)
      .sort()
      .map((date) => ({ date, pnl: dailyPnlMap[date], type: dailyPnlMap[date] > 0 ? "win" : dailyPnlMap[date] < 0 ? "loss" : "neutral" }));

    let currentDayStreak = 0;
    let currentDayStreakType = "";
    for (let i = orderedDays.length - 1; i >= 0; i -= 1) {
      const type = orderedDays[i].type;
      if (type === "neutral") break;
      if (!currentDayStreakType) currentDayStreakType = type;
      if (type !== currentDayStreakType) break;
      currentDayStreak += 1;
    }

    let bestDayStreak = 0;
    let runningDayStreak = 0;
    let runningDayStreakType = "";
    for (const day of orderedDays) {
      if (day.type === "neutral") { runningDayStreak = 0; runningDayStreakType = ""; continue; }
      if (day.type === runningDayStreakType) runningDayStreak += 1;
      else { runningDayStreakType = day.type; runningDayStreak = 1; }
      bestDayStreak = Math.max(bestDayStreak, runningDayStreak);
    }

    const dailyPerformance = orderedDays.map(({ date, pnl }) => ({ date, pnl }));
    const latestTrade = orderedTrades[orderedTrades.length - 1] || null;
    const latestTradeDate = normalizeDateKey(latestTrade?.date ?? latestTrade?.trade_date);
    const latestTradeTimestamp = latestTrade
      ? latestTrade?.created_at || (latestTradeDate ? `${latestTradeDate}T${latestTrade?.time || latestTrade?.entry_time || "12:00"}` : null)
      : null;

    return {
      totalPnl, wins, losses, breakEvenTrades, avgWin, avgLoss, avgWinLossRatio,
      profitFactor, avgRR, avgHold, winRate, orderedTrades, currentStreak,
      streakType, bestTradeStreak, currentDayStreak, currentDayStreakType,
      bestDayStreak, dailyPerformance, dailyPnlMap, latestTrade, latestTradeDate,
      latestTradeTimestamp, recentTrades: [...orderedTrades].reverse().slice(0, 5),
    };
  }, [trades]);
}

export { getPnl, getHoldMinutes };

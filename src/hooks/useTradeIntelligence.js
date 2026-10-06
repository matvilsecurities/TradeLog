import { useMemo } from "react";
import { getPnl } from "./useDashboardStats.js";
import { getSetupRating } from "../constants.js";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function summarize(items) {
  const trades = items.length;
  const wins = items.filter(t => getPnl(t) > 0).length;
  const losses = items.filter(t => getPnl(t) < 0).length;
  const decisive = wins + losses;
  const pnl = items.reduce((sum, t) => sum + getPnl(t), 0);
  const avgPnl = trades ? pnl / trades : 0;
  const winRate = decisive ? wins / decisive * 100 : 0;
  return { trades, wins, losses, decisive, pnl, avgPnl, winRate };
}

function groupTrades(trades, getKey) {
  const groups = new Map();
  for (const trade of trades) {
    const key = getKey(trade) || "Unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({ key, label: key, ...summarize(items) }))
    .sort((a, b) => b.pnl - a.pnl);
}

function buildStreaks(trades) {
  const ordered = [...trades].sort((a, b) => {
    const da = `${a?.date ?? a?.trade_date ?? ""} ${a?.time ?? ""}`;
    const db = `${b?.date ?? b?.trade_date ?? ""} ${b?.time ?? ""}`;
    return da.localeCompare(db);
  });
  let currentType = null;
  let current = 0;
  let maxWin = 0;
  let maxLoss = 0;
  for (const trade of ordered) {
    const pnl = getPnl(trade);
    const type = pnl > 0 ? "win" : pnl < 0 ? "loss" : "flat";
    if (type === "flat") {
      currentType = null;
      current = 0;
      continue;
    }
    if (type === currentType) current += 1;
    else {
      currentType = type;
      current = 1;
    }
    if (type === "win") maxWin = Math.max(maxWin, current);
    if (type === "loss") maxLoss = Math.max(maxLoss, current);
  }
  return { maxWin, maxLoss };
}

export function useTradeIntelligence(trades = [], performance = null, checklist = []) {
  return useMemo(() => {
    const safeTrades = Array.isArray(trades) ? trades : [];
    const stats = performance || {};
    const totalTrades = safeTrades.length;

    const profitableDays = (stats.dailyPerformance || []).filter(day => day.pnl > 0).length;
    const losingDays = (stats.dailyPerformance || []).filter(day => day.pnl < 0).length;
    const activeDays = (stats.dailyPerformance || []).filter(day => day.trades > 0).length;
    const dayConsistency = activeDays ? profitableDays / activeDays * 100 : 0;

    const expectancyPerTrade = totalTrades ? safeNumber(stats.totalPnl) / totalTrades : 0;
    const decisiveExpectancy = stats.decisiveTrades ? safeNumber(stats.totalPnl) / stats.decisiveTrades : 0;
    const recoveryFactor = safeNumber(stats.maxDrawdown) > 0 ? safeNumber(stats.totalPnl) / safeNumber(stats.maxDrawdown) : null;

    const streaks = buildStreaks(safeTrades);

    const sessionPerformance = (stats.sessionPerformance || []).map(item => ({
      ...item,
      expectancy: item.trades ? item.pnl / item.trades : 0,
    }));
    const symbolPerformance = (stats.symbolPerformance || []).map(item => ({
      ...item,
      expectancy: item.trades ? item.pnl / item.trades : 0,
    }));
    const setupPerformance = (stats.setupPerformance || []).map(item => ({
      ...item,
      expectancy: item.trades ? item.pnl / item.trades : 0,
    }));
    const directionPerformance = (stats.directionPerformance || []).map(item => ({
      ...item,
      expectancy: item.trades ? item.pnl / item.trades : 0,
    }));

    const gradePerformance = (stats.gradePerformance || []).map(item => ({
      ...item,
      expectancy: item.trades ? item.pnl / item.trades : 0,
    }));

    const edgeMatrix = [];
    const sessions = [...new Set(safeTrades.map(t => t?.session || "Unknown"))];
    const setups = [...new Set(safeTrades.map(t => t?.setup || "Unknown"))];
    for (const setup of setups) {
      for (const session of sessions) {
        const subset = safeTrades.filter(t => (t?.setup || "Unknown") === setup && (t?.session || "Unknown") === session);
        if (subset.length < 2) continue;
        edgeMatrix.push({ setup, session, ...summarize(subset), expectancy: summarize(subset).avgPnl });
      }
    }
    edgeMatrix.sort((a, b) => b.expectancy - a.expectancy);

    const checklistImpact = (stats.checklistPerformance || []).map(item => ({
      ...item,
      winRateDelta: item.winRateWhenChecked - item.winRateWhenUnchecked,
    })).sort((a, b) => b.winRateDelta - a.winRateDelta);

    const mistakeImpact = (stats.mistakePerformance || []).map(item => {
      const subset = safeTrades.filter(t => Array.isArray(t?.mistakes) && t.mistakes.includes(item.key));
      const summary = summarize(subset);
      return {
        ...item,
        avgPnl: summary.avgPnl,
        winRate: summary.winRate,
      };
    }).sort((a, b) => a.avgPnl - b.avgPnl);

    const highGrade = safeTrades.filter(t => ["A+", "A"].includes(getSetupRating(t?.setup_checklist).grade));
    const lowGrade = safeTrades.filter(t => ["C", "D"].includes(getSetupRating(t?.setup_checklist).grade));
    const highGradeStats = summarize(highGrade);
    const lowGradeStats = summarize(lowGrade);

    const newsChecked = safeTrades.filter(t => t?.setup_checklist?.news_checked);
    const newsNotChecked = safeTrades.filter(t => !t?.setup_checklist?.news_checked);
    const newsComparison = {
      checked: summarize(newsChecked),
      notChecked: summarize(newsNotChecked),
    };

    const candidates = [
      ...sessionPerformance.filter(x => x.trades >= 3).map(x => ({ ...x, dimension: "Session" })),
      ...symbolPerformance.filter(x => x.trades >= 3).map(x => ({ ...x, dimension: "Symbol" })),
      ...directionPerformance.filter(x => x.trades >= 3).map(x => ({ ...x, dimension: "Direction" })),
      ...setupPerformance.filter(x => x.trades >= 3).map(x => ({ ...x, dimension: "Setup" })),
    ];
    const strongestEdge = [...candidates].sort((a, b) => b.expectancy - a.expectancy)[0] || null;
    const weakestEdge = [...candidates].sort((a, b) => a.expectancy - b.expectancy)[0] || null;
    const largestMistakeDrag = mistakeImpact.find(item => item.trades >= 2) || null;
    const strongestChecklist = checklistImpact.find(item => item.total >= 3) || null;

    const insights = [];
    if (strongestEdge) insights.push({ type: "positive", title: "Strongest repeatable edge", text: `${strongestEdge.dimension}: ${strongestEdge.label} has the highest expectancy among groups with at least 3 trades (${strongestEdge.trades} trades).` });
    if (weakestEdge && weakestEdge.expectancy < 0) insights.push({ type: "negative", title: "Largest recurring drag", text: `${weakestEdge.dimension}: ${weakestEdge.label} has negative expectancy across ${weakestEdge.trades} trades.` });
    if (largestMistakeDrag && largestMistakeDrag.avgPnl < 0) insights.push({ type: "negative", title: "Behavioral leak", text: `${largestMistakeDrag.label.split("—")[0].trim()} is associated with ${largestMistakeDrag.trades} trades and negative average P&L.` });
    if (strongestChecklist && strongestChecklist.winRateDelta > 0) insights.push({ type: "positive", title: "Checklist signal", text: `${strongestChecklist.label} shows a positive win-rate difference when checked (${Math.round(strongestChecklist.winRateDelta)} percentage points).` });
    if (highGradeStats.trades >= 3 && lowGradeStats.trades >= 3) insights.push({ type: highGradeStats.avgPnl >= lowGradeStats.avgPnl ? "positive" : "negative", title: "Setup quality signal", text: `A+/A setups average ${Math.round(highGradeStats.avgPnl)} P&L per trade versus ${Math.round(lowGradeStats.avgPnl)} for C/D setups.` });
    if (insights.length === 0 && totalTrades > 0) insights.push({ type: "neutral", title: "More data needed", text: "Trade more consistently before treating small sample groups as a durable edge." });

    return {
      expectancyPerTrade,
      decisiveExpectancy,
      recoveryFactor,
      profitableDays,
      losingDays,
      activeDays,
      dayConsistency,
      streaks,
      sessionPerformance,
      symbolPerformance,
      setupPerformance,
      directionPerformance,
      gradePerformance,
      edgeMatrix,
      checklistImpact,
      mistakeImpact,
      highGradeStats,
      lowGradeStats,
      newsComparison,
      strongestEdge,
      weakestEdge,
      insights,
    };
  }, [trades, performance, checklist]);
}

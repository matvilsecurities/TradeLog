import { useMemo } from "react";
import { getPnl, getHoldMinutes } from "./useDashboardStats.js";
import { getSetupRating, MISTAKES } from "../constants.js";

function dateKey(value) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  return Number.isFinite(d.getTime()) ? raw : null;
}

function classifyPnl(pnl) {
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "breakeven";
}

export function usePerformanceStats(trades = [], checklist = []) {
  return useMemo(() => {
    const safeTrades = Array.isArray(trades) ? trades : [];

    let totalPnl = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;
    let breakeven = 0;
    let winTotal = 0;
    let lossTotal = 0;
    let rrTotal = 0;
    let rrCount = 0;
    let holdTotal = 0;
    let holdCount = 0;

    const byDate = {};
    const byDayOfWeek = [
      { day: "Mon", pnl: 0, n: 0, wins: 0, losses: 0 },
      { day: "Tue", pnl: 0, n: 0, wins: 0, losses: 0 },
      { day: "Wed", pnl: 0, n: 0, wins: 0, losses: 0 },
      { day: "Thu", pnl: 0, n: 0, wins: 0, losses: 0 },
      { day: "Fri", pnl: 0, n: 0, wins: 0, losses: 0 },
    ];

    const bySetup = {};
    const bySymbol = {};
    const byDirection = {};
    const bySession = {};
    const byMonth = {};

    for (const trade of safeTrades) {
      const pnl = getPnl(trade);
      const result = classifyPnl(pnl);
      const date = dateKey(trade?.date ?? trade?.trade_date);

      totalPnl += pnl;

      if (result === "win") {
        wins += 1;
        winTotal += pnl;
        grossProfit += pnl;
      } else if (result === "loss") {
        losses += 1;
        lossTotal += pnl;
        grossLoss += Math.abs(pnl);
      } else {
        breakeven += 1;
      }

      const rr = Number(trade?.rr);
      if (Number.isFinite(rr) && rr > 0) {
        rrTotal += rr;
        rrCount += 1;
      }

      const hold = getHoldMinutes(trade);
      if (Number.isFinite(hold) && hold > 0) {
        holdTotal += hold;
        holdCount += 1;
      }

      if (date) {
        if (!byDate[date]) {
          byDate[date] = { date, pnl: 0, trades: 0, wins: 0, losses: 0, breakeven: 0 };
        }
        byDate[date].pnl += pnl;
        byDate[date].trades += 1;
        byDate[date][result === "win" ? "wins" : result === "loss" ? "losses" : "breakeven"] += 1;

        const weekday = new Date(`${date}T12:00:00`).getDay();
        if (weekday >= 1 && weekday <= 5) {
          const item = byDayOfWeek[weekday - 1];
          item.pnl += pnl;
          item.n += 1;
          if (result === "win") item.wins += 1;
          if (result === "loss") item.losses += 1;
        }

        const month = date.slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { month, pnl: 0, trades: 0, wins: 0, losses: 0, breakeven: 0 };
        byMonth[month].pnl += pnl;
        byMonth[month].trades += 1;
        byMonth[month][result === "win" ? "wins" : result === "loss" ? "losses" : "breakeven"] += 1;
      }

      const groups = [
        [bySetup, trade?.setup || "Unknown"],
        [bySymbol, trade?.symbol || "Unknown"],
        [byDirection, trade?.dir || "Unknown"],
        [bySession, trade?.session || "Unknown"],
      ];

      for (const [map, key] of groups) {
        if (!map[key]) map[key] = { key, label: key, pnl: 0, trades: 0, wins: 0, losses: 0, breakeven: 0 };
        map[key].pnl += pnl;
        map[key].trades += 1;
        map[key][result === "win" ? "wins" : result === "loss" ? "losses" : "breakeven"] += 1;
      }
    }

    const decisive = wins + losses;
    const winRate = decisive > 0 ? (wins / decisive) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const avgWin = wins > 0 ? winTotal / wins : 0;
    const avgLoss = losses > 0 ? lossTotal / losses : 0;
    const avgWinLossRatio = avgWin > 0 && avgLoss < 0 ? avgWin / Math.abs(avgLoss) : null;
    const avgRR = rrCount > 0 ? rrTotal / rrCount : 0;
    const avgHold = holdCount > 0 ? holdTotal / holdCount : 0;

    const ordered = [...safeTrades].sort((a, b) => {
      const da = dateKey(a?.date ?? a?.trade_date) ?? "";
      const db = dateKey(b?.date ?? b?.trade_date) ?? "";
      return da.localeCompare(db) || String(a?.time ?? "").localeCompare(String(b?.time ?? ""));
    });

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve = ordered.map((trade) => {
      equity += getPnl(trade);
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      return { date: dateKey(trade?.date ?? trade?.trade_date) || "—", equity, pnl: getPnl(trade) };
    });

    const setupPerformance = Object.values(bySetup).map(item => ({ ...item, winRate: item.trades - item.breakeven > 0 ? item.wins / (item.trades - item.breakeven) * 100 : 0 })).sort((a, b) => b.pnl - a.pnl);
    const symbolPerformance = Object.values(bySymbol).map(item => ({ ...item, winRate: item.trades - item.breakeven > 0 ? item.wins / (item.trades - item.breakeven) * 100 : 0 })).sort((a, b) => b.pnl - a.pnl);
    const directionPerformance = Object.values(byDirection).map(item => ({ ...item, winRate: item.trades - item.breakeven > 0 ? item.wins / (item.trades - item.breakeven) * 100 : 0 })).sort((a, b) => b.pnl - a.pnl);
    const sessionPerformance = Object.values(bySession).map(item => ({ ...item, winRate: item.trades - item.breakeven > 0 ? item.wins / (item.trades - item.breakeven) * 100 : 0 })).sort((a, b) => b.pnl - a.pnl);
    const monthlyPerformance = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    const dailyPerformance = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

    const checklistPerformance = checklist.map(item => {
      const withItem = safeTrades.filter(t => Boolean(t?.setup_checklist));
      const checked = withItem.filter(t => Boolean(t.setup_checklist?.[item.key]));
      const unchecked = withItem.filter(t => !t.setup_checklist?.[item.key]);
      const checkedDecisive = checked.filter(t => getPnl(t) !== 0);
      const uncheckedDecisive = unchecked.filter(t => getPnl(t) !== 0);
      return {
        ...item,
        total: withItem.length,
        checked: checked.length,
        compliance: withItem.length ? checked.length / withItem.length * 100 : 0,
        winRateWhenChecked: checkedDecisive.length ? checked.filter(t => getPnl(t) > 0).length / checkedDecisive.length * 100 : 0,
        winRateWhenUnchecked: uncheckedDecisive.length ? unchecked.filter(t => getPnl(t) > 0).length / uncheckedDecisive.length * 100 : 0,
      };
    });

    const gradePerformance = ["A+", "A", "B", "C", "D"].map(grade => {
      const subset = safeTrades.filter(t => getSetupRating(t?.setup_checklist).grade === grade);
      const gradeWins = subset.filter(t => getPnl(t) > 0).length;
      const gradeDecisive = subset.filter(t => getPnl(t) !== 0).length;
      return {
        grade,
        trades: subset.length,
        wins: gradeWins,
        losses: subset.filter(t => getPnl(t) < 0).length,
        pnl: subset.reduce((sum, t) => sum + getPnl(t), 0),
        winRate: gradeDecisive ? gradeWins / gradeDecisive * 100 : 0,
      };
    });

    const mistakePerformance = MISTAKES.map(mistake => {
      const subset = safeTrades.filter(t => Array.isArray(t?.mistakes) && t.mistakes.includes(mistake.key));
      return {
        ...mistake,
        trades: subset.length,
        pnl: subset.reduce((sum, t) => sum + getPnl(t), 0),
        lossRate: subset.length ? subset.filter(t => getPnl(t) < 0).length / subset.length * 100 : 0,
      };
    }).filter(item => item.trades > 0).sort((a, b) => b.trades - a.trades);

    return {
      totalTrades: safeTrades.length,
      totalPnl,
      wins,
      losses,
      breakeven,
      decisiveTrades: decisive,
      winRate,
      grossProfit,
      grossLoss,
      profitFactor,
      avgWin,
      avgLoss,
      avgWinLossRatio,
      avgRR,
      avgHold,
      bestTrade: safeTrades.length ? Math.max(...safeTrades.map(getPnl)) : 0,
      worstTrade: safeTrades.length ? Math.min(...safeTrades.map(getPnl)) : 0,
      maxDrawdown,
      equityCurve,
      dailyPerformance,
      dayOfWeekPerformance: byDayOfWeek,
      setupPerformance,
      symbolPerformance,
      directionPerformance,
      sessionPerformance,
      monthlyPerformance,
      checklistPerformance,
      gradePerformance,
      mistakePerformance,
    };
  }, [trades, checklist]);
}

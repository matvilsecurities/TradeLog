import { useMemo } from "react";

export function useAdvancedAccountIntelligence({ trades = [], stats = {}, compliance = {}, syncRuns = [] } = {}) {
  return useMemo(() => {
    const pnl = Number(stats.totalPnl || 0);
    const decisive = Number(stats.decisiveCount || stats.wins || 0) + Number(stats.losses || 0);
    const expectancy = Number(stats.expectancy ?? (decisive ? pnl / decisive : 0));
    const recovery = Number(compliance.currentDrawdown || 0) > 0 ? pnl / Number(compliance.currentDrawdown) : (pnl > 0 ? Infinity : 0);
    const imported = syncRuns.reduce((sum, run) => sum + Number(run.importedCount || 0), 0);
    const cleanTrades = trades.filter((trade) => !((trade.mistakes || []).length)).length;
    const cleanRate = trades.length ? (cleanTrades / trades.length) * 100 : 0;
    const processEfficiency = Math.max(0, Math.min(100, cleanRate * 0.6 + Number(stats.winRate || 0) * 0.4));
    return {
      expectancy,
      recoveryFactor: recovery,
      processEfficiency,
      cleanTradeRate: cleanRate,
      importedTrades: imported,
      dataFreshness: syncRuns[0]?.completedAt || null,
      accountHealth: expectancy >= 0 && (compliance.availableDrawdown == null || compliance.availableDrawdown >= 0) ? "stable" : "review",
    };
  }, [compliance, stats, syncRuns, trades]);
}

import { useMemo } from "react";
import { classifyTradeLifecycle, summarizeTradeLifecycle } from "../services/operations/tradeLifecycle.js";

function pnlOf(trade) {
  const value = Number(trade?.pnl ?? trade?.profitLoss ?? trade?.profit_loss ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tradeDay(trade) {
  const raw = trade?.date || trade?.trade_date || trade?.timestamp || trade?.created_at;
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? String(raw).slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useTradingOperations({ trades = [], accounts = [], activeAccountId = "primary", settings = {}, stats = {}, compliance = {}, syncRuns = [], connectorCatalog = [] } = {}) {
  return useMemo(() => {
    const safeTrades = Array.isArray(trades) ? trades : [];
    const lifecycle = summarizeTradeLifecycle(safeTrades);
    const today = todayKey();
    const todayTrades = safeTrades.filter((trade) => tradeDay(trade) === today);
    const todayPnl = todayTrades.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const dailyLimit = Number(settings.dailyLossLimit || compliance.dailyLossLimit || 0);
    const dailyLossUsed = Math.max(0, -todayPnl);
    const dailyRemaining = dailyLimit > 0 ? Math.max(0, dailyLimit - dailyLossUsed) : null;
    const drawdown = Math.max(0, Number(compliance.currentDrawdown || stats.maxDrawdown || 0));
    const maxDrawdown = Number(settings.maxDrawdown || compliance.maxDrawdown || 0);
    const drawdownRemaining = maxDrawdown > 0 ? Math.max(0, maxDrawdown - drawdown) : null;
    const openTrades = safeTrades.filter((trade) => ["open", "partially_filled"].includes(classifyTradeLifecycle(trade)));
    const openRisk = openTrades.reduce((sum, trade) => sum + Math.abs(Number(trade.riskAmount ?? trade.risk ?? 0) || 0), 0);
    const decisive = Number(stats.decisiveTrades || stats.decisiveCount || 0);
    const expectancy = Number(stats.expectancy ?? (decisive ? Number(stats.totalPnl || 0) / decisive : 0));
    const clean = safeTrades.filter((trade) => !Array.isArray(trade.mistakes) || trade.mistakes.length === 0).length;
    const cleanRate = safeTrades.length ? clean / safeTrades.length * 100 : 0;
    const portfolio = (Array.isArray(accounts) ? accounts : []).map((account) => {
      const accountTrades = safeTrades.filter((trade) => String(trade.accountId || trade.account_id || "") === String(account.id));
      const pnl = accountTrades.reduce((sum, trade) => sum + pnlOf(trade), 0);
      return { id: account.id, name: account.name, tradeCount: accountTrades.length, pnl, isActive: String(account.id) === String(activeAccountId) };
    });
    const connected = (Array.isArray(connectorCatalog) ? connectorCatalog : []).filter((item) => item.connection?.status === "connected").length;
    const latestSync = Array.isArray(syncRuns) && syncRuns.length ? syncRuns[0].completedAt || syncRuns[0].startedAt : null;
    const health = compliance.status === "critical" || dailyRemaining === 0 || drawdownRemaining === 0 ? "critical" : compliance.status === "warning" || (dailyRemaining != null && dailyLimit > 0 && dailyRemaining / dailyLimit <= 0.2) ? "warning" : "clear";
    return {
      lifecycle,
      today: { trades: todayTrades.length, pnl: todayPnl, lossUsed: dailyLossUsed, dailyLimit, dailyRemaining },
      risk: { openTrades: openTrades.length, openRisk, drawdown, maxDrawdown, drawdownRemaining, health },
      intelligence: { expectancy, winRate: Number(stats.winRate || 0), profitFactor: Number(stats.profitFactor || 0), avgRR: Number(stats.avgRR || 0), cleanRate, recoveryFactor: drawdown > 0 ? Number(stats.totalPnl || 0) / drawdown : null },
      portfolio,
      connectedConnectors: connected,
      latestSync,
      totalSyncRuns: Array.isArray(syncRuns) ? syncRuns.length : 0,
      activeAccountId,
    };
  }, [accounts, activeAccountId, compliance, connectorCatalog, settings, stats, syncRuns, trades]);
}

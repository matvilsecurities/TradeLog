import { useMemo } from "react";
import { getSymbolMultiplier } from "../components/trades/tradeUtils.js";

const finite = (v) => Number.isFinite(Number(v));

export function calculatePositionRisk({ symbol = "MNQ", dir = "Long", entry, stop, target, quantity = 1, entries = [] }) {
  const multiplier = getSymbolMultiplier(symbol);
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .map((item) => ({ price: Number(item?.price), qty: Number(item?.qty) }))
    .filter((item) => Number.isFinite(item.price) && Number.isFinite(item.qty) && item.qty > 0);

  let qty = Math.max(1, Number(quantity) || 1);
  let avgEntry = Number(entry);
  if (normalizedEntries.length) {
    const totalQty = normalizedEntries.reduce((sum, item) => sum + item.qty, 0);
    avgEntry = totalQty > 0
      ? normalizedEntries.reduce((sum, item) => sum + item.price * item.qty, 0) / totalQty
      : avgEntry;
    qty = totalQty;
  }

  const sl = Number(stop);
  const tp = Number(target);
  const stopPoints = finite(avgEntry) && finite(sl) ? (dir === "Long" ? avgEntry - sl : sl - avgEntry) : null;
  const targetPoints = finite(avgEntry) && finite(tp) ? (dir === "Long" ? tp - avgEntry : avgEntry - tp) : null;
  const risk = stopPoints != null && stopPoints > 0 ? stopPoints * qty * multiplier : null;
  const reward = targetPoints != null && targetPoints > 0 ? targetPoints * qty * multiplier : null;
  const rr = risk > 0 && reward != null ? reward / risk : null;

  return {
    multiplier,
    avgEntry: finite(avgEntry) ? avgEntry : null,
    quantity: qty,
    stopPoints: stopPoints != null && stopPoints > 0 ? stopPoints : null,
    targetPoints: targetPoints != null && targetPoints > 0 ? targetPoints : null,
    risk: risk != null ? Math.round(risk * 100) / 100 : null,
    reward: reward != null ? Math.round(reward * 100) / 100 : null,
    rr: rr != null ? Math.round(rr * 100) / 100 : null,
  };
}

export function useRiskManagement(trades = []) {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todaysTrades = (trades || []).filter((trade) => String(trade?.date || trade?.trade_date || "").slice(0, 10) === today);
    const plannedRiskToday = todaysTrades.reduce((sum, trade) => {
      const risk = Number(trade?.risk);
      return Number.isFinite(risk) && risk > 0 ? sum + risk : sum;
    }, 0);

    const riskBySymbol = {};
    for (const trade of trades || []) {
      const risk = Number(trade?.risk);
      if (!Number.isFinite(risk) || risk <= 0) continue;
      const symbol = trade?.symbol || "Unknown";
      riskBySymbol[symbol] = (riskBySymbol[symbol] || 0) + risk;
    }

    return {
      today,
      todaysTrades,
      plannedRiskToday: Math.round(plannedRiskToday * 100) / 100,
      riskBySymbol,
    };
  }, [trades]);
}

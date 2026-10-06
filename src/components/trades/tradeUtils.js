import { SYMBOLS, getSetupRating } from "../../constants.js";

export const SYMBOL_MULTIPLIERS = Object.freeze({
  MNQ: 2,
  MGC: 10,
});

export function getSymbolMultiplier(symbol) {
  return SYMBOL_MULTIPLIERS[symbol] ?? 1;
}

export function getPnl(trade) {
  const value = Number(trade?.pnl ?? trade?.profit ?? trade?.net_pnl);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Calculate the journal's account equity from the prop-firm account size and
 * realized P&L only. This is deliberately independent of journal filters and
 * does not include legacy/unlogged-profit offsets.
 */
export function calculateCurrentEquity(accounts = [], trades = [], accountId = "all") {
  const safeAccounts = Array.isArray(accounts) ? accounts.filter(Boolean) : [];
  const safeTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const selectedAccounts = accountId === "all"
    ? safeAccounts
    : safeAccounts.filter((account) => String(account?.id || "") === String(accountId));

  const accountIds = new Set(selectedAccounts.map((account) => String(account?.id || "")));
  const accountUuids = new Set(
    selectedAccounts
      .map((account) => String(account?.accountUuid || account?.uuid || ""))
      .filter(Boolean)
  );

  const accountSize = selectedAccounts.reduce((sum, account) => {
    const size = Number(
      account?.account_size
      ?? account?.settings?.accountSize
      ?? account?.settings?.account_size
      ?? 0
    );
    return sum + (Number.isFinite(size) ? size : 0);
  }, 0);

  const pnl = safeTrades.reduce((sum, trade) => {
    if (accountId !== "all") {
      const tradeAccountId = String(trade?.accountId || trade?.account_id || "");
      const tradeAccountUuid = String(trade?.accountUuid || trade?.account_uuid || "");
      if (!accountIds.has(tradeAccountId) && !accountUuids.has(tradeAccountUuid)) return sum;
    }
    return sum + getPnl(trade);
  }, 0);

  return {
    accountSize,
    pnl,
    currentEquity: accountSize + pnl,
  };
}

export function calculateTradeNumbers({
  symbol = "MNQ",
  dir = "Long",
  entry,
  exit,
  sl,
  tp,
  qty = 1,
}) {
  const e = Number(entry);
  const x = Number(exit);
  const stop = Number(sl);
  const target = Number(tp);
  const quantity = Math.max(1, Number.parseInt(qty, 10) || 1);
  const multiplier = getSymbolMultiplier(symbol);

  const validEntry = Number.isFinite(e);
  const validExit = Number.isFinite(x);
  const validStop = Number.isFinite(stop);
  const validTarget = Number.isFinite(target);

  const points = validEntry && validExit
    ? dir === "Long" ? x - e : e - x
    : null;

  const stopPoints = validEntry && validStop
    ? dir === "Long" ? e - stop : stop - e
    : null;

  const targetPoints = validEntry && validTarget
    ? dir === "Long" ? target - e : e - target
    : null;

  const pnl = points == null ? null : Math.round(points * quantity * multiplier * 100) / 100;
  const risk = stopPoints != null && stopPoints > 0
    ? Math.round(stopPoints * quantity * multiplier * 100) / 100
    : null;
  const reward = targetPoints != null && targetPoints > 0
    ? Math.round(targetPoints * quantity * multiplier * 100) / 100
    : null;
  const rr = points != null && stopPoints != null && stopPoints > 0
    ? Math.round((points / stopPoints) * 100) / 100
    : null;

  return { points, stopPoints, targetPoints, pnl, risk, reward, rr, quantity, multiplier };
}

export function validateTrade(trade) {
  const errors = {};

  if (!trade?.date) errors.date = "Trade date is required.";
  if (!trade?.time) errors.time = "Entry time is required.";
  if (!SYMBOLS.includes(trade?.symbol)) errors.symbol = "Select a valid symbol.";
  if (!["Long", "Short"].includes(trade?.dir)) errors.dir = "Select Long or Short.";

  const entry = Number(trade?.entry);
  const exit = Number(trade?.exit);
  const qty = Number(trade?.qty);
  const sl = Number(trade?.sl);
  const tp = Number(trade?.tp);

  if (!Number.isFinite(entry)) errors.entry = "Enter a valid entry price.";
  if (!Number.isFinite(exit)) errors.exit = "Enter a valid exit price.";
  if (!Number.isInteger(qty) || qty < 1) errors.qty = "Quantity must be at least 1.";

  if (Number.isFinite(entry) && Number.isFinite(sl)) {
    const stopPoints = trade.dir === "Long" ? entry - sl : sl - entry;
    if (stopPoints <= 0) errors.sl = "Stop loss must be on the risk side of entry.";
  }

  if (Number.isFinite(entry) && Number.isFinite(tp)) {
    const targetPoints = trade.dir === "Long" ? tp - entry : entry - tp;
    if (targetPoints <= 0) errors.tp = "Take profit must be on the reward side of entry.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function formatMoney(value, decimals = 2) {
  const n = Number(value) || 0;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export function getTradeNotes(trade) {
  if (Array.isArray(trade?.notes_log)) {
    return trade.notes_log.map((x) => x?.text || "").filter(Boolean).join(" ");
  }
  return String(trade?.notes || "");
}

export { getSetupRating };

export function getTradeGrade(trade) {
  if (trade?.grade) return String(trade.grade);
  const score = Number(trade?.setup_score ?? trade?.grade_score);
  if (!Number.isFinite(score)) return "—";
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

export function getHoldMinutes(entry, exit) {
  if (!entry || !exit) return null;
  const a = String(entry).split(":").map(Number);
  const b = String(exit).split(":").map(Number);
  if (a.length < 2 || b.length < 2 || [...a, ...b].some((x) => !Number.isFinite(x))) return null;
  let minutes = b[0] * 60 + b[1] - (a[0] * 60 + a[1]);
  if (minutes < 0) minutes += 1440;
  return minutes > 0 ? minutes : null;
}

export function formatHoldTime(entry, exit) {
  const minutes = getHoldMinutes(entry, exit);
  if (minutes == null) return "—";
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

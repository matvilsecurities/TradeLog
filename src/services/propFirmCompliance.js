import { getPnl } from "../components/trades/tradeUtils.js";

const n = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const safeDate = (value) => String(value || "").slice(0, 10);
const safeTime = (value) => String(value || "").slice(0, 12);

// Contract metadata is centralized so compliance never compares a micro quantity
// against a full-size contract limit (the old implementation did exactly that).
export const INSTRUMENT_METADATA = Object.freeze({
  MNQ: { contractType: "micro", pointValue: 2 },
  MGC: { contractType: "micro", pointValue: 10 },
  MES: { contractType: "micro", pointValue: 5 },
  MYM: { contractType: "micro", pointValue: 0.5 },
  M2K: { contractType: "micro", pointValue: 5 },
  NQ: { contractType: "contract", pointValue: 20 },
  ES: { contractType: "contract", pointValue: 50 },
  YM: { contractType: "contract", pointValue: 5 },
  RTY: { contractType: "contract", pointValue: 50 },
  GC: { contractType: "contract", pointValue: 100 },
});

function symbolKey(symbol) {
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getInstrumentMetadata(symbol) {
  const key = symbolKey(symbol);
  if (INSTRUMENT_METADATA[key]) return INSTRUMENT_METADATA[key];
  if (/^M[A-Z0-9]+$/.test(key)) return { contractType: "micro", pointValue: 1 };
  return { contractType: "contract", pointValue: 1 };
}

function accountTimezone(settings = {}) {
  return settings?.accountTimezone || settings?.timezone || "Asia/Kolkata";
}

function tradingDateOf(trade, timezone = "Asia/Kolkata") {
  const explicit = safeDate(trade?.tradingDate || trade?.trading_date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;

  const date = trade?.eventTime || trade?.event_time || trade?.timestamp || null;
  if (date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(parsed);
    }
  }
  return safeDate(trade?.date || trade?.trade_date);
}

// Always returns a finite number so ordering is deterministic. (Previously manual trades got
// a *string* key and the comparator subtracted strings -> NaN -> no sorting at all, which made
// the high-water mark depend on fetch order, and fetch order is newest-first.)
function sortKey(trade, timezone) {
  const explicitTimestamp = trade?.eventTime || trade?.event_time || trade?.timestamp;
  if (explicitTimestamp) {
    const parsed = new Date(explicitTimestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  const date = tradingDateOf(trade, timezone);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  if (!Number.isFinite(base)) return 0;
  const m = String(trade?.time || trade?.entry_time || "").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const seconds = m ? (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
  return base + seconds * 1000;
}

export function compareTradesChronologically(a, b, timezone = "Asia/Kolkata") {
  const diff = sortKey(a, timezone) - sortKey(b, timezone);
  if (diff !== 0) return diff;
  const created = (new Date(a?.created_at || 0).getTime() || 0) - (new Date(b?.created_at || 0).getTime() || 0);
  if (created !== 0) return created;
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

function todayInTimezone(timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function intradayMeta(trade) {
  const meta = trade?.setup_checklist?.__intraday_trailing;
  return meta && typeof meta === "object" ? meta : null;
}

function isIntradayTrailing(settings = {}) {
  const type = String(settings?.propRules?.drawdownType || settings?.drawdownType || "").toLowerCase();
  return type.includes("intraday") && type.includes("trail");
}

function peakPnlForTrade(trade, enabled) {
  if (!enabled) return 0;
  const meta = intradayMeta(trade);
  if (meta?.enabled === false) return 0;
  const entry = Number(trade?.entry ?? trade?.entry_price);
  const peak = Number(meta?.peakPrice ?? meta?.peak_price);
  const qty = Math.max(1, Number.parseInt(trade?.qty ?? trade?.quantity, 10) || 1);
  if (!Number.isFinite(entry) || !Number.isFinite(peak)) return 0;
  const direction = String(trade?.dir || trade?.direction || "Long").toLowerCase();
  const favorablePoints = direction === "short" ? Math.max(0, entry - peak) : Math.max(0, peak - entry);
  return favorablePoints * qty * getInstrumentMetadata(trade?.symbol).pointValue;
}

function positiveDayStats(trades, timezone) {
  const byDate = new Map();
  for (const trade of trades) {
    const date = tradingDateOf(trade, timezone);
    if (!date) continue;
    byDate.set(date, (byDate.get(date) || 0) + getPnl(trade));
  }
  const days = [...byDate.entries()].map(([date, pnl]) => ({ date, pnl }));
  const profitableDays = days.filter((day) => day.pnl > 0);
  const totalPositiveProfit = profitableDays.reduce((sum, day) => sum + day.pnl, 0);
  const bestDayProfit = profitableDays.reduce((best, day) => Math.max(best, day.pnl), 0);
  return { days, profitableDays, totalPositiveProfit, bestDayProfit };
}

export function normalizePropRules(settings = {}) {
  const r = settings?.propRules || {};
  return {
    maxDrawdown: n(r.maxDrawdown ?? settings.maxDrawdown),
    maxLossPct: n(r.maxLossPct),
    dailyLossLimit: n(r.dailyLossLimit ?? settings.dailyLossLimit),
    maxDailyLossPct: n(r.maxDailyLossPct),
    maxContracts: n(r.maxContracts),
    maxMicros: n(r.maxMicros),
    consistencyRule: n(r.consistencyRule ?? settings.consistencyRule),
    profitTarget: n(r.profitTarget ?? settings.profitTarget),
    profitTargetPct: n(r.profitTargetPct),
    minTradingDays: n(r.minTradingDays ?? settings.minTradingDays),
    minProfitableDays: n(r.minProfitableDays ?? settings.minProfitableDays),
    minDailyProfit: n(r.minDailyProfit ?? settings.minDailyProfit),
    minEquityForPayout: n(r.minEquityForPayout ?? settings.minEquityForPayout),
    minPayout: n(r.minPayout ?? settings.minPayout),
    drawdownType: r.drawdownType || settings.drawdownType || null,
    source: settings.propRulesSource || r.source || null,
    verifiedAt: settings.propRulesVerifiedAt || r.verifiedAt || null,
    version: settings.propRulesVersion || r.version || null,
  };
}

export function calculateEquityState(trades, settings) {
  const accountSize = n(settings.accountSize, 0) || 0;
  const initialProfit = n(settings.initialProfit ?? settings.unloggedProfitOffset, 0) || 0;
  const timezone = accountTimezone(settings);
  let equity = accountSize + initialProfit;
  let highWaterMark = equity;
  let peakIntradayPnl = 0;
  let peakEquityTradeId = null;
  const intradayTrail = isIntradayTrailing(settings);

  const ordered = [...trades].sort((a, b) => compareTradesChronologically(a, b, timezone));
  for (const trade of ordered) {
    const intradayPeak = equity + peakPnlForTrade(trade, intradayTrail);
    if (intradayPeak > highWaterMark) {
      highWaterMark = intradayPeak;
      peakIntradayPnl = peakPnlForTrade(trade, intradayTrail);
      peakEquityTradeId = trade?.id || trade?.externalTradeId || null;
    }
    equity += getPnl(trade);
    highWaterMark = Math.max(highWaterMark, equity);
  }

  return {
    accountSize,
    initialProfit,
    currentEquity: equity,
    highWaterMark,
    currentDrawdown: Math.max(0, highWaterMark - equity),
    peakIntradayPnl,
    peakEquityTradeId,
    intradayTrailing: intradayTrail,
    timezone,
  };
}

export function calculatePositionCompliance(draftTrade, rules) {
  if (!draftTrade) return { quantity: 0, contractType: null, maxContractsExceeded: false, maxMicrosExceeded: false, violation: null };
  const quantity = Math.max(0, n(draftTrade.qty ?? draftTrade.quantity, 0) || 0);
  const metadata = getInstrumentMetadata(draftTrade.symbol);
  const maxContractsExceeded = metadata.contractType === "contract" && rules.maxContracts != null && quantity > rules.maxContracts;
  const maxMicrosExceeded = metadata.contractType === "micro" && rules.maxMicros != null && quantity > rules.maxMicros;
  return {
    quantity,
    contractType: metadata.contractType,
    pointValue: metadata.pointValue,
    maxContractsExceeded,
    maxMicrosExceeded,
    violation: maxMicrosExceeded
      ? { key: "max-micros", rule: "Maximum micros", detail: `${draftTrade.symbol || "Instrument"}: ${quantity} micros exceeds the configured maximum of ${rules.maxMicros}.` }
      : maxContractsExceeded
        ? { key: "max-contracts", rule: "Maximum contracts", detail: `${draftTrade.symbol || "Instrument"}: ${quantity} contracts exceeds the configured maximum of ${rules.maxContracts}.` }
        : null,
  };
}

export function calculatePropFirmCompliance(trades = [], settings = {}, draftTrade = null) {
  const allTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const baseTrades = draftTrade?.id ? allTrades.filter((trade) => trade.id !== draftTrade.id) : allTrades;
  const rules = normalizePropRules(settings);
  const equityState = calculateEquityState(baseTrades, settings);
  const { accountSize, currentEquity, highWaterMark, currentDrawdown, peakIntradayPnl, peakEquityTradeId, intradayTrailing, timezone } = equityState;

  const drawdownLimit = rules.maxDrawdown != null ? rules.maxDrawdown : rules.maxLossPct != null ? accountSize * rules.maxLossPct / 100 : null;
  const dailyLossLimit = rules.dailyLossLimit != null ? rules.dailyLossLimit : rules.maxDailyLossPct != null ? accountSize * rules.maxDailyLossPct / 100 : null;
  const trailingThreshold = intradayTrailing && drawdownLimit != null ? highWaterMark - drawdownLimit : null;

  const today = todayInTimezone(timezone);
  const todayTrades = baseTrades.filter((trade) => tradingDateOf(trade, timezone) === today);
  const todayPnl = todayTrades.reduce((sum, trade) => sum + getPnl(trade), 0);
  const dailyLossUsed = Math.max(0, -todayPnl);
  const positionRisk = draftTrade ? Math.max(0, n(draftTrade.risk, 0) || 0) : 0;
  const projectedDailyLoss = dailyLossUsed + positionRisk;
  const projectedEquity = currentEquity - positionRisk;
  const projectedDrawdown = Math.max(0, highWaterMark - projectedEquity);

  const drawdownRemaining = drawdownLimit != null ? Math.max(0, drawdownLimit - currentDrawdown) : null;
  const dailyLossRemaining = dailyLossLimit != null ? Math.max(0, dailyLossLimit - dailyLossUsed) : null;
  const projectedDailyRemaining = dailyLossLimit != null ? dailyLossLimit - projectedDailyLoss : null;
  const projectedDrawdownRemaining = drawdownLimit != null ? drawdownLimit - projectedDrawdown : null;

  const position = calculatePositionCompliance(draftTrade, rules);
  const dailyLossExceeded = dailyLossLimit != null && projectedDailyLoss > dailyLossLimit;
  const drawdownExceeded = drawdownLimit != null && projectedDrawdown > drawdownLimit;

  const { days, profitableDays, totalPositiveProfit, bestDayProfit } = positiveDayStats(baseTrades, timezone);
  const consistencyPct = totalPositiveProfit > 0 ? (bestDayProfit / totalPositiveProfit) * 100 : 0;
  const consistencyExceeded = rules.consistencyRule != null && consistencyPct > rules.consistencyRule;
  const loggedPnl = currentEquity - accountSize - equityState.initialProfit;
  const target = rules.profitTarget != null ? rules.profitTarget : rules.profitTargetPct != null ? accountSize * rules.profitTargetPct / 100 : null;
  const profitProgress = target > 0 ? Math.max(0, Math.min(100, loggedPnl / target * 100)) : null;
  const tradingDays = days.length;
  const minTradingDaysMet = rules.minTradingDays == null || tradingDays >= rules.minTradingDays;
  const minProfitableDaysMet = rules.minProfitableDays == null || profitableDays.length >= rules.minProfitableDays;

  const hardViolations = [];
  if (dailyLossExceeded) hardViolations.push({ key: "daily-loss", rule: "Daily loss limit", detail: `Projected daily loss ${money(projectedDailyLoss)} exceeds ${money(dailyLossLimit)}.` });
  if (drawdownExceeded) hardViolations.push({ key: "drawdown", rule: "Maximum loss / drawdown", detail: `Projected drawdown ${money(projectedDrawdown)} exceeds ${money(drawdownLimit)}.` });
  if (position.violation) hardViolations.push(position.violation);

  const warnings = [];
  if (consistencyExceeded) warnings.push({ key: "consistency", rule: "Consistency", detail: `Current best-day concentration is ${consistencyPct.toFixed(1)}%, above the ${rules.consistencyRule}% rule.` });
  if (rules.minTradingDays != null && !minTradingDaysMet) warnings.push({ key: "trading-days", rule: "Minimum trading days", detail: `${tradingDays} of ${rules.minTradingDays} required trading days recorded.` });
  if (rules.minProfitableDays != null && !minProfitableDaysMet) warnings.push({ key: "profitable-days", rule: "Minimum profitable days", detail: `${profitableDays.length} of ${rules.minProfitableDays} required profitable days recorded.` });
  if (rules.minDailyProfit != null && todayPnl > 0 && todayPnl < rules.minDailyProfit) warnings.push({ key: "daily-profit", rule: "Minimum daily profit", detail: `Today's profit is ${money(todayPnl)}; ${money(rules.minDailyProfit)} is required on a qualifying day.` });
  if (!rules.version && settings.propFirmId && settings.propProgramId) warnings.push({ key: "rule-version", rule: "Rule version", detail: "This account does not have a versioned prop-firm rule snapshot." });

  return {
    firm: settings.propFirm || null,
    program: settings.propProgram || null,
    rules,
    source: rules.source,
    verifiedAt: rules.verifiedAt,
    timezone,
    accountSize,
    currentEquity,
    highWaterMark,
    intradayTrailing,
    peakIntradayPnl,
    peakEquityTradeId,
    trailingThreshold,
    currentDrawdown,
    drawdownLimit,
    drawdownRemaining,
    projectedDrawdown,
    projectedDrawdownRemaining,
    today,
    todayPnl,
    dailyLossUsed,
    dailyLossLimit,
    dailyLossRemaining,
    projectedDailyLoss,
    projectedDailyRemaining,
    positionRisk,
    positionQty: position.quantity,
    positionContractType: position.contractType,
    loggedPnl,
    target,
    profitProgress,
    tradingDays,
    profitableDays: profitableDays.length,
    consistencyPct,
    consistencyExceeded,
    hardViolations,
    warnings,
    canEnter: hardViolations.length === 0,
    hasRules: Boolean(settings.propFirmId && settings.propProgramId && settings.propRules),
  };
}

function money(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

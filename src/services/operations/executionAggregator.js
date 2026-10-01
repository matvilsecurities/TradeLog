const POINT_VALUES = { MNQ: 2, MGC: 10 };

export function createExecutionState(seed = {}) {
  return {
    version: 1,
    lots: seed.lots || {},
    journals: seed.journals || {},
    processedIds: Array.isArray(seed.processedIds) ? seed.processedIds : [],
    updatedAt: seed.updatedAt || null,
  };
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeExecution(payload = {}, envelope = {}) {
  const executionId = payload.executionId ?? payload.executionID ?? payload.id ?? payload.fillId;
  const accountId = payload.accountId ?? envelope.accountId ?? payload.account ?? "";
  const rawSymbol = String(payload.symbol ?? payload.instrument ?? payload.contract ?? "").toUpperCase();
  const symbol = rawSymbol.includes("MNQ") ? "MNQ" : rawSymbol.includes("MGC") ? "MGC" : rawSymbol || "UNKNOWN";
  const actionRaw = String(payload.action ?? payload.orderAction ?? payload.side ?? payload.orderSide ?? "").toLowerCase();
  const action = actionRaw.includes("buy") ? "Buy" : actionRaw.includes("sell") ? "Sell" : "";
  const quantity = Math.abs(number(payload.quantity ?? payload.qty ?? payload.fillQuantity) || 0);
  const price = number(payload.price ?? payload.fillPrice ?? payload.averageFillPrice);
  const timestamp = payload.time ?? payload.timestamp ?? envelope.timestamp ?? new Date().toISOString();
  return {
    executionId: executionId == null ? "" : String(executionId),
    orderId: payload.orderId == null ? "" : String(payload.orderId),
    accountId: String(accountId || ""),
    symbol,
    action,
    quantity,
    price,
    timestamp,
    raw: payload,
  };
}

function keyFor(execution) {
  return `${execution.accountId}:${execution.symbol}`;
}

function journalKey(accountId, symbol, journalId) {
  return `${accountId}:${symbol}:${journalId}`;
}

function newJournal(execution, direction) {
  const journalId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `live-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    journalId,
    tradeId: journalId,
    accountId: execution.accountId,
    externalAccountId: execution.accountId,
    connectorId: "apex-ninjatrader",
    source: "NinjaTrader Live",
    symbol: execution.symbol,
    direction,
    entryQty: 0,
    entryNotional: 0,
    exitQty: 0,
    exitNotional: 0,
    pnl: 0,
    openedAt: execution.timestamp,
    closedAt: null,
    status: "open",
    executionIds: [],
  };
}

function addExecutionId(journal, executionId) {
  if (executionId && !journal.executionIds.includes(executionId)) journal.executionIds.push(executionId);
}

function pointValue(symbol) {
  return POINT_VALUES[symbol] || 1;
}

function updateJournalFromClose(journal, lot, execution, qty) {
  const direction = journal.direction;
  const pnl = (direction === "Long" ? execution.price - lot.price : lot.price - execution.price) * qty * pointValue(execution.symbol);
  journal.exitQty += qty;
  journal.exitNotional += execution.price * qty;
  journal.pnl += pnl;
  addExecutionId(journal, execution.executionId);
  const remaining = Math.max(0, journal.entryQty - journal.exitQty);
  journal.status = remaining > 0 ? "partial" : "closed";
  if (!remaining) journal.closedAt = execution.timestamp;
  return pnl;
}

function openIntoJournal(state, execution, direction) {
  const candidates = Object.values(state.journals).filter((journal) =>
    journal.accountId === execution.accountId && journal.symbol === execution.symbol && journal.direction === direction && journal.status !== "closed"
  );
  const journal = candidates.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt))[0] || newJournal(execution, direction);
  const id = journalKey(execution.accountId, execution.symbol, journal.journalId);
  if (!state.journals[id]) state.journals[id] = journal;
  journal.entryQty += execution.quantity;
  journal.entryNotional += execution.price * execution.quantity;
  addExecutionId(journal, execution.executionId);
  journal.status = journal.exitQty > 0 ? "partial" : "open";
  return journal;
}

export function applyExecution(previousState, executionInput) {
  const state = createExecutionState(previousState);
  const execution = executionInput?.executionId ? executionInput : normalizeExecution(executionInput);
  if (!execution.executionId || !execution.accountId || !execution.symbol || execution.quantity <= 0 || execution.price == null) {
    return { state, accepted: false, reason: "Execution is missing account, execution ID, quantity, or price.", changes: [] };
  }
  if (!execution.action) return { state, accepted: false, reason: "Execution action is unavailable; event retained as unresolved.", changes: [] };
  if (state.processedIds.includes(execution.executionId)) return { state, accepted: false, duplicate: true, changes: [] };

  const key = keyFor(execution);
  const lots = state.lots[key] || [];
  let remaining = execution.quantity;
  const changes = [];
  const closingSide = execution.action === "Buy" ? "Short" : "Long";

  while (remaining > 0 && lots.length && lots[0].direction === closingSide) {
    const lot = lots[0];
    const closeQty = Math.min(remaining, lot.remainingQty);
    const journalId = journalKey(execution.accountId, execution.symbol, lot.journalId);
    const journal = state.journals[journalId];
    if (!journal) break;
    updateJournalFromClose(journal, lot, execution, closeQty);
    lot.remainingQty -= closeQty;
    remaining -= closeQty;
    changes.push({ journalId: journal.tradeId, journal: { ...journal, executionIds: [...journal.executionIds] } });
    if (lot.remainingQty <= 0) lots.shift();
  }

  if (remaining > 0) {
    const direction = execution.action === "Buy" ? "Long" : "Short";
    const journal = openIntoJournal(state, { ...execution, quantity: remaining }, direction);
    lots.push({
      journalId: journal.journalId,
      direction,
      remainingQty: remaining,
      price: execution.price,
      timestamp: execution.timestamp,
      executionId: execution.executionId,
    });
    changes.push({ journalId: journal.tradeId, journal: { ...journal, executionIds: [...journal.executionIds] } });
  }

  state.lots[key] = lots;
  state.processedIds = [...state.processedIds, execution.executionId].slice(-5000);
  state.updatedAt = execution.timestamp;
  return { state, accepted: true, duplicate: false, execution, changes };
}

export function journalToTrade(journal) {
  const entry = journal.entryQty ? journal.entryNotional / journal.entryQty : null;
  const exit = journal.exitQty ? journal.exitNotional / journal.exitQty : null;
  const remaining = Math.max(0, journal.entryQty - journal.exitQty);
  return {
    id: journal.tradeId,
    accountId: journal.accountId,
    externalAccountId: journal.externalAccountId,
    externalTradeId: `live:${journal.connectorId}:${journal.accountId}:${journal.journalId}`,
    connectorId: journal.connectorId,
    source: journal.source,
    symbol: journal.symbol,
    dir: journal.direction,
    qty: journal.entryQty,
    entry,
    exit,
    pnl: Number(journal.pnl.toFixed(2)),
    date: String(journal.openedAt || "").slice(0, 10),
    time: journal.openedAt || "",
    exit_time: journal.closedAt || "",
    status: remaining > 0 ? (journal.exitQty > 0 ? "partial" : "open") : "closed",
    captureStatus: remaining > 0 ? "live" : "finalized",
    executionIds: [...journal.executionIds],
    executionCount: journal.executionIds.length,
    liveTradeKey: journal.journalId,
  };
}

export function serializeExecutionState(state) {
  return JSON.stringify(createExecutionState(state));
}

export function deserializeExecutionState(value) {
  try { return createExecutionState(JSON.parse(value || "{}")); } catch { return createExecutionState(); }
}

export function getOpenJournalTrades(state) {
  return Object.values(createExecutionState(state).journals).filter((journal) => journal.status !== "closed").map(journalToTrade);
}

export function reconcileExecutionState(state, positions = []) {
  const expected = {};
  for (const position of Array.isArray(positions) ? positions : []) {
    const accountId = String(position.accountId || position.account || "");
    const rawSymbol = String(position.symbol || position.instrument || "").toUpperCase();
    const symbol = rawSymbol.includes("MNQ") ? "MNQ" : rawSymbol.includes("MGC") ? "MGC" : rawSymbol;
    const qty = Math.abs(Number(position.quantity || position.qty || 0));
    if (!accountId || !symbol) continue;
    expected[`${accountId}:${symbol}`] = qty;
  }
  const actual = {};
  for (const [key, lots] of Object.entries(createExecutionState(state).lots)) actual[key] = lots.reduce((sum, lot) => sum + Number(lot.remainingQty || 0), 0);
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...keys].map((key) => ({ key, expectedQty: expected[key] || 0, capturedQty: actual[key] || 0, matched: Math.abs((expected[key] || 0) - (actual[key] || 0)) < 1e-9 })).filter((item) => !item.matched || item.expectedQty > 0 || item.capturedQty > 0);
}

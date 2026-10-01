export function classifyTradeLifecycle(trade = {}) {
  const qty = Math.abs(Number(trade.qty || trade.quantity || 0));
  const entry = Number(trade.entry);
  const exit = Number(trade.exit);
  const hasEntry = Number.isFinite(entry) && entry !== 0;
  const hasExit = Number.isFinite(exit) && exit !== 0;
  const status = String(trade.status || "").toLowerCase();
  if (["open", "working", "active", "partial"].includes(status)) return status === "partial" ? "partially_filled" : "open";
  if (!hasEntry && !hasExit) return "unresolved";
  if (hasEntry && !hasExit) return "open";
  if (qty > 0 && (status.includes("partial") || trade.partial === true)) return "partially_filled";
  return "closed";
}

export function summarizeTradeLifecycle(trades = []) {
  const counts = { open: 0, partially_filled: 0, closed: 0, unresolved: 0 };
  for (const trade of Array.isArray(trades) ? trades : []) counts[classifyTradeLifecycle(trade)] += 1;
  return { ...counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
}

export function getLifecycleEvents(trade = {}) {
  const events = [];
  const push = (type, label, timestamp) => events.push({ type, label, timestamp: timestamp || trade.date || null });
  push("created", "Trade captured", trade.created_at || trade.createdAt || trade.date);
  if (trade.orderStatus || trade.externalOrderId) push("submitted", "Broker order identified", trade.orderTime || trade.time);
  if (trade.entry != null) push("filled", "Entry filled", trade.entryTime || trade.time);
  if (trade.partial || String(trade.status || "").toLowerCase().includes("partial")) push("partial", "Partial fill / exit detected", trade.exitTime || trade.exit_time);
  if (trade.exit != null) push("closed", "Exit recorded", trade.exitTime || trade.exit_time);
  return events;
}

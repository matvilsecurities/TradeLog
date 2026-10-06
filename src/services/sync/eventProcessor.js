export function normalizeConnectorEvent(event = {}) {
  return {
    eventId: String(event.eventId || event.id || `${event.connectorId || "connector"}:${event.type || "event"}:${Date.now()}`),
    connectorId: event.connectorId || "unknown",
    accountId: event.accountId || null,
    type: event.type || "trade",
    timestamp: event.timestamp || new Date().toISOString(),
    payload: event.payload ?? event.data ?? event,
  };
}

export function classifyConnectorEvent(event = {}) {
  const type = String(event.type || "").toLowerCase();
  if (type.includes("fill") || type.includes("trade")) return "trade";
  if (type.includes("position")) return "position";
  if (type.includes("order")) return "order";
  if (type.includes("account") || type.includes("balance")) return "account";
  if (type.includes("error")) return "error";
  return "system";
}

export function createEventProcessor({ onTrade, onPosition, onOrder, onAccount, onError } = {}) {
  return async (rawEvent) => {
    const event = normalizeConnectorEvent(rawEvent);
    const kind = classifyConnectorEvent(event);
    if (kind === "trade") return onTrade?.(event.payload, event);
    if (kind === "position") return onPosition?.(event.payload, event);
    if (kind === "order") return onOrder?.(event.payload, event);
    if (kind === "account") return onAccount?.(event.payload, event);
    if (kind === "error") return onError?.(event.payload, event);
    return null;
  };
}

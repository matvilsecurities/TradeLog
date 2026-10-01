const POINT_VALUES = { MNQ: 2, MGC: 10 };

export const TRADOVATE_CONNECTOR_ID = "apex-tradovate";

export function getTradovateOAuthConfig({ clientId, environment = "live", redirectUri } = {}) {
  const mode = environment === "demo" ? "demo" : "live";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirect = redirectUri || `${origin}/.netlify/functions/tradovate-oauth-callback`;
  const authorizeBase = mode === "demo" ? "https://trader-d.tradovate.com/oauth" : "https://trader.tradovate.com/oauth";
  return { mode, clientId: String(clientId || "").trim(), redirectUri: redirect, authorizeBase };
}

export function buildTradovateAuthorizeUrl(config, state) {
  if (!config.clientId) throw new Error("VITE_NT_CLIENT_ID is not configured.");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  });
  return `${config.authorizeBase}?${params.toString()}`;
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function timestampOf(fill) {
  return fill?.timestamp || (fill?.tradeDate?.year ? `${fill.tradeDate.year}-${String(fill.tradeDate.month).padStart(2, "0")}-${String(fill.tradeDate.day).padStart(2, "0")}` : "");
}

function symbolFromContract(contract = {}) {
  const name = String(contract.name || contract.symbol || contract.fullName || "").toUpperCase();
  if (name.includes("MNQ")) return "MNQ";
  if (name.includes("MGC")) return "MGC";
  return name || "UNKNOWN";
}

function pointValue(symbol) {
  return POINT_VALUES[symbol] || 1;
}

export function normalizeTradovateFills({ fills = [], orders = [], contracts = [], accountId, connectorId = TRADOVATE_CONNECTOR_ID, source = "Tradovate" } = {}) {
  const orderMap = new Map((orders || []).map((o) => [String(o.id), o]));
  const contractMap = new Map((contracts || []).map((c) => [String(c.id), c]));
  const groups = new Map();

  for (const fill of Array.isArray(fills) ? fills : []) {
    const order = orderMap.get(String(fill.orderId)) || {};
    const contract = contractMap.get(String(fill.contractId)) || {};
    const externalAccountId = order.accountId != null ? String(order.accountId) : String(accountId || "");
    if (!externalAccountId || fill.id == null) continue;
    const symbol = symbolFromContract(contract);
    const action = String(fill.action || order.action || "").toLowerCase() === "sell" ? "Sell" : "Buy";
    const row = {
      id: String(fill.id),
      orderId: String(fill.orderId ?? ""),
      accountId: externalAccountId,
      contractId: String(fill.contractId ?? ""),
      symbol,
      action,
      qty: Math.abs(numeric(fill.qty) || 0),
      price: numeric(fill.price),
      timestamp: timestampOf(fill),
      raw: fill,
    };
    if (!row.qty || row.price == null) continue;
    const key = `${externalAccountId}:${row.contractId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const trades = [];
  for (const [key, rows] of groups) {
    rows.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0) || Number(a.id) - Number(b.id));
    const open = [];
    for (const fill of rows) {
      let remaining = fill.qty;
      const signed = fill.action === "Buy" ? 1 : -1;
      while (remaining > 0 && open.length && Math.sign(open[0].signed) !== signed) {
        const lot = open[0];
        const closedQty = Math.min(remaining, Math.abs(lot.remaining));
        const symbol = fill.symbol;
        const direction = lot.signed > 0 ? "Long" : "Short";
        const pnl = (direction === "Long" ? fill.price - lot.price : lot.price - fill.price) * closedQty * pointValue(symbol);
        trades.push({
          accountId,
          externalAccountId: key.split(":")[0],
          externalTradeId: `${connectorId}:${lot.id}:${fill.id}:${closedQty}`,
          connectorId,
          source,
          symbol,
          dir: direction,
          qty: closedQty,
          entry: lot.price,
          exit: fill.price,
          pnl: Number(pnl.toFixed(2)),
          date: (lot.timestamp || fill.timestamp || "").slice(0, 10),
          time: lot.timestamp || "",
          exit_time: fill.timestamp || "",
          status: "closed",
          raw: { entryFill: lot.raw, exitFill: fill.raw },
        });
        remaining -= closedQty;
        lot.remaining -= closedQty;
        if (lot.remaining <= 0) open.shift();
      }
      if (remaining > 0) open.push({ ...fill, remaining, signed });
    }
  }

  return trades;
}

export function extractTradovatePayload(payload = {}) {
  return {
    accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
    orders: Array.isArray(payload.orders) ? payload.orders : [],
    fills: Array.isArray(payload.fills) ? payload.fills : [],
    positions: Array.isArray(payload.positions) ? payload.positions : [],
    cashBalances: Array.isArray(payload.cashBalances) ? payload.cashBalances : [],
    contracts: Array.isArray(payload.contracts) ? payload.contracts : [],
  };
}

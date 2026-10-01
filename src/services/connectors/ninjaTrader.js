import { normalizeTradovateFills } from './tradovate.js';

export const NINJATRADER_CONNECTOR_ID = 'apex-ninjatrader';

export function normalizeNinjaTraderPayload(payload = {}, accountId) {
  const source = {
    accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
    orders: Array.isArray(payload.orders) ? payload.orders : [],
    fills: Array.isArray(payload.fills) ? payload.fills : [],
    positions: Array.isArray(payload.positions) ? payload.positions : [],
    cashBalances: Array.isArray(payload.cashBalances) ? payload.cashBalances : [],
    contracts: Array.isArray(payload.contracts) ? payload.contracts : [],
  };
  const trades = normalizeTradovateFills({
    ...source,
    accountId,
    connectorId: NINJATRADER_CONNECTOR_ID,
    source: 'NinjaTrader',
  });
  return { ...source, trades };
}

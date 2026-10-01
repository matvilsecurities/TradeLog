import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildTradovateAuthorizeUrl, getTradovateOAuthConfig } from '../services/connectors/tradovate.js';
import { normalizeNinjaTraderPayload, NINJATRADER_CONNECTOR_ID } from '../services/connectors/ninjaTrader.js';

const clientId = String(import.meta.env.VITE_NT_CLIENT_ID || '').trim();
const environment = String(import.meta.env.VITE_NT_ENVIRONMENT || 'live').toLowerCase() === 'demo' ? 'demo' : 'live';

function hostFromAuth(auth, mode) {
  const hosts = auth?.apiHosts || {};
  const host = hosts[mode] || (mode === 'demo' ? 'demo.tradovateapi.com' : 'live.tradovateapi.com');
  return `https://${host}/v1`;
}

export function useNinjaTraderConnector({ accountId = null, connection = {}, updateConnection, markSync, onImportTrades }) {
  const [auth, setAuth] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [selectedExternalAccountId, setSelectedExternalAccountId] = useState(() => String(connection?.selectedExternalAccountId || ''));
  const nonceRef = useRef('');
  const popupRef = useRef(null);
  const config = useMemo(() => getTradovateOAuthConfig({ clientId, environment }), []);

  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'tradelog-tradovate-oauth') return;
      if (!data.state || data.state !== nonceRef.current) return;
      if (data.error) { setStatus('error'); setError(data.error_description || data.error); return; }
      if (!data.access_token) return;
      const next = { accessToken: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 5400) * 1000, apiHosts: data.apiHosts || null, name: data.name || 'NinjaTrader' };
      setAuth(next); setStatus('connected'); setError('');
      updateConnection(NINJATRADER_CONNECTOR_ID, { status: 'connected', accountName: next.name, environment, expiresAt: next.expiresAt, apiHosts: next.apiHosts || {} });
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [updateConnection]);

  const connect = useCallback(() => {
    setError('');
    if (!accountId) { setStatus("error"); setError("Select a TradeLog account before connecting this broker."); return; }
    if (!config.clientId) { setStatus('error'); setError('Set VITE_NT_CLIENT_ID before connecting NinjaTrader.'); return; }
    const state = `${NINJATRADER_CONNECTOR_ID}:${accountId}:${crypto.randomUUID()}`;
    nonceRef.current = state;
    const url = buildTradovateAuthorizeUrl(config, state);
    popupRef.current = window.open(url, 'tradelog-ninjatrader-oauth', 'width=520,height=760,noopener,noreferrer');
    if (!popupRef.current) { setStatus('error'); setError('Popup blocked. Allow popups for TradeLog and try again.'); }
    else setStatus('authorizing');
  }, [accountId, config]);

  useEffect(() => {
    if (connection?.selectedExternalAccountId && String(connection.selectedExternalAccountId) !== selectedExternalAccountId) setSelectedExternalAccountId(String(connection.selectedExternalAccountId));
  }, [connection?.selectedExternalAccountId, selectedExternalAccountId]);

  const disconnect = useCallback(() => {
    setAuth(null); setSnapshot(null); setStatus('disconnected'); setError('');
    updateConnection(NINJATRADER_CONNECTOR_ID, { status: 'disconnected', expiresAt: null, apiHosts: {} });
  }, [updateConnection]);

  const apiRequest = useCallback(async (path) => {
    if (!auth?.accessToken) throw new Error('NinjaTrader is not connected.');
    if (auth.expiresAt && Date.now() >= auth.expiresAt) throw new Error('NinjaTrader access token expired. Reconnect to refresh the session.');
    const base = hostFromAuth(auth, environment);
    const response = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' } });
    const text = await response.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(data?.errorText || data?.error_description || `NinjaTrader API returned HTTP ${response.status}`);
    return data;
  }, [auth]);

  const loadAccounts = useCallback(async () => {
    setError('');
    try {
      const accounts = await apiRequest('account/list');
      const list = Array.isArray(accounts) ? accounts : [];
      setAvailableAccounts(list);
      if (list.length === 1) {
        const id = String(list[0].id);
        setSelectedExternalAccountId(id);
        updateConnection(NINJATRADER_CONNECTOR_ID, { selectedExternalAccountId: id, externalAccountName: list[0].name || '' });
      }
      return list;
    } catch (err) { setError(err?.message || 'Unable to load NinjaTrader accounts.'); throw err; }
  }, [apiRequest, updateConnection]);

  useEffect(() => { if (auth?.accessToken) loadAccounts().catch(() => {}); }, [auth?.accessToken, loadAccounts]);

  const sync = useCallback(async () => {
    setError('');
    try {
      const results = await Promise.allSettled([
        apiRequest('account/list'), apiRequest('order/list'), apiRequest('fill/list'),
        apiRequest('position/list'), apiRequest('cashBalance/list'), apiRequest('contract/list'),
      ]);
      const criticalFailures = [0, 1, 2, 5].filter((index) => results[index].status === 'rejected');
      if (criticalFailures.length) throw new Error(results[criticalFailures[0]].reason?.message || 'NinjaTrader did not return all required trade data.');
      const [accounts, orders, fills, positions, cashBalances, contracts] = results.map((r) => r.status === 'fulfilled' ? r.value : []);
      const externalId = String(selectedExternalAccountId || '');
      if (Array.isArray(accounts) && accounts.length > 1 && !externalId) throw new Error('Select the NinjaTrader account to map before synchronizing trades.');
      const filteredOrders = externalId ? orders.filter((order) => String(order.accountId) === externalId) : orders;
      const filteredFills = externalId ? fills.filter((fill) => String(fill.accountId || '') === externalId || filteredOrders.some((order) => String(order.id) === String(fill.orderId))) : fills;
      const payload = { accounts, orders: filteredOrders, fills: filteredFills, positions, cashBalances, contracts };
      const normalized = normalizeNinjaTraderPayload(payload, accountId);
      const imported = await onImportTrades(normalized.trades, { source: 'NinjaTrader', connectorId: NINJATRADER_CONNECTOR_ID });
      setSnapshot({ ...payload, tradeCount: normalized.trades.length, skipped: imported.skipped || 0, syncedAt: new Date().toISOString(), partial: results.some((r) => r.status === 'rejected') });
      markSync(NINJATRADER_CONNECTOR_ID, { ok: true, count: imported.count, message: `${imported.count} completed trade${imported.count === 1 ? '' : 's'} synchronized.` });
      return { payload, normalized, imported };
    } catch (err) {
      setError(err?.message || 'NinjaTrader synchronization failed.');
      markSync(NINJATRADER_CONNECTOR_ID, { ok: false, error: err?.message, message: 'NinjaTrader sync failed.' });
      throw err;
    }
  }, [accountId, apiRequest, markSync, onImportTrades, selectedExternalAccountId]);

  return { config, auth, status, error, snapshot, availableAccounts, selectedExternalAccountId, setSelectedExternalAccountId: (id) => { const value = String(id || ''); setSelectedExternalAccountId(value); const item = availableAccounts.find((account) => String(account.id) === value); updateConnection(NINJATRADER_CONNECTOR_ID, { selectedExternalAccountId: value, externalAccountName: item?.name || '' }); }, loadAccounts, connect, disconnect, sync, connected: Boolean(auth?.accessToken) && status === 'connected' };
}

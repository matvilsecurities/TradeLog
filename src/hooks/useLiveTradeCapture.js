import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyExecution, createExecutionState, deserializeExecutionState, journalToTrade, normalizeExecution, reconcileExecutionState, serializeExecutionState } from "../services/operations/executionAggregator.js";
import { fetchTradeExecutionsDb, saveTradeExecutionDb } from "../supabase.js";

const CONNECTOR_ID = "apex-ninjatrader";
const STORAGE_PREFIX = "tradelog:live-capture:";

// Keys were previously scoped only by accountId ("primary" for almost every
// account), so on a shared browser — or simply switching which Supabase user
// is logged in on the same machine — one user's bridge URL, enabled flag, and
// cached execution ledger could leak into another user's session. Every key
// below is now namespaced by userId first.
function storageKey(userId, accountId) {
  return `${STORAGE_PREFIX}${userId || "anonymous"}:${accountId}`;
}

function readConfig(userId, accountId) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId, accountId)) || "null");
    return value || { enabled: false, bridgeUrl: "http://127.0.0.1:4815" };
  } catch { return { enabled: false, bridgeUrl: "http://127.0.0.1:4815" }; }
}

function writeConfig(userId, accountId, value) {
  try { localStorage.setItem(storageKey(userId, accountId), JSON.stringify(value)); } catch {}
}

export function useLiveTradeCapture({ accountId = null, externalAccountId = "", userId = "anonymous", persistTrade, showToast = null } = {}) {
  const [config, setConfig] = useState(() => readConfig(userId, accountId));
  const [status, setStatus] = useState("disabled");
  const [error, setError] = useState("");
  const [state, setState] = useState(() => deserializeExecutionState(localStorage.getItem(`${storageKey(userId, accountId)}:state`)));
  const [events, setEvents] = useState([]);
  const [positions, setPositions] = useState([]);
  const socketRef = useRef(null);
  const stateRef = useRef(state);
  const processingRef = useRef(new Set());

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    setConfig(readConfig(userId, accountId));
    setState(deserializeExecutionState(localStorage.getItem(`${storageKey(userId, accountId)}:state`)));
    setEvents([]); setPositions([]); setStatus("disabled"); setError("");
  }, [userId, accountId]);

  const saveState = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    try { localStorage.setItem(`${storageKey(userId, accountId)}:state`, serializeExecutionState(next)); } catch {}
  }, [userId, accountId]);

  const updateConfig = useCallback((patch) => {
    setConfig((current) => {
      const next = { ...current, ...patch };
      writeConfig(userId, accountId, next);
      return next;
    });
  }, [userId, accountId]);

  const persistExecution = useCallback(async (execution, journalTrade = null) => {
    try {
      await saveTradeExecutionDb({
        accountId,
        connectorId: CONNECTOR_ID,
        externalExecutionId: execution.executionId,
        externalOrderId: execution.orderId,
        externalAccountId: execution.accountId,
        symbol: execution.symbol,
        action: execution.action,
        quantity: execution.quantity,
        price: execution.price,
        eventTime: execution.timestamp,
        journalTradeId: journalTrade?.id || null,
        raw: execution.raw || {},
      });
      return true;
    } catch (err) {
      console.warn("Execution persistence unavailable; local execution ledger retained.", err?.message || err);
      return false;
    }
  }, [accountId]);

  const processEvent = useCallback(async (rawEvent) => {
    const type = String(rawEvent?.type || "").toLowerCase();
    const payload = rawEvent?.payload ?? rawEvent?.data ?? rawEvent;
    const eventId = String(rawEvent?.eventId || rawEvent?.id || "");
    setEvents((current) => [{ eventId, type: rawEvent?.type || type, timestamp: rawEvent?.timestamp || new Date().toISOString(), payload }, ...current].slice(0, 40));

    if (type.includes("position")) {
      setPositions((current) => {
        const next = current.filter((item) => !(String(item.accountId || "") === String(payload?.accountId || "") && String(item.symbol || "") === String(payload?.symbol || "")));
        next.push(payload || {});
        return next.slice(-50);
      });
      return;
    }
    if (!type.includes("trade") && !type.includes("fill") && !type.includes("execution")) return;

    const execution = normalizeExecution(payload, rawEvent);
    if (externalAccountId && execution.accountId && String(execution.accountId) !== String(externalAccountId)) return;
    if (!execution.executionId || processingRef.current.has(execution.executionId)) return;
    processingRef.current.add(execution.executionId);

    try {
      const result = applyExecution(stateRef.current, execution);
      if (result.duplicate || !result.accepted) return;
      const nextState = result.state;
      for (const change of result.changes) {
        const trade = journalToTrade(change.journal);
        await persistTrade(trade);
        await persistExecution(execution, trade);
      }
      saveState(nextState);
      if (showToast && result.changes.length) showToast(result.changes.some((change) => change.journal.status === "closed") ? "Live trade finalized automatically." : "Live execution captured.");
    } catch (err) {
      setError(err?.message || "Live execution capture failed.");
      if (showToast) showToast(err?.message || "Live execution capture failed.", "error");
    } finally {
      processingRef.current.delete(execution.executionId);
    }
  }, [externalAccountId, persistExecution, persistTrade, saveState, showToast]);

  useEffect(() => {
    let cancelled = false;
    if (userId === "anonymous" || !accountId) return undefined;
    fetchTradeExecutionsDb(accountId, CONNECTOR_ID, 500).then((rows) => {
      if (cancelled || !rows?.length) return;
      const local = stateRef.current;
      if (Object.keys(local.journals || {}).length > 0) {
        const merged = { ...local, processedIds: Array.from(new Set([...local.processedIds, ...rows.map((row) => String(row.external_execution_id)).filter(Boolean)])).slice(-5000) };
        saveState(merged);
        return;
      }
      let rebuilt = createExecutionState();
      [...rows].reverse().forEach((row) => {
        const execution = normalizeExecution({
          executionId: row.external_execution_id,
          orderId: row.external_order_id,
          accountId: row.external_account_id || row.account_id,
          symbol: row.symbol,
          action: row.action,
          quantity: row.quantity,
          price: row.price,
          time: row.event_time,
        });
        const result = applyExecution(rebuilt, execution);
        if (result.accepted) rebuilt = result.state;
      });
      saveState(rebuilt);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [accountId, userId, saveState]);

  useEffect(() => {
    if (!config.enabled || !config.bridgeUrl) { setStatus("disabled"); return undefined; }
    const endpoint = `${String(config.bridgeUrl).replace(/\/$/, "")}/events`;
    let socket;
    try {
      socket = new WebSocket(endpoint);
      socketRef.current = socket;
      setStatus("connecting"); setError("");
      socket.onopen = () => setStatus("connected");
      socket.onmessage = (message) => {
        try { void processEvent(JSON.parse(message.data)); } catch (err) { setError(err?.message || "Invalid bridge event."); }
      };
      socket.onerror = () => { setStatus("error"); setError("NinjaTrader bridge event stream is unavailable."); };
      socket.onclose = () => setStatus(config.enabled ? "disconnected" : "disabled");
    } catch (err) { setStatus("error"); setError(err?.message || "Unable to open live capture stream."); }
    return () => { try { socket?.close(); } catch {} socketRef.current = null; };
  }, [config.enabled, config.bridgeUrl, processEvent]);

  const reconciliation = useMemo(() => reconcileExecutionState(state, positions), [state, positions]);
  const openTrades = useMemo(() => Object.values(state.journals).filter((journal) => journal.status !== "closed").map(journalToTrade), [state]);
  const recentExecutions = useMemo(() => events.filter((event) => ["trade", "fill", "execution"].some((type) => String(event.type).toLowerCase().includes(type))), [events]);

  const testBridge = useCallback(async () => {
    try {
      const response = await fetch(`${String(config.bridgeUrl).replace(/\/$/, "")}/health`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setError(""); return true;
    } catch (err) { setError(err?.message || "Bridge health check failed."); return false; }
  }, [config.bridgeUrl]);

  const setEnabled = useCallback((enabled) => updateConfig({ enabled: Boolean(enabled) }), [updateConfig]);
  const setBridgeUrl = useCallback((bridgeUrl) => updateConfig({ bridgeUrl }), [updateConfig]);

  return {
    ...config,
    status,
    error,
    state,
    openTrades,
    recentExecutions,
    reconciliation,
    lastEventAt: events[0]?.timestamp || null,
    capturedExecutionCount: state.processedIds.length,
    setEnabled,
    setBridgeUrl,
    testBridge,
  };
}

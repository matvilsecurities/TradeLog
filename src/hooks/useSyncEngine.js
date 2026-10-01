import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSyncRun, summarizeSyncRuns, SYNC_INTERVALS } from "../services/sync/syncEngine.js";
import { saveConnectorSyncRunDb, fetchConnectorSyncRunsDb } from "../supabase.js";

const STORAGE_PREFIX = "tradelog:sync-runs:";

export function useSyncEngine({ userId = "anonymous", accountId = null, connectors = {}, onHistory = null } = {}) {
  const [runs, setRuns] = useState([]);
  const [running, setRunning] = useState(false);
  const [lastError, setLastError] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    const key = `${STORAGE_PREFIX}${userId}:${accountId}`;
    const local = (() => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } })();
    setRuns(Array.isArray(local) ? local.slice(0, 50) : []);
    if (userId !== "anonymous" && accountId) {
      fetchConnectorSyncRunsDb(accountId, 50).then((remote) => {
        if (!active || !remote?.length) return;
        setRuns(remote);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [userId, accountId]);

  const record = useCallback(async (run) => {
    setRuns((current) => {
      const next = [run, ...current.filter((item) => !(item.startedAt === run.startedAt && item.connectorId === run.connectorId))].slice(0, 50);
      try { localStorage.setItem(`${STORAGE_PREFIX}${userId}:${accountId}`, JSON.stringify(next)); } catch {}
      return next;
    });
    if (userId !== "anonymous" && accountId) {
      try { await saveConnectorSyncRunDb(run); } catch (error) { console.warn("Sync history persistence failed:", error?.message || error); }
    }
    onHistory?.(run);
  }, [accountId, onHistory, userId]);

  const syncOne = useCallback(async (connectorId, mode = "manual") => {
    const connector = connectors[connectorId];
    if (!connector?.sync) return { ok: false, message: `${connectorId} is not available.` };
    const started = performance.now();
    const startedAt = new Date().toISOString();
    setRunning(true); setLastError("");
    try {
      const result = await connector.sync();
      const imported = result?.imported || {};
      const run = buildSyncRun({ connectorId, accountId, mode, durationMs: performance.now() - started, result: { ...result, count: imported.count ?? result.count, skipped: imported.skipped ?? result.skipped, startedAt } });
      await record(run);
      return run;
    } catch (error) {
      const run = buildSyncRun({ connectorId, accountId, mode, durationMs: performance.now() - started, result: { ok: false, message: error?.message || "Sync failed", errors: [error?.message || "Sync failed"], startedAt, at: new Date().toISOString() } });
      await record(run); setLastError(run.message); return run;
    } finally { setRunning(false); }
  }, [accountId, connectors, record]);

  const syncAll = useCallback(async (mode = "manual") => {
    const ids = Object.keys(connectors).filter((id) => connectors[id]?.connected && typeof connectors[id]?.sync === "function");
    const results = [];
    for (const id of ids) results.push(await syncOne(id, mode));
    return results;
  }, [connectors, syncOne]);

  const configureAutoSync = useCallback((enabled, intervalMs = SYNC_INTERVALS.standard) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (!enabled || !intervalMs) return;

    // Two changes here matter once this is running across many concurrent
    // users/tabs rather than one local dev session:
    //  1. Skip ticks while the tab is hidden/backgrounded — a background tab
    //     has no reason to keep polling broker APIs and writing sync-run rows.
    //  2. Add up to 20% random jitter so many browser tabs that all started
    //     auto-sync around the same moment (e.g. everyone logging in after a
    //     market-open notification) don't all hit the connector/DB on the
    //     exact same clock tick.
    const jitter = intervalMs * 0.2 * Math.random();
    timerRef.current = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void syncAll("automatic");
    }, intervalMs + jitter);
  }, [syncAll]);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  return useMemo(() => ({ runs, running, lastError, summary: summarizeSyncRuns(runs), syncOne, syncAll, configureAutoSync }), [configureAutoSync, lastError, runs, running, syncAll, syncOne]);
}

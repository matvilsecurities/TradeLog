export const SYNC_INTERVALS = { manual: 0, fast: 30_000, standard: 60_000, relaxed: 300_000 };

export function normalizeSyncResult(result = {}) {
  return {
    ok: result.ok !== false,
    count: Number(result.count || result.imported || 0),
    skipped: Number(result.skipped || 0),
    errors: Array.isArray(result.errors) ? result.errors : [],
    message: result.message || (result.ok === false ? "Sync failed" : "Sync completed"),
    at: result.at || new Date().toISOString(),
  };
}

export function buildSyncRun({ connectorId, accountId, mode = "manual", result = {}, durationMs = 0 } = {}) {
  const safeAccountId = String(accountId ?? "").trim();
  if (!safeAccountId || safeAccountId === "[object Object]") throw new Error("Sync run requires an explicit TradeLog account.");
  const normalized = normalizeSyncResult(result);
  return {
    connectorId: connectorId || "unknown",
    accountId: safeAccountId,
    mode,
    status: normalized.ok ? "success" : "error",
    importedCount: normalized.count,
    skippedCount: normalized.skipped,
    errorCount: normalized.errors.length,
    message: normalized.message,
    durationMs: Number(durationMs || 0),
    startedAt: result.startedAt || normalized.at,
    completedAt: normalized.at,
  };
}

export function summarizeSyncRuns(runs = []) {
  const list = Array.isArray(runs) ? runs : [];
  return {
    total: list.length,
    successful: list.filter((r) => r.status === "success").length,
    failed: list.filter((r) => r.status === "error").length,
    imported: list.reduce((sum, r) => sum + Number(r.importedCount || 0), 0),
    skipped: list.reduce((sum, r) => sum + Number(r.skippedCount || 0), 0),
  };
}

export function isStaleSync(lastSyncAt, intervalMs = SYNC_INTERVALS.standard, now = Date.now()) {
  if (!lastSyncAt) return true;
  const timestamp = Date.parse(lastSyncAt);
  return !Number.isFinite(timestamp) || now - timestamp >= Math.max(intervalMs * 2, 120_000);
}

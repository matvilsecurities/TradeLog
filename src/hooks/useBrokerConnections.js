import { useCallback, useEffect, useMemo, useState } from "react";
import { CONNECTOR_CATALOG } from "../services/connectorRegistry.js";
import {
  deleteBrokerConnectionDb,
  fetchBrokerConnectionsDb,
  saveBrokerConnectionDb,
} from "../supabase.js";

const PREFIX = "tradelog:broker-connectors:";
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

function stripForPersistence(connection = {}) {
  const {
    accessToken,
    refreshToken,
    clientSecret,
    password,
    importedIds,
    ...safe
  } = connection;
  return safe;
}

function rowsToConnections(rows = []) {
  return rows.reduce((acc, row) => {
    acc[row.connector_id] = {
      ...(row.metadata || {}),
      connectorId: row.connector_id,
      status: row.status || "disconnected",
      persistedAt: row.updated_at || row.created_at || null,
    };
    return acc;
  }, {});
}

export function useBrokerConnections({ userId = "anonymous", accountId = null } = {}) {
  const key = `${PREFIX}${userId}:${accountId}`;
  const [connections, setConnections] = useState(() => read(key, {}));

  useEffect(() => {
    let cancelled = false;
    setConnections(read(key, {}));

    if (userId === "anonymous" || !accountId) return () => { cancelled = true; };

    fetchBrokerConnectionsDb(accountId)
      .then((rows) => {
        if (cancelled || !rows?.length) return;
        setConnections((current) => ({ ...current, ...rowsToConnections(rows) }));
      })
      .catch((error) => console.warn("Connector state restore skipped:", error?.message || error));

    return () => { cancelled = true; };
  }, [key, userId, accountId]);

  useEffect(() => write(key, connections), [key, connections]);

  const persist = useCallback(async (connectorId, connection) => {
    if (userId === "anonymous" || !accountId) return;
    try {
      await saveBrokerConnectionDb(accountId, connectorId, {
        status: connection?.status || "disconnected",
        metadata: stripForPersistence(connection),
      });
    } catch (error) {
      console.warn("Connector state persistence failed:", error?.message || error);
    }
  }, [accountId, userId]);

  const updateConnection = useCallback((connectorId, patch) => {
    setConnections((current) => {
      const nextConnection = {
        ...(current[connectorId] || {}),
        ...patch,
        connectorId,
        updatedAt: new Date().toISOString(),
      };
      void persist(connectorId, nextConnection);
      return { ...current, [connectorId]: nextConnection };
    });
  }, [persist]);

  const disconnect = useCallback((connectorId) => {
    setConnections((current) => {
      const nextConnection = {
        ...(current[connectorId] || {}),
        status: "disconnected",
        lastSyncAt: null,
        updatedAt: new Date().toISOString(),
      };
      void persist(connectorId, nextConnection);
      return { ...current, [connectorId]: nextConnection };
    });
  }, [persist]);

  const recordImportedIds = useCallback((connectorId, ids = []) => {
    // Kept for backward compatibility with Phase 23 local state. Durable dedupe
    // now uses trades.external_trade_id in Supabase.
    const safeIds = Array.from(new Set((ids || []).map(String).filter(Boolean)));
    if (!safeIds.length) return;
    setConnections((current) => {
      const previous = current[connectorId] || {};
      const merged = Array.from(new Set([...(previous.importedIds || []), ...safeIds])).slice(-2000);
      const nextConnection = { ...previous, importedIds: merged, updatedAt: new Date().toISOString() };
      void persist(connectorId, nextConnection);
      return { ...current, [connectorId]: nextConnection };
    });
  }, [persist]);

  const markSync = useCallback((connectorId, result = {}) => {
    setConnections((current) => {
      const nextConnection = {
        ...(current[connectorId] || {}),
        status: result.ok === false ? "error" : "connected",
        lastSyncAt: new Date().toISOString(),
        lastSyncCount: Number(result.count || 0),
        lastSyncMessage: result.message || (result.ok === false ? "Sync failed" : "Sync completed"),
        lastSyncError: result.error || "",
        updatedAt: new Date().toISOString(),
      };
      void persist(connectorId, nextConnection);
      return { ...current, [connectorId]: nextConnection };
    });
  }, [persist]);

  const removeConnection = useCallback((connectorId) => {
    setConnections((current) => {
      const next = { ...current };
      delete next[connectorId];
      return next;
    });
    if (userId !== "anonymous" && accountId) {
      void deleteBrokerConnectionDb(accountId, connectorId).catch((error) => {
        console.warn("Connector state deletion failed:", error?.message || error);
      });
    }
  }, [accountId, userId]);

  const catalog = useMemo(() => CONNECTOR_CATALOG.map((connector) => ({
    ...connector,
    connection: connections[connector.id] || null,
  })), [connections]);

  return {
    catalog,
    connections,
    updateConnection,
    disconnect,
    markSync,
    recordImportedIds,
    removeConnection,
  };
}

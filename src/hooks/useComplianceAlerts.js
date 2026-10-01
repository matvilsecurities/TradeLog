import { useCallback, useEffect, useMemo, useState } from "react";
import { buildComplianceAlerts } from "../services/propFirmAlerts.js";

const STORAGE_PREFIX = "tradelog:compliance-alerts:";
const SETTINGS_PREFIX = "tradelog:compliance-alert-settings:";
const DEFAULT_SETTINGS = { enabled: true, browserNotifications: false };

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* non-blocking */ }
}

export function useComplianceAlerts(compliance, userId = "anonymous") {
  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const settingsKey = `${SETTINGS_PREFIX}${userId}`;
  const [history, setHistory] = useState(() => readJson(storageKey, []));
  const [preferences, setPreferences] = useState(() => ({ ...DEFAULT_SETTINGS, ...readJson(settingsKey, {}) }));

  const liveAlerts = useMemo(() => buildComplianceAlerts(compliance), [compliance]);
  const activeAlerts = useMemo(() => liveAlerts.filter((alert) => alert.severity === "critical" || alert.severity === "warning"), [liveAlerts]);

  const acknowledge = useCallback((id) => {
    setHistory((items) => {
      const next = items.map((item) => item.id === id ? { ...item, acknowledgedAt: new Date().toISOString() } : item);
      writeJson(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    writeJson(storageKey, []);
  }, [storageKey]);

  const updatePreferences = useCallback((patch) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      writeJson(settingsKey, next);
      return next;
    });
  }, [settingsKey]);

  useEffect(() => {
    if (!preferences.enabled || !liveAlerts.length) return;
    setHistory((current) => {
      const existing = new Set(current.map((item) => item.id));
      const fresh = liveAlerts.filter((item) => !existing.has(item.id));
      if (!fresh.length) return current;
      const next = [...fresh, ...current].slice(0, 100);
      writeJson(storageKey, next);

      if (preferences.browserNotifications && "Notification" in window && Notification.permission === "granted") {
        fresh.filter((item) => item.severity !== "notice").slice(0, 3).forEach((item) => {
          new Notification(`TradeLog · ${item.title}`, { body: item.detail });
        });
      }
      return next;
    });
  }, [liveAlerts, preferences.enabled, preferences.browserNotifications, storageKey]);

  const requestBrowserNotifications = useCallback(async () => {
    if (!("Notification" in window)) return "unsupported";
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    updatePreferences({ browserNotifications: enabled });
    return permission;
  }, [updatePreferences]);

  return {
    history,
    liveAlerts,
    activeAlerts,
    preferences,
    updatePreferences,
    acknowledge,
    clearHistory,
    requestBrowserNotifications,
  };
}

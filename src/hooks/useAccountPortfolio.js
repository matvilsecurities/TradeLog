import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAccountDb,
  fetchAccountsDb,
  saveAccountDb,
  archiveAccountDb,
  deleteAccountDb,
} from "../supabase.js";

const CACHE_PREFIX = "tradelog:account-portfolio-cache:";
const ACTIVE_PREFIX = "tradelog:active-account:";

const clone = (value) => {
  if (value == null) return {};
  try { return JSON.parse(JSON.stringify(value)); } catch { return {}; }
};

const makeId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `acct-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* cache is non-critical */ }
}

function removeJson(key) {
  try { localStorage.removeItem(key); } catch { /* non-critical */ }
}

function buildPrimary(baseSettings = {}) {
  const now = new Date().toISOString();
  return {
    id: "primary",
    name: baseSettings?.accountName || "Primary Trading Account",
    status: baseSettings?.accountStatus || "active",
    stage: baseSettings?.accountStage || "evaluation",
    settings: clone(baseSettings),
    createdAt: now,
    updatedAt: now,
  };
}

export function rowToAccount(row) {
  const settings = row?.settings && typeof row.settings === "object" ? row.settings : {};
  // `accounts.account_size` is the authoritative Prop Firm starting equity.
  // Keep it both as a top-level field and inside settings so every consumer
  // (including Journal Ledger Current Equity) can resolve it immediately
  // after the first Supabase hydration.
  const accountSize = Number(row?.account_size ?? settings.accountSize ?? settings.account_size);
  const normalizedAccountSize = Number.isFinite(accountSize) ? accountSize : null;
  const hydratedSettings = {
    ...settings,
    ...(normalizedAccountSize != null ? { accountSize: normalizedAccountSize, account_size: normalizedAccountSize } : {}),
  };
  return {
    // `account_id` is the application/legacy account key. `id` is the
    // canonical UUID primary key used by trades.account_uuid. Keep both:
    // changing `id` would break the accounts upsert contract.
    id: String(row.account_id),
    uuid: row?.id ? String(row.id) : "",
    accountUuid: row?.id ? String(row.id) : "",
    name: row.name || settings.accountName || "Trading Account",
    status: row.status || settings.accountStatus || "active",
    stage: row.stage || settings.accountStage || "evaluation",
    account_size: normalizedAccountSize,
    settings: {
      ...hydratedSettings,
      accountName: hydratedSettings.accountName || row.name || "Trading Account",
      accountStatus: row.status || "active",
      accountStage: row.stage || "evaluation",
      accountTimezone: hydratedSettings.accountTimezone || row.timezone || "Asia/Kolkata",
    },
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    archivedAt: row.archived_at || null,
  };
}

function accountToDb(account) {
  const settings = clone(account?.settings || {});
  const status = String(account?.status || settings.accountStatus || "active");
  const stage = String(account?.stage || settings.accountStage || "evaluation");
  settings.accountStatus = status;
  settings.accountStage = stage;
  settings.accountName = account?.name || settings.accountName || "Trading Account";
  settings.accountTimezone = settings.accountTimezone || "Asia/Kolkata";

  const persistedAccountSize = Number(account?.account_size ?? settings.accountSize ?? settings.account_size);
  const normalizedPersistedAccountSize = Number.isFinite(persistedAccountSize) ? persistedAccountSize : null;
  if (normalizedPersistedAccountSize != null) {
    settings.accountSize = normalizedPersistedAccountSize;
    settings.account_size = normalizedPersistedAccountSize;
  }

  return {
    account_id: String(account.id),
    name: account.name || settings.accountName,
    status,
    stage,
    account_number: settings.accountId ? String(settings.accountId) : null,
    prop_firm_id: settings.propFirmId || null,
    prop_program_id: settings.propProgramId || null,
    platform: settings.platform || settings.propPlatform || null,
    market: settings.propMarket || settings.market || null,
    vendor: settings.propVendor || settings.vendor || null,
    account_size: normalizedPersistedAccountSize,
    timezone: settings.accountTimezone || "Asia/Kolkata",
    settings,
    rule_snapshot: settings.propRules ? {
      version: settings.propRulesVersion || settings.propRules?.version || null,
      source: settings.propRulesSource || settings.propRules?.source || null,
      verifiedAt: settings.propRulesVerifiedAt || settings.propRules?.verifiedAt || null,
      rules: clone(settings.propRules),
    } : null,
    archived_at: account.archivedAt || null,
    updated_at: new Date().toISOString(),
  };
}

function normalizeAccountList(accounts = []) {
  const seen = new Set();
  return (Array.isArray(accounts) ? accounts : [])
    .filter(Boolean)
    .map((account) => {
      const settings = clone(account.settings || {});
      const accountSize = Number(account?.account_size ?? settings.accountSize ?? settings.account_size);
      const normalizedAccountSize = Number.isFinite(accountSize) ? accountSize : null;
      return {
        ...account,
        id: String(account.id),
        account_size: normalizedAccountSize,
        settings: {
          ...settings,
          ...(normalizedAccountSize != null ? { accountSize: normalizedAccountSize, account_size: normalizedAccountSize } : {}),
        },
      };
    })
    .filter((account) => {
      if (!account.id || seen.has(account.id)) return false;
      seen.add(account.id);
      return true;
    });
}

export function useAccountPortfolio({ baseSettings = {}, userId = "anonymous" } = {}) {
  const authenticated = Boolean(userId && userId !== "anonymous");
  const cacheKey = `${CACHE_PREFIX}${userId}`;
  const activeKey = `${ACTIVE_PREFIX}${userId}`;

  const [accounts, setAccounts] = useState(() => [buildPrimary(baseSettings)]);
  const [activeAccountId, setActiveAccountId] = useState("primary");
  const [hydratedUserId, setHydratedUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const pendingMutationsRef = useRef(new Set());

  const persistAccount = useCallback(async (account) => {
    if (!authenticated || !account?.id) return account;
    const saved = await saveAccountDb(accountToDb(account));
    return saved ? rowToAccount(saved) : account;
  }, [authenticated]);

  useEffect(() => {
    let cancelled = false;

    if (!authenticated) {
      setAccounts([buildPrimary(baseSettings)]);
      setActiveAccountId("primary");
      setHydratedUserId(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const cached = normalizeAccountList(readJson(cacheKey, []));
    const cachedActive = readJson(activeKey, "primary");

    (async () => {
      try {
        let dbAccounts = [];
        let dbFetchError = null;
        // Supabase is the authoritative source for the account portfolio.
        // A transient 403/5xx during startup must not permanently lock the
        // session onto the old one-account browser cache, so retry once.
        for (let attempt = 0; attempt < 2 && !dbAccounts.length; attempt += 1) {
          try {
            dbAccounts = (await fetchAccountsDb()).map(rowToAccount);
            dbFetchError = null;
          } catch (error) {
            dbFetchError = error;
            if (attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }

        if (dbFetchError && !dbAccounts.length) {
          console.warn("Account database restore failed; using local cache temporarily:", dbFetchError?.message || dbFetchError);
        }

        if (!dbAccounts.length) {
          const primary = buildPrimary(baseSettings);
          dbAccounts = [primary];
          try { await createAccountDb(accountToDb(primary)); } catch (error) {
            console.warn("Primary account bootstrap failed:", error?.message || error);
          }
        }

        // Migrate legacy browser-only accounts into Supabase exactly once per ID.
        // The browser cache is never treated as authoritative after this merge.
        const dbIds = new Set(dbAccounts.map((account) => String(account.id)));
        const legacyAccounts = cached.filter((account) => account.id !== "primary" && !dbIds.has(String(account.id)));
        for (const legacy of legacyAccounts) {
          try {
            await createAccountDb(accountToDb(legacy));
            dbAccounts.push(legacy);
          } catch (error) {
            console.warn(`Legacy account ${legacy.id} could not be migrated:`, error?.message || error);
          }
        }

        // Primary account_settings remains a compatibility source for the first account.
        const primary = dbAccounts.find((account) => account.id === "primary") || buildPrimary(baseSettings);
        if (baseSettings && Object.keys(baseSettings).length) {
          const mergedPrimary = {
            ...primary,
            name: baseSettings.accountName || primary.name,
            status: baseSettings.accountStatus || primary.status || "active",
            stage: baseSettings.accountStage || primary.stage || "evaluation",
            settings: { ...primary.settings, ...clone(baseSettings) },
            updatedAt: new Date().toISOString(),
          };
          dbAccounts = dbAccounts.map((account) => account.id === "primary" ? mergedPrimary : account);
          try { await saveAccountDb(accountToDb(mergedPrimary)); } catch (error) {
            console.warn("Primary account compatibility sync failed:", error?.message || error);
          }
        }

        if (cancelled) return;
        const normalized = normalizeAccountList(dbAccounts);
        setAccounts(normalized);
        const nextActive = normalized.some((account) => account.id === String(cachedActive))
          ? String(cachedActive)
          : normalized.find((account) => account.status === "active")?.id || normalized[0]?.id || "";
        setActiveAccountId(nextActive);
        setHydratedUserId(userId);
        writeJson(cacheKey, normalized);
        writeJson(activeKey, nextActive);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, userId, cacheKey, activeKey]);

  useEffect(() => {
    if (!authenticated || hydratedUserId !== userId) return;
    writeJson(cacheKey, accounts);
  }, [accounts, authenticated, hydratedUserId, userId, cacheKey]);

  useEffect(() => {
    if (!authenticated || hydratedUserId !== userId || !activeAccountId) return;
    writeJson(activeKey, activeAccountId);
  }, [activeAccountId, activeKey, authenticated, hydratedUserId, userId]);

  useEffect(() => {
    if (!authenticated || hydratedUserId !== userId || !baseSettings || !Object.keys(baseSettings).length) return;
    setAccounts((current) => {
      const primary = current.find((account) => account.id === "primary");
      if (!primary) return current;
      const next = {
        ...primary,
        name: baseSettings.accountName || primary.name,
        status: baseSettings.accountStatus || primary.status || "active",
        stage: baseSettings.accountStage || primary.stage || "evaluation",
        settings: { ...primary.settings, ...clone(baseSettings) },
        updatedAt: new Date().toISOString(),
      };
      if (JSON.stringify(next.settings) !== JSON.stringify(primary.settings) || next.name !== primary.name) {
        void persistAccount(next).catch(() => {});
        return current.map((account) => account.id === "primary" ? next : account);
      }
      return current;
    });
  }, [baseSettings, authenticated, hydratedUserId, userId, persistAccount]);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  const activeSettings = activeAccount?.settings || baseSettings;

  // Explicitly refresh the authoritative account list from Supabase.
  // This is used by the app Refresh action and is also useful after RLS/schema
  // changes without requiring the user to clear browser storage.
  const refreshAccounts = useCallback(async () => {
    if (!authenticated || hydratedUserId !== userId) return [];
    try {
      const rows = await fetchAccountsDb();
      const dbAccounts = normalizeAccountList((rows || []).map(rowToAccount));
      if (!dbAccounts.length) return accounts;
      setAccounts(dbAccounts);
      writeJson(cacheKey, dbAccounts);
      const currentActive = activeAccountId;
      const nextActive = dbAccounts.some((account) => account.id === currentActive)
        ? currentActive
        : dbAccounts.find((account) => account.status === "active")?.id || dbAccounts[0]?.id || "";
      if (nextActive && nextActive !== currentActive) {
        setActiveAccountId(nextActive);
        writeJson(activeKey, nextActive);
      }
      return dbAccounts;
    } catch (error) {
      console.warn("Account refresh failed:", error?.message || error);
      return accounts;
    }
  }, [authenticated, hydratedUserId, userId, cacheKey, activeKey, accounts, activeAccountId]);

  const updateAccount = useCallback((accountId, patchOrSettings = {}) => {
    const id = String(accountId || "");
    const currentAccount = accounts.find((account) => String(account.id) === id);
    if (!currentAccount) return null;

    // Build the complete next row BEFORE scheduling setState. React 19 may defer
    // functional state updaters, so deriving `nextAccount` inside setAccounts and
    // persisting it immediately afterwards can race and silently skip Supabase.
    // This was the reason edits such as price paid, activation fee, Passed/Blown
    // status and account settings could appear saved in the UI but not persist.
    const explicitSettings = patchOrSettings?.settings;
    const nextSettings = explicitSettings
      ? { ...currentAccount.settings, ...clone(explicitSettings) }
      : { ...currentAccount.settings, ...clone(patchOrSettings) };
    const nextStatus = patchOrSettings?.status || nextSettings.accountStatus || currentAccount.status || "active";
    const nextStage = patchOrSettings?.stage || nextSettings.accountStage || currentAccount.stage || "evaluation";
    nextSettings.accountStatus = nextStatus;
    nextSettings.accountStage = nextStage;

    const nextAccount = {
      ...currentAccount,
      ...(explicitSettings ? patchOrSettings : {}),
      name: patchOrSettings?.accountName || patchOrSettings?.name || nextSettings.accountName || currentAccount.name,
      status: nextStatus,
      stage: nextStage,
      settings: nextSettings,
      updatedAt: new Date().toISOString(),
    };

    const mutationKey = `update:${id}`;
    if (pendingMutationsRef.current.has(mutationKey)) return currentAccount;
    pendingMutationsRef.current.add(mutationKey);
    setAccounts((current) => current.map((account) => String(account.id) === id ? nextAccount : account));
    void persistAccount(nextAccount)
      .then((serverAccount) => {
        setAccounts((current) => current.map((account) => String(account.id) === id ? serverAccount : account));
        writeJson(cacheKey, normalizeAccountList(accounts.map((account) => String(account.id) === id ? serverAccount : account)));
      })
      .catch((error) => {
        console.error("Account update failed:", error);
        setAccounts((current) => current.map((account) => String(account.id) === id ? currentAccount : account));
      })
      .finally(() => pendingMutationsRef.current.delete(mutationKey));
    return nextAccount;
  }, [accounts, persistAccount]);

  const selectAccount = useCallback((accountId) => {
    const id = String(accountId || "");
    if (!accounts.some((account) => account.id === id)) return false;
    setActiveAccountId(id);
    if (authenticated && hydratedUserId === userId) writeJson(activeKey, id);
    return true;
  }, [accounts, authenticated, hydratedUserId, userId, activeKey]);

  const createAccount = useCallback((settings = {}, options = {}) => {
    const merged = clone(options?.inheritBase === false ? settings : { ...baseSettings, ...settings });
    const requestedName = String(merged.accountName || "New Trading Account").trim();
    const normalizedName = requestedName.toLowerCase();
    const matchingCount = accounts.filter((account) => String(account.name || "").trim().toLowerCase() === normalizedName).length;
    const displayName = matchingCount === 0 ? requestedName : `${requestedName} · Account ${String(matchingCount + 1).padStart(2, "0")}`;
    merged.accountName = displayName;
    merged.accountStatus = merged.accountStatus || "active";
    merged.accountStage = merged.accountStage || "evaluation";
    merged.accountTimezone = merged.accountTimezone || "Asia/Kolkata";

    const now = new Date().toISOString();
    const account = {
      id: makeId(),
      name: displayName,
      status: merged.accountStatus,
      stage: merged.accountStage,
      settings: merged,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    const mutationKey = `create:${account.id}`;
    if (pendingMutationsRef.current.has(mutationKey)) return account;
    pendingMutationsRef.current.add(mutationKey);
    setAccounts((current) => [...current, account]);
    setActiveAccountId(account.id);
    writeJson(activeKey, account.id);
    void persistAccount(account)
      .then((serverAccount) => {
        setAccounts((current) => current.map((item) => item.id === account.id ? serverAccount : item));
        setActiveAccountId(serverAccount.id);
        writeJson(activeKey, serverAccount.id);
      })
      .catch((error) => {
        console.error("Account creation failed:", error);
        setAccounts((current) => current.filter((item) => item.id !== account.id));
        setActiveAccountId((current) => current === account.id ? "primary" : current);
        writeJson(activeKey, "primary");
      })
      .finally(() => pendingMutationsRef.current.delete(mutationKey));
    return account;
  }, [accounts, baseSettings, activeKey, persistAccount]);

  const removeAccount = useCallback(async (accountId) => {
    const id = String(accountId || "");
    if (!id || id === "primary") return false;
    const account = accounts.find((item) => item.id === id);
    if (!account) return false;
    const previousAccounts = accounts;
    const previousActive = activeAccountId;

    setAccounts((current) => current.filter((item) => item.id !== id));
    if (activeAccountId === id) {
      const fallback = accounts.find((item) => item.id !== id && item.status !== "archived");
      const nextId = fallback?.id || "primary";
      setActiveAccountId(nextId);
      writeJson(activeKey, nextId);
    }

    try {
      const removed = await deleteAccountDb(id);
      if (!removed) throw new Error("Account could not be permanently removed");
      removeJson(`${CACHE_PREFIX}${userId}`);
      return true;
    } catch (error) {
      console.error("Account permanent deletion failed:", error);
      setAccounts(previousAccounts);
      setActiveAccountId(previousActive);
      writeJson(activeKey, previousActive);
      throw error;
    }
  }, [accounts, activeAccountId, activeKey, userId]);

  const renameAccount = useCallback((accountId, name) => {
    const safeName = String(name || "").trim();
    if (!safeName) return null;
    return updateAccount(accountId, { name: safeName, accountName: safeName });
  }, [updateAccount]);

  const accountForTrade = useCallback((trade) => trade?.accountId || trade?.account_id || null, []);

  return {
    accounts,
    activeAccount,
    activeAccountId,
    activeSettings,
    loading,
    refreshAccounts,
    selectAccount,
    createAccount,
    removeAccount,
    renameAccount,
    updateAccount,
    accountForTrade,
  };
}

function tradeAccountId(trade) {
  return String(trade?.accountId || trade?.account_id || "");
}

function tradeAccountUuid(trade) {
  return String(trade?.accountUuid || trade?.account_uuid || "");
}

function normalizeAccountReference(reference) {
  if (reference && typeof reference === "object") {
    return {
      id: String(reference.id || ""),
      uuid: String(reference.accountUuid || reference.uuid || ""),
    };
  }

  return { id: String(reference || ""), uuid: "" };
}

/**
 * Resolve trades against the authoritative accounts row.
 *
 * `accounts.id` is the UUID stored in `trades.account_uuid`, while
 * `accounts.account_id` is the application/legacy identifier stored in
 * `trades.account_id`. Imported trades can therefore have different legacy
 * account_id values while still belonging to the same account UUID.
 */
export function filterTradesForAccount(trades = [], accountReference) {
  const list = Array.isArray(trades) ? trades : [];
  const { id: targetId, uuid: targetUuid } = normalizeAccountReference(accountReference);

  if (targetId === "all") return list;

  const legacyIds = new Set(targetId ? [targetId] : []);
  const targetUuids = new Set(targetUuid ? [targetUuid] : []);

  // Once a trade establishes that a legacy account_id belongs to the
  // canonical account UUID, include all trades carrying that same legacy id.
  for (const trade of list) {
    if (targetUuids.has(tradeAccountUuid(trade))) {
      legacyIds.add(tradeAccountId(trade));
    }
  }

  return list.filter((trade) => {
    const id = tradeAccountId(trade);
    const uuid = tradeAccountUuid(trade);
    return id === targetId || targetUuids.has(uuid) || legacyIds.has(id);
  });
}

export function filterTradesForAccounts(trades = [], accountReferences = []) {
  const list = Array.isArray(trades) ? trades : [];
  const references = Array.isArray(accountReferences) ? accountReferences : [accountReferences];
  const normalized = references.map(normalizeAccountReference);

  if (!normalized.length) return [];
  if (normalized.some(({ id }) => id === "all")) return list;

  const targetIds = new Set(normalized.map(({ id }) => id).filter(Boolean));
  const targetUuids = new Set(normalized.map(({ uuid }) => uuid).filter(Boolean));
  const legacyIds = new Set(targetIds);

  for (const trade of list) {
    if (targetUuids.has(tradeAccountUuid(trade))) {
      legacyIds.add(tradeAccountId(trade));
    }
  }

  return list.filter((trade) => {
    const id = tradeAccountId(trade);
    const uuid = tradeAccountUuid(trade);
    return targetIds.has(id) || targetUuids.has(uuid) || legacyIds.has(id);
  });
}

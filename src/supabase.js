import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, runtimeConfig } from "./config/runtime.js";
import { reportClientError } from "./services/telemetry.js";

const SUPABASE_URL = runtimeConfig.supabaseUrl;
const SUPABASE_ANON_KEY = runtimeConfig.supabaseAnonKey;

export const supabase =
  isSupabaseConfigured
   ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
    : null;

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) throw error;
  return data;
}

// User-scoped localStorage prefixes that must never survive a sign-out on a
// shared/public machine. Anything cached under one of these prefixes is
// cleared for the signing-out user before the Supabase session is dropped.
// (`tradelog:sync-runs:` etc. already embed the user id in the key itself;
// this sweep removes those plus any legacy/unscoped keys for this user.)
const USER_SCOPED_STORAGE_PREFIXES = [
  "tradelog:sync-runs:",
  "tradelog:live-capture:",
  "tradelog:dashboard-account:",
  "tradelog:active-account:",
  "tradelog:account-portfolio-cache:",
  "tradelog:broker-connectors:",
  "tradelog:compliance-alerts:",
  "tradelog:compliance-alert-settings:",
  "tradelog:trading-plan:",
  "tradelog:notifications:",
  "tradelog:nt8-bridge:",
];

function clearUserScopedStorage(userId) {
  if (!userId || typeof window === "undefined" || !window.localStorage) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Match either "<prefix><userId>" or "<prefix><userId>:<anything>".
      const isUserScoped = USER_SCOPED_STORAGE_PREFIXES.some(
        (prefix) => key.startsWith(prefix) && key.slice(prefix.length).split(":")[0] === userId
      );
      if (isUserScoped) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Failed to clear cached local data on sign-out:", error?.message || error);
  }
}

export async function signOut() {
  if (!supabase) return;

  // Capture the user id BEFORE invalidating the session, otherwise
  // auth.getSession()/getUser() will return null and nothing gets cleared.
  let userId = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data?.session?.user?.id || null;
  } catch {
    // Non-fatal — sign-out proceeds even if we couldn't resolve the user id.
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  clearUserScopedStorage(userId);
}

export async function getSession() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session ?? null;
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

function normalizeDbTime(value) {
  if (value == null || value === "") return null;

  // Supabase `time` columns accept HH:mm[:ss], not an ISO timestamp.
  // Keep existing time-only values unchanged.
  if (typeof value === "string") {
    const timeOnly = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnly) return `${timeOnly[1]}:${timeOnly[2]}${timeOnly[3] ? `:${timeOnly[3]}` : ""}`;

    // If an ISO timestamp carries an explicit non-UTC offset, preserve the
    // wall-clock time encoded by that source (e.g. 21:38+05:30 -> 21:38).
    // This avoids silently shifting historical broker times by the browser
    // timezone during persistence. UTC (`Z`) timestamps are converted to the
    // browser's local timezone below.
    const zonedIso = value.match(/T(\d{2}):(\d{2})(?::(\d{2}))?[+-]\d{2}:?\d{2}$/);
    if (zonedIso) return `${zonedIso[1]}:${zonedIso[2]}${zonedIso[3] ? `:${zonedIso[3]}` : ""}`;

    if (value.includes("T")) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        const hh = String(parsed.getHours()).padStart(2, "0");
        const mm = String(parsed.getMinutes()).padStart(2, "0");
        const ss = String(parsed.getSeconds()).padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
      }
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    const ss = String(value.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  return null;
}


function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

// Normalize every account reference shape at the database boundary. Older UI
// paths can provide an account object, a legacy account key, a canonical UUID,
// or a nested option/value object. Never stringify an object into "[object Object]".
function requireBusinessAccountId(accountId, label = "Account") {
  const value = String(accountId ?? "").trim();
  if (!value || value === "[object Object]") throw new Error(`${label} ID is required.`);
  return value;
}

function resolveTradeAccountReference(reference, seen = new Set()) {
  if (reference == null || reference === "") return { legacyId: "", uuid: "" };

  if (typeof reference === "string" || typeof reference === "number") {
    const value = String(reference);
    if (!value || value === "[object Object]") return { legacyId: "", uuid: "" };
    return isUuid(value) ? { legacyId: "", uuid: value } : { legacyId: value, uuid: "" };
  }

  if (typeof reference !== "object") return { legacyId: "", uuid: "" };
  if (seen.has(reference)) return { legacyId: "", uuid: "" };
  seen.add(reference);

  const uuidCandidates = [reference.accountUuid, reference.account_uuid, reference.uuid];
  const legacyCandidates = [reference.account_id, reference.accountId];
  const directId = reference.id;

  const uuid = uuidCandidates.find((value) => isUuid(value));
  const legacy = legacyCandidates.find((value) => typeof value === "string" && value && value !== "[object Object]");
  if (uuid || legacy) return { legacyId: legacy ? String(legacy) : "", uuid: uuid ? String(uuid) : "" };

  if (directId != null) {
    const resolvedId = resolveTradeAccountReference(directId, seen);
    if (resolvedId.legacyId || resolvedId.uuid) return resolvedId;
  }

  for (const nested of [reference.account, reference.value, reference.option, reference.data]) {
    const resolved = resolveTradeAccountReference(nested, seen);
    if (resolved.legacyId || resolved.uuid) return resolved;
  }

  return { legacyId: "", uuid: "" };
}

// `getSession()` reads the (auto-refreshed) session from local storage/memory
// and only touches the network when the token is actually stale, unlike
// `getUser()` which always makes a round-trip to the Auth server to revalidate
// the JWT. Every read/write helper in this file calls this on every request,
// so under concurrent load (many trades saved back-to-back, many users at
// once) this avoids doubling network round-trips for no correctness benefit —
// Postgres RLS still independently re-verifies the JWT server-side regardless
// of which client method supplied it.
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function isRetryableSupabaseError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (RETRYABLE_STATUS_CODES.has(status)) return true;
  if (status >= 400 && status < 500) return false;
  const message = String(error?.message || error || "").toLowerCase();
  return /network|fetch failed|failed to fetch|timeout|timed out|temporarily unavailable|connection reset|econnreset|502|503|504/.test(message);
}

function retryDelayMs(attempt) {
  const base = 250 * (2 ** attempt);
  return Math.min(base + Math.round(Math.random() * 125), 1500);
}

async function withSupabaseRetry(operation, { attempts = 3, label = "Supabase request" } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1 || !isRetryableSupabaseError(error)) {
        reportClientError(error, { operation: label });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
      console.warn(`${label} retry ${attempt + 1}/${attempts - 1}:`, error?.message || error);
    }
  }
  throw lastError;
}

async function getCurrentUserId() {
  if (!supabase) throw new Error("Supabase not configured");

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  const user = session?.user;
  if (!user) throw new Error("No authenticated user");
  return user.id;
}

// ─────────────────────────────────────────────────────────────
// Accounts — authoritative multi-account persistence
// ─────────────────────────────────────────────────────────────

export async function fetchDashboardSummaryDb({ accountId = "all", accountIds = null, dateMode = "latest-month", dateFrom = null, dateTo = null } = {}) {
  if (!supabase) return null;
  const { data, error } = await withSupabaseRetry(
    () => supabase.rpc("tradelog_dashboard_summary", {
      p_account_id: accountId === "all" ? null : String(accountId || ""),
      p_account_ids: Array.isArray(accountIds) && accountIds.length ? accountIds.map(String) : null,
      p_date_mode: String(dateMode || "latest-month"),
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
    }),
    { label: "Fetch Dashboard summary" }
  );
  if (error) throw error;
  const summary = data?.[0] || data;
  if (!summary) return null;
  const numeric = (value, fallback = 0) => {
    if (value === "Infinity") return Infinity;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    ...summary,
    totalPnl: numeric(summary.totalPnl),
    wins: numeric(summary.wins),
    losses: numeric(summary.losses),
    breakEvenTrades: numeric(summary.breakEvenTrades),
    avgWin: numeric(summary.avgWin),
    avgLoss: numeric(summary.avgLoss),
    avgWinLossRatio: summary.avgWinLossRatio == null ? null : numeric(summary.avgWinLossRatio),
    profitFactor: numeric(summary.profitFactor),
    avgRR: numeric(summary.avgRR),
    avgHold: numeric(summary.avgHold),
    winRate: numeric(summary.winRate),
    currentStreak: numeric(summary.currentStreak),
    bestTradeStreak: numeric(summary.bestTradeStreak),
    currentDayStreak: numeric(summary.currentDayStreak),
    bestDayStreak: numeric(summary.bestDayStreak),
    dailyPerformance: Array.isArray(summary.dailyPerformance) ? summary.dailyPerformance : [],
    dailyData: Array.isArray(summary.dailyData) ? summary.dailyData : [],
    recentTrades: Array.isArray(summary.recentTrades) ? summary.recentTrades : [],
  };
}

export async function fetchAccountsDb() {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createAccountDb(account = {}) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  const payload = {
    user_id: userId,
    account_id: String(account.account_id || account.id || ""),
    name: account.name || "Trading Account",
    status: account.status || "active",
    stage: account.stage || "evaluation",
    account_number: account.account_number || null,
    prop_firm_id: account.prop_firm_id || null,
    prop_program_id: account.prop_program_id || null,
    platform: account.platform || null,
    market: account.market || null,
    vendor: account.vendor || null,
    account_size: account.account_size != null ? Number(account.account_size) : null,
    timezone: account.timezone || "Asia/Kolkata",
    settings: account.settings && typeof account.settings === "object" ? account.settings : {},
    rule_snapshot: account.rule_snapshot && typeof account.rule_snapshot === "object" ? account.rule_snapshot : null,
    archived_at: account.archived_at || null,
    updated_at: account.updated_at || new Date().toISOString(),
  };
  if (!payload.account_id) throw new Error("Account ID is required");
  const { data, error } = await supabase.from("accounts").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function saveAccountDb(account = {}) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  const payload = {
    user_id: userId,
    account_id: String(account.account_id || account.id || ""),
    name: account.name || "Trading Account",
    status: account.status || "active",
    stage: account.stage || "evaluation",
    account_number: account.account_number || null,
    prop_firm_id: account.prop_firm_id || null,
    prop_program_id: account.prop_program_id || null,
    platform: account.platform || null,
    market: account.market || null,
    vendor: account.vendor || null,
    account_size: account.account_size != null ? Number(account.account_size) : null,
    timezone: account.timezone || "Asia/Kolkata",
    settings: account.settings && typeof account.settings === "object" ? account.settings : {},
    rule_snapshot: account.rule_snapshot && typeof account.rule_snapshot === "object" ? account.rule_snapshot : null,
    archived_at: account.archived_at || null,
    updated_at: account.updated_at || new Date().toISOString(),
  };
  if (!payload.account_id) throw new Error("Account ID is required");
  const { data, error } = await supabase
    .from("accounts")
    .upsert(payload, { onConflict: "user_id,account_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveAccountDb(accountId) {
  if (!supabase || !accountId || accountId === "primary") return false;
  const userId = await getCurrentUserId();
  const { data: current, error: readError } = await supabase
    .from("accounts")
    .select("settings")
    .eq("user_id", userId)
    .eq("account_id", String(accountId))
    .maybeSingle();
  if (readError) throw readError;
  const settings = current?.settings && typeof current.settings === "object" ? current.settings : {};
  settings.accountStatus = "archived";
  const { error } = await supabase
    .from("accounts")
    .update({ status: "archived", settings, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("account_id", String(accountId));
  if (error) throw error;
  return true;
}

// Permanently removes an account. Deletion is atomic and server-side and is refused when the
// account still has trades, so history is never orphaned or silently moved into another account
// (the old client-side version nulled trades.account_id in separate calls). Archive instead.
export async function deleteAccountDb(accountId) {
  if (!supabase || !accountId || accountId === "primary") return false;
  const { data, error } = await withSupabaseRetry(
    () => supabase.rpc("tradelog_delete_account", { p_account_id: String(accountId) }),
    { label: "Delete account" }
  );
  if (error) throw error;
  if (data?.deleted) return true;
  if (data?.reason === "has_trades") {
    throw new Error(`This account still has ${data.trade_count || 0} trade(s)${data.missed_trade_count ? ` and ${data.missed_trade_count} missed trade(s)` : ""}. Archive it instead to keep your history.`);
  }
  return false;
}

export async function restoreAccountDb(accountId) {
  if (!supabase || !accountId) return false;
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("accounts")
    .update({ status: "active", archived_at: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("account_id", String(accountId));
  if (error) throw error;
  return true;
}

// ─────────────────────────────────────────────────────────────
// Trades
// ─────────────────────────────────────────────────────────────

// Trade history is intentionally paged. The first page is small enough to keep
// login/refresh responsive for large accounts; callers can continue with the
// returned `nextCursor` instead of using an ever-growing OFFSET.
const DEFAULT_TRADES_FETCH_LIMIT = 100;
const MAX_TRADES_FETCH_LIMIT = 500;

export async function fetchTradesDb({
  limit = DEFAULT_TRADES_FETCH_LIMIT,
  offset = 0,
  cursor = null,
  includeMistakes = true,
  includeImages = false,
} = {}) {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_TRADES_FETCH_LIMIT, MAX_TRADES_FETCH_LIMIT));

  const { data, error } = await withSupabaseRetry(() => {
    let query = supabase
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .order("trade_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(safeLimit);

    if (cursor?.tradeDate && cursor?.id) {
      const tradeDate = String(cursor.tradeDate).replace(/,/g, "");
      const cursorId = String(cursor.id).replace(/,/g, "");
      query = query.or(`trade_date.lt.${tradeDate},and(trade_date.eq.${tradeDate},id.lt.${cursorId})`);
    } else if (Number(offset) > 0) {
      query = query.range(Number(offset), Number(offset) + safeLimit - 1);
    }
    return query;
  }, { label: "Fetch trades" });
  if (error) throw error;

  const trades = (data || []).map((row) => ({
    ...row, id: row.id, date: row.trade_date, time: row.entry_time, exit_time: row.exit_time,
    symbol: row.symbol, dir: row.direction, entry: row.entry_price, exit: row.exit_price,
    qty: row.quantity, sl: row.stop_loss, tp: row.take_profit, pnl: row.pnl, risk: row.planned_risk,
    session: row.session, mood: row.mood, setup: row.setup ?? row.setup_name ?? row.setup_label ?? row.setup_score,
    playbook: row.playbook ?? row.playbook_name ?? row.strategy ?? "", chart_url: row.tradingview_chart_url,
    setup_checklist: row.setup_checklist || null, mistake_outcome: row.mistake_outcome || "",
    mistake_pnl: row.mistake_pnl != null ? Number(row.mistake_pnl) : 0, accountId: row.account_id || null,
    accountUuid: row.account_uuid || "", externalTradeId: row.external_trade_id || "",
    externalAccountId: row.external_account_id || "", connectorId: row.connector_id || "", source: row.source || "",
    captureStatus: row.capture_status || "", executionIds: Array.isArray(row.execution_ids) ? row.execution_ids : [],
    executionCount: Number(row.execution_count || 0), liveTradeKey: row.live_trade_key || "", updatedAt: row.updated_at || null,
    tradingPlanId: row.trading_plan_id || null, trading_plan_id: row.trading_plan_id || null,
    tradingPlanSnapshot: row.trading_plan_snapshot || null, trading_plan_snapshot: row.trading_plan_snapshot || null,
    screenshot_before: "", screenshot_after: "",
  }));

  if (includeMistakes) {
    const tradeIds = trades.map((trade) => trade.id);
    let mistakesByTrade = {};
    if (tradeIds.length > 0) {
      const { data: mistakeRows, error: mistakeError } = await supabase
        .from("trade_mistakes").select("trade_id, mistake_type").in("trade_id", tradeIds);
      if (mistakeError) throw mistakeError;
      mistakesByTrade = (mistakeRows || []).reduce((acc, row) => {
        if (!acc[row.trade_id]) acc[row.trade_id] = [];
        acc[row.trade_id].push(row.mistake_type);
        return acc;
      }, {});
    }
    for (const trade of trades) trade.mistakes = mistakesByTrade[trade.id] || [];
  } else {
    for (const trade of trades) trade.mistakes = [];
  }

  const result = includeImages ? await attachImagesBatched(trades, "trade_id") : trades;
  const last = data?.[data.length - 1];
  result.nextCursor = last?.trade_date && last?.id ? { tradeDate: last.trade_date, id: last.id } : null;
  result.hasMore = Array.isArray(data) && data.length === safeLimit;
  return result;
}

export async function fetchTradingPlanByDateDb(date) {
  if (!supabase || !date) return null;
  const userId = await getCurrentUserId();
  const { data, error } = await withSupabaseRetry(
    () => supabase.from("trading_plans")
      .select("id,plan_date,market_bias,key_levels,setup_focus,max_risk,max_trades,news_focus,notes,rules_confirmed,setup_checklist,updated_at")
      .eq("user_id", userId)
      .eq("plan_date", String(date).slice(0, 10))
      .maybeSingle(),
    { label: "Fetch trading plan" }
  );
  if (error) throw error;
  return data || null;
}

export async function saveTradeDb(trade) {
  if (!supabase) return null;

  const userId = await getCurrentUserId();

  const dbPayload = {
    user_id: userId,
    trade_date: trade.date,
    entry_time: normalizeDbTime(trade.time),
    exit_time: normalizeDbTime(trade.exit_time),
    symbol: trade.symbol || "MNQ",
    direction: trade.dir,
    session: trade.session || null,

    entry_price:
      trade.entry != null ? Number(trade.entry) : null,

    exit_price:
      trade.exit != null ? Number(trade.exit) : null,

    quantity:
      trade.qty != null ? Number(trade.qty) : 1,

    stop_loss:
      trade.sl != null ? Number(trade.sl) : null,

    take_profit:
      trade.tp != null ? Number(trade.tp) : null,

    pnl:
      trade.pnl != null ? Number(trade.pnl) : 0,

    planned_risk:
      trade.risk != null ? Number(trade.risk) : null,

    mood: trade.mood || null,
    mistake_outcome:
  trade.mistake_outcome || null,

mistake_pnl:
  trade.mistake_pnl != null && trade.mistake_pnl !== ""
    ? Number(trade.mistake_pnl)
    : null,

   setup_score:
  trade.setup_score != null ? Number(trade.setup_score) : null,

    grade:
trade.grade || null,

    tradingview_chart_url:
      trade.chart_url || null,

    setup_checklist:
      trade.setup_checklist || null,

    // `account_id` must always be the string application account key. A UI
    // component may provide the whole account object; normalize that here as
    // a final database boundary so it can never be persisted as "[object Object]".
    account_id: (() => {
      const resolved = resolveTradeAccountReference(trade?.accountId ?? trade?.account_id ?? trade?.accountUuid ?? trade?.account_uuid);
      if (resolved.legacyId) return resolved.legacyId;
      // A UUID-only reference is not a valid trades.account_id value. The App
      // layer normally resolves it to the account's legacy key; if it does not,
      // fail rather than silently writing an incorrect account.
      // A missing account is an error, never a silent "primary" (see TL-005).
      return "";
    })(),
    external_trade_id: trade.externalTradeId || trade.external_trade_id || null,
    external_account_id: trade.externalAccountId || trade.external_account_id || null,
    connector_id: trade.connectorId || trade.connector_id || null,
    source: trade.source || null,
    trading_plan_id: trade.tradingPlanId || trade.trading_plan_id || null,
    trading_plan_snapshot: trade.tradingPlanSnapshot || trade.trading_plan_snapshot || null,
  };
  const rawAccountRef = trade?.accountId ?? trade?.account_id ?? trade?.accountUuid ?? trade?.account_uuid;
  const resolvedAccountRef = resolveTradeAccountReference(rawAccountRef);
  const canonicalAccountUuid = trade.accountUuid || trade.account_uuid || resolvedAccountRef.uuid;
  if (isUuid(canonicalAccountUuid)) {
    dbPayload.account_uuid = String(canonicalAccountUuid);
  } else {
    // Do not copy the legacy account_id into account_uuid. It is a text key,
    // not the canonical UUID stored by accounts.id.
    delete dbPayload.account_uuid;
  }

  if (dbPayload.account_id === "[object Object]" || !dbPayload.account_id) {
    throw new Error("Trade account could not be resolved to a valid account ID. Select the intended account and try again.");
  }

  // Phase 39 live-capture metadata is optional. Fetched manual trades always
  // expose executionIds as an empty array for UI convenience, so checking only
  // Array.isArray(executionIds) would incorrectly send Phase 39 columns during
  // ordinary manual edits. Only send these fields when the trade actually
  // carries live-capture state. This keeps manual journaling compatible with
  // production databases where the optional Phase 39 migration has not yet run.
  const hasLiveCaptureMetadata = Boolean(
    trade.captureStatus
    || trade.liveTradeKey
    || Number(trade.executionCount || 0) > 0
    || (Array.isArray(trade.executionIds) && trade.executionIds.length > 0)
  );
  if (hasLiveCaptureMetadata) {
    dbPayload.capture_status = trade.captureStatus || null;
    dbPayload.execution_ids = Array.isArray(trade.executionIds) ? trade.executionIds : [];
    dbPayload.execution_count = Number(trade.executionCount || 0);
    dbPayload.live_trade_key = trade.liveTradeKey || null;
  }

// Preserve the existing Supabase ID only when editing.
// New trades intentionally have no ID so PostgreSQL can generate it.
if (trade.id != null) {
  dbPayload.id = trade.id;
}

  // Always advance updated_at ourselves. A DB trigger (see the
  // core-rls-hardening migration) also enforces this server-side, but setting
  // it here keeps the value correct even before that migration is applied.
  dbPayload.updated_at = new Date().toISOString();

  // ── Atomic database save ────────────────────────────────────────────────
  // Trade + mistake replacement now execute inside one Postgres transaction.
  // The RPC also performs the optimistic-concurrency check and verifies that
  // the selected account belongs to auth.uid(), so neither rule depends on the
  // browser being honest.
  const mistakes = Array.isArray(trade.mistakes)
    ? trade.mistakes.filter(Boolean)
    : [];

  const clientOperationId = String(
    trade.clientOperationId
      || trade.client_operation_id
      || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  );
  dbPayload.client_operation_id = clientOperationId;

  const { data, error } = await withSupabaseRetry(
    () => supabase.rpc(
      "tradelog_save_trade_with_mistakes",
      {
        p_trade: dbPayload,
        p_mistakes: mistakes,
        p_expected_updated_at: trade.id != null && trade.updatedAt ? trade.updatedAt : null,
        p_client_operation_id: clientOperationId,
      }
    ),
    { label: "Save trade" }
  );

  if (error) throw error;

  const savedTrade = data?.[0];
  if (!savedTrade?.id) {
    throw new Error("Trade was saved but no trade ID was returned.");
  }

  return data;
}


export async function fetchTradeReviewsDb(tradeIds = []) {
  if (!supabase || !Array.isArray(tradeIds) || !tradeIds.length) return [];
  const ids = Array.from(new Set(tradeIds.map(String).filter(Boolean)));
  const { data, error } = await withSupabaseRetry(
    () => supabase.from("trade_reviews")
      .select("id, trade_id, review_status, notes, reviewed_at, updated_at, created_at")
      .in("trade_id", ids),
    { label: "Fetch trade reviews" }
  );
  if (error) throw error;
  return data || [];
}

export async function saveTradeReviewDb({ tradeId, reviewStatus = "reviewed", notes = "", reviewedAt = null } = {}) {
  if (!supabase) throw new Error("Supabase not configured");
  if (!tradeId) throw new Error("Trade ID is required for review");
  const userId = await getCurrentUserId();
  const payload = {
    user_id: userId,
    trade_id: String(tradeId),
    review_status: ["pending", "reviewed", "needs_follow_up"].includes(reviewStatus) ? reviewStatus : "reviewed",
    notes: String(notes || ""),
    reviewed_at: reviewStatus === "reviewed" ? (reviewedAt || new Date().toISOString()) : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await withSupabaseRetry(
    () => supabase.from("trade_reviews")
      .upsert(payload, { onConflict: "user_id,trade_id" })
      .select("id, trade_id, review_status, notes, reviewed_at, updated_at, created_at")
      .single(),
    { label: "Save trade review" }
  );
  if (error) throw error;
  return data;
}

export async function fetchExistingExternalTradeIdsDb(connectorId, externalTradeIds = []) {
  if (!supabase || !connectorId || !Array.isArray(externalTradeIds) || !externalTradeIds.length) return new Set();

  const userId = await getCurrentUserId();
  const ids = Array.from(new Set(externalTradeIds.map(String).filter(Boolean)));
  if (!ids.length) return new Set();

  const { data, error } = await supabase
    .from("trades")
    .select("external_trade_id")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .in("external_trade_id", ids);

  if (error) throw error;
  return new Set((data || []).map((row) => String(row.external_trade_id)).filter(Boolean));
}



export async function fetchTradeExecutionsDb(accountId, connectorId = "apex-ninjatrader", limit = 500) {
  if (!supabase) return [];
  const safeAccountId = requireBusinessAccountId(accountId, "Execution account");
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("trade_executions")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", safeAccountId)
    .eq("connector_id", String(connectorId))
    .order("event_time", { ascending: false })
    .limit(Math.min(Number(limit) || 500, 2000));
  if (error) throw error;
  return data || [];
}

export async function saveTradeExecutionDb(execution = {}) {
  if (!supabase || !execution.externalExecutionId) return null;
  const safeAccountId = requireBusinessAccountId(execution.accountId, "Execution account");
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("trade_executions")
    .upsert({
      user_id: userId,
      account_id: safeAccountId,
      connector_id: String(execution.connectorId || "unknown"),
      external_execution_id: String(execution.externalExecutionId),
      external_order_id: execution.externalOrderId ? String(execution.externalOrderId) : null,
      external_account_id: execution.externalAccountId ? String(execution.externalAccountId) : null,
      symbol: execution.symbol || null,
      action: execution.action || null,
      quantity: Number(execution.quantity || 0),
      price: execution.price != null ? Number(execution.price) : null,
      event_time: execution.eventTime || new Date().toISOString(),
      journal_trade_id: execution.journalTradeId || null,
      raw: execution.raw && typeof execution.raw === "object" ? execution.raw : {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,connector_id,external_execution_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTradeDb(id) {
  if (!supabase) return null;
  if (!id) throw new Error("Trade ID is required");

  const { data, error } = await withSupabaseRetry(
    () => supabase.rpc("tradelog_delete_trade", { p_trade_id: id }),
    { label: "Delete trade" }
  );
  if (error) throw error;
  const result = data?.[0] || data || { deleted: true, storage_paths: [] };
  if (result?.deleted === false) throw new Error("Trade not found or not owned by the current user.");
  return result;
}

export async function deleteTradeStoragePaths(paths = []) {
  if (!supabase || !Array.isArray(paths) || paths.length === 0) return true;
  const clean = Array.from(new Set(paths.map(String).filter(Boolean)));
  if (!clean.length) return true;
  try {
    const { error } = await withSupabaseRetry(
      () => supabase.storage.from(TRADE_IMAGES_BUCKET).remove(clean),
      { label: "Delete trade screenshots" }
    );
    if (error) throw error;
    return true;
  } catch (error) {
    // The database deletion has already committed. Do not report the trade as
    // undeleted because Storage cleanup failed; the files remain inaccessible
    // through the private bucket and can be reconciled later.
    console.warn("Trade deleted but screenshot cleanup needs reconciliation:", error?.message || error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Broker Connector Persistence
// ─────────────────────────────────────────────────────────────

export async function fetchBrokerConnectionsDb(accountId) {
  if (!supabase) return [];
  const safeAccountId = requireBusinessAccountId(accountId, "Broker account");

  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("broker_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", safeAccountId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function saveBrokerConnectionDb(accountId, connectorId, patch = {}) {
  if (!supabase || !connectorId) return null;
  const safeAccountId = requireBusinessAccountId(accountId, "Broker account");

  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("broker_connections")
    .upsert({
      user_id: userId,
      account_id: safeAccountId,
      connector_id: String(connectorId),
      status: patch.status || "disconnected",
      metadata: patch.metadata && typeof patch.metadata === "object" ? patch.metadata : {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,account_id,connector_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchConnectorSyncRunsDb(accountId, limit = 50) {
  if (!supabase) return [];
  const safeAccountId = requireBusinessAccountId(accountId, "Sync account");
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("connector_sync_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", safeAccountId)
    .order("completed_at", { ascending: false })
    .limit(Math.min(Number(limit) || 50, 200));
  if (error) throw error;
  return (data || []).map((row) => ({
    connectorId: row.connector_id, accountId: row.account_id, mode: row.mode, status: row.status,
    importedCount: row.imported_count, skippedCount: row.skipped_count, errorCount: row.error_count,
    message: row.message, durationMs: row.duration_ms, startedAt: row.started_at, completedAt: row.completed_at,
  }));
}

export async function saveConnectorSyncRunDb(run = {}) {
  if (!supabase) return null;
  const safeAccountId = requireBusinessAccountId(run.accountId, "Sync account");
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from("connector_sync_runs").insert({
    user_id: userId, account_id: safeAccountId, connector_id: String(run.connectorId || "unknown"),
    mode: run.mode || "manual", status: run.status || "success", imported_count: Number(run.importedCount || 0),
    skipped_count: Number(run.skippedCount || 0), error_count: Number(run.errorCount || 0), message: run.message || null,
    duration_ms: Math.round(Number(run.durationMs || 0)), started_at: run.startedAt || new Date().toISOString(), completed_at: run.completedAt || new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBrokerConnectionDb(accountId, connectorId) {
  if (!supabase || !connectorId) return true;
  const safeAccountId = requireBusinessAccountId(accountId, "Broker account");

  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("broker_connections")
    .delete()
    .eq("user_id", userId)
    .eq("account_id", safeAccountId)
    .eq("connector_id", String(connectorId));

  if (error) throw error;
  return true;
}

// ─────────────────────────────────────────────────────────────
// Missed Trades
// ─────────────────────────────────────────────────────────────

export async function fetchMissedTradesDb({ limit = DEFAULT_TRADES_FETCH_LIMIT, offset = 0, includeImages = false } = {}) {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_TRADES_FETCH_LIMIT, MAX_TRADES_FETCH_LIMIT));

  const { data, error } = await withSupabaseRetry(() => {
    let query = supabase.from("missed_trades").select("*").eq("user_id", userId)
      .order("trade_date", { ascending: false }).order("id", { ascending: false }).limit(safeLimit);
    if (Number(offset) > 0) query = query.range(Number(offset), Number(offset) + safeLimit - 1);
    return query;
  }, { label: "Fetch missed trades" });
  if (error) throw error;
  const missedTrades = (data || []).map((row) => ({
    ...row, id: row.id, date: row.trade_date, time: row.trade_time, symbol: row.symbol, dir: row.direction,
    entry: row.entry_price, exit: row.exit_price, sl: row.stop_loss, tp: row.take_profit,
    potential_pnl: row.potential_pnl, reason_missed: row.reason_missed, reason: row.reason_missed || "",
    notes: row.notes, screenshot_before: "", screenshot_after: "",
  }));
  const result = includeImages ? await attachImagesBatched(missedTrades, "missed_trade_id") : missedTrades;
  const last = data?.[data.length - 1];
  result.nextCursor = last?.trade_date && last?.id ? { tradeDate: last.trade_date, id: last.id } : null;
  result.hasMore = Array.isArray(data) && data.length === safeLimit;
  return result;
}

export async function saveMissedTradeDb(trade) {
  if (!supabase) return null;

  const clientOperationId = String(
    trade.clientOperationId
      || trade.client_operation_id
      || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  );

  const dbPayload = {
    user_id: await getCurrentUserId(),
    account_id: requireBusinessAccountId(trade.accountId || trade.account_id, "Missed trade account"),
    trade_date: trade.date,
    trade_time: normalizeDbTime(trade.time),
    symbol: trade.symbol || "MNQ",
    direction: trade.dir,
    entry_price: trade.entry != null ? Number(trade.entry) : null,
    exit_price: trade.exit != null ? Number(trade.exit) : null,
    stop_loss: trade.sl != null ? Number(trade.sl) : null,
    take_profit: trade.tp != null ? Number(trade.tp) : null,
    potential_pnl: trade.potential_pnl != null ? Number(trade.potential_pnl) : null,
    reason_missed: trade.reason_missed || trade.reason || null,
    notes: trade.notes || null,
    client_operation_id: clientOperationId,
  };

  if (trade.id && typeof trade.id === "number") dbPayload.id = trade.id;

  const { data, error } = await withSupabaseRetry(
    () => supabase.rpc("tradelog_save_missed_trade", {
      p_trade: dbPayload,
      p_client_operation_id: clientOperationId,
    }),
    { label: "Save missed trade" }
  );

  if (error) throw error;
  return data;
}

export async function deleteMissedTradeDb(id) {
  if (!supabase) return null;
  if (!Number.isFinite(Number(id))) throw new Error("Missed trade ID is required");

  const { data, error } = await withSupabaseRetry(
    () => supabase.rpc("tradelog_delete_missed_trade", { p_trade_id: Number(id) }),
    { label: "Delete missed trade" }
  );
  if (error) throw error;
  const result = data?.[0] || data || { deleted: true, storage_paths: [] };
  if (result?.deleted === false) throw new Error("Missed trade not found or not owned by the current user.");
  return result;
}

export async function deleteMissedTradeStoragePaths(paths = []) {
  if (!supabase || !Array.isArray(paths) || paths.length === 0) return true;
  const clean = Array.from(new Set(paths.map(String).filter(Boolean)));
  if (!clean.length) return true;
  try {
    const { error } = await withSupabaseRetry(
      () => supabase.storage.from(TRADE_IMAGES_BUCKET).remove(clean),
      { label: "Delete missed-trade screenshots" }
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("Missed trade deleted but screenshot cleanup needs reconciliation:", error?.message || error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Account Settings
// ─────────────────────────────────────────────────────────────

// ── Account Settings ──────────────────────────────────────────

export async function fetchSettingsDb() {
  if (!supabase) return null;

  let userId;
  try {
    userId = await getCurrentUserId();
  } catch {
    return null;
  }

  const { data, error } = await withSupabaseRetry(
    () => supabase.from("account_settings").select("*").eq("user_id", userId).maybeSingle(),
    { label: "Fetch account settings" }
  );

  if (error) throw error;

  if (!data) return null;

  return {
    accountSize: Number(data.account_size),
    maxDrawdown: Number(data.max_trailing_drawdown),
    dailyLossLimit: Number(data.daily_loss_limit),
    perTradeRiskLimit: Number(data.per_trade_risk_limit),
    minTradingDays: data.minimum_trading_days,
    minProfitableDays: data.minimum_profitable_days,
    minDailyProfit: Number(data.min_daily_profit),
    minEquityForPayout: Number(data.equity_required_for_payout),
    minPayout: Number(data.minimum_payout),
    unloggedProfitOffset: Number(data.unlogged_profit_offset),
    profitTarget: Number(data.profit_target),
    consistencyRule: Number(data.consistency_rule),
    accountName: data.account_name,
    platform: data.platform
  };
}

export async function saveSettingsDb(settings) {
  if (!supabase) return null;

  const userId = await getCurrentUserId();

  const dbPayload = {
    user_id: userId,

    account_name: settings.accountName || "The5ers 25K",
    platform: settings.platform || "BlackArrow",

    account_size: Number(settings.accountSize ?? 25000),
    max_trailing_drawdown: Number(settings.maxDrawdown ?? 1500),
    daily_loss_limit: Number(settings.dailyLossLimit ?? 500),
    per_trade_risk_limit: Number(settings.perTradeRiskLimit ?? 250),

    minimum_trading_days: Number(settings.minTradingDays ?? 1),
    minimum_profitable_days: Number(settings.minProfitableDays ?? 1),
    min_daily_profit: Number(settings.minDailyProfit ?? 50),

    equity_required_for_payout: Number(
      settings.minEquityForPayout ?? 26500
    ),

    minimum_payout: Number(settings.minPayout ?? 0),
    unlogged_profit_offset: Number(settings.unloggedProfitOffset ?? 0),

    profit_target: Number(settings.profitTarget ?? 1500),
    consistency_rule: Number(settings.consistencyRule ?? 40)
  };

  const { data, error } = await supabase
    .from("account_settings")
    .upsert(dbPayload, {
      onConflict: "user_id"
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

// ─────────────────────────────────────────────────────────────
// Trade Images / Supabase Storage
// ─────────────────────────────────────────────────────────────

const TRADE_IMAGES_BUCKET = "trade-images";
// Loads images for many trades/missed-trades in ONE database query and
// ONE signed-URL request, instead of one round-trip per trade. Called by
// fetchTradesDb and fetchMissedTradesDb.
async function attachImagesBatched(rows, idColumn) {
  if (!supabase || rows.length === 0) return rows;

  const userId = await getCurrentUserId();
  const ids = rows.map((r) => r.id);

  const { data: imageRows, error } = await supabase
    .from("trade_images")
    .select("*")
    .eq("user_id", userId)
    .in(idColumn, ids);

  if (error) {
    console.error("Failed to load trade images:", error);
    return rows;
  }
  if (!imageRows || imageRows.length === 0) return rows;

  const paths = imageRows.map((img) => img.storage_path);

  // Sign in bounded chunks instead of one request sized to the user's entire
  // image history. Keeps a single request small/predictable as history grows,
  // and one bad chunk no longer voids every other trade's screenshots.
  const SIGN_CHUNK_SIZE = 200;
  const urlByPath = {};
  for (let i = 0; i < paths.length; i += SIGN_CHUNK_SIZE) {
    const chunk = paths.slice(i, i + SIGN_CHUNK_SIZE);
    const { data: signedUrls, error: signedError } = await supabase.storage
      .from(TRADE_IMAGES_BUCKET)
      .createSignedUrls(chunk, 3600);

    if (signedError) {
      console.error("Failed to sign a batch of trade images:", signedError);
      continue; // keep going — a failed chunk shouldn't blank out every image
    }

    chunk.forEach((path, j) => {
      const result = signedUrls[j];
      if (result?.signedUrl) urlByPath[path] = result.signedUrl;
    });
  }

  const imagesById = {};
  imageRows.forEach((img) => {
    const key = img[idColumn];
    if (!imagesById[key]) imagesById[key] = [];
    imagesById[key].push({ ...img, url: urlByPath[img.storage_path] || "" });
  });

  return rows.map((row) => {
    const images = imagesById[row.id] || [];
    const beforeImage = images.find((img) => img.image_type === "before_entry");
    const afterImage = images.find((img) => img.image_type === "after_exit");
    return {
      ...row,
      screenshot_before: beforeImage?.url || "",
      screenshot_after: afterImage?.url || "",
    };
  });
}

export async function uploadTradeImage(file, tradeId, imageType) {
  if (!supabase) throw new Error("Supabase not configured");
  if (!file) throw new Error("No image selected");
  if (!tradeId) throw new Error("Trade ID is required");

  const userId = await getCurrentUserId();

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "png";

  const filePath =
    `${userId}/${tradeId}/${imageType}.${extension}`;

  // Upload image to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(TRADE_IMAGES_BUCKET)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });

  if (uploadError) throw uploadError;

  // Save the Storage path in trade_images
  const { data, error: dbError } = await supabase
    .from("trade_images")
    .upsert(
      {
        user_id: userId,
        trade_id: tradeId,
        image_type: imageType,
        storage_path: filePath,
      },
      {
        onConflict: "trade_id,image_type",
      }
    )
    .select()
    .single();

  if (dbError) throw dbError;

  return data;
}

export async function getTradeImages(tradeId) {
  if (!supabase) return [];

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("trade_images")
    .select("*")
    .eq("trade_id", tradeId)
    .eq("user_id", userId);

  if (error) throw error;

  const images = await Promise.all(
    (data || []).map(async (image) => {
      const { data: signedData, error: signedError } = await withSupabaseRetry(
        () => supabase.storage.from(TRADE_IMAGES_BUCKET).createSignedUrl(image.storage_path, 3600),
        { label: "Create trade image URL" }
      );

      if (signedError) throw signedError;

      return {
        ...image,
        url: signedData.signedUrl,
      };
    })
  );

  return images;
}
export async function uploadMissedTradeImage(file, missedTradeId, imageType) {
  if (!supabase) throw new Error("Supabase not configured");
  if (!file) throw new Error("No image selected");
  if (!missedTradeId) throw new Error("Missed Trade ID is required");

  const userId = await getCurrentUserId();

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "png";

  const filePath =
    `${userId}/missed/${missedTradeId}/${imageType}.${extension}`;

  // Upload file to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(TRADE_IMAGES_BUCKET)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });

  if (uploadError) throw uploadError;

  // Delete any existing record for this missed_trade_id + image_type
  // to avoid duplicates (missed_trade_id is nullable so onConflict
  // clause does not work reliably across NULLs in PostgreSQL)
  await supabase
    .from("trade_images")
    .delete()
    .eq("missed_trade_id", missedTradeId)
    .eq("image_type", imageType)
    .eq("user_id", userId);

  // Insert fresh record
  const { data, error: dbError } = await supabase
    .from("trade_images")
    .insert({
      user_id:         userId,
      missed_trade_id: missedTradeId,
      trade_id:        null,
      image_type:      imageType,
      storage_path:    filePath,
    })
    .select()
    .single();

  if (dbError) throw dbError;

  return data;
}

export async function getMissedTradeImages(missedTradeId) {
  if (!supabase) return [];

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("trade_images")
    .select("*")
    .eq("missed_trade_id", missedTradeId)
    .eq("user_id", userId);

  if (error) throw error;

  const images = await Promise.all(
    (data || []).map(async (image) => {
      const { data: signedData, error: signedError } = await withSupabaseRetry(
        () => supabase.storage.from(TRADE_IMAGES_BUCKET).createSignedUrl(image.storage_path, 3600),
        { label: "Create trade image URL" }
      );

      if (signedError) throw signedError;

      return {
        ...image,
        url: signedData.signedUrl,
      };
    })
  );

  return images;
}

export async function deleteMissedTradeImages(missedTradeId) {
  if (!supabase) return;

  const userId = await getCurrentUserId();

  // Get all image records for this missed trade
  const { data, error } = await supabase
    .from("trade_images")
    .select("id, storage_path")
    .eq("missed_trade_id", missedTradeId)
    .eq("user_id", userId);

  if (error) throw error;
  if (!data || data.length === 0) return;

  // Delete all Storage files
  const paths = data.map((r) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(TRADE_IMAGES_BUCKET)
      .remove(paths);
    if (storageError) throw storageError;
  }

  // Delete all database records
  const { error: dbError } = await supabase
    .from("trade_images")
    .delete()
    .eq("missed_trade_id", missedTradeId)
    .eq("user_id", userId);

  if (dbError) throw dbError;
}

export async function deleteTradeImage(imageId, storagePath) {
  if (!supabase) return;

  const userId = await getCurrentUserId();

  // Delete the actual file from Storage
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(TRADE_IMAGES_BUCKET)
      .remove([storagePath]);

    if (storageError) throw storageError;
  }

  // Delete the database record
  const { error: dbError } = await supabase
    .from("trade_images")
    .delete()
    .eq("id", imageId)
    .eq("user_id", userId);

  if (dbError) throw dbError;
}

// ── Delete ALL images for a trade (used when the trade itself is deleted) ──
export async function deleteTradeImages(tradeId) {
  if (!supabase) return;
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("trade_images")
    .select("id, storage_path")
    .eq("trade_id", tradeId)
    .eq("user_id", userId);

  if (error) throw error;
  if (!data || data.length === 0) return;

  const paths = data.map((r) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(TRADE_IMAGES_BUCKET)
      .remove(paths);
    if (storageError) throw storageError;
  }

  const { error: dbError } = await supabase
    .from("trade_images")
    .delete()
    .eq("trade_id", tradeId)
    .eq("user_id", userId);

  if (dbError) throw dbError;
}

// ── Delete ONE image (before/after) for a trade — used when a screenshot is removed ──
export async function deleteTradeImageByType(tradeId, imageType) {
  if (!supabase) return;
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("trade_images")
    .select("id, storage_path")
    .eq("trade_id", tradeId)
    .eq("image_type", imageType)
    .eq("user_id", userId);

  if (error) throw error;
  if (!data || data.length === 0) return;

  const paths = data.map((r) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(TRADE_IMAGES_BUCKET)
      .remove(paths);
    if (storageError) throw storageError;
  }

  const { error: dbError } = await supabase
    .from("trade_images")
    .delete()
    .eq("trade_id", tradeId)
    .eq("image_type", imageType)
    .eq("user_id", userId);

  if (dbError) throw dbError;
}

export async function deleteMissedTradeImageByType(missedTradeId, imageType) {
  if (!supabase) return;
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("trade_images")
    .select("id, storage_path")
    .eq("missed_trade_id", missedTradeId)
    .eq("image_type", imageType)
    .eq("user_id", userId);

  if (error) throw error;
  if (!data || data.length === 0) return;

  const paths = data.map((r) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(TRADE_IMAGES_BUCKET)
      .remove(paths);
    if (storageError) throw storageError;
  }

  const { error: dbError } = await supabase
    .from("trade_images")
    .delete()
    .eq("missed_trade_id", missedTradeId)
    .eq("image_type", imageType)
    .eq("user_id", userId);

  if (dbError) throw dbError;
}
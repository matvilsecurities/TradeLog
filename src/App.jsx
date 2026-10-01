import { useMemo, useState, lazy, Suspense, useCallback, useEffect } from "react";

import { getSetupChecksForUser } from "./setupChecklist.js";
import { V, setThemeValue } from "./constants.js";
import { usePerformanceStats } from "./hooks/usePerformanceStats.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { useTradeData } from "./hooks/useTradeData.js";
import { useApexSettings } from "./hooks/useApexSettings.js";
import "./styles/animations.css";
import "./styles/login.css";
import "./styles/app.css";
import "./styles/tradeJournalLedger.css";
import "./styles/responsive.css";
import "./styles/professional-ui.css";
import "./styles/tradeReview.css";
import "./styles/guided-entry.css";
import "./styles/prop-firm-setup.css";

import Sidebar from "./components/shared/Sidebar";
import KeyboardShortcuts from "./components/shared/KeyboardShortcuts";
import PageLoading from "./components/shared/PageLoading";
const TradeModal = lazy(() => import("./components/trades/TradeModal"));
const GuidedEntryModal = lazy(() => import("./components/trades/GuidedEntryModal"));
const ChartPreview = lazy(() => import("./components/trades/ChartPreview"));
const Analytics = lazy(() => import("./components/analytics/Analytics"));
const CalendarView = lazy(() => import("./components/analytics/CalendarView"));
const NewsCalendar = lazy(() => import("./components/news/NewsCalendar"));
const ApexDashboard = lazy(() => import("./components/apex/ApexDashboard"));
const AccountCenter = lazy(() => import("./components/apex/AccountCenter"));
const PropFirmSetup = lazy(() => import("./components/apex/PropFirmSetup"));
const ComplianceCenter = lazy(() => import("./components/apex/ComplianceCenter"));
const ComplianceAlerts = lazy(() => import("./components/apex/ComplianceAlerts"));
const PortfolioCenter = lazy(() => import("./components/apex/PortfolioCenter"));
const ApexSettings = lazy(() => import("./components/apex/ApexSettings"));
const EdgeAnalysis = lazy(() => import("./components/analytics/EdgeAnalysis"));
const TradeIntelligence = lazy(() => import("./components/analytics/TradeIntelligence"));
const RiskManager = lazy(() => import("./components/analytics/RiskManager"));
const TradeReview = lazy(() => import("./components/analytics/TradeReview"));
const ChartWorkspace = lazy(() => import("./components/trades/ChartWorkspace"));
const Playbook = lazy(() => import("./components/playbook/Playbook"));
const DataCenter = lazy(() => import("./components/data/DataCenter"));
const JournalIntelligence = lazy(() => import("./components/analytics/JournalIntelligence"));
const TradingPlan = lazy(() => import("./components/analytics/TradingPlan"));
const MissedTrades = lazy(() => import("./components/missed/MissedTrades"));
import LoginScreen from "./components/auth/LoginScreen";
const TradeLog = lazy(() => import("./components/trades/TradeLog"));
import { usePropFirmCompliance } from "./hooks/usePropFirmCompliance.js";
import { useComplianceAlerts } from "./hooks/useComplianceAlerts.js";
import { filterTradesForAccount, filterTradesForAccounts, useAccountPortfolio } from "./hooks/useAccountPortfolio.js";
import { signOut, fetchTradingPlanByDateDb } from "./supabase.js";
import { calculatePropFirmCompliance } from "./services/propFirmCompliance.js";
import { addAccountNotification } from "./utils/accountNotifications.js";

const getLocalIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const TradeJournalDashboard = lazy(() => import("./components/dashboard/TradeJournalDashboard"));
const SLTPCalculator = lazy(() => import("./components/SLTPCalculator"));
const ProfileCenter = lazy(() => import("./components/profile/ProfileCenter"));

export default function App() {
  const [theme, setTheme] = useState("light");
  const [view, setView] = useState("dashboard");
  const [showModal, setShowModal] = useState(false);
  const [showGuidedModal, setShowGuidedModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingChart, setViewingChart] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [postTradeEvaluationPrompt, setPostTradeEvaluationPrompt] = useState(false);
  const [dashboardAccountId, setDashboardAccountId] = useState("all");
  const [dashboardAccountStatusFilter, setDashboardAccountStatusFilter] = useState("all");
  const [historicalAccountId, setHistoricalAccountId] = useState(null);
  // Trade-entry account is explicit and independent from the connector/account-center context.
  // A Dashboard or Journal Ledger account selection must determine where a new manual trade is saved.
  const [tradeEntryAccountId, setTradeEntryAccountId] = useState(null);
  const [todayTradingPlanMode, setTodayTradingPlanMode] = useState("unset");

  const { session, authLoading } = useAuthSession();
  const { settings: apexSettings, applySettings, mergeSettings } = useApexSettings();

  // The Trade Log makes an explicit daily choice: attach today's saved plan to
  // new trades, or intentionally journal without a plan. Keep that choice
  // stable for the current user/day so opening another view does not silently
  // change how a trade will be recorded.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setTodayTradingPlanMode("unset");
      return;
    }
    const key = `tradelog:trade-log-plan-mode:${userId}:${getLocalIsoDate()}`;
    try {
      const stored = window.localStorage.getItem(key);
      setTodayTradingPlanMode(stored === "with-plan" || stored === "without-plan" ? stored : "unset");
    } catch {
      setTodayTradingPlanMode("unset");
    }
  }, [session?.user?.id]);

  const setTodayPlanMode = useCallback((mode) => {
    const next = mode === "with-plan" || mode === "without-plan" ? mode : "unset";
    setTodayTradingPlanMode(next);
    const userId = session?.user?.id;
    if (!userId) return;
    const key = `tradelog:trade-log-plan-mode:${userId}:${getLocalIsoDate()}`;
    try {
      if (next === "unset") window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, next);
    } catch {}
  }, [session?.user?.id]);

  // Warm the core workspace chunks after authentication so sidebar navigation
  // does not make the user wait for a lazy route download on first click.
  useEffect(() => {
    if (!session || authLoading) return undefined;
    const preload = () => {
      void import("./components/trades/TradeLog");
      void import("./components/playbook/Playbook");
      void import("./components/analytics/Analytics");
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 1200 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(preload, 700);
    return () => window.clearTimeout(id);
  }, [session, authLoading]);
  const {
    trades, missedTrades, loaded, refreshData, loadTradeImages, saveTrade: persistTrade, deleteTrade,
    saveMissedTrade: persistMissedTrade, deleteMissedTrade,
  } = useTradeData({ session, authLoading, onSettingsLoaded: mergeSettings, view });

  const accountPortfolio = useAccountPortfolio({ baseSettings: apexSettings, userId: session?.user?.id || "anonymous" });
  const { accounts, activeAccount, activeAccountId, activeSettings, refreshAccounts, selectAccount, createAccount, removeAccount, renameAccount, updateAccount } = accountPortfolio;
  const activeTrades = useMemo(() => filterTradesForAccount(trades, activeAccount), [trades, activeAccount]);

  // Dashboard context is deliberately limited to CURRENTLY ACTIVE accounts.
  // An evaluation marked Passed/Cleared is historical and must not appear in the
  // Dashboard selector or in the All Accounts aggregate. A funded account remains
  // eligible until it is blown/failed/closed/inactive.
  const dashboardActiveAccounts = useMemo(() => accounts.filter((account) => {
    const settings = account?.settings || {};
    const status = String(settings.accountStatus || account?.status || "active").trim().toLowerCase();
    const stage = String(settings.accountStage || "evaluation").trim().toLowerCase();
    const evaluationStatus = String(settings.evaluationStatus || "").trim().toLowerCase();

    if (["blown", "failed", "closed", "inactive", "disabled"].some((value) => status.includes(value))) return false;
    // Passed/Cleared evaluations are no longer active Dashboard accounts.
    // A funded account created from a passed evaluation is active again and is
    // therefore included by virtue of its funded stage.
    if (stage !== "funded" && ["passed", "cleared", "complete", "completed"].some((value) => evaluationStatus.includes(value))) return false;
    return true;
  }), [accounts]);

  // Dashboard has its own viewing context. It may show one active account or
  // the aggregate of every ACTIVE account without changing trade-entry context.
  useEffect(() => {
    const userKey = session?.user?.id || "anonymous";
    try {
      const saved = localStorage.getItem(`tradelog:dashboard-account:${userKey}`);
      const valid = saved === "all" || dashboardActiveAccounts.some((account) => account.id === saved);
      const next = valid ? saved : "all";
      setDashboardAccountId((current) => current === next ? current : next);
    } catch {
      setDashboardAccountId((current) => current === "all" ? current : "all");
    }
  }, [session?.user?.id, dashboardActiveAccounts]);

  const handleDashboardAccountSelect = useCallback((accountId) => {
    const nextId = accountId === "all" || dashboardActiveAccounts.some((account) => account.id === accountId) ? accountId : "all";
    setDashboardAccountId(nextId);
    try {
      localStorage.setItem(`tradelog:dashboard-account:${session?.user?.id || "anonymous"}`, nextId);
    } catch { /* non-blocking */ }
  }, [dashboardActiveAccounts, session?.user?.id]);

  const dashboardAccount = dashboardAccountId === "all"
    ? null
    : dashboardActiveAccounts.find((account) => account.id === dashboardAccountId) || null;
  const dashboardFilterAccounts = useMemo(() => {
    if (dashboardAccountId !== "all") return dashboardAccount ? [dashboardAccount] : [];

    const getStatus = (account) => {
      const settings = account?.settings || {};
      const status = String(settings.accountStatus || account?.status || "active").trim().toLowerCase();
      const stage = String(settings.accountStage || "evaluation").trim().toLowerCase();
      const evaluationStatus = String(settings.evaluationStatus || "").trim().toLowerCase();

      if (["blown", "failed", "closed", "inactive", "disabled"].some((value) => status.includes(value))) return "blown";
      if (stage !== "funded" && ["passed", "cleared", "complete", "completed"].some((value) => evaluationStatus.includes(value))) return "passed";
      return "active";
    };

    if (dashboardAccountStatusFilter === "all") return accounts;
    return accounts.filter((account) => getStatus(account) === dashboardAccountStatusFilter);
  }, [accounts, dashboardAccountId, dashboardAccountStatusFilter, dashboardAccount]);

  const dashboardTrades = useMemo(() => {
    if (dashboardAccountId !== "all") return filterTradesForAccount(trades, dashboardAccount);
    return filterTradesForAccounts(trades, dashboardFilterAccounts);
  }, [trades, dashboardAccountId, dashboardAccount, dashboardFilterAccounts]);

  const activeAccountSettings = activeSettings || apexSettings;

  // Historical accounts are deliberately isolated from the live Dashboard and
  // main Journal Ledger. The historical ledger gets its own account/filter
  // state and only receives Passed/Blown/Closed/Inactive account trades.
  const historicalAccounts = useMemo(() => accounts.filter((account) => {
    const settings = account?.settings || {};
    const status = String(settings.accountStatus || account?.status || "active").trim().toLowerCase();
    const evaluationStatus = String(settings.evaluationStatus || "").trim().toLowerCase();
    return ["blown", "failed", "closed", "inactive", "disabled"].some((value) => status.includes(value))
      || ["passed", "cleared", "complete", "completed"].some((value) => evaluationStatus.includes(value));
  }), [accounts]);
  // The review action is an explicit account request. Do not reject it merely
  // because the account's status/evaluation flag is being updated in the same
  // render cycle. The previous guard could leave the Review Trades button
  // pointing at a view with no valid account context and trigger a reload/error.
  const openHistoricalLedger = useCallback((accountId) => {
    const id = String(accountId || "");
    if (!id || !accounts.some((account) => String(account.id) === id)) return;
    setHistoricalAccountId(id);
    setView("historical-ledger");
  }, [accounts]);
  const historicalLedgerAccounts = useMemo(() => {
    if (!historicalAccountId) return historicalAccounts;
    const selected = accounts.find((account) => String(account.id) === String(historicalAccountId));
    return selected ? [selected] : historicalAccounts;
  }, [accounts, historicalAccounts, historicalAccountId]);
  const historicalTrades = useMemo(() => {
    if (historicalAccountId) {
      const selected = accounts.find((account) => String(account.id) === String(historicalAccountId));
      return selected ? filterTradesForAccount(trades, selected) : [];
    }
    return filterTradesForAccounts(trades, historicalAccounts);
  }, [trades, accounts, historicalAccountId, historicalAccounts]);
  const closeHistoricalLedger = useCallback(() => {
    setView("propfirm");
  }, []);

  const compliance = usePropFirmCompliance(activeTrades, activeAccountSettings);
  const complianceAlerts = useComplianceAlerts(compliance, `${session?.user?.id || "anonymous"}:${activeAccountId}`);
  const saveActiveSettings = useCallback(async (nextSettings) => {
    // Supabase settings are the legacy/global source for the primary account.
    // Secondary prop accounts are scoped to the portfolio and must not overwrite
    // the primary account's settings.
    if (activeAccountId === "primary") {
      await applySettings(nextSettings);
    }
    updateAccount(activeAccountId, nextSettings);
  }, [applySettings, updateAccount, activeAccountId]);

  const handleAccountSelect = useCallback(async (accountId) => {
    const target = accounts.find((account) => account.id === accountId);
    if (!target) return;
    selectAccount(accountId);
    // Only the primary account is backed by the legacy global settings row.
    // Secondary accounts already have their own settings object in the portfolio.
    if (accountId === "primary") {
      try {
        await applySettings(target.settings);
      } catch (error) {
        console.error("Failed to sync primary account settings:", error);
      }
    }
  }, [accounts, selectAccount, applySettings]);

  const handleCreateAccount = useCallback((settings, options = {}) => {
    // Account profiles are independent. Do not write a newly-created account
    // into the legacy global settings row or it will overwrite the primary account.
    return createAccount(settings, options);
  }, [createAccount]);

  const activeChecklist = useMemo(
    () => getSetupChecksForUser(session?.user?.email),
    [session?.user?.email]
  );
  const analysisTrades = dashboardTrades;
  const analysisSettings = dashboardAccount?.settings || activeAccountSettings;
  const stats = usePerformanceStats(activeTrades, activeChecklist);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      setThemeValue(next);
      return next;
    });
  }, []);

  const s = useMemo(() => ({
    card: { background: `linear-gradient(135deg,${V.surface} 0%,${V.bg} 100%)`, borderRadius: V.radiusLg, padding: "1.25rem", border: `0.5px solid ${V.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" },
    th: { fontSize: 13, color: V.muted, textTransform: "uppercase", letterSpacing: "0.04em", padding: "12px 14px", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" },
    td: { fontSize: 15, padding: "14px 14px", borderTop: `0.5px solid ${V.border}`, verticalAlign: "middle" },
    ilbl: { display: "block", fontSize: 12, color: V.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" },
    inp: { fontSize: 14, padding: "8px 12px", width: "100%", boxSizing: "border-box", background: V.surface, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text },
  }), [V]);

  const showToast = useCallback((message, tone = "success") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const resolveAccountReference = useCallback((reference) => {
    if (reference == null || reference === "" || reference === "all") return null;

    const candidates = [];
    const addCandidate = (value) => {
      if (value == null || value === "") return;
      if (typeof value === "string" || typeof value === "number") {
        const text = String(value);
        if (text !== "[object Object]") candidates.push(text);
        return;
      }
      if (typeof value === "object") {
        // Handle every account shape used by the app and by older cached data.
        addCandidate(value.account_id);
        addCandidate(value.accountId);
        addCandidate(value.id);
        addCandidate(value.account_uuid);
        addCandidate(value.accountUuid);
        addCandidate(value.uuid);
        addCandidate(value.account);
        addCandidate(value.value);
      }
    };
    addCandidate(reference);

    for (const candidate of candidates) {
      const match = accounts.find((account) =>
        String(account?.id || "") === candidate
        || String(account?.accountId || "") === candidate
        || String(account?.uuid || "") === candidate
        || String(account?.accountUuid || "") === candidate
      );
      if (match) return match;
    }
    return null;
  }, [accounts]);

  const openAdd = useCallback((requestedAccountId = null) => {
    // Resolve the complete account object before storing trade-entry context.
    // Never stringify an account object: String(accountObject) produces the
    // literal "[object Object]", which was the corruption seen in Supabase.
    const requestedAccount = resolveAccountReference(requestedAccountId);
    const dashboardTarget = dashboardAccountId !== "all"
      ? resolveAccountReference(dashboardAccountId)
      : null;
    const activeTarget = resolveAccountReference(activeAccountId);
    const nextAccount = requestedAccount || dashboardTarget || activeTarget;
    setTradeEntryAccountId(nextAccount?.id || null);
    setEditing(null);
    setShowModal(false);
    setShowGuidedModal(true);
  }, [dashboardAccountId, activeAccountId, resolveAccountReference]);

  const openEdit = useCallback((trade) => {
    // Existing trades must always retain their own account identity while editing.
    const account = resolveAccountReference(trade?.accountId ?? trade?.account_id ?? trade?.accountUuid ?? trade?.account_uuid);
    setTradeEntryAccountId(account?.id || null);
    setEditing(trade);
    setShowModal(true);
  }, [resolveAccountReference]);
  const closeTradeModal = useCallback(() => { setShowModal(false); setTradeEntryAccountId(null); }, []);
  const closeGuidedModal = useCallback(() => { setShowGuidedModal(false); setTradeEntryAccountId(null); }, []);
  const closeChart = useCallback(() => setViewingChart(null), []);
  const handleViewChange = useCallback((nextView) => { setView(nextView); setMobileNavOpen(false); }, []);
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      showToast(error?.message || "Unable to sign out.", "error");
    }
  }, [showToast]);

  const saveTrade = useCallback(async (trade) => {
    try {
      // Existing trades keep their persisted account. New trades use the explicit
      // entry context captured when the Add Trade action was opened. This is the
      // critical fix for PA-APEX-18 being accidentally saved into APEX-21 when
      // the Account Center's active account is stale/different from the Dashboard
      // or Journal Ledger selection.
      // Account references coming from UI components may occasionally be a full
      // account object rather than the account's string key. Never allow an
      // object to reach Supabase as `account_id` (which becomes "[object Object]")
      // and never infer the canonical UUID from the object's legacy `id`.
      const rawTradeAccountRef = trade?.accountId ?? trade?.account_id ?? trade?.accountUuid ?? trade?.account_uuid;
      const explicitTradeAccount = resolveAccountReference(rawTradeAccountRef);
      const entryAccount = resolveAccountReference(tradeEntryAccountId);
      const dashboardTarget = dashboardAccountId !== "all" ? resolveAccountReference(dashboardAccountId) : null;
      const activeTarget = resolveAccountReference(activeAccountId) || activeAccount || null;

      // Existing trade account wins; otherwise the explicit Add Trade context
      // wins, followed by Dashboard and finally Account Center. Every route
      // resolves to the canonical account record before persistence.
      // An EXISTING trade must never be re-homed: if its own account can't be resolved, refuse.
      if (trade?.id && rawTradeAccountRef && !explicitTradeAccount) {
        throw new Error("This trade's account could not be found (it may have been deleted). Restore or re-create the account before editing this trade.");
      }
      const persistedTradeAccount = explicitTradeAccount || entryAccount || dashboardTarget || activeTarget;
      if (!persistedTradeAccount?.id || persistedTradeAccount.id === "[object Object]") {
        throw new Error("Unable to resolve the selected trading account. Please select an account and try again.");
      }

      let tradePlanLink = {};
      // New trades only inherit today's plan after the user explicitly selected
      // "Record with today's plan" on the first Trade Log screen. Choosing
      // "Go without trading plan" intentionally leaves the relationship empty.
      // Existing trades keep their persisted relationship/snapshot unchanged.
      const todayIso = new Date().toISOString().slice(0, 10);
      if (!trade?.id && trade?.date && String(trade.date).slice(0, 10) === todayIso && todayTradingPlanMode === "with-plan") {
        try {
          const activePlan = await fetchTradingPlanByDateDb(trade.date);
          if (activePlan?.id) {
            tradePlanLink = {
              tradingPlanId: activePlan.id,
              tradingPlanSnapshot: {
                planDate: activePlan.plan_date,
                marketBias: activePlan.market_bias || "",
                setupFocus: activePlan.setup_focus || "",
                keyLevels: activePlan.key_levels || "",
                maxRisk: Number(activePlan.max_risk || 0),
                maxTrades: Number(activePlan.max_trades || 0),
                newsFocus: activePlan.news_focus || "",
                rulesConfirmed: Boolean(activePlan.rules_confirmed),
                setupChecklist: activePlan.setup_checklist && typeof activePlan.setup_checklist === "object" ? activePlan.setup_checklist : {},
              },
            };
          }
        } catch (planError) {
          // A missing/unavailable plan must never block trade journaling.
          console.warn("Trading plan link skipped for new trade:", planError);
        }
      }

      const tradePayload = {
        ...trade,
        ...tradePlanLink,
        accountId: String(persistedTradeAccount.id),
        accountUuid: String(persistedTradeAccount.accountUuid || persistedTradeAccount.uuid || ""),
      };

      await persistTrade(tradePayload);
      setShowModal(false);
      setEditing(null);
      setShowGuidedModal(false);
      setTradeEntryAccountId(null);
      const savedAccount = persistedTradeAccount;
      const accountSettings = savedAccount?.settings || activeAccountSettings || {};
      const isEvaluation = String(accountSettings.accountStage || "evaluation").toLowerCase() !== "funded";
      const isAlreadyPassed = String(accountSettings.evaluationStatus || "").toLowerCase() === "passed";
      const isBlown = String(accountSettings.accountStatus || "").toLowerCase().includes("blown");

      // Evaluate the just-saved trade against the account's actual risk rules before
      // deciding whether to show the evaluation-cleared prompt. This is especially
      // important for intraday-trailing accounts: a trade can reach a favorable peak,
      // lift the high-water mark, and then close at a loss that breaches the new
      // trailing threshold. That is a blown account, not a passed evaluation.
      let breachedAccount = false;
      if (!trade?.id && isEvaluation && !isAlreadyPassed && !isBlown) {
        try {
          const scopedTrades = filterTradesForAccount(trades, savedAccount);
          const candidateTrades = [...(scopedTrades || []).filter((item) => item?.id !== trade?.id), tradePayload];
          const postTradeCompliance = calculatePropFirmCompliance(candidateTrades, accountSettings);
          const dailyLossBreached = postTradeCompliance?.dailyLossLimit != null
            && postTradeCompliance.dailyLossUsed > postTradeCompliance.dailyLossLimit;
          const drawdownBreached = postTradeCompliance?.drawdownLimit != null
            && postTradeCompliance.projectedDrawdown > postTradeCompliance.drawdownLimit;
          breachedAccount = Boolean(dailyLossBreached || drawdownBreached);

          if (breachedAccount) {
            const now = new Date().toISOString();
            const nextSettings = {
              ...accountSettings,
              accountStatus: "Blown",
              blowStatusOverride: "",
              blowMarkedAt: now,
              blowReview: {
                ...(accountSettings.blowReview || {}),
                reason: drawdownBreached
                  ? (postTradeCompliance.intradayTrailing ? "Trailing Threshold Breached" : "Maximum Drawdown Breached")
                  : "Daily Loss Limit Breached",
                mistakes: Array.isArray(accountSettings.blowReview?.mistakes) ? accountSettings.blowReview.mistakes : [],
                whatHappened: accountSettings.blowReview?.whatHappened || "Automatically detected from the saved trade.",
                nextTime: accountSettings.blowReview?.nextTime || "",
                equityAtBreach: Number(postTradeCompliance.currentEquity || 0),
                highWaterMarkAtBreach: Number(postTradeCompliance.highWaterMark || 0),
                trailingThresholdAtBreach: postTradeCompliance.trailingThreshold,
                currentDrawdownAtBreach: Number(postTradeCompliance.currentDrawdown || 0),
                netPnlAtBreach: Number(postTradeCompliance.loggedPnl || 0),
                tradeCountAtBreach: candidateTrades.length,
                automatic: true,
              },
            };
            updateAccount(persistedTradeAccount.id, nextSettings);
            setPostTradeEvaluationPrompt(false);
          } else {
            setPostTradeEvaluationPrompt(true);
          }
        } catch (complianceError) {
          console.warn("Post-trade compliance check failed; leaving evaluation prompt available:", complianceError);
          setPostTradeEvaluationPrompt(true);
        }
      }
      if (trade?.id) {
        showToast("Trade updated successfully.");
      } else if (breachedAccount) {
        const scopedTrades = filterTradesForAccount(trades, savedAccount);
        const candidateTrades = [...(scopedTrades || []).filter((item) => item?.id !== trade?.id), tradePayload];
        const postTradeCompliance = calculatePropFirmCompliance(candidateTrades, accountSettings);
        const drawdownBreached = postTradeCompliance?.drawdownLimit != null
          && postTradeCompliance.projectedDrawdown > postTradeCompliance.drawdownLimit;
        showToast(
          drawdownBreached
            ? (postTradeCompliance.intradayTrailing ? "Trade saved. Trailing threshold breached — account marked blown." : "Trade saved. Maximum drawdown breached — account marked blown.")
            : "Trade saved. Daily loss limit breached — account marked blown.",
          "error",
        );
      } else {
        showToast("Trade saved successfully.");
      }
    } catch (error) {
      showToast(error?.message || "Unable to save trade.", "error");
      throw error;
    }
  }, [persistTrade, showToast, activeAccountId, activeAccount, activeAccountSettings, activeTrades, accounts, dashboardAccountId, tradeEntryAccountId, todayTradingPlanMode, trades, updateAccount, resolveAccountReference]);

  const markActiveEvaluationPassedFromPrompt = useCallback(() => {
    const passedAt = new Date().toISOString();
    const nextSettings = {
      ...(activeAccount?.settings || activeAccountSettings || {}),
      evaluationStatus: "passed",
      evaluationPassedAt: passedAt,
      accountStatus: "Active",
      blowStatusOverride: "active",
    };
    updateAccount(activeAccountId, nextSettings);
    addAccountNotification(session?.user?.id || "anonymous", {
      id: `evaluation-passed:${activeAccountId}:${passedAt}`,
      type: "evaluation-passed",
      accountId: activeAccountId,
      title: "Evaluation cleared",
      detail: `${nextSettings.accountLabel || nextSettings.accountId || nextSettings.accountName || "Your account"} has been cleared and marked as passed.`,
      createdAt: passedAt,
    });
    setPostTradeEvaluationPrompt(false);
    showToast("Evaluation marked as passed.");
    setView("propfirm");
  }, [activeAccount, activeAccountSettings, activeAccountId, updateAccount, session?.user?.id, showToast]);

  const openNewAccountFromTradePrompt = useCallback(() => {
    setPostTradeEvaluationPrompt(false);
    setView("propfirm");
  }, []);

  const handleDeleteTrade = useCallback(async (id) => {
    try {
      await deleteTrade(id);
      showToast("Trade deleted.");
    } catch (error) {
      showToast(error?.message || "Unable to delete trade.", "error");
    }
  }, [deleteTrade, showToast]);

  const saveMissedTrade = useCallback(async (trade, previousTrade) => {
    try {
      await persistMissedTrade(trade, previousTrade);
      showToast(trade?.id ? "Missed trade updated." : "Missed trade saved.");
    } catch (error) {
      showToast(error?.message || "Unable to save missed trade.", "error");
    }
  }, [persistMissedTrade, showToast]);

  const handleDeleteMissedTrade = useCallback(async (id) => {
    try {
      await deleteMissedTrade(id);
      showToast("Missed trade deleted.");
    } catch (error) {
      showToast(error?.message || "Unable to delete missed trade.", "error");
    }
  }, [deleteMissedTrade, showToast]);

  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([refreshData(), refreshAccounts()]);
      showToast("Workspace data refreshed.");
    } catch (error) {
      showToast(error?.message || "Unable to refresh data.", "error");
    }
  }, [refreshData, refreshAccounts, showToast]);

  if (!loaded || authLoading) {
    return <PageLoading />;
  }
  if (!session) return <LoginScreen />;

  return (
    <div className={`app-theme-${theme}`} style={{ display: "flex", background: V.bg, height: "100vh", minHeight: 0, fontFamily: V.font, color: V.text }}>
      <div className="td-mobile-bar">
        <button type="button" className="td-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">☰</button>
        <span className="td-mobile-title">TradeLog</span>
      </div>
      {mobileNavOpen && <button type="button" className="td-mobile-overlay" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.46.0/tabler-icons.min.css" />
      <KeyboardShortcuts onNewTrade={openAdd} onRisk={() => handleViewChange("risk")} onAnalytics={() => handleViewChange("analytics")} onTradeLog={() => handleViewChange("trades")} />
      <Sidebar view={view} setView={handleViewChange} mobileOpen={mobileNavOpen} onAdd={openAdd} theme={theme} toggleTheme={toggleTheme} alertCount={complianceAlerts.activeAlerts.length} />
      <main className="tl-main-shell" style={{ flex: 1, minWidth: 0, minHeight: 0, height: "100vh", overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        <Suspense fallback={<PageLoading compact />}>        {view === "dashboard" && <TradeJournalDashboard trades={dashboardTrades} allTrades={trades} stats={stats} onAdd={openAdd} setView={setView} apexSettings={dashboardAccount?.settings || activeAccountSettings} theme={theme} toggleTheme={toggleTheme} missedTrades={missedTrades} onRefresh={handleRefresh} accounts={dashboardActiveAccounts} filterAccounts={accounts} activeAccount={dashboardAccount} activeAccountId={dashboardAccountId} accountStatusFilter={dashboardAccountStatusFilter} onAccountStatusFilterChange={setDashboardAccountStatusFilter} onSelectAccount={handleDashboardAccountSelect} session={session} onOpenProfile={() => handleViewChange("profile")} />}
        {view === "trades" && <TradeLog userId={session?.user?.id} checklist={activeChecklist} todayPlanMode={todayTradingPlanMode} onPlanModeChange={setTodayPlanMode} onOpenTradingPlan={() => handleViewChange("plan")} trades={filterTradesForAccounts(trades, dashboardActiveAccounts)} accounts={dashboardActiveAccounts} initialAccountId={dashboardAccountId} initialMonthFilter="all" onEdit={openEdit} onDelete={handleDeleteTrade} onAdd={openAdd} onViewChart={setViewingChart} theme={theme} toggleTheme={toggleTheme} onOpenProfile={() => handleViewChange("profile")} onSignOut={handleSignOut} />}
        {view === "sltp" && <Suspense fallback={<div style={{ padding: "2rem", color: V.muted }}>Loading…</div>}><SLTPCalculator s={s} /></Suspense>}
        {view === "analytics" && <Analytics trades={analysisTrades} s={s} />}
        {view === "calendar" && <CalendarView trades={analysisTrades} s={s} checklist={activeChecklist} theme={theme} onLoadImages={loadTradeImages} />}
        {view === "news" && <NewsCalendar s={s} />}
        {view === "portfolio" && <PortfolioCenter accounts={accounts} activeAccountId={activeAccountId} selectAccount={handleAccountSelect} createAccount={handleCreateAccount} removeAccount={removeAccount} renameAccount={renameAccount} trades={trades} s={s} />}
        {view === "account" && <AccountCenter trades={activeTrades} s={s} settings={activeAccountSettings} />}
        {view === "propfirm" && <PropFirmSetup userId={session?.user?.id || "anonymous"} settings={activeAccountSettings} onSave={saveActiveSettings} onCreateAccount={handleCreateAccount} onRemoveAccount={removeAccount} onUpdateAccount={updateAccount} onClose={() => handleViewChange("dashboard")} accounts={accounts} activeAccountId={activeAccountId} trades={trades} s={s} onReviewTrades={openHistoricalLedger} theme={theme} />}
        {view === "historical-ledger" && <TradeLog userId={session?.user?.id} trades={historicalTrades} accounts={historicalLedgerAccounts} initialAccountId={historicalAccountId || (historicalLedgerAccounts[0]?.id || "all")} initialMonthFilter="all" onViewChart={setViewingChart} theme={theme} toggleTheme={toggleTheme} onOpenProfile={() => handleViewChange("profile")} onSignOut={handleSignOut} onBack={closeHistoricalLedger} backLabel="Back to Account Center" />}
        {view === "compliance" && <ComplianceCenter trades={activeTrades} settings={activeAccountSettings} s={s} />}
        {view === "alerts" && <ComplianceAlerts trades={activeTrades} settings={activeAccountSettings} s={s} userId={session?.user?.id} alertState={complianceAlerts} />}
        {view === "apex" && <ApexDashboard trades={activeTrades} s={s} settings={activeAccountSettings} />}
        {view === "apexsettings" && <ApexSettings settings={activeAccountSettings} onSave={saveActiveSettings} s={s} />}
        {view === "edge" && <EdgeAnalysis trades={analysisTrades} s={s} checklist={activeChecklist} />}
        {view === "intelligence" && <TradeIntelligence trades={analysisTrades} s={s} checklist={activeChecklist} />}
        {view === "journalintelligence" && <JournalIntelligence trades={analysisTrades} s={s} onViewTrade={openEdit} onViewChart={setViewingChart} />}
        {view === "plan" && <TradingPlan trades={analysisTrades} userId={session?.user?.id} s={s} theme={theme} />}
        {view === "risk" && <RiskManager trades={analysisTrades} settings={analysisSettings} />}
        {view === "review" && <TradeReview trades={analysisTrades} s={s} theme={theme} onViewChart={setViewingChart} onLoadImages={loadTradeImages} />}
        {view === "charts" && <ChartWorkspace trades={analysisTrades} onAdd={openAdd} s={s} />}
        {view === "playbook" && <Playbook trades={trades} accounts={accounts} activeAccount={activeAccount} theme={theme} s={s} onNavigate={handleViewChange} onAdd={openAdd} />}
        {view === "data" && <DataCenter trades={trades} missedTrades={missedTrades} accounts={accounts} apexSettings={activeAccountSettings} />}
        {view === "missed" && <MissedTrades missedTrades={missedTrades} onSave={(trade) => persistMissedTrade({ ...trade, accountId: trade.accountId || activeAccountId })} onDelete={handleDeleteMissedTrade} s={s} />}
        {view === "profile" && <ProfileCenter session={session} theme={theme} toggleTheme={toggleTheme} onSignOut={handleSignOut} s={s} />}
        </Suspense>
      </main>
      {showModal && <Suspense fallback={null}><TradeModal trade={editing} onSave={saveTrade} onClose={closeTradeModal} s={s} checklist={activeChecklist} trades={filterTradesForAccount(trades, accounts.find((account) => String(account.id) === String(editing?.accountId || editing?.account_id || tradeEntryAccountId)) || activeAccount)} settings={(accounts.find((account) => String(account.id) === String(editing?.accountId || editing?.account_id || tradeEntryAccountId)) || activeAccount)?.settings || activeAccountSettings} /></Suspense>}
      {showGuidedModal && <Suspense fallback={null}><GuidedEntryModal onSave={saveTrade} onClose={closeGuidedModal} s={s} checklist={activeChecklist} todayPlanMode={todayTradingPlanMode} onPlanModeChange={setTodayPlanMode} onOpenTradingPlan={() => { closeGuidedModal(); handleViewChange("plan"); }} settings={(accounts.find((account) => String(account.id) === String(tradeEntryAccountId)) || (dashboardAccountId !== "all" ? dashboardAccount : activeAccount))?.settings || activeAccountSettings} /></Suspense>}
      {viewingChart && <Suspense fallback={null}><ChartPreview trade={viewingChart} onClose={closeChart} s={s} /></Suspense>}
      {postTradeEvaluationPrompt && (
        <div className="td-post-trade-overlay" role="dialog" aria-modal="true" aria-label="Evaluation status">
          <div className="td-post-trade-modal">
            <div className="td-post-trade-eyebrow">TRADE SAVED</div>
            <h2>Did this trade clear your evaluation?</h2>
            <p>If the evaluation is cleared, mark it as <strong>Passed</strong> and then add the new funded account separately.</p>
            <div className="td-post-trade-actions">
              <button type="button" className="td-post-trade-primary" onClick={markActiveEvaluationPassedFromPrompt}>Yes, mark passed</button>
              <button type="button" className="td-post-trade-secondary" onClick={openNewAccountFromTradePrompt}>Open account setup</button>
              <button type="button" className="td-post-trade-dismiss" onClick={() => setPostTradeEvaluationPrompt(false)}>Not now</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`td-toast-viewport`} aria-live="polite" aria-atomic="true">
          <div className={`td-toast td-toast-${toast.tone}`} role="status">
            <span className="td-toast-icon" aria-hidden="true">{toast.tone === "error" ? "!" : "✓"}</span>
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification">×</button>
          </div>
        </div>
      )}
    </div>
  );
}

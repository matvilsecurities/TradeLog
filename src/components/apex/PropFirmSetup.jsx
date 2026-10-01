import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePropFirmRules } from "../../hooks/usePropFirmRules.js";
import { filterTradesForAccount } from "../../hooks/useAccountPortfolio.js";
import { calculatePropFirmCompliance } from "../../services/propFirmCompliance.js";
import { addAccountNotification } from "../../utils/accountNotifications.js";

const money = (v) => Number.isFinite(Number(v)) ? `$${Number(v).toLocaleString()}` : (v ?? "—");
const purchasePaid = (account) => Number(account?.settings?.purchasePrice ?? account?.settings?.accountPurchasePrice ?? 0) || 0;
const activationPaid = (account) => Number(account?.settings?.activationFeePaid ?? account?.settings?.accountActivationFeePaid ?? 0) || 0;
const totalInvested = (account) => purchasePaid(account) + activationPaid(account);

const ruleRows = (rules = {}) => [
  ["Profit target", rules.profitTarget != null ? money(rules.profitTarget) : rules.profitTargetPct != null ? `${rules.profitTargetPct}%` : "—", "i-target"],
  ["Maximum loss / drawdown", rules.maxDrawdown != null ? money(rules.maxDrawdown) : rules.maxLossPct != null ? `${rules.maxLossPct}%` : "—", "i-down"],
  ["Daily loss", rules.dailyLossLimit != null ? money(rules.dailyLossLimit) : rules.maxDailyLossPct != null ? `${rules.maxDailyLossPct}%` : rules.performanceDailyLossLimit ?? "—", "i-trend"],
  ["Consistency", rules.consistencyRule != null ? `${rules.consistencyRule}%` : rules.evaluationConsistencyRule != null ? `${rules.evaluationConsistencyRule}%` : "—", "i-percent"],
  ["Minimum trading days", rules.minTradingDays ?? "—", "i-calendar"],
  ["Evaluation period", rules.evaluationDays != null ? `${rules.evaluationDays} days` : "—", "i-clock"],
  ["Minimum profitable days", rules.minProfitableDays ?? "—", "i-calendar"],
  ["Minimum daily profit", rules.minDailyProfit != null ? money(rules.minDailyProfit) : "—", "i-dollar"],
  ["Max contracts", rules.maxContracts != null ? `${rules.maxContracts} mini${rules.maxMicros != null ? ` / ${rules.maxMicros} micro` : ""}` : "—", "i-file"],
  ["PA max contracts", rules.performanceMaxContracts != null ? `${rules.performanceMaxContracts} mini${rules.performanceMaxMicros != null ? ` / ${rules.performanceMaxMicros} micro` : ""}` : "—", "i-file"],
  ["PA max drawdown", rules.performanceMaxDrawdown != null ? money(rules.performanceMaxDrawdown) : "—", "i-down"],
  ["Activation fee", rules.activationFee != null ? money(rules.activationFee) : "—", "i-dollar"],
  ["Activation deadline", rules.activationDeadlineDays != null ? `${rules.activationDeadlineDays} days` : "—", "i-calendar"],
  ["Payout frequency", rules.payoutFrequencyDays != null ? `${rules.payoutFrequencyDays} trading days` : "—", "i-refresh"],
  ["Max accounts", rules.maxAccounts ?? "—", "i-users"],
  ["Inactivity", rules.inactivityDays ? `${rules.inactivityDays} days` : rules.inactivityPolicy ?? "—", "i-eyeoff"],
  ["Payout split", rules.payoutSplit != null ? `${rules.payoutSplit}%` : "—", "i-pie"],
  ["Max payout requests", rules.maxPayouts ?? "—", "i-upload"],
];

const pricingRows = (pricing) => pricing ? [
  ["One pack", money(pricing.onePack)],
  ["Five pack", money(pricing.fivePack)],
] : [];

const ICONS = {
  "i-target": <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4M22 12h-4M12 22v-4M2 12h4"/></>,
  "i-down": <><path d="M12 3v14M7 12l5 5 5-5"/><path d="M5 21h14"/></>,
  "i-trend": <><path d="M3 17l6-6 4 4 8-9"/><path d="M16 6h5v5"/></>,
  "i-percent": <><path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></>,
  "i-calendar": <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
  "i-clock": <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  "i-file": <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
  "i-dollar": <><path d="M12 2v20M16 6.5c-.8-1-2-1.5-4-1.5-2.5 0-4 1.2-4 3s1.5 3 4 3 4 1.2 4 3-1.5 3-4 3c-2 0-3.3-.5-4.2-1.7"/></>,
  "i-refresh": <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.2 9A7 7 0 0 1 19 12M18 15A7 7 0 0 1 5 12"/></>,
  "i-users": <><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-3.2 2.4-5 6-5s5.5 1.8 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c2.7.1 4.3 1.7 5 4"/></>,
  "i-eyeoff": <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11.5 11.5 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-3.1 3.8M6.2 6.2C3.9 7.8 3 12 3 12s3.5 7 9 7a9.5 9.5 0 0 0 3.1-.5"/></>,
  "i-pie": <><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M14 3a7 7 0 0 1 7 7h-7z"/></>,
  "i-upload": <><path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 14v5h14v-5"/></>,
};


function AccountDistributionGauge({ active, blown, total }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const activeCount = Math.max(0, Number(active) || 0);
  const blownCount = Math.max(0, Number(blown) || 0);
  const activePct = safeTotal > 0 ? (activeCount / safeTotal) * 100 : 0;
  const radius = 39;
  const circumference = Math.PI * radius;
  const gap = 1.5;
  const activeLength = safeTotal > 0 ? Math.max(0, (activePct / 100) * circumference - gap) : 0;
  const blownLength = safeTotal > 0 ? Math.max(0, ((100 - activePct) / 100) * circumference - gap) : circumference;
  const blownOffset = -(activePct / 100) * circumference;

  return (
    <div className="pf-distribution-gauge" aria-label={`${activeCount} active and ${blownCount} blown accounts`}>
      <svg viewBox="0 0 96 56" role="img" aria-hidden="true">
        <path className="pf-distribution-track" d="M 9 48 A 39 39 0 0 1 87 48" />
        <path className="pf-distribution-active" d="M 9 48 A 39 39 0 0 1 87 48" strokeDasharray={`${activeLength} ${circumference}`} strokeDashoffset="0" />
        <path className="pf-distribution-blown" d="M 9 48 A 39 39 0 0 1 87 48" strokeDasharray={`${blownLength} ${circumference}`} strokeDashoffset={blownOffset} />
      </svg>
      <div className="pf-distribution-center"><strong>{activePct.toFixed(0)}%</strong><span>Active</span></div>
      <div className="pf-distribution-counts"><span className="active"><i />{activeCount}</span><span className="blown"><i />{blownCount}</span></div>
    </div>
  );
}

export default function PropFirmSetup({ settings = {}, onSave, onCreateAccount, onRemoveAccount, onUpdateAccount, onClose, accounts = [], activeAccountId = "primary", trades = [], userId = "anonymous", onReviewTrades, theme = "light" }) {
  const { catalog, status, refresh } = usePropFirmRules(settings);
  const [firmId, setFirmId] = useState(settings.propFirmId || "");
  const [market, setMarket] = useState(settings.propMarket || settings.market || "");
  const [vendor, setVendor] = useState(settings.propVendor || "");
  const [accountVariant, setAccountVariant] = useState(settings.accountVariant || (settings.propPlanVariant === "Legacy" ? "legacy" : "new"));
  const [programId, setProgramId] = useState(settings.propProgramId || "");
  const [accountId, setAccountId] = useState(settings.accountId || "");
  const [accountLabel, setAccountLabel] = useState(settings.accountLabel || "");
  const [saved, setSaved] = useState(false);
  const [created, setCreated] = useState(false);
  const [customRules, setCustomRules] = useState(Array.isArray(settings.customRules) ? settings.customRules : []);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [showPassedPicker, setShowPassedPicker] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState(null);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [setupMode, setSetupMode] = useState("edit");
  const [purchasePrice, setPurchasePrice] = useState(settings.purchasePrice ?? settings.accountPurchasePrice ?? "");
  const [activationFeePaid, setActivationFeePaid] = useState(settings.activationFeePaid ?? "");
  const [evaluationStatus, setEvaluationStatus] = useState(settings.evaluationStatus || "in-progress");
  const [accountStage, setAccountStage] = useState(settings.accountStage || "evaluation");
  const [fundedAccountName, setFundedAccountName] = useState(settings.fundedAccountName || "");
  const [fundedAccountNumber, setFundedAccountNumber] = useState(settings.fundedAccountNumber || "");
  const [fundedFromEvaluationId, setFundedFromEvaluationId] = useState(settings.fundedFromEvaluationId || "");
  const [setupIntent, setSetupIntent] = useState("account");
  const [portfolioNotice, setPortfolioNotice] = useState("");
  const [blowReviewAccountId, setBlowReviewAccountId] = useState(null);
  const [blowReason, setBlowReason] = useState("");
  const [blowMistakes, setBlowMistakes] = useState([]);
  const [blowWhatHappened, setBlowWhatHappened] = useState("");
  const [blowNextTime, setBlowNextTime] = useState("");
  const [costEditAccountId, setCostEditAccountId] = useState(null);
  const [costPurchasePrice, setCostPurchasePrice] = useState("");
  const [costActivationFee, setCostActivationFee] = useState("");
  const initialAccountRef = useRef(activeAccountId);

  const firm = useMemo(() => catalog.find((f) => f.id === firmId), [catalog, firmId]);
  const marketOptions = useMemo(() => firm?.markets || [], [firm]);
  const showVariantSelector = Boolean(firm?.variants?.length);
  const variantOptions = useMemo(() => (firm?.variants || []).map((label) => ({ value: label.toLowerCase().includes("legacy") ? "legacy" : "new", label })), [firm]);
  const vendors = useMemo(() => {
    if (!firm || !market) return [];
    const configured = firm.vendorOptions?.[market] || [];
    const programVendors = (firm.programs || []).filter((p) => !p.market || p.market === market).map((p) => p.vendor).filter(Boolean);
    return [...new Set([...configured, ...programVendors])];
  }, [firm, market]);
  const availablePrograms = useMemo(() => (firm?.programs || []).filter((p) => {
    if (market && p.market && p.market !== market) return false;
    if (showVariantSelector && p.accountVariant && p.accountVariant !== accountVariant) return false;
    if (vendor && p.vendor && p.vendor !== vendor) return false;
    return true;
  }), [firm, market, vendor, accountVariant, showVariantSelector]);
  const program = useMemo(() => availablePrograms.find((p) => p.id === programId), [availablePrograms, programId]);
  const isFundedCreation = setupMode === "add" && setupIntent === "funded" && Boolean(fundedFromEvaluationId);

  useEffect(() => {
    // Add-account opens before the rules catalog may have finished loading.
    // Initialize only the first firm; the remaining choices intentionally stay
    // empty so the user follows the firm → market → vendor → variant → program flow.
    if (showSetupForm && setupMode === "add" && catalog.length && !firmId) {
      setFirmId(catalog[0]?.id || "");
      return;
    }
    if (!firm) return;
    const configuredProgram = firm.programs?.find((p) => p.id === programId);
    if (setupMode === "edit" && !market && configuredProgram?.market) {
      setMarket(configuredProgram.market);
      return;
    }
    if (!marketOptions.includes(market)) {
      if (setupMode === "add") {
        setMarket("");
        setVendor("");
        setProgramId("");
      }
      return;
    }
    if (setupMode === "edit" && !vendor && market) {
      const configuredVendor = configuredProgram?.vendor || vendors[0] || "";
      if (configuredVendor) {
        setVendor(configuredVendor);
        return;
      }
    }
    if (setupMode === "edit" && showVariantSelector && configuredProgram?.accountVariant && configuredProgram.accountVariant !== accountVariant) {
      setAccountVariant(configuredProgram.accountVariant);
      return;
    }
    if (showVariantSelector && !variantOptions.some((option) => option.value === accountVariant)) {
      setAccountVariant(variantOptions[0]?.value || "new");
      setProgramId("");
      return;
    }
    if (market && vendors.length && !vendors.includes(vendor)) {
      setVendor("");
      setProgramId("");
      return;
    }
    if (!availablePrograms.some((p) => p.id === programId)) setProgramId("");
  }, [firm, marketOptions, market, vendors, vendor, availablePrograms, programId, catalog, firmId, showSetupForm, setupMode, showVariantSelector, variantOptions, accountVariant]);

  useEffect(() => {
    setAccountId(settings.accountId || "");
    setAccountLabel(settings.accountLabel || "");
    setPurchasePrice(settings.purchasePrice ?? settings.accountPurchasePrice ?? "");
    setActivationFeePaid(settings.activationFeePaid ?? "");
    setEvaluationStatus(settings.evaluationStatus || "in-progress");
    setAccountStage(settings.accountStage || "evaluation");
    setFundedAccountName(settings.fundedAccountName || "");
    setFundedAccountNumber(settings.fundedAccountNumber || "");
    setFundedFromEvaluationId(settings.fundedFromEvaluationId || "");
    setMarket(settings.propMarket || settings.market || "");
    setAccountVariant(settings.accountVariant || (settings.propPlanVariant === "Legacy" ? "legacy" : "new"));
  }, [settings.accountId, settings.accountLabel, settings.purchasePrice, settings.accountPurchasePrice, settings.activationFeePaid, settings.propMarket, settings.market, settings.accountVariant, settings.propPlanVariant, settings.evaluationStatus, settings.evaluationPassedAt, settings.accountStage, settings.fundedAccountName, settings.fundedAccountNumber, settings.fundedFromEvaluationId]);

  useEffect(() => {
    if (initialAccountRef.current !== activeAccountId) {
      initialAccountRef.current = activeAccountId;
      // Switching accounts opens the editor, never the All Accounts directory.
      setShowAllAccounts(false);
      setDetailAccountId(null);
      setSetupMode("edit");
      setSetupIntent("account");
      setShowSetupForm(true);
    }
  }, [activeAccountId]);

  const buildSettings = () => {
    if (!firm || !program) return null;
    const r = program.rules || {};
    const generatedName = `${firm.name} · ${program.shortName || program.name}`;
    return {
      ...settings,
      propFirmId: firm.id,
      propFirm: firm.name,
      propProgramId: program.id,
      propProgram: program.name,
      propVendor: program.vendor || vendor || "",
      propMarket: market,
      market,
      accountVariant,
      platform: program.platform || vendor || settings.platform || "",
      propProgramFamily: program.programFamily || "",
      propPlanVariant: program.feeMode || (program.id.includes("no-activation") ? "No Activation Fee" : program.id.includes("legacy") ? "Legacy" : "Standard"),
      propPricing: program.pricing || null,
      propRules: r,
      propRulesSource: firm.source,
      propRulesVerifiedAt: new Date().toISOString(),
      accountId: accountId.trim(),
      accountLabel: accountLabel.trim(),
      accountName: accountLabel.trim() || generatedName,
      purchasePrice: Number(purchasePrice) || 0,
      accountPurchasePrice: Number(purchasePrice) || 0,
      activationFeePaid: Number(activationFeePaid) || 0,
      evaluationStatus,
      accountStage,
      fundedAccountName: fundedAccountName.trim(),
      fundedAccountNumber: fundedAccountNumber.trim(),
      ...(fundedFromEvaluationId ? { fundedFromEvaluationId } : {}),
      ...(evaluationStatus === "passed" ? { evaluationPassedAt: settings.evaluationPassedAt || new Date().toISOString() } : {}),
      customRules: customRules.filter((rule) => rule.label?.trim() || rule.value?.trim()),
      ...(program.accountSize ? { accountSize: program.accountSize } : {}),
      ...(r.maxDrawdown != null ? { maxDrawdown: r.maxDrawdown } : {}),
      ...(r.dailyLossLimit != null ? { dailyLossLimit: r.dailyLossLimit } : {}),
      ...(r.profitTarget != null ? { profitTarget: r.profitTarget } : {}),
      ...(r.consistencyRule != null ? { consistencyRule: r.consistencyRule } : {}),
      ...(r.minTradingDays != null ? { minTradingDays: r.minTradingDays } : {}),
      ...(r.minProfitableDays != null ? { minProfitableDays: r.minProfitableDays } : {}),
      ...(r.minDailyProfit != null ? { minDailyProfit: r.minDailyProfit } : {}),
    };
  };

  // Reference labels: Program / Account Type; Apply Rules & Start Journal.
  // Legacy action retained for compatibility.
  const applyRules = async () => {
    const next = buildSettings();
    if (!next) return;
    await onSave(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const createFundedAccountFromEvaluation = async (evaluationAccountId) => {
    const sourceRow = portfolioRows.find((row) => row.account.id === evaluationAccountId);
    if (!sourceRow || !onCreateAccount) return;
    const sourceSettings = sourceRow.account.settings || {};
    const name = fundedAccountName.trim();
    const number = fundedAccountNumber.trim();
    if (!name || !number) {
      setPortfolioNotice("Enter the funded account name and account number first.");
      window.setTimeout(() => setPortfolioNotice(""), 3000);
      return;
    }
    if (String(activationFeePaid).trim() === "") {
      setPortfolioNotice("Enter the activation fee paid for the funded account.");
      window.setTimeout(() => setPortfolioNotice(""), 3000);
      return;
    }
    const now = new Date().toISOString();
    const fundedSettings = {
      ...sourceSettings,
      accountName: name,
      accountLabel: name,
      accountId: number,
      accountStage: "funded",
      evaluationStatus: "not-applicable",
      fundedAccountName: name,
      fundedAccountNumber: number,
      activationFeePaid: Number(activationFeePaid) || 0,
      accountActivationFeePaid: Number(activationFeePaid) || 0,
      fundedFromEvaluationId: evaluationAccountId,
      fundedAt: now,
      evaluationPassedAt: sourceSettings.evaluationPassedAt || now,
    };
    const account = onCreateAccount(fundedSettings, { inheritBase: false });
    if (account?.id) {
      setFundedFromEvaluationId(evaluationAccountId);
      setAccountStage("funded");
      addAccountNotification(userId, {
        id: `funded-account-created:${account.id}:${now}`,
        type: "funded-account-created",
        accountId: account.id,
        title: "Funded account added",
        detail: `${name} (${number}) was created from the cleared evaluation account.`,
        createdAt: now,
      });
      setShowSetupForm(false);
      setShowAllAccounts(false);
      setDetailAccountId(null);
      setPortfolioNotice("Funded account added successfully.");
      window.setTimeout(() => setPortfolioNotice(""), 2600);
    }
  };

  const createAccountFromSetup = async () => {
    if (setupIntent === "funded" && fundedFromEvaluationId) {
      await createFundedAccountFromEvaluation(fundedFromEvaluationId);
      return;
    }
    const next = buildSettings();
    if (!next) return;

    if (setupMode === "edit") {
      if (!onSave) return;
      const wasPassed = String(settings.evaluationStatus || "").toLowerCase() === "passed";
      await onSave(next);
      if (evaluationStatus === "passed" && !wasPassed) {
        addAccountNotification(userId, {
          id: `evaluation-passed:${activeAccountId}:${next.evaluationPassedAt || new Date().toISOString()}`,
          type: "evaluation-passed",
          accountId: activeAccountId,
          title: "Evaluation cleared",
          detail: `${next.accountLabel || next.accountId || next.accountName || "Your account"} has been marked as passed.`,
          createdAt: next.evaluationPassedAt || new Date().toISOString(),
        });
      }
      setShowSetupForm(false);
      setShowAllAccounts(false);
      setDetailAccountId(null);
      setPortfolioNotice("Account changes saved successfully.");
      window.setTimeout(() => setPortfolioNotice(""), 2600);
      return;
    }

    if (!onCreateAccount) return;
    const account = onCreateAccount(next, { inheritBase: false });
    if (account?.id) {
      if (evaluationStatus === "passed") {
        addAccountNotification(userId, {
          id: `evaluation-passed:${account.id}:${next.evaluationPassedAt || new Date().toISOString()}`,
          type: "evaluation-passed",
          accountId: account.id,
          title: "Evaluation cleared",
          detail: `${next.accountLabel || next.accountId || next.accountName || "Your account"} has been marked as passed.`,
          createdAt: next.evaluationPassedAt || new Date().toISOString(),
        });
      }
      setCreated(true);
      setShowSetupForm(false);
      setShowAllAccounts(false);
      setDetailAccountId(null);
      setPortfolioNotice("Account added successfully.");
      window.setTimeout(() => { setCreated(false); setPortfolioNotice(""); }, 2600);
    }
  };

  const openAllAccounts = () => {
    setShowSetupForm(false);
    setDetailAccountId(null);
    setShowAllAccounts(true);
  };

  const handleRemoveAccount = async (accountId) => {
    if (!onRemoveAccount) return;
    const row = portfolioRows.find((item) => item.account.id === accountId);
    const name = row?.account?.settings?.accountLabel || row?.account?.settings?.accountId || row?.account?.name || "this account";
    if (!window.confirm(`Permanently remove ${name}? This account can only be permanently deleted when it has no journal or missed trades. If it contains history, archive it instead. This cannot be undone.`)) return;
    try {
      const removed = await onRemoveAccount(accountId);
      if (removed !== false) {
        setPortfolioNotice("Account removed successfully.");
        setTimeout(() => setPortfolioNotice(""), 2600);
      }
    } catch (error) {
      setPortfolioNotice(error?.message || "Account could not be permanently removed. Archive it instead if it contains history.");
      setTimeout(() => setPortfolioNotice(""), 4200);
    }
  };

  const selectFirm = (nextFirm) => {
    setFirmId(nextFirm);
    setMarket("");
    setVendor("");
    setAccountVariant("new");
    setProgramId("");
  };
  const selectMarket = (nextMarket) => {
    setMarket(nextMarket);
    setVendor("");
    setProgramId("");
  };
  const selectVariant = (nextVariant) => {
    setAccountVariant(nextVariant);
    setProgramId("");
  };

  const updateAccountIdentity = () => {};
  const displayId = accountId.trim();
  const displayLabel = accountLabel.trim();
  const openAddAccount = () => {
    // The setup form and the All Accounts directory are mutually exclusive views.
    setShowAllAccounts(false);
    setDetailAccountId(null);
    setSetupMode("add");
    setSetupIntent("account");
    setAccountStage("evaluation");
    setFundedFromEvaluationId("");
    setFundedAccountName("");
    setFundedAccountNumber("");
    setMarket("");
    setVendor("");
    setAccountVariant("new");
    setProgramId("");
    setAccountId("");
    setAccountLabel("");
    setPurchasePrice("");
    setActivationFeePaid("");
    setShowSetupForm(true);
  };
  const openAddPassedAccount = () => {
    setShowAllAccounts(false);
    setDetailAccountId(null);
    setShowPassedPicker(true);
  };

  const openPassedEvaluationForFunded = (row) => {
    const s = row?.account?.settings || {};
    setShowPassedPicker(false);
    setShowAllAccounts(false);
    setDetailAccountId(null);
    setSetupMode("add");
    setSetupIntent("funded");
    setAccountStage("funded");
    setEvaluationStatus("not-applicable");
    setFirmId(s.propFirmId || "");
    setMarket(s.propMarket || s.market || "");
    setVendor(s.propVendor || "");
    setAccountVariant(s.accountVariant || "new");
    setProgramId(s.propProgramId || "");
    // Funded-account setup inherits the evaluation identity and purchase cost.
    // Only the activation fee and the new funded account identity need to be entered.
    setAccountId(s.accountId || "");
    setAccountLabel(s.accountLabel || s.accountName || "");
    setPurchasePrice(s.purchasePrice ?? s.accountPurchasePrice ?? "");
    setActivationFeePaid("");
    setFundedFromEvaluationId(row.account.id);
    setFundedAccountName("");
    setFundedAccountNumber("");
    setShowSetupForm(true);
  };
  const closeSetupForm = () => setShowSetupForm(false);
  const addCustomRule = () => setCustomRules((items) => [...items, { id: `custom_${Date.now()}_${items.length}`, label: "", value: "" }]);
  const updateCustomRule = (id, key, value) => setCustomRules((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item));
  const removeCustomRule = (id) => setCustomRules((items) => items.filter((item) => item.id !== id));

  const portfolioRows = useMemo(() => (Array.isArray(accounts) ? accounts : []).map((account) => {
    const accountTrades = filterTradesForAccount(trades, account);
    const compliance = calculatePropFirmCompliance(accountTrades, account.settings || {});
    const pnl = accountTrades.reduce((sum, trade) => sum + Number(trade?.pnl ?? trade?.profit_loss ?? 0), 0);
    const rawStatus = String(account?.settings?.accountStatus || account?.status || "Active").toLowerCase();
    const manualBlown = rawStatus.includes("blown") || rawStatus.includes("failed");
    const drawdownType = String(compliance?.rules?.drawdownType || account?.settings?.drawdownType || "").toLowerCase();
    const isTrailing = drawdownType.includes("trail");
    const threshold = compliance?.drawdownLimit != null
      ? (isTrailing ? Number(compliance.highWaterMark || compliance.accountSize || 0) - Number(compliance.drawdownLimit) : Number(compliance.accountSize || 0) - Number(compliance.drawdownLimit))
      : null;
    const statusOverride = String(account?.settings?.blowStatusOverride || "").toLowerCase();
    const evaluationPassed = String(account?.settings?.evaluationStatus || "").toLowerCase() === "passed";
    // Once an evaluation is explicitly cleared, it is a completed evaluation
    // and must not continue to appear as blown because its evaluation drawdown
    // threshold is below the recorded equity. Funded accounts continue to use
    // the normal automatic/manual blown logic.
    const automaticBlown = !evaluationPassed && statusOverride !== "active"
      ? Boolean(threshold != null && Number(compliance.currentEquity) <= threshold)
      : false;
    const blown = !evaluationPassed && (manualBlown || automaticBlown);
    return { account, accountTrades, compliance, pnl, blown, manualBlown, automaticBlown, isTrailing, threshold, evaluationPassed };
  }), [accounts, trades]);
  const activeCount = portfolioRows.filter((row) => !row.blown).length;
  const blownCount = portfolioRows.filter((row) => row.blown).length;
  const passedRows = portfolioRows.filter((row) => row.evaluationPassed);
  const passedCount = passedRows.length;
  const fundedRows = portfolioRows.filter((row) => String(row.account?.settings?.accountStage || "evaluation") === "funded");
  const fundedCount = fundedRows.length;
  const portfolioTotal = portfolioRows.length;
  const evaluationCount = Math.max(0, portfolioTotal - fundedCount);
  const totalPurchasePaid = portfolioRows.reduce((sum, row) => sum + purchasePaid(row.account), 0);
  const totalActivationPaid = portfolioRows.reduce((sum, row) => sum + activationPaid(row.account), 0);
  const totalInvestedPaid = totalPurchasePaid + totalActivationPaid;
  const activePct = portfolioTotal ? Math.round((activeCount / portfolioTotal) * 100) : 0;
  const accountReport = (row) => {
    const list = Array.isArray(row?.accountTrades) ? row.accountTrades : [];
    const pnlOf = (trade) => Number(trade?.pnl ?? trade?.profit_loss ?? 0) || 0;
    const wins = list.filter((trade) => pnlOf(trade) > 0);
    const losses = list.filter((trade) => pnlOf(trade) < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + pnlOf(trade), 0));
    const totalPnl = list.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const winRate = list.length ? (wins.length / list.length) * 100 : 0;
    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
    const expectancy = list.length ? totalPnl / list.length : 0;
    const bestTrade = list.length ? Math.max(...list.map(pnlOf)) : 0;
    const worstTrade = list.length ? Math.min(...list.map(pnlOf)) : 0;
    const dates = new Set(list.map((trade) => trade?.date || trade?.trade_date).filter(Boolean));
    const settingsForAccount = row.account?.settings || {};
    const accountSize = Number(settingsForAccount.accountSize || 0);
    const roi = accountSize ? (totalPnl / accountSize) * 100 : 0;
    const compliance = row.compliance || {};
    const currentEquity = accountSize + Number(settingsForAccount.initialProfit ?? settingsForAccount.unloggedProfitOffset ?? 0) + totalPnl;
    return {
      trades: list.length, wins: wins.length, losses: losses.length, winRate, grossProfit, grossLoss, totalPnl, avgWin, avgLoss,
      profitFactor, expectancy, bestTrade, worstTrade, tradingDays: dates.size, roi, currentEquity, accountSize,
      drawdownRemaining: compliance.drawdownRemaining, dailyLossRemaining: compliance.dailyLossRemaining,
      consistencyPct: compliance.consistencyPct, consistencyRule: compliance.rules?.consistencyRule,
      payoutEligible: compliance.payoutEligible, hardViolations: compliance.hardViolations?.length || 0, warnings: compliance.warnings?.length || 0,
    };
  };

  const openCostEditor = (accountId) => {
    const row = portfolioRows.find((item) => String(item.account.id) === String(accountId));
    if (!row) return;
    const settingsForAccount = row.account.settings || {};
    setCostEditAccountId(row.account.id);
    setCostPurchasePrice(settingsForAccount.purchasePrice ?? settingsForAccount.accountPurchasePrice ?? "");
    setCostActivationFee(settingsForAccount.activationFeePaid ?? settingsForAccount.accountActivationFeePaid ?? "");
  };
  const closeCostEditor = () => {
    setCostEditAccountId(null);
    setCostPurchasePrice("");
    setCostActivationFee("");
  };
  const saveCostEditor = async () => {
    const row = portfolioRows.find((item) => String(item.account.id) === String(costEditAccountId));
    if (!row || !onUpdateAccount) return;
    const purchase = Number(costPurchasePrice);
    const activation = Number(costActivationFee);
    if (!Number.isFinite(purchase) || purchase < 0 || !Number.isFinite(activation) || activation < 0) {
      setPortfolioNotice("Enter valid non-negative purchase and activation amounts.");
      window.setTimeout(() => setPortfolioNotice(""), 3000);
      return;
    }
    const nextSettings = {
      ...(row.account.settings || {}),
      purchasePrice: purchase,
      accountPurchasePrice: purchase,
      activationFeePaid: activation,
      accountActivationFeePaid: activation,
      costsUpdatedAt: new Date().toISOString(),
    };
    onUpdateAccount(row.account.id, nextSettings);
    setPortfolioNotice(`Costs updated for ${nextSettings.accountLabel || nextSettings.accountId || row.account.name}.`);
    window.setTimeout(() => setPortfolioNotice(""), 2800);
    closeCostEditor();
  };

  const openBlowReview = (accountId) => {
    const row = portfolioRows.find((item) => item.account.id === accountId);
    const existing = row?.account?.settings?.blowReview || {};
    setBlowReviewAccountId(accountId);
    setBlowReason(existing.reason || (row?.automaticBlown ? "Trailing Threshold Breached" : ""));
    setBlowMistakes(Array.isArray(existing.mistakes) ? existing.mistakes : []);
    setBlowWhatHappened(existing.whatHappened || "");
    setBlowNextTime(existing.nextTime || "");
  };
  const closeBlowReview = () => { setBlowReviewAccountId(null); setBlowReason(""); setBlowMistakes([]); setBlowWhatHappened(""); setBlowNextTime(""); };
  const saveBlowReview = async () => {
    const row = portfolioRows.find((item) => item.account.id === blowReviewAccountId);
    if (!row || !onUpdateAccount || !blowReason) return;
    const list = row.accountTrades || [];
    const pnlOf = (trade) => Number(trade?.pnl ?? trade?.profit_loss ?? 0) || 0;
    const totalPnl = list.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const now = new Date().toISOString();
    onUpdateAccount(row.account.id, { ...row.account.settings, accountStatus: "Blown", blowStatusOverride: "", blowMarkedAt: now, blowReview: { reason: blowReason, mistakes: blowMistakes, whatHappened: blowWhatHappened.trim(), nextTime: blowNextTime.trim(), equityAtBreach: Number(row.compliance?.currentEquity || 0), highWaterMarkAtBreach: Number(row.compliance?.highWaterMark || 0), trailingThresholdAtBreach: row.threshold, currentDrawdownAtBreach: Number(row.compliance?.currentDrawdown || 0), netPnlAtBreach: totalPnl, tradeCountAtBreach: list.length } });
    setPortfolioNotice("Account marked as blown and review saved.");
    window.setTimeout(() => setPortfolioNotice(""), 3000);
    closeBlowReview();
  };
  const markEvaluationPassed = async (accountId) => {
    const row = portfolioRows.find((item) => item.account.id === accountId);
    if (!row || !onUpdateAccount) return;
    const currentStatus = String(row.account?.settings?.evaluationStatus || "").toLowerCase();
    if (currentStatus === "passed") return;
    const passedAt = new Date().toISOString();
    const nextSettings = {
      ...row.account.settings,
      evaluationStatus: "passed",
      evaluationPassedAt: passedAt,
      accountStatus: "Active",
      blowStatusOverride: "active",
    };
    onUpdateAccount(row.account.id, nextSettings);
    addAccountNotification(userId, {
      id: `evaluation-passed:${row.account.id}:${passedAt}`,
      type: "evaluation-passed",
      accountId: row.account.id,
      title: "Evaluation cleared",
      detail: `${nextSettings.accountLabel || nextSettings.accountId || row.account.name || "Your account"} has been cleared and marked as passed.`,
      createdAt: passedAt,
    });
    setPortfolioNotice("Evaluation cleared. A dashboard notification was created.");
    window.setTimeout(() => setPortfolioNotice(""), 3200);
  };

  const restoreAccountToActive = async (accountId) => {
    const row = portfolioRows.find((item) => item.account.id === accountId);
    if (!row || !onUpdateAccount) return;
    if (!window.confirm("Mark this account as Active again? The historical blow review will be retained.")) return;
    onUpdateAccount(row.account.id, { ...row.account.settings, accountStatus: "Active", blowStatusOverride: "active", blowRestoredAt: new Date().toISOString() });
    setPortfolioNotice("Account marked active again.");
    window.setTimeout(() => setPortfolioNotice(""), 2600);
  };
  const selectedBlowRow = blowReviewAccountId ? portfolioRows.find((row) => row.account.id === blowReviewAccountId) : null;

  const selectedDetailRow = detailAccountId ? portfolioRows.find((row) => row.account.id === detailAccountId) : null;

  const passedPickerPortal = showPassedPicker ? createPortal(
    <div className="pf-passed-picker-overlay" role="dialog" aria-modal="true" aria-label="Passed evaluations">
      <div className="pf-passed-picker-modal">
        <div className="pf-passed-picker-head">
          <div><div className="pf-panel-eyebrow">PASSED EVALUATIONS</div><h2>Select a cleared evaluation</h2><p>TradeLog automatically found evaluations marked Passed / Cleared. Choose one to create its separate funded account.</p></div>
          <button type="button" className="pf-modal-close" aria-label="Close passed evaluations" onClick={() => setShowPassedPicker(false)}>×</button>
        </div>
        {passedRows.length ? <div className="pf-passed-picker-list">{passedRows.map((row) => {
          const s = row.account.settings || {};
          const report = accountReport(row);
          return <article className="pf-passed-picker-card" key={row.account.id}>
            <div className="pf-passed-picker-main"><div><span className="pf-passed-picker-badge">✓ PASSED</span><h3>{s.accountLabel || s.accountId || row.account.name}</h3><p>{s.propFirm || "Prop Firm"} · {s.propProgram || "Evaluation"}</p></div><div className="pf-passed-picker-meta"><span>Net P&L</span><strong className={report.totalPnl >= 0 ? "positive" : "negative"}>{money(report.totalPnl)}</strong></div></div>
            <div className="pf-passed-picker-foot"><span>{s.accountId || "No account number"} · {report.trades} trades</span><button type="button" className="pf-create-funded" onClick={() => openPassedEvaluationForFunded(row)}>Proceed to Add Funded Account →</button></div>
          </article>;
        })}</div> : <div className="pf-passed-picker-empty"><div className="pf-passed-icon">✓</div><strong>No passed evaluations found</strong><span>Mark an evaluation as Passed / Cleared first. It will automatically appear here.</span></div>}
      </div>
    </div>, document.body
  ) : null;

  const allAccountsPortal = showAllAccounts ? createPortal(
              <>
              <div className={`pf-accounts-overlay ${theme === "light" ? "pf-portal-light" : "pf-portal-dark"}`} role="dialog" aria-modal="true" aria-label="All accounts">
                <div className="pf-accounts-modal">
                  <div className="pf-accounts-modal-head">
                    <div>
                      <div className="pf-panel-eyebrow">ACCOUNT PORTFOLIO</div>
                      <h2>{selectedDetailRow ? "Account Details" : "All Accounts"}</h2>
                      <p>{selectedDetailRow ? "Detailed profitability, risk and prop-firm performance report." : `Review all ${portfolioTotal} accounts in your portfolio.`}</p>
                    </div>
                    <button type="button" className="pf-modal-close" aria-label="Close accounts" onClick={() => { setShowAllAccounts(false); setDetailAccountId(null); }}>×</button>
                  </div>

                  {!selectedDetailRow ? (
                    <div className="pf-all-accounts-grid">
                      {portfolioRows.map((row) => {
                        const report = accountReport(row);
                        const accountSettings = row.account.settings || {};
                        return (
                          <article className="pf-account-detail-card" key={row.account.id}>
                            <div className="pf-account-card-top">
                              <div>
                                <span className={`pf-account-card-status ${row.evaluationPassed ? "passed" : ""}`}>{row.evaluationPassed ? "Passed" : row.blown ? "Blown" : "Active"}</span><span className={`pf-account-stage-badge ${String(accountSettings.accountStage || "evaluation") === "funded" ? "funded" : "evaluation"}`}>{String(accountSettings.accountStage || "evaluation") === "funded" ? "Funded" : "Evaluation"}</span>
                                <h3>{accountSettings.accountLabel || accountSettings.accountId || row.account.name}</h3>
                                <p>{accountSettings.propFirm || "Prop Firm"} · {accountSettings.propProgram || accountSettings.accountName || "Trading Account"}</p>
                              </div>
                              <div className={`pf-account-health ${row.blown ? "bad" : "good"}`}>{row.blown ? "Review" : "Healthy"}</div>
                            </div>
                            <div className="pf-account-card-metrics">
                              <div className={`pf-kpi ${report.totalPnl >= 0 ? "green" : "red"}`}><span>Net P&L</span><strong>{money(report.totalPnl)}</strong><small>Account performance</small></div>
                              <div className="pf-kpi"><span>Win Rate</span><strong>{report.winRate.toFixed(1)}%</strong><small>{report.wins} wins · {report.losses} losses</small></div>
                              <div className="pf-kpi violet"><span>Profit Factor</span><strong>{Number.isFinite(report.profitFactor) ? report.profitFactor.toFixed(2) : "∞"}</strong><small>Gross profit / loss</small></div>
                              <div className="pf-kpi"><span>Trades</span><strong>{report.trades}</strong><small>{report.tradingDays} trading days</small></div>
                            </div>
                            <div className="pf-account-card-foot">
                              <span>{report.tradingDays} trading days · {money(report.currentEquity)} equity</span>
                              <div className="pf-account-card-actions"><button type="button" className="pf-edit-costs" title="Edit price paid and activation fee" aria-label={`Edit costs for ${row.account.name}`} onClick={() => openCostEditor(row.account.id)}>✎ Edit Costs</button><button type="button" onClick={() => setDetailAccountId(row.account.id)}>View Details <span>→</span></button>{(row.evaluationPassed || row.blown) && onReviewTrades && <button type="button" className="pf-review-trades" onClick={() => onReviewTrades(row.account.id)}>Review Trades</button>}{!row.evaluationPassed && <button type="button" className="pf-mark-passed" onClick={() => markEvaluationPassed(row.account.id)}>Mark Passed</button>}{!row.blown && row.evaluationPassed && <button type="button" className="pf-create-funded" onClick={() => { setSetupMode("add"); setSetupIntent("funded"); setShowAllAccounts(false); setDetailAccountId(null); setShowSetupForm(true); setFirmId(row.account.settings?.propFirmId || ""); setMarket(row.account.settings?.propMarket || row.account.settings?.market || ""); setVendor(row.account.settings?.propVendor || ""); setAccountVariant(row.account.settings?.accountVariant || "new"); setProgramId(row.account.settings?.propProgramId || ""); setAccountStage("funded"); setEvaluationStatus("not-applicable"); setFundedFromEvaluationId(row.account.id); setFundedAccountName(""); setFundedAccountNumber(""); }}>Create Funded Account</button>}{row.blown ? <button type="button" className="pf-restore-account" onClick={() => restoreAccountToActive(row.account.id)}>Mark Active</button> : <button type="button" className="pf-mark-blown" onClick={() => openBlowReview(row.account.id)}>Mark Blown</button>}<button type="button" className="pf-remove-account" onClick={() => handleRemoveAccount(row.account.id)}>Remove</button></div>
                            </div>
                          </article>
                        );
                      })}
                      {!portfolioRows.length && <div className="pf-all-empty">No accounts have been added yet.</div>}
                    </div>
                  ) : (
                    <div className="pf-account-report">
                      <button type="button" className="pf-back-accounts" onClick={() => setDetailAccountId(null)}>← All Accounts</button>
                      <div className="pf-report-hero">
                        <div><span>{selectedDetailRow.account.settings?.propFirm || "Prop Firm"}</span><h3>{selectedDetailRow.account.settings?.accountLabel || selectedDetailRow.account.settings?.accountId || selectedDetailRow.account.name}</h3><p>{selectedDetailRow.account.settings?.propProgram || selectedDetailRow.account.settings?.accountName || "Trading Account"} · {selectedDetailRow.account.settings?.platform || "—"}</p></div>
                        <div style={{display:"flex",alignItems:"center",gap:7}}><div className={`pf-report-status ${selectedDetailRow.evaluationPassed ? "good" : selectedDetailRow.blown ? "bad" : "good"}`}>{selectedDetailRow.evaluationPassed ? "PASSED / CLEARED" : selectedDetailRow.blown ? (selectedDetailRow.automaticBlown && !selectedDetailRow.manualBlown ? "AUTO-BLOWN / REVIEW" : "BLOWN / REVIEW") : "ACTIVE"}</div><button type="button" className="pf-report-action" onClick={() => openCostEditor(selectedDetailRow.account.id)}>Edit Costs</button>{(selectedDetailRow.evaluationPassed || selectedDetailRow.blown) && onReviewTrades && <button type="button" className="pf-report-action" onClick={() => onReviewTrades(selectedDetailRow.account.id)}>Review Trades</button>}{selectedDetailRow.evaluationPassed && String(selectedDetailRow.account.settings?.accountStage || "evaluation") !== "funded" ? <><button type="button" className="pf-report-action funded" onClick={() => { setSetupMode("add"); setSetupIntent("funded"); setShowAllAccounts(false); setDetailAccountId(null); setShowSetupForm(true); setFirmId(selectedDetailRow.account.settings?.propFirmId || ""); setMarket(selectedDetailRow.account.settings?.propMarket || selectedDetailRow.account.settings?.market || ""); setVendor(selectedDetailRow.account.settings?.propVendor || ""); setAccountVariant(selectedDetailRow.account.settings?.accountVariant || "new"); setProgramId(selectedDetailRow.account.settings?.propProgramId || ""); setAccountStage("funded"); setEvaluationStatus("not-applicable"); setFundedFromEvaluationId(selectedDetailRow.account.id); setFundedAccountName(""); setFundedAccountNumber(""); }}>Create Funded</button></> : <>{!selectedDetailRow.evaluationPassed && <button type="button" className="pf-report-action passed" onClick={() => markEvaluationPassed(selectedDetailRow.account.id)}>Mark Passed</button>}{selectedDetailRow.blown && <button type="button" className="pf-report-action" onClick={() => restoreAccountToActive(selectedDetailRow.account.id)}>Mark Active</button>}<button type="button" className="pf-report-action danger" onClick={() => openBlowReview(selectedDetailRow.account.id)}>Mark Blown</button></>}</div>
                      </div>
                      {(() => { const r = accountReport(selectedDetailRow); const s = selectedDetailRow.account.settings || {}; return <>
                        <div className="pf-report-grid">
                          <div><span>Net P&L</span><strong className={r.totalPnl >= 0 ? "positive" : "negative"}>{money(r.totalPnl)}</strong><small>{r.roi.toFixed(2)}% return on account size</small></div>
                          <div><span>Current Equity</span><strong>{money(r.currentEquity)}</strong><small>Starting size {money(r.accountSize)}</small></div>
                          <div><span>Win Rate</span><strong>{r.winRate.toFixed(1)}%</strong><small>{r.wins} wins · {r.losses} losses</small></div>
                          <div><span>Profit Factor</span><strong>{Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "∞"}</strong><small>Gross profit {money(r.grossProfit)}</small></div>
                        </div>
                        <div className="pf-report-section"><h4>Profitability</h4><div className="pf-report-table">
                          <div><span>Total trades</span><b>{r.trades}</b></div><div><span>Expectancy / trade</span><b>{money(r.expectancy)}</b></div><div><span>Average winning trade</span><b>{money(r.avgWin)}</b></div><div><span>Average losing trade</span><b>{money(-r.avgLoss)}</b></div><div><span>Best trade</span><b className="positive">{money(r.bestTrade)}</b></div><div><span>Worst trade</span><b className="negative">{money(r.worstTrade)}</b></div>
                        </div></div>
                        <div className="pf-report-section"><h4>Risk & Compliance</h4><div className="pf-report-table">
                          <div><span>Trading days</span><b>{r.tradingDays}</b></div><div><span>Drawdown remaining</span><b>{r.drawdownRemaining != null ? money(r.drawdownRemaining) : "—"}</b></div><div><span>Daily loss remaining</span><b>{r.dailyLossRemaining != null ? money(r.dailyLossRemaining) : "—"}</b></div><div><span>Consistency</span><b>{r.consistencyPct != null ? `${Number(r.consistencyPct).toFixed(1)}%${r.consistencyRule != null ? ` / ${r.consistencyRule}%` : ""}` : "—"}</b></div><div><span>Payout eligibility</span><b className={r.payoutEligible ? "positive" : "negative"}>{r.payoutEligible ? "Eligible" : "Not eligible"}</b></div><div><span>Compliance alerts</span><b>{r.hardViolations ? `${r.hardViolations} blocking` : `${r.warnings} warning${r.warnings === 1 ? "" : "s"}`}</b></div>
                        </div></div>
                        <div className="pf-report-section"><h4>Account Configuration</h4><div className="pf-report-table">
                          <div><span>Account Stage</span><b>{String(s.accountStage || "evaluation") === "funded" ? "Funded Account" : "Evaluation"}</b></div><div><span>Account ID / Number</span><b>{s.accountId || "Not set"}</b></div><div><span>Platform</span><b>{s.platform || "—"}</b></div><div><span>Price paid</span><b>{money(purchasePaid(selectedDetailRow.account))}</b></div><div><span>Activation fee paid</span><b>{money(activationPaid(selectedDetailRow.account))}</b></div><div><span>Total invested</span><b>{money(totalInvested(selectedDetailRow.account))}</b></div><div><span>Program activation fee</span><b>{s.activationFee != null ? money(s.activationFee) : s.propPricing?.activationFee != null ? money(s.propPricing.activationFee) : "—"}</b></div><div><span>Max drawdown</span><b>{s.maxDrawdown != null ? money(s.maxDrawdown) : "—"}</b></div><div><span>Daily loss limit</span><b>{s.dailyLossLimit != null ? money(s.dailyLossLimit) : "—"}</b></div><div><span>Profit target</span><b>{s.profitTarget != null ? money(s.profitTarget) : "—"}</b></div>
                        </div></div>{String(s.accountStage || "evaluation") === "funded" && <div className="pf-report-section"><h4>Funded Account</h4><div className="pf-report-table"><div><span>Funded account name</span><b>{s.fundedAccountName || s.accountLabel || "—"}</b></div><div><span>Funded account number</span><b>{s.fundedAccountNumber || s.accountId || "—"}</b></div><div><span>Created from evaluation</span><b>{s.fundedFromEvaluationId || "—"}</b></div></div></div>}
                      </>; })()}
                    </div>
                  )}
                </div>
              </div>
            
              </>,
              document.body
  ) : null;

  const costEditorRow = costEditAccountId ? portfolioRows.find((row) => String(row.account.id) === String(costEditAccountId)) : null;
  const costEditorPortal = costEditorRow ? createPortal(
    <div className={`pf-cost-overlay ${theme === "light" ? "pf-portal-light" : "pf-portal-dark"}`} role="dialog" aria-modal="true" aria-label="Edit account costs">
      <div className="pf-cost-modal">
        <div className="pf-cost-head">
          <div><div className="pf-panel-eyebrow">ACCOUNT COSTS</div><h2>Edit Price & Fees</h2><p>Record what you actually paid for this prop-firm account. These values drive portfolio investment totals.</p></div>
          <button type="button" className="pf-modal-close" aria-label="Close cost editor" onClick={closeCostEditor}>×</button>
        </div>
        <div className="pf-cost-account"><strong>{costEditorRow.account.settings?.accountLabel || costEditorRow.account.settings?.accountId || costEditorRow.account.name}</strong><span>{costEditorRow.account.settings?.propFirm || "Prop Firm"} · {costEditorRow.account.settings?.propProgram || "Trading Account"}</span></div>
        <div className="pf-cost-grid">
          <label><span>PRICE PAID</span><div className="pf-cost-input"><b>$</b><input type="number" min="0" step="0.01" value={costPurchasePrice} onChange={(e) => setCostPurchasePrice(e.target.value)} placeholder="0.00" autoFocus /></div><small>Evaluation / account purchase price actually paid.</small></label>
          <label><span>ACTIVATION FEE PAID</span><div className="pf-cost-input"><b>$</b><input type="number" min="0" step="0.01" value={costActivationFee} onChange={(e) => setCostActivationFee(e.target.value)} placeholder="0.00" /></div><small>Funded activation fee actually paid, if applicable.</small></label>
        </div>
        <div className="pf-cost-summary"><div><span>Total invested</span><strong>{money((Number(costPurchasePrice) || 0) + (Number(costActivationFee) || 0))}</strong></div><div><span>Current stored values</span><strong>{money(totalInvested(costEditorRow.account))}</strong></div></div>
        <div className="pf-cost-foot"><button type="button" className="pf-btn pf-cancel" onClick={closeCostEditor}>Cancel</button><button type="button" className="pf-btn pf-next" onClick={saveCostEditor}>Save Costs</button></div>
      </div>
    </div>, document.body
  ) : null;

  const blowReviewPortal = selectedBlowRow ? createPortal(
    <div className={`pf-blow-overlay ${theme === "light" ? "pf-portal-light" : "pf-portal-dark"}`} role="dialog" aria-modal="true" aria-label="Mark account as blown">
      <div className="pf-blow-modal">
        <div className="pf-blow-head"><div><div className="pf-panel-eyebrow">ACCOUNT REVIEW</div><h2>Mark Account as Blown</h2><p>Record what caused the account failure and what you will change next time.</p></div><button type="button" className="pf-modal-close" onClick={closeBlowReview}>×</button></div>
        <div className="pf-blow-summary"><strong>{selectedBlowRow.account.settings?.accountLabel || selectedBlowRow.account.settings?.accountId || selectedBlowRow.account.name}</strong><span>Equity {money(selectedBlowRow.compliance.currentEquity)} · {selectedBlowRow.isTrailing ? `Trailing threshold ${money(selectedBlowRow.threshold)}` : `Drawdown ${money(selectedBlowRow.compliance.currentDrawdown)}`}</span></div>
        <div className="pf-blow-fields">
          <label><span>Why was the account blown?</span><select value={blowReason} onChange={(e) => setBlowReason(e.target.value)}><option value="">Select a reason…</option><option>Maximum Drawdown Breached</option><option>Trailing Threshold Breached</option><option>Daily Loss Limit Breached</option><option>Rule Violation</option><option>Overtrading</option><option>Revenge Trading</option><option>Excessive Risk</option><option>Trading Outside Strategy</option><option>Other</option></select></label>
          <div><span className="pf-blow-label">What mistakes did you make?</span><div className="pf-mistake-grid">{["Increased position size","Took too many trades","Traded outside planned session","Moved / removed SL","Chased a trade","Revenge traded","Ignored setup rules","Entered without confirmation","Broke daily risk limit","Continued after daily loss","Emotional trading","Other"].map((mistake) => <label className={`pf-mistake ${blowMistakes.includes(mistake) ? "selected" : ""}`} key={mistake}><input type="checkbox" checked={blowMistakes.includes(mistake)} onChange={(e) => setBlowMistakes((items) => e.target.checked ? [...items, mistake] : items.filter((x) => x !== mistake))}/><span>{mistake}</span></label>)}</div></div>
          <label><span>What happened?</span><textarea value={blowWhatHappened} onChange={(e) => setBlowWhatHappened(e.target.value)} placeholder="Describe what led to the account failure…" rows={3}/></label>
          <label><span>What will you change next time?</span><textarea value={blowNextTime} onChange={(e) => setBlowNextTime(e.target.value)} placeholder="Write the rule or process you will follow next time…" rows={3}/></label>
        </div>
        <div className="pf-blow-foot"><button type="button" className="pf-btn pf-cancel" onClick={closeBlowReview}>Cancel</button><button type="button" className="pf-btn pf-next" disabled={!blowReason} onClick={saveBlowReview}>Save Blow Review</button></div>
      </div>
    </div>, document.body
  ) : null;

  return (
    <main className="pf-setup">
      <div className={`pf-app ${showSetupForm ? "pf-form-mode" : "pf-portfolio-mode"}`} onPointerMove={(e) => {
        const root = e.currentTarget;
        const r = root.getBoundingClientRect();
        root.style.setProperty("--x", `${e.clientX - r.left}px`);
        root.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}>
        <header className="pf-header">
          <div className="pf-top">
            <div className="pf-title-wrap">
              {showSetupForm && (
                <button type="button" className="pf-back-button" aria-label="Back to account overview" title="Back to account overview" onClick={closeSetupForm}>←</button>
              )}
              <div className="pf-logo">♜</div>
              <div><h1>Prop Firm Setup</h1><p className="pf-sub">Select a firm, vendor and account program to initialize the journal with a versioned rule snapshot.</p></div>
            </div>
            <button type="button" className="pf-close" aria-label="Close" onClick={() => onClose?.()}>×</button>
          </div>
        </header>

        {!showSetupForm ? (
          <section className="pf-portfolio-home">
            <div className="pf-portfolio-home-head">
              <div><div className="pf-panel-eyebrow">ACCOUNT PORTFOLIO</div><h2>Account Overview</h2><p>Manage all of your prop-firm accounts from one place.</p></div>
              <div className="pf-portfolio-head-actions"><button type="button" className="pf-add-passed-account" onClick={openAddPassedAccount}>+ Add Passed Account</button><button type="button" className="pf-add-account-primary" onClick={openAddAccount}>+ Add Account</button></div>
            </div>
            {portfolioNotice && <div className="pf-portfolio-notice" role="status">✓ {portfolioNotice}</div>}
            <div className="pf-home-summary pf-dashboard-summary">
              <div className="pf-dashboard-section-label">PORTFOLIO OVERVIEW</div>
              <div className="pf-dashboard-kpis pf-dashboard-kpis-primary">
                <article className="pf-kpi"><span>Total Accounts</span><strong>{portfolioTotal}</strong><small>Across your portfolio</small></article>
                <article className="pf-kpi green"><span>Active Accounts</span><strong>{activeCount}</strong><small>{activePct}% of portfolio</small></article>
                <article className="pf-kpi red"><span>Blown Accounts</span><strong>{blownCount}</strong><small>{portfolioTotal ? Math.round((blownCount / portfolioTotal) * 100) : 0}% of portfolio</small></article>
                <article className="pf-kpi violet"><span>Evaluations Passed</span><strong>{passedCount}</strong><small>{passedCount === 1 ? "Evaluation cleared" : "Evaluations cleared"}</small></article>
                <article className="pf-kpi violet"><span>Active Rate</span><strong>{activePct}%</strong><small>Current portfolio status</small></article>
              </div>

              <div className="pf-dashboard-section-label">PORTFOLIO FINANCIALS</div>
              <div className="pf-dashboard-kpis pf-dashboard-kpis-secondary">
                <article className="pf-kpi green"><span>Total Purchase Cost</span><strong>{money(totalPurchasePaid)}</strong><small>Recorded price paid</small></article>
                <article className="pf-kpi"><span>Activation Fees Paid</span><strong>{money(totalActivationPaid)}</strong><small>Recorded activation fees</small></article>
                <article className="pf-kpi violet"><span>Total Invested</span><strong>{money(totalInvestedPaid)}</strong><small>Purchase + activation</small></article>
                <article className="pf-kpi pf-distribution-kpi">
                  <div className="pf-distribution-copy"><span>Account Distribution</span><strong>{activeCount} Active</strong><small>{blownCount} Blown · {portfolioTotal} Total</small></div>
                  <AccountDistributionGauge active={activeCount} blown={blownCount} total={portfolioTotal} />
                </article>
              </div>

              <div className="pf-dashboard-bottom">
                <div className="pf-dashboard-insight">
                  <div><div className="pf-dashboard-section-label">EVALUATIONS PASSED</div><strong>{passedCount}</strong><small>{passedCount === 1 ? "evaluation account cleared" : "evaluation accounts cleared"}</small></div>
                  <div className="pf-dashboard-passed-list">
                    {passedRows.slice(0, 3).map((row) => <span key={row.account.id}>{row.account.settings?.accountLabel || row.account.settings?.accountId || row.account.name}</span>)}
                    {passedRows.length === 0 && <span className="empty">No passed evaluations yet</span>}
                  </div>
                </div>
                <button type="button" className="pf-view-all-accounts pf-dashboard-view-all" onClick={openAllAccounts}>View All Accounts <span>→</span></button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="pf-workspace">
              <div className="pf-left-column">
                <div className={`pf-selector pf-selector-flow ${showVariantSelector ? "has-variant" : ""} ${isFundedCreation ? "funded-create" : ""}`}>
                  <div className="pf-field pf-prop-field"><label>1 · PROP FIRM</label><select value={firmId} onChange={(e) => selectFirm(e.target.value)}><option value="">Select prop firm…</option>{catalog.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
                  <div className="pf-field pf-market-field"><label>2 · MARKET</label><select value={market} onChange={(e) => selectMarket(e.target.value)} disabled={!firm}><option value="">Select Futures or CFD…</option>{marketOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                  <div className="pf-field pf-vendor-field"><label>3 · VENDOR / PLATFORM</label><select value={vendor} onChange={(e) => { setVendor(e.target.value); setProgramId(""); }} disabled={!market}><option value="">Select vendor…</option>{vendors.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
                  {showVariantSelector && vendor && <div className="pf-field pf-variant-field"><label>4 · ACCOUNT VARIANT</label><select value={accountVariant} onChange={(e) => selectVariant(e.target.value)}>{variantOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}
                  <div className="pf-field pf-program-field"><label>{showVariantSelector ? "5" : "4"} · PROGRAM</label><select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!vendor || (showVariantSelector && !accountVariant)}><option value="">Select program…</option>{availablePrograms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                  <button type="button" className="pf-refresh" onClick={refresh} disabled={status.state === "loading"} aria-label="Refresh official rules" title="Refresh official rules"><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS["i-refresh"]}</svg></button>
                  <div className="pf-field pf-account-id"><label>ACCOUNT ID</label><input type="text" value={accountId} onChange={(e) => { setAccountId(e.target.value); updateAccountIdentity(); }} placeholder="e.g. 25K-001" maxLength={40} disabled={isFundedCreation}/></div>
                  <div className="pf-field pf-account-name"><label>ACCOUNT LABEL <span>(Optional)</span></label><input type="text" value={accountLabel} onChange={(e) => { setAccountLabel(e.target.value); updateAccountIdentity(); }} placeholder="e.g. Main / Account 1" maxLength={40} disabled={isFundedCreation}/></div>
                  <div className="pf-field pf-purchase-price"><label>PRICE PAID</label><input type="number" min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="e.g. 49.00" disabled={isFundedCreation}/></div>
                  <div className="pf-field pf-activation-paid"><label>ACTIVATION FEE PAID</label><input type="number" min="0" step="0.01" value={activationFeePaid} onChange={(e) => setActivationFeePaid(e.target.value)} placeholder="e.g. 80.00"/></div>
                  {!isFundedCreation && <><div className="pf-field pf-account-stage"><label>ACCOUNT STAGE</label><select value={accountStage} onChange={(e) => setAccountStage(e.target.value)}><option value="evaluation">Evaluation</option><option value="funded">Funded Account</option></select></div>
                  <div className="pf-field pf-evaluation-status"><label>EVALUATION STATUS</label><select value={evaluationStatus} onChange={(e) => setEvaluationStatus(e.target.value)} disabled={accountStage === "funded"}><option value="in-progress">In Progress</option><option value="passed">Passed / Cleared</option><option value="not-applicable">Not an Evaluation</option></select></div></>}
                  {isFundedCreation && <div className="pf-inherited-note"><b>INHERITED FROM PASSED EVALUATION</b><span>Account ID, account label and price paid are carried forward automatically.</span></div>}
                  {accountStage === "funded" && <div className="pf-funded-fields"><div className="pf-funded-heading"><strong>FUNDED ACCOUNT DETAILS</strong><span>Only the new funded account identity is required.</span></div><div className="pf-field"><label>FUNDED ACCOUNT NAME</label><input type="text" value={fundedAccountName} onChange={(e) => setFundedAccountName(e.target.value)} placeholder="e.g. The5ers Funded 25K" maxLength={60}/></div><div className="pf-field"><label>FUNDED ACCOUNT NUMBER</label><input type="text" value={fundedAccountNumber} onChange={(e) => setFundedAccountNumber(e.target.value)} placeholder="e.g. PA-250184" maxLength={60}/></div></div>}
                  <div className="pf-verified"><b></b>Rule catalog: {status.state === "fresh" ? "official-source refresh" : "verified snapshot"}</div>
                </div>

              {program ? <section className="pf-details">
                <div className="pf-detail-head">
                  <div><h2>{program.name}</h2><p>{firm.name} · {market}{vendor ? ` · ${vendor}` : ""}{showVariantSelector ? ` · ${accountVariant === "legacy" ? "Legacy" : "New"}` : ""} · {program.stage}</p></div>
                  <div className="pf-head-right">
                    <div className="pf-account-badge">Account ID: <strong>{displayId || "Not set"}</strong>{displayLabel ? ` · ${displayLabel}` : ""}</div>
                    <div className="pf-badge">● Official source tracked</div>
                  </div>
                </div>

                <div className="pf-grid">
                  {ruleRows(program.rules).filter(([, value]) => value !== "—").map(([label, value, icon]) => (
                    <div className="pf-stat" key={label}>
                      <span className="pf-stat-icon"><svg viewBox="0 0 24 24">{ICONS[icon]}</svg></span>
                      <span><span className="pf-label">{label}</span><strong>{value}</strong></span>
                    </div>
                  ))}
                </div>

                <div className="pf-custom-rules">
                  <div className="pf-custom-head">
                    <div><strong>Additional Rules</strong><span>Add any custom rule that should be tracked for this program.</span></div>
                    <button type="button" className="pf-add-rule" onClick={addCustomRule}>+ Add Rule</button>
                  </div>
                  {customRules.length > 0 && <div className="pf-custom-list">
                    {customRules.map((rule) => (
                      <div className="pf-stat pf-custom-stat" key={rule.id}>
                        <span className="pf-stat-icon"><svg viewBox="0 0 24 24">{ICONS["i-file"]}</svg></span>
                        <span className="pf-custom-stat-content">
                          <input className="pf-custom-label" value={rule.label} onChange={(e) => updateCustomRule(rule.id, "label", e.target.value)} placeholder="Rule name" maxLength={60} aria-label="Custom rule name" />
                          <input className="pf-custom-value" value={rule.value} onChange={(e) => updateCustomRule(rule.id, "value", e.target.value)} placeholder="Rule value / condition" maxLength={100} aria-label="Custom rule value or condition" />
                        </span>
                        <button type="button" className="pf-remove-rule" onClick={() => removeCustomRule(rule.id)} aria-label="Remove rule">×</button>
                      </div>
                    ))}
                  </div>}
                </div>

                {program.pricing && <div className="pf-pricing"><div className="pf-price-title">Current pricing snapshot</div><div className="pf-prices">{pricingRows(program.pricing).map(([label, value]) => <div className="pf-price" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="pf-coupon">{program.pricing.promo || "Coupon pricing shown on checkout"}</div></div>}
                {program.rules?.scaling && <div className="pf-notice">ⓘ &nbsp; Scaling: {program.rules.scaling}</div>}
                {program.rules?.ruleNote && <div className="pf-notice">ⓘ &nbsp; {program.rules.ruleNote}</div>}
                <div className="pf-source-line">Source: {firm.source}</div>
              </section> : <section className="pf-details pf-empty">
                <div className="pf-detail-head">
                  <div><h2>{firm ? "Select a program" : "Select a prop firm"}</h2><p>{firm ? "Choose the program / account type to load its official rules." : "Choose a prop firm to begin configuring the account."}</p></div>
                </div>
              </section>}
              </div>

              <aside className={`pf-account-panel ${showSetupForm ? "pf-form-account-panel" : ""}`}>
                <div className="pf-account-panel-head">
                  <div><div className="pf-panel-eyebrow">ACCOUNT PORTFOLIO</div><h3>Account Overview</h3><p className="pf-panel-subtitle">Track every account purchased under this firm and program.</p></div>
                  <span className="pf-live-dot"></span>
                </div>

                <div className="pf-portfolio-hero">
                  <div><span>Total Accounts</span><strong>{portfolioTotal}</strong><small>Across this prop-firm setup</small></div>
                  <div className="pf-portfolio-ring" style={{"--active-pct": `${activePct}%`}}><div><b>{activePct}%</b><span>Active</span></div></div>
                </div>

                <div className="pf-account-stats">
                  <div className="pf-account-stat pf-active-stat"><div className="pf-stat-icon-small">✓</div><div><span>Active Accounts</span><strong>{activeCount}</strong><small>{activePct}% of portfolio</small></div></div>
                  <div className="pf-account-stat pf-blown-stat"><div className="pf-stat-icon-small">×</div><div><span>Blown Accounts</span><strong>{blownCount}</strong><small>{portfolioTotal ? Math.round((blownCount / portfolioTotal) * 100) : 0}% of portfolio</small></div></div>
                </div>
                <div className="pf-section-title">Evaluations Passed</div>
                <div className="pf-passed-section pf-passed-compact"><div className="pf-passed-summary"><div className="pf-passed-icon">✓</div><div><strong>{passedCount}</strong><span>{passedCount === 1 ? "Cleared" : "Cleared"}</span></div></div></div>
                <div className="pf-section-title">Account Stage</div>
                <div className="pf-stage-summary"><div><span>Evaluation</span><strong>{evaluationCount}</strong></div><div><span>Funded</span><strong>{fundedCount}</strong></div></div>

                <div className="pf-section-title">Financial Overview</div>
                <div className="pf-money-card"><span>Total Invested</span><strong>{money(totalInvestedPaid)}</strong><small>Purchase cost + activation fees across {portfolioTotal} accounts</small></div>
                <div className="pf-money-row"><div><span>Average / Account</span><strong>{money(portfolioTotal ? totalInvestedPaid / portfolioTotal : 0)}</strong></div><div><span>Active Account Cost</span><strong>{money(portfolioRows.filter((r) => !r.blown).reduce((sum, r) => sum + totalInvested(r.account), 0))}</strong></div></div>

                <div className="pf-section-title">Portfolio Status</div>
                <div className="pf-portfolio-bar"><div className="pf-bar-label"><span>Account distribution</span><b>{activeCount} active · {blownCount} blown</b></div><div className="pf-bar"><i style={{width:`${activePct}%`}}></i><i style={{width:`${100-activePct}%`}}></i></div><div className="pf-bar-legend"><span><b className="pf-green-dot"></b>Active <strong>{activeCount}</strong></span><span><b className="pf-red-dot"></b>Blown <strong>{blownCount}</strong></span></div></div>

                <button type="button" className="pf-view-all-accounts" onClick={openAllAccounts}>View All Accounts <span>→</span></button>
              </aside>
            </div>

            <footer className="pf-footer">
              <button type="button" className="pf-btn pf-cancel" onClick={closeSetupForm}>Cancel</button>
              {onCreateAccount && <button type="button" className={`pf-btn pf-next ${created ? "pf-success" : ""}`} onClick={createAccountFromSetup} disabled={!program}>{created ? "✓ Created" : (setupIntent === "funded" ? "Create Funded Account" : (setupIntent === "passed" ? "Add Passed Account" : (setupMode === "add" ? "Add Account" : "Save Changes")))}</button>}
            </footer>
          </>
        )}
        {passedPickerPortal}
        {allAccountsPortal}
        {costEditorPortal}
        {blowReviewPortal}
      </div>
    </main>
  );
}

export const CFD_VENDORS = ["cTrader", "MetaTrader 5", "MetaTrader 4", "DXtrade", "Match-Trader", "TradeLocker"];
export const FUTURES_VENDORS = ["Tradovate", "Rithmic", "WealthCharts", "Black Arrow", "NinjaTrader", "Quantower"];

const moneyProgram = (size, type, feeMode, rules, pricing = null) => ({
  id: `apex-${type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${size}-${feeMode === "No Activation Fee" ? "no-activation" : "standard"}`,
  name: `${type} · ${size}K · ${feeMode}`,
  shortName: `${size}K ${type} · ${feeMode}`,
  stage: "Evaluation",
  accountSize: size * 1000,
  market: "Futures",
  vendor: null,
  platform: null,
  programFamily: type,
  accountVariant: "new",
  feeMode,
  pricing,
  rules: { ...rules, activationFee: feeMode === "No Activation Fee" ? 0 : 59, activationDeadlineDays: 7, payoutFrequencyDays: 5, maxAccounts: 20, consistencyRule: 50, payoutSplit: 100, scaling: "Built-in for PA", resetFee: "N/A", performanceDailyLossLimit: "Yes · tier-based" },
});

const APEX_NEW_SIZES = {
  25: { intraday: { profitTarget: 1500, maxDrawdown: 1000, maxContracts: 4, maxMicros: 40, performanceMaxContracts: 2, performanceMaxMicros: 20 }, eod: { profitTarget: 1500, maxDrawdown: 1000, dailyLossLimit: 500, maxContracts: 4, maxMicros: 40, performanceMaxContracts: 2, performanceMaxMicros: 20 } },
  50: { intraday: { profitTarget: 3000, maxDrawdown: 2000, maxContracts: 6, maxMicros: 60, performanceMaxContracts: 4, performanceMaxMicros: 40 }, eod: { profitTarget: 5000, maxDrawdown: 2000, dailyLossLimit: 1000, maxContracts: 6, maxMicros: 60, performanceMaxContracts: 4, performanceMaxMicros: 40 } },
  100: { intraday: { profitTarget: 6000, maxDrawdown: 3000, maxContracts: 8, maxMicros: 80, performanceMaxContracts: 6, performanceMaxMicros: 60 }, eod: { profitTarget: 5000, maxDrawdown: 3000, dailyLossLimit: 1500, maxContracts: 8, maxMicros: 80, performanceMaxContracts: 6, performanceMaxMicros: 60 } },
  150: { intraday: { profitTarget: 9000, maxDrawdown: 4000, maxContracts: 12, maxMicros: 120, performanceMaxContracts: 10, performanceMaxMicros: 100 }, eod: { profitTarget: 9000, maxDrawdown: 4000, dailyLossLimit: 2000, maxContracts: 12, maxMicros: 120, performanceMaxContracts: 10, performanceMaxMicros: 100 } },
};

const APEX_NO_ACTIVATION_PRICES = {
  "intraday-25": { onePack: 69, fivePack: 295 },
  "intraday-50": { onePack: 49, fivePack: 245 },
  "intraday-100": { onePack: 59, fivePack: 295 },
  "intraday-150": { onePack: 159, fivePack: 795 },
  "eod-25": { onePack: 69, fivePack: 295 },
  "eod-50": { onePack: 49, fivePack: 245 },
  "eod-100": { onePack: 159, fivePack: 795 },
  "eod-150": { onePack: 169, fivePack: 795 },
};

const APEX_NEW_PROGRAMS = Object.entries(APEX_NEW_SIZES).flatMap(([sizeKey, variants]) => Object.entries(variants).flatMap(([typeKey, rules]) => {
  const size = Number(sizeKey);
  const type = typeKey === "intraday" ? "Intraday Trail" : "EOD Trail";
  return ["Standard", "No Activation Fee"].map((feeMode) => moneyProgram(size, type, feeMode, {
    ...rules,
    drawdownType: type,
    minTradingDays: 1,
    evaluationDays: 30,
    evaluationConsistencyRule: null,
  }, feeMode === "No Activation Fee" ? { ...APEX_NO_ACTIVATION_PRICES[`${typeKey}-${size}`], currency: "USD", promo: "Pricing shown from the supplied Apex screenshots; verify at checkout." } : (typeKey === "intraday" && size === 25 ? { onePack: 16.70, fivePack: 74.95, currency: "USD", promo: "Pricing shown from the supplied Apex screenshot; verify at checkout." } : null)));
}));

const APEX_LEGACY_PRESETS = [
  [25, 1500, 500], [50, 2500, 1000], [100, 3000, 2000], [150, 4500, 2500], [300, 7500, 5000],
];
const APEX_LEGACY_PROGRAMS = APEX_LEGACY_PRESETS.map(([size, maxDrawdown, dailyLossLimit]) => ({
  id: `apex-legacy-${size}k`,
  name: `Legacy Account · ${size}K`,
  shortName: `${size}K Legacy`,
  stage: "Legacy",
  accountSize: size * 1000,
  market: "Futures",
  vendor: null,
  platform: null,
  programFamily: "Legacy Account",
  accountVariant: "legacy",
  feeMode: "Legacy",
  pricing: null,
  rules: { maxDrawdown, dailyLossLimit, drawdownType: "Trailing", ruleNote: "Legacy account rules. Review the saved rule snapshot before trading." },
}));

export const PROP_FIRM_CATALOG = [
  { id: "apex", name: "Apex Trader Funding", markets: ["Futures"], vendorOptions: { Futures: ["Tradovate", "Rithmic", "WealthCharts"] }, variants: ["New Accounts", "Legacy Accounts"], source: "https://apextraderfunding.com/help-center/", programs: [...APEX_NEW_PROGRAMS, ...APEX_LEGACY_PROGRAMS] },
  { id: "topstep", name: "Topstep", markets: ["Futures"], vendorOptions: { Futures: ["Tradovate", "Rithmic"] }, source: "https://help.topstep.com/", programs: [
    { id: "topstep-combine-50k", name: "Trading Combine · 50K", stage: "Evaluation", accountSize: 50000, market: "Futures", rules: { consistencyRule: 55, profitTarget: 3000, maxContracts: 5, maxMicros: 50, drawdownType: "MLL" } },
    { id: "topstep-combine-100k", name: "Trading Combine · 100K", stage: "Evaluation", accountSize: 100000, market: "Futures", rules: { consistencyRule: 55, profitTarget: 6000, maxContracts: 10, maxMicros: 100, drawdownType: "MLL" } },
    { id: "topstep-xfa-standard", name: "Express Funded · Standard", stage: "Funded", market: "Futures", rules: { minProfitableDays: 5, minDailyProfit: 150, payoutCapPct: 50, payoutCapUsd: 5000, payoutSplit: 90, drawdownType: "MLL" } },
    { id: "topstep-xfa-consistency", name: "Express Funded · Consistency", stage: "Funded", market: "Futures", rules: { consistencyRule: 40, minTradingDays: 3, payoutCapPct: 50, payoutCapUsd: 6000, payoutSplit: 90, drawdownType: "MLL" } },
  ]},
  { id: "fundednext", name: "FundedNext Futures", markets: ["Futures"], vendorOptions: { Futures: ["Tradovate", "Rithmic", "NinjaTrader"] }, source: "https://fundednext.com/general-rules/futures/trading-objectives", programs: [
    { id: "fn-rapid-pro-50k", name: "Rapid Pro · 50K", stage: "Challenge", accountSize: 50000, market: "Futures", rules: { profitTarget: 3000, payoutSplit: 90, inactivityDays: 30 } },
    { id: "fn-rapid-daily-50k", name: "Rapid Daily · 50K", stage: "Challenge", accountSize: 50000, market: "Futures", rules: { profitTarget: 3000, dailyLossLimit: 1000, payoutSplit: 90, inactivityDays: 30 } },
    { id: "fn-legacy-50k", name: "Legacy · 50K", stage: "Challenge", accountSize: 50000, market: "Futures", rules: { profitTarget: 3000, consistencyRule: 40, payoutSplit: 80, inactivityDays: 30 } },
    { id: "fn-flex-50k", name: "Flex · 50K", stage: "Challenge", accountSize: 50000, market: "Futures", rules: { profitTarget: 2500, consistencyRule: 40, payoutSplit: 95, inactivityDays: 30 } },
  ]},
  { id: "ftmo", name: "FTMO", markets: ["CFD"], vendorOptions: { CFD: CFD_VENDORS }, source: "https://ftmo.com/en/trading-objectives/", programs: [
    { id: "ftmo-2step-challenge", name: "2-Step · Challenge", stage: "Challenge", accountSize: 100000, market: "CFD", rules: { profitTargetPct: 10, maxDailyLossPct: 5, maxLossPct: 10, minTradingDays: 4, resetTimezone: "CE(S)T" } },
    { id: "ftmo-2step-verification", name: "2-Step · Verification", stage: "Verification", accountSize: 100000, market: "CFD", rules: { profitTargetPct: 5, maxDailyLossPct: 5, maxLossPct: 10, minTradingDays: 4, resetTimezone: "CE(S)T" } },
    { id: "ftmo-1step", name: "1-Step · Challenge / Account", stage: "1-Step", accountSize: 100000, market: "CFD", rules: { profitTargetPct: 10, maxDailyLossPct: 3, maxLossPct: 10, consistencyRule: 50, resetTimezone: "CE(S)T" } },
  ]},
  { id: "the5ers", name: "The5ers", markets: ["Futures", "CFD"], vendorOptions: { Futures: ["Black Arrow"], CFD: CFD_VENDORS }, source: "https://the5ers.com/", programs: [
    { id: "the5ers-futures-25k", name: "Futures · 25K", stage: "Evaluation", accountSize: 25000, market: "Futures", vendor: "Black Arrow", platform: "Black Arrow", rules: { profitTargetPct: 6, fundedProfitTargetPct: 4, maxDailyLossPct: 4, consistencyRule: 40, maxContracts: 2, maxMicros: 20, newsTrading: true } },
    { id: "the5ers-2step-new-100k", name: "2-Step New · 100K", stage: "Evaluation", accountSize: 100000, market: "CFD", rules: { profitTargetPct: 10, phase2ProfitTargetPct: 5, maxLossPct: 10, maxDailyLossPct: 3 } },
  ]},
  { id: "tradeify", name: "Tradeify", markets: ["Futures"], vendorOptions: { Futures: ["Tradovate", "Rithmic"] }, source: "https://help.tradeify.co/en/collections/15250320-trading-rules", programs: [
    { id: "tradeify-growth-50k", name: "Growth · 50K", stage: "Funded", accountSize: 50000, market: "Futures", rules: { dailyLossLimit: 1250, consistencyRule: 35, drawdownType: "EOD trailing", payoutNote: "Consistency applies to Growth Sim Funded accounts." } },
    { id: "tradeify-lightning-50k", name: "Lightning · 50K", stage: "Funded", accountSize: 50000, market: "Futures", rules: { dailyLossLimit: 1250, consistencyRule: 20, drawdownType: "EOD trailing", payoutNote: "Consistency scales by payout number for newer accounts." } },
    { id: "tradeify-select-daily-50k", name: "Select Daily · 50K", stage: "Funded", accountSize: 50000, market: "Futures", rules: { dailyLossLimit: 1000, drawdownType: "EOD trailing" } },
  ]},
];

export function getFirm(id) { return PROP_FIRM_CATALOG.find((f) => f.id === id) || null; }
export function getProgram(firmId, programId) { return getFirm(firmId)?.programs.find((p) => p.id === programId) || null; }
export function flattenRules(program) { return program?.rules ? { ...program.rules } : {}; }

export function enrichCatalog(remoteCatalog = []) {
  if (!Array.isArray(remoteCatalog) || !remoteCatalog.length) return PROP_FIRM_CATALOG;
  return remoteCatalog.map((remoteFirm) => {
    const localFirm = getFirm(remoteFirm.id);
    if (!localFirm) return remoteFirm;
    const remoteById = new Map((remoteFirm.programs || []).map((p) => [p.id, p]));
    const mergedPrograms = localFirm.programs.map((localProgram) => ({
      ...localProgram,
      ...(remoteById.get(localProgram.id) || {}),
      market: remoteById.get(localProgram.id)?.market || localProgram.market,
      accountVariant: remoteById.get(localProgram.id)?.accountVariant || localProgram.accountVariant,
      feeMode: remoteById.get(localProgram.id)?.feeMode || localProgram.feeMode,
    }));
    return {
      ...localFirm,
      ...remoteFirm,
      name: localFirm.name,
      markets: localFirm.markets,
      vendorOptions: localFirm.vendorOptions,
      variants: localFirm.variants,
      programs: mergedPrograms,
    };
  });
}

export async function fetchPropFirmCatalog() {
  const response = await fetch("/.netlify/functions/prop-rules", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Prop firm rules request failed (${response.status})`);
  return response.json();
}

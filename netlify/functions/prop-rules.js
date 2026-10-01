const CATALOG = [
  { id: "apex", name: "Apex Trader Funding", category: "Futures", source: "https://apextraderfunding.com/help-center/", programs: [
    { id: "apex-eod-pa-50k", name: "EOD Performance Account · 50K", stage: "Performance", accountSize: 50000, rules: { maxDrawdown: 2600, consistencyRule: 50, minTradingDays: 5, minDailyProfit: 250, minEquityForPayout: 52600, minPayout: 500, maxPayouts: 6, payoutSplit: 100, drawdownType: "EOD" } },
    { id: "apex-eod-pa-150k", name: "EOD Performance Account · 150K", stage: "Performance", accountSize: 150000, rules: { maxDrawdown: 4100, consistencyRule: 50, minTradingDays: 5, minDailyProfit: 350, minEquityForPayout: 154600, minPayout: 500, maxPayouts: 6, payoutSplit: 100, drawdownType: "EOD" } },
    { id: "apex-intraday-trail-25k-tradovate-standard", name: "Intraday Trail · 25K · Tradovate · Standard", shortName: "25K Intraday Trail · Standard", stage: "Evaluation", accountSize: 25000, vendor: "Tradovate", platform: "Tradovate", programFamily: "Intraday Trail · 25K", pricing: { onePack: 16.70, fivePack: 74.95, currency: "USD", promo: "Coupon pricing shown on Apex checkout" }, rules: { profitTarget: 1500, maxDrawdown: 1000, drawdownType: "Intraday Trail", maxContracts: 4, maxMicros: 40, minTradingDays: 1, evaluationDays: 30, evaluationConsistencyRule: null, dailyLossLimit: null, activationFee: 59, activationDeadlineDays: 7, payoutFrequencyDays: 5, maxAccounts: 20, performanceMaxContracts: 2, performanceMaxMicros: 20, performanceMaxDrawdown: 1000, performanceDailyLossLimit: "Yes · tier-based", consistencyRule: 50, payoutSplit: 100, inactivityPolicy: "Yes", maxPayouts: 6, scaling: "Built-in for PA", resetFee: "N/A" } },
    { id: "apex-intraday-trail-25k-tradovate-no-activation", name: "Intraday Trail · 25K · Tradovate · No Activation Fee", shortName: "25K Intraday Trail · No Activation Fee", stage: "Evaluation", accountSize: 25000, vendor: "Tradovate", platform: "Tradovate", programFamily: "Intraday Trail · 25K", pricing: { onePack: 14.70, fivePack: 64.95, currency: "USD", promo: "Coupon pricing shown in the supplied screenshot; verify at checkout" }, rules: { profitTarget: 1500, maxDrawdown: 1000, drawdownType: "Intraday Trail", maxContracts: 4, maxMicros: 40, minTradingDays: 1, evaluationDays: 30, evaluationConsistencyRule: null, dailyLossLimit: null, activationFee: 0, activationDeadlineDays: 7, payoutFrequencyDays: 5, maxAccounts: 20, performanceMaxContracts: 2, performanceMaxMicros: 20, performanceMaxDrawdown: 1000, performanceDailyLossLimit: "Yes · tier-based", consistencyRule: 50, payoutSplit: 100, inactivityPolicy: "Yes", maxPayouts: 6, scaling: "Built-in for PA", resetFee: "N/A" } },
  ]},
  { id: "topstep", name: "Topstep", category: "Futures", source: "https://help.topstep.com/", programs: [
    { id: "topstep-combine-50k", name: "Trading Combine · 50K", stage: "Evaluation", accountSize: 50000, rules: { consistencyRule: 55, profitTarget: 3000, maxContracts: 5, maxMicros: 50, drawdownType: "MLL" } },
    { id: "topstep-combine-100k", name: "Trading Combine · 100K", stage: "Evaluation", accountSize: 100000, rules: { consistencyRule: 55, profitTarget: 6000, maxContracts: 10, maxMicros: 100, drawdownType: "MLL" } },
    { id: "topstep-xfa-standard", name: "Express Funded · Standard", stage: "Funded", rules: { minProfitableDays: 5, minDailyProfit: 150, payoutCapPct: 50, payoutCapUsd: 5000, payoutSplit: 90, drawdownType: "MLL" } },
    { id: "topstep-xfa-consistency", name: "Express Funded · Consistency", stage: "Funded", rules: { consistencyRule: 40, minTradingDays: 3, payoutCapPct: 50, payoutCapUsd: 6000, payoutSplit: 90, drawdownType: "MLL" } },
  ]},
  { id: "fundednext", name: "FundedNext Futures", category: "Futures", source: "https://fundednext.com/general-rules/futures/trading-objectives", programs: [
    { id: "fn-rapid-pro-50k", name: "Rapid Pro · 50K", stage: "Challenge", accountSize: 50000, rules: { profitTarget: 3000, payoutSplit: 90, inactivityDays: 30 } },
    { id: "fn-rapid-daily-50k", name: "Rapid Daily · 50K", stage: "Challenge", accountSize: 50000, rules: { profitTarget: 3000, dailyLossLimit: 1000, payoutSplit: 90, inactivityDays: 30 } },
    { id: "fn-legacy-50k", name: "Legacy · 50K", stage: "Challenge", accountSize: 50000, rules: { profitTarget: 3000, consistencyRule: 40, payoutSplit: 80, inactivityDays: 30 } },
    { id: "fn-flex-50k", name: "Flex · 50K", stage: "Challenge", accountSize: 50000, rules: { profitTarget: 2500, consistencyRule: 40, payoutSplit: 95, inactivityDays: 30 } },
  ]},
  { id: "ftmo", name: "FTMO", category: "Forex / CFD", source: "https://ftmo.com/en/trading-objectives/", programs: [
    { id: "ftmo-2step-challenge", name: "2-Step · Challenge", stage: "Challenge", accountSize: 100000, rules: { profitTargetPct: 10, maxDailyLossPct: 5, maxLossPct: 10, minTradingDays: 4, resetTimezone: "CE(S)T" } },
    { id: "ftmo-2step-verification", name: "2-Step · Verification", stage: "Verification", accountSize: 100000, rules: { profitTargetPct: 5, maxDailyLossPct: 5, maxLossPct: 10, minTradingDays: 4, resetTimezone: "CE(S)T" } },
    { id: "ftmo-1step", name: "1-Step · Challenge / Account", stage: "1-Step", accountSize: 100000, rules: { profitTargetPct: 10, maxDailyLossPct: 3, maxLossPct: 10, consistencyRule: 50, resetTimezone: "CE(S)T" } },
  ]},
  { id: "the5ers", name: "The5ers", category: "Futures / Forex", source: "https://the5ers.com/", programs: [
    { id: "the5ers-futures-25k", name: "Futures · 25K", stage: "Evaluation", accountSize: 25000, rules: { profitTargetPct: 6, fundedProfitTargetPct: 4, maxDailyLossPct: 4, consistencyRule: 40, maxContracts: 2, maxMicros: 20, newsTrading: true, platform: "Black Arrow" } },
    { id: "the5ers-2step-new-100k", name: "2-Step New · 100K", stage: "Evaluation", accountSize: 100000, rules: { profitTargetPct: 10, phase2ProfitTargetPct: 5, maxLossPct: 10, maxDailyLossPct: 3 } },
  ]},
  { id: "tradeify", name: "Tradeify", category: "Futures", source: "https://help.tradeify.co/en/collections/15250320-trading-rules", programs: [
    { id: "tradeify-growth-50k", name: "Growth · 50K", stage: "Funded", accountSize: 50000, rules: { dailyLossLimit: 1250, consistencyRule: 35, drawdownType: "EOD trailing" } },
    { id: "tradeify-lightning-50k", name: "Lightning · 50K", stage: "Funded", accountSize: 50000, rules: { dailyLossLimit: 1250, consistencyRule: 20, drawdownType: "EOD trailing" } },
    { id: "tradeify-select-daily-50k", name: "Select Daily · 50K", stage: "Funded", accountSize: 50000, rules: { dailyLossLimit: 1000, drawdownType: "EOD trailing" } },
  ]},
];

export default async function handler() {
  const sources = [...new Set(CATALOG.map((f) => f.source))];
  const results = await Promise.allSettled(sources.map(async (url) => {
    const r = await fetch(url, { headers: { "User-Agent": "TradeLog Rules Monitor/1.0", Accept: "text/html,application/xhtml+xml" } });
    return { url, status: r.status, ok: r.ok };
  }));
  const sourceStatus = results.map((r, i) => r.status === "fulfilled" ? r.value : { url: sources[i], status: 0, ok: false });
  return new Response(JSON.stringify({ version: "2026-09-20", fetchedAt: new Date().toISOString(), sourceCount: sourceStatus.filter((s) => s.ok).length, sourceStatus, firms: CATALOG }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=900, s-maxage=900" },
  });
}

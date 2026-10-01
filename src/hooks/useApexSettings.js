import { useCallback, useState } from "react";
import { saveSettingsDb } from "../supabase.js";

export const DEFAULT_APEX_SETTINGS = {
  accountSize: 25000,
  maxDrawdown: 1500,
  dailyLossLimit: 500,
  perTradeRiskLimit: 250,
  minTradingDays: 1,
  minProfitableDays: 1,
  minDailyProfit: 50,
  minEquityForPayout: 26500,
  minPayout: 0,
  unloggedProfitOffset: 0,
  profitTarget: 1500,
  consistencyRule: 40,
  accountName: "The5ers 25K",
  platform: "BlackArrow",
};

export function useApexSettings() {
  const [settings, setSettings] = useState(DEFAULT_APEX_SETTINGS);

  const applySettings = useCallback(async (nextSettings) => {
    try {
      await saveSettingsDb(nextSettings);
      setSettings(nextSettings);
    } catch (error) {
      console.error("Failed to save account settings:", error);
      alert(`Failed to save account settings: ${error.message}`);
      throw error;
    }
  }, []);

  const mergeSettings = useCallback((savedSettings) => {
    if (!savedSettings) return;
    setSettings((previous) => ({ ...previous, ...savedSettings }));
  }, []);

  return { settings, applySettings, mergeSettings };
}

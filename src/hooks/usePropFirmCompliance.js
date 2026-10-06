import { useMemo } from "react";
import { calculatePropFirmCompliance, normalizePropRules } from "../services/propFirmCompliance.js";

export { calculatePropFirmCompliance, normalizePropRules };

export function usePropFirmCompliance(trades = [], settings = {}, draftTrade = null) {
  return useMemo(() => calculatePropFirmCompliance(trades, settings, draftTrade), [trades, settings, draftTrade]);
}

import { useCallback, useMemo, useState } from "react";
import { fetchPropFirmCatalog, getFirm, getProgram, PROP_FIRM_CATALOG, enrichCatalog } from "../services/propFirmRules.js";

export function usePropFirmRules(initial = {}) {
  const [catalog, setCatalog] = useState(PROP_FIRM_CATALOG);
  const [status, setStatus] = useState({ state: "local", fetchedAt: null, error: null, sourceCount: 0 });

  const refresh = useCallback(async () => {
    setStatus((s) => ({ ...s, state: "loading", error: null }));
    try {
      const payload = await fetchPropFirmCatalog();
      if (Array.isArray(payload?.firms) && payload.firms.length) setCatalog(enrichCatalog(payload.firms));
      setStatus({ state: "fresh", fetchedAt: payload.fetchedAt || new Date().toISOString(), error: null, sourceCount: payload.sourceCount || 0 });
      return payload;
    } catch (error) {
      setStatus((s) => ({ ...s, state: "error", error: error?.message || "Unable to refresh official rules" }));
      throw error;
    }
  }, []);

  const selectedFirm = useMemo(() => catalog.find((f) => f.id === initial.propFirmId) || getFirm(initial.propFirmId), [catalog, initial.propFirmId]);
  const selectedProgram = useMemo(() => selectedFirm?.programs.find((p) => p.id === initial.propProgramId) || getProgram(initial.propFirmId, initial.propProgramId), [selectedFirm, initial.propFirmId, initial.propProgramId]);

  return { catalog, selectedFirm, selectedProgram, status, refresh };
}

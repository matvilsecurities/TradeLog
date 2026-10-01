import { useEffect, useState } from "react";
import { fetchDashboardSummaryDb } from "../supabase.js";

export function useDashboardSummary({ accountId = "all", accountIds = null, dateMode = "latest-month", enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: Boolean(enabled), error: null });

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    fetchDashboardSummaryDb({ accountId, accountIds, dateMode })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => { cancelled = true; };
  }, [accountId, accountIds, dateMode, enabled]);

  return state;
}

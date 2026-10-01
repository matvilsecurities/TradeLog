import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

const DEFAULT_PLAN = {
  id: null,
  date: "",
  marketBias: "",
  keyLevels: "",
  setupFocus: "",
  maxRisk: "300",
  maxTrades: "3",
  newsFocus: "",
  notes: "",
  rulesConfirmed: false,
  setupChecklist: {},
};

function storageKey(userId, date) {
  return `tradelog:trading-plan:${userId || "local"}:${date}`;
}

function fromDb(row, date) {
  if (!row) return { ...DEFAULT_PLAN, date };
  return {
    id: row.id || null,
    date,
    marketBias: row.market_bias || "",
    keyLevels: row.key_levels || "",
    setupFocus: row.setup_focus || "",
    maxRisk: row.max_risk == null ? "300" : String(row.max_risk),
    maxTrades: row.max_trades == null ? "3" : String(row.max_trades),
    newsFocus: row.news_focus || "",
    notes: row.notes || "",
    rulesConfirmed: Boolean(row.rules_confirmed),
    setupChecklist: row.setup_checklist && typeof row.setup_checklist === "object" ? row.setup_checklist : {},
  };
}

function toDb(plan, userId, date) {
  return {
    user_id: userId,
    plan_date: date,
    market_bias: plan.marketBias || null,
    key_levels: plan.keyLevels || "",
    setup_focus: plan.setupFocus || "",
    max_risk: Number(plan.maxRisk) || 0,
    max_trades: Number(plan.maxTrades) || 0,
    news_focus: plan.newsFocus || "",
    notes: plan.notes || "",
    rules_confirmed: Boolean(plan.rulesConfirmed),
    setup_checklist: plan.setupChecklist && typeof plan.setupChecklist === "object" ? plan.setupChecklist : {},
  };
}

export function useTradingPlan(userId, date) {
  const key = useMemo(() => storageKey(userId, date), [userId, date]);
  const [plan, setPlan] = useState({ ...DEFAULT_PLAN, date });
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStorageError("");
      if (supabase && userId && date) {
        try {
          const { data, error } = await supabase
            .from("trading_plans")
            .select("id,market_bias,key_levels,setup_focus,max_risk,max_trades,news_focus,notes,rules_confirmed,setup_checklist,updated_at")
            .eq("user_id", userId)
            .eq("plan_date", date)
            .maybeSingle();
          if (error) throw error;
          if (cancelled) return;
          if (data) {
            setPlan(fromDb(data, date));
            setSavedAt(data.updated_at || null);
            try { window.localStorage.setItem(key, JSON.stringify({ ...fromDb(data, date), savedAt: data.updated_at })); } catch {}
            return;
          }
        } catch (error) {
          if (!cancelled) setStorageError(`Trading plan storage unavailable: ${error?.message || "Unable to read Supabase."}`);
        }
      }
      try {
        const raw = window.localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!cancelled) {
          setPlan({ ...DEFAULT_PLAN, ...(parsed || {}), date });
          setSavedAt(parsed?.savedAt || null);
        }
      } catch {
        if (!cancelled) { setPlan({ ...DEFAULT_PLAN, date }); setSavedAt(null); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [key, userId, date]);

  const updatePlan = useCallback((patch) => {
    setPlan((current) => ({ ...current, ...patch }));
  }, []);

  const savePlan = useCallback(async () => {
    const next = { ...plan, date };
    setSaving(true);
    setStorageError("");
    try {
      if (!supabase || !userId) throw new Error("Supabase is not configured or the user session is unavailable.");
      const { data, error } = await supabase
        .from("trading_plans")
        .upsert(toDb(next, userId, date), { onConflict: "user_id,plan_date" })
        .select("id,market_bias,key_levels,setup_focus,max_risk,max_trades,news_focus,notes,rules_confirmed,setup_checklist,updated_at")
        .single();
      if (error) throw error;
      const saved = fromDb(data, date);
      setPlan(saved);
      setSavedAt(data.updated_at || new Date().toISOString());
      try { window.localStorage.setItem(key, JSON.stringify({ ...saved, savedAt: data.updated_at })); } catch {}
      return saved;
    } catch (error) {
      const message = error?.message || "Unable to save trading plan.";
      setStorageError(`Trading plan storage unavailable: ${message}`);
      try {
        const fallback = { ...next, savedAt: new Date().toISOString() };
        window.localStorage.setItem(key, JSON.stringify(fallback));
        setPlan(fallback);
        setSavedAt(fallback.savedAt);
      } catch {}
      return next;
    } finally {
      setSaving(false);
    }
  }, [date, key, plan, userId]);

  const clearPlan = useCallback(async () => {
    setStorageError("");
    try {
      if (supabase && userId) {
        const { error } = await supabase.from("trading_plans").delete().eq("user_id", userId).eq("plan_date", date);
        if (error) throw error;
      }
      window.localStorage.removeItem(key);
      setPlan({ ...DEFAULT_PLAN, date });
      setSavedAt(null);
    } catch (error) {
      setStorageError(`Trading plan storage unavailable: ${error?.message || "Unable to clear Supabase plan."}`);
    }
  }, [date, key, userId]);

  const loadHistory = useCallback(async () => {
    if (!supabase || !userId) return [];
    const { data, error } = await supabase
      .from("trading_plans")
      .select("id,plan_date,market_bias,key_levels,setup_focus,max_risk,max_trades,news_focus,notes,rules_confirmed,setup_checklist,updated_at,created_at")
      .eq("user_id", userId)
      .order("plan_date", { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => fromDb(row, row.plan_date));
  }, [userId]);

  return { plan, updatePlan, savePlan, clearPlan, savedAt, saving, storageError, loadHistory };
}

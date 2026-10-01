// ── Default checklist (original account / ICT-style setup) ─────
// ⚠️ Keys here must NOT change — existing logged trades store these
// exact keys in their `setup_checklist` object, and grading just
// counts `true` values, so renaming/removing keys would silently
// break old trades' history and grades.

export const SETUP_CHECKS_DEFAULT = [
  {key:"session_time",     label:"Trade after 17:30 IST"},
  {key:"session_sweep",    label:"Session Sweep"},
  {key:"candle_pattern",   label:"Candlestick Pattern"},
  {key:"fvg",              label:"FVG"},
  {key:"bos",              label:"BoS"},
  {key:"ote",              label:"OTE Golden Zone"},
  {key:"htf_structure",    label:"Higher Timeframe Structure Aligned"},
  {key:"premium_discount", label:"Premium / Discount Area Respected"},
  {key:"news_checked",     label:"News Checked"},
  {key:"risk_ok",          label:"Risk Under $250"},
];

// ── Alternate checklist (EMA-based setup, second user) ──────────
export const SETUP_CHECKS_EMA = [
  {key:"price_vs_20ema",        label:"Price Above or Below 20 EMA"},
  {key:"price_vs_50ema",        label:"Price Above or Below 50 EMA"},
  {key:"ema_gap_clear",         label:"Clear Gap Between 20/50 EMA"},
  {key:"gap_widening",          label:"Gap Widening"},
  {key:"broke_recent_high_low", label:"Price Broken Recent High or Low"},
  {key:"candle_pattern_ema",    label:"Candlestick Pattern"},
  {key:"ema_untouched_20min",   label:"Price Not Touched 20/50 EMA for at Least 20 Minutes"},
  {key:"htf_structure_ema",     label:"Higher Timeframe Structure Aligned"},
  {key:"trade_after_4pm",       label:"Trade After 4PM"},
  {key:"continuous_candle_ema", label:"Continuous Small Red/Green Candles Above or Below 20/50 EMA"},
];

// ── Per-account assignment ───────────────────────────────────────
// Add each Supabase login email (lowercase) here and point it at the
// checklist that account should always use. Anyone not listed falls
// back to SETUP_CHECKS_DEFAULT.
const USER_CHECKLIST_MAP = {
  "matvilsecurities@gmail.com":        SETUP_CHECKS_DEFAULT,
  "patidar.yogesh@gmail.com":          SETUP_CHECKS_EMA,
};

export function getSetupChecksForUser(email) {
  if (email) {
    const match = USER_CHECKLIST_MAP[email.toLowerCase()];
    if (match) return match;
  }
  return SETUP_CHECKS_DEFAULT;
}

// Kept for any file that still imports the old flat name directly.
export const SETUP_CHECKS = SETUP_CHECKS_DEFAULT;
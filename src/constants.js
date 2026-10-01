// ── constants.js ─────────────────────────────────────────────
// Pure, static data + pure helper functions extracted from App.jsx.
// Nothing in this file holds React state or mutable app state
// (theme's mutable `V`/`getV` stay in App.jsx on purpose — see
// note there). Everything here is safe to import from any view
// file once those get split out later.

import { SETUP_CHECKS_DEFAULT } from "./setupChecklist.js";
import { isWinningTrade, isLosingTrade } from "./tradeStats.js";

// ── Themes ───────────────────────────────────────────────────
export const THEMES = {
  dark: {
    bg: "#0f1117", surface: "#161b27", border: "#1e2535",
    text: "#e2e8f0", muted: "#64748b",
    radius: "8px", radiusLg: "12px", font: "Inter, system-ui, sans-serif",
  },
  light: {
    bg: "#ffffff", surface: "#f4f6f9", border: "#e2e8f0",
    text: "#1a202c", muted: "#718096",
    radius: "8px", radiusLg: "12px", font: "Inter, system-ui, sans-serif",
  },
};

// V is a live-updating export: every file that imports it always sees
// the current value automatically. Only setThemeValue is allowed to
// change it — other files must never do `V = ...` themselves. This
// (not a locally-scoped V) is what lets split-out view files like
// SLTPCalculator.jsx read the current theme correctly.
export let V = THEMES["dark"];
if (typeof window !== "undefined") window.__V__ = V;

export function setThemeValue(themeName) {
  V = THEMES[themeName];
  if (typeof window !== "undefined") window.__V__ = V;
}

// ── Colors ───────────────────────────────────────────────────
export const GRN    = "#00d9a0";
export const RED    = "#ff4060";
export const BLU    = "#4d8aff";
export const PURPLE = "#a78bfa";
export const TEAL   = "#22d3ee";
export const AMBER  = "#f59e0b";

// ── Data constants ───────────────────────────────────────────
export const SYMBOLS  = ["MNQ","MGC"];
export const SESSIONS = ["NY Open","London Session","Asian Session"];
export const MOODS    = ["😞","😕","😐","🙂","😁"];
export const MISTAKES = [
  {key:"fomo",          label:"FOMO — Entered without waiting for setup"},
  {key:"early_entry",   label:"Early Entry — Entered before confirmation"},
  {key:"late_entry",    label:"Late Entry — Missed ideal entry, chased price"},
  {key:"overtrading",   label:"Overtrading — Took more than 1 trade"},
  {key:"moved_sl",      label:"Moved SL — Widened stop loss mid-trade"},
  {key:"early_exit",    label:"Early Exit — Closed before TP hit"},
  {key:"revenge_trade", label:"Revenge Trade — Traded to recover a loss"},
  {key:"ignored_news",  label:"Ignored News — Traded during high impact news"},
  {key:"no_checklist",  label:"Skipped Checklist — Didn't verify all conditions"},
  {key:"oversized",     label:"Oversized — Risked more than $250"},
  {key:"no_plan",       label:"No Plan — Entered without clear SL/TP"},
  {key:"emotional",     label:"Emotional — Traded based on feelings not setup"},
];

export const PSYCH_ITEMS = [
  {key:"fear",       label:"Fear",       emoji:"😟"},
  {key:"greed",      label:"Greed",      emoji:"🤑"},
  {key:"fomo",       label:"FOMO",       emoji:"😬"},
  {key:"revenge",    label:"Revenge",    emoji:"😠"},
  {key:"confidence", label:"Confidence", emoji:"😎"},
];

export const QUOTES = [
  "The goal is not more trades. The goal is better trades.",
  "Discipline is doing what needs to be done, even when you don't feel like it.",
  "Patience is the edge most traders give away for free.",
  "Risk management is the only edge that never stops working.",
  "Your worst trades happen when you stop following your own rules.",
];

// Original reflections for the Guided Entry "trade management" step —
// blending calm/mindfulness framing with themes drawn from the Gita's
// teaching on steady-minded, detached action (not direct quotations).
export const MINDSET_QUOTES = [
  "You control your actions, not the market's next candle — place the trade, then let go of the outcome.",
  "A calm mind sees the setup clearly; an anxious mind sees only the fear of missing it.",
  "Treat a win and a loss the same way: as information, not as a verdict on you.",
  "Attachment to being right is more expensive than any single stop-loss.",
  "Discipline is the quiet work you do when no one, not even your future self, will ever know.",
  "Steadiness through both success and failure is the real mark of skill — let that be today's benchmark, not the P&L.",
  "Your job was to follow the plan. What happens after entry is not your job anymore.",
  "Breathe. The trade is already placed. There is nothing more useful you can do right now than stay calm.",
  "Equanimity isn't indifference — it's caring about your process more than any single outcome.",
  "One trade does not define your edge. One breath does not define your day. Stay with the plan.",
  "Act fully, without obsessing over the fruit of the action — as true for a trade as for anything else.",
  "The market doesn't know you're watching. Watch it anyway, but from stillness, not urgency.",
  "Let this trade be practice in discipline, not a demand for validation.",
  "Fear and greed are just visitors. Notice them, name them, and let the plan lead instead.",
  "A quiet mind executes the plan. A loud mind negotiates with it.",
];

export const toLocalISODate = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toLocalTimeHHMM = (d = new Date()) => {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const BLANK = {
  date: toLocalISODate(),
  time: "14:00", exit_time: "",
  symbol: "MNQ", dir: "Long",
  entry:"", exit:"", qty:1,
  pnl:"", rr:"", sl:"", tp:"", risk:"",
  session:"NY Open", mood:3,
  screenshot_before:"", screenshot_after:"", chart_url:"",
  notes:"",
  notes_log:[{id:1, time:"14:00", text:""}],
  mistakes:[],mistake_pnl:0,mistake_outcome:"",
};

// Builds a fresh {key:false, ...} object for whichever checklist is active.
export const blankChecklist = (checklist) =>
  Object.fromEntries((checklist||SETUP_CHECKS_DEFAULT).map(c=>[c.key,false]));

// ── Helpers ──────────────────────────────────────────────────
export const fp = n => `${n>=0?"+":"-"}$${Math.abs(Math.round(n)).toLocaleString()}`;
export const fd = d => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
// ScreenshotUpload's value is either a plain URL string (already-saved trades,
// fetched back from Supabase storage) or a freshly-picked {file, preview}
// object (preview = a local blob: URL) before it's been uploaded. Anywhere
// a screenshot needs to be rendered as an <img src>, resolve through this.
export const screenshotSrc = v => typeof v==="string" ? v : (v?.preview || "");
export const getNotesText = t => t.notes_log ? t.notes_log.map(e=>e.text).filter(Boolean).join(" ") : (t.notes||"");

export const calcHoldingTime=(time,exit_time)=>{
  if(!time||!exit_time)return null;
  const [eh,em]=time.split(":").map(Number);
  const [xh,xm]=exit_time.split(":").map(Number);
  const mins=(xh*60+xm)-(eh*60+em);
  if(mins<=0)return null;
  if(mins<60)return `${mins}m`;
  return `${Math.floor(mins/60)}h ${mins%60}m`;
};

export const calcHoldingMins=(time,exit_time)=>{
  if(!time||!exit_time)return null;
  const [eh,em]=time.split(":").map(Number);
  const [xh,xm]=exit_time.split(":").map(Number);
  const mins=(xh*60+xm)-(eh*60+em);
  return mins>0?mins:null;
};

export function getSetupRating(setup_checklist) {
  if (!setup_checklist) return {grade:"—", label:"No Data", color:"#64748b", score:0};
  const score = Object.values(setup_checklist).filter((value) => typeof value === "boolean" && value).length;
  if (score===10) return {grade:"A+", label:"Perfect Setup",       color:GRN,   score};
  if (score>=8)   return {grade:"A",  label:"High Probability",    color:BLU,   score};
  if (score>=6)   return {grade:"B",  label:"Moderate Probability",color:AMBER, score};
  if (score>=4)   return {grade:"C",  label:"Low Probability",     color:RED,   score};
                  return {grade:"D",  label:"Poor Setup — Avoid",  color:"#991b1b", score};
}

export function calcStats(trades) {
  if (!trades.length) return {totalPnl:0,winRate:0,pf:"–",avgWin:0,avgLoss:0,total:0,wins:0,losses:0,equityCurve:[],maxDD:0,bestTrade:0,worstTrade:0};
  const wins   = trades.filter(t=>isWinningTrade(t.pnl));
  const losses = trades.filter(t=>isLosingTrade(t.pnl));
  const gWin   = wins.reduce((s,t)=>s+t.pnl,0);
  const gLoss  = Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
  const sorted = [...trades].sort((a,b)=>a.date.localeCompare(b.date));
  let eq=0, peak=0, maxDD=0;
  const equityCurve = sorted.map(t=>{
    eq+=t.pnl; if(eq>peak) peak=eq;
    const dd=peak-eq; if(dd>maxDD) maxDD=dd;
    return {date:fd(t.date), equity:Math.round(eq), pnl:t.pnl};
  });
  return {
    totalPnl:  Math.round(eq),
    winRate:   Math.round(wins.length/trades.length*100),
    pf:        gLoss>0?(gWin/gLoss).toFixed(2):"∞",
    avgWin:    wins.length   ? Math.round(gWin/wins.length)   : 0,
    avgLoss:   losses.length ? Math.round(gLoss/losses.length): 0,
    total:     trades.length,
    wins:      wins.length,
    losses:    losses.length,
    equityCurve,
    maxDD:     Math.round(maxDD),
    bestTrade: Math.max(...trades.map(t=>t.pnl)),
    worstTrade:Math.min(...trades.map(t=>t.pnl)),
  };
}

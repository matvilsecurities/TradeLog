import { useEffect, useMemo, useState } from "react";
import { MISTAKES } from "../constants.js";
import { getPnl } from "../components/trades/tradeUtils.js";
import { fetchForexFactoryCalendar, getNewsForTrade } from "../services/forexFactory.js";

const SESSION_WINDOWS = [
  { name: "Asian Session", start: 3.5, end: 11.5 },
  { name: "London Session", start: 12.5, end: 16.5 },
  { name: "NY Open", start: 17.5, end: 21.5 },
];

function timeToHours(value) {
  const [h, m] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h + m / 60;
}

export function inferSession(time) {
  const hours = timeToHours(time);
  if (hours == null) return "Unknown";
  return SESSION_WINDOWS.find((w) => hours >= w.start && hours <= w.end)?.name || "Outside Preferred Session";
}

function classifyRR(trade) {
  const entry = Number(trade?.entry);
  const sl = Number(trade?.sl);
  const tp = Number(trade?.tp);
  if (![entry, sl, tp].every(Number.isFinite)) return null;
  const risk = trade?.dir === "Short" ? sl - entry : entry - sl;
  const reward = trade?.dir === "Short" ? entry - tp : tp - entry;
  if (!(risk > 0) || !(reward > 0)) return null;
  return reward / risk;
}

function checklistStats(trade) {
  const checks = trade?.setup_checklist && typeof trade.setup_checklist === "object" ? Object.values(trade.setup_checklist).filter((value) => typeof value === "boolean") : [];
  const total = checks.length;
  const passed = checks.filter(Boolean).length;
  return { passed, total, complete: total > 0 && passed === total };
}

function normalizeTrade(trade, newsEvents) {
  const inferredSession = inferSession(trade?.time);
  const explicitSession = trade?.session || "";
  const rr = classifyRR(trade);
  const checklist = checklistStats(trade);
  const news = getNewsForTrade(newsEvents, trade);
  const mistakes = Array.isArray(trade?.mistakes) ? trade.mistakes : [];
  const flags = [];

  if (!explicitSession || explicitSession === "Unknown") {
    if (inferredSession === "Outside Preferred Session") flags.push({ key: "session", severity: "warning", text: "Trade time is outside the preferred session windows." });
  }
  if (news.length) flags.push({ key: "news", severity: "warning", text: `${news.length} high-impact ${trade?.symbol === "MGC" ? "USD" : "USD"} event${news.length === 1 ? "" : "s"} within the configured news window.` });
  if (rr != null && rr < 3) flags.push({ key: "rr", severity: "warning", text: `Planned R:R is ${rr.toFixed(2)}R, below the 1:3 journal target.` });
  if (Number(trade?.qty) > 1) flags.push({ key: "size", severity: "info", text: `Position uses ${trade.qty} contracts.` });
  if (!checklist.complete && checklist.total) flags.push({ key: "checklist", severity: "warning", text: `Checklist was ${checklist.passed}/${checklist.total} complete.` });
  if (mistakes.length) flags.push({ key: "mistakes", severity: "warning", text: `${mistakes.length} recorded execution mistake${mistakes.length === 1 ? "" : "s"}.` });
  if (trade?.setup_checklist?.news_checked === false) flags.push({ key: "news-check", severity: "warning", text: "News check was explicitly left incomplete." });

  const pnl = getPnl(trade);
  const quality = Math.max(0, Math.min(100,
    (checklist.total ? checklist.passed / checklist.total * 55 : 25) +
    (rr == null ? 0 : Math.min(rr / 3, 1) * 25) +
    (mistakes.length ? Math.max(0, 15 - mistakes.length * 5) : 15) +
    (news.length && !trade?.setup_checklist?.news_checked ? 0 : 5)
  ));

  return { ...trade, pnl, inferredSession, rr, checklist, news, flags, mistakes, quality: Math.round(quality) };
}

function dailySummary(trades) {
  const byDate = new Map();
  for (const trade of trades) {
    const date = String(trade?.date || trade?.trade_date || "").slice(0, 10);
    if (!date) continue;
    const row = byDate.get(date) || { date, trades: 0, pnl: 0, wins: 0, losses: 0, flagged: 0 };
    row.trades += 1;
    row.pnl += getPnl(trade);
    if (getPnl(trade) > 0) row.wins += 1;
    if (getPnl(trade) < 0) row.losses += 1;
    if (trade.flags?.length) row.flagged += 1;
    byDate.set(date, row);
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function useJournalIntelligence(trades = []) {
  const [newsState, setNewsState] = useState({ events: [], status: "loading" });

  useEffect(() => {
    let active = true;
    fetchForexFactoryCalendar()
      .then((result) => active && setNewsState({ events: result.events || [], status: result.error ? "stale" : "ready" }))
      .catch(() => active && setNewsState({ events: [], status: "error" }));
    return () => { active = false; };
  }, []);

  return useMemo(() => {
    const normalized = (Array.isArray(trades) ? trades : []).map((trade) => normalizeTrade(trade, newsState.events));
    const flagged = normalized.filter((trade) => trade.flags.length);
    const highPriority = normalized.filter((trade) => trade.flags.some((f) => f.severity === "warning"));
    const clean = normalized.filter((trade) => !trade.flags.length);
    const daily = dailySummary(normalized);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const todayTrades = normalized.filter((trade) => String(trade?.date || trade?.trade_date || "").slice(0, 10) === today);
    const todayPnl = todayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const mistakeCounts = new Map(MISTAKES.map((m) => [m.key, { key: m.key, label: m.label, count: 0, pnl: 0 }]));
    normalized.forEach((trade) => trade.mistakes.forEach((key) => {
      const row = mistakeCounts.get(key);
      if (row) { row.count += 1; row.pnl += trade.pnl; }
    }));
    const recurringMistakes = [...mistakeCounts.values()].filter((x) => x.count).sort((a, b) => b.count - a.count);
    const avgQuality = normalized.length ? normalized.reduce((sum, t) => sum + t.quality, 0) / normalized.length : 0;
    const avgRR = normalized.filter((t) => t.rr != null).reduce((sum, t, _, arr) => sum + t.rr / arr.length, 0);

    return {
      trades: normalized,
      flagged,
      highPriority,
      clean,
      daily,
      todayTrades,
      todayPnl,
      recurringMistakes,
      avgQuality: Math.round(avgQuality),
      avgRR: Number.isFinite(avgRR) && avgRR ? avgRR : null,
      newsStatus: newsState.status,
      reviewQueue: [...highPriority].sort((a, b) => {
        const severity = (t) => t.flags.filter((f) => f.severity === "warning").length;
        return severity(b) - severity(a) || Math.abs(b.pnl) - Math.abs(a.pnl);
      }).slice(0, 12),
    };
  }, [trades, newsState]);
}

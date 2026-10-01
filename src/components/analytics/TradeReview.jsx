import React, { useEffect, useMemo, useState } from "react";
import { V, GRN, RED, BLU, AMBER, PURPLE, MISTAKES } from "../../constants.js";
import { SlidersHorizontal, ChevronDown, CalendarDays, Check } from "lucide-react";
import { getPnl, getTradeGrade, getTradeNotes, getSetupRating } from "../trades/tradeUtils.js";
import { fetchTradeReviewsDb, saveTradeReviewDb } from "../../supabase.js";

const money = (value) => {
  const n = Number(value) || 0;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
};

const outcomeOf = (trade) => {
  const pnl = getPnl(trade);
  if (pnl > 0) return "Win";
  if (pnl < 0) return "Loss";
  return "BE";
};

const toneFor = (outcome) => outcome === "Win" ? GRN : outcome === "Loss" ? RED : V.muted;

const reviewLabel = (status) => {
  if (status === "reviewed") return "Reviewed";
  if (status === "needs_follow_up") return "Follow-up";
  return "Pending";
};

function ReviewList({ trades, selectedId, onSelect, reviews }) {
  return (
    <div className="trade-review-queue-list">
      {trades.length === 0 ? (
        <div style={{ padding: 28, color: V.muted, textAlign: "center" }}>No trades match the current review filters.</div>
      ) : trades.map((trade) => {
        const outcome = outcomeOf(trade);
        const selected = String(trade.id) === String(selectedId);
        const review = reviews[String(trade.id)] || { review_status: "pending", notes: "" };
        const priority = outcome === "Loss" && review.review_status !== "reviewed";
        return (
          <button key={trade.id} type="button" className={`trade-review-queue-card${selected ? " is-selected" : ""}${priority ? " is-loss" : ""}`} onClick={() => onSelect(trade.id)} aria-label={`Review ${trade.symbol || "trade"}`}>
            <span className="trade-review-queue-symbol">{trade.symbol || "—"}</span>
            <span className="trade-review-queue-direction" style={{ color: trade.dir === "Long" ? GRN : RED }}>{trade.dir || "—"}</span>
            <span className="trade-review-queue-date">{trade.date || "—"}</span>
            {priority ? <span className="trade-review-queue-badge">LOSS · REVIEW</span> : <span className="trade-review-queue-setup">{trade.setup || "No setup"}</span>}
            <span className="trade-review-queue-pnl" style={{ color: toneFor(outcome) }}>{money(getPnl(trade))}</span>
            <span className={`trade-review-queue-status status-${review.review_status}`}>{reviewLabel(review.review_status)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Metric({ label, value, tone = V.text, sub, className = "" }) {
  return (
    <div className={`trade-review-kpi td-kpi ${className}`} style={{ color: tone }}>
      <span>{label}</span>
      <strong style={{ color: tone }}>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Section({ title, subtitle, children, style = {}, className = "" }) {
  return (
    <section className={`trade-review-section ${className}`} style={style}>
      <div className="trade-review-section-header">
        <div className="trade-review-section-title">{title}</div>
        {subtitle && <div className="trade-review-section-subtitle">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

export default function TradeReview({ trades = [], s, onViewChart, onLoadImages, theme = "light" }) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const [period, setPeriod] = useState("all");
  const [outcome, setOutcome] = useState("All");
  const [grade, setGrade] = useState("All");
  const [reviewFilter, setReviewFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [reviews, setReviews] = useState({});
  const [noteDraft, setNoteDraft] = useState("");
  const [reviewStatusDraft, setReviewStatusDraft] = useState("reviewed");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const now = new Date();
    const rows = [...safeTrades].filter((trade) => {
      const result = outcomeOf(trade);
      if (outcome !== "All" && result !== outcome) return false;
      const g = String(getTradeGrade(trade) || "").toUpperCase();
      if (grade !== "All" && g !== grade) return false;
      if (period !== "all") {
        const date = new Date(`${trade.date || ""}T12:00:00`);
        if (Number.isNaN(date.getTime())) return false;
        const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
        if ((now.getTime() - date.getTime()) > days * 86400000) return false;
      }
      const status = reviews[String(trade.id)]?.review_status || "pending";
      if (reviewFilter !== "All" && status !== reviewFilter) return false;
      return true;
    });

    return rows.sort((a, b) => {
      const ar = reviews[String(a.id)]?.review_status || "pending";
      const br = reviews[String(b.id)]?.review_status || "pending";
      const priority = (trade) => outcomeOf(trade) === "Loss" ? 0 : 1;
      const reviewPriority = (status) => status === "pending" ? 0 : status === "needs_follow_up" ? 1 : 2;
      return (reviewPriority(ar) - reviewPriority(br)) || (priority(a) - priority(b)) || `${b?.date || ""}${b?.time || ""}`.localeCompare(`${a?.date || ""}${a?.time || ""}`);
    });
  }, [safeTrades, period, outcome, grade, reviewFilter, reviews]);

  useEffect(() => {
    let cancelled = false;
    const ids = safeTrades.map((t) => t?.id).filter(Boolean);
    if (!ids.length) return undefined;
    fetchTradeReviewsDb(ids).then((rows) => {
      if (cancelled) return;
      const map = {};
      for (const row of rows) map[String(row.trade_id)] = row;
      setReviews(map);
    }).catch((error) => {
      if (!cancelled) setReviewMessage(`Review storage is unavailable: ${error?.message || "apply the Trade Review migration"}`);
    });
    return () => { cancelled = true; };
  }, [safeTrades]);

  const selected = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.find((t) => String(t.id) === String(selectedId)) || filtered[0];
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selected) {
      setNoteDraft("");
      setReviewStatusDraft("reviewed");
      return;
    }
    const existing = reviews[String(selected.id)] || {};
    setNoteDraft(existing.notes || getTradeNotes(selected) || "");
    setReviewStatusDraft(existing.review_status || "pending");
    setReviewMessage("");
    if (onLoadImages && !selected.screenshot_before && !selected.screenshot_after) onLoadImages(selected.id);
  }, [selected?.id]);

  const reviewStats = useMemo(() => {
    const wins = safeTrades.filter((t) => getPnl(t) > 0).length;
    const losses = safeTrades.filter((t) => getPnl(t) < 0).length;
    const reviewed = safeTrades.filter((t) => reviews[String(t.id)]?.review_status === "reviewed").length;
    const followUp = safeTrades.filter((t) => reviews[String(t.id)]?.review_status === "needs_follow_up").length;
    const pending = Math.max(0, safeTrades.length - reviewed - followUp);
    const lossesPending = safeTrades.filter((t) => getPnl(t) < 0 && reviews[String(t.id)]?.review_status !== "reviewed").length;
    return { wins, losses, reviewed, followUp, pending, lossesPending };
  }, [safeTrades, reviews]);

  const checklist = selected?.setup_checklist || {};
  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const checklistTotal = Object.keys(checklist).length;
  const setupRating = getSetupRating(checklist);
  const selectedMistakes = (selected?.mistakes || []).map((key) => MISTAKES.find((m) => m.key === key)?.label || key);
  const isLoss = selected ? outcomeOf(selected) === "Loss" : false;

  const saveReview = async (nextStatus = reviewStatusDraft) => {
    if (!selected?.id) return;
    setSavingReview(true);
    setReviewMessage("");
    try {
      const saved = await saveTradeReviewDb({ tradeId: selected.id, reviewStatus: nextStatus, notes: noteDraft.trim() });
      setReviews((previous) => ({ ...previous, [String(selected.id)]: saved }));
      setReviewStatusDraft(saved.review_status);
      setReviewMessage("Review saved to Supabase.");
    } catch (error) {
      setReviewMessage(error?.message || "Unable to save review.");
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div className="trade-review-workspace" data-theme={theme === "dark" ? "dark" : "light"} style={{ maxWidth: 1500, margin: "0 auto", color: V.text, background: "transparent" }}>
      <div className="trade-review-header">
        <div>
          <div className="trade-review-title">Trade Review</div>
          <div className="trade-review-subtitle">Review every journaled trade, with losses automatically prioritized for deeper review.</div>
        </div>
        <div className="trade-review-toolbar">
          <div className="trade-review-filter-wrap">
            <button type="button" className={`trade-review-control ${filtersOpen ? "is-open" : ""}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
              <SlidersHorizontal size={14} strokeWidth={1.8} />
              <span>Filters</span>
              <ChevronDown size={13} className={filtersOpen ? "rotate" : ""} />
            </button>
            {(period !== "all" || outcome !== "All" || grade !== "All" || reviewFilter !== "All") && <span className="trade-review-filter-count">{[period !== "all", outcome !== "All", grade !== "All", reviewFilter !== "All"].filter(Boolean).length}</span>}
            {filtersOpen && (
              <div className="trade-review-filter-popover">
                <div className="trade-review-filter-heading">Review filters</div>
                <label><span>Date range</span><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">All time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select></label>
                <label><span>Outcome</span><select value={outcome} onChange={(e) => setOutcome(e.target.value)}><option>All</option><option>Win</option><option>Loss</option><option>BE</option></select></label>
                <label><span>Grade</span><select value={grade} onChange={(e) => setGrade(e.target.value)}><option>All grades</option><option>A+</option><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
                <label><span>Review status</span><select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}><option value="All">All reviews</option><option value="pending">Pending</option><option value="needs_follow_up">Follow-up</option><option value="reviewed">Reviewed</option></select></label>
                <button type="button" className="trade-review-clear" onClick={() => { setPeriod("all"); setOutcome("All"); setGrade("All"); setReviewFilter("All"); setFiltersOpen(false); }}>Clear filters</button>
              </div>
            )}
          </div>
          <button type="button" className="trade-review-control" onClick={() => setPeriod(period === "all" ? "30d" : "all")} title="Toggle recent review period">
            <CalendarDays size={14} strokeWidth={1.8} />
            <span>{period === "all" ? "All time" : period === "7d" ? "7 days" : period === "30d" ? "30 days" : "90 days"}</span>
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <div className="trade-review-kpis">
        <Metric label="Trades to review" value={reviewStats.pending} sub={`${safeTrades.length} journaled trades in scope`} />
        <Metric label="Losses to review" value={reviewStats.lossesPending} tone={reviewStats.lossesPending ? RED : GRN} sub="Losses stay prioritized until reviewed" />
        <Metric label="Reviewed" value={reviewStats.reviewed} tone={GRN} sub={`${safeTrades.length ? Math.round(reviewStats.reviewed / safeTrades.length * 100) : 0}% of loaded trades`} />
        <Metric label="Follow-up" value={reviewStats.followUp} tone={reviewStats.followUp ? AMBER : V.text} sub="Trades needing another look" />
      </div>

      {reviewMessage && <div style={{ marginBottom: 12, padding: "9px 12px", border: `1px solid ${reviewMessage.includes("saved") ? `${GRN}55` : `${AMBER}55`}`, background: reviewMessage.includes("saved") ? `${GRN}0d` : `${AMBER}0d`, color: reviewMessage.includes("saved") ? GRN : AMBER, borderRadius: V.radius, fontSize: 11 }}>{reviewMessage}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,.78fr) minmax(0,1.65fr)", gap: 14 }}>
        <Section title="Review Queue" subtitle="Losses and unreviewed trades are automatically brought to the top." className="trade-review-queue-section">
          <div className="trade-review-section-body trade-review-queue-body"><ReviewList trades={filtered} selectedId={selected?.id} onSelect={setSelectedId} reviews={reviews} /></div>
        </Section>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!selected ? <Section title="Trade review" subtitle="Select a trade from the queue."><div style={{ color: V.muted, padding: 42, textAlign: "center" }}>Select a trade to begin the review.</div></Section> : (
            <>
              <Section title="Trade overview" subtitle="Every execution metric is presented as a compact review KPI." className="trade-review-overview-section">
                <div className="trade-review-section-body trade-review-overview-body">
                  <div className="trade-review-trade-head">
                    <div>
                      <div className="trade-review-trade-identity">
                        <span className="trade-review-symbol">{selected.symbol || "Trade"}</span>
                        <span className="trade-review-direction" style={{ color: selected.dir === "Long" ? GRN : RED }}>{selected.dir}</span>
                        <span className="trade-review-date">{selected.date || "—"}</span>
                      </div>
                      <div className="trade-review-session">{selected.session || "Session not recorded"} · {selected.setup || "No setup recorded"}</div>
                      {onViewChart && <button type="button" className="trade-review-chart-btn" onClick={() => onViewChart(selected)}>Open in Chart Workspace ↗</button>}
                    </div>
                    <div className="trade-review-result">
                      <div className="trade-review-pnl" style={{ color: toneFor(outcomeOf(selected)) }}>{money(getPnl(selected))}</div>
                      <div className="trade-review-grade" style={{ color: setupRating.color }}>{setupRating.grade} — {setupRating.label}</div>
                    </div>
                  </div>

                  <div className="trade-review-metric-grid trade-review-metric-grid-five">
                    <Metric label="Entry" value={selected.entry ?? "—"} />
                    <Metric label="Stop loss" value={selected.sl ?? "—"} tone={RED} />
                    <Metric label="Take profit" value={selected.tp ?? "—"} tone={GRN} />
                    <Metric label="R:R" value={selected.rr ? `${selected.rr}R` : "—"} />
                    <Metric label="Risk" value={selected.risk ? money(selected.risk) : "—"} tone={AMBER} />
                  </div>
                </div>
              </Section>

              <Section title={isLoss ? "Loss diagnosis" : "Execution quality"} subtitle={isLoss ? "Losses require an explicit process review before they can be considered complete." : "Review whether the execution matched the planned setup."} className="trade-review-diagnosis-section">
                <div className="trade-review-section-body trade-review-diagnosis-body">
                  <div className="trade-review-metric-grid trade-review-metric-grid-two">
                    <Metric label="Setup quality" value={`${checkedCount}/${checklistTotal || 0}`} tone={setupRating.color} sub={setupRating.label} />
                    <Metric label="Mistakes" value={selectedMistakes.length} tone={selectedMistakes.length ? RED : GRN} sub={selectedMistakes.length ? "Mistake flags recorded" : "No mistake flags"} />
                    <Metric label="Outcome" value={outcomeOf(selected)} tone={toneFor(outcomeOf(selected))} sub={isLoss ? "Prioritize root-cause notes" : "Capture what worked"} />
                    <Metric label="Review state" value={reviewLabel(reviewStatusDraft)} tone={reviewStatusDraft === "reviewed" ? GRN : AMBER} />
                  </div>
                  <div className="trade-review-checklist">
                    <div className="trade-review-checklist-head">
                      <span>Execution checklist</span>
                      <strong style={{ color: setupRating.color }}>{checkedCount}/{checklistTotal || 0}</strong>
                    </div>
                    <div className="trade-review-progress"><div style={{ width: `${checklistTotal ? Math.min(100, checkedCount / checklistTotal * 100) : 0}%`, background: setupRating.color }} /></div>
                  </div>
                  {selectedMistakes.length > 0 && <div className="trade-review-mistakes"><div className="trade-review-mistakes-title">Recorded mistakes</div>{selectedMistakes.map((m) => <div key={m}>• {m}</div>)}</div>}
                </div>
              </Section>

              <Section title="Review notes" subtitle="Write the lesson, mistake, context and next action. Notes are stored in Supabase with this trade." className="trade-review-notes-section">
                <div className="trade-review-section-body trade-review-notes-body">
                  <textarea className="trade-review-notes-input" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={isLoss ? "Why did this loss happen? Did you follow the setup? What should change next time?" : "What worked? What would you repeat or improve?"} />
                  <div className="trade-review-notes-footer">
                    <div className="trade-review-note-meta">{noteDraft.length} characters · {reviews[String(selected.id)]?.updated_at ? `Last saved ${new Date(reviews[String(selected.id)].updated_at).toLocaleString()}` : "Not saved yet"}</div>
                    <div className="trade-review-note-actions">
                      <button type="button" className="trade-review-follow-btn" disabled={savingReview} onClick={() => saveReview("needs_follow_up")}>Needs follow-up</button>
                      <button type="button" className="trade-review-save-btn" disabled={savingReview} onClick={() => saveReview("reviewed")}>{savingReview ? "Saving…" : isLoss ? "Save & Mark Loss Reviewed" : "Save Review"}</button>
                    </div>
                  </div>
                </div>
              </Section>

              {(selected.screenshot_before || selected.screenshot_after) && <Section title="Trade evidence" subtitle="Visual evidence attached to the journal entry." className="trade-review-evidence-section"><div className="trade-review-evidence-grid">{[["Before entry", selected.screenshot_before], ["After exit", selected.screenshot_after]].map(([label, src]) => src ? <div key={label} className="trade-review-evidence-item"><div className="trade-review-evidence-label">{label}</div><img src={src} alt={label} /></div> : null)}</div></Section>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

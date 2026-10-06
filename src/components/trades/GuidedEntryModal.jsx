import { SETUP_CHECKS_DEFAULT } from "../../setupChecklist.js";
import { fetchTradingPlanByDateDb } from "../../supabase.js";
import NotesLog from "../shared/NotesLog";
import ScreenshotUpload from "../shared/ScreenshotUpload";
import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { V, GRN, RED, BLU, PURPLE, AMBER, SYMBOLS, SESSIONS, MOODS, MISTAKES, MINDSET_QUOTES, BLANK, blankChecklist, toLocalISODate, toLocalTimeHHMM, fp, getSetupRating, screenshotSrc } from "../../constants.js";

const STEPS = [
  { id: "today-plan", label: "Today’s Plan", short: "Plan", hint: "Choose plan or no plan" },
  { id: "setup", label: "Setup", short: "Setup", hint: "Validate the idea" },
  { id: "risk-plan", label: "Risk Plan", short: "Risk", hint: "Define risk & target" },
  { id: "entry", label: "Entry", short: "Entry", hint: "Record the execution" },
  { id: "manage", label: "Manage", short: "Manage", hint: "Capture the trade" },
  { id: "exit", label: "Exit", short: "Exit", hint: "Record the result" },
  { id: "review", label: "Review", short: "Review", hint: "Confirm & save" },
];

const symbolMultiplier = (sym) => (sym === "MNQ" ? 2 : 10);

const fieldStyle = (s) => ({
  ...s.inp,
  width: "100%",
  boxSizing: "border-box",
  height: 39,
  minHeight: 39,
  fontSize: 12,
  padding: "0 12px",
});

function GuidedEntryModal({ checklist = SETUP_CHECKS_DEFAULT, onSave, onClose, s, settings = {}, todayPlanMode = "unset", onPlanModeChange, onOpenTradingPlan }) {
  const [step, setStep] = useState(0);
  const [tpEdited, setTpEdited] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * MINDSET_QUOTES.length));
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [todayPlan, setTodayPlan] = useState(null);
  const [todayPlanLoading, setTodayPlanLoading] = useState(false);
  const [todayPlanError, setTodayPlanError] = useState("");
  const reviewRef = useRef(null);

  const [f, setF] = useState(() => ({
    ...BLANK,
    clientOperationId: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: toLocalISODate(),
    time: toLocalTimeHHMM(),
    setup_checklist: blankChecklist(checklist),
    notes_log: [{ id: 1, time: new Date().toTimeString().slice(0, 5), text: "" }],
    intraday_trailing_enabled: false,
    intraday_peak_price: "",
  }));

  const setupRating = getSetupRating(f.setup_checklist);
  const checkedCount = Object.values(f.setup_checklist || {}).filter((value) => typeof value === "boolean" && value).length;
  const todayIso = toLocalISODate();
  const todayPlanChecks = checklist.map((item) => ({ ...item, checked: Boolean(todayPlan?.setup_checklist?.[item.key]) }));
  const todayPlanChecked = todayPlanChecks.filter((item) => item.checked).length;
  const todayPlanHasSavedPlan = Boolean(todayPlan?.id || todayPlan?.plan_date || todayPlan?.date);
  const mult = symbolMultiplier(f.symbol);
  const entryNum = parseFloat(f.entry);
  const slNum = parseFloat(f.sl);
  const tpNum = parseFloat(f.tp);
  const qtyNum = parseInt(f.qty, 10) || 1;
  const drawdownType = String(settings?.propRules?.drawdownType || settings?.drawdownType || "").toLowerCase();
  const isIntradayTrailing = drawdownType.includes("intraday") && drawdownType.includes("trail");
  const intradayEnabled = isIntradayTrailing && f.intraday_trailing_enabled !== false;
  const peakPriceNum = parseFloat(f.intraday_peak_price);
  const peakFavorablePoints = intradayEnabled && Number.isFinite(entryNum) && Number.isFinite(peakPriceNum)
    ? (f.dir === "Long" ? Math.max(0, peakPriceNum - entryNum) : Math.max(0, entryNum - peakPriceNum))
    : 0;
  const peakPnl = Math.round(peakFavorablePoints * qtyNum * mult * 100) / 100;
  const slPts = !isNaN(entryNum) && !isNaN(slNum) ? (f.dir === "Long" ? entryNum - slNum : slNum - entryNum) : null;
  const tpPts = !isNaN(entryNum) && !isNaN(tpNum) ? (f.dir === "Long" ? tpNum - entryNum : entryNum - tpNum) : null;
  const riskDollar = slPts != null && slPts > 0 ? Math.round(slPts * qtyNum * mult) : null;
  const rewardDollar = tpPts != null && tpPts > 0 ? Math.round(tpPts * qtyNum * mult) : null;
  const overRisk = riskDollar != null && riskDollar > 250;
  const entryReady = f.date && f.time && f.symbol && f.qty && !isNaN(entryNum) && !isNaN(slNum) && slPts > 0 && !isNaN(tpNum) && tpPts > 0 && !overRisk;
  const exitReady = f.exit !== "" && !isNaN(parseFloat(f.exit)) && !!f.exit_time;

  const applyTodayPlanChecklist = () => {
    if (!todayPlanHasSavedPlan) return;
    const plannedChecklist = Object.fromEntries(
      checklist.map((item) => [item.key, Boolean(todayPlan?.setup_checklist?.[item.key])])
    );
    setF((prev) => ({ ...prev, setup_checklist: plannedChecklist }));
  };

  useEffect(() => {
    let cancelled = false;
    const loadPlan = async () => {
      setTodayPlanError("");
      setTodayPlanLoading(true);
      try {
        const data = await fetchTradingPlanByDateDb(todayIso);
        if (!cancelled) setTodayPlan(data || null);
      } catch (error) {
        if (!cancelled) {
          setTodayPlan(null);
          setTodayPlanError(error?.message || "Unable to load today’s Trading Plan.");
        }
      } finally {
        if (!cancelled) setTodayPlanLoading(false);
      }
    };
    loadPlan();
    return () => { cancelled = true; };
  }, [todayIso]);

  useEffect(() => {
    if (tpEdited) return;
    const e = parseFloat(f.entry);
    const sl = parseFloat(f.sl);
    if (isNaN(e) || isNaN(sl)) return;
    const distance = f.dir === "Long" ? e - sl : sl - e;
    if (distance <= 0) return;
    const tp = f.dir === "Long" ? e + distance * 2 : e - distance * 2;
    setF((prev) => ({ ...prev, tp: Math.round(tp * 100) / 100 }));
  }, [f.entry, f.sl, f.dir, tpEdited]);

  const nextQuote = () => setQuoteIdx((prev) => {
    if (MINDSET_QUOTES.length < 2) return prev;
    let next = Math.floor(Math.random() * MINDSET_QUOTES.length);
    while (next === prev) next = Math.floor(Math.random() * MINDSET_QUOTES.length);
    return next;
  });

  const stepValid = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return true;
    if (step === 2) return entryReady;
    if (step === 5) return exitReady;
    return true;
  }, [step, entryReady, exitReady]);

  const finalizeSave = async () => {
    if (!entryReady || !exitReady || saving) return;
    setSaving(true);
    const exitNum = parseFloat(f.exit);
    const pts = f.dir === "Long" ? exitNum - entryNum : entryNum - exitNum;
    const pnl = Math.round(pts * qtyNum * mult);
    const rr = slPts > 0 ? Math.round((pts / slPts) * 100) / 100 : 0;
    const finalRating = getSetupRating(f.setup_checklist);
    try {
      await onSave({
      ...f,
      entry: entryNum,
      exit: exitNum,
      qty: qtyNum,
      pnl,
      rr,
      sl: parseFloat(f.sl) || 0,
      tp: parseFloat(f.tp) || 0,
      risk: riskDollar || 0,
      setup: Object.entries(f.setup_checklist || {})
        .filter(([, value]) => typeof value === "boolean" && value)
        .map(([key]) => checklist.find((item) => item.key === key)?.label)
        .filter(Boolean)
        .join(", ") || "—",
      setup_score: finalRating.score,
      grade: finalRating.grade,
      setup_checklist: {
        ...(f.setup_checklist || {}),
        ...(isIntradayTrailing ? {
          __intraday_trailing: {
            enabled: Boolean(intradayEnabled),
            peakPrice: Number.isFinite(peakPriceNum) ? peakPriceNum : null,
            peakPnl: peakPnl,
          },
        } : {}),
      },
      notes: (f.notes_log || []).map((entry) => entry.text).filter(Boolean).join(" | "),
      clientOperationId: f.clientOperationId,
    });
    onClose();
    } finally {
      setSaving(false);
    }
  };

  const downloadReviewPdf = async () => {
    if (!reviewRef.current) return;
    setPdfBusy(true);
    try {
      const canvas = await html2canvas(reviewRef.current, {
        backgroundColor: V.bg,
        scale: 2,
        useCORS: true,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let left = imgHeight;
      let pos = 0;
      pdf.addImage(img, "PNG", 0, pos, pageWidth, imgHeight);
      left -= pageHeight;
      while (left > 0) {
        pos = left - imgHeight;
        pdf.addPage();
        pdf.addImage(img, "PNG", 0, pos, pageWidth, imgHeight);
        left -= pageHeight;
      }
      pdf.save(`trade-review_${f.symbol}_${f.date}_${f.time?.replace(":", "") || ""}.pdf`);
    } catch (error) {
      console.error("Failed to generate trade review PDF:", error);
      alert("Couldn't generate the PDF — check the console for details.");
    } finally {
      setPdfBusy(false);
    }
  };

  const renderField = (label, input) => (
    <label className="ge-field">
      <span>{label}</span>
      {input}
    </label>
  );

  const renderStep = () => {
    if (step === 0) {
      return (
        <div className="ge-plan-card ge-step-content ge-today-plan-step">
          <div className="ge-intro">
            <div>
              <span className="ge-eyebrow">TODAY’S TRADING PLAN</span>
              <h2>Record this trade with today’s plan — or continue without one.</h2>
            </div>
            <div className={`ge-plan-status ${todayPlanHasSavedPlan ? "ready" : "missing"}`}>{todayPlanHasSavedPlan ? "Plan available" : "No plan saved"}</div>
          </div>

          {todayPlanLoading ? <div className="ge-plan-loading">Loading today’s Trading Plan…</div> : todayPlanHasSavedPlan ? (
            <>
              <div className="ge-today-plan-summary">
                <div><span>Market bias</span><strong>{todayPlan.market_bias || "Not set"}</strong></div>
                <div><span>Setup focus</span><strong>{todayPlan.setup_focus || "Not set"}</strong></div>
                <div><span>Max daily risk</span><strong>{todayPlan.max_risk != null ? `$${todayPlan.max_risk}` : "—"}</strong></div>
                <div><span>Max trades</span><strong>{todayPlan.max_trades ?? "—"}</strong></div>
              </div>
              <div
                className={`ge-quality ge-quality-circular ge-today-plan-quality-card ge-quality-level-${Math.max(0, Math.min(10, todayPlanChecked))}`}
                aria-label={`Today's Setup Quality ${todayPlanChecked} out of ${todayPlanChecks.length}`}
                style={{ "--progress": `${todayPlanChecks.length ? (todayPlanChecked / todayPlanChecks.length) * 100 : 0}%` }}
              >
                <div className="ge-quality-ring">
                  <div className="ge-quality-ring-content">
                    <div className="ge-quality-score">{todayPlanChecked}/{todayPlanChecks.length}</div>
                    <div className="ge-quality-score-label">Quality</div>
                  </div>
                </div>
                <div className="ge-quality-details">
                  <div className="ge-quality-head">
                    <strong>Setup Quality</strong>
                    <b>{todayPlanChecks.length ? Math.round((todayPlanChecked / todayPlanChecks.length) * 100) : 0}% complete</b>
                  </div>
                  <div className="ge-quality-bars ge-quality-bars-hover" aria-hidden="true">
                    {todayPlanChecks.map((item) => <span key={item.key} className={item.checked ? "is-filled" : ""} />)}
                  </div>
                  <div className="ge-quality-legend">
                    <span><i className="ge-quality-dot complete" />Completed</span>
                    <span><i className="ge-quality-dot pending" />Remaining</span>
                  </div>
                </div>
              </div>
              {todayPlan.notes && <div className="ge-today-plan-notes ge-today-plan-notes-compact"><span>PLAN NOTES</span><p>{todayPlan.notes}</p></div>}
            </>
          ) : (
            <div className="ge-today-plan-empty">
              <strong>No Trading Plan saved for today.</strong>
              <p>You can create one now, or intentionally continue without a plan.</p>
              {todayPlanError && <small>{todayPlanError}</small>}
            </div>
          )}

          <div className="ge-today-plan-choice">
            <div><span>RECORDING MODE</span><strong>{todayPlanMode === "with-plan" && todayPlanHasSavedPlan ? "Record with today’s plan" : todayPlanMode === "without-plan" ? "Go without trading plan" : "Choose how to record this trade"}</strong><small>{todayPlanMode === "with-plan" && todayPlanHasSavedPlan ? "The plan and checklist snapshot will be attached to this trade." : todayPlanMode === "without-plan" ? "This trade will be saved without a Trading Plan link." : "This choice does not block the trade entry workflow."}</small></div>
            <div className="ge-today-plan-actions">
              {todayPlanHasSavedPlan && <button type="button" className={`ge-plan-choice ${todayPlanMode === "with-plan" ? "selected" : ""}`} onClick={() => { applyTodayPlanChecklist(); onPlanModeChange?.("with-plan"); }}>✓ Use today’s plan</button>}
              <button type="button" className={`ge-plan-choice ${todayPlanMode === "without-plan" ? "selected" : ""}`} onClick={() => onPlanModeChange?.("without-plan")}>Continue without plan</button>
              <button type="button" className="ge-plan-edit" onClick={onOpenTradingPlan}>Edit today’s plan →</button>
            </div>
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="ge-plan-card ge-step-content ge-setup-step">
          <div className="ge-setup-copy">
            <span className="ge-eyebrow">SETUP CHECKLIST</span>
            <h2>Confirm your setup conditions before taking the trade.</h2>
          </div>
          <div className="ge-setup-layout">
            <div className="ge-setup-left">
              <div className="ge-checklist">
                {checklist.map((item) => {
                  const selected = Boolean(f.setup_checklist[item.key]);
                  return (
                    <button key={item.key} type="button" className={`ge-check ${selected ? "is-checked" : ""}`} onClick={() => setF((prev) => ({ ...prev, setup_checklist: { ...prev.setup_checklist, [item.key]: !prev.setup_checklist[item.key] } }))}>
                      <span className="ge-check-box">{selected ? "✓" : ""}</span>
                      <span>{item.label}</span>
                      <span className="ge-check-info">i</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="ge-setup-right">
              <div
                className={`ge-quality ge-quality-circular ge-quality-level-${Math.max(0, Math.min(10, checkedCount))}`}
                aria-label={`Setup Quality ${checkedCount} out of ${checklist.length}`}
                style={{ "--progress": `${checklist.length ? (checkedCount / checklist.length) * 100 : 0}%` }}
              >
                <div className="ge-quality-ring">
                  <div className="ge-quality-ring-content">
                    <div className="ge-quality-score">{checkedCount}/{checklist.length}</div>
                    <div className="ge-quality-score-label">Quality</div>
                  </div>
                </div>
                <div className="ge-quality-details">
                  <div className="ge-quality-head">
                    <strong>Setup Quality</strong>
                    <b>{checklist.length ? Math.round((checkedCount / checklist.length) * 100) : 0}% complete</b>
                  </div>
                  <div className="ge-quality-bars ge-quality-bars-hover" aria-hidden="true">
                    {checklist.map((item) => <span key={item.key} className={f.setup_checklist[item.key] ? "is-filled" : ""} />)}
                  </div>
                  <div className="ge-quality-legend">
                    <span><i className="ge-quality-dot complete" />Completed</span>
                    <span><i className="ge-quality-dot pending" />Remaining</span>
                  </div>
                </div>
              </div>
              <label className="ge-notes-block">
                <span>Notes <em>(Optional)</em></span>
                <textarea value={f.notes_log?.[0]?.text || ""} maxLength={300} onChange={(e) => setF((prev) => ({ ...prev, notes_log: [{ ...(prev.notes_log?.[0] || { id: 1, time: toLocalTimeHHMM() }), text: e.target.value }] }))} placeholder="Add any notes about your setup, market context, or reasoning for this trade..." />
                <small>{(f.notes_log?.[0]?.text || "").length}/300</small>
              </label>
              <div className="ge-setup-grade">
                <div className="ge-setup-grade-head">
                  <strong>Setup Grade</strong>
                  <span className="ge-grade-info" title="Grade is based on completed setup checklist conditions.">i</span>
                </div>
                <div className="ge-grade-circle" style={{"--grade-color": setupRating.color}}>
                  <strong>{setupRating.grade}</strong>
                </div>
                <strong className="ge-grade-label" style={{ color: setupRating.color }}>{setupRating.label}</strong>
                <p>{setupRating.grade === "A+" ? "All setup conditions confirmed. Execute with discipline." : setupRating.grade === "A" ? "Meets most of your conditions. Stay disciplined with execution." : setupRating.grade === "B" ? "A valid setup, but some conditions are missing." : setupRating.grade === "C" ? "Several conditions are missing. Review before continuing." : "Insufficient confirmation. Avoid forcing the trade."}</p>
              </div>
            </div>
          </div>
                  </div>
      );
    }

    if (step === 2) {
      return (
        <div className="ge-plan-card ge-step-content ge-plan-step">
          <div className="ge-intro"><div><span className="ge-eyebrow">03 · TRADE PLAN</span><h2>Define the trade before the trade.</h2><p>Set the level, size and planned risk.</p></div></div>
          <div className="ge-grid-4 ge-plan-fields">
            {renderField("Date", <input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} style={fieldStyle(s)} />)}
            {renderField("Entry time", <input type="time" value={f.time} onChange={(e) => setF((p) => ({ ...p, time: e.target.value }))} style={fieldStyle(s)} />)}
            {renderField("Symbol", <select value={f.symbol} onChange={(e) => setF((p) => ({ ...p, symbol: e.target.value }))} style={fieldStyle(s)}>{SYMBOLS.map((sym) => <option key={sym}>{sym}</option>)}</select>)}
            {renderField("Quantity", <input type="number" min="1" value={f.qty} onChange={(e) => setF((p) => ({ ...p, qty: e.target.value }))} style={fieldStyle(s)} />)}

            <div className="ge-field ge-direction-field">
              <span>Direction</span>
              <div className="ge-segment">
                {["Long", "Short"].map((dir) => <button key={dir} type="button" className={f.dir === dir ? `is-${dir.toLowerCase()}` : ""} onClick={() => { setTpEdited(false); setF((p) => ({ ...p, dir })); }}>{dir}</button>)}
              </div>
            </div>
            {renderField("Entry price", <input type="number" value={f.entry} onChange={(e) => setF((p) => ({ ...p, entry: e.target.value }))} placeholder="e.g. 20250" style={fieldStyle(s)} />)}
            {renderField("Stop loss", <input type="number" value={f.sl} onChange={(e) => { setTpEdited(false); setF((p) => ({ ...p, sl: e.target.value })); }} placeholder="SL level" style={{ ...fieldStyle(s), borderColor: f.sl ? RED : V.border }} />)}
            {renderField("Take profit", <input type="number" value={f.tp} onChange={(e) => { setTpEdited(true); setF((p) => ({ ...p, tp: e.target.value })); }} placeholder="Auto 1:2" style={{ ...fieldStyle(s), borderColor: f.tp ? GRN : V.border }} />)}
          </div>
          <div className="ge-metrics">
            <div><span>Planned risk</span><strong style={{ color: overRisk ? RED : V.text }}>{riskDollar != null ? `$${riskDollar}` : "—"}</strong></div>
            <div><span>Planned reward</span><strong style={{ color: GRN }}>{rewardDollar != null ? `$${rewardDollar}` : "—"}</strong></div>
            <div><span>R:R</span><strong>{riskDollar && rewardDollar ? `${(rewardDollar / riskDollar).toFixed(1)}R` : "—"}</strong></div>
            <div><span>Session</span><strong className="ge-metric-select"><select value={f.session} onChange={(e) => setF((p) => ({ ...p, session: e.target.value }))} style={fieldStyle(s)}>{SESSIONS.map((session) => <option key={session}>{session}</option>)}</select></strong></div>
          </div>
          <div className="ge-plan-notice"><strong>Set your planned risk and reward to stay disciplined.</strong><span> You can always adjust these values later.</span></div>
          {isIntradayTrailing && (
            <div className="ge-intraday-trailing">
              <div className="ge-intraday-trailing-head">
                <div className="ge-intraday-trailing-copy">
                  <span>Intraday trailing threshold</span>
                  <strong>Track maximum equity reached during this trade</strong>
                  <p>Enter the best price reached while the position was open. Only the highest account equity ever reached moves the trailing threshold.</p>
                </div>
                <label className="ge-intraday-toggle"><input type="checkbox" checked={intradayEnabled} onChange={(e) => setF((p) => ({ ...p, intraday_trailing_enabled: e.target.checked }))} /> Calculate</label>
              </div>
              {intradayEnabled && (
                <div className="ge-intraday-trailing-grid">
                  {renderField("Peak price reached", <input type="number" value={f.intraday_peak_price} onChange={(e) => setF((p) => ({ ...p, intraday_peak_price: e.target.value }))} placeholder={f.dir === "Long" ? "Highest price" : "Lowest price"} style={fieldStyle(s)} />)}
                  <div className="ge-intraday-trailing-metric"><span>Trailing threshold lift</span><strong style={{ color: peakPnl > 0 ? GRN : V.muted }}>{peakPnl > 0 ? `+$${peakPnl.toFixed(2)}` : "—"}</strong></div>
                </div>
              )}
            </div>
          )}
          {overRisk && <div className="ge-error">Planned risk is above the current $250 limit. Reduce size or adjust the stop.</div>}
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="ge-plan-card ge-step-content">
          <div className="ge-intro"><div><span className="ge-eyebrow">04 · EXECUTION</span><h2>Record the actual entry.</h2><p>Keep execution data separate from the plan so you can compare them later.</p></div></div>
          <div className="ge-execution-summary"><div><span>Symbol</span><strong>{f.symbol}</strong></div><div><span>Side</span><strong>{f.dir}</strong></div><div><span>Planned risk</span><strong>{riskDollar != null ? `$${riskDollar}` : "—"}</strong></div></div>
          <div className="ge-grid-2">
            {renderField("Actual entry", <input type="number" value={f.entry} onChange={(e) => setF((p) => ({ ...p, entry: e.target.value }))} style={fieldStyle(s)} />)}
            {renderField("Quantity", <input type="number" min="1" value={f.qty} onChange={(e) => setF((p) => ({ ...p, qty: e.target.value }))} style={fieldStyle(s)} />)}
          </div>
          <div className="ge-reflection"><span>Quick check</span><strong>Did this entry match the plan?</strong><small>Use the management step later for timestamped notes.</small></div>
          <div className="ge-field-label">Mood at entry</div>
          <div className="ge-moods">{MOODS.map((mood, i) => <button type="button" key={i} className={f.mood === i + 1 ? "is-selected" : ""} onClick={() => setF((p) => ({ ...p, mood: i + 1 }))}>{mood}</button>)}</div>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div className="ge-plan-card ge-step-content">
          <div className="ge-intro"><div><span className="ge-eyebrow">05 · MANAGEMENT</span><h2>Capture what happened while in the trade.</h2><p>Short timestamped notes are enough. No essay required.</p></div></div>
          <div className="ge-quote"><span>Mindset check</span><p>“{MINDSET_QUOTES[quoteIdx]}”</p><button type="button" onClick={nextQuote}>Another prompt ↻</button></div>
          <NotesLog entries={f.notes_log} onChange={(log) => setF((p) => ({ ...p, notes_log: log }))} s={s} />
        </div>
      );
    }

    if (step === 5) {
      const exitNum = parseFloat(f.exit);
      const hasExit = !isNaN(entryNum) && !isNaN(exitNum);
      const pts = hasExit ? (f.dir === "Long" ? exitNum - entryNum : entryNum - exitNum) : null;
      const pnl = hasExit ? Math.round(pts * qtyNum * mult) : null;
      return (
        <div className="ge-plan-card ge-step-content">
          <div className="ge-intro"><div><span className="ge-eyebrow">06 · EXIT & OUTCOME</span><h2>Close the trade.</h2><p>Record the exit, then capture how you felt after execution.</p></div></div>
          <div className="ge-grid-2">
            {renderField("Exit price", <input type="number" value={f.exit} onChange={(e) => setF((p) => ({ ...p, exit: e.target.value }))} placeholder="Exit price" style={fieldStyle(s)} />)}
            {renderField("Exit time", <input type="time" value={f.exit_time} onChange={(e) => setF((p) => ({ ...p, exit_time: e.target.value }))} style={fieldStyle(s)} />)}
            {renderField("Session", <select value={f.session} onChange={(e) => setF((p) => ({ ...p, session: e.target.value }))} style={fieldStyle(s)}>{SESSIONS.map((session) => <option key={session}>{session}</option>)}</select>)}
            {renderField("P&L", <div className="ge-pnl-readout" style={{ color: pnl == null ? V.muted : pnl >= 0 ? GRN : RED }}>{pnl == null ? "—" : fp(pnl)}</div>)}
          </div>
          <div className="ge-field-label">Mood at close</div>
          <div className="ge-moods">{MOODS.map((mood, i) => <button type="button" key={i} className={f.mood === i + 1 ? "is-selected" : ""} onClick={() => setF((p) => ({ ...p, mood: i + 1 }))}>{mood}</button>)}</div>
          <div className="ge-field-label">Mistakes <small>optional</small></div>
          <div className="ge-mistakes">{MISTAKES.map((mistake) => { const selected = f.mistakes?.includes(mistake.key); return <button type="button" key={mistake.key} className={selected ? "is-selected" : ""} onClick={() => setF((p) => ({ ...p, mistakes: selected ? p.mistakes.filter((key) => key !== mistake.key) : [...(p.mistakes || []), mistake.key] }))}><span>{selected ? "✓" : ""}</span>{mistake.label}</button>; })}</div>
        </div>
      );
    }

    const exitNum = parseFloat(f.exit);
    const hasExit = !isNaN(entryNum) && !isNaN(exitNum);
    const pts = hasExit ? (f.dir === "Long" ? exitNum - entryNum : entryNum - exitNum) : null;
    const pnl = hasExit ? Math.round(pts * qtyNum * mult) : null;
    const selectedMistakes = MISTAKES.filter((mistake) => f.mistakes?.includes(mistake.key));
    return (
      <div className="ge-plan-card ge-step-content">
        <div className="ge-intro"><div><span className="ge-eyebrow">07 · FINAL REVIEW</span><h2>Everything looks good?</h2><p>Review the essentials. Save only when the record is complete.</p></div><div className="ge-final-pnl" style={{ color: pnl == null ? V.muted : pnl >= 0 ? GRN : RED }}>{pnl == null ? "—" : fp(pnl)}</div></div>
        <div className="ge-review-grid">
          <div><span>Symbol</span><strong>{f.symbol} · {f.dir}</strong></div><div><span>Setup grade</span><strong style={{ color: setupRating.color }}>{setupRating.grade} · {setupRating.score}/{checklist.length}</strong></div>
          <div><span>Entry → Exit</span><strong>{f.entry || "—"} → {f.exit || "—"}</strong></div><div><span>SL / TP</span><strong>{f.sl || "—"} / {f.tp || "—"}</strong></div>
          <div><span>Risk</span><strong>{riskDollar != null ? `$${riskDollar}` : "—"}</strong></div><div><span>R multiple</span><strong>{slPts > 0 && hasExit ? `${(pts / slPts).toFixed(2)}R` : "—"}</strong></div>
        </div>
        <div className="ge-review-line"><span>Checklist</span><strong>{checkedCount} of {checklist.length} confirmed</strong></div>
        <div className="ge-review-line"><span>Mistakes</span><strong style={{ color: selectedMistakes.length ? RED : GRN }}>{selectedMistakes.length ? selectedMistakes.map((m) => m.label).join(", ") : "None flagged"}</strong></div>
        <div className="ge-review-notes"><span>Management notes</span><p>{(f.notes_log || []).filter((entry) => entry.text?.trim()).map((entry) => `${entry.time} — ${entry.text}`).join(" · ") || "No notes added."}</p></div>
        {f.chart_url && <div className="ge-review-line"><span>Chart</span><a href={f.chart_url} target="_blank" rel="noreferrer">Open TradingView ↗</a></div>}
        <div className="ge-review-media">
          <ScreenshotUpload label="Before entry" value={f.screenshot_before} onChange={(value) => setF((p) => ({ ...p, screenshot_before: value }))} s={s}/>
          <ScreenshotUpload label="After exit" value={f.screenshot_after} onChange={(value) => setF((p) => ({ ...p, screenshot_after: value }))} s={s}/>
        </div>
        <button type="button" className="ge-pdf" onClick={downloadReviewPdf} disabled={pdfBusy}>{pdfBusy ? "Preparing PDF…" : "Download review PDF"}</button>
      </div>
    );
  };

  return (
    <div className="ge-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`ge-modal ge-step-${step}`} role="dialog" aria-modal="true" aria-label="Guided trade entry" onPointerMove={(event) => { const r = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--mx", `${event.clientX - r.left}px`); event.currentTarget.style.setProperty("--my", `${event.clientY - r.top}px`); }}>
        <header className="ge-header">
          <div className="ge-header-top">
            <div><h1>Log Trade</h1><p>Guided entry to log your trade in a few simple steps.</p></div>
            <button type="button" className="ge-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="ge-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((item, index) => (
              <button type="button" key={item.id} className={`${index < step ? "is-done" : ""} ${index === step ? "is-active" : ""}`} onClick={() => index < step && setStep(index)}>
                <span className="ge-progress-node">{index + 1}</span>
                <b>{item.short}</b>
              </button>
            ))}
          </div>
        </header>

        <main className="ge-body">{renderStep()}</main>

        <footer className="ge-footer">
          <div className="ge-footer-status">
            {step === 0 ? (
              <div className="ge-footer-meta"><span>TODAY’S PLAN</span><strong>{todayPlanMode === "with-plan" && todayPlanHasSavedPlan ? "Linked" : todayPlanMode === "without-plan" ? "No plan" : "Choose mode"}</strong></div>
            ) : step === 1 ? (
              <div className="ge-footer-meta"><span>SETUP QUALITY</span><strong style={{color: setupRating.color}}>{setupRating.grade}</strong></div>
            ) : step === 2 ? (
              <div className="ge-footer-meta"><span>PLANNED RISK</span><strong>{riskDollar != null ? `$${riskDollar}` : "Not set"}</strong></div>
            ) : step === 5 ? (
              <div className="ge-footer-meta"><span>TRADE STATUS</span><strong className={exitReady ? "is-positive" : ""}>{exitReady ? "Exit recorded" : "Exit required"}</strong></div>
            ) : (
              <div className="ge-footer-meta"><span>STEP {step + 1} OF {STEPS.length}</span><strong>{STEPS[step].hint}</strong></div>
            )}
          </div>
          <div className="ge-footer-actions">
            <button type="button" className="ge-back" onClick={() => step === 0 ? onClose() : setStep((value) => value - 1)}>{step === 0 ? "Cancel" : "Back"}</button>
            {step < STEPS.length - 1 ? <button type="button" className="ge-next" onClick={() => { if (!stepValid) return; if (step === 0 && todayPlanMode === "with-plan") applyTodayPlanChecklist(); setStep((value) => value + 1); }} disabled={!stepValid}>Next <span>→</span></button> : <button type="button" className="ge-next" onClick={finalizeSave} disabled={!entryReady || !exitReady || saving}>{saving ? "Saving…" : "Save trade"} <span>{saving ? "" : "✓"}</span></button>}
          </div>
        </footer>
      </section>
    </div>
  );
}

export default GuidedEntryModal;

import { SETUP_CHECKS_DEFAULT } from "../../setupChecklist.js";
import NotesLog from "../shared/NotesLog";
import ScreenshotUpload from "../shared/ScreenshotUpload";
import TradeNewsContext from "../news/TradeNewsContext";
import { useEffect, useMemo, useState } from "react";
import { calculateTradeNumbers, validateTrade } from "./tradeUtils.js";
import { V, GRN, RED, BLU, AMBER, SYMBOLS, SESSIONS, MOODS, MISTAKES, BLANK, blankChecklist, toLocalISODate, toLocalTimeHHMM, getSetupRating } from "../../constants.js";
import { usePropFirmCompliance } from "../../hooks/usePropFirmCompliance.js";
function TradeModal({trade,onSave,onClose,s,checklist=SETUP_CHECKS_DEFAULT,trades=[],settings={}}) {
  const row={display:"flex",flexDirection:"column",gap:3};
  const [saving, setSaving] = useState(false);
  const [f,setF]=useState(()=>trade?{
    ...BLANK,...trade,
    /* fresh key per open; never reuse the stored key from an existing row */ clientOperationId: ((typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    notes_log:trade.notes_log||[{id:1,time:"14:00",text:trade.notes||""}],
    setup_checklist:trade.setup_checklist||blankChecklist(checklist),
    mistakes:trade.mistakes||[],
  }:{
    ...BLANK,
    date: toLocalISODate(),
    time: toLocalTimeHHMM(),
    setup_checklist: blankChecklist(checklist),
    notes_log:[{id:1,time:new Date().toTimeString().slice(0,5),text:""}]
  });

  const set=(k,v)=>setF(prev=>{
    const n={...prev,[k]:v};
    const calculated=calculateTradeNumbers(n);

    if (["entry","exit","qty","dir","symbol","sl"].includes(k)) {
      if (calculated.pnl != null) n.pnl=calculated.pnl;
      if (calculated.risk != null) n.risk=calculated.risk;
      if (calculated.rr != null) n.rr=calculated.rr;
    }

    if (["entry","sl","dir","symbol"].includes(k) && !n.tp) {
      const e=Number(n.entry);
      const sl=Number(n.sl);
      if (Number.isFinite(e)&&Number.isFinite(sl)) {
        const stopPoints=n.dir==="Long"?e-sl:sl-e;
        if (stopPoints>0) {
          n.tp=Math.round((n.dir==="Long"?e+stopPoints*3:e-stopPoints*3)*100)/100;
        }
      }
    }
    return n;
  });

  const validation = useMemo(() => validateTrade(f), [f]);
  const compliance = usePropFirmCompliance(trades, settings, f);
  const complianceBlocked = Boolean(settings?.propFirmId && settings?.propProgramId && compliance.hardViolations.length);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter" && validation.valid && !complianceBlocked && !saving) {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, validation.valid, complianceBlocked, saving]);

  const save=async()=>{
  if (!validation.valid || complianceBlocked || saving) return;
  setSaving(true);

  const setupRating = getSetupRating(f.setup_checklist);

  try {
    await onSave({
    ...f,
    ...(f.id ? { id: f.id } : {}),
    entry:parseFloat(f.entry),
    exit:parseFloat(f.exit),
    qty:parseInt(f.qty)||1,
    pnl:parseFloat(f.pnl)||0,
    rr:parseFloat(f.rr)||0,
    sl:parseFloat(f.sl)||0,
    tp:parseFloat(f.tp)||0,
    risk:parseFloat(f.risk)||0,

    setup:Object.entries(f.setup_checklist)
      .filter(([,v])=>typeof v === "boolean" && v)
      .map(([k])=>checklist.find(s=>s.key===k)?.label)
      .join(", ")||"—",

    setup_score:setupRating.score,
    grade:setupRating.grade,
    mistakes:Array.isArray(f.mistakes)?f.mistakes:[],

    notes:(f.notes_log||[])
      .map(e=>e.text)
      .filter(Boolean)
      .join(" | "),
    clientOperationId: f.clientOperationId,
  });
  } finally {
    setSaving(false);
  }
};

  const setupRating=getSetupRating(f.setup_checklist);
  const newsChecked = Boolean(f.setup_checklist?.news_checked);

  return (
    <div className="td-trade-drawer-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="td-trade-drawer" role="dialog" aria-modal="true" aria-label={trade ? "Edit trade" : "Log new trade"}>
        <div className="td-trade-drawer-head">
          <div>
            <p className="td-trade-drawer-kicker">TRADE JOURNAL</p>
            <p className="td-trade-drawer-title">{trade ? "Edit Trade" : "Log New Trade"}</p>
            <p className="td-trade-drawer-subtitle">Capture the trade without leaving your workspace.</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7}}><button type="button" className="td-trade-drawer-close" onClick={onClose} aria-label="Close trade entry">×</button></div>
        </div>

        <div className="td-trade-drawer-body">

        {!validation.valid && (
          <div className="td-trade-validation" role="alert">
            <span className="td-trade-validation-dot">!</span>
            <span>Please correct: {Object.values(validation.errors).join(" ")}</span>
          </div>
        )}

        {compliance.hasRules && (
          <div className={`td-compliance ${complianceBlocked ? "is-blocked" : ""}`}>
            <div className="td-compliance-head">
              <div>
                <p className="td-compliance-title">{complianceBlocked ? "Trade blocked by active rule" : "Pre-trade compliance"}</p>
                <p className="td-compliance-subtitle">{compliance.firm} · {compliance.program}</p>
              </div>
              <span className="td-compliance-risk">Risk {compliance.positionRisk > 0 ? `$${compliance.positionRisk.toFixed(2)}` : "—"}</span>
            </div>
            <div className="td-compliance-stats">
              <div className="td-compliance-stat">
                <span>Daily loss after</span>
                <strong>{compliance.projectedDailyRemaining != null ? `$${compliance.projectedDailyRemaining.toFixed(0)} left` : "—"}</strong>
              </div>
              <div className="td-compliance-stat">
                <span>Drawdown after</span>
                <strong>{compliance.projectedDrawdownRemaining != null ? `$${compliance.projectedDrawdownRemaining.toFixed(0)} left` : "—"}</strong>
              </div>
              <div className="td-compliance-stat">
                <span>Position limit</span>
                <strong>{compliance.rules.maxContracts ?? compliance.rules.maxMicros ?? "—"}</strong>
              </div>
            </div>
            {(compliance.hardViolations.length > 0 || compliance.warnings.length > 0) && (
              <div className="td-compliance-alerts">
                {[...compliance.hardViolations.map(x => ({ ...x, severity: "BLOCK" })), ...compliance.warnings.map(x => ({ ...x, severity: "WARN" }))].map((x, i) => (
                  <div key={`${x.key}-${i}`} className={x.severity === "BLOCK" ? "is-block" : "is-warn"}>
                    {x.severity}: {x.detail}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <TradeNewsContext
          trade={f}
          checked={newsChecked}
          onMarkChecked={() => setF(prev => ({ ...prev, setup_checklist: { ...(prev.setup_checklist || {}), news_checked: !newsChecked } }))}
          s={s}
        />

        <div className="td-trade-drawer-section td-entry-section">
          <p className="td-trade-section-title">Trade info</p>
          <div className="td-trade-fields td-fields-2">
            <div className="td-trade-field"><label style={s.ilbl}>Date</label><input className="td-compact-input" type="date" value={f.date} onChange={e => set("date", e.target.value)} style={s.inp}/></div>
            <div className="td-trade-field"><label style={s.ilbl}>Time (IST)</label><input className="td-compact-input" type="time" value={f.time} onChange={e => set("time", e.target.value)} style={s.inp}/></div>
            <div className="td-trade-field"><label style={s.ilbl}>Symbol</label><select className="td-compact-input" value={f.symbol} onChange={e => set("symbol", e.target.value)} style={s.inp}>{SYMBOLS.map(sym => <option key={sym}>{sym}</option>)}</select></div>
            <div className="td-trade-field"><label style={s.ilbl}>Session</label><select className="td-compact-input" value={f.session} onChange={e => set("session", e.target.value)} style={s.inp}>{SESSIONS.map(ss => <option key={ss}>{ss}</option>)}</select></div>
          </div>
          <div className="td-trade-field td-direction-field">
            <label style={s.ilbl}>Direction</label>
            <div className="td-direction-toggle">
              {["Long", "Short"].map(d => (
                <button key={d} type="button" onClick={() => set("dir", d)} className={`td-direction-btn ${f.dir === d ? `is-${d.toLowerCase()}` : ""}`}>
                  {d === "Long" ? "▲ Long" : "▼ Short"}
                </button>
              ))}
            </div>
          </div>
          <div className="td-trade-field">
            <label style={s.ilbl}>Mood</label>
            <div className="td-mood-row">
              {MOODS.map((m, i) => <button type="button" key={i} onClick={() => set("mood", i + 1)} className={`td-mood-btn ${f.mood === i + 1 ? "is-selected" : ""}`}>{m}</button>)}
            </div>
          </div>
        </div>

        <div className="td-trade-drawer-section td-entry-section">
          <p className="td-trade-section-title">Prices &amp; risk</p>
          <div className="td-trade-fields td-fields-2">
            <div className="td-trade-field"><label style={s.ilbl}>Entry price</label><input className="td-compact-input" type="number" autoComplete="off" value={f.entry} onChange={e => set("entry", e.target.value)} placeholder="e.g. 20250" style={s.inp}/></div>
            <div className="td-trade-field"><label style={s.ilbl}>Quantity</label><input className="td-compact-input" type="number" autoComplete="off" value={f.qty} onChange={e => set("qty", e.target.value)} min={1} style={s.inp}/></div>
            <div className="td-trade-field"><label style={s.ilbl}>Stop loss</label><input className="td-compact-input" type="number" autoComplete="off" value={f.sl} onChange={e => set("sl", e.target.value)} placeholder="SL price" style={{...s.inp,borderColor:f.sl?RED:V.border}}/></div>
            <div className="td-trade-field"><label style={s.ilbl}>Take profit</label><input className="td-compact-input" type="number" autoComplete="off" value={f.tp} onChange={e => set("tp", e.target.value)} placeholder="Auto 1:3" style={{...s.inp,borderColor:f.tp?GRN:V.border}}/></div>
            <div className="td-trade-field"><label style={s.ilbl}>Exit price</label><input className="td-compact-input" type="number" autoComplete="off" value={f.exit} onChange={e => set("exit", e.target.value)} placeholder="After close" style={s.inp}/></div>
            <div className="td-trade-field"><label style={s.ilbl}>Exit time</label><input className="td-compact-input" type="time" value={f.exit_time} onChange={e => set("exit_time", e.target.value)} style={s.inp}/></div>
          </div>
          <div className="td-trade-field td-pnl-field">
            <label style={s.ilbl}>P&amp;L <span>(auto)</span></label>
            <input className="td-compact-input" type="number" autoComplete="off" value={f.pnl} onChange={e => set("pnl", e.target.value)} style={{...s.inp,fontWeight:700,color:f.pnl>0?GRN:f.pnl<0?RED:V.muted}}/>
          </div>
          <div className={`td-risk-line ${f.risk > 250 ? "is-danger" : f.risk > 0 ? "is-safe" : ""}`}>
            <div><span>Planned risk</span><strong>{f.risk > 0 ? `$${f.risk}` : "—"}</strong></div>
            {f.sl && f.entry && <small>SL {f.sl} · TP {f.tp || "—"} · {f.risk > 250 ? "Over $250 limit" : "Within limit"}</small>}
          </div>
        </div>

        <div className="td-trade-drawer-section td-entry-section">
          <p className="td-trade-section-title">Checklist &amp; notes</p>
          <div className="td-trade-field">
            <label style={s.ilbl}>Setup checklist</label>
            <div className="td-checklist-list">
              {checklist.map((item, idx) => {
                const selected = Boolean(f.setup_checklist[item.key]);
                return (
                  <button key={item.key} type="button" className={`td-checklist-row ${selected ? "is-selected" : ""}`} onClick={() => setF(prev => ({ ...prev, setup_checklist: { ...prev.setup_checklist, [item.key]: !prev.setup_checklist[item.key] } }))}>
                    <span className="td-checkmark">{selected ? "✓" : ""}</span>
                    <span>{idx + 1}. {item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="td-setup-score">
              <span>{Object.values(f.setup_checklist).filter((value) => typeof value === "boolean" && value).length}/{checklist.length} checks</span>
              <strong style={{color:setupRating.color}}>{setupRating.grade} · {setupRating.label}</strong>
            </div>
          </div>
          <div className="td-trade-field">
            <label style={s.ilbl}>TradingView chart</label>
            <div className="td-inline-input">
              <input className="td-compact-input" value={f.chart_url} onChange={e => setF(prev => ({...prev,chart_url:e.target.value}))} placeholder="Paste chart URL" style={{...s.inp,flex:1}}/>
              {f.chart_url && <button type="button" onClick={() => window.open(f.chart_url, "_blank")} className="td-inline-action">Open ↗</button>}
            </div>
          </div>
          <div className="td-trade-field">
            <label style={s.ilbl}>Notes &amp; emotions</label>
            <NotesLog entries={f.notes_log} onChange={log => setF(prev => ({...prev,notes_log:log}))} s={s}/>
          </div>
        </div>

        <div className="td-trade-drawer-section td-entry-section td-mistakes-section">
          <p className="td-trade-section-title">Mistakes <span>optional</span></p>
          <div className="td-mistakes-list">
            {MISTAKES.map(m => {
              const selected = f.mistakes?.includes(m.key);
              return (
                <button key={m.key} type="button" className={`td-mistake-row ${selected ? "is-selected" : ""}`} onClick={() => setF(prev => ({...prev,mistakes:selected?prev.mistakes.filter(k => k !== m.key):[...(prev.mistakes || []),m.key]}))}>
                  <span className="td-mistake-mark">{selected ? "×" : ""}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
          {f.mistakes?.length > 0 && <div className="td-mistake-flag">{f.mistakes.length} mistake{f.mistakes.length !== 1 ? "s" : ""} flagged</div>}
          {f.mistakes?.length > 0 && (
            <div className="td-mistake-outcome">
              <p>Outcome</p>
              <div className="td-trade-fields td-fields-2">
                <div className="td-trade-field">
                  <label style={s.ilbl}>P&amp;L impact</label>
                  <select className="td-compact-input" value={f.mistake_outcome} onChange={e => setF(prev => ({...prev,mistake_outcome:e.target.value}))} style={s.inp}>
                    <option value="">Select outcome…</option><option value="loss">Caused a loss</option><option value="reduced_profit">Reduced profit</option><option value="no_impact">No impact</option><option value="still_profit">Still profitable</option>
                  </select>
                </div>
                <div className="td-trade-field">
                  <label style={s.ilbl}>Estimated impact</label>
                  <input className="td-compact-input" type="number" value={f.mistake_pnl} onChange={e => setF(prev => ({...prev,mistake_pnl:parseFloat(e.target.value)||0}))} placeholder="e.g. -50" style={{...s.inp,borderColor:f.mistake_pnl<0?RED:V.border}}/>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Screenshots */}
        <div className="td-trade-drawer-screenshots">
          <ScreenshotUpload label="📸 Before Entry" value={f.screenshot_before} onChange={v=>setF(prev=>({...prev,screenshot_before:v}))} s={s}/>
          <ScreenshotUpload label="📸 After Exit"   value={f.screenshot_after}  onChange={v=>setF(prev=>({...prev,screenshot_after:v}))}  s={s}/>
        </div>
        </div>

        <div className="td-trade-drawer-footer">
          <button type="button" onClick={onClose} className="td-trade-drawer-cancel">Cancel</button>
          <button className="save-btn td-trade-drawer-save" onClick={save} disabled={!validation.valid || complianceBlocked || saving} style={{opacity:(validation.valid && !complianceBlocked && !saving)?1:0.55}}>{saving ? "Saving…" : "Save Trade"} <span>{saving ? "" : "✓"}</span></button>
        </div>
      </aside>
    </div>
  );
}

// ── Guided Entry (step-by-step, discipline-gated) ───────────────
const symbolMultiplier = sym =>
  sym==="MNQ"?2:10; // only MNQ/MGC are offered in SYMBOLS - MGC is the only other option

export default TradeModal;

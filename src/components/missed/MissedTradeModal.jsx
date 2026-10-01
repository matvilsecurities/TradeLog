import ScreenshotUpload from "../shared/ScreenshotUpload";
import { useState } from "react";
import { V, GRN, RED, AMBER, SYMBOLS, fp, toLocalISODate, toLocalTimeHHMM } from "../../constants.js";
function MissedTradeModal({trade,onSave,onClose,s}) {
const [f,setF]=useState(()=>trade?{...MISSED_BLANK,...trade, clientOperationId: ((typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)}:{
  ...MISSED_BLANK,
  clientOperationId: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  date: toLocalISODate(),
  time: toLocalTimeHHMM(),
});
  const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
  const row={display:"flex",flexDirection:"column",gap:3};
  const mult=f.symbol==="MNQ"?2:f.symbol==="MGC"?10:20;
  const e=parseFloat(f.entry),x=parseFloat(f.exit);
  const potentialPnl=(!isNaN(e)&&!isNaN(x))?Math.round((f.dir==="Long"?x-e:e-x)*mult):null;
    const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.date || !f.entry) return;
    setSaving(true);
    try {
      await onSave({
        ...f,
        // Do NOT pass id for new records — let Supabase generate it.
        // Only pass id when editing an existing Supabase record.
        ...(f.id && typeof f.id === "number" ? { id: f.id } : {}),
        entry:        parseFloat(f.entry) || 0,
        exit:         parseFloat(f.exit)  || 0,
        sl:           parseFloat(f.sl)    || 0,
        tp:           parseFloat(f.tp)    || 0,
        potential_pnl: potentialPnl       || 0,
        reason_missed: f.reason || null,
        clientOperationId: f.clientOperationId,
      });
      onClose();
    } catch (err) {
      // Error already surfaced by parent saveMissedTrade
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{background:V.bg,borderRadius:V.radiusLg,border:`1px solid ${AMBER}40`,
        width:"min(760px,95vw)",maxHeight:"92vh",overflowY:"auto",
        boxShadow:"0 24px 64px rgba(0,0,0,0.5)"}}>
        {/* Header */}
        <div style={{padding:"1.25rem 1.5rem",borderBottom:`0.5px solid ${V.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{width:32,height:32,borderRadius:8,background:`${AMBER}20`,display:"flex",alignItems:"center",justifyContent:"center",color:AMBER,fontSize:16}}>
              <i className="ti ti-eye-off"/>
            </span>
            <div>
              <p style={{margin:0,fontWeight:700,fontSize:16,color:V.text}}>{trade?"Edit Missed Trade":"Log Missed Trade"}</p>
              <p style={{margin:0,fontSize:11,color:V.muted}}>Record a NY session setup you missed</p>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:`0.5px solid ${V.border}`,cursor:"pointer",color:V.muted,padding:"6px 12px",borderRadius:V.radius,fontSize:12}}>✕ Close</button>
        </div>
        {/* Body */}
        <div style={{padding:"1.5rem",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem"}}>
          {/* Left */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <p style={{margin:0,fontSize:11,fontWeight:600,color:V.muted,textTransform:"uppercase",letterSpacing:"0.08em",paddingBottom:6,borderBottom:`0.5px solid ${V.border}`}}>Trade Details</p>
            <div style={row}><label style={s.ilbl}>Date</label>
              <input type="date" value={f.date} onChange={e=>set("date",e.target.value)} style={s.inp}/></div>
            <div style={row}><label style={s.ilbl}>Time (IST)</label>
              <input type="time" value={f.time} onChange={e=>set("time",e.target.value)} style={s.inp}/></div>
            <div style={row}><label style={s.ilbl}>Symbol</label>
              <select value={f.symbol} onChange={e=>set("symbol",e.target.value)} style={s.inp}>
                {SYMBOLS.map(sym=><option key={sym}>{sym}</option>)}
              </select></div>
            <div style={row}><label style={s.ilbl}>Direction</label>
              <div style={{display:"flex",gap:8}}>
                {["Long","Short"].map(d=>(
                  <button key={d} onClick={()=>set("dir",d)}
                    style={{flex:1,padding:"8px",fontSize:13,cursor:"pointer",borderRadius:6,fontWeight:600,
                      background:f.dir===d?(d==="Long"?GRN:RED):"transparent",
                      color:f.dir===d?"#fff":V.muted,border:`1px solid ${f.dir===d?(d==="Long"?GRN:RED):V.border}`}}>
                    {d==="Long"?"▲ Long":"▼ Short"}
                  </button>
                ))}
              </div></div>
            <div style={row}><label style={s.ilbl}>Entry Price</label>
              <input type="number" autoComplete="off" value={f.entry} onChange={e=>set("entry",e.target.value)} placeholder="Where you would have entered" style={s.inp}/></div>
            <div style={row}><label style={s.ilbl}>Exit / TP Price</label>
              <input type="number" autoComplete="off" value={f.exit} onChange={e=>set("exit",e.target.value)} placeholder="Where price went" style={s.inp}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={row}><label style={s.ilbl}>SL</label>
                <input type="number" autoComplete="off" value={f.sl} onChange={e=>set("sl",e.target.value)} style={{...s.inp,borderColor:f.sl?RED:V.border}}/></div>
              <div style={row}><label style={s.ilbl}>TP</label>
                <input type="number" autoComplete="off" value={f.tp} onChange={e=>set("tp",e.target.value)} style={{...s.inp,borderColor:f.tp?GRN:V.border}}/></div>
            </div>
            {/* Potential P&L */}
            <div style={{padding:"12px",borderRadius:V.radius,
              background:potentialPnl!=null?(potentialPnl>=0?"rgba(0,217,160,0.08)":"rgba(255,64,96,0.08)"):V.surface,
              border:`1px solid ${potentialPnl!=null?(potentialPnl>=0?GRN:RED):V.border}`}}>
              <p style={{margin:"0 0 4px",fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Potential P&L if taken</p>
              <p style={{margin:0,fontSize:22,fontWeight:800,color:potentialPnl!=null?(potentialPnl>=0?GRN:RED):V.muted}}>
                {potentialPnl!=null?fp(potentialPnl):"Enter entry & exit"}
              </p>
            </div>
          </div>
          {/* Right */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <p style={{margin:0,fontSize:11,fontWeight:600,color:V.muted,textTransform:"uppercase",letterSpacing:"0.08em",paddingBottom:6,borderBottom:`0.5px solid ${V.border}`}}>Why Missed</p>
            <div style={row}><label style={s.ilbl}>Reason Missed</label>
              <select value={f.reason} onChange={e=>set("reason",e.target.value)} style={s.inp}>
                <option value="">Select reason…</option>
                <option>Not at desk</option>
                <option>Hesitation / fear</option>
                <option>Setup not clear at the time</option>
                <option>Already in a trade</option>
                <option>News event</option>
                <option>Risk limit reached</option>
                <option>Overslept / late</option>
                <option>Other</option>
              </select></div>
            <div style={{flex:1}}>
              <label style={{...s.ilbl,marginBottom:4}}>Notes</label>
              <textarea value={f.notes} onChange={e=>set("notes",e.target.value)}
                placeholder="Describe the setup and why you missed it..."
                rows={5} style={{...s.inp,resize:"none",lineHeight:1.6}}/></div>
            <ScreenshotUpload label="📸 Setup Screenshot" value={f.screenshot_before} onChange={v=>set("screenshot_before",v)} s={s}/>
            <ScreenshotUpload label="📸 Result Screenshot" value={f.screenshot_after}  onChange={v=>set("screenshot_after",v)}  s={s}/>
          </div>
        </div>
        {/* Footer */}
        <div style={{padding:"1.25rem 1.5rem",borderTop:`0.5px solid ${V.border}`,display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"10px 20px",fontSize:13,background:"none",border:`0.5px solid ${V.border}`,borderRadius:V.radius,cursor:"pointer",color:V.text}}>Cancel</button>
          <button onClick={save} disabled={saving} style={{padding:"10px 24px",fontSize:13,fontWeight:600,
            background:`linear-gradient(135deg,${AMBER},#f97316)`,color:"#fff",border:"none",borderRadius:V.radius,
              cursor:saving?"not-allowed":"pointer",opacity:saving?0.7:1}}>
              {saving ? "Saving…" : "Save Missed Trade ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}



export default MissedTradeModal;

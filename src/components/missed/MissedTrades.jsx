import Badge from "../shared/Badge";
import MissedTradeModal from "./MissedTradeModal";
import { useState } from "react";
import { V, GRN, RED, AMBER, fp, fd } from "../../constants.js";
function MissedTrades({missedTrades,onSave,onDelete,s}) {
  const [showModal,setShowModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const totalPotential=missedTrades.reduce((sum,t)=>sum+(t.potential_pnl||0),0);
  const wouldBeWins=missedTrades.filter(t=>(t.potential_pnl||0)>30).length;
  const wouldBeLosses=missedTrades.filter(t=>(t.potential_pnl||0)<-30).length;
  const openAdd=()=>{setEditing(null);setShowModal(true);};
  const openEdit=(t)=>{setEditing(t);setShowModal(true);};
  const handleSave = async (t) => {
  try {
    await onSave(t, editing);
    setShowModal(false);
    setEditing(null);
  } catch (err) {
    // Error already shown by parent
  }
};
  return (
    <div style={{height:"100vh",overflowY:"auto",background:V.bg}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,rgba(245,158,11,0.06),${V.bg})`,
        borderBottom:`0.5px solid ${V.border}`,padding:"1.75rem 2rem"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{width:40,height:40,borderRadius:12,background:`${AMBER}20`,display:"flex",alignItems:"center",justifyContent:"center",color:AMBER,fontSize:20}}>
              <i className="ti ti-eye-off"/>
            </span>
            <div>
              <p style={{margin:0,fontSize:20,fontWeight:700,color:V.text}}>Missed Trades</p>
              <p style={{margin:"3px 0 0",fontSize:12,color:V.muted}}>NY Session setups you spotted but didn't take</p>
            </div>
          </div>
          <button onClick={openAdd}
            style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",fontSize:13,fontWeight:600,
              background:`linear-gradient(135deg,${AMBER},#f97316)`,color:"#fff",border:"none",
              borderRadius:V.radiusLg,cursor:"pointer",boxShadow:`0 4px 14px rgba(245,158,11,0.3)`}}>
            <i className="ti ti-plus"/> Log Missed Trade
          </button>
        </div>
        {/* Summary */}
        {missedTrades.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[{label:"Total Missed",value:missedTrades.length,color:AMBER,icon:"ti-eye-off"},
              {label:"Potential P&L",value:fp(totalPotential),color:totalPotential>=0?GRN:RED,icon:"ti-currency-dollar"},
              {label:"Would-be Wins",value:wouldBeWins,color:GRN,icon:"ti-circle-check"},
              {label:"Would-be Losses",value:wouldBeLosses,color:RED,icon:"ti-circle-x"},
            ].map((c,i)=>(
              <div key={i} style={{background:V.surface,borderRadius:V.radiusLg,padding:"12px 16px",
                border:`0.5px solid ${V.border}`,display:"flex",alignItems:"center",gap:12}}>
                <span style={{width:34,height:34,borderRadius:8,background:`${c.color}18`,
                  display:"flex",alignItems:"center",justifyContent:"center",color:c.color,fontSize:15,flexShrink:0}}>
                  <i className={`ti ${c.icon}`}/>
                </span>
                <div>
                  <p style={{margin:0,fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{c.label}</p>
                  <p style={{margin:"2px 0 0",fontSize:17,fontWeight:700,color:c.color}}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{padding:"2rem"}}>
        {missedTrades.length===0?(
          <div style={{textAlign:"center",padding:"5rem 2rem",
            border:`1px dashed ${AMBER}40`,borderRadius:V.radiusLg,background:`rgba(245,158,11,0.02)`}}>
            <i className="ti ti-eye-off" style={{fontSize:52,color:AMBER,opacity:0.3,display:"block",marginBottom:16}}/>
            <p style={{margin:0,fontSize:18,fontWeight:600,color:V.text}}>No missed trades logged yet</p>
            <p style={{margin:"8px 0 20px",fontSize:13,color:V.muted}}>Track NY session setups you see but don't take</p>
            <button onClick={openAdd}
              style={{padding:"10px 24px",fontSize:13,fontWeight:600,
                background:`linear-gradient(135deg,${AMBER},#f97316)`,color:"#fff",border:"none",borderRadius:V.radius,cursor:"pointer"}}>
              + Log Your First Missed Trade
            </button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
            {[...missedTrades].sort((a,b)=>b.date.localeCompare(a.date)).map((t,i)=>(
              <div key={t.id} style={{borderRadius:V.radiusLg,overflow:"hidden",
                border:`0.5px solid ${(t.potential_pnl||0)>=0?"rgba(0,217,160,0.2)":"rgba(255,64,96,0.2)"}`}}>
                {/* Top */}
                <div style={{padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",
                  background:(t.potential_pnl||0)>=0?"rgba(0,217,160,0.05)":"rgba(255,64,96,0.05)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:(t.potential_pnl||0)>=0?GRN:RED,flexShrink:0}}/>
                    <span style={{fontWeight:700,fontSize:14,color:V.text}}>{t.symbol}</span>
                    <Badge dir={t.dir}/>
                    <span style={{fontSize:12,color:V.muted}}>{fd(t.date)}{t.time?` @ ${t.time}`:""}</span>
                    {t.reason&&(
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,
                        background:`${AMBER}18`,color:AMBER,border:`0.5px solid ${AMBER}40`}}>{1}</span>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:16}}>
                    <div style={{textAlign:"right"}}>
                      <p style={{margin:0,fontSize:10,color:V.muted}}>Potential P&L</p>
                      <p style={{margin:0,fontSize:18,fontWeight:800,color:(t.potential_pnl||0)>=0?GRN:RED}}>{fp(t.potential_pnl||0)}</p>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>openEdit(t)}
                        style={{background:"none",border:`0.5px solid ${V.border}`,borderRadius:6,cursor:"pointer",color:V.muted,padding:"5px 8px",fontSize:13}}
                        onMouseEnter={e=>e.currentTarget.style.background=V.surface}
                        onMouseLeave={e=>e.currentTarget.style.background="none"}>
                        <i className="ti ti-edit"/>
                      </button>
                      <button onClick={()=>onDelete(t.id)}
                        style={{background:"none",border:`0.5px solid ${V.border}`,borderRadius:6,cursor:"pointer",color:V.muted,padding:"5px 8px",fontSize:13}}
                        onMouseEnter={e=>{e.currentTarget.style.background=`${RED}18`;e.currentTarget.style.color=RED;}}
                        onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=V.muted;}}>
                        <svg
  width="16"
  height="16"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.8"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <path d="M4 7h16" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M5 7l1 13h12l1-13" />
  <path d="M9 7V4h6v3" />
</svg>
                      </button>
                    </div>
                  </div>
                </div>
                {/* Details */}
                <div style={{padding:"14px 20px",background:V.bg,display:"flex",gap:24,flexWrap:"wrap"}}>
                  {[{label:"Entry",value:t.entry||"—"},{label:"Exit",value:t.exit||"—"},
                    {label:"SL",value:t.sl||"—"},{label:"TP",value:t.tp||"—"}].map(item=>(
                    <div key={item.label}>
                      <p style={{margin:0,fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{item.label}</p>
                      <p style={{margin:"3px 0 0",fontSize:13,fontWeight:500,color:V.text}}>{item.value}</p>
                    </div>
                  ))}
                  {t.notes&&(
                    <div style={{flex:1}}>
                      <p style={{margin:0,fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>Notes</p>
                      <p style={{margin:"3px 0 0",fontSize:12,color:V.text,lineHeight:1.5}}>{t.notes}</p>
                    </div>
                  )}
                </div>
                {/* Screenshots */}
                {(t.screenshot_before||t.screenshot_after)&&(
                  <div style={{padding:"0 20px 14px",display:"flex",gap:12,background:V.bg}}>
                    {t.screenshot_before&&<img src={t.screenshot_before} alt="setup" onClick={()=>window.open(t.screenshot_before)}
                      style={{height:80,borderRadius:6,border:`0.5px solid ${V.border}`,cursor:"pointer",objectFit:"cover"}}/>}
                    {t.screenshot_after&&<img src={t.screenshot_after} alt="result" onClick={()=>window.open(t.screenshot_after)}
                      style={{height:80,borderRadius:6,border:`0.5px solid ${V.border}`,cursor:"pointer",objectFit:"cover"}}/>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal&&<MissedTradeModal trade={editing} onSave={handleSave} onClose={()=>setShowModal(false)} s={s}/>}
    </div>
  );
}
//Login Screen_____________________________________________________


export default MissedTrades;

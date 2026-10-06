import { SETUP_CHECKS_DEFAULT } from "../../setupChecklist.js";
import Badge from "../shared/Badge";
import { V, GRN, RED, BLU, MOODS, MISTAKES, fp } from "../../constants.js";
import { usePerformanceStats } from "../../hooks/usePerformanceStats.js";
import { useEffect } from "react";
function DayDetail({date,trades,onClose,s,checklist=SETUP_CHECKS_DEFAULT,onLoadImages}) {
  const dayTrades=trades.filter(t=>t.date===date).sort((a,b)=>a.time?.localeCompare(b.time));
  useEffect(() => {
    if (!onLoadImages) return;
    for (const trade of dayTrades) {
      if (!trade.screenshot_before && !trade.screenshot_after) onLoadImages(trade.id);
    }
  }, [date, dayTrades.length, onLoadImages]);
  const performance = usePerformanceStats(dayTrades, checklist);
  const totalPnl = performance.totalPnl;
  const wins = performance.wins;
  const losses = performance.losses;
  const dayName=new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{background:V.bg,borderRadius:V.radiusLg,border:`0.5px solid ${V.border}`,width:"min(780px,95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.5)"}}>
        <div style={{padding:"1.25rem 1.5rem",borderBottom:`0.5px solid ${V.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:V.bg,zIndex:10}}>
          <div>
            <p style={{margin:0,fontWeight:600,fontSize:17,color:V.text}}>{dayName}</p>
            <p style={{margin:"3px 0 0",fontSize:12,color:V.muted}}>{dayTrades.length} trade{dayTrades.length!==1?"s":""} logged</p>
          </div>
          <button onClick={onClose} style={{background:"none",border:`0.5px solid ${V.border}`,cursor:"pointer",color:V.muted,padding:"6px 12px",borderRadius:V.radius,fontSize:13}}>✕ Close</button>
        </div>
        <div style={{padding:"1rem 1.5rem",borderBottom:`0.5px solid ${V.border}`,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[{label:"Day P&L",value:fp(totalPnl),color:totalPnl>=0?GRN:RED},{label:"Trades",value:dayTrades.length,color:V.text},{label:"W / L",value:<><span style={{color:GRN}}>{wins}W</span> / <span style={{color:RED}}>{losses}L</span></>,color:V.text},{label:"Win Rate",value:`${performance.decisiveTrades>0?Math.round(performance.winRate):0}%`,color:wins/Math.max(dayTrades.length,1)>=0.5?GRN:RED}].map((item,i)=>(
            <div key={i} style={{...s.card,textAlign:"center"}}>
              <p style={{margin:0,fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{item.label}</p>
              <p style={{margin:"4px 0 0",fontSize:20,fontWeight:700,color:item.color}}>{item.value}</p>
            </div>
          ))}
        </div>
        {dayTrades.length===0?(
          <div style={{padding:"3rem",textAlign:"center",color:V.muted}}>No trades on this day</div>
        ):(
          <div style={{padding:"1rem 1.5rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
            {dayTrades.map((t,i)=>(
              <div key={t.id} style={{border:`0.5px solid ${t.pnl>=0?"rgba(0,217,160,0.3)":"rgba(255,64,96,0.3)"}`,borderRadius:V.radius,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",background:t.pnl>=0?"rgba(0,217,160,0.06)":"rgba(255,64,96,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:13,fontWeight:600,color:V.text}}>Trade {i+1}</span>
                    <Badge dir={t.dir}/>
                    <span style={{fontSize:12,color:V.muted}}>{t.symbol}</span>
                    {t.time&&<span style={{fontSize:11,color:V.muted}}>Entry @ {t.time}</span>}
                    {t.exit_time&&<span style={{fontSize:11,color:V.muted}}>Exit @ {t.exit_time}</span>}
                  </div>
                  <span style={{fontSize:16,fontWeight:700,color:t.pnl>=0?GRN:RED}}>{fp(t.pnl)}</span>
                </div>
                <div style={{padding:"12px 14px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
                    {[{label:"Entry",value:t.entry?.toLocaleString()},{label:"Exit",value:t.exit?.toLocaleString()},{label:"SL",value:t.sl||"—"},{label:"TP",value:t.tp||"—"},{label:"R:R",value:t.rr>0?`${t.rr}R`:"-1R"},{label:"Qty",value:t.qty},{label:"Risk",value:t.risk?`$${t.risk}`:"—"},{label:"Setup",value:t.setup},{label:"Session",value:t.session},{label:"Mood",value:MOODS[t.mood-1]}].map(item=>(
                      <div key={item.label} style={{background:V.surface,borderRadius:V.radius,padding:"6px 8px",border:`0.5px solid ${V.border}`}}>
                        <p style={{margin:0,fontSize:9,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{item.label}</p>
                        <p style={{margin:"2px 0 0",fontSize:12,fontWeight:500,color:V.text}}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {t.setup_checklist&&Object.values(t.setup_checklist).some((value) => typeof value === "boolean" && value)&&(
                    <div style={{marginBottom:10}}>
                      <p style={{margin:"0 0 6px",fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>Checklist</p>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {checklist.map(item=>(
                          <span key={item.key} style={{fontSize:11,padding:"3px 8px",borderRadius:4,background:t.setup_checklist[item.key]?"rgba(0,217,160,0.1)":"rgba(255,64,96,0.08)",color:t.setup_checklist[item.key]?GRN:RED,border:`0.5px solid ${t.setup_checklist[item.key]?"rgba(0,217,160,0.3)":"rgba(255,64,96,0.2)"}`}}>
                            {t.setup_checklist[item.key]?"✓":"✗"} {item.key.replace(/_/g," ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {t.mistakes?.length>0&&(
                    <div style={{marginBottom:10}}>
                      <p style={{margin:"0 0 6px",fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>Mistakes</p>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {t.mistakes.map(k=>{const m=MISTAKES.find(x=>x.key===k); return m?<span key={k} style={{fontSize:11,padding:"3px 8px",borderRadius:4,background:"rgba(255,64,96,0.08)",color:RED,border:"0.5px solid rgba(255,64,96,0.25)"}}>⚠️ {m.label.split("—")[0].trim()}</span>:null;})}
                      </div>
                    </div>
                  )}
                  {(t.notes_log?.filter(e=>e.text).length>0||t.notes)&&(
                    <div style={{marginBottom:10}}>
                      <p style={{margin:"0 0 4px",fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>Notes</p>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {t.notes_log?t.notes_log.filter(e=>e.text).map((e,i)=>(
                          <div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"6px 10px",background:V.surface,borderRadius:V.radius,border:`0.5px solid ${V.border}`}}>
                            <span style={{color:BLU,fontWeight:500,minWidth:45}}>{e.time}</span>
                            <span style={{color:V.text}}>{e.text}</span>
                          </div>
                        )):<p style={{margin:0,fontSize:13,color:V.text,padding:"8px 10px",background:V.surface,borderRadius:V.radius,border:`0.5px solid ${V.border}`}}>{t.notes}</p>}
                      </div>
                    </div>
                  )}
                  {(t.screenshot_before||t.screenshot_after)&&(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {t.screenshot_before&&<div><p style={{margin:"0 0 4px",fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>Before</p><img src={t.screenshot_before} onClick={()=>window.open(t.screenshot_before)} style={{width:"100%",maxHeight:120,objectFit:"cover",borderRadius:V.radius,border:`0.5px solid ${V.border}`,cursor:"pointer"}}/></div>}
                      {t.screenshot_after&&<div><p style={{margin:"0 0 4px",fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>After</p><img src={t.screenshot_after} onClick={()=>window.open(t.screenshot_after)} style={{width:"100%",maxHeight:120,objectFit:"cover",borderRadius:V.radius,border:`0.5px solid ${V.border}`,cursor:"pointer"}}/></div>}
                    </div>
                  )}
                  {t.chart_url&&<div style={{marginTop:8}}><button onClick={()=>window.open(t.chart_url,"_blank")} style={{padding:"6px 14px",background:BLU,color:"#fff",border:"none",borderRadius:V.radius,cursor:"pointer",fontSize:12,fontWeight:500}}>📊 Open TradingView Chart ↗</button></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────


export default DayDetail;

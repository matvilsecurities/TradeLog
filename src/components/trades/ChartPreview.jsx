import { getTVSymbol, loadTradingViewScript } from "./tradingView";
import Badge from "../shared/Badge";
import { useEffect } from "react";
import { V, GRN, RED, BLU, fp, fd } from "../../constants.js";
function ChartPreview({trade,onClose,s}) {
  const symbol=getTVSymbol(trade.symbol);
  const widgetId=`tv_widget_${trade.id}`;
  useEffect(()=>{
    let cancelled=false;
    loadTradingViewScript().then(()=>{
      if (cancelled) return;
      const el=document.getElementById(widgetId);
      if (!el || !window.TradingView) return;
      el.innerHTML="";
      new window.TradingView.widget({container_id:widgetId,symbol,interval:"5",timezone:"Asia/Kolkata",theme:V.bg==="#ffffff"?"light":"dark",style:"1",locale:"en",hide_top_toolbar:false,save_image:false,height:340,width:"100%"});
    }).catch(err=>console.error("TradingView widget failed to load:",err));
    return()=>{cancelled=true;const el=document.getElementById(widgetId); if(el) el.innerHTML="";}
  },[trade.id]);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{background:V.bg,borderRadius:V.radiusLg,border:`0.5px solid ${V.border}`,width:"min(860px,95vw)",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.5)"}}>
        <div style={{padding:"1rem 1.25rem",borderBottom:`0.5px solid ${V.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontWeight:500,fontSize:15,color:V.text}}>{trade.symbol} — {trade.dir}</span>
            <Badge dir={trade.dir}/>
            <span style={{fontSize:12,color:trade.pnl>=0?GRN:RED,fontWeight:500}}>{fp(trade.pnl)}</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            {trade.chart_url&&<button onClick={()=>window.open(trade.chart_url,"_blank")} style={{padding:"6px 14px",background:BLU,color:"#fff",border:"none",borderRadius:V.radius,cursor:"pointer",fontSize:12,fontWeight:500}}>Open My Chart ↗</button>}
            <button onClick={onClose} style={{background:"none",border:`0.5px solid ${V.border}`,borderRadius:V.radius,cursor:"pointer",color:V.muted,padding:"6px 12px",fontSize:13}}>✕ Close</button>
          </div>
        </div>
        <div style={{padding:"0.75rem 1.25rem",borderBottom:`0.5px solid ${V.border}`,display:"flex",gap:24,flexWrap:"wrap"}}>
          {[{label:"Date",value:fd(trade.date)},{label:"Entry",value:trade.entry?.toLocaleString()},{label:"Exit",value:trade.exit?.toLocaleString()},{label:"Exit Time",value:trade.exit_time||"—"},{label:"SL",value:trade.sl||"—"},{label:"TP",value:trade.tp||"—"},{label:"Risk",value:trade.risk?`$${trade.risk}`:"—"},{label:"R:R",value:trade.rr>0?`${trade.rr}R`:"-1R"},{label:"Setup",value:trade.setup}].map(item=>(
            <div key={item.label}><p style={{margin:0,fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{item.label}</p><p style={{margin:"2px 0 0",fontSize:12,fontWeight:500,color:V.text}}>{item.value}</p></div>
          ))}
        </div>
        <div style={{padding:"1rem 1.25rem",borderBottom:`0.5px solid ${V.border}`,flex:1}}>
          <p style={{margin:"0 0 8px",fontSize:11,color:V.muted}}>LIVE 5M CHART — {symbol}</p>
          <div id={widgetId} style={{height:340,borderRadius:V.radius,overflow:"hidden"}}/>
        </div>
        <div style={{padding:"1rem 1.25rem",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,overflowY:"auto"}}>
          <div>
            <p style={{margin:"0 0 6px",fontSize:11,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>Before Entry</p>
            {trade.screenshot_before?<img src={trade.screenshot_before} onClick={()=>window.open(trade.screenshot_before)} style={{width:"100%",borderRadius:V.radius,border:`0.5px solid ${V.border}`,objectFit:"cover",cursor:"pointer",maxHeight:100}}/>:<div style={{height:70,border:`1px dashed ${V.border}`,borderRadius:V.radius,display:"flex",alignItems:"center",justifyContent:"center",color:V.muted,fontSize:11}}>No screenshot</div>}
          </div>
          <div>
            <p style={{margin:"0 0 6px",fontSize:11,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>After Exit</p>
            {trade.screenshot_after?<img src={trade.screenshot_after} onClick={()=>window.open(trade.screenshot_after)} style={{width:"100%",borderRadius:V.radius,border:`0.5px solid ${V.border}`,objectFit:"cover",cursor:"pointer",maxHeight:100}}/>:<div style={{height:70,border:`1px dashed ${V.border}`,borderRadius:V.radius,display:"flex",alignItems:"center",justifyContent:"center",color:V.muted,fontSize:11}}>No screenshot</div>}
          </div>
          <div>
            <p style={{margin:"0 0 6px",fontSize:11,color:V.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>Notes</p>
            <div style={{background:V.surface,borderRadius:V.radius,border:`0.5px solid ${V.border}`,padding:"10px",fontSize:12,color:V.text,minHeight:70,lineHeight:1.5}}>
              {trade.notes_log?.filter(e=>e.text).length>0?trade.notes_log.filter(e=>e.text).map((e,i)=>(
                <div key={i} style={{display:"flex",gap:6,marginBottom:4}}><span style={{color:BLU,fontWeight:500,flexShrink:0}}>{e.time}</span><span>{e.text}</span></div>
              )):<span style={{color:V.muted}}>No notes</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────


export default ChartPreview;

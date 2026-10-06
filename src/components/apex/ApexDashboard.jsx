import RadialGauge from "../shared/RadialGauge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { V, GRN, RED, BLU, fp, fd, toLocalISODate } from "../../constants.js";
function ApexDashboard({trades,s,settings={}}) {
  const ACCOUNT_SIZE=settings.accountSize||150000;
  const MAX_DRAWDOWN=settings.maxDrawdown||4500;
  const DAILY_LOSS_LIMIT=settings.dailyLossLimit||2500;
  const DRAWDOWN_LOCK_AT=ACCOUNT_SIZE+MAX_DRAWDOWN;
  const PAYOUT_MIN=settings.minPayout||500;
  const PAYOUT_THRESHOLD=settings.payoutThreshold||25000;
  const MIN_TRADING_DAYS=settings.minTradingDays||8;
  const INITIAL_PROFIT=settings.initialProfit||0;
  const PROFIT_TARGET=settings.profitTarget||0;
  const MIN_EQUITY_FOR_PAYOUT=settings.minEquityForPayout||155100;
  const MIN_PROFITABLE_DAYS=settings.minProfitableDays||5;
  const MIN_DAILY_PROFIT=settings.minDailyProfit||50;

  const sorted=[...trades].sort((a,b)=>a.date.localeCompare(b.date));
  let eq=ACCOUNT_SIZE,hwm=ACCOUNT_SIZE;
  const equityCurve=sorted.map(t=>{eq+=t.pnl; if(eq>hwm) hwm=eq; return {date:fd(t.date),equity:Math.round(eq),limit:Math.round(hwm-MAX_DRAWDOWN)};});

  const loggedPnl=Math.round(trades.reduce((s,t)=>s+t.pnl,0));
  const currentEquity=Math.round(ACCOUNT_SIZE+loggedPnl+INITIAL_PROFIT);
  const totalPnl=currentEquity-ACCOUNT_SIZE;
  const highWaterMark=equityCurve.length?Math.max(...equityCurve.map(e=>e.equity)):ACCOUNT_SIZE;
  const drawdownLevel=highWaterMark-MAX_DRAWDOWN;
  const currentDrawdown=highWaterMark-currentEquity;
  const drawdownUsedPct=Math.min((currentDrawdown/MAX_DRAWDOWN)*100,100);
  const ddLocked=highWaterMark>=DRAWDOWN_LOCK_AT;
  const finalDDLevel=ddLocked?DRAWDOWN_LOCK_AT-MAX_DRAWDOWN:drawdownLevel;

  const today=toLocalISODate();
  const todayPnl=trades.filter(t=>t.date===today).reduce((s,t)=>s+t.pnl,0);
  const dailyLossUsed=Math.abs(Math.min(todayPnl,0));
  const dailyLossPct=Math.min((dailyLossUsed/DAILY_LOSS_LIMIT)*100,100);
  const tradingDays=[...new Set(trades.map(t=>t.date))].length;

  const dayPnls={};
  trades.forEach(t=>{dayPnls[t.date]=(dayPnls[t.date]||0)+t.pnl;});
  const dayValues=Object.values(dayPnls);
  const bestDayPnl=dayValues.length?Math.max(...dayValues):0;
  const consistPct=totalPnl>0?(bestDayPnl/totalPnl*100):0;
  const consistOk=consistPct<=30;

  const profitableDays=Object.values(dayPnls).filter(p=>p>=MIN_DAILY_PROFIT).length;
  const profitableDaysOk=profitableDays>=MIN_PROFITABLE_DAYS;
  const tradingDaysOk=tradingDays>=MIN_TRADING_DAYS;

  const SAFETY_NET=MIN_EQUITY_FOR_PAYOUT-PAYOUT_MIN;
  const equityEligible=currentEquity>=MIN_EQUITY_FOR_PAYOUT;
  const requestableAmount=Math.max(Math.round(currentEquity-SAFETY_NET),0);
  const payoutEligible=equityEligible&&tradingDaysOk&&profitableDaysOk&&consistOk;

  const Gauge=({label,used,max,pct,colorOk,colorWarn,colorDanger,note})=>{
    const color=pct>=90?colorDanger:pct>=60?colorWarn:colorOk;
    return (
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
        <RadialGauge pct={pct} size={72} strokeWidth={7} color={color}/>
        <div style={{flex:1}}>
          <p style={{margin:"0 0 4px",fontSize:12,color:V.muted}}>{label}</p>
          <p style={{margin:0,fontSize:13,fontWeight:600,color}}>{note}</p>
          <p style={{margin:"4px 0 0",fontSize:10,color:V.muted}}>${Math.round(used).toLocaleString()} of ${max.toLocaleString()} used</p>
        </div>
      </div>
    );
  };

  return (
    <div style={{padding:"1.25rem",overflowY:"auto",maxHeight:"100vh"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem"}}>
        <p style={{margin:0,fontSize:16,fontWeight:500,color:V.text}}>The5ers 25K</p>
        <p style={{margin:"2px 0 0",fontSize:11,color:V.muted}}>BlackArrow · Funded Account</p>
        <div style={{textAlign:"right"}}><p style={{margin:0,fontSize:24,fontWeight:500,color:totalPnl>=0?GRN:RED}}>{fp(totalPnl)}</p><p style={{margin:"2px 0 0",fontSize:11,color:V.muted}}>Total P&L</p></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"1.25rem"}}>
        <div style={{...s.card,textAlign:"center"}}><span style={{width:30,height:30,borderRadius:8,background:`${BLU}1f`,display:"inline-flex",alignItems:"center",justifyContent:"center",color:BLU,fontSize:14,marginBottom:8}}><i className="ti ti-wallet"/></span><p style={{margin:"0 0 4px",fontSize:11,color:V.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Current Equity</p><p style={{margin:0,fontSize:20,fontWeight:500,color:V.text}}>${currentEquity.toLocaleString()}</p><p style={{margin:"3px 0 0",fontSize:10,color:V.muted}}>Started at $150,000</p></div>
        <div style={{...s.card,textAlign:"center"}}><span style={{width:30,height:30,borderRadius:8,background:`${RED}1f`,display:"inline-flex",alignItems:"center",justifyContent:"center",color:RED,fontSize:14,marginBottom:8}}><i className="ti ti-shield"/></span><p style={{margin:"0 0 4px",fontSize:11,color:V.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>DD Floor</p><p style={{margin:0,fontSize:20,fontWeight:500,color:RED}}>${finalDDLevel.toLocaleString()}</p><p style={{margin:"3px 0 0",fontSize:10,color:ddLocked?"#f59e0b":V.muted}}>{ddLocked?"🔒 Locked":"Trailing"}</p></div>
        <div style={{...s.card,textAlign:"center"}}><span style={{width:30,height:30,borderRadius:8,background:`${GRN}1f`,display:"inline-flex",alignItems:"center",justifyContent:"center",color:GRN,fontSize:14,marginBottom:8}}><i className="ti ti-calendar-stats"/></span><p style={{margin:"0 0 4px",fontSize:11,color:V.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Trading Days</p><p style={{margin:0,fontSize:20,fontWeight:500,color:V.text}}>{tradingDays}</p><p style={{margin:"3px 0 0",fontSize:10,color:tradingDaysOk?GRN:V.muted}}>{tradingDaysOk?`✅ ${MIN_TRADING_DAYS} min met`:`${MIN_TRADING_DAYS-tradingDays} more needed`}</p></div>
      </div>

      <div style={{...s.card,marginBottom:"1.25rem"}}>
        <p style={{margin:"0 0 .75rem",fontSize:13,fontWeight:500,color:V.text}}>Equity curve</p>
        <div style={{height:200}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurve.length?equityCurve:[{date:"Start",equity:ACCOUNT_SIZE,limit:ACCOUNT_SIZE-MAX_DRAWDOWN}]} margin={{top:4,right:4,bottom:0,left:0}}>
              <defs><linearGradient id="apexGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GRN} stopOpacity={0.2}/><stop offset="95%" stopColor={GRN} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)"/>
              <XAxis dataKey="date" tick={{fontSize:10,fill:V.muted}} tickLine={false} axisLine={false} allowDuplicatedCategory={false}/>
              <YAxis tick={{fontSize:10,fill:V.muted}} tickLine={false} axisLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} width={48} domain={["auto","auto"]}/>
              <Tooltip content={({active,payload,label})=>{if(!active||!payload?.length) return null; return <div style={{background:V.bg,border:`0.5px solid ${V.border}`,borderRadius:V.radius,padding:"8px 12px",fontSize:12}}><p style={{margin:0,color:V.muted}}>{label}</p><p style={{margin:"3px 0 0",color:GRN,fontWeight:500}}>Equity: ${payload[0]?.value?.toLocaleString()}</p></div>;}}/>
              <Area type="monotone" dataKey="equity" stroke={GRN} fill="url(#apexGrad)" strokeWidth={2} dot={false}/>
              <Area type="monotone" dataKey="limit" stroke={RED} fill="none" strokeWidth={1} dot={false} strokeDasharray="4 4"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p style={{margin:"6px 0 0",fontSize:10,color:V.muted}}>— — Red dashed = drawdown floor</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
        <div style={s.card}>
          <p style={{margin:"0 0 1rem",fontSize:13,fontWeight:500,color:V.text}}>Risk meters</p>
          <Gauge label="Trailing Drawdown" used={currentDrawdown} max={MAX_DRAWDOWN} pct={drawdownUsedPct} colorOk={GRN} colorWarn="#f59e0b" colorDanger={RED} note={`$${Math.round(MAX_DRAWDOWN-currentDrawdown).toLocaleString()} remaining`}/>
          <Gauge label="Daily Loss Limit" used={dailyLossUsed} max={DAILY_LOSS_LIMIT} pct={dailyLossPct} colorOk={GRN} colorWarn="#f59e0b" colorDanger={RED} note={`$${Math.round(DAILY_LOSS_LIMIT-dailyLossUsed).toLocaleString()} remaining`}/>
          <div style={{borderTop:`0.5px solid ${V.border}`,paddingTop:12,marginTop:4}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}><span style={{color:V.muted}}>Today's P&L</span><span style={{fontWeight:500,color:todayPnl>=0?GRN:RED}}>{fp(todayPnl)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:V.muted}}>High Water Mark</span><span style={{fontWeight:500,color:V.text}}>${highWaterMark.toLocaleString()}</span></div>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
          <div style={s.card}>
            <p style={{margin:"0 0 .75rem",fontSize:13,fontWeight:500,color:V.text}}>Consistency rule</p>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:V.muted}}>Best day %</span><span style={{fontSize:13,fontWeight:500,color:consistOk?GRN:RED}}>{consistPct.toFixed(1)}% {consistOk?"✅":"⚠️"}</span></div>
            <div style={{height:6,background:V.surface,borderRadius:3,overflow:"hidden",border:`0.5px solid ${V.border}`}}><div style={{width:`${Math.min(consistPct,100)}%`,height:"100%",background:consistOk?GRN:RED,borderRadius:3}}/></div>
            <p style={{margin:"6px 0 0",fontSize:10,color:V.muted}}>Max allowed: 30% of total profits</p>
          </div>

          <div style={s.card}>
            <p style={{margin:"0 0 .75rem",fontSize:13,fontWeight:500,color:V.text}}>Payout Request Calculator</p>
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,color:V.muted}}>Equity progress</span><span style={{fontSize:12,fontWeight:500,color:equityEligible?GRN:V.text}}>${currentEquity.toLocaleString()} / ${MIN_EQUITY_FOR_PAYOUT.toLocaleString()}</span></div>
              <div style={{height:8,background:V.surface,borderRadius:4,overflow:"hidden",border:`0.5px solid ${V.border}`}}><div style={{width:`${Math.min((currentEquity/MIN_EQUITY_FOR_PAYOUT)*100,100)}%`,height:"100%",background:equityEligible?GRN:BLU,borderRadius:4,transition:"width 0.4s"}}/></div>
            </div>
            <div style={{padding:"12px 14px",borderRadius:V.radius,textAlign:"center",marginBottom:12,background:equityEligible?"rgba(0,217,160,0.1)":V.surface,border:`1px solid ${equityEligible?GRN:V.border}`}}>
              <p style={{margin:0,fontSize:11,color:V.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Requestable Right Now</p>
              <p style={{margin:"4px 0 0",fontSize:24,fontWeight:700,color:equityEligible?GRN:V.muted}}>{equityEligible?fp(requestableAmount):"$0"}</p>
              <p style={{margin:"3px 0 0",fontSize:10,color:V.muted}}>{equityEligible?`Equity stays at $${SAFETY_NET.toLocaleString()} after request`:`Need $${Math.max(MIN_EQUITY_FOR_PAYOUT-currentEquity,0).toLocaleString()} more equity`}</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,fontSize:12,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:V.muted}}>Trading days</span><span style={{fontWeight:500,color:tradingDaysOk?GRN:V.text}}>{tradingDays} / {MIN_TRADING_DAYS}{tradingDaysOk?" ✅":""}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:V.muted}}>Profitable days (≥${MIN_DAILY_PROFIT})</span><span style={{fontWeight:500,color:profitableDaysOk?GRN:V.text}}>{profitableDays} / {MIN_PROFITABLE_DAYS}{profitableDaysOk?" ✅":""}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:V.muted}}>Consistency rule</span><span style={{fontWeight:500,color:consistOk?GRN:RED}}>{consistOk?"✅ Passing":"⚠️ Failing"}</span></div>
            </div>
            <div style={{padding:"8px 10px",borderRadius:V.radius,textAlign:"center",background:payoutEligible?"rgba(0,217,160,0.1)":"rgba(255,64,96,0.08)",border:`0.5px solid ${payoutEligible?GRN:RED}`}}>
              <p style={{margin:0,fontSize:12,fontWeight:500,color:payoutEligible?GRN:RED}}>
                {payoutEligible?`✅ Eligible to request ${fp(requestableAmount)}`:!equityEligible?`⏳ Build equity to $${MIN_EQUITY_FOR_PAYOUT.toLocaleString()}`:!tradingDaysOk?`⏳ ${MIN_TRADING_DAYS-tradingDays} more trading days needed`:!profitableDaysOk?`⏳ ${MIN_PROFITABLE_DAYS-profitableDays} more profitable days needed`:"⚠️ Fix consistency rule first"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {PROFIT_TARGET>0&&(
        <div style={{...s.card,marginTop:"1.25rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:".75rem"}}><p style={{margin:0,fontSize:13,fontWeight:500,color:V.text}}>Profit Target Monitor</p><span style={{fontSize:12,color:V.muted}}>{fp(totalPnl)} / ${PROFIT_TARGET.toLocaleString()}</span></div>
          <div style={{height:12,background:V.surface,borderRadius:6,overflow:"hidden",border:`0.5px solid ${V.border}`,marginBottom:8}}><div style={{width:`${Math.min((totalPnl/PROFIT_TARGET)*100,100)}%`,height:"100%",borderRadius:6,transition:"width 0.6s ease",background:totalPnl>=PROFIT_TARGET?GRN:totalPnl/PROFIT_TARGET>=0.75?"#f59e0b":BLU}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[{label:"Current Profit",value:fp(totalPnl),color:totalPnl>=0?GRN:RED},{label:"Target",value:`$${PROFIT_TARGET.toLocaleString()}`,color:V.text},{label:"Remaining",value:totalPnl>=PROFIT_TARGET?"✅ Done!":fp(PROFIT_TARGET-totalPnl),color:totalPnl>=PROFIT_TARGET?GRN:"#f59e0b"},{label:"Progress",value:`${Math.min(Math.round((totalPnl/PROFIT_TARGET)*100),100)}%`,color:BLU}].map(item=>(
              <div key={item.label} style={{background:V.surface,borderRadius:V.radius,padding:"10px",border:`0.5px solid ${V.border}`,textAlign:"center"}}><p style={{margin:0,fontSize:10,color:V.muted}}>{item.label}</p><p style={{margin:"4px 0 0",fontSize:16,fontWeight:600,color:item.color}}>{item.value}</p></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Apex Settings ─────────────────────────────────────────────


export default ApexDashboard;

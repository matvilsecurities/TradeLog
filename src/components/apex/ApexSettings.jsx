import { useState } from "react";
import { V, GRN, BLU } from "../../constants.js";
function ApexSettings({settings,onSave,s}) {
  const row={display:"flex",flexDirection:"column",gap:3};
  const [f,setF]=useState({...settings});
  const [saved,setSaved]=useState(false);
  const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
  const handleSave=()=>{onSave(f); setSaved(true); setTimeout(()=>setSaved(false),2000);};
  const presets=[
    {label:"25K Legacy",  accountSize:25000,  maxDrawdown:1500, dailyLossLimit:500},
    {label:"50K Legacy",  accountSize:50000,  maxDrawdown:2500, dailyLossLimit:1000},
    {label:"100K Legacy", accountSize:100000, maxDrawdown:3000, dailyLossLimit:2000},
    {label:"150K Legacy", accountSize:150000, maxDrawdown:4500, dailyLossLimit:2500},
    {label:"300K Legacy", accountSize:300000, maxDrawdown:7500, dailyLossLimit:5000},
  ];
  return (
    <div style={{padding:"1.25rem",maxWidth:640,overflowY:"auto",maxHeight:"100vh"}}>
      <div style={{marginBottom:"1.25rem"}}><p style={{margin:0,fontSize:16,fontWeight:500,color:V.text}}>Apex Account Settings</p><p style={{margin:"3px 0 0",fontSize:12,color:V.muted}}>Configure your funded account rules and limits</p></div>
      <div style={{...s.card,marginBottom:"1.25rem"}}>
        <p style={{margin:"0 0 .75rem",fontSize:13,fontWeight:500,color:V.text}}>Quick Presets</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {presets.map(p=>(
            <button key={p.label} onClick={()=>setF(prev=>({...prev,accountSize:p.accountSize,maxDrawdown:p.maxDrawdown,dailyLossLimit:p.dailyLossLimit}))}
              style={{padding:"6px 14px",fontSize:12,borderRadius:4,cursor:"pointer",background:f.accountSize===p.accountSize?BLU:"transparent",color:f.accountSize===p.accountSize?"#fff":V.muted,border:`0.5px solid ${f.accountSize===p.accountSize?BLU:V.border}`,fontWeight:f.accountSize===p.accountSize?500:400}}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{...s.card,marginBottom:"1.25rem"}}>
        <p style={{margin:"0 0 1rem",fontSize:13,fontWeight:500,color:V.text}}>Account Info</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={row}><label style={s.ilbl}>Account Name</label><input value={f.accountName||""} onChange={e=>set("accountName",e.target.value)} placeholder="e.g. Apex 150K Legacy" style={s.inp}/></div>
          <div style={row}><label style={s.ilbl}>Platform</label><select value={f.platform||"Tradovate"} onChange={e=>set("platform",e.target.value)} style={s.inp}><option>Tradovate</option><option>Rithmic</option><option>NinjaTrader</option></select></div>
        </div>
      </div>
      <div style={{...s.card,marginBottom:"1.25rem"}}>
        <p style={{margin:"0 0 1rem",fontSize:13,fontWeight:500,color:V.text}}>Risk Rules</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={row}><label style={s.ilbl}>Account Size ($)</label><input type="number" value={f.accountSize} onChange={e=>set("accountSize",parseFloat(e.target.value))} style={s.inp}/><span style={{fontSize:10,color:V.muted,marginTop:2}}>Starting balance</span></div>
          <div style={row}><label style={s.ilbl}>Max Trailing Drawdown ($)</label><input type="number" value={f.maxDrawdown} onChange={e=>set("maxDrawdown",parseFloat(e.target.value))} style={s.inp}/><span style={{fontSize:10,color:V.muted,marginTop:2}}>DD floor = ${((f.accountSize||0)-(f.maxDrawdown||0)).toLocaleString()}</span></div>
          <div style={row}><label style={s.ilbl}>Daily Loss Limit ($)</label><input type="number" value={f.dailyLossLimit} onChange={e=>set("dailyLossLimit",parseFloat(e.target.value))} style={s.inp}/></div>
          <div style={row}><label style={s.ilbl}>Per Trade Risk Limit ($)</label><input type="number" value={f.perTradeRiskLimit||250} onChange={e=>set("perTradeRiskLimit",parseFloat(e.target.value))} style={s.inp}/></div>
        </div>
      </div>
      <div style={{...s.card,marginBottom:"1.25rem"}}>
        <p style={{margin:"0 0 1rem",fontSize:13,fontWeight:500,color:V.text}}>Payout Rules</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={row}><label style={s.ilbl}>Minimum Trading Days</label><input type="number" value={f.minTradingDays} onChange={e=>set("minTradingDays",parseInt(e.target.value))} style={s.inp}/></div>
          <div style={row}><label style={s.ilbl}>Minimum Profitable Days</label><input type="number" value={f.minProfitableDays||5} onChange={e=>set("minProfitableDays",parseInt(e.target.value)||0)} style={s.inp}/><span style={{fontSize:10,color:V.muted,marginTop:2}}>Days with min profit below</span></div>
          <div style={row}><label style={s.ilbl}>Min Daily Profit ($)</label><input type="number" value={f.minDailyProfit||50} onChange={e=>set("minDailyProfit",parseFloat(e.target.value)||0)} style={s.inp}/></div>
          <div style={row}><label style={s.ilbl}>Equity Required for Payout ($)</label><input type="number" value={f.minEquityForPayout||155100} onChange={e=>set("minEquityForPayout",parseFloat(e.target.value)||0)} style={s.inp}/></div>
          <div style={row}><label style={s.ilbl}>Minimum Payout ($)</label><input type="number" value={f.minPayout} onChange={e=>set("minPayout",parseFloat(e.target.value))} style={s.inp}/></div>
          <div style={row}><label style={s.ilbl}>Unlogged Profit Offset ($)</label><input type="number" value={f.initialProfit||0} onChange={e=>set("initialProfit",parseFloat(e.target.value)||0)} style={s.inp}/><span style={{fontSize:10,color:V.muted,marginTop:2}}>Profits before using this journal</span></div>
          <div style={row}><label style={s.ilbl}>Profit Target ($)</label><input type="number" value={f.profitTarget||0} onChange={e=>set("profitTarget",parseFloat(e.target.value)||0)} style={s.inp}/></div>
          <div style={row}><label style={s.ilbl}>Consistency Rule (%)</label><input type="number" value={f.consistencyRule||40} onChange={e=>set("consistencyRule",parseFloat(e.target.value))} style={s.inp}/></div>
        </div>
      </div>
      <button onClick={handleSave} style={{width:"100%",padding:"10px",fontSize:14,fontWeight:500,background:saved?GRN:BLU,color:"#fff",border:"none",borderRadius:V.radius,cursor:"pointer",transition:"background 0.3s"}}>
        {saved?"✅ Settings Saved!":"Save Settings"}
      </button>
    </div>
  );
}

// ── Edge Analysis ─────────────────────────────────────────────


export default ApexSettings;

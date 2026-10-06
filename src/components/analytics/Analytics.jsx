import Tip from "../shared/Tip";
import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { V, GRN, RED, BLU, PURPLE, fp } from "../../constants.js";
import { usePerformanceStats } from "../../hooks/usePerformanceStats.js";
function Analytics({trades, s}) {
  const performance = usePerformanceStats(trades);
  const { dayOfWeekPerformance, setupPerformance, wins, losses, breakeven } = performance;

  const donutData = [
    { name: "Wins", value: wins, color: GRN },
    { name: "Losses", value: losses, color: RED },
    { name: "Breakeven", value: breakeven, color: V.muted },
  ];

  return (
    <div style={{padding:"1.25rem",display:"flex",flexDirection:"column",gap:"1.25rem",overflowY:"auto",maxHeight:"100vh"}}>
      <div style={s.card}>
        <p style={{margin:"0 0 1rem",fontSize:13,fontWeight:500,color:V.text}}>Performance Overview</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:10}}>
          {[
            ["Net P&L", performance.totalPnl, performance.totalPnl >= 0 ? GRN : RED],
            ["Win Rate", `${performance.winRate.toFixed(0)}%`, BLU],
            ["Profit Factor", performance.profitFactor === Infinity ? "∞" : performance.profitFactor.toFixed(2), PURPLE],
            ["Avg Win", fp(performance.avgWin), GRN],
            ["Avg Loss", fp(performance.avgLoss), RED],
            ["Max Drawdown", `-${fp(performance.maxDrawdown)}`, RED],
          ].map(([label,value,color]) => (
            <div key={label} style={{padding:"10px 12px",background:V.surface,border:`0.5px solid ${V.border}`,borderRadius:V.radius}}>
              <div style={{fontSize:9,color:V.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
              <div style={{marginTop:4,fontSize:16,fontWeight:700,color}}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.card}>
        <p style={{margin:"0 0 1rem",fontSize:13,fontWeight:500,color:V.text}}>P&L by Day of Week</p>
        <div style={{height:220}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayOfWeekPerformance} margin={{top:4,right:4,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false}/>
              <XAxis dataKey="day" tick={{fontSize:11,fill:V.muted}} tickLine={false} axisLine={false}/>
              <YAxis tick={{fontSize:10,fill:V.muted}} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`} width={48}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="pnl" radius={[4,4,0,0]}>{dayOfWeekPerformance.map((d,i)=><Cell key={i} fill={d.pnl>=0?GRN:RED}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={s.card}>
        <p style={{margin:"0 0 1rem",fontSize:13,fontWeight:500,color:V.text}}>Win / Loss Distribution</p>
        <div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                {donutData.map((d,i)=><Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8}}>
          {donutData.map(d=><span key={d.name} style={{fontSize:11,color:V.muted,display:"flex",alignItems:"center",gap:5}}><span style={{width:8,height:8,borderRadius:"50%",background:d.color,display:"inline-block"}}/>{d.name}: {d.value}</span>)}
        </div>
      </div>

      <div style={s.card}>
        <p style={{margin:"0 0 1rem",fontSize:13,fontWeight:500,color:V.text}}>P&L by Setup</p>
        <div style={{height:220}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={setupPerformance.slice(0,8)} layout="vertical" margin={{top:4,right:40,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:10,fill:V.muted}} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/>
              <YAxis type="category" dataKey="label" tick={{fontSize:10,fill:V.muted}} tickLine={false} axisLine={false} width={90}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="pnl" radius={[0,4,4,0]}>{setupPerformance.slice(0,8).map((d,i)=><Cell key={i} fill={d.pnl>=0?GRN:RED}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Day Detail Modal ──────────────────────────────────────────


export default memo(Analytics);

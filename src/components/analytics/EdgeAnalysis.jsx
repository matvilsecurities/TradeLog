import { SETUP_CHECKS_DEFAULT } from "../../setupChecklist.js";
import Badge from "../shared/Badge";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import ComplianceNebula from "../ComplianceNebula";
import { V, GRN, RED, BLU, PURPLE, TEAL, AMBER, fp, fd, getSetupRating, toLocalISODate } from "../../constants.js";
import { usePerformanceStats } from "../../hooks/usePerformanceStats.js";
function EdgeAnalysis({trades,s,checklist=SETUP_CHECKS_DEFAULT}) {
  const [activeTab,setActiveTab]=useState("compliance");

  const performance = usePerformanceStats(trades, checklist);
  const {
    checklistPerformance,
    gradePerformance,
    mistakePerformance,
    totalPnl,
    wins,
    losses,
  } = performance;

  const compliance = checklistPerformance.map(item => ({
    ...item,
    checked: item.checked,
    total: item.total,
    pct: Math.round(item.compliance),
    winRate: Math.round(item.winRateWhenChecked),
    missedWR: Math.round(item.winRateWhenUnchecked),
  }));

  const gradeMeta = {
    "A+": { color: GRN, label: "Perfect Setup" },
    "A": { color: BLU, label: "High Probability" },
    "B": { color: AMBER, label: "Moderate Probability" },
    "C": { color: RED, label: "Low Probability" },
    "D": { color: "#991b1b", label: "Poor Setup — Avoid" },
  };

  const byGrade = gradePerformance.map(item => ({
    ...item,
    count: item.trades,
    pnl: Math.round(item.pnl),
    wr: Math.round(item.winRate),
    color: gradeMeta[item.grade]?.color || V.muted,
    label: gradeMeta[item.grade]?.label || item.grade,
  }));

  const highProb = trades.filter(t => {
    const grade = getSetupRating(t?.setup_checklist).grade;
    return grade === "A+" || grade === "A";
  });
  const highProbPnl = highProb.reduce((sum, t) => sum + Number(t?.pnl || 0), 0);
  const highProbWR = highProb.length
    ? Math.round(highProb.filter(t => Number(t?.pnl || 0) > 0).length / highProb.filter(t => Number(t?.pnl || 0) !== 0).length * 100) || 0
    : 0;
  const allWR = performance.winRate;
  const weakest = [...compliance].sort((a,b) => a.pct - b.pct).slice(0,3);
  const tradesWithChecklist = trades.filter(t => t?.setup_checklist).length;
  const mistakeCounts = mistakePerformance.map(item => ({
    ...item,
    count: item.trades,
    lossPct: Math.round(item.lossRate),
  }));

  const tabs=[
    {id:"compliance", icon:"ti-list-check",  label:"Compliance"},
    {id:"grades",     icon:"ti-medal",        label:"Grade Performance"},
    {id:"weaklinks",  icon:"ti-link",         label:"Weak Links"},
    {id:"mistakes",   icon:"ti-alert-triangle",label:"Mistakes"},
    {id:"highprob",   icon:"ti-trophy",       label:"High Probability"},
  ];

  return (
    <div style={{height:"100vh",overflowY:"auto",background:V.bg}}>

      {/* ── Header ── */}
      <div style={{background:`linear-gradient(135deg,${V.surface},${V.bg})`,
        borderBottom:`0.5px solid ${V.border}`,padding:"1.75rem 2rem 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.5rem"}}>
          <div>
            <p style={{margin:0,fontSize:22,fontWeight:700,color:V.text,letterSpacing:"-0.02em"}}>Edge Analysis</p>
            <p style={{margin:"4px 0 0",fontSize:13,color:V.muted}}>
              Based on <span style={{color:BLU,fontWeight:600}}>{tradesWithChecklist}</span> trades with checklist data
            </p>
          </div>
          {/* Summary pills */}
          <div style={{display:"flex",gap:10}}>
            {[{label:"High Prob WR",value:`${highProbWR}%`,color:BLU,sub:`vs ${allWR}% overall`},
              {label:"High Prob P&L",value:fp(highProbPnl),color:highProbPnl>=0?GRN:RED,sub:`${highProb.length} trades`},
            ].map(c=>(
              <div key={c.label} style={{background:V.surface,border:`0.5px solid ${V.border}`,
                borderRadius:V.radiusLg,padding:"10px 18px",textAlign:"center",minWidth:120}}>
                <p style={{margin:0,fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{c.label}</p>
                <p style={{margin:"4px 0 2px",fontSize:20,fontWeight:700,color:c.color}}>{c.value}</p>
                <p style={{margin:0,fontSize:10,color:V.muted}}>{c.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:2}}>
          {tabs.map(t=>(
            <button key={t.id} className="edge-tab" onClick={()=>setActiveTab(t.id)}
              style={{display:"flex",alignItems:"center",gap:7,padding:"10px 18px",fontSize:13,
                fontWeight:activeTab===t.id?600:400,cursor:"pointer",border:"none",
                background:"transparent",borderBottom:activeTab===t.id?`2px solid ${BLU}`:"2px solid transparent",
                color:activeTab===t.id?BLU:V.muted,borderRadius:"0",transition:"all 0.2s",marginBottom:-1}}>
              <i className={`ti ${t.icon}`} style={{fontSize:14}}/>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{padding:"2rem"}}>

        {/* ── COMPLIANCE TAB ── */}
        {activeTab==="compliance"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"1rem",marginBottom:"0.5rem"}}>
              {[{label:"Avg Compliance",value:`${compliance.length>0?Math.round(compliance.reduce((s,c)=>s+c.pct,0)/compliance.length):0}%`,color:BLU,icon:"ti-percentage"},
                {label:"Perfect Scores",value:byGrade.find((item) => item.grade === "A+")?.count || 0,color:GRN,icon:"ti-star"},
                {label:"Weakest Item",value:compliance.length>0?`${[...compliance].sort((a,b)=>a.pct-b.pct)[0].pct}%`:"—",color:RED,icon:"ti-alert-triangle"},
                {label:"Total Checked",value:tradesWithChecklist,color:PURPLE,icon:"ti-clipboard-check"},
              ].map((c,i)=>(
                <div key={i} className="edge-card" style={{...s.card,display:"flex",alignItems:"center",gap:14,animationDelay:`${i*0.07}s`,opacity:0,animationFillMode:"forwards"}}>
                  <span style={{width:42,height:42,borderRadius:12,background:`${c.color}18`,
                    display:"flex",alignItems:"center",justifyContent:"center",color:c.color,fontSize:18,flexShrink:0}}>
                    <i className={`ti ${c.icon}`}/>
                  </span>
                  <div>
                    <p style={{margin:0,fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{c.label}</p>
                    <p style={{margin:"3px 0 0",fontSize:22,fontWeight:700,color:c.color}}>{c.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="edge-card" style={{...s.card,animationDelay:"0.2s",opacity:0,animationFillMode:"forwards"}}>
              <p style={{margin:"0 0 1.5rem",fontSize:15,fontWeight:600,color:V.text}}>Checklist Compliance by Item</p>
              <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
                {compliance.map((item,i)=>(
                  <div key={item.key} className="edge-card" style={{animationDelay:`${0.25+i*0.04}s`,opacity:0,animationFillMode:"forwards"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{width:24,height:24,borderRadius:6,background:item.pct>=80?`${GRN}18`:item.pct>=50?`${AMBER}18`:`${RED}18`,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,
                          color:item.pct>=80?GRN:item.pct>=50?AMBER:RED,fontWeight:700}}>{i+1}</span>
                        <span style={{fontSize:13,color:V.text,fontWeight:item.pct<50?600:400}}>{item.label}</span>
                        {item.pct<50&&<span style={{fontSize:10,color:RED,fontWeight:700,padding:"2px 6px",
                          background:"rgba(255,64,96,0.1)",borderRadius:4}}>WEAK LINK</span>}
                      </div>
                      <div style={{display:"flex",gap:20,alignItems:"center"}}>
                        <div style={{textAlign:"center"}}>
                          <p style={{margin:0,fontSize:10,color:V.muted}}>When ✓</p>
                          <p style={{margin:0,fontSize:13,fontWeight:600,color:item.winRate>=50?GRN:RED}}>{item.winRate}% WR</p>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <p style={{margin:0,fontSize:10,color:V.muted}}>When ✗</p>
                          <p style={{margin:0,fontSize:13,fontWeight:600,color:item.missedWR>=50?GRN:RED}}>{item.missedWR}% WR</p>
                        </div>
                        <div style={{textAlign:"right",minWidth:40}}>
                          <p style={{margin:0,fontSize:18,fontWeight:700,
                            color:item.pct>=80?GRN:item.pct>=50?AMBER:RED}}>{item.pct}%</p>
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{position:"relative",height:8,background:V.surface,borderRadius:4,overflow:"hidden",border:`0.5px solid ${V.border}`}}>
                      <div style={{position:"absolute",left:0,top:0,height:"100%",borderRadius:4,
                        width:`${item.pct}%`,transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)",
                        background:item.pct>=80?`linear-gradient(90deg,${GRN},${TEAL})`:
                          item.pct>=50?`linear-gradient(90deg,${AMBER},#f97316)`:
                          `linear-gradient(90deg,${RED},#ff6080)`}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                      <span style={{fontSize:10,color:V.muted}}>{item.checked} of {item.total} trades</span>
                      <span style={{fontSize:10,color:V.muted}}>{item.total-item.checked} skipped</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── GRADES TAB ── */}
        {activeTab==="grades"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"1rem"}}>
              {byGrade.map((g,i)=>(
                <div key={g.grade} className="edge-card"
                  style={{borderRadius:V.radiusLg,padding:"1.5rem",border:`1px solid ${g.color}30`,
                    background:`linear-gradient(160deg,${g.color}12,${V.surface})`,
                    textAlign:"center",animationDelay:`${i*0.08}s`,opacity:0,animationFillMode:"forwards"}}>
                  <p style={{margin:"0 0 4px",fontSize:36,fontWeight:800,color:g.color}}>{g.grade}</p>
                  <p style={{margin:"0 0 16px",fontSize:11,color:V.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{g.label}</p>
                  <div style={{borderTop:`0.5px solid ${g.color}20`,paddingTop:14,display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:V.muted}}>Trades</span>
                      <span style={{fontWeight:600,color:V.text}}>{g.count}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:V.muted}}>Net P&L</span>
                      <span style={{fontWeight:600,color:g.count>0?(g.pnl>=0?GRN:RED):V.muted}}>{g.count>0?fp(g.pnl):"—"}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:V.muted}}>Win Rate</span>
                      <span style={{fontWeight:600,color:g.count>0?(g.wr>=50?GRN:RED):V.muted}}>{g.count>0?`${g.wr}%`:"—"}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:V.muted}}>W / L</span>
                      <span style={{fontWeight:600,color:V.text}}>{g.count>0?`${g.wins}W ${g.losses}L`:"—"}</span>
                    </div>
                  </div>
                  {g.count>0&&(
                    <div style={{marginTop:14,height:4,background:V.surface,borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:2,background:g.color,width:`${g.wr}%`,transition:"width 0.8s ease"}}/>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Grade P&L chart */}
            <div className="edge-card" style={{...s.card,animationDelay:"0.4s",opacity:0,animationFillMode:"forwards"}}>
              <p style={{margin:"0 0 1.25rem",fontSize:15,fontWeight:600,color:V.text}}>P&L by Grade</p>
              <div style={{height:220}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byGrade.filter(g=>g.count>0)} margin={{top:8,right:8,bottom:0,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false}/>
                    <XAxis dataKey="grade" tick={{fontSize:13,fill:V.muted,fontWeight:600}} tickLine={false} axisLine={false}/>
                    <YAxis tick={{fontSize:10,fill:V.muted}} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`} width={52}/>
                    <Tooltip content={({active,payload,label})=>{
                      if(!active||!payload?.length)return null;
                      const g=byGrade.find(x=>x.grade===label);
                      return(
                        <div style={{background:V.bg,border:`0.5px solid ${V.border}`,borderRadius:V.radius,padding:"12px 16px",fontSize:12}}>
                          <p style={{margin:"0 0 6px",fontWeight:700,color:g?.color,fontSize:16}}>{label}</p>
                          <p style={{margin:"2px 0",color:V.muted}}>P&L: <span style={{color:payload[0].value>=0?GRN:RED,fontWeight:600}}>{fp(payload[0].value)}</span></p>
                          <p style={{margin:"2px 0",color:V.muted}}>Trades: <span style={{color:V.text,fontWeight:600}}>{g?.count}</span></p>
                          <p style={{margin:"2px 0",color:V.muted}}>Win Rate: <span style={{color:g?.wr>=50?GRN:RED,fontWeight:600}}>{g?.wr}%</span></p>
                        </div>
                      );
                    }}/>
                    <Bar dataKey="pnl" radius={[6,6,0,0]}>
                      {byGrade.filter(g=>g.count>0).map((g,i)=><Cell key={i} fill={g.color}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── WEAK LINKS TAB ── */}
        {activeTab==="weaklinks"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
            <div style={{...s.card,padding:"1.5rem",background:`linear-gradient(135deg,rgba(255,64,96,0.06),${V.surface})`,border:`0.5px solid rgba(255,64,96,0.2)`}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.25rem"}}>
                <span style={{width:40,height:40,borderRadius:10,background:"rgba(255,64,96,0.12)",display:"flex",alignItems:"center",justifyContent:"center",color:RED,fontSize:18}}>
                  <i className="ti ti-link"/>
                </span>
                <div>
                  <p style={{margin:0,fontSize:16,fontWeight:600,color:V.text}}>Your Weakest Links</p>
                  <p style={{margin:"2px 0 0",fontSize:12,color:V.muted}}>These conditions are skipped most often — fixing them will have the highest impact on your edge</p>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
                {weakest.map((item,i)=>(
                  <div key={item.key} className="edge-card"
                    style={{background:V.bg,borderRadius:V.radiusLg,padding:"1.25rem 1.5rem",
                      border:`0.5px solid rgba(255,64,96,0.15)`,animationDelay:`${i*0.1}s`,opacity:0,animationFillMode:"forwards"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
                      <div style={{width:44,height:44,borderRadius:12,background:"rgba(255,64,96,0.1)",
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{fontSize:20,fontWeight:800,color:RED}}>#{i+1}</span>
                      </div>
                      <div style={{flex:1}}>
                        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:600,color:V.text}}>{item.label}</p>
                        <div style={{display:"flex",gap:20,marginBottom:10}}>
                          <span style={{fontSize:12,color:V.muted}}>Compliance: <span style={{color:RED,fontWeight:600}}>{item.pct}%</span></span>
                          <span style={{fontSize:12,color:V.muted}}>WR when followed: <span style={{color:item.winRate>=50?GRN:RED,fontWeight:600}}>{item.winRate}%</span></span>
                          <span style={{fontSize:12,color:V.muted}}>WR when skipped: <span style={{color:item.missedWR>=50?GRN:RED,fontWeight:600}}>{item.missedWR}%</span></span>
                        </div>
                        <div style={{height:8,background:V.surface,borderRadius:4,overflow:"hidden",border:`0.5px solid ${V.border}`}}>
                          <div style={{height:"100%",borderRadius:4,background:`linear-gradient(90deg,${RED},#ff6080)`,
                            width:`${item.pct}%`,transition:"width 0.8s ease"}}/>
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <p style={{margin:0,fontSize:28,fontWeight:800,color:RED}}>{item.pct}%</p>
                        <p style={{margin:0,fontSize:10,color:V.muted}}>compliance</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All items sorted by compliance */}
              <ComplianceNebula compliance={compliance} />
            </div>
        )}

        {/* ── MISTAKES TAB ── */}
        {activeTab==="mistakes"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
            {mistakeCounts.length===0?(
              <div style={{...s.card,padding:"4rem",textAlign:"center"}}>
                <i className="ti ti-mood-happy" style={{fontSize:52,color:GRN,display:"block",marginBottom:12}}/>
                <p style={{margin:0,fontSize:18,fontWeight:600,color:V.text}}>No mistakes logged yet</p>
                <p style={{margin:"8px 0 0",fontSize:13,color:V.muted}}>Great discipline! Keep logging trades to track patterns</p>
              </div>
            ):(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
                  {/* Frequency bars */}
                  <div className="edge-card" style={{...s.card,animationDelay:"0.05s",opacity:0,animationFillMode:"forwards"}}>
                    <p style={{margin:"0 0 1.25rem",fontSize:15,fontWeight:600,color:V.text}}>Mistake Frequency</p>
                    <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
                      {mistakeCounts.map((m,i)=>(
                        <div key={m.key} className="edge-card" style={{animationDelay:`${0.1+i*0.05}s`,opacity:0,animationFillMode:"forwards"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                            <span style={{fontSize:12,color:V.text,fontWeight:500}}>{m.label.split("—")[0].trim()}</span>
                            <div style={{display:"flex",gap:12}}>
                              <span style={{fontSize:11,color:V.muted}}>{m.count}x</span>
                              <span style={{fontSize:11,fontWeight:600,color:m.lossPct>50?RED:AMBER}}>{m.lossPct}% loss</span>
                            </div>
                          </div>
                          <div style={{height:6,background:V.surface,borderRadius:3,overflow:"hidden",border:`0.5px solid ${V.border}`}}>
                            <div style={{height:"100%",borderRadius:3,transition:"width 0.8s ease",
                              background:`linear-gradient(90deg,${RED},#ff6080)`,
                              width:`${Math.min(m.count/Math.max(trades.length,1)*100*3,100)}%`}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Donut chart */}
                  <div className="edge-card" style={{...s.card,animationDelay:"0.1s",opacity:0,animationFillMode:"forwards"}}>
                    <p style={{margin:"0 0 1rem",fontSize:15,fontWeight:600,color:V.text}}>Most Common Mistakes</p>
                    <div style={{height:200}}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={mistakeCounts.slice(0,6).map(m=>({name:m.label.split("—")[0].trim(),value:m.count}))}
                            cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                            {mistakeCounts.slice(0,6).map((_,i)=>{
                              const colors=[RED,AMBER,"#f97316",PURPLE,TEAL,BLU];
                              return <Cell key={i} fill={colors[i%colors.length]}/>;
                            })}
                          </Pie>
                          <Tooltip content={({active,payload})=>{
                            if(!active||!payload?.length)return null;
                            return(
                              <div style={{background:V.bg,border:`0.5px solid ${V.border}`,borderRadius:V.radius,padding:"8px 12px",fontSize:12}}>
                                <p style={{margin:0,fontWeight:600,color:V.text}}>{payload[0].name}</p>
                                <p style={{margin:"2px 0 0",color:RED}}>{payload[0].value} times</p>
                              </div>
                            );
                          }}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
                      {mistakeCounts.slice(0,6).map((m,i)=>{
                        const colors=[RED,AMBER,"#f97316",PURPLE,TEAL,BLU];
                        return(
                          <div key={m.key} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:V.muted}}>
                            <span style={{width:8,height:8,borderRadius:2,background:colors[i%colors.length],display:"inline-block"}}/>
                            {m.label.split("—")[0].trim()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── HIGH PROBABILITY TAB ── */}
        {activeTab==="highprob"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
            {/* Summary */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem"}}>
              {[{label:"High Prob Trades",value:highProb.length,color:GRN,icon:"ti-chart-line",sub:"A and A+ grade"},
                {label:"Win Rate",value:`${highProbWR}%`,color:BLU,icon:"ti-target",sub:`vs ${allWR}% overall`},
                {label:"Total P&L",value:fp(highProbPnl),color:highProbPnl>=0?GRN:RED,icon:"ti-currency-dollar",sub:"From high prob trades"},
              ].map((c,i)=>(
                <div key={i} className="edge-card" style={{...s.card,display:"flex",alignItems:"center",gap:16,
                  animationDelay:`${i*0.08}s`,opacity:0,animationFillMode:"forwards",
                  background:`linear-gradient(135deg,${c.color}10,${V.surface})`}}>
                  <span style={{width:48,height:48,borderRadius:14,background:`${c.color}18`,
                    display:"flex",alignItems:"center",justifyContent:"center",color:c.color,fontSize:20,flexShrink:0}}>
                    <i className={`ti ${c.icon}`}/>
                  </span>
                  <div>
                    <p style={{margin:0,fontSize:10,color:V.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{c.label}</p>
                    <p style={{margin:"4px 0 2px",fontSize:24,fontWeight:700,color:c.color}}>{c.value}</p>
                    <p style={{margin:0,fontSize:11,color:V.muted}}>{c.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trades table */}
            <div className="edge-card" style={{...s.card,animationDelay:"0.25s",opacity:0,animationFillMode:"forwards"}}>
              <p style={{margin:"0 0 1.25rem",fontSize:15,fontWeight:600,color:V.text}}>
                🏆 All High Probability Trades
              </p>
              {highProb.length===0?(
                <div style={{textAlign:"center",padding:"3rem",color:V.muted}}>
                  <i className="ti ti-trophy" style={{fontSize:40,display:"block",marginBottom:8,color:V.border}}/>
                  <p style={{margin:0}}>No A or A+ trades yet — complete more checklist items</p>
                </div>
              ):(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1.5px solid ${V.border}`}}>
                        {["Date","Symbol","Direction","Grade","Score","P&L","R:R","Result"].map(h=>(
                          <th key={h} style={{...s.th,paddingTop:0}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {highProb.sort((a,b)=>b.date.localeCompare(a.date)).map((t,i)=>{
                        const r=getSetupRating(t.setup_checklist);
                        return (
                          <tr key={t.id}
                            onMouseEnter={e=>e.currentTarget.style.background=V.surface}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                            style={{borderBottom:`0.5px solid ${V.border}`,transition:"background 0.15s",
                              animation:`edgeFadeIn 0.2s ease ${i*0.03}s forwards`,opacity:0}}>
                            <td style={s.td}><span style={{fontWeight:500,color:V.text}}>{fd(t.date)}</span></td>
                            <td style={{...s.td,fontWeight:700,fontSize:14}}>{t.symbol}</td>
                            <td style={s.td}><Badge dir={t.dir}/></td>
                            <td style={s.td}>
                              <span style={{fontSize:13,fontWeight:800,color:r.color,padding:"4px 12px",
                                borderRadius:20,background:`${r.color}18`,border:`0.5px solid ${r.color}40`}}>{r.grade}</span>
                            </td>
                            <td style={s.td}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{flex:1,height:4,background:V.surface,borderRadius:2,overflow:"hidden",minWidth:60}}>
                                  <div style={{height:"100%",background:r.color,borderRadius:2,width:`${r.score/10*100}%`}}/>
                                </div>
                                <span style={{fontSize:11,color:V.muted,minWidth:30}}>{r.score}/10</span>
                              </div>
                            </td>
                            <td style={{...s.td,fontWeight:700,fontSize:15,color:t.pnl>=0?GRN:RED}}>{fp(t.pnl)}</td>
                            <td style={s.td}>
                              <span style={{fontSize:12,fontWeight:500,color:t.rr>0?GRN:RED,
                                background:t.rr>0?"rgba(0,217,160,0.08)":"rgba(255,64,96,0.08)",
                                padding:"2px 8px",borderRadius:4}}>{t.rr>0?`${t.rr}R`:"-1R"}</span>
                            </td>
                            <td style={s.td}>
                              <span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:500,
                                color:t.pnl>=0?GRN:RED}}>
                                <i className={`ti ${t.pnl>=0?"ti-circle-check":"ti-circle-x"}`} style={{fontSize:14}}/>
                                {t.pnl>=0?"Win":"Loss"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

//=========================================================================//
const MISSED_BLANK={
  id:null,date:toLocalISODate(),
  time:"",symbol:"MNQ",dir:"Long",
  entry:"",exit:"",sl:"",tp:"",
  reason:"",notes:"",
  screenshot_before:"",screenshot_after:"",
  potential_pnl:0,
};



export default EdgeAnalysis;

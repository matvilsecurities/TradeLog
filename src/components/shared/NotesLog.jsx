import { useRef } from "react";
import { V } from "../../constants.js";
function NotesLog({entries,onChange,s}) {
  const inputRefs=useRef([]);
  const addEntry=(afterIndex)=>{
    const now=new Date();
    const time=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const updated=[...entries];
    updated.splice(afterIndex+1,0,{id:Date.now(),time,text:""});
    onChange(updated);
    setTimeout(()=>inputRefs.current[afterIndex+1]?.focus(),0);
  };
  const updateEntry=(idx,field,value)=>onChange(entries.map((e,i)=>i===idx?{...e,[field]:value}:e));
  const removeEntry=(idx)=>{if(entries.length===1) return; onChange(entries.filter((_,i)=>i!==idx));};
  return (
    <div>
      {entries.map((entry,idx)=>(
        <div key={entry.id} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
          <span style={{fontSize:12,color:V.muted,minWidth:16}}>{idx+1}.</span>
          <input type="time" value={entry.time} onChange={e=>updateEntry(idx,"time",e.target.value)}
            style={{...s.inp,width:88,flexShrink:0,fontSize:12,padding:"6px 8px"}}/>
          <input ref={el=>inputRefs.current[idx]=el} value={entry.text}
            onChange={e=>updateEntry(idx,"text",e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addEntry(idx);}}}
            placeholder="Emotion, note, or observation..."
            style={{...s.inp,flex:1,fontSize:13,padding:"6px 10px"}}/>
          {entries.length>1&&<button onClick={()=>removeEntry(idx)}
            style={{background:"none",border:"none",cursor:"pointer",color:V.muted,fontSize:14,padding:"4px"}}>✕</button>}
        </div>
      ))}
      <button onClick={()=>addEntry(entries.length-1)}
        style={{marginTop:4,padding:"5px 12px",fontSize:11,background:"none",border:`0.5px dashed ${V.border}`,borderRadius:V.radius,cursor:"pointer",color:V.muted}}>
        + Add entry
      </button>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────


export default NotesLog;

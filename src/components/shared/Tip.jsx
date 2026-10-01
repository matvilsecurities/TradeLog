import { V, GRN, RED, fp } from "../../constants.js";
function Tip({active,payload,label}) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:V.bg,border:`0.5px solid ${V.border}`,borderRadius:V.radius,padding:"8px 12px",fontSize:12,color:V.text}}>
      <p style={{margin:0,color:V.muted}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{margin:"3px 0 0",fontWeight:500,color:typeof p.value==="number"?(p.value>=0?GRN:RED):V.text}}>
          {typeof p.value==="number"?fp(p.value):p.value}
        </p>
      ))}
    </div>
  );
}



export default Tip;

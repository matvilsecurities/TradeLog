import { V } from "../../constants.js";
function RadialGauge({pct,size=80,strokeWidth=8,color}) {
  const radius=size-strokeWidth/2;
  const circumference=2*Math.PI*radius;
  const clamped=Math.max(Math.min(pct,100),0);
  const offset=circumference-(clamped/100)*circumference;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={V.surface} strokeWidth={strokeWidth}/>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{transition:"stroke-dashoffset 0.6s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:size*0.24,fontWeight:700,color:V.text}}>{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}



export default RadialGauge;

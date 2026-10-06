import { GRN, RED } from "../../constants.js";
function Badge({dir}) {
  return <span style={{fontSize:10,padding:"2px 7px",borderRadius:3,background:dir==="Long"?"rgba(0,217,160,0.1)":"rgba(255,64,96,0.1)",color:dir==="Long"?GRN:RED,fontWeight:500}}>{dir}</span>;
}



export default Badge;

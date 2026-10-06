import { useState, useEffect, useRef } from "react";
import { signIn } from "../../supabase.js";
import matvilLogo from "../../assets/matvil-logo.png";
function LoginScreen() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [visible,setVisible]=useState(false);
  const shellRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleMouseMove = (e) => {
    if (!shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    shellRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    shellRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  const handle=async(e)=>{
    e.preventDefault();
    setLoading(true);setError("");
    try{
      await signIn(email,password);
    }catch(err){
      setError(err.message||"Login failed");
    }finally{setLoading(false);}
  };

  return (
    <div
      ref={shellRef}
      onMouseMove={handleMouseMove}
      className={`login-shell${visible ? " login-in" : ""}`}
    >
      <div className="login-blob login-blob-a" />
      <div className="login-blob login-blob-b" />
      <div className="login-blob login-blob-c" />
      <div className="login-cursor-glow" />

      <div className="login-card">
        <div className="login-header">
          <img src={matvilLogo} alt="Matvil Securities" className="login-logo-img" />
          <p className="login-title">TradeLog</p>
          <p className="login-sub">Matvil Securities · Admin Access</p>
        </div>

        <form onSubmit={handle} className="login-form">
          <div className="login-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={loading} className="login-btn">
            <span>{loading ? "Signing in…" : "Sign In"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
// // ── Main App ──────────────────────────────────────────────────


export default LoginScreen;

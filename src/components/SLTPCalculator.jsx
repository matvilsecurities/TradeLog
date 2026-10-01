import { useState, useEffect } from "react";
import { V, GRN, RED, AMBER, SYMBOLS } from "../constants.js";


function SLTPCalculator({ s }) {
  const [symbol, setSymbol] = useState("MNQ");
  const [dir, setDir] = useState("Long");
  const [entries, setEntries] = useState([{ price: "", qty: "1" }]);

  const [slPoints, setSlPoints] = useState("");
  const [slAmount, setSlAmount] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [slAnchor, setSlAnchor] = useState(null); // 'points' | 'amount' | 'price'

  const [tpPoints, setTpPoints] = useState("");
  const [tpAmount, setTpAmount] = useState("");
  const [tpPrice, setTpPrice] = useState("");
  const [tpAnchor, setTpAnchor] = useState(null);

  const pointValue = symbol === "MNQ" ? 2 : symbol === "MGC" ? 10 : 20;

  const validEntries = entries.filter(
    (e) => e.price !== "" && !isNaN(parseFloat(e.price)) && Number(e.qty) > 0
  );
  const totalQty = validEntries.reduce((sum, e) => sum + Number(e.qty), 0);
  const avgEntry =
    totalQty > 0
      ? validEntries.reduce((sum, e) => sum + parseFloat(e.price) * Number(e.qty), 0) / totalQty
      : 0;

  const fmt = (n) => (!isFinite(n) ? "" : String(Math.round(n * 100) / 100));

  // Recompute the two non-anchor SL fields whenever entries/symbol/direction
  // change — the anchor field itself is left completely untouched.
  useEffect(() => {
    if (!slAnchor || avgEntry <= 0) return;
    if (slAnchor === "price") {
      const price = parseFloat(slPrice);
      if (isNaN(price)) return;
      const pts = dir === "Long" ? avgEntry - price : price - avgEntry;
      setSlPoints(fmt(pts));
      if (totalQty > 0) setSlAmount(fmt(pts * pointValue * totalQty));
    } else if (slAnchor === "points") {
      const pts = parseFloat(slPoints);
      if (isNaN(pts)) return;
      setSlPrice(fmt(dir === "Long" ? avgEntry - pts : avgEntry + pts));
      if (totalQty > 0) setSlAmount(fmt(pts * pointValue * totalQty));
    } else if (slAnchor === "amount") {
      const amt = parseFloat(slAmount);
      if (isNaN(amt) || totalQty <= 0) return;
      const pts = amt / (pointValue * totalQty);
      setSlPoints(fmt(pts));
      setSlPrice(fmt(dir === "Long" ? avgEntry - pts : avgEntry + pts));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalQty, pointValue, avgEntry, dir]);

  useEffect(() => {
    if (!tpAnchor || avgEntry <= 0) return;
    if (tpAnchor === "price") {
      const price = parseFloat(tpPrice);
      if (isNaN(price)) return;
      const pts = dir === "Long" ? price - avgEntry : avgEntry - price;
      setTpPoints(fmt(pts));
      if (totalQty > 0) setTpAmount(fmt(pts * pointValue * totalQty));
    } else if (tpAnchor === "points") {
      const pts = parseFloat(tpPoints);
      if (isNaN(pts)) return;
      setTpPrice(fmt(dir === "Long" ? avgEntry + pts : avgEntry - pts));
      if (totalQty > 0) setTpAmount(fmt(pts * pointValue * totalQty));
    } else if (tpAnchor === "amount") {
      const amt = parseFloat(tpAmount);
      if (isNaN(amt) || totalQty <= 0) return;
      const pts = amt / (pointValue * totalQty);
      setTpPoints(fmt(pts));
      setTpPrice(fmt(dir === "Long" ? avgEntry + pts : avgEntry - pts));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalQty, pointValue, avgEntry, dir]);

  const updateSlPoints = (val) => {
    setSlAnchor("points");
    setSlPoints(val);
    const pts = parseFloat(val);
    if (val === "" || isNaN(pts)) { setSlAmount(""); setSlPrice(""); return; }
    if (totalQty > 0) setSlAmount(fmt(pts * pointValue * totalQty));
    if (avgEntry > 0) setSlPrice(fmt(dir === "Long" ? avgEntry - pts : avgEntry + pts));
  };
  const updateSlAmount = (val) => {
    setSlAnchor("amount");
    setSlAmount(val);
    const amt = parseFloat(val);
    if (val === "" || isNaN(amt)) { setSlPoints(""); setSlPrice(""); return; }
    if (totalQty > 0) {
      const pts = amt / (pointValue * totalQty);
      setSlPoints(fmt(pts));
      if (avgEntry > 0) setSlPrice(fmt(dir === "Long" ? avgEntry - pts : avgEntry + pts));
    }
  };
  const updateSlPrice = (val) => {
    setSlAnchor("price");
    setSlPrice(val);
    const price = parseFloat(val);
    if (val === "" || isNaN(price) || avgEntry <= 0) { setSlPoints(""); setSlAmount(""); return; }
    const pts = dir === "Long" ? avgEntry - price : price - avgEntry;
    setSlPoints(fmt(pts));
    if (totalQty > 0) setSlAmount(fmt(pts * pointValue * totalQty));
  };

  const updateTpPoints = (val) => {
    setTpAnchor("points");
    setTpPoints(val);
    const pts = parseFloat(val);
    if (val === "" || isNaN(pts)) { setTpAmount(""); setTpPrice(""); return; }
    if (totalQty > 0) setTpAmount(fmt(pts * pointValue * totalQty));
    if (avgEntry > 0) setTpPrice(fmt(dir === "Long" ? avgEntry + pts : avgEntry - pts));
  };
  const updateTpAmount = (val) => {
    setTpAnchor("amount");
    setTpAmount(val);
    const amt = parseFloat(val);
    if (val === "" || isNaN(amt)) { setTpPoints(""); setTpPrice(""); return; }
    if (totalQty > 0) {
      const pts = amt / (pointValue * totalQty);
      setTpPoints(fmt(pts));
      if (avgEntry > 0) setTpPrice(fmt(dir === "Long" ? avgEntry + pts : avgEntry - pts));
    }
  };
  const updateTpPrice = (val) => {
    setTpAnchor("price");
    setTpPrice(val);
    const price = parseFloat(val);
    if (val === "" || isNaN(price) || avgEntry <= 0) { setTpPoints(""); setTpAmount(""); return; }
    const pts = dir === "Long" ? price - avgEntry : avgEntry - price;
    setTpPoints(fmt(pts));
    if (totalQty > 0) setTpAmount(fmt(pts * pointValue * totalQty));
  };

  const addEntry = () => setEntries((prev) => [...prev, { price: "", qty: "1" }]);
  const removeEntry = (i) => setEntries((prev) => prev.filter((_, idx) => idx !== i));
  const updateEntry = (i, field, val) =>
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));

  const slPtsNum = parseFloat(slPoints) || 0;
  const tpPtsNum = parseFloat(tpPoints) || 0;
  const rr = slPtsNum > 0 ? (tpPtsNum / slPtsNum).toFixed(2) : null;
  const rrColor = rr === null ? V.muted : rr >= 2 ? GRN : rr >= 1 ? AMBER : RED;

  return (
    <div style={{ padding: "2rem", maxWidth: 640 }}>
      <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: V.text }}>
        SL / TP Calculator
      </p>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: V.muted }}>
        Work out your stop loss and take profit in points and dollars, across multiple entries.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", background: V.surface, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14 }}>
          {SYMBOLS.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
        </select>
        <button onClick={() => setDir("Long")}
          style={{ flex: 1, padding: "10px", borderRadius: V.radius, border: `0.5px solid ${dir === "Long" ? GRN : V.border}`, background: dir === "Long" ? `${GRN}18` : "transparent", color: dir === "Long" ? GRN : V.muted, fontWeight: 600, cursor: "pointer" }}>
          Long
        </button>
        <button onClick={() => setDir("Short")}
          style={{ flex: 1, padding: "10px", borderRadius: V.radius, border: `0.5px solid ${dir === "Short" ? RED : V.border}`, background: dir === "Short" ? `${RED}18` : "transparent", color: dir === "Short" ? RED : V.muted, fontWeight: 600, cursor: "pointer" }}>
          Short
        </button>
      </div>

      <div style={{ background: V.surface, border: `0.5px solid ${V.border}`, borderRadius: V.radiusLg, padding: "1.25rem", marginBottom: 20 }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: V.text }}>Entries</p>
        {entries.map((entry, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="number" placeholder="Price" value={entry.price}
              onChange={(e) => updateEntry(i, "price", e.target.value)}
              style={{ flex: 2, padding: "9px 12px", background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14 }} />
            <input type="number" placeholder="Qty" value={entry.qty}
              onChange={(e) => updateEntry(i, "qty", e.target.value)}
              style={{ flex: 1, padding: "9px 12px", background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14 }} />
            {entries.length > 1 && (
              <button onClick={() => removeEntry(i)}
                style={{ padding: "9px 12px", border: "none", background: "transparent", color: RED, cursor: "pointer", fontSize: 14 }}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button onClick={addEntry}
          style={{ marginTop: 6, padding: "8px 14px", border: `0.5px dashed ${V.border}`, background: "transparent", borderRadius: V.radius, color: V.muted, cursor: "pointer", fontSize: 13 }}>
          + Add entry
        </button>

        <div style={{ display: "flex", gap: 20, marginTop: 16, paddingTop: 16, borderTop: `0.5px solid ${V.border}` }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: V.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Entry</p>
            <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: V.text }}>{avgEntry ? avgEntry.toFixed(2) : "—"}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: V.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Qty</p>
            <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: V.text }}>{totalQty || "—"}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: V.surface, border: `0.5px solid ${RED}30`, borderRadius: V.radiusLg, padding: "1.25rem" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: RED }}>Stop Loss</p>
          <label style={{ display: "block", fontSize: 10, color: V.muted, marginBottom: 4, textTransform: "uppercase" }}>Points</label>
          <input type="number" value={slPoints} onChange={(e) => updateSlPoints(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", marginBottom: 10, background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14 }} />
          <label style={{ display: "block", fontSize: 10, color: V.muted, marginBottom: 4, textTransform: "uppercase" }}>Amount ($)</label>
          <input type="number" value={slAmount} onChange={(e) => updateSlAmount(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", marginBottom: 10, background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14 }} />
          <label style={{ display: "block", fontSize: 10, color: V.muted, marginBottom: 4, textTransform: "uppercase" }}>Price</label>
          <input type="number" value={slPrice} onChange={(e) => updateSlPrice(e.target.value)}
            disabled={!avgEntry}
            placeholder={avgEntry ? "" : "Add an entry first"}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14, opacity: avgEntry ? 1 : 0.5 }} />
        </div>

        <div style={{ background: V.surface, border: `0.5px solid ${GRN}30`, borderRadius: V.radiusLg, padding: "1.25rem" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: GRN }}>Take Profit</p>
          <label style={{ display: "block", fontSize: 10, color: V.muted, marginBottom: 4, textTransform: "uppercase" }}>Points</label>
          <input type="number" value={tpPoints} onChange={(e) => updateTpPoints(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", marginBottom: 10, background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14 }} />
          <label style={{ display: "block", fontSize: 10, color: V.muted, marginBottom: 4, textTransform: "uppercase" }}>Amount ($)</label>
          <input type="number" value={tpAmount} onChange={(e) => updateTpAmount(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", marginBottom: 10, background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14 }} />
          <label style={{ display: "block", fontSize: 10, color: V.muted, marginBottom: 4, textTransform: "uppercase" }}>Price</label>
          <input type="number" value={tpPrice} onChange={(e) => updateTpPrice(e.target.value)}
            disabled={!avgEntry}
            placeholder={avgEntry ? "" : "Add an entry first"}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: V.bg, border: `0.5px solid ${V.border}`, borderRadius: V.radius, color: V.text, fontSize: 14, opacity: avgEntry ? 1 : 0.5 }} />
        </div>
      </div>

      {rr !== null && (
        <div style={{ background: V.surface, border: `0.5px solid ${V.border}`, borderRadius: V.radiusLg, padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: V.muted }}>Risk : Reward</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: rrColor }}>1 : {rr}</span>
        </div>
      )}
    </div>
  );
}

export default SLTPCalculator;
import { useMemo, useState } from "react";
import { rowsToCsv } from "../../utils/csv.js";

function safeDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(rows) {
  return rowsToCsv(rows);
}

export default function DataCenter({ trades = [], missedTrades = [], apexSettings = null, accounts = [] }) {
  const [message, setMessage] = useState("");
  const [exportedAt, setExportedAt] = useState(null);

  const summary = useMemo(() => {
    const pnl = trades.reduce((sum, trade) => sum + (Number(trade.pnl ?? trade.profit_loss ?? 0) || 0), 0);
    const dates = trades.map((t) => t.trade_date || t.date || t.entry_time).filter(Boolean).map((v) => new Date(v)).filter((d) => !Number.isNaN(d.getTime()));
    return {
      trades: trades.length,
      missed: missedTrades.length,
      pnl,
      first: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
      last: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
    };
  }, [trades, missedTrades]);

  const exportJson = () => {
    const payload = {
      format: "TradeLog backup",
      version: 2,
      exported_at: new Date().toISOString(),
      accounts,
      trades,
      missed_trades: missedTrades,
      apex_settings: apexSettings,
    };
    downloadFile(`tradelog-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    setExportedAt(new Date());
    setMessage("Full JSON backup exported.");
  };

  const exportCsv = () => {
    const rows = trades.map((trade) => ({ ...trade, trade_date: safeDate(trade.trade_date || trade.date) }));
    downloadFile(`tradelog-trades-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    setExportedAt(new Date());
    setMessage("Trade CSV exported.");
  };

  const exportMissedCsv = () => {
    downloadFile(`tradelog-missed-trades-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(missedTrades), "text/csv;charset=utf-8");
    setExportedAt(new Date());
    setMessage("Missed-trade CSV exported.");
  };

  const printSummary = () => {
    window.print();
    setMessage("Print dialog opened.");
  };

  return (
    <section className="td-data-center" style={{ padding: "2rem", maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 12, color: "var(--td-muted, #8b929b)", textTransform: "uppercase", letterSpacing: ".08em" }}>Workspace / Data</div>
        <h1 style={{ margin: ".35rem 0 .4rem", fontSize: 28 }}>Data Center</h1>
        <p style={{ margin: 0, color: "var(--td-muted, #8b929b)" }}>Export accounts, journal history, missed trades and settings as an independent backup.</p>
      </header>

      <div className="td-data-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
        {[["Trades", summary.trades], ["Missed Trades", summary.missed], ["Net P&L", `$${summary.pnl.toFixed(2)}`], ["Last Trade", summary.last ? summary.last.toLocaleDateString() : "—"]].map(([label, value]) => (
          <div key={label} className="td-card" style={{ padding: 16, border: "1px solid var(--td-border, #2a2f35)", borderRadius: 12 }}><div style={{ fontSize: 12, color: "var(--td-muted, #8b929b)", textTransform: "uppercase" }}>{label}</div><strong style={{ display: "block", marginTop: 7, fontSize: 20 }}>{value}</strong></div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
        <div className="td-card" style={{ padding: 20, border: "1px solid var(--td-border, #2a2f35)", borderRadius: 14 }}>
          <h2 style={{ marginTop: 0 }}>Backup</h2>
          <p style={{ color: "var(--td-muted, #8b929b)" }}>JSON contains trades, missed trades and current Apex settings. It is a portable snapshot; it does not modify Supabase.</p>
          <button type="button" onClick={exportJson}>Export full JSON backup</button>
          {exportedAt && <small style={{ display: "block", marginTop: 10, color: "var(--td-muted, #8b929b)" }}>Last export: {exportedAt.toLocaleTimeString()}</small>}
        </div>
        <div className="td-card" style={{ padding: 20, border: "1px solid var(--td-border, #2a2f35)", borderRadius: 14 }}>
          <h2 style={{ marginTop: 0 }}>CSV exports</h2>
          <p style={{ color: "var(--td-muted, #8b929b)" }}>Use CSV when you want to analyze the journal in Excel, Google Sheets or another analytics tool.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={exportCsv}>Export trades CSV</button><button type="button" onClick={exportMissedCsv}>Export missed trades CSV</button></div>
        </div>
        <div className="td-card" style={{ padding: 20, border: "1px solid var(--td-border, #2a2f35)", borderRadius: 14 }}>
          <h2 style={{ marginTop: 0 }}>Report</h2>
          <p style={{ color: "var(--td-muted, #8b929b)" }}>Print the current Data Center summary for an offline record.</p>
          <button type="button" onClick={printSummary}>Print summary</button>
        </div>
        <div className="td-card" style={{ padding: 20, border: "1px solid var(--td-border, #2a2f35)", borderRadius: 14 }}>
          <h2 style={{ marginTop: 0 }}>Data integrity</h2>
          <p style={{ color: "var(--td-muted, #8b929b)" }}>Your cloud records remain the source of truth. This phase deliberately does not add destructive import/overwrite actions.</p>
          <div style={{ fontSize: 13 }}>Trade range: {summary.first ? summary.first.toLocaleDateString() : "—"} → {summary.last ? summary.last.toLocaleDateString() : "—"}</div>
        </div>
      </div>

      {message && <div role="status" style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid var(--td-border, #2a2f35)" }}>✓ {message}</div>}
    </section>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { SYNC_INTERVALS } from "../../services/sync/syncEngine.js";
import { useLiveComplianceMonitor } from "../../hooks/useLiveComplianceMonitor.js";
import { useAdvancedAccountIntelligence } from "../../hooks/useAdvancedAccountIntelligence.js";
import { runSecurityAudit } from "../../services/securityAudit.js";

const fmt = (value) => value ? new Date(value).toLocaleString() : "—";
const tone = (status) => status === "success" || status === "connected" || status === "clear" || status === "pass" ? "#53c99f" : status === "warning" ? "#e8b85b" : "#e26370";

export default function SyncCenter({ account, catalog = [], syncEngine, compliance, trades = [], settings = {}, stats = {}, s }) {
  const [auto, setAuto] = useState(false);
  const [interval, setIntervalMs] = useState(SYNC_INTERVALS.standard);
  const [audit, setAudit] = useState(() => runSecurityAudit({ localStorageKeys: Object.keys(localStorage || {}) }));
  const monitor = useLiveComplianceMonitor({ compliance, trades, settings });
  const intelligence = useAdvancedAccountIntelligence({ trades, stats, compliance, syncRuns: syncEngine.runs });

  useEffect(() => { syncEngine.configureAutoSync(auto, interval); return () => syncEngine.configureAutoSync(false); }, [auto, interval, syncEngine]);

  const connected = catalog.filter((item) => item.connection?.status === "connected").length;
  const summary = syncEngine.summary;
  const cards = useMemo(() => catalog.filter((item) => ["the5ers-blackarrow", "apex-tradovate", "apex-ninjatrader"].includes(item.id)), [catalog]);

  return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 22px" }}>
    <div style={{ marginBottom: 20 }}><div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: s?.muted || "#777" }}>Phase 27–31</div><h1 style={{ margin: "5px 0", color: s?.text || "inherit" }}>Live Operations Center</h1><p style={{ margin: 0, color: s?.muted || "#777", fontSize: 12 }}>Unified synchronization, event processing, compliance monitoring, account intelligence and production security.</p></div>

    <section style={{ ...s.card, marginBottom: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><b>Connector orchestration</b><div style={{ fontSize: 11, color: s.muted, marginTop: 4 }}>{connected} connected · {summary.total} sync runs · {summary.imported} trades imported</div></div><div style={{ display: "flex", gap: 8 }}><select value={interval} onChange={(e) => setIntervalMs(Number(e.target.value))} style={s.inp}><option value={30000}>30 sec</option><option value={60000}>1 min</option><option value={300000}>5 min</option></select><button type="button" onClick={() => setAuto((v) => !v)} style={{ ...s.inp, width: "auto", cursor: "pointer", background: auto ? "#53c99f" : s.surface, color: auto ? "#fff" : s.text }}>{auto ? "Auto Sync ON" : "Auto Sync OFF"}</button><button type="button" onClick={() => syncEngine.syncAll("manual")} disabled={syncEngine.running} style={{ ...s.inp, width: "auto", cursor: "pointer" }}>{syncEngine.running ? "Syncing…" : "Sync all"}</button></div></div></section>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 16 }}>{cards.map((item) => <section key={item.id} style={{ ...s.card, borderTop: `3px solid ${tone(item.connection?.status || "disconnected")}` }}><div style={{ display: "flex", justifyContent: "space-between" }}><b>{item.name}</b><span style={{ color: tone(item.connection?.status || "disconnected"), fontSize: 9, fontWeight: 800 }}>{String(item.connection?.status || "NOT CONFIGURED").toUpperCase()}</span></div><div style={{ marginTop: 10, fontSize: 11, color: s.muted }}>Account: {account?.name || "—"}</div><div style={{ marginTop: 4, fontSize: 11, color: s.muted }}>Last sync: {fmt(item.connection?.lastSyncAt)}</div></section>)}</div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginBottom: 16 }}><Metric label="Compliance" value={monitor.status.toUpperCase()} tone={tone(monitor.status)} /><Metric label="Expectancy" value={Number(intelligence.expectancy).toFixed(2)} tone={intelligence.expectancy >= 0 ? "#53c99f" : "#e26370"} /><Metric label="Process efficiency" value={`${intelligence.processEfficiency.toFixed(0)}%`} tone="#53c99f" /><Metric label="Recovery factor" value={Number.isFinite(intelligence.recoveryFactor) ? intelligence.recoveryFactor.toFixed(2) : "∞"} tone={intelligence.recoveryFactor >= 0 ? "#53c99f" : "#e26370"} /></div>

    <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 12 }}><section style={s.card}><b>Sync history</b><div style={{ marginTop: 10, display: "grid", gap: 7 }}>{syncEngine.runs.slice(0, 10).map((run, i) => <div key={`${run.connectorId}-${run.startedAt}-${i}`} style={{ padding: 9, border: `1px solid ${s.border}`, borderRadius: 8, display: "flex", justifyContent: "space-between", gap: 10 }}><div><b style={{ fontSize: 11 }}>{run.connectorId}</b><div style={{ fontSize: 10, color: s.muted }}>{fmt(run.completedAt)} · {run.mode}</div></div><div style={{ textAlign: "right", fontSize: 10 }}><div style={{ color: tone(run.status), fontWeight: 800 }}>{run.status.toUpperCase()}</div><div>{run.importedCount || 0} imported · {run.skippedCount || 0} skipped</div></div></div>)}{!syncEngine.runs.length && <div style={{ color: s.muted, fontSize: 11 }}>No synchronization runs yet.</div>}</div></section>
      <section style={s.card}><b>Compliance monitor</b><div style={{ marginTop: 10 }}>{monitor.alerts.length ? monitor.alerts.map((alert) => <div key={alert.code} style={{ padding: 9, marginBottom: 7, borderRadius: 8, background: `${tone(alert.severity)}15`, color: tone(alert.severity), fontSize: 10 }}>{alert.message}</div>) : <div style={{ color: "#53c99f", fontSize: 11 }}>No active threshold alerts.</div>}</div><hr style={{ border: 0, borderTop: `1px solid ${s.border}`, margin: "14px 0" }} /><b>Security posture</b><div style={{ marginTop: 7, color: tone(audit.status), fontSize: 11 }}>{audit.status === "pass" ? "No critical client-side secret findings." : `${audit.critical} critical finding(s).`}</div><button type="button" onClick={() => setAudit(runSecurityAudit({ localStorageKeys: Object.keys(localStorage || {}) }))} style={{ ...s.inp, marginTop: 10, cursor: "pointer" }}>Run security audit</button></section></div>
  </div>;
}
function Metric({ label, value, tone: color }) { return <div style={{ padding: 14, borderRadius: 10, background: "rgba(128,128,128,.06)" }}><div style={{ fontSize: 9, opacity: .65, textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color }}>{value}</div></div>; }

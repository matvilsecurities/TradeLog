import { V, GRN, RED, AMBER, BLU } from "../../constants.js";
import { usePropFirmCompliance } from "../../hooks/usePropFirmCompliance.js";

const colorFor = (severity) => severity === "critical" ? RED : severity === "warning" ? AMBER : BLU;
const labelFor = (severity) => severity === "critical" ? "CRITICAL" : severity === "warning" ? "WARNING" : "NOTICE";

export default function ComplianceAlerts({ trades = [], settings = {}, s, userId, alertState = null }) {
  const compliance = usePropFirmCompliance(trades, settings);
  const alerts = alertState;
  const card = { ...s.card, minWidth: 0 };
  const visibleHistory = alerts.history.slice(0, 40);

  const toggleBrowser = async () => {
    if (!alerts.preferences.browserNotifications) await alerts.requestBrowserNotifications();
    else alerts.updatePreferences({ browserNotifications: false });
  };

  return <div style={{ padding: "1.25rem", maxWidth: 1180, overflowY: "auto", maxHeight: "100vh" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
      <div>
        <p style={{ margin: 0, fontSize: 21, fontWeight: 700, color: V.text }}>Account Alerts</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: V.muted }}>{compliance.firm && compliance.program ? `${compliance.firm} · ${compliance.program}` : "Live prop-firm compliance monitoring"}</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => alerts.updatePreferences({ enabled: !alerts.preferences.enabled })} style={{ ...buttonStyle(V), color: alerts.preferences.enabled ? GRN : V.muted }}>{alerts.preferences.enabled ? "Monitoring ON" : "Monitoring OFF"}</button>
        <button type="button" onClick={toggleBrowser} style={{ ...buttonStyle(V), color: alerts.preferences.browserNotifications ? BLU : V.muted }}>{alerts.preferences.browserNotifications ? "Browser alerts ON" : "Browser alerts"}</button>
      </div>
    </header>

    {!compliance.hasRules ? <div style={{ ...card, borderColor: `${AMBER}55`, color: AMBER, fontSize: 12 }}>Select and apply a versioned prop-firm program in <b>Prop Firm Setup</b> to activate monitoring.</div> : <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        <Summary card={card} label="Live status" value={alerts.activeAlerts.length ? `${alerts.activeAlerts.length} active` : "Healthy"} color={alerts.activeAlerts.some(a => a.severity === "critical") ? RED : alerts.activeAlerts.length ? AMBER : GRN} />
        <Summary card={card} label="Daily loss buffer" value={money(compliance.dailyLossRemaining)} color={compliance.dailyLossRemaining != null && compliance.dailyLossRemaining < 0 ? RED : V.text} />
        <Summary card={card} label="Drawdown buffer" value={money(compliance.drawdownRemaining)} color={compliance.drawdownRemaining != null && compliance.drawdownRemaining < 0 ? RED : V.text} />
        <Summary card={card} label="Alert history" value={String(alerts.history.length)} color={V.text} />
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: V.text }}>Current alerts</p><p style={{ margin: "3px 0 0", fontSize: 10, color: V.muted }}>Monitoring runs while the journal is open. Browser alerts require permission.</p></div>
          {alerts.history.length > 0 && <button type="button" onClick={alerts.clearHistory} style={{ ...buttonStyle(V), color: V.muted }}>Clear history</button>}
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {alerts.liveAlerts.length === 0 && <div style={{ padding: 16, borderRadius: V.radius, background: `${GRN}08`, border: `1px solid ${GRN}33`, color: GRN, fontSize: 12 }}>No current compliance alerts.</div>}
          {alerts.liveAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} acknowledged={alerts.history.some(x => x.id === alert.id && x.acknowledgedAt)} onAcknowledge={alerts.acknowledge} />)}
        </div>
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: V.text }}>Alert history</p>
        <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
          {visibleHistory.length === 0 && <span style={{ fontSize: 11, color: V.muted }}>No alerts recorded yet.</span>}
          {visibleHistory.map((alert) => <div key={alert.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 10px", borderRadius: V.radius, background: V.bg, border: `1px solid ${V.border}`, opacity: alert.acknowledgedAt ? .65 : 1 }}><div><b style={{ fontSize: 10, color: colorFor(alert.severity) }}>{labelFor(alert.severity)} · {alert.title}</b><div style={{ marginTop: 2, fontSize: 10, color: V.muted }}>{alert.detail}</div></div><time style={{ fontSize: 9, color: V.muted, whiteSpace: "nowrap" }}>{new Date(alert.createdAt).toLocaleString()}</time></div>)}
        </div>
      </div>
    </>}
  </div>;
}

function Summary({ card, label, value, color }) {
  return <div style={card}><div style={{ fontSize: 10, color: V.muted, textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 6, fontSize: 21, fontWeight: 700, color }}>{value}</div></div>;
}
function AlertRow({ alert, acknowledged, onAcknowledge }) {
  const color = colorFor(alert.severity);
  return <div style={{ padding: "10px 12px", borderRadius: V.radius, background: `${color}09`, border: `1px solid ${color}44`, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><b style={{ fontSize: 10, color }}>{labelFor(alert.severity)} · {alert.title}</b><div style={{ marginTop: 3, fontSize: 11, color: V.muted }}>{alert.detail}</div></div>{!acknowledged && <button type="button" onClick={() => onAcknowledge(alert.id)} style={{ ...buttonStyle(V), color: V.text }}>Acknowledge</button>}</div>;
}
function buttonStyle() { return { padding: "7px 10px", borderRadius: 8, border: `1px solid ${V.border}`, background: V.surface, fontSize: 10, fontWeight: 600, cursor: "pointer" }; }
function money(v) { return Number.isFinite(Number(v)) ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"; }

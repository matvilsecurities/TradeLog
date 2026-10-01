import { useMemo, useRef, useState } from "react";
import { V, GRN, RED, AMBER, BLU } from "../../constants.js";
import { CONNECTOR_STATUS } from "../../services/connectorRegistry.js";
import { normalizeBlackArrowPayload } from "../../services/connectors/blackArrow.js";

const fmtTime = (value) => value ? new Date(value).toLocaleString() : "Never";

function button(background = "transparent", color = V.text) {
  return { border: `1px solid ${V.border}`, background, color, borderRadius: V.radius, padding: "8px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 };
}

export default function ConnectorCenter({ account, accountId, catalog = [], updateConnection, disconnect, markSync, onImportTrades, tradovateConnector, ninjaTraderConnector, s }) {
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const blackArrow = useMemo(() => catalog.find((item) => item.id === "the5ers-blackarrow"), [catalog]);
  const blackArrowConnection = blackArrow?.connection || {};
  const tradovate = catalog.find((item) => item.id === "apex-tradovate");
  const tradovateConnection = tradovate?.connection || {};

  const saveConfig = () => {
    updateConnection("the5ers-blackarrow", { bridgeUrl: bridgeUrl.trim(), status: bridgeUrl.trim() ? "ready" : CONNECTOR_STATUS.NEEDS_ACCESS });
    setMessage({ tone: "success", text: bridgeUrl.trim() ? "BlackArrow bridge endpoint saved." : "Bridge endpoint cleared." });
  };

  const testBridge = async () => {
    const url = String(bridgeUrl || blackArrowConnection.bridgeUrl || "").trim();
    if (!url) { setMessage({ tone: "error", text: "Add the approved/local bridge URL first." }); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/health`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Bridge returned HTTP ${response.status}`);
      markSync("the5ers-blackarrow", { ok: true, count: 0, message: "Bridge is reachable." });
      setMessage({ tone: "success", text: "BlackArrow bridge is reachable." });
    } catch (error) {
      markSync("the5ers-blackarrow", { ok: false, error: error.message, message: "Bridge test failed." });
      setMessage({ tone: "error", text: error.message || "Unable to reach bridge." });
    } finally { setBusy(false); }
  };

  const syncBridge = async () => {
    const url = String(bridgeUrl || blackArrowConnection.bridgeUrl || "").trim();
    if (!url) { setMessage({ tone: "error", text: "Add the approved/local bridge URL first." }); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/snapshot`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Bridge returned HTTP ${response.status}`);
      const payload = await response.json();
      const normalized = normalizeBlackArrowPayload(payload, accountId);
      const result = await onImportTrades(normalized, { source: "BlackArrow", connectorId: "the5ers-blackarrow", mode: "bridge" });
      markSync("the5ers-blackarrow", { ok: true, count: result.count, message: `${result.count} trade${result.count === 1 ? "" : "s"} synchronized.` });
      setMessage({ tone: "success", text: `${result.count} BlackArrow trade${result.count === 1 ? "" : "s"} synchronized.` });
    } catch (error) {
      markSync("the5ers-blackarrow", { ok: false, error: error.message, message: "Sync failed." });
      setMessage({ tone: "error", text: error.message || "Unable to synchronize BlackArrow." });
    } finally { setBusy(false); }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setMessage(null);
    try {
      const text = await file.text();
      let payload;
      if (/\.json$/i.test(file.name)) payload = JSON.parse(text);
      else {
        const [header, ...rows] = text.split(/\r?\n/).filter(Boolean);
        const columns = header.split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, ""));
        payload = rows.map((line) => {
          const values = line.split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, ""));
          return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""]));
        });
      }
      const normalized = normalizeBlackArrowPayload(payload, accountId);
      if (!normalized.length) throw new Error("No recognizable BlackArrow trades were found in this file.");
      const result = await onImportTrades(normalized, { source: "BlackArrow", connectorId: "the5ers-blackarrow", mode: "file", fileName: file.name });
      markSync("the5ers-blackarrow", { ok: true, count: result.count, message: `${result.count} imported from ${file.name}.` });
      setMessage({ tone: "success", text: `${result.count} BlackArrow trade${result.count === 1 ? "" : "s"} imported.` });
    } catch (error) {
      markSync("the5ers-blackarrow", { ok: false, error: error.message, message: "Import failed." });
      setMessage({ tone: "error", text: error.message || "Unable to import trades." });
    } finally { setBusy(false); }
  };

  const tradovateStatus = tradovateConnector?.connected ? "CONNECTED" : tradovateConnector?.status === "authorizing" ? "AUTHORIZING" : tradovateConnection.status === "error" ? "ERROR" : "OAUTH READY";
  const tradovateColor = tradovateConnector?.connected ? GRN : tradovateConnector?.status === "error" || tradovateConnection.status === "error" ? RED : BLU;

  return <div style={{ padding: "1.25rem", maxWidth: 1180, overflowY: "auto", maxHeight: "100vh" }}>
    <header style={{ marginBottom: 18 }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: V.text }}>Broker & Prop-Firm Connections</p>
      <p style={{ margin: "5px 0 0", fontSize: 12, color: V.muted }}>Read-only synchronization into the active TradeLog account. No external order placement is enabled in this phase.</p>
    </header>

    {message && <div style={{ ...s.card, marginBottom: 14, borderColor: message.tone === "error" ? `${RED}66` : `${GRN}66`, color: message.tone === "error" ? RED : GRN, fontSize: 12 }}>{message.text}</div>}

    <section style={{ ...s.card, borderColor: `${BLU}66`, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div><p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: V.text }}>Apex · Tradovate</p><p style={{ margin: "4px 0 0", fontSize: 11, color: V.muted }}>{account?.name || "Active account"} · Official NinjaTrader Trade API · Read-only</p></div>
        <span style={{ padding: "5px 8px", borderRadius: 999, background: `${tradovateColor}18`, color: tradovateColor, fontSize: 9, fontWeight: 800 }}>{tradovateStatus}</span>
      </div>
      <div style={{ marginTop: 14, padding: 12, background: V.bg, border: `1px solid ${V.border}`, borderRadius: V.radius }}>
        <p style={{ margin: 0, fontSize: 11, color: V.text, fontWeight: 700 }}>Secure OAuth connection</p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: V.muted, lineHeight: 1.55 }}>TradeLog never asks for or stores your Tradovate password. You authenticate directly on the NinjaTrader/Tradovate page. The short-lived access token stays in this browser session memory only.</p>
      </div>
      {tradovateConnector?.error && <div style={{ marginTop: 10, color: RED, fontSize: 11 }}>{tradovateConnector.error}</div>}
      {tradovateConnector?.connected && <div style={{ marginTop: 12 }}>
        <label style={s.ilbl}>Tradovate account to map into this TradeLog account</label>
        <select value={tradovateConnector.selectedExternalAccountId || ""} onChange={(e) => tradovateConnector.setSelectedExternalAccountId(e.target.value)} style={s.inp}>
          <option value="">{tradovateConnector.availableAccounts?.length > 1 ? "Select external account…" : "Loading accounts…"}</option>
          {(tradovateConnector.availableAccounts || []).map((item) => <option key={item.id} value={item.id}>{item.name || `Account ${item.id}`} · ID {item.id}</option>)}
        </select>
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
        {!tradovateConnector?.connected ? <button type="button" onClick={tradovateConnector?.connect} disabled={tradovateConnector?.status === "authorizing"} style={button(BLU, "#fff")}>{tradovateConnector?.status === "authorizing" ? "Waiting for authorization…" : "Connect with Tradovate"}</button> : <>
          <button type="button" onClick={tradovateConnector.loadAccounts} style={button()}>↻ Refresh accounts</button>
          <button type="button" onClick={tradovateConnector.sync} disabled={tradovateConnector.availableAccounts?.length > 1 && !tradovateConnector.selectedExternalAccountId} style={button(GRN, "#fff")}>↻ Sync Trades & Account</button>
        </>}
        {tradovateConnector?.connected && <button type="button" onClick={tradovateConnector.disconnect} style={button("transparent", RED)}>Disconnect</button>}
      </div>
      {tradovateConnector?.snapshot && <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
        <Meta label="Accounts" value={tradovateConnector.snapshot.accounts.length} />
        <Meta label="Positions" value={tradovateConnector.snapshot.positions.length} />
        <Meta label="Completed trades" value={tradovateConnector.snapshot.tradeCount} />
        <Meta label="Last sync" value={fmtTime(tradovateConnector.snapshot.syncedAt)} />
      </div>}
      <p style={{ margin: "10px 0 0", fontSize: 10, color: V.muted }}>Environment: <b>{tradovateConnector?.config?.mode || "live"}</b>. The connector reads accounts, orders, fills, positions, cash balances and contract metadata. It does not submit orders.</p>
    </section>

    <section style={{ ...s.card, borderColor: `${GRN}66`, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div><p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: V.text }}>Apex · NinjaTrader</p><p style={{ margin: "4px 0 0", fontSize: 11, color: V.muted }}>{account?.name || "Active account"} · Official NinjaTrader Trade API · Read-only</p></div>
        <span style={{ padding: "5px 8px", borderRadius: 999, background: `${ninjaTraderConnector?.connected ? GRN : ninjaTraderConnector?.status === "authorizing" ? BLU : ninjaTraderConnector?.status === "error" ? RED : AMBER}18`, color: ninjaTraderConnector?.connected ? GRN : ninjaTraderConnector?.status === "authorizing" ? BLU : ninjaTraderConnector?.status === "error" ? RED : AMBER, fontSize: 9, fontWeight: 800 }}>{ninjaTraderConnector?.connected ? "CONNECTED" : ninjaTraderConnector?.status === "authorizing" ? "AUTHORIZING" : ninjaTraderConnector?.status === "error" ? "ERROR" : "OAUTH READY"}</span>
      </div>
      <div style={{ marginTop: 14, padding: 12, background: V.bg, border: `1px solid ${V.border}`, borderRadius: V.radius }}>
        <p style={{ margin: 0, fontSize: 11, color: V.text, fontWeight: 700 }}>NinjaTrader OAuth + read-only account sync</p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: V.muted, lineHeight: 1.55 }}>Authenticate directly with NinjaTrader. TradeLog reads account, order, fill, position, cash-balance and contract data only. No order placement or account mutation is enabled.</p>
      </div>
      {ninjaTraderConnector?.error && <div style={{ marginTop: 10, color: RED, fontSize: 11 }}>{ninjaTraderConnector.error}</div>}
      {ninjaTraderConnector?.connected && <div style={{ marginTop: 12 }}>
        <label style={s.ilbl}>NinjaTrader account to map into this TradeLog account</label>
        <select value={ninjaTraderConnector.selectedExternalAccountId || ""} onChange={(e) => ninjaTraderConnector.setSelectedExternalAccountId(e.target.value)} style={s.inp}>
          <option value="">{ninjaTraderConnector.availableAccounts?.length > 1 ? "Select external account…" : "Loading accounts…"}</option>
          {(ninjaTraderConnector.availableAccounts || []).map((item) => <option key={item.id} value={item.id}>{item.name || `Account ${item.id}`} · ID {item.id}</option>)}
        </select>
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
        {!ninjaTraderConnector?.connected ? <button type="button" onClick={ninjaTraderConnector?.connect} disabled={ninjaTraderConnector?.status === "authorizing"} style={button(GRN, "#fff")}>{ninjaTraderConnector?.status === "authorizing" ? "Waiting for authorization…" : "Connect with NinjaTrader"}</button> : <>
          <button type="button" onClick={ninjaTraderConnector.loadAccounts} style={button()}>↻ Refresh accounts</button>
          <button type="button" onClick={ninjaTraderConnector.sync} disabled={ninjaTraderConnector.availableAccounts?.length > 1 && !ninjaTraderConnector.selectedExternalAccountId} style={button(GRN, "#fff")}>↻ Sync Trades & Account</button>
        </>}
        {ninjaTraderConnector?.connected && <button type="button" onClick={ninjaTraderConnector.disconnect} style={button("transparent", RED)}>Disconnect</button>}
      </div>
      {ninjaTraderConnector?.snapshot && <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
        <Meta label="Accounts" value={ninjaTraderConnector.snapshot.accounts.length} />
        <Meta label="Positions" value={ninjaTraderConnector.snapshot.positions.length} />
        <Meta label="Completed trades" value={ninjaTraderConnector.snapshot.tradeCount} />
        <Meta label="Last sync" value={fmtTime(ninjaTraderConnector.snapshot.syncedAt)} />
      </div>}
      <p style={{ margin: "10px 0 0", fontSize: 10, color: V.muted }}>Environment: <b>{ninjaTraderConnector?.config?.mode || "live"}</b>. Uses the official NinjaTrader Trade API with a separate TradeLog connector identity and account mapping.</p>
    </section>

    <section style={{ ...s.card, borderColor: `${BLU}44`, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div><p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: V.text }}>The5ers · BlackArrow</p><p style={{ margin: "4px 0 0", fontSize: 11, color: V.muted }}>{account?.name || "Active account"} · Read-only bridge/import connector</p></div>
        <span style={{ padding: "5px 8px", borderRadius: 999, background: `${(blackArrowConnection.status === "connected" ? GRN : blackArrowConnection.status === "error" ? RED : AMBER)}18`, color: blackArrowConnection.status === "connected" ? GRN : blackArrowConnection.status === "error" ? RED : AMBER, fontSize: 9, fontWeight: 800 }}>{blackArrowConnection.status === "connected" ? "CONNECTED" : blackArrowConnection.status === "ready" ? "READY" : "BRIDGE NEEDED"}</span>
      </div>
      <div style={{ marginTop: 14, padding: 12, background: V.bg, border: `1px solid ${V.border}`, borderRadius: V.radius }}>
        <p style={{ margin: 0, fontSize: 11, color: V.text, fontWeight: 700 }}>BlackArrow API limitation remains explicit</p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: V.muted, lineHeight: 1.55 }}>{blackArrow?.note}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 9, alignItems: "end", marginTop: 14 }}>
        <div><label style={s.ilbl}>Approved / local bridge URL</label><input value={bridgeUrl || blackArrowConnection.bridgeUrl || ""} onChange={(e) => setBridgeUrl(e.target.value)} placeholder="http://127.0.0.1:8787" style={s.inp} /></div>
        <button type="button" onClick={saveConfig} style={button(BLU, "#fff")}>Save</button>
        <button type="button" onClick={testBridge} disabled={busy} style={button()}>{busy ? "Working…" : "Test"}</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" onClick={syncBridge} disabled={busy} style={button(GRN, "#fff")}>{busy ? "Syncing…" : "↻ Sync from bridge"}</button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} style={button()}>⇧ Import JSON / CSV</button>
        <button type="button" onClick={() => { disconnect("the5ers-blackarrow"); setMessage({ tone: "success", text: "BlackArrow connector disconnected." }); }} style={button("transparent", RED)}>Disconnect</button>
        <input ref={inputRef} type="file" accept=".json,.csv,application/json,text/csv" onChange={importFile} style={{ display: "none" }} />
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
        <Meta label="Last sync" value={fmtTime(blackArrowConnection.lastSyncAt)} />
        <Meta label="Last result" value={blackArrowConnection.lastSyncMessage || "—"} />
        <Meta label="Records" value={blackArrowConnection.lastSyncCount ?? 0} />
      </div>
    </section>

    <div style={{ display: "grid", gap: 10 }}>
      {catalog.filter((item) => !["the5ers-blackarrow", "apex-tradovate", "apex-ninjatrader"].includes(item.id)).map((item) => <div key={item.id} style={{ ...s.card, opacity: .72 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}><div><b style={{ fontSize: 13, color: V.text }}>{item.name}</b><p style={{ margin: "4px 0 0", fontSize: 10, color: V.muted }}>{item.note}</p></div><span style={{ fontSize: 9, color: V.muted, fontWeight: 800 }}>NEXT CONNECTOR</span></div>
      </div>)}
    </div>
  </div>;
}

function Meta({ label, value }) {
  return <div style={{ padding: 9, background: "rgba(128,128,128,.06)", borderRadius: 8 }}><div style={{ fontSize: 9, opacity: .65, textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(value)}</div></div>;
}

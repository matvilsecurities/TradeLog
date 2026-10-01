import http from 'node:http';
import crypto from 'node:crypto';

const HOST = process.env.TRADELOG_BRIDGE_HOST || '127.0.0.1';
const PORT = Number(process.env.TRADELOG_BRIDGE_PORT || 4815);
const clients = new Set();
const state = { updatedAt: null, accounts: [], orders: [], fills: [], positions: [], cashBalances: [], contracts: [] };

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(body);
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}
function wsAccept(key) { return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64'); }
function frame(text) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, payload.length]);
  else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
  return Buffer.concat([header, payload]);
}
function broadcast(payload) {
  const packet = frame(JSON.stringify(payload));
  for (const socket of clients) {
    try { socket.write(packet); } catch { clients.delete(socket); }
  }
}
function mergeSnapshot(payload) {
  for (const key of ['accounts','orders','fills','positions','cashBalances','contracts']) {
    if (Array.isArray(payload[key])) state[key] = payload[key];
  }
  state.updatedAt = new Date().toISOString();
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, service: 'tradelog-nt8-bridge', version: '1.0.0', updatedAt: state.updatedAt, clients: clients.size });
  if (req.method === 'GET' && url.pathname === '/snapshot') return json(res, 200, state);
  if (req.method === 'GET' && url.pathname === '/events') return json(res, 426, { ok: false, message: 'Upgrade this request to WebSocket.' });
  if (req.method === 'POST' && url.pathname === '/ingest') {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 2_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(raw || '{}');
        mergeSnapshot(payload.snapshot || payload);
        const events = Array.isArray(payload.events) ? payload.events : (payload.event ? [payload.event] : []);
        for (const event of events) broadcast(event);
        json(res, 200, { ok: true, accepted: events.length, updatedAt: state.updatedAt });
      } catch (error) { json(res, 400, { ok: false, error: error.message }); }
    });
    return;
  }
  return json(res, 404, { ok: false, error: 'Not found' });
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname !== '/events' || req.headers.upgrade?.toLowerCase() !== 'websocket') return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${wsAccept(key)}\r\n\r\n`);
  clients.add(socket);
  socket.write(frame(JSON.stringify({ eventId: `bridge:connected:${Date.now()}`, connectorId: 'apex-ninjatrader', type: 'system', timestamp: new Date().toISOString(), payload: { message: 'TradeLog bridge connected.' } })));
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
  socket.on('data', () => {});
});

server.listen(PORT, HOST, () => console.log(`TradeLog NT8 bridge listening on http://${HOST}:${PORT}`));

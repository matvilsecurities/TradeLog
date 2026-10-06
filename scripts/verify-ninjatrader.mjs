import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/services/connectors/ninjaTrader.js',
  'src/hooks/useNinjaTraderConnector.js',
  'src/components/apex/ConnectorCenter.jsx',
  'src/services/connectors/tradovate.js',
  'netlify/functions/tradovate-oauth-callback.js',
  'PHASE26_NINJATRADER_CONNECTOR.md',
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing required files: ${missing.join(', ')}`);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const service = read('src/services/connectors/ninjaTrader.js');
const hook = read('src/hooks/useNinjaTraderConnector.js');
const ui = read('src/components/apex/ConnectorCenter.jsx');
const tradovate = read('src/services/connectors/tradovate.js');
const callback = read('netlify/functions/tradovate-oauth-callback.js');
const registry = read('src/services/connectorRegistry.js');
const app = read('src/App.jsx');
const checks = [
  ['Dedicated NinjaTrader connector identity', service.includes('apex-ninjatrader') && service.includes('NinjaTrader')],
  ['Official OAuth reuse', hook.includes('buildTradovateAuthorizeUrl') && callback.includes('authorization_code')],
  ['Dynamic API host resolution', hook.includes('apiHosts') && hook.includes('hostFromAuth')],
  ['Account discovery', hook.includes('account/list')],
  ['Orders and fills', hook.includes('order/list') && hook.includes('fill/list')],
  ['Positions and cash balances', hook.includes('position/list') && hook.includes('cashBalance/list')],
  ['Contract metadata', hook.includes('contract/list')],
  ['External account mapping', hook.includes('selectedExternalAccountId') && ui.includes('NinjaTrader account to map')],
  ['NinjaTrader import metadata', hook.includes('connectorId: NINJATRADER_CONNECTOR_ID') && hook.includes('source: \'NinjaTrader\'')],
  ['Durable dedupe path', app.includes('fetchExistingExternalTradeIdsDb') && app.includes('meta.connectorId')],
  ['Read-only safety', !hook.includes('placeorder') && !hook.includes('cancelorder') && ui.includes('No order placement')],
  ['No browser credential storage', !hook.includes('localStorage') && !hook.includes('sessionStorage')],
  ['FIFO normalization reused', service.includes('normalizeTradovateFills') && tradovate.includes('while (remaining > 0')],
  ['MNQ/MGC normalization', tradovate.includes('MNQ: 2') && tradovate.includes('MGC: 10')],
  ['Separate UI card', ui.includes('Apex · NinjaTrader') && app.includes('ninjaTraderConnector')],
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`NinjaTrader QA failed: ${failed.join('; ')}`);
console.log(`NinjaTrader QA passed: ${required.length} required files present; ${checks.length} connector checks passed.`);

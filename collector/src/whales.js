// Hyperliquid whale tracker (2026-08-22, Coinglass independence phase D).
// Hyperliquid IS the primary source — positions live on-chain and the public info API serves them;
// the aggregator we used to pay resold exactly this. Two feeds:
//   positions: biggest open perp positions (>= $1M) across the leaderboard's top accounts
//   alerts:    position changes between polls (opened / closed / flipped / grew or shrank >= 25%)
// Leaderboard refresh is hourly (the file is ~36MB); position polls run every 4 minutes over the
// tracked set, sequential with a small gap so we stay far under the info-API rate weight.
import { log } from './logger.js';

const LEADERBOARD_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const INFO_URL = 'https://api.hyperliquid.xyz/info';
const TRACK_N = 150;        // top accounts by account value we keep an eye on
const MIN_POS_USD = 1e6;    // a "whale position" starts at $1M notional
const TOP_POSITIONS = 40;   // what we publish
const ALERT_DELTA = 0.25;   // size change that counts as an alert
const MAX_ALERTS = 60;

const state = { tracked: [], positions: [], alerts: [], ts: 0, lbTs: 0, lastErr: '' };
let prevByKey = null; // "user|coin" -> {val, long} from the previous poll (null on first run = no alerts)
let timers = [];

async function post(body, timeoutMs = 12000) {
  const r = await fetch(INFO_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error('info ' + r.status);
  return r.json();
}

async function refreshLeaderboard() {
  try {
    const r = await fetch(LEADERBOARD_URL, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('lb ' + r.status);
    const j = await r.json();
    const rows = Array.isArray(j.leaderboardRows) ? j.leaderboardRows : [];
    if (rows.length < 1000) throw new Error('lb too small: ' + rows.length);
    state.tracked = rows
      .map(x => ({ a: String(x.ethAddress || ''), v: +x.accountValue || 0 }))
      .filter(x => /^0x[0-9a-fA-F]{40}$/.test(x.a) && x.v > 0)
      .sort((p, q) => q.v - p.v)
      .slice(0, TRACK_N)
      .map(x => x.a);
    state.lbTs = Date.now();
    log.info('[whales] leaderboard refreshed', { tracked: state.tracked.length });
  } catch (e) { state.lastErr = 'lb: ' + String(e).slice(0, 120); log.warn('[whales] leaderboard failed', { e: String(e).slice(0, 160) }); }
}

async function poll() {
  if (!state.tracked.length) return;
  try {
    let mids = {};
    try { mids = await post({ type: 'allMids' }); } catch (e) { mids = {}; }
    const found = [];
    for (const user of state.tracked) {
      try {
        const st = await post({ type: 'clearinghouseState', user });
        for (const ap of (st.assetPositions || [])) {
          const p = ap.position || {};
          const val = Math.abs(+p.positionValue || 0);
          if (val < MIN_POS_USD) continue;
          const szi = +p.szi || 0;
          if (!szi) continue;
          found.push({
            user, sym: String(p.coin || ''), long: szi > 0,
            lev: +((p.leverage || {}).value) || null,
            val: Math.round(val),
            liq: +p.liquidationPx || null,
            mark: +mids[p.coin] || null,
            pnl: Math.round(+p.unrealizedPnl || 0),
          });
        }
      } catch (e) { /* one whale failing must not sink the poll */ }
      await new Promise(res => setTimeout(res, 30));
    }
    found.sort((a, b) => b.val - a.val);

    // alerts = diff vs the previous poll over the same tracked universe
    const nowByKey = new Map(found.map(p => [p.user + '|' + p.sym, p]));
    if (prevByKey) {
      const ts = Date.now(), fresh = [];
      for (const [k, p] of nowByKey) {
        const was = prevByKey.get(k);
        if (!was) fresh.push({ ...alertOf(p), kind: 'opened', ts });
        else if (was.long !== p.long) fresh.push({ ...alertOf(p), kind: 'flipped', ts });
        else if (Math.abs(p.val - was.val) / was.val >= ALERT_DELTA) fresh.push({ ...alertOf(p), kind: p.val > was.val ? 'increased' : 'reduced', ts });
      }
      for (const [k, was] of prevByKey) if (!nowByKey.has(k)) fresh.push({ ...alertOf(was), kind: 'closed', ts });
      fresh.sort((a, b) => b.val - a.val);
      state.alerts = fresh.concat(state.alerts).slice(0, MAX_ALERTS);
    }
    prevByKey = nowByKey;
    state.positions = found.slice(0, TOP_POSITIONS);
    state.ts = Date.now();
    state.lastErr = '';
  } catch (e) { state.lastErr = 'poll: ' + String(e).slice(0, 120); log.warn('[whales] poll failed', { e: String(e).slice(0, 160) }); }
}
const alertOf = p => ({ user: p.user, sym: p.sym, long: p.long, liq: p.liq, val: p.val });

export function startWhales() {
  (async () => { await refreshLeaderboard(); await poll(); })();
  timers.push(setInterval(refreshLeaderboard, 3600e3));
  timers.push(setInterval(poll, 240e3));
  timers.forEach(t => t.unref?.());
  log.info('[whales] started');
}
export function stopWhales() { timers.forEach(t => clearInterval(t)); timers = []; }
export function getWhales() { return { ts: state.ts, lbTs: state.lbTs, tracked: state.tracked.length, positions: state.positions, alerts: state.alerts, err: state.lastErr || undefined }; }

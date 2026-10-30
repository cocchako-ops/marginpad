// marginpad-hlstate: the Hyperliquid wallet engine, a process of its own (2026-10-30).
// The collector sits near its pm2 ceiling and owns the feeds everything else reads, so this cannot live inside it.
//
// MEASURED BEFORE BUILDING (drafts/hyperdash-plan-2026-10-30.md): the top 2,000 accounts by value hold a third of open
// interest and only 572 of them have a position, so ranking by account size is the wrong filter. The free `trades` stream
// names both sides of every fill: ~900 wallets a minute at 64 MB/h and zero API weight. It keeps a position true for
// only ~91% of those that changed, so the stream decides WHO to read and clearinghouseState is what we believe.
// 44% of volume is on the HIP-3 dexes, which clearinghouseState only answers for when asked by name.
import express from 'express';
import { hlPost, hlMeter } from '../hlapi.js';
import { log } from '../logger.js';
import { scanLeaderboard } from '../lbscan.js';
import { openStore } from './store.js';
import { aggregate, kindOf, biasOf, PNL_TIERS, SIZE_TIERS, pnlTier, sizeTier } from './cohorts.js';

const PORT = +process.env.HL_PORT || 8788;
const DB = process.env.HL_DB || new URL('../../data/hl.db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WEIGHT_MIN = +process.env.HL_WEIGHT_MIN || 200;  // this process's share of the box's 1200 a minute: raise against the meter
const MAX_WALLETS = 300000;
const MIN_DELTA_USD = 1000;      // a change smaller than this is not a row
const HOT_USD = 5000;            // a print this size puts its wallets next in line
const REFILL_MS = 60000 / (WEIGHT_MIN / 2);
const LB_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const VAULT_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/vaults';
const MIN = 60e3, HOUR = 3600e3;

const { db, q, tx } = openStore(DB);
const W = new Map();             // addr -> wallet summary; everything else is in the database
const dirtyW = new Set();
const hot = new Map();           // addr -> fill time: traded, read me next (insertion order is the queue)
let ready = [];                  // due wallets, best first, rebuilt every 20 s
let vaults = new Set(), coins = [], dexes = [];
const M = { startedAt: Date.now(), fills: 0, wsMsgs: 0, wsReconnects: 0, snaps: 0, snapErr: 0, refused: 0, pausedUntil: 0, deltas: 0, lastLb: 0, lastCohort: 0, cohortMs: 0 };
let cohortCache = { ts: 0, oi: {}, cohorts: [], excluded: [], coverage: null };

function load() {
  for (const r of db.prepare('SELECT * FROM hl_wallet').iterate()) {
    W.set(r.addr, { addr: r.addr, last_fill: r.last_fill || 0, last_snap: r.last_snap || 0, label: r.label || '', kind: r.kind || 'user', av: r.av, pnl_all: r.pnl_all, pnl_m: r.pnl_m, pnl_w: r.pnl_w, pnl_d: r.pnl_d, roi_m: r.roi_m, vlm_m: r.vlm_m, vlm_all: r.vlm_all, dexes: r.dexes ? r.dexes.split(',') : [], first_seen: r.first_seen, ntl: 0, n: 0, due: 0 });
  }
  for (const r of db.prepare('SELECT addr, SUM(ntl) t, COUNT(*) n FROM hl_pos GROUP BY addr').iterate()) { const w = W.get(r.addr); if (w) { w.ntl = r.t; w.n = r.n; } }
  for (const w of W.values()) w.due = w.last_snap ? w.last_snap + periodOf(w) : 0;
  log.info('[hl] loaded', { wallets: W.size });
}
function get(addr) {
  let w = W.get(addr);
  if (!w) {
    if (W.size >= MAX_WALLETS) return null;
    w = { addr, last_fill: 0, last_snap: 0, label: '', kind: 'user', av: null, pnl_all: null, pnl_m: null, pnl_w: null, pnl_d: null, roi_m: null, vlm_m: null, vlm_all: null, dexes: [], first_seen: Date.now(), ntl: 0, n: 0, due: 0 };
    W.set(addr, w); dirtyW.add(addr);
  }
  return w;
}
// how long a reading of this wallet stays good enough
function periodOf(w) {
  if (w.ntl >= 1e6) return 6 * MIN;
  if (w.ntl >= 1e5) return 15 * MIN;
  if (w.ntl >= 1e4) return 30 * MIN;
  if (w.ntl > 0) return HOUR;
  return (Date.now() - w.last_fill < 7 * 24 * HOUR) ? 6 * HOUR : 24 * HOUR;
}
function rebuildReady() {
  const now = Date.now(), due = [];
  for (const w of W.values()) if (w.due <= now) due.push(w);
  // what is held outranks what might be; for a wallet never read, its month of volume says more than its balance
  // (of the top 2,000 accounts by value only 572 hold anything)
  const rank = (w) => w.ntl * 10 + (w.vlm_m || 0) / 30 + (w.av || 0);
  due.sort((a, b) => rank(b) - rank(a));
  ready = due.slice(0, Math.max(200, WEIGHT_MIN * 2));
}
/* ONE READ IN THREE GOES TO WHO JUST TRADED. The first run gave them every read: 2,838 waiting after six minutes, the
   queue of big wallets never touched, and 250 of 382 positions belonged to tiny wallets with no known PnL. */
let turn = 0;
function next() {
  const now = Date.now();
  const fromHot = () => { for (const [a] of hot) { hot.delete(a); const w = W.get(a); if (w && now - w.last_snap >= (w.ntl >= 1e5 ? 60e3 : 600e3)) return w; } return null; };
  const fromReady = () => { while (ready.length) { const w = ready.shift(); if (w.due <= now) return w; } return null; };
  return (++turn % 3 === 0) ? (fromHot() || fromReady()) : (fromReady() || fromHot());
}

// one wallet, read as it is, compared with what we held
async function snap(w) {
  const now = Date.now();
  const asks = [undefined].concat(w.last_snap ? w.dexes : Array.from(new Set(['xyz', ...w.dexes])));
  const rows = new Map(); let av = null;
  for (const dex of asks) {
    const j = await hlPost(dex ? { type: 'clearinghouseState', user: w.addr, dex } : { type: 'clearinghouseState', user: w.addr }, { who: 'hlstate', timeoutMs: 8000 });
    const mv = +(j.marginSummary && j.marginSummary.accountValue);
    if (isFinite(mv)) av = (av || 0) + mv;
    for (const ap of j.assetPositions || []) {
      const p = ap.position || {}, szi = +p.szi || 0; if (!szi || !p.coin) continue;
      rows.set(String(p.coin), { szi, ntl: Math.abs(+p.positionValue || 0), entry: +p.entryPx || null, lev: +((p.leverage || {}).value) || null, cross: (p.leverage || {}).type === 'cross' ? 1 : 0, liq: +p.liquidationPx || null, margin: +p.marginUsed || null, upnl: +p.unrealizedPnl || 0, funding: +((p.cumFunding || {}).sinceOpen) || 0 });
      if (dex && !w.dexes.includes(dex)) w.dexes.push(dex);
    }
  }
  const was = new Map(q.posOf.all(w.addr).map((r) => [r.coin, r]));
  let ntl = 0;
  tx(() => {
    for (const [coin, p] of rows) {
      ntl += p.ntl;
      const o = was.get(coin), px = p.ntl / Math.abs(p.szi);
      q.posPut.run(w.addr, coin, p.szi, p.ntl, p.entry, p.lev, p.cross, p.liq, p.margin, p.upnl, p.funding, now, o ? o.since : now);
      const delta = (p.szi - (o ? o.szi : 0)) * px;
      if (w.last_snap && Math.abs(delta) >= MIN_DELTA_USD) {
        const kind = !o ? 'opened' : Math.sign(o.szi) !== Math.sign(p.szi) ? 'flipped' : Math.abs(p.szi) > Math.abs(o.szi) ? 'added' : 'reduced';
        q.delta.run(now, w.addr, coin, kind, o ? o.szi : 0, p.szi, delta, px); M.deltas++;
      }
    }
    for (const [coin, o] of was) if (!rows.has(coin)) {
      q.posDel.run(w.addr, coin);
      if (w.last_snap && o.ntl >= MIN_DELTA_USD) { q.delta.run(now, w.addr, coin, 'closed', o.szi, 0, o.szi > 0 ? -o.ntl : o.ntl, o.ntl / Math.abs(o.szi)); M.deltas++; }
    }
  });
  w.ntl = ntl; w.n = rows.size; w.last_snap = now; if (av != null) w.av = av;
  w.due = now + periodOf(w); dirtyW.add(w.addr); M.snaps++;
  return asks.length;
}

/* THE LEADERBOARD FILE DOES NOT NAME EVERYBODY: a $48M account holding $62M of BTC is absent from it, so a large wallet can
   have no all-time PnL and no cohort. `portfolio` answers for one wallet (weight 20), so it goes to the largest first. */
async function fillPnl() {
  let best = null;
  for (const w of W.values()) if (w.n > 0 && w.pnl_all == null && !w.pfAt && (!best || w.ntl > best.ntl)) best = w;
  if (!best || Date.now() < M.pausedUntil) return;
  best.pfAt = Date.now();
  try {
    const j = await hlPost({ type: 'portfolio', user: best.addr }, { who: 'hlstate-pnl' });
    const all = (j || []).find((x) => x[0] === 'allTime'), mo = (j || []).find((x) => x[0] === 'month');
    const last = (e) => { const h = e && e[1] && e[1].pnlHistory; return h && h.length ? +h[h.length - 1][1] : null; };
    if (all) best.pnl_all = last(all);
    if (mo) { best.pnl_m = last(mo); best.vlm_m = +mo[1].vlm || best.vlm_m; }
    best.kind = kindOf(best, vaults); dirtyW.add(best.addr); M.pnlFilled = (M.pnlFilled || 0) + 1;
  } catch (e) { if (String(e).includes('429')) { M.refused++; M.pausedUntil = Date.now() + 60e3; } }
}

let busy = 0;
function pump() {
  if (Date.now() < M.pausedUntil || busy) return;
  const w = next(); if (!w) return;
  busy = 1;
  w.due = Date.now() + 5 * MIN; // whatever happens below, it does not come round again at once
  snap(w).catch((e) => {
    const s = String(e);
    if (s.includes('429')) { M.refused++; M.pausedUntil = Date.now() + 60e3; log.warn('[hl] refused, standing down a minute'); } else M.snapErr++;
  }).finally(() => { busy = 0; });
}

function flush() {
  if (!dirtyW.size) return;
  const a = [...dirtyW].slice(0, 2000); a.forEach((x) => dirtyW.delete(x));
  tx(() => { for (const k of a) { const w = W.get(k); if (w) q.wallet.run(w.addr, w.first_seen, w.last_fill, w.last_snap, w.label, w.kind, w.av, w.pnl_all, w.pnl_m, w.pnl_w, w.pnl_d, w.roi_m, w.vlm_m, w.vlm_all, w.dexes.join(',')); } });
}

async function refreshLeaderboard() {
  try {
    const r = await fetch(VAULT_URL, { signal: AbortSignal.timeout(60000) });
    if (r.ok) { const j = await r.json(); const s = new Set(); for (const v of j || []) { const a = String((v.summary && v.summary.vaultAddress) || v.vaultAddress || '').toLowerCase(); if (a) s.add(a); } if (s.size) vaults = s; }
  } catch (e) { log.warn('[hl] vaults failed', { e: String(e).slice(0, 120) }); }
  try {
    const res = await fetch(LB_URL, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error('lb ' + res.status);
    let n = 0;
    const win = (arr, k) => { const e = (arr || []).find((z) => z[0] === k); return (e && e[1]) || {}; };
    await scanLeaderboard(res, (row) => {
      const addr = String(row.ethAddress || '').toLowerCase(), w = addr && get(addr); if (!w) return;
      const wp = row.windowPerformances, all = win(wp, 'allTime'), mo = win(wp, 'month');
      w.pnl_all = +all.pnl; w.vlm_all = +all.vlm; w.pnl_m = +mo.pnl; w.roi_m = +mo.roi; w.vlm_m = +mo.vlm;
      w.pnl_w = +win(wp, 'week').pnl; w.pnl_d = +win(wp, 'day').pnl;
      if (!w.last_snap) w.av = +row.accountValue;
      if (row.displayName) w.label = String(row.displayName).slice(0, 40);
      w.kind = kindOf(w, vaults); dirtyW.add(addr); n++;
    });
    for (const a of vaults) { const w = W.get(a); if (w) { w.kind = 'vault'; dirtyW.add(a); } }
    M.lastLb = Date.now(); log.info('[hl] leaderboard', { rows: n, wallets: W.size, vaults: vaults.size });
  } catch (e) { log.warn('[hl] leaderboard failed', { e: String(e).slice(0, 160) }); }
}

async function refreshCoins() {
  const list = [];
  const meta = await hlPost({ type: 'meta' }, { who: 'hlstate' });
  for (const u of meta.universe || []) if (u && u.name && !u.isDelisted) list.push(u.name);
  const names = ((await hlPost({ type: 'perpDexs' }, { who: 'hlstate' })) || []).filter((d) => d && d.name).map((d) => d.name);
  const live = [];
  for (const d of names) {
    const m = await hlPost({ type: 'meta', dex: d }, { who: 'hlstate' });
    const c = (m.universe || []).filter((u) => u && u.name && !u.isDelisted).map((u) => u.name);
    if (c.length) { live.push(d); list.push(...c); }
  }
  dexes = live; coins = list.slice(0, 480);
}

async function refreshOi() {
  const out = {};
  for (const dex of [null, ...dexes]) {
    const c = await hlPost(dex ? { type: 'metaAndAssetCtxs', dex } : { type: 'metaAndAssetCtxs' }, { who: 'hlstate' });
    let t = 0; const u = c[0].universe;
    for (let i = 0; i < u.length; i++) t += (+c[1][i].openInterest || 0) * (+c[1][i].markPx || 0);
    out[dex || 'core'] = Math.round(t);
  }
  return out;
}

let ws = null, lastMsg = 0;
function connect() {
  ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
  ws.onopen = () => {
    log.info('[hl] stream open', { coins: coins.length });
    coins.forEach((coin, i) => setTimeout(() => { try { ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } })); } catch (e) {} }, i * 20));
  };
  ws.onmessage = (ev) => {
    lastMsg = Date.now(); M.wsMsgs++;
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.channel !== 'trades' || !Array.isArray(m.data)) return;
    for (const t of m.data) {
      M.fills++;
      const i = String(t.coin).indexOf(':'), dex = i > 0 ? t.coin.slice(0, i) : null, usd = (+t.px) * (+t.sz);
      for (const u of t.users || []) {
        const w = get(u); if (!w) continue;
        w.last_fill = +t.time || Date.now();
        if (dex && !w.dexes.includes(dex)) w.dexes.push(dex);
        if (usd >= HOT_USD || w.ntl >= 1e4) { if (!hot.has(u)) hot.set(u, w.last_fill); }
        else if (w.last_snap) w.due = Math.min(w.due, Date.now() + 15 * MIN); // a dust fill moves the wallet up, not to the front
      }
    }
    if (hot.size > 20000) { const k = hot.keys().next().value; hot.delete(k); }
  };
  ws.onclose = () => { M.wsReconnects++; setTimeout(connect, 3000); };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}

function cohortPass() {
  const t0 = Date.now();
  const { rows, wallets_n } = aggregate(db.prepare('SELECT addr,coin,szi,ntl,upnl FROM hl_pos').iterate(), W);
  const win = Math.floor(t0 / 300e3) * 300e3;
  const coinRank = new Map();
  for (const [k, a] of rows) { const [fam, c, coin] = k.split('|'); if (fam === 'all' && c === 'all' && coin !== 'ALL') coinRank.set(coin, a.long_ntl + a.short_ntl); }
  const top = new Set([...coinRank.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map((x) => x[0]));
  tx(() => {
    for (const [k, a] of rows) { const [fam, c, coin] = k.split('|'); if (coin === 'ALL' || top.has(coin)) q.cohort.run(win, fam, c, coin, a.long_ntl, a.short_ntl, a.long_n, a.short_n, a.prof_n, a.loss_n, a.upnl); }
    db.prepare('DELETE FROM hl_cohort WHERE win<?').run(t0 - 48 * HOUR);
    db.prepare('DELETE FROM hl_delta WHERE ts<?').run(t0 - 7 * 24 * HOUR);
  });
  const view = (fam, id, name, coin) => {
    const a = rows.get(fam + '|' + id + '|' + coin) || { long_ntl: 0, short_ntl: 0, long_n: 0, short_n: 0, prof_n: 0, loss_n: 0, upnl: 0 };
    return { id, name, wallets: wallets_n[fam + '|' + id] || 0, long: Math.round(a.long_ntl), short: Math.round(a.short_ntl), long_n: a.long_n, short_n: a.short_n, prof_n: a.prof_n, loss_n: a.loss_n, upnl: Math.round(a.upnl), bias: biasOf(a.long_ntl, a.short_ntl) };
  };
  const market = (coin) => ({
    pnl: PNL_TIERS.map((t) => view('pnl', t.id, t.name, coin)).concat(view('pnl', 'unknown', 'Unknown', coin)),
    size: SIZE_TIERS.map((t) => view('size', t.id, t.name, coin)),
    excluded: ['vault', 'mm'].map((id) => view('excluded', id, id === 'vault' ? 'Vaults' : 'Market makers', coin)),
    all: view('all', 'all', 'All traders', coin),
  });
  const coinList = [...coinRank.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const byCoin = {}; for (const c of coinList) byCoin[c] = market(c);
  cohortCache = Object.assign({}, cohortCache, { ts: t0, ALL: market('ALL'), byCoin, coins: coinList.map((c) => ({ coin: c, ntl: Math.round(coinRank.get(c)) })) });
  M.lastCohort = t0; M.cohortMs = Date.now() - t0;
  log.info('[hl] cohorts', { ms: M.cohortMs, coins: coinList.length, wallets: W.size });
}
async function coverage() {
  try {
    const oi = await refreshOi(), total = Object.values(oi).reduce((a, b) => a + b, 0);
    const A = cohortCache.ALL; if (!A) return;
    const ex = A.excluded.reduce((a, r) => a + Math.max(r.long, r.short), 0), seen = Math.max(A.all.long, A.all.short);
    cohortCache.oi = oi;
    cohortCache.coverage = { oi: total, tracked: seen, excluded: ex, pct: +(seen / Math.max(1, total - ex) * 100).toFixed(1) };
  } catch (e) {}
}

function api() {
  const app = express();
  const posRow = (r) => { const w = W.get(r.addr) || {}; return { a: r.addr, label: w.label || undefined, coin: r.coin, long: r.szi > 0, ntl: Math.round(r.ntl), szi: r.szi, entry: r.entry, lev: r.lev, cross: r.cross, liq: r.liq, margin: r.margin, upnl: Math.round(r.upnl), funding: r.funding, ts: r.ts, since: r.since, av: w.av == null ? null : Math.round(w.av), pnl_c: pnlTier(w.pnl_all), size_c: sizeTier(w.av), kind: w.kind }; };
  app.get('/status', (req, res) => res.json({ ok: true, uptimeSec: Math.round((Date.now() - M.startedAt) / 1000), wallets: W.size, withPos: [...W.values()].filter((w) => w.n > 0).length, hot: hot.size, ready: ready.length, stale: Date.now() - lastMsg, coins: coins.length, dexes, coverage: cohortCache.coverage, ...M, weightMin: WEIGHT_MIN, hl: hlMeter(), mem: Object.fromEntries(Object.entries(process.memoryUsage()).map(([k, v]) => [k, Math.round(v / 1048576)])) }));
  app.get('/cohorts', (req, res) => res.json({ ts: cohortCache.ts, coverage: cohortCache.coverage, oi: cohortCache.oi, ...(cohortCache.ALL || {}), coins: (cohortCache.coins || []).slice(0, 60) }));
  app.get('/market', (req, res) => { const c = String(req.query.coin || ''), m = cohortCache.byCoin && cohortCache.byCoin[c]; if (!m) return res.status(404).json({ error: 'no_market' }); res.json({ ts: cohortCache.ts, coin: c, ...m }); });
  app.get('/traders', (req, res) => {
    const c = String(req.query.coin || ''), lim = Math.min(200, +req.query.limit || 50), side = req.query.side;
    const rows = db.prepare('SELECT * FROM hl_pos WHERE coin=?' + (side === 'long' ? ' AND szi>0' : side === 'short' ? ' AND szi<0' : '') + ' ORDER BY ntl DESC LIMIT ?').all(c, lim);
    res.json({ ts: Date.now(), coin: c, rows: rows.map(posRow) });
  });
  const WIN = { '15m': 15 * MIN, '1h': HOUR, '4h': 4 * HOUR, '24h': 24 * HOUR, '3d': 72 * HOUR, '7d': 168 * HOUR };
  app.get('/changes', (req, res) => {
    const w = WIN[req.query.w] || WIN['1h'], c = req.query.coin ? String(req.query.coin) : null, min = +req.query.min || 10000, lim = Math.min(200, +req.query.limit || 50), side = req.query.side;
    const since = Date.now() - w, sql = 'SELECT addr,coin,MIN(ts) t0,MAX(ts) t1,SUM(ntl_delta) d,COUNT(*) n FROM hl_delta WHERE ts>=?' + (c ? ' AND coin=?' : '') + ' GROUP BY addr,coin HAVING ABS(d)>=? ORDER BY ABS(d) DESC LIMIT 2000';
    const rows = (c ? db.prepare(sql).all(since, c, min) : db.prepare(sql).all(since, min)).filter((r) => (side === 'long' ? r.d > 0 : side === 'short' ? r.d < 0 : true)).slice(0, lim);
    const last = db.prepare('SELECT szi_to,kind,px FROM hl_delta WHERE addr=? AND coin=? AND ts>=? ORDER BY ts DESC LIMIT 1'), first = db.prepare('SELECT szi_from FROM hl_delta WHERE addr=? AND coin=? AND ts>=? ORDER BY ts ASC LIMIT 1');
    res.json({ ts: Date.now(), w: req.query.w || '1h', rows: rows.map((r) => { const a = last.get(r.addr, r.coin, since), b = first.get(r.addr, r.coin, since), x = W.get(r.addr) || {}; return { a: r.addr, label: x.label || undefined, coin: r.coin, usd: Math.round(r.d), n: r.n, from: b.szi_from, to: a.szi_to, px: a.px, kind: a.kind, t0: r.t0, t1: r.t1, pnl_c: pnlTier(x.pnl_all), size_c: sizeTier(x.av), kind_w: x.kind }; }) });
  });
  // one cohort: where it sits, how that moved, and who is in it
  app.get('/cohort', (req, res) => {
    const id = String(req.query.id || ''), fam = PNL_TIERS.some((t) => t.id === id) ? 'pnl' : SIZE_TIERS.some((t) => t.id === id) ? 'size' : null;
    if (!fam || !cohortCache.ALL) return res.status(404).json({ error: 'no_cohort' });
    const test = fam === 'pnl' ? (w) => pnlTier(w.pnl_all) === id : (w) => sizeTier(w.av) === id;
    const wallets = [...W.values()].filter((w) => w.n > 0 && (w.kind || 'user') === 'user' && test(w)).sort((x, y) => y.ntl - x.ntl);
    const markets = [];
    for (const c of cohortCache.coins || []) { const r = (cohortCache.byCoin[c.coin][fam] || []).find((x) => x.id === id); if (r && r.long + r.short > 0) markets.push({ coin: c.coin, long: r.long, short: r.short, upnl: r.upnl, long_n: r.long_n, short_n: r.short_n, bias: r.bias }); }
    markets.sort((x, y) => (y.long + y.short) - (x.long + x.short));
    const hist = db.prepare("SELECT win,long_ntl l,short_ntl s FROM hl_cohort WHERE fam=? AND cohort=? AND coin='ALL' AND win>=? ORDER BY win").all(fam, id, Date.now() - 48 * HOUR);
    const row = cohortCache.ALL[fam].find((x) => x.id === id);
    res.json({ ts: cohortCache.ts, fam, cohort: row, hist, markets: markets.slice(0, 40), wallets: wallets.slice(0, 100).map((w) => ({ a: w.addr, label: w.label || undefined, av: w.av == null ? null : Math.round(w.av), ntl: Math.round(w.ntl), n: w.n, pnl_all: w.pnl_all == null ? null : Math.round(w.pnl_all), pnl_m: w.pnl_m == null ? null : Math.round(w.pnl_m), size_c: sizeTier(w.av), pnl_c: pnlTier(w.pnl_all) })), total: wallets.length });
  });
  // every wallet holding $1M+, in the shape the published whale feed has always had
  app.get('/board', (req, res) => {
    const big = db.prepare('SELECT coin,szi,ntl,entry,lev,cross,liq,margin,upnl,ts FROM hl_pos WHERE addr=? AND ntl>=1000000');
    const rows = [];
    for (const w of W.values()) {
      if (w.ntl < 1e6) continue;
      const pos = big.all(w.addr); if (!pos.length) continue;
      rows.push({ user: w.addr, acct: { eq: Math.round(w.av || 0), book: Math.round(w.ntl), used: Math.round(pos.reduce((a, p) => a + (p.margin || 0), 0)), free: 0, n: w.n }, positions: pos.map((p) => ({ user: w.addr, sym: p.coin, long: p.szi > 0, lev: p.lev, val: Math.round(p.ntl), liq: p.liq, mark: p.ntl / Math.abs(p.szi), pnl: Math.round(p.upnl), ent: p.entry, x: p.cross, roe: p.margin ? Math.round(p.upnl / p.margin * 1e4) / 1e4 : null, sz: Math.abs(p.szi) })) });
    }
    res.json({ ts: Date.now(), rows });
  });
  app.get('/wallet', (req, res) => {
    const a = String(req.query.a || '').toLowerCase(), w = W.get(a);
    if (!w) return res.status(404).json({ error: 'unknown_wallet' });
    res.json({ a, label: w.label, kind: w.kind, av: w.av, pnl_all: w.pnl_all, pnl_m: w.pnl_m, pnl_w: w.pnl_w, pnl_d: w.pnl_d, roi_m: w.roi_m, vlm_m: w.vlm_m, last_fill: w.last_fill, last_snap: w.last_snap, pnl_c: pnlTier(w.pnl_all), size_c: sizeTier(w.av), positions: db.prepare('SELECT * FROM hl_pos WHERE addr=? ORDER BY ntl DESC').all(a).map(posRow) });
  });
  app.listen(PORT, '127.0.0.1', () => log.info('[hl] api', { port: PORT }));
}

async function main() {
  load();
  await refreshCoins();
  api();
  connect();
  await refreshLeaderboard();
  rebuildReady();
  setInterval(pump, REFILL_MS);
  setTimeout(() => { try { cohortPass(); coverage(); } catch (e) {} }, 90e3); // a restart should not leave the page empty for five minutes
  setInterval(rebuildReady, 20e3);
  setInterval(fillPnl, 30e3);
  setInterval(flush, 5e3);
  setInterval(() => { try { cohortPass(); coverage(); } catch (e) { log.warn('[hl] cohort pass failed', { e: String(e).slice(0, 200) }); } }, 300e3);
  setInterval(refreshLeaderboard, 6 * HOUR);
  setInterval(() => refreshCoins().catch(() => {}), 6 * HOUR);
  setInterval(() => { if (Date.now() - lastMsg > 60e3 && ws) { try { ws.close(); } catch (e) {} } else { try { ws.send('{"method":"ping"}'); } catch (e) {} } }, 30e3);
  log.info('[hl] running', { weightMin: WEIGHT_MIN, refillMs: Math.round(REFILL_MS) });
}
process.on('SIGINT', () => { try { flush(); db.close(); } catch (e) {} process.exit(0); });
process.on('SIGTERM', () => { try { flush(); db.close(); } catch (e) {} process.exit(0); });
main().catch((e) => { log.error('[hl] fatal', { e: String(e) }); process.exit(1); });

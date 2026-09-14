// Hyperliquid whale tracker (2026-08-22, Coinglass independence phase D).
// Hyperliquid IS the primary source — positions live on-chain and the public info API serves them;
// the aggregator we used to pay resold exactly this. Three feeds:
//   positions: biggest open perp positions (>= $1M) across the leaderboard's top accounts
//   alerts:    position changes between polls (opened / closed / flipped / grew or shrank >= 25%)
//   fills:     REAL executed trades with the exchange's own timestamp (2026-09-14, see below)
// Leaderboard refresh is hourly (the file is ~36MB); position polls run every 4 minutes over the
// tracked set, sequential with a small gap so we stay far under the info-API rate weight.
//
// ── the trade feed (2026-09-14, owner: "jedan prozor gde izbacuje da je neko kupio 200k BTC long po
//    tom i tom leverage u to i to vreme") ────────────────────────────────────────────────────────
// `alerts` above are a DIFF of two snapshots: the timestamp is when WE looked, not when the whale
// traded, and a move inside one 4-minute window is invisible. userFillsByTime gives the exchange's
// own fill time, price, size and direction, so the feed can say when something actually happened.
//
// It must be AGGREGATED, and that is a measurement, not a preference. Measured 2026-09-14 over one
// hour across twelve of the largest wallets: 4,992 perp fills, median size $745, largest $88.6k.
// A whale does not "buy $200k of BTC" in one fill — it is hundreds of slices from an execution algo.
// Raw, this feed would be ~62,000 unreadable rows an hour. Grouping consecutive fills of the same
// wallet + coin + direction inside GROUP_MS and keeping those over MIN_TRADE_USD turns the same hour
// into 14 real trades, the largest being $2.0M of GOLD closed over 472 fills in fourteen minutes.
// The group carries BOTH ends of that execution, because "13:00 to 13:14" is the honest answer to
// when it happened.
import { log } from './logger.js';

const LEADERBOARD_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const INFO_URL = 'https://api.hyperliquid.xyz/info';
const TRACK_N = 150;        // top accounts by account value we keep an eye on
const MIN_POS_USD = 1e6;    // a "whale position" starts at $1M notional
const TOP_POSITIONS = 40;   // what we publish
const ALERT_DELTA = 0.25;   // size change that counts as an alert
const MAX_ALERTS = 60;

// trade feed
const FILL_TRACK_N = 60;    // fills are polled for the largest accounts only — see the weight note below
const FILL_SLICE = 15;      // wallets per tick …
const FILL_TICK_MS = 30e3;  // … every 30 s = 30 wallets/min. userFillsByTime weighs 20 against the
                            // info API's 1200/min per IP, so this sits at ~600/min with the position
                            // poll's ~77/min beside it. A full sweep of the 60 takes two minutes.
const GROUP_MS = 120e3;     // fills of one wallet+coin+direction closer together than this are ONE trade
const MIN_TRADE_USD = 250e3; // measured floor: ~14 trades/hour per twelve wallets (see the note above)
const MAX_FILLS = 120;      // published ring
const FILL_LOOKBACK_MS = 15 * 60e3; // first sight of a wallet: how far back we read

const state = { tracked: [], positions: [], alerts: [], fills: [], perf: {}, best: [], coins: [], ts: 0, lbTs: 0, fillTs: 0, lastErr: '', fillErr: '' };
let prevByKey = null; // "user|coin" -> {val, long} from the previous poll (null on first run = no alerts)
let timers = [];
const fillSeen = new Map();   // user -> ms of the newest fill we have already read
const openGroup = new Map();  // "user|coin|dir" -> the group still collecting fills
let levByKey = new Map();     // "user|coin" -> leverage, filled by the position poll
let fillCursor = 0;           // where the rotation stands
let fill429 = 0;

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
    const t0 = Date.now();
    const j = await r.json(); // ~36MB parsed synchronously — on this 512MB box that is a real event-loop pause, so it is measured
    const parseMs = Date.now() - t0; if (parseMs > 800) log.warn('[whales] slow leaderboard parse', { ms: parseMs });
    const rows = Array.isArray(j.leaderboardRows) ? j.leaderboardRows : [];
    if (rows.length < 1000) throw new Error('lb too small: ' + rows.length);
    // Every leaderboard row carries pnl / roi / volume for day, week, month and allTime, and until
    // 2026-09-14 all of it was thrown away and only the address kept. That is the whole track-record
    // layer of the page — who is actually good, not merely large — and it costs nothing extra.
    const clean = rows
      .map(x => ({ a: String(x.ethAddress || ''), v: +x.accountValue || 0, w: x.windowPerformances, n: x.displayName || null }))
      .filter(x => /^0x[0-9a-fA-F]{40}$/.test(x.a) && x.v > 0)
      .sort((p, q) => q.v - p.v);
    state.tracked = clean.slice(0, TRACK_N).map(x => x.a);
    const win = (w, k) => { const e = (w || []).find(z => z[0] === k); const o = e && e[1] || {};
      return { pnl: Math.round(+o.pnl || 0), roi: +(+o.roi || 0).toFixed(6), vlm: Math.round(+o.vlm || 0) }; };
    state.perf = {};
    for (const x of clean.slice(0, TRACK_N)) state.perf[x.a] = { v: Math.round(x.v), name: x.n, d: win(x.w, 'day'), w: win(x.w, 'week'), m: win(x.w, 'month'), a: win(x.w, 'allTime') };
    // the month board is ranked over the WHOLE leaderboard, not just the accounts we track by size:
    // the best trader of the month is often not the biggest account
    state.best = clean
      .map(x => ({ a: x.a, v: Math.round(x.v), name: x.n, m: win(x.w, 'month'), a30: win(x.w, 'month').roi }))
      .filter(x => x.m.vlm > 1e6 && x.v >= 1e4)   // a LIVE account: one that has been emptied prints "account $0" beside a huge return
      .sort((p, q) => q.m.pnl - p.m.pnl)
      .slice(0, 25)
      .map(x => ({ user: x.a, v: x.v, name: x.name, pnl: x.m.pnl, roi: x.m.roi, vlm: x.m.vlm }));
    state.lbTs = Date.now();
    log.info('[whales] leaderboard refreshed', { tracked: state.tracked.length });
  } catch (e) { state.lastErr = 'lb: ' + String(e).slice(0, 120); log.warn('[whales] leaderboard failed', { e: String(e).slice(0, 160) }); }
}

async function poll() {
  if (!state.tracked.length) return;
  try {
    let mids = {};
    try { mids = await post({ type: 'allMids' }); } catch (e) { mids = {}; }
    // funding, open interest and 24h volume for every market, in ONE call (weight 20, once per 4 min).
    // This is the context that turns a position into a story: a crowded side paying to hold it.
    let ctx = {};
    try {
      const mc = await post({ type: 'metaAndAssetCtxs' });
      const uni = (mc && mc[0] && mc[0].universe) || [], cs = (mc && mc[1]) || [];
      for (let i = 0; i < uni.length; i++) {
        const c = cs[i]; if (!c) continue;
        const mark = +c.markPx || 0, prev = +c.prevDayPx || 0;
        ctx[String(uni[i].name)] = {
          fund: +c.funding || 0,                         // per hour, as the exchange states it
          oi: Math.round((+c.openInterest || 0) * mark), // contracts -> USD
          vol: Math.round(+c.dayNtlVlm || 0),
          chg: prev > 0 ? +(((mark - prev) / prev) * 100).toFixed(2) : null,
          mark,
        };
      }
    } catch (e) { /* context is a bonus; the board must render without it */ }
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
    // the fill feed needs leverage, and a fill does not carry it — it lives on the POSITION. Keep the
    // whole map (not just the published top 40) so a trade in a smaller position is still labelled.
    levByKey = new Map(found.filter(p => p.lev > 0).map(p => [p.user + '|' + p.sym, p.lev]));

    // ── by market: where the tracked whales actually are, against what the market is doing ──────
    // Published for EVERY market they hold, not just the 40 biggest positions, because the point of
    // this table is the crowd — which side is loaded, how levered, and what it costs them per day.
    const byCoin = new Map();
    for (const p of found) {
      let c = byCoin.get(p.sym);
      if (!c) { c = { sym: p.sym, longUsd: 0, shortUsd: 0, n: 0, longN: 0, shortN: 0, levSum: 0, levN: 0, pnl: 0 }; byCoin.set(p.sym, c); }
      if (p.long) { c.longUsd += p.val; c.longN++; } else { c.shortUsd += p.val; c.shortN++; }
      c.n++; c.pnl += (+p.pnl || 0);
      if (p.lev > 0) { c.levSum += p.lev * p.val; c.levN += p.val; }   // size-weighted, not a plain mean
    }
    state.coins = [...byCoin.values()].map(c => {
      const k = ctx[c.sym] || {};
      const tot = c.longUsd + c.shortUsd;
      return {
        sym: c.sym, longUsd: c.longUsd, shortUsd: c.shortUsd, net: c.longUsd - c.shortUsd, tot,
        n: c.n, longN: c.longN, shortN: c.shortN,
        lev: c.levN > 0 ? +(c.levSum / c.levN).toFixed(1) : null,
        pnl: Math.round(c.pnl),
        fund: k.fund != null ? k.fund : null, oi: k.oi || null, vol: k.vol || null, chg: k.chg != null ? k.chg : null, mark: k.mark || null,
        // what the whales' own side pays (or earns) to hold for a day, at the current rate
        fundDay: (k.fund != null && tot > 0) ? Math.round(k.fund * 24 * (c.longUsd - c.shortUsd)) : null,
        // how much of the whole market's open interest these wallets are
        oiShare: k.oi > 0 ? +((tot / k.oi) * 100).toFixed(1) : null,
      };
    }).sort((a, b) => b.tot - a.tot).slice(0, 40);

    state.positions = found.slice(0, TOP_POSITIONS);
    state.ts = Date.now();
    state.lastErr = '';
  } catch (e) { state.lastErr = 'poll: ' + String(e).slice(0, 120); log.warn('[whales] poll failed', { e: String(e).slice(0, 160) }); }
}
const alertOf = p => ({ user: p.user, sym: p.sym, long: p.long, liq: p.liq, val: p.val });

// ── the trade feed ────────────────────────────────────────────────────────────────────────────────
// dir on a perp fill is one of Open Long / Close Long / Open Short / Close Short / Long > Short /
// Short > Long. Spot fills say Buy / Sell and their coin is an index like "@107" — this is a futures
// feed, so they are dropped rather than guessed at.
const DIRS = {
  'Open Long': { act: 'open', long: true }, 'Close Long': { act: 'close', long: true },
  'Open Short': { act: 'open', long: false }, 'Close Short': { act: 'close', long: false },
  'Long > Short': { act: 'flip', long: false }, 'Short > Long': { act: 'flip', long: true },
};

const pending = [];   // groups that have closed and are waiting for their leverage before they are published

function publishGroup(g) {
  if (!(g.usd >= MIN_TRADE_USD)) return;
  const d = DIRS[g.dir] || {};
  pending.push({
    user: g.user, sym: g.sym, act: d.act || '', long: !!d.long, dir: g.dir,
    usd: Math.round(g.usd), sz: +g.sz.toFixed(6),
    px: g.usd / g.sz,                       // size-weighted average fill price, not the last print
    ts: g.first, tsEnd: g.last, n: g.n,     // both ends: a big trade executes over minutes
    lev: levByKey.get(g.user + '|' + g.sym) || null,
    pnl: g.pnl ? Math.round(g.pnl) : 0,     // realised, only meaningful on a close
  });
}

// A fill does not carry leverage — it lives on the position. The 4-minute position poll is both too
// slow and too narrow for this (it only keeps positions over $1M), so a closed group asks the chain
// for the wallet's state directly. clearinghouseState weighs 2 against the 1200/min budget and this
// runs a couple of times a minute, which is why it is affordable to ask at publish time instead of
// printing "—" next to most rows (measured on the first live feed: 6 of 6 had no leverage).
// A trade that CLOSED the whole position leaves nothing to read, and that is reported as unknown
// rather than filled in with a number from somewhere else.
async function drainPending() {
  if (!pending.length) return;
  const rows = pending.splice(0, pending.length);
  const users = [...new Set(rows.map(r => r.user))];
  for (const u of users.slice(0, 6)) {
    try {
      const st = await post({ type: 'clearinghouseState', user: u }, 8000);
      const lev = new Map(), held = new Map();
      for (const ap of (st.assetPositions || [])) {
        const p = ap.position || {}, v = +((p.leverage || {}).value) || 0;
        if (p.coin && v > 0) lev.set(String(p.coin), v);
        if (p.coin) held.set(String(p.coin), Math.abs(+p.positionValue || 0));
      }
      // clearinghouseState answers for the main perp book only — a builder-deployed market (the chain
      // lists those as "xyz:GOLD", "xyz:SP500") is not in it, so those rows keep an unknown leverage
      // and no position size. That is the honest answer, not a zero.
      for (const r of rows) if (r.user === u) { if (!r.lev) r.lev = lev.get(r.sym) || null; r.posUsd = Math.round(held.get(r.sym) || 0) || undefined; }
    } catch (e) { /* no leverage is reported as unknown, never guessed */ }
    await new Promise(res => setTimeout(res, 40));
  }
  // A group is published when it goes QUIET, so publication order is not the order things happened: a
  // fifteen-minute execution surfaces after short trades that started later. The feed is sorted by when
  // the trade STARTED, which is the clock the row prints — the two must agree or the list reads as broken.
  for (const r of rows) state.fills.push(r);
  state.fills.sort((a, b) => b.ts - a.ts);
  if (state.fills.length > MAX_FILLS) state.fills.length = MAX_FILLS;
}

// Fold one wallet's fills into the open groups. Fills arrive newest-first from the API; we walk them
// oldest-first so a group grows forward in time the way the execution actually ran.
function foldFills(user, rows) {
  const fills = rows
    .filter(f => f && !String(f.coin || '').startsWith('@') && DIRS[f.dir])
    .map(f => ({ sym: String(f.coin), dir: f.dir, t: +f.time || 0, px: +f.px || 0, sz: Math.abs(+f.sz) || 0, pnl: +f.closedPnl || 0 }))
    .filter(f => f.t > 0 && f.px > 0 && f.sz > 0)
    .sort((a, b) => a.t - b.t);
  let newest = fillSeen.get(user) || 0;
  for (const f of fills) {
    if (f.t <= (fillSeen.get(user) || 0)) continue;   // already counted on an earlier sweep
    if (f.t > newest) newest = f.t;
    const k = user + '|' + f.sym + '|' + f.dir;
    const g = openGroup.get(k);
    if (g && f.t - g.last <= GROUP_MS) { g.usd += f.px * f.sz; g.sz += f.sz; g.last = f.t; g.n++; g.pnl += f.pnl; }
    else {
      if (g) { publishGroup(g); openGroup.delete(k); }
      openGroup.set(k, { user, sym: f.sym, dir: f.dir, usd: f.px * f.sz, sz: f.sz, first: f.t, last: f.t, n: 1, pnl: f.pnl });
    }
  }
  if (newest) fillSeen.set(user, newest);
}

// A group is published once nothing has been added to it for GROUP_MS — otherwise a trade still being
// executed would be printed at a third of its final size and never corrected.
function flushGroups(now) {
  for (const [k, g] of openGroup) if (now - g.last > GROUP_MS) { publishGroup(g); openGroup.delete(k); }
}

async function pollFills() {
  const universe = state.tracked.slice(0, FILL_TRACK_N);
  if (!universe.length) return;
  const now = Date.now();
  try {
    for (let i = 0; i < FILL_SLICE; i++) {
      const user = universe[(fillCursor + i) % universe.length];
      try {
        const since = fillSeen.has(user) ? fillSeen.get(user) + 1 : now - FILL_LOOKBACK_MS;
        const rows = await post({ type: 'userFillsByTime', user, startTime: since, aggregateByTime: true });
        if (Array.isArray(rows)) foldFills(user, rows);
      } catch (e) {
        const s = String(e);
        if (s.includes('429')) { fill429++; state.fillErr = 'rate limited x' + fill429; log.warn('[whales] fills rate limited', { user }); break; }
      }
      await new Promise(res => setTimeout(res, 40));
    }
    fillCursor = (fillCursor + FILL_SLICE) % universe.length;
    flushGroups(now);
    await drainPending();
    state.fillTs = now;
    if (!fill429) state.fillErr = '';
    // wallets we no longer track must not keep their cursor for ever
    if (fillSeen.size > FILL_TRACK_N * 3) { const keep = new Set(universe); for (const k of fillSeen.keys()) if (!keep.has(k)) fillSeen.delete(k); }
  } catch (e) { state.fillErr = String(e).slice(0, 120); log.warn('[whales] fills poll failed', { e: String(e).slice(0, 160) }); }
}

export function startWhales() {
  (async () => { await refreshLeaderboard(); await poll(); await pollFills(); })();
  timers.push(setInterval(refreshLeaderboard, 3600e3));
  timers.push(setInterval(poll, 240e3));
  timers.push(setInterval(pollFills, FILL_TICK_MS));
  timers.forEach(t => t.unref?.());
  log.info('[whales] started');
}
export function stopWhales() { timers.forEach(t => clearInterval(t)); timers = []; }
// test hook: build/whale-fills-e2e.js runs the REAL grouping over real fills pulled from Hyperliquid,
// because the whole feature is that aggregation and a copy of it in a test would prove nothing.
export const _fillsTest = {
  foldFills, flushGroups, drainPending, state,
  // publish without asking the chain for leverage — the grouping is what is under test here
  flushLocal(now) { flushGroups(now); const rows = pending.splice(0, pending.length); for (const r of rows) state.fills.push(r); state.fills.sort((a, b) => b.ts - a.ts); if (state.fills.length > MAX_FILLS) state.fills.length = MAX_FILLS; },
  reset(lev) { state.fills = []; openGroup.clear(); fillSeen.clear(); pending.length = 0; levByKey = new Map(Object.entries(lev || {})); },
  consts: { GROUP_MS, MIN_TRADE_USD, MAX_FILLS, FILL_TRACK_N },
};
export function getWhales() {
  return {
    ts: state.ts, lbTs: state.lbTs, tracked: state.tracked.length, positions: state.positions, alerts: state.alerts,
    fills: state.fills, fillTs: state.fillTs, fillWatch: Math.min(FILL_TRACK_N, state.tracked.length), fillMin: MIN_TRADE_USD,
    coins: state.coins, best: state.best, perf: state.perf,
    err: state.lastErr || undefined, fillErr: state.fillErr || undefined,
  };
}

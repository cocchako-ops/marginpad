// Hyperliquid whale tracker (2026-08-22, Coinglass independence phase D).
// Hyperliquid IS the primary source - positions live on-chain and the public info API serves them;
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
// A whale does not "buy $200k of BTC" in one fill - it is hundreds of slices from an execution algo.
// Raw, this feed would be ~62,000 unreadable rows an hour. Grouping consecutive fills of the same
// wallet + coin + direction inside GROUP_MS and keeping those over MIN_TRADE_USD turns the same hour
// into 14 real trades, the largest being $2.0M of GOLD closed over 472 fills in fourteen minutes.
// The group carries BOTH ends of that execution, because "13:00 to 13:14" is the honest answer to
// when it happened.
import { log } from './logger.js';
import { scanLeaderboard } from './lbscan.js';
import { hlPost } from './hlapi.js';

const LEADERBOARD_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const INFO_URL = 'https://api.hyperliquid.xyz/info';
const TRACK_N = 1000;       // top accounts by account value we keep an eye on (150 until 2026-10-11)
const CORE_N = 200;         // … of which the largest are polled EVERY cycle
const ROTATE_N = 200;       // … and this many of the tail per cycle, so the whole 1,000 is swept in 16 min
const STALE_MS = 52 * 60e3; // a position nobody has looked at for three sweeps stops being published
const MIN_POS_USD = 1e6;    // a "whale position" starts at $1M notional
const TOP_POSITIONS = 120;  // what we publish (40 until 2026-10-11 - the liquidation line needs breadth)
const ALERT_DELTA = 0.25;   // size change that counts as an alert
const MAX_ALERTS = 60;

// trade feed
const FILL_TRACK_N = 120;   // the board's own wallets first, then the largest accounts (see fillUniverse)
const FILL_SLICE = 6;      // wallets per tick, i.e. 30 a minute
/* THE DOCUMENTED CEILING IS 1200 WEIGHT/MIN AND WE DO NOT GET IT. userFillsByTime weighs 20, so 30 wallets
   a minute is 600, and the position poll (400 calls per 4-minute cycle at weight 2) is 200 beside it: 800.
   MEASURED 2026-10-28: at 18 per tick (920/min) the collector was refused within thirteen minutes - fillErr
   'rate limited x2' and 19 refused POSITION calls, which is the worse half, because a refused position call
   means those wallets went unpolled and every row they own got older. The back-off recovered it by itself
   and the cost was real. 800/min has been clean for weeks and is the operating point - raise it against a
   MEASUREMENT, never against the published number. A full sweep of the 120 wallets takes 4 minutes, and a
   row carries the EXCHANGE's own timestamp, so a slower sweep costs latency and not truth. */
const FILL_TICK_MS = 30e3;
const GROUP_MS = 120e3;     // fills of one wallet+coin+direction closer together than this are ONE trade
const MIN_TRADE_USD = 250e3; // measured floor: ~14 trades/hour per twelve wallets (see the note above)
const MAX_FILLS = 120;      // published ring
/* THE RING IS THE SITE'S LAST COUPLE OF HOURS, AND A PROFILE IS ABOUT ONE WALLET (2026-10-28, measured:
   15 groups spanning 18 minutes from 3 distinct wallets, i.e. ~50 groups an hour, so the 120-row ring is
   about 2.4 hours of the WHOLE market). Filtering that ring by address is why a profile opened at nine in
   the evening showed nothing for a wallet that traded at noon - not a polling gap, a retention one. Each
   wallet keeps its own last HIST_N groups for HIST_MS, which is what the Closed tab actually asks for. */
const HIST_N = 14;
const HIST_MS = 24 * 3600 * 1000;
const histByUser = new Map();   // user -> that wallet's own published groups, newest first
const FILL_LOOKBACK_MS = 15 * 60e3; // first sight of a wallet: how far back we read

const state = { tracked: [], positions: [], alerts: [], fills: [], perf: {}, best: [], coins: [], ts: 0, lbTs: 0, fillTs: 0, lastErr: '', fillErr: '' };
let prevByKey = null; // "user|coin" -> {val, long} from that WALLET's previous poll (null on first run = no alerts)
let rotCursor = 0;    // where the rotating half of the position poll is in the tail
const posByUser = new Map(); // user -> { rows, ts } - the last time we actually looked at this wallet
let timers = [];
let lastBoard = [];
const fillSeen = new Map();   // user -> ms of the newest fill we have already read
const openGroup = new Map();  // "user|coin|dir" -> the group still collecting fills
const acctByUser = new Map();  // user -> account totals (equity, whole book, free margin), kept across cycles
let levByKey = new Map();     // "user|coin" -> leverage, filled by the position poll
/* TWO MEMORIES THE POLL WAS THROWING AWAY, AND BOTH ANSWER A QUESTION A READER ASKS FIRST (2026-10-28,
   owner: "za closed positions ne pise koji je leverage ... kad je otvoren trejd, kad zatvoren, koliko dugo
   je drzao"). A fill carries no leverage and a CLOSED position is gone from clearinghouseState by the time
   the group publishes, so the only honest source is what the position itself said while it was open - this
   keeps the last reading per (user, coin) for LEV_MEM_MS after the position disappears, stamped with WHEN
   it was read, so the page can say "as last seen" rather than implying it is the fill's own number.
   `sinceByKey` is the other half: when a position key appears for a wallet we were ALREADY watching, we
   witnessed it being opened and the timestamp is exact; the first time we ever poll a wallet the position
   may be far older, so that case is published as "first seen", never as an open time. Neither survives a
   restart - both are in memory on purpose, and an unknown is published as unknown. */
const LEV_MEM_MS = 12 * 3600 * 1000;
const levSeen = new Map();    // "user|coin" -> { lev, ts } - the last leverage read WHILE the position was open
const sinceByKey = new Map(); // "user|coin" -> { ts, exact } - when that position first stood in front of us
let fillCursor = 0;           // where the rotation stands
let fill429 = 0;
let pos429 = 0;       // rate-limited position calls in the last cycle
let rotN = ROTATE_N;  // the rotating slice, shrunk by the back-off below and walked back up when clean

async function post(body, timeoutMs = 12000) {
  return hlPost(body, { who: body.type === 'userFillsByTime' ? 'whale-fills' : 'whale-pos', timeoutMs });
}

async function refreshLeaderboard() {
  try {
    const r = await fetch(LEADERBOARD_URL, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('lb ' + r.status);
    const t0 = Date.now();
    // THE FILE IS NEVER PARSED WHOLE. `r.json()` on this ~39 MB / ~47k-row body is what killed the
    // collector on 2026-10-05 23:42 UTC ("Reached heap limit") - see lbscan.js. Each row is reduced
    // to the few numbers the page keeps the moment it arrives, and the `windowPerformances` arrays,
    // which are most of the file, are dropped row by row.
    const win = (w, k) => { const e = (w || []).find(z => z[0] === k); const o = e && e[1] || {};
      return { pnl: Math.round(+o.pnl || 0), roi: +(+o.roi || 0).toFixed(6), vlm: Math.round(+o.vlm || 0) }; };
    const clean = [];
    const scanned = await scanLeaderboard(r, (x) => {
      const a = String(x.ethAddress || ''), v = +x.accountValue || 0;
      if (!/^0x[0-9a-fA-F]{40}$/.test(a) || !(v > 0)) return;
      const w = x.windowPerformances;
      clean.push({ a, v, n: x.displayName || null, d: win(w, 'day'), w: win(w, 'week'), m: win(w, 'month'), al: win(w, 'allTime') });
    });
    const parseMs = Date.now() - t0; if (parseMs > 800) log.warn('[whales] slow leaderboard parse', { ms: parseMs, rows: scanned.rows });
    if (scanned.rows < 1000) throw new Error('lb too small: ' + scanned.rows);
    // Every leaderboard row carries pnl / roi / volume for day, week, month and allTime, and until
    // 2026-09-14 all of it was thrown away and only the address kept. That is the whole track-record
    // layer of the page - who is actually good, not merely large - and it costs nothing extra.
    clean.sort((p, q) => q.v - p.v);
    state.tracked = clean.slice(0, TRACK_N).map(x => x.a);
    state.perf = {};
    for (const x of clean.slice(0, TRACK_N)) state.perf[x.a] = { v: Math.round(x.v), name: x.n, d: x.d, w: x.w, m: x.m, a: x.al };
    // the month board is ranked over the WHOLE leaderboard, not just the accounts we track by size:
    // the best trader of the month is often not the biggest account
    state.best = clean
      .filter(x => x.m.vlm > 1e6 && x.v >= 1e4)   // a LIVE account: one that has been emptied prints "account $0" beside a huge return
      .sort((p, q) => q.m.pnl - p.m.pnl)
      .slice(0, 25)
      .map(x => ({ user: x.a, v: Math.round(x.v), name: x.n, pnl: x.m.pnl, roi: x.m.roi, vlm: x.m.vlm }));
    state.lbTs = Date.now();
    log.info('[whales] leaderboard refreshed', { tracked: state.tracked.length });
  } catch (e) { state.lastErr = 'lb: ' + String(e).slice(0, 120); log.warn('[whales] leaderboard failed', { e: String(e).slice(0, 160) }); }
}

/* A CYCLE THAT OVERRUNS ITS TIMER MUST NOT START A SECOND ONE. Measured on a dry run: 400 calls take
   138 s against a 240 s timer, which is comfortable until the day the API is slow - and two polls in
   flight would put the weight spend at ~400/min for positions on top of the fills' 600, against a hard
   1200/min per IP. The same rule the ring persist on this box already follows. */
let polling = false;
async function poll() {
  if (polling) { log.warn('[whales] poll still running, skipping this tick'); return; }
  polling = true;
  try { await pollOnce(); } finally { polling = false; }
}
async function pollOnce() {
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
    /* TWO TIERS. The biggest accounts are polled every cycle because they are the ones a reader recognises
       and the ones whose liquidation actually moves a market; the tail rotates so 1,000 wallets cost the same
       weight as 400. `universe` is only what we LOOK AT this cycle - what we PUBLISH is assembled below from
       every wallet still fresh, because a wallet we did not call has not closed anything. */
    /* THE ENGINE READS THE CHAIN NOW, THIS ONLY PUBLISHES (2026-10-31). One IP has one budget, and this loop and
       marginpad-hlstate were spending it twice on the same wallets: 1,700 weight a minute, 24 refusals in an hour,
       and only 1,157 of 54,220 wallets read in 43 minutes. `/board` is every wallet holding $1M+, core and HIP-3.
       A wallet that was on the board and is gone has closed, which is what keeps the closed alert true. */
    const board = await fetch('http://127.0.0.1:' + (process.env.HL_PORT || 8788) + '/board', { signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!board || !Array.isArray(board.rows)) { state.lastErr = 'wallet engine unreachable'; return; }
    const universe = [...new Set(lastBoard.concat(board.rows.map((r) => r.user)))];
    lastBoard = board.rows.map((r) => r.user);
    const polledNow = new Set(universe);
    const seen = [];
    const acctNow = new Map();   // user -> account totals, replaced for the wallets this cycle reached
    const hit429 = 0;
    for (const r of board.rows) {
      acctNow.set(r.user, r.acct);
      for (const p of r.positions) seen.push({ ...p, mark: +mids[p.sym] || p.mark });
    }
    const nowTs = Date.now();
    // what we saw this cycle replaces what we knew about those wallets, and nothing else
    for (const u of universe) posByUser.set(u, { rows: [], ts: nowTs });
    for (const p of seen) (posByUser.get(p.user) || { rows: [] }).rows.push(p);
    // a wallet that has dropped off the leaderboard, or that we have not reached in three sweeps, stops counting
    const live = new Set(state.tracked.concat(universe));
    for (const [u, v] of posByUser) if (!live.has(u) || nowTs - v.ts > STALE_MS) posByUser.delete(u);

    /* EVERY ROW CARRIES ITS OWN AGE. With a rotating poll a position can be sixteen minutes old, and a
       liquidation line drawn from it has to be able to say so rather than implying it is live. */
    const found = [];
    for (const [, v] of posByUser) for (const p of v.rows) found.push({ ...p, age: Math.round((nowTs - v.ts) / 1000) });
    found.sort((a, b) => b.val - a.val);

    // alerts = diff vs each WALLET's own previous observation, and only for wallets polled this cycle -
    // otherwise every rotation would print a wave of "closed" for wallets nobody looked at
    const nowByKey = new Map(seen.map(p => [p.user + '|' + p.sym, p]));
    /* WHEN DID THIS POSITION FIRST STAND HERE. A key we have never seen on a wallet we HAD seen is one we
       watched open (exact); a key on a wallet we are polling for the first time may predate us (first seen).
       A key that is gone keeps nothing - the position is closed and its age died with it. */
    {
      const hadUser = new Set(); for (const [, v] of prevByKey || []) hadUser.add(v.user);
      for (const [k, p] of nowByKey) {
        if (!sinceByKey.has(k)) sinceByKey.set(k, { ts: nowTs, exact: hadUser.has(p.user) && !!prevByKey });
        if (p.lev > 0) levSeen.set(k, { lev: p.lev, ts: nowTs });
      }
      for (const k of [...sinceByKey.keys()]) if (!nowByKey.has(k) && polledNow.has(k.slice(0, k.indexOf('|')))) sinceByKey.delete(k);
      if (levSeen.size > 20000) for (const [k, v] of levSeen) if (nowTs - v.ts > LEV_MEM_MS) levSeen.delete(k);
    }
    if (prevByKey) {
      const ts = nowTs, fresh = [];
      for (const [k, p] of nowByKey) {
        const was = prevByKey.get(k);
        if (!was) fresh.push({ ...alertOf(p), kind: 'opened', ts });
        else if (was.long !== p.long) fresh.push({ ...alertOf(p), kind: 'flipped', ts });
        else if (Math.abs(p.val - was.val) / was.val >= ALERT_DELTA) fresh.push({ ...alertOf(p), kind: p.val > was.val ? 'increased' : 'reduced', ts });
      }
      for (const [k, was] of prevByKey) if (!nowByKey.has(k) && polledNow.has(was.user)) fresh.push({ ...alertOf(was), kind: 'closed', ts });
      fresh.sort((a, b) => b.val - a.val);
      state.alerts = fresh.concat(state.alerts).slice(0, MAX_ALERTS);
    }
    // keep every wallet's last observation, not only this cycle's, or a rotated wallet has nothing to diff against
    if (!prevByKey) prevByKey = new Map();
    for (const [k, v] of prevByKey) if (polledNow.has(v.user)) prevByKey.delete(k);   // one pass, not universe x map
    for (const [k, p] of nowByKey) prevByKey.set(k, p);
    // the fill feed needs leverage, and a fill does not carry it - it lives on the POSITION. Keep the
    // whole map (not just the published top 40) so a trade in a smaller position is still labelled.
    levByKey = new Map(found.filter(p => p.lev > 0).map(p => [p.user + '|' + p.sym, p.lev]));

    // ── by market: where the tracked whales actually are, against what the market is doing ──────
    // Published for EVERY market they hold, not just the 40 biggest positions, because the point of
    // this table is the crowd - which side is loaded, how levered, and what it costs them per day.
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

    /* BACK OFF BY ITSELF. A cycle that met the limit halves the rotating slice for the next one; a clean
       cycle walks it back up. The floor is 50, so the tail is always being swept, just more slowly. */
    pos429 = hit429;
    if (hit429 > 5) rotN = Math.max(50, Math.floor(rotN / 2));
    else if (!hit429 && rotN < ROTATE_N) rotN = Math.min(ROTATE_N, rotN + 50);
    if (hit429) log.warn('[whales] positions rate limited', { n: hit429, of: universe.length, rotN });

    /* HOW LONG THIS POSITION HAS STOOD THERE rides on the published row: `since` is when it first stood in
       front of us and `sinceX` says whether we watched it open. A row with neither is published with
       neither - a reader must never be told a hold time we did not measure. */
    state.positions = found.slice(0, TOP_POSITIONS).map(p => {
      const s = sinceByKey.get(p.user + '|' + p.sym);
      return s ? { ...p, since: s.ts, sinceX: s.exact ? 1 : 0 } : p;
    });
    // the account totals for the wallets that are actually on the board, and nothing else - a map of 1,000
    // wallets would be most of the payload for rows nobody can see
    const onBoard = new Set(state.positions.map(p => p.user));
    for (const [u, v] of acctNow) acctByUser.set(u, v);
    for (const u of [...acctByUser.keys()]) if (!posByUser.has(u)) acctByUser.delete(u);
    state.wallets = {};
    for (const u of onBoard) { const a = acctByUser.get(u); if (a) state.wallets[u] = a; }
    /* the age of EVERY position held by a wallet that is on the board, not only of the forty rows we
       publish: a reader opens a whale and asks how long it has held each of them. Measured ~250 entries. */
    state.since = {};
    for (const [k, v] of sinceByKey) if (onBoard.has(k.slice(0, k.indexOf('|')))) state.since[k] = [v.ts, v.exact ? 1 : 0];
    state.posN = found.length;
    state.pos429 = pos429;
    state.rotN = rotN;
    state.sweptAt = nowTs;
    state.ts = nowTs;
    state.lastErr = '';
    recordPositions(nowTs); // hourly durable snapshot of the published board (008)
  } catch (e) { state.lastErr = 'poll: ' + String(e).slice(0, 120); log.warn('[whales] poll failed', { e: String(e).slice(0, 160) }); }
}
const alertOf = p => ({ user: p.user, sym: p.sym, long: p.long, liq: p.liq, val: p.val });

// ── the trade feed ────────────────────────────────────────────────────────────────────────────────
// dir on a perp fill is one of Open Long / Close Long / Open Short / Close Short / Long > Short /
// Short > Long. Spot fills say Buy / Sell and their coin is an index like "@107" - this is a futures
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
    liq: g.liq ? g.liq : undefined,         // how many of these fills the exchange took, not the owner
  });
}

// A fill does not carry leverage - it lives on the position. The 4-minute position poll is both too
// slow and too narrow for this (it only keeps positions over $1M), so a closed group asks the chain
// for the wallet's state directly. clearinghouseState weighs 2 against the 1200/min budget and this
// runs a couple of times a minute, which is why it is affordable to ask at publish time instead of
// printing "-" next to most rows (measured on the first live feed: 6 of 6 had no leverage).
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
      // clearinghouseState answers for the main perp book only - a builder-deployed market (the chain
      // lists those as "xyz:GOLD", "xyz:SP500") is not in it, so those rows keep an unknown leverage
      // and no position size. That is the honest answer, not a zero.
      for (const r of rows) if (r.user === u) { if (!r.lev) r.lev = lev.get(r.sym) || null; r.posUsd = Math.round(held.get(r.sym) || 0) || undefined; }
      // and remember what we just read, so the NEXT close on this coin has a number even when the position
      // itself is gone by then
      for (const [c, v] of lev) levSeen.set(u + '|' + c, { lev: v, ts: Date.now() });
    } catch (e) { /* no leverage is reported as unknown, never guessed */ }
    await new Promise(res => setTimeout(res, 40));
  }
  // A group is published when it goes QUIET, so publication order is not the order things happened: a
  // fifteen-minute execution surfaces after short trades that started later. The feed is sorted by when
  // the trade STARTED, which is the clock the row prints - the two must agree or the list reads as broken.
  /* A TRADE THAT CLOSED THE WHOLE POSITION LEAVES NOTHING TO READ - and that is exactly the row a reader
     asks about ("za closed positions ne pise koji je leverage"). The last reading taken WHILE the position
     was open is the honest answer, carried with the moment it was taken (`levAt`) so the page can say so.
     A reading older than LEV_MEM_MS is dropped rather than printed. */
  for (const r of rows) {
    if (!r.lev) {
      const m = levSeen.get(r.user + '|' + r.sym);
      if (m && Date.now() - m.ts < LEV_MEM_MS) { r.lev = m.lev; r.levAt = m.ts; }
    }
  }
  for (const r of rows) {
    const h = histByUser.get(r.user) || [];
    h.unshift(r);
    const cut = Date.now() - HIST_MS;
    histByUser.set(r.user, h.filter((x) => x.ts > cut).slice(0, HIST_N));
  }
  if (histByUser.size > FILL_TRACK_N * 4) { const keep = new Set(fillUniverse()); for (const u of histByUser.keys()) if (!keep.has(u)) histByUser.delete(u); }
  for (const r of rows) state.fills.push(r);
  state.fills.sort((a, b) => b.ts - a.ts);
  if (state.fills.length > MAX_FILLS) state.fills.length = MAX_FILLS;
  recordFills(rows); // the durable copy, after the live publish (008)
}

// Fold one wallet's fills into the open groups. Fills arrive newest-first from the API; we walk them
// oldest-first so a group grows forward in time the way the execution actually ran.
function foldFills(user, rows) {
  const fills = rows
    .filter(f => f && !String(f.coin || '').startsWith('@') && DIRS[f.dir])
    .map(f => ({ sym: String(f.coin), dir: f.dir, t: +f.time || 0, px: +f.px || 0, sz: Math.abs(+f.sz) || 0, pnl: +f.closedPnl || 0,
      /* THE EXCHANGE SAYS WHEN IT WAS NOT THEIR CHOICE, and we were dropping it. A fill carries a
         `liquidation` object when the position was taken by the exchange rather than closed by its owner -
         the single most interesting thing that can happen to a whale, printed until now as an ordinary
         close. It costs nothing: it is in the response we already read. */
      liq: (f.liquidation && String(f.liquidation.liquidatedUser || '').toLowerCase() === String(user).toLowerCase()) ? 1 : 0 }))
    .filter(f => f.t > 0 && f.px > 0 && f.sz > 0)
    .sort((a, b) => a.t - b.t);
  let newest = fillSeen.get(user) || 0;
  for (const f of fills) {
    if (f.t <= (fillSeen.get(user) || 0)) continue;   // already counted on an earlier sweep
    if (f.t > newest) newest = f.t;
    const k = user + '|' + f.sym + '|' + f.dir;
    const g = openGroup.get(k);
    if (g && f.t - g.last <= GROUP_MS) { g.usd += f.px * f.sz; g.sz += f.sz; g.last = f.t; g.n++; g.pnl += f.pnl; g.liq += f.liq; }
    else {
      if (g) { publishGroup(g); openGroup.delete(k); }
      openGroup.set(k, { user, sym: f.sym, dir: f.dir, usd: f.px * f.sz, sz: f.sz, first: f.t, last: f.t, n: 1, pnl: f.pnl, liq: f.liq });
    }
  }
  if (newest) fillSeen.set(user, newest);
}

// A group is published once nothing has been added to it for GROUP_MS - otherwise a trade still being
// executed would be printed at a third of its final size and never corrected.
function flushGroups(now) {
  for (const [k, g] of openGroup) if (now - g.last > GROUP_MS) { publishGroup(g); openGroup.delete(k); }
}

/* THE FEED MUST WATCH THE WALLETS A READER CAN OPEN (2026-10-28, measured). The fill set was the largest
   accounts by ACCOUNT VALUE while the board is ranked by POSITION SIZE, and those are not the same people:
   of the 82 wallets on the board, at most 18 were inside the fill set, so about four in five profiles a
   reader opened had an empty Live feed and an empty Closed tab - whatever the whale had actually done. The
   board's own wallets come first now and the largest accounts fill the rest of the quota. */
function fillUniverse() {
  const out = [], seen = new Set();
  for (const p of (state.positions || [])) { const u = p.user; if (u && !seen.has(u)) { seen.add(u); out.push(u); if (out.length >= FILL_TRACK_N) return out; } }
  for (const u of state.tracked) { if (!seen.has(u)) { seen.add(u); out.push(u); if (out.length >= FILL_TRACK_N) break; } }
  return out;
}
const FILL_IDLE = 2;          // idle wallets read per tick regardless of the stream, the safety net
const dirty = new Set();      // watched wallets the stream has seen trade since we last read them
let watchSet = new Set();
export function noteWhaleFill(user) { if (watchSet.has(user)) dirty.add(user); }
async function pollFills() {
  fill429 = 0; // fillErr speaks for this pass, not a lifetime counter (it read x20 after twenty hours and looked like an outage)
  const universe = fillUniverse();
  if (!universe.length) return;
  const now = Date.now();
  try {
    /* THE FREE TRADE STREAM SAYS WHO TRADED, SO ONLY THOSE ARE ASKED (2026-10-30). Every wallet on the watch list
       used to cost a userFillsByTime (weight 20+) whether it had done anything or not. `noteWhaleFill` marks a
       watched wallet the moment it prints; a couple of idle ones are still read each tick, so a stream gap
       or a wallet's first sighting costs minutes of delay and never a missed trade. */
    watchSet = new Set(universe.map((u) => String(u).toLowerCase()));
    const picks = [];
    for (const u of universe) { if (picks.length >= FILL_SLICE) break; if (dirty.has(String(u).toLowerCase())) picks.push(u); }
    for (let i = 0; i < FILL_IDLE && picks.length < FILL_SLICE; i++) { const u = universe[(fillCursor + i) % universe.length]; if (!picks.includes(u)) picks.push(u); }
    for (const user of picks) {
      dirty.delete(String(user).toLowerCase());
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
    fillCursor = (fillCursor + FILL_IDLE) % universe.length;
    flushGroups(now);
    await drainPending();
    state.fillTs = now;
    if (!fill429) state.fillErr = '';
    // wallets we no longer track must not keep their cursor for ever
    if (fillSeen.size > FILL_TRACK_N * 3) { const keep = new Set(universe); for (const k of fillSeen.keys()) if (!keep.has(k)) fillSeen.delete(k); }
  } catch (e) { state.fillErr = String(e).slice(0, 120); log.warn('[whales] fills poll failed', { e: String(e).slice(0, 160) }); }
}

/* WHAT IS PUBLISHED IS WRITTEN DOWN (2026-10-28, migration 008). Everything above lives in memory on purpose
   - the LIVE answer must not wait on a disk - but a restart emptied the whole feed and the 120-row ring held
   about 2.4 hours of the entire market, so a whale's trade from noon was gone by evening. Two writes, both
   AFTER the in-memory publish and both inside their own try: a published trade group goes into whale_fill
   the moment it is published, and the published board goes into whale_pos once an hour. The store is handed
   in by index.js; with none (tests, the e2e harness) nothing here changes. */
let whaleStore = null;
let lastPosSnap = 0;
const POS_SNAP_MS = 3600e3;
function recordFills(rows) {
  if (!whaleStore || !whaleStore.insertWhaleFills || !rows.length) return;
  try { const n = whaleStore.insertWhaleFills(rows); if (n) log.info('[whales] fills recorded', { n }); } catch (e) { log.warn('[whales] fills record failed', { e: String(e).slice(0, 120) }); }
}
function recordPositions(nowTs) {
  if (!whaleStore || !whaleStore.insertWhalePos || !state.positions.length) return;
  if (nowTs - lastPosSnap < POS_SNAP_MS) return;
  lastPosSnap = nowTs;
  try { const n = whaleStore.insertWhalePos(nowTs, state.positions, state.wallets || {}); log.info('[whales] positions snapshot', { n }); } catch (e) { log.warn('[whales] position snapshot failed', { e: String(e).slice(0, 120) }); }
}
export function startWhales(storage) {
  whaleStore = storage || null;
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
  // publish without asking the chain for leverage - the grouping is what is under test here
  flushLocal(now) { flushGroups(now); const rows = pending.splice(0, pending.length); for (const r of rows) state.fills.push(r); state.fills.sort((a, b) => b.ts - a.ts); if (state.fills.length > MAX_FILLS) state.fills.length = MAX_FILLS; },
  reset(lev) { state.fills = []; openGroup.clear(); fillSeen.clear(); pending.length = 0; levByKey = new Map(Object.entries(lev || {})); },
  consts: { GROUP_MS, MIN_TRADE_USD, MAX_FILLS, FILL_TRACK_N },
};
/* PUBLISH A TRACK RECORD ONLY FOR WALLETS THAT ARE ON SCREEN. `perf` used to go out whole; at 150 wallets
   that was ~22 KB, at 1,000 it would be ~150 KB on an endpoint the whole site edge-caches and every chart
   asks for. The page only ever looks a wallet up when it is already showing it. */
function perfShown() {
  const want = new Set();
  for (const p of state.positions) want.add(p.user);
  for (const f of state.fills) want.add(f.user);
  for (const b of state.best) want.add(b.user);
  for (const a of state.alerts) if (a.user) want.add(a.user);
  const out = {};
  for (const u of want) if (state.perf[u]) out[u] = state.perf[u];
  return out;
}
/* ONE WALLET'S OWN TRADES, asked for by the profile route alone - never folded into /api/v1/whales, which
   every page load fetches and which is already 122 KB. */
export function getWhaleOne(addr) {
  const a = String(addr || '').toLowerCase();
  const cut = Date.now() - HIST_MS;
  return { a, ts: Date.now(), fills: (histByUser.get(a) || []).filter((x) => x.ts > cut), min: MIN_TRADE_USD, keep: HIST_N, watched: fillUniverse().indexOf(a) >= 0 };
}
export function getWhales() {
  return {
    ts: state.ts, lbTs: state.lbTs, tracked: state.tracked.length, positions: state.positions, alerts: state.alerts,
    fills: state.fills, fillTs: state.fillTs, fillWatch: Math.min(FILL_TRACK_N, state.tracked.length), fillMin: MIN_TRADE_USD,
    coins: state.coins, best: state.best, perf: perfShown(),
    wallets: state.wallets || {},
    // THIS FUNCTION IS A WHITELIST: a field added to `state` and not named here is published nowhere, which
    // is how `alerts.kind` stayed invisible for a month. `since` = "user|coin" -> [first seen, we watched it open]
    since: state.since || {},
    posN: state.posN || 0, core: Math.min(CORE_N, state.tracked.length),
    pos429: state.pos429 || 0, rotN: state.rotN != null ? state.rotN : ROTATE_N,
    sweepMin: state.tracked.length > CORE_N ? Math.round(((state.tracked.length - CORE_N) / Math.max(1, ROTATE_N)) * 4) : 0,
    err: state.lastErr || undefined, fillErr: state.fillErr || undefined,
  };
}

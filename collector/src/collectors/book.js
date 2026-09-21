// ORDER BOOK (2026-09-21). The first data on this collector that is STATE rather than events: a book is
// only correct if every update since the snapshot was applied, in order, with nothing missed. A liquidation
// that goes missing is one missing row; a book update that goes missing is a book that is quietly WRONG
// from then on, and nothing about it looks broken. So this module's whole job is to be able to prove it is
// right, and to refuse to serve the book the moment it cannot.
//
// WHAT WAS MEASURED BEFORE ANY OF THIS WAS WRITTEN (2026-09-21, live sockets, no API key):
//
//   venue        levels  covers        best-bid unit          gap proof
//   bybit           400  +/-0.04%      base (BTC)             u increments by exactly 1
//   okx             800  +/-0.07%      CONTRACTS x ctVal      prevSeqId == previous seqId
//   bitget         1000  +/-0.24%      base (BTC)             pseq == previous seq  (verified 7/7)
//   hyperliquid      40  +/-0.023%     base (BTC)             full snapshot every message - no deltas
//
// Three findings from that measurement shaped everything here:
//
//  1. THE BOOK COVERS A HAIR, NOT A RANGE. 200 Bybit levels on BTC span four hundredths of one percent.
//     Any model that bins to +/-2% would be almost entirely empty. So we publish DEPTH AT DISTANCE and a
//     SLIPPAGE CURVE - what the book actually answers - and never a "liquidity within 2%" figure.
//  2. EVERY VENUE USES A DIFFERENT SIZE UNIT. OKX quotes contracts (ctVal 0.01 BTC), so a naive
//     price x size read $1.25 BILLION of bids where the truth is $12.5M. Deribit quotes USD and was
//     LEFT OUT of this first cut for exactly that reason: its unit could not be proven from the feed
//     alone, and an unprovable number does not ship.
//  3. HYPERLIQUID'S fast:true COSTS DEPTH. fast = 5 levels a side at 1.9/s; default = 20 levels at
//     0.24/s. For a depth product the depth wins, so this subscribes WITHOUT fast.
//
// BINANCE JOINED ON 2026-09-21 and is the fifth venue. It sends deltas with no snapshot on the wire, so
// its book is bootstrapped from REST with the differences that arrived during the request replayed onto it
// - a genuinely more delicate mechanism, which is why it was built second and on its own rather than in the
// first drop, where one bootstrap bug could have taken down four venues that need no bootstrap at all.
// Gate and MEXC can follow by the same route. Deribit stays out: its size unit is not provable from the feed.
import { BaseCollector } from './base.js';
import { log } from '../logger.js';

// Depth ladders we publish, in basis points from mid. The first ladder was 5/10/25/50 and the proof run
// showed why that was wrong: Bybit's whole 400-level book fits inside 5bp, so every rung reported the same
// ,149,727 and the ladder carried no information at all. Measured coverage is 0.02%-0.24%, i.e. 2-24bp,
// so the rungs belong there. 25bp is past what Bybit and Hyperliquid carry and stays deliberately - a rung
// a venue cannot fill is a fact about that venue.
export const DEPTH_BPS = [1, 2, 5, 10, 25];
// Order sizes the slippage curve is computed for, in USD. These are the sizes our own traders actually
// use - the paper engine's whole point is that a $250k order should not fill like a $10k one.
export const SLIP_USD = [10000, 50000, 250000];

// A DEPTH CURVE NEEDS RUNGS, NOT FIVE POINTS (2026-09-21). `depthUsd` keeps answering "how much within
// 25 bps" for every consumer the published API already has and does not move. This is the same walk on a
// much finer grid, so a page can draw the SHAPE of a book instead of a bar chart of five numbers.
export const LADDER_BPS = [0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 14, 18, 25, 35, 50, 75, 100];

const num = (v) => { const n = +v; return Number.isFinite(n) ? n : NaN; };

// ---------------------------------------------------------------------------------------------------
// Venue adapters. Each one converts the venue's wire format into ONE shape:
//   { sym, type: 'snapshot'|'delta', seq, prevSeq, bids: [[price, baseSize], ...], asks: [...], ts }
// `seq` and `prevSeq` are what lets us prove no message was missed. A venue that cannot prove it does
// not belong in this file.
// ---------------------------------------------------------------------------------------------------
const ADAPTERS = {
  bybit: {
    url: 'wss://stream.bybit.com/v5/public/linear',
    // 200 levels at 100ms. The 500-level channel never delivered a snapshot in testing.
    subs: (syms) => [{ op: 'subscribe', args: syms.map((s) => `orderbook.200.${s}USDT`) }],
    ping: () => ({ op: 'ping' }),
    parse(raw) {
      const j = JSON.parse(raw);
      if (!j.topic || !/^orderbook\./.test(j.topic) || !j.data) return [];
      const sym = String(j.data.s || '').replace(/USDT$/, '');
      return [{ sym, type: j.type === 'snapshot' ? 'snapshot' : 'delta', seq: num(j.data.u), prevSeq: null,
        bids: j.data.b || [], asks: j.data.a || [], ts: num(j.cts) || Date.now() }];
    },
    // Bybit's `u` increments by exactly one per message on a healthy stream - measured across 14 in a row.
    gapOk: (prevSeq, u) => u === prevSeq + 1,
  },

  okx: {
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    subs: (syms) => [{ op: 'subscribe', args: syms.map((s) => ({ channel: 'books', instId: `${s}-USDT-SWAP` })) }],
    ping: () => 'ping',
    // `sz` is in CONTRACTS. The same quirk collectors/okx.js already documents for liquidations; ctVal is
    // fetched once in init() and a symbol without one is DROPPED rather than counted at 100x.
    parse(raw, ctx) {
      if (raw === 'pong') return [];
      const j = JSON.parse(raw);
      if (!j.arg || j.arg.channel !== 'books' || !j.data || !j.data[0]) return [];
      const inst = j.arg.instId || '';
      const ct = ctx.ctVal[inst];
      if (!(ct > 0)) return [];
      const sym = inst.replace(/-USDT-SWAP$/, '');
      const d = j.data[0];
      const conv = (rows) => (rows || []).map((r) => [r[0], num(r[1]) * ct]);
      return [{ sym, type: j.action === 'snapshot' ? 'snapshot' : 'delta', seq: num(d.seqId), prevSeq: num(d.prevSeqId),
        bids: conv(d.bids), asks: conv(d.asks), ts: num(d.ts) || Date.now() }];
    },
    gapOk: (prevSeq, _seq, prevLink) => prevLink === prevSeq,
  },

  bitget: {
    url: 'wss://ws.bitget.com/v2/ws/public',
    subs: (syms) => [{ op: 'subscribe', args: syms.map((s) => ({ instType: 'USDT-FUTURES', channel: 'books', instId: `${s}USDT` })) }],
    ping: () => 'ping',
    parse(raw) {
      if (raw === 'pong') return [];
      const j = JSON.parse(raw);
      if (!j.arg || j.arg.channel !== 'books' || !j.data || !j.data[0]) return [];
      const sym = String(j.arg.instId || '').replace(/USDT$/, '');
      const d = j.data[0];
      return [{ sym, type: j.action === 'snapshot' ? 'snapshot' : 'delta', seq: num(d.seq), prevSeq: num(d.pseq),
        bids: d.bids || [], asks: d.asks || [], ts: num(d.ts) || Date.now() }];
    },
    gapOk: (prevSeq, _seq, prevLink) => prevLink === prevSeq,
  },

  hyperliquid: {
    url: 'wss://api.hyperliquid.xyz/ws',
    // NOT fast:true - measured, fast trades 20 levels a side for 5. Depth is the product here.
    subs: (syms) => syms.map((s) => ({ method: 'subscribe', subscription: { type: 'l2Book', coin: s } })),
    ping: () => ({ method: 'ping' }),
    parse(raw) {
      const j = JSON.parse(raw);
      if (j.channel !== 'l2Book' || !j.data || !j.data.levels) return [];
      const lv = j.data.levels;
      const side = (arr) => (arr || []).map((x) => [x.px, x.sz]);
      // Every message is the whole book, so there is no sequence to break and no gap to detect.
      return [{ sym: String(j.data.coin || '').toUpperCase(), type: 'snapshot', seq: null, prevSeq: null,
        bids: side(lv[0]), asks: side(lv[1]), ts: num(j.data.time) || Date.now() }];
    },
    gapOk: () => true,
  },
  // BINANCE - the biggest book in crypto, and the one this module deliberately left out at first.
  // Every other venue here ships a snapshot down the socket, so a fresh subscription IS a fresh book.
  // Binance sends ONLY differences, so the book has to be bootstrapped from REST and the differences that
  // arrived while that request was in flight have to be replayed onto it in order. That is a genuinely
  // more delicate mechanism - it can fail in ways the others cannot - which is why it was built second and
  // on its own. It is not optional though: leaving out Binance and calling the result a consolidated book
  // would be the kind of number this whole module exists to avoid.
  //
  // Binance's own documented procedure, followed exactly:
  //   1. open the stream and BUFFER every event
  //   2. GET /fapi/v1/depth?limit=1000 -> lastUpdateId
  //   3. discard buffered events whose final id `u` is older than lastUpdateId
  //   4. the first event applied must STRADDLE it: U <= lastUpdateId AND u >= lastUpdateId
  //   5. from there every event's `pu` must equal the previous event's `u`, or the chain is broken
  // Steps 4 and 5 are the same prev-link proof OKX and Bitget already carry; only 1-3 are new.
  binance: {
    url: 'wss://fstream.binance.com/ws',
    // 500ms, NOT 100ms. MEASURED on the droplet, which has ONE vCPU: with the book and tape live the
    // SQLite reader thread's slow reads on the public liquidation API went from ~115 an hour to ~250 - the
    // main thread was taking the core away from it. Binance is the busiest book of the five, and the page
    // above polls every two seconds, so a tenth-of-a-second stream buys nothing a reader can see while
    // costing five times the messages. The venue does the aggregating for us and the book stays exact -
    // every delta in the slower stream is still complete and still sequence-checked.
    subs: (syms) => [{ method: 'SUBSCRIBE', params: syms.map((s) => s.toLowerCase() + 'usdt@depth@500ms'), id: 1 }],
    parse(raw) {
      const j = JSON.parse(raw);
      if (j.e !== 'depthUpdate' || !j.s) return [];
      return [{
        sym: String(j.s).replace(/USDT$/, ''), type: 'delta',
        seq: num(j.u), prevSeq: num(j.pu), firstSeq: num(j.U),
        bids: j.b || [], asks: j.a || [], ts: num(j.E) || Date.now(),
      }];
    },
    gapOk: (prevSeq, _seq, prevLink) => prevLink === prevSeq,
    needsSnapshot: true,
    async snapshot(sym) {
      const r = await fetch('https://fapi.binance.com/fapi/v1/depth?symbol=' + sym + 'USDT&limit=1000', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;
      const j = await r.json();
      if (!(num(j.lastUpdateId) > 0) || !Array.isArray(j.bids)) return null;
      return { seq: num(j.lastUpdateId), bids: j.bids, asks: j.asks };
    },
  },
};

export const BOOK_VENUES = Object.keys(ADAPTERS);

// ---------------------------------------------------------------------------------------------------
// One side of one book. A plain Map keyed by the price STRING exactly as the venue sent it - re-parsing
// a float and using it as a key is how "85994.60" and "85994.6" become two levels that never cancel.
// ---------------------------------------------------------------------------------------------------
function applySide(map, rows) {
  for (const r of rows) {
    const px = String(r[0]);
    const sz = num(r[1]);
    if (!Number.isFinite(sz) || sz <= 0) map.delete(px);
    else map.set(px, sz);
  }
}

function sortedSide(map, desc) {
  const out = [];
  for (const [px, sz] of map) out.push([+px, sz]);
  out.sort(desc ? (a, b) => b[0] - a[0] : (a, b) => a[0] - b[0]);
  return out;
}

/**
 * Everything a reader is allowed to know about one book, derived at read time so nothing is stored twice.
 * Returns null when the book is not provably correct - silence beats a plausible wrong number.
 */
export function summarize(book, skewMs, topN) {
  if (!book || !book.ok) return null;
  // SORT ONCE PER CHANGE, NOT ONCE PER READER. Both sides were re-sorted on every API read, and the
  // terminal above this now polls every two seconds across five venues and a thousand levels each. The
  // sorted arrays are cached on the book itself and thrown away by _apply the moment anything moves, so
  // a hundred readers in the same second cost one sort rather than a hundred - and the cache can never
  // serve a stale order, because the thing that would make it stale is what clears it.
  if (!book._sb || book._sv !== book.seq || book._st !== book.rxAt) {
    book._sb = sortedSide(book.bids, true);
    book._sa = sortedSide(book.asks, false);
    book._sv = book.seq; book._st = book.rxAt;
  }
  const bids = book._sb;
  const asks = book._sa;
  if (!bids.length || !asks.length) return null;
  const bestBid = bids[0][0], bestAsk = asks[0][0];
  if (!(bestBid > 0) || !(bestAsk > 0) || bestAsk <= bestBid) return null; // a crossed book is a broken book
  const mid = (bestBid + bestAsk) / 2;

  const depth = {};
  for (const bp of DEPTH_BPS) {
    const lo = mid * (1 - bp / 10000), hi = mid * (1 + bp / 10000);
    let b = 0, a = 0;
    for (const [px, sz] of bids) { if (px < lo) break; b += px * sz; }
    for (const [px, sz] of asks) { if (px > hi) break; a += px * sz; }
    depth['bid_' + bp] = Math.round(b);
    depth['ask_' + bp] = Math.round(a);
  }

  // Walk the book for a real market order. Returns null when the book cannot fill that size at all -
  // which is itself the answer, and a far more honest one than extrapolating past the last level.
  const walk = (side, usd) => {
    let left = usd, cost = 0, qty = 0;
    for (const [px, sz] of side) {
      const lvlUsd = px * sz;
      const take = Math.min(left, lvlUsd);
      qty += take / px; cost += take; left -= take;
      if (left <= 0) break;
    }
    if (left > 0 || qty <= 0) return null;
    const avg = cost / qty;
    return Math.round(Math.abs(avg - mid) / mid * 1000000) / 100; // bps, 2dp
  };
  const slip = {};
  for (const usd of SLIP_USD) {
    slip['buy_' + usd] = walk(asks, usd);
    slip['sell_' + usd] = walk(bids, usd);
  }

  // Cumulative dollars per side at each rung, in ONE pass over the already-sorted side. A rung further
  // out than the book itself reaches is **null**, never the running total: a flat tail would read as "no
  // more liquidity out there", which is a claim about the market when it is only a fact about our coverage.
  const ladderOf = (side, up) => {
    const out = []; let acc = 0, i = 0;
    const edge = side.length ? side[side.length - 1][0] : mid;
    for (const bp of LADDER_BPS) {
      const lim = up ? mid * (1 + bp / 10000) : mid * (1 - bp / 10000);
      while (i < side.length && (up ? side[i][0] <= lim : side[i][0] >= lim)) { acc += side[i][0] * side[i][1]; i++; }
      out.push((up ? lim > edge : lim < edge) ? null : Math.round(acc));
    }
    return out;
  };

  return {
    mid: Math.round(mid * 1e6) / 1e6,
    bestBid, bestAsk,
    spreadBps: Math.round((bestAsk - bestBid) / mid * 1000000) / 100,
    levels: bids.length + asks.length,
    coverBelowPct: Math.round((bestBid - bids[bids.length - 1][0]) / mid * 1e6) / 1e4,
    coverAbovePct: Math.round((asks[asks.length - 1][0] - bestAsk) / mid * 1e6) / 1e4,
    // The raw top of the book, opt-in. A depth curve can be drawn from the ladder above, but a real
    // order-book LADDER - price, size, running total, the way every exchange terminal shows it - needs the
    // levels themselves. Off by default so the published response stays small for everything else.
    top: topN > 0 ? { bid: bids.slice(0, topN), ask: asks.slice(0, topN) } : undefined,
    depthUsd: depth,
    ladderBps: LADDER_BPS,
    ladderUsd: { bid: ladderOf(bids, false), ask: ladderOf(asks, true) },
    slipBps: slip,
    seq: book.seq,
    venueTs: book.ts,                 // the venue's own clock, for provenance only
    ts: book.rxAt,                    // when WE received it - the only clock we can trust
    ageMs: Date.now() - book.rxAt,
    venueSkewMs: skewMs == null ? null : skewMs,
  };
}

// ---------------------------------------------------------------------------------------------------
export class BookCollector extends BaseCollector {
  constructor(venue, { symbols, onState } = {}) {
    super('book:' + venue, { symbols, onState });
    this.venue = venue;
    this.ad = ADAPTERS[venue];
    if (!this.ad) throw new Error('unknown book venue ' + venue);
    this.books = new Map();     // sym -> { bids, asks, seq, ts, ok }
    this.ctVal = {};            // okx only
    this.boots = 0; this.bootFails = 0;   // venues that need a REST snapshot (binance)
    this.applied = 0; this.gaps = 0; this.resyncs = 0; this.dropped = 0;
    this.lastGapAt = 0;
    // CLOCK SKEW IS REAL AND IT WILL LIE TO YOU (found 2026-09-21 building this). Freshness was first
    // computed as `now - venueTimestamp`, and every book on every venue read as stale - because the host
    // clock was 31.8 seconds ahead of real time, confirmed against an HTTP Date header. On a droplet with
    // drifting NTP that bug is invisible and permanent. Freshness is therefore measured with OUR receive
    // time and nothing else; the venue's timestamp is kept only as provenance, and the observed skew is
    // published so the drift itself becomes visible instead of becoming a mystery outage.
    this.maxBookAgeMs = 30000;
    this.skewMs = null;         // venue clock minus ours, smoothed - diagnostic only, never used for logic
    this.staleMs = 90000;       // BaseCollector reconnects if no APPLIED update in this long
  }

  async init() {
    if (this.venue !== 'okx') return;
    // Contract values, same source collectors/okx.js uses. Without these OKX sizes are 100x wrong, so a
    // failure here must leave the venue silent rather than loud and incorrect.
    try {
      const r = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP');
      const j = await r.json();
      let n = 0;
      for (const it of (j.data || [])) {
        if (/^[A-Z0-9]+-USDT-SWAP$/.test(it.instId || '')) { this.ctVal[it.instId] = parseFloat(it.ctVal) || 0; n++; }
      }
      log.info(`[${this.name}] contract values loaded`, { n });
    } catch (e) {
      log.error(`[${this.name}] ctVal fetch failed - venue will stay silent`, { e: String(e) });
    }
  }

  url() { return this.ad.url; }
  subscribeFrames() { return this.ad.subs(this.symbols); }
  pingFrame() { return this.ad.ping ? this.ad.ping() : null; }

  parse(raw) {
    let ups;
    try { ups = this.ad.parse(typeof raw === 'string' ? raw : String(raw), this); } catch (e) { return []; }
    for (const u of ups || []) this._apply(u);
    return []; // a book is state, not a stream of events - nothing is emitted onto the bus
  }

  _apply(u) {
    if (!u || !u.sym || !this.symbols.includes(u.sym)) return;
    let b = this.books.get(u.sym);
    if (!b) { b = { bids: new Map(), asks: new Map(), seq: null, ts: 0, rxAt: 0, ok: false }; this.books.set(u.sym, b); }

    if (u.type === 'snapshot') {
      b.bids.clear(); b.asks.clear();
      applySide(b.bids, u.bids); applySide(b.asks, u.asks);
      b.seq = u.seq; b.ts = u.ts; b.rxAt = Date.now(); b.ok = true;
      this._skew(u.ts);
      this.applied++; this.lastEventAt = b.rxAt;  // BaseCollector's stale watchdog reads this
      return;
    }

    // A delta against a book we never snapshotted, or one already known bad, is discarded. It cannot be
    // applied and guessing would be the whole failure mode this module exists to prevent.
    if (b.seq == null && !b.ok) {
      if (this.ad.needsSnapshot) { this._buffer(u, b); return; }
      this.dropped++; return;
    }

    // THE ONE TOLERATED ATTACHMENT, and it is bounded and recorded. A book accepted straight from a REST
    // snapshot has no event chaining it to the stream yet, so the very next delta legitimately fails the
    // prev-link test. It is allowed through exactly once, and only if it is genuinely NEWER than the
    // snapshot - an older one would still be a hole. After that the chain is proved like every other venue's.
    if (b.softSeq) {
      b.softSeq = false;
      if (u.seq > b.seq) {
        applySide(b.bids, u.bids); applySide(b.asks, u.asks);
        b.seq = u.seq; b.ts = u.ts; b.rxAt = Date.now(); b.ok = true;
        this._skew(u.ts); this.applied++; this.lastEventAt = b.rxAt;
        return;
      }
    }

    if (!this.ad.gapOk(b.seq, u.seq, u.prevSeq)) {
      // The stream skipped. Everything after this point would be built on a book that is missing a change,
      // so the book is invalidated and a fresh snapshot is demanded by reconnecting the socket.
      //  is read BEFORE the book is invalidated. It used to be printed after b.seq was already set
      // to null, so every gap in the log claimed we had been holding nothing - which hides the one number
      // that says whether the stream skipped by one or by thousands.
      const had = b.seq;
      this.gaps++; this.lastGapAt = Date.now();
      b.ok = false; b.seq = null; b.booting = false; b.buf = [];
      log.warn(`[${this.name}] sequence gap on ${u.sym} - invalidating book and resyncing`, { had: had, got: u.seq, prev: u.prevSeq });
      this._resync();
      return;
    }

    applySide(b.bids, u.bids); applySide(b.asks, u.asks);
    b.seq = u.seq; b.ts = u.ts; b.rxAt = Date.now(); b.ok = true;
    this._skew(u.ts);
    this.applied++; this.lastEventAt = b.rxAt;
  }

  // A venue that sends only differences has no book until REST gives it one. Everything that arrives in
  // the meantime is kept, in order, and replayed onto the snapshot - dropping it would leave a hole exactly
  // the size of the round trip, which on a 100ms stream is dozens of changes.
  _buffer(u, b) {
    if (!b.buf) b.buf = [];
    b.buf.push(u);
    if (b.buf.length > 900) b.buf.splice(0, b.buf.length - 900);  // ~90s of a 100ms stream; a boot never takes that
    if (b.booting) return;
    // A FAILED BOOTSTRAP MUST NOT BE RETRIED BY THE NEXT MESSAGE. Without this, a stream arriving every
    // 100 ms asks REST for a fresh snapshot TEN TIMES A SECOND for as long as it keeps failing - and this
    // machine earned a real HTTP 418 from Binance that way while the suite was being written ("IP banned
    // until ..."). On the droplet that IP also carries the Binance liquidation feed, so the punishment for
    // hammering would land on Rekt, not here. Exponential backoff, capped, per symbol.
    const now = Date.now();
    const wait = Math.min(30000, 1500 * Math.pow(2, Math.min(5, b.bootTries || 0)));
    if (b.bootAt && now - b.bootAt < wait) return;
    // AND A FLOOR ACROSS THE WHOLE VENUE, because the per-symbol backoff is per symbol. Measured with three
    // symbols against a real ban: 12 requests in 40 s, which is fine - but the same code on ten symbols is
    // 40, and each /depth?limit=1000 costs Binance weight 20 against a 2400/minute budget. The venue-wide
    // floor means the request rate is bounded by the venue, not by how many symbols happen to be listed.
    if (this._bootAt && now - this._bootAt < 500) return;
    b.bootAt = now; this._bootAt = now; b.booting = true;
    this._bootstrap(u.sym);
  }

  async _bootstrap(sym) {
    const b = this.books.get(sym);
    if (!b) return;
    let snap = null;
    try { snap = await this.ad.snapshot(sym); } catch (e) { snap = null; }
    const b2 = this.books.get(sym);
    if (!b2 || b2 !== b) return;               // the book was replaced under us; the new one will boot itself
    if (!snap) { this.bootFails++; b.bootTries = (b.bootTries || 0) + 1; b.booting = false; return; }  // the next delta starts another attempt

    const bids = new Map(), asks = new Map();
    applySide(bids, snap.bids); applySide(asks, snap.asks);

    // Everything the snapshot already contains is noise; what is left must begin with the one event that
    // straddles it, or the snapshot and the stream do not meet and the whole attempt is void.
    const buf = (b.buf || []).filter((x) => x.seq >= snap.seq);
    let seq = snap.seq, started = false, ts = 0;
    for (const x of buf) {
      if (!started) {
        if (!(x.firstSeq <= snap.seq && x.seq >= snap.seq)) continue;
        started = true;
      } else if (x.prevSeq !== seq) {
        // The chain broke inside the replay. Applying the rest would build on a missing change, so the
        // attempt is abandoned rather than patched - the next delta triggers a fresh snapshot.
        this.bootFails++; b.bootTries = (b.bootTries || 0) + 1; b.booting = false; b.buf = [];
        log.warn(`[${this.name}] bootstrap replay broke on ${sym} - retrying`, { had: seq, got: x.prevSeq });
        return;
      }
      applySide(bids, x.bids); applySide(asks, x.asks);
      seq = x.seq; ts = x.ts;
    }
    if (!started) {
      // TWO DIFFERENT SITUATIONS LOOK THE SAME HERE, AND TREATING THEM ALIKE COST BTC AND ETH THEIR BOOKS.
      //  - the buffer still holds events after the filter but none straddles the snapshot: the snapshot is
      //    OLDER than the stream we hold, so a change in between is missing. That is a real hole: retry.
      //  - the filter emptied the buffer: the snapshot is NEWER than everything that arrived during the
      //    request, which is the ordinary outcome on a busy symbol. Nothing is missing at all - the snapshot
      //    IS the book, and the next live event continues from it. Measured: SOL booted first time this way
      //    while BTC and ETH, which move far faster, never found a straddling event and retried for ever.
      if (buf.length) { this.bootFails++; b.bootTries = (b.bootTries || 0) + 1; b.booting = false; b.buf = []; return; }
      // Accept the snapshot and let ONE live event attach to it, verified below rather than assumed.
      b.softSeq = true;
    }

    b.bids = bids; b.asks = asks; b.seq = seq; b.ts = ts || Date.now(); b.rxAt = Date.now(); b.ok = true;
    b.buf = []; b.booting = false; b.bootTries = 0;
    this.boots++;
    this.applied++; this.lastEventAt = b.rxAt;
    log.info(`[${this.name}] book bootstrapped for ${sym}`, { seq: seq, replayed: buf.length });
  }

  // Exponentially smoothed difference between the venue's clock and ours. Pure diagnostic - it is
  // published on /status so a drifting host clock is visible, and it never gates anything.
  _skew(venueTs) {
    if (!(venueTs > 0)) return;
    const d = venueTs - Date.now();
    this.skewMs = this.skewMs == null ? d : Math.round(this.skewMs * 0.9 + d * 0.1);
  }

  // Every venue here re-sends a snapshot on a new subscription, so a reconnect IS the resync. Throttled:
  // a venue having a bad minute must not turn into a reconnect loop that makes it worse.
  _resync() {
    const now = Date.now();
    if (this._lastResyncAt && now - this._lastResyncAt < 5000) return;
    this._lastResyncAt = now;
    this.resyncs++;
    try { this.ws && this.ws.close(); } catch {}
  }

  /**
   * The bid side as sorted [price, baseSize] pairs. Exists so the proof harness can diff our book against
   * the venue's own REST book level by level - which is the only comparison that is actually invariant.
   */
  rawBids(sym) {
    const b = this.books.get(sym);
    if (!b || !b.ok) return null;
    return sortedSide(b.bids, true);
  }

  /** One symbol's book, or null if it cannot be proven correct right now. */
  read(sym, topN) {
    const b = this.books.get(sym);
    if (!b || !b.ok) return null;
    if (Date.now() - b.rxAt > this.maxBookAgeMs) return null;  // alive socket, dead subscription
    return summarize(b, this.skewMs, topN);
  }

  status() {
    const base = super.status();
    const syms = {};
    for (const s of this.symbols) {
      const b = this.books.get(s);
      // 'ok' has to mean the same thing here as it does at read() or ops is told a book is fine while the
      // API serves nothing. Found by deliberately breaking deletions: the book crossed, read() refused it
      // (correctly) and status still said ok. summarize() is the one judge.
      syms[s] = !b ? 'none'
        : !b.ok ? 'invalid'
          : (Date.now() - b.rxAt > this.maxBookAgeMs) ? 'stale'
            : summarize(b) ? 'ok' : 'crossed';
    }
    return { ...base, venue: this.venue, applied: this.applied, gaps: this.gaps, resyncs: this.resyncs,
      boots: this.boots, bootFails: this.bootFails,
      dropped: this.dropped, lastGapMs: this.lastGapAt ? Date.now() - this.lastGapAt : null, venueSkewMs: this.skewMs, books: syms };
  }
}

export function createBookCollectors({ symbols, onState }) {
  return BOOK_VENUES.map((v) => new BookCollector(v, { symbols, onState }));
}

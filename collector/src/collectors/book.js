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
// Deliberately NOT here: Binance, Gate and MEXC. All three send deltas with no snapshot on the wire and
// need a REST bootstrap with a buffered-replay handshake. That is a second, isolated step - putting it in
// the same first drop would mean one bootstrap bug could take down four venues that do not need one.
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
export function summarize(book, skewMs) {
  if (!book || !book.ok) return null;
  const bids = sortedSide(book.bids, true);
  const asks = sortedSide(book.asks, false);
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
    if (b.seq == null && !b.ok) { this.dropped++; return; }

    if (!this.ad.gapOk(b.seq, u.seq, u.prevSeq)) {
      // The stream skipped. Everything after this point would be built on a book that is missing a change,
      // so the book is invalidated and a fresh snapshot is demanded by reconnecting the socket.
      this.gaps++; this.lastGapAt = Date.now();
      b.ok = false; b.seq = null;
      log.warn(`[${this.name}] sequence gap on ${u.sym} - invalidating book and resyncing`, { had: b.seq, got: u.seq, prev: u.prevSeq });
      this._resync();
      return;
    }

    applySide(b.bids, u.bids); applySide(b.asks, u.asks);
    b.seq = u.seq; b.ts = u.ts; b.rxAt = Date.now(); b.ok = true;
    this._skew(u.ts);
    this.applied++; this.lastEventAt = b.rxAt;
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
  read(sym) {
    const b = this.books.get(sym);
    if (!b || !b.ok) return null;
    if (Date.now() - b.rxAt > this.maxBookAgeMs) return null;  // alive socket, dead subscription
    return summarize(b, this.skewMs);
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
      dropped: this.dropped, lastGapMs: this.lastGapAt ? Date.now() - this.lastGapAt : null, venueSkewMs: this.skewMs, books: syms };
  }
}

export function createBookCollectors({ symbols, onState }) {
  return BOOK_VENUES.map((v) => new BookCollector(v, { symbols, onState }));
}

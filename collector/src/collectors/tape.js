// TRADE TAPE (2026-09-21). The book says what is STANDING; the tape says what was EXECUTED. A wall that
// was pulled and a wall that was eaten look identical in the book and opposite in the tape - which is why
// these two belong together and why neither is finished alone.
//
// Unlike the book, a trade is a self-contained fact: there is no snapshot to bootstrap and no sequence to
// break, so a missed message costs one row rather than corrupting everything after it. That is why Binance
// is here from day one while the book has to wait for its REST bootstrap.
//
// THE ONE THING THAT MUST NOT BE WRONG IS THE AGGRESSOR SIDE. Every venue encodes it differently and
// getting it backwards inverts cumulative delta silently: the number stays perfectly plausible and is
// exactly wrong. Each mapping below was read off real payloads, and Hyperliquid's was settled by
// MEASUREMENT because its documentation does not say:
//
//   bybit        S: "Buy" | "Sell"        already the taker side
//   okx          side: "buy" | "sell"     already the taker side   (sz is in CONTRACTS - x ctVal)
//   bitget       side: "buy" | "sell"     already the taker side
//   binance      m: true  -> taker SOLD   ("buyer is the market maker")
//   hyperliquid  side: "A" -> taker SOLD, "B" -> taker BOUGHT
//
// That last line is the inverse of the obvious reading. Measured over 90 seconds and 243 trades against
// Hyperliquid's own mid at the moment of each print: side "A" landed BELOW the mid 94% of the time and
// side "B" landed ABOVE it 81% of the time. An aggressive buy lifts the ask; an aggressive sell hits the
// bid. So "A" is a seller hitting the bid, whatever the letter suggests.
import { BaseCollector } from './base.js';
import { log } from '../logger.js';

const num = (v) => { const n = +v; return Number.isFinite(n) ? n : NaN; };

const ADAPTERS = {
  bybit: {
    url: 'wss://stream.bybit.com/v5/public/linear',
    subs: (syms) => [{ op: 'subscribe', args: syms.map((s) => `publicTrade.${s}USDT`) }],
    ping: () => ({ op: 'ping' }),
    parse(raw) {
      const j = JSON.parse(raw);
      if (!j.topic || !/^publicTrade\./.test(j.topic) || !Array.isArray(j.data)) return [];
      return j.data.map((t) => ({
        sym: String(t.s || '').replace(/USDT$/, ''),
        px: num(t.p), qty: num(t.v),
        side: String(t.S).toLowerCase() === 'buy' ? 'buy' : 'sell',
        ts: num(t.T), id: String(t.i || ''),
      }));
    },
  },

  okx: {
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    subs: (syms) => [{ op: 'subscribe', args: syms.map((s) => ({ channel: 'trades', instId: `${s}-USDT-SWAP` })) }],
    ping: () => 'ping',
    parse(raw, ctx) {
      if (raw === 'pong') return [];
      const j = JSON.parse(raw);
      if (!j.arg || j.arg.channel !== 'trades' || !Array.isArray(j.data)) return [];
      return j.data.map((t) => {
        const inst = String(t.instId || '');
        const ct = ctx.ctVal[inst];
        if (!(ct > 0)) return null; // sz is in contracts; without ctVal the size is wrong, so drop it
        return {
          sym: inst.replace(/-USDT-SWAP$/, ''),
          px: num(t.px), qty: num(t.sz) * ct,
          side: String(t.side).toLowerCase() === 'buy' ? 'buy' : 'sell',
          ts: num(t.ts), id: String(t.tradeId || ''),
        };
      }).filter(Boolean);
    },
  },

  bitget: {
    url: 'wss://ws.bitget.com/v2/ws/public',
    subs: (syms) => [{ op: 'subscribe', args: syms.map((s) => ({ instType: 'USDT-FUTURES', channel: 'trade', instId: `${s}USDT` })) }],
    ping: () => 'ping',
    parse(raw) {
      if (raw === 'pong') return [];
      const j = JSON.parse(raw);
      if (!j.arg || j.arg.channel !== 'trade' || !Array.isArray(j.data)) return [];
      // the rows carry no symbol of their own - it is on the subscription arg
      const sym = String(j.arg.instId || '').replace(/USDT$/, '');
      return j.data.map((t) => ({
        sym, px: num(t.price), qty: num(t.size),
        side: String(t.side).toLowerCase() === 'buy' ? 'buy' : 'sell',
        ts: num(t.ts), id: String(t.tradeId || ''),
      }));
    },
  },

  hyperliquid: {
    url: 'wss://api.hyperliquid.xyz/ws',
    subs: (syms) => syms.map((s) => ({ method: 'subscribe', subscription: { type: 'trades', coin: s } })),
    ping: () => ({ method: 'ping' }),
    parse(raw) {
      const j = JSON.parse(raw);
      if (j.channel !== 'trades' || !Array.isArray(j.data)) return [];
      return j.data.map((t) => ({
        sym: String(t.coin || '').toUpperCase(),
        px: num(t.px), qty: num(t.sz),
        side: t.side === 'B' ? 'buy' : 'sell',   // measured, see the header
        ts: num(t.time), id: String(t.tid || t.hash || ''),
      }));
    },
  },

  binance: {
    // The combined stream, so one socket carries every symbol and the payload names which.
    // @aggTrade returns NOTHING on the futures stream - measured. @trade is the one that works.
    url: (syms) => 'wss://fstream.binance.com/stream?streams=' + syms.map((s) => s.toLowerCase() + 'usdt@trade').join('/'),
    subs: () => [],
    ping: () => null, // Binance sends protocol-level pings; the runtime answers them
    parse(raw) {
      const j = JSON.parse(raw);
      const d = j.data || j;
      if (!d || d.e !== 'trade') return [];
      // X:"NA" with a zero price is Binance's placeholder frame, not a trade - flagged, not rejected
      return [{
        skip: d.X === 'NA' || !(+d.p > 0),
        sym: String(d.s || '').replace(/USDT$/, ''),
        px: num(d.p), qty: num(d.q),
        side: d.m ? 'sell' : 'buy',   // m = buyer was the maker, so the taker was selling
        ts: num(d.T) || num(d.E), id: String(d.t || ''),
      }];
    },
  },
};

export const TAPE_VENUES = Object.keys(ADAPTERS);

const RING = 500;     // trades kept per venue+symbol for live reads
// A SEPARATE RING FOR THE PRINTS THAT MATTER. The live ring holds 500 per venue+symbol, which on BTC is
// about half a minute - so a reader filtering for $250k orders sees an empty list most of the time, because
// the big ones scrolled out of a window sized for every $9 trade. These are kept on their own and stay for
// as long as the ring takes to fill, so a filter answers with the last real orders instead of nothing.
// AND A SECOND RING FOR THE ONES THAT ARE RARE. MEASURED: of 300 prints over $50k spanning twelve
// minutes, exactly TWO were over $1M and none over $5M - so a count-capped ring answers the biggest
// filters with an almost empty list, which is what a reader sees as 'this is broken'. Prints over
// $500k are rare enough to keep far more of, and far longer, for a few megabytes.
const HUGE_USD = 250000;
const HUGE_KEEP = 1200;
const HUGE_MS = 12 * 3600000;
const BIG_USD = 50000;
const BIG_KEEP = 400;
const MIN_KEEP = 45;  // completed minutes kept per symbol - enough to draw three quarters of an hour of flow
const DEDUP = 4000;   // recent trade ids kept per venue, to drop a repeat without unbounded memory

export class TapeCollector extends BaseCollector {
  constructor(venue, { symbols, onTrade, onState } = {}) {
    super('tape:' + venue, { symbols, onState });
    this.venue = venue;
    this.ad = ADAPTERS[venue];
    if (!this.ad) throw new Error('unknown tape venue ' + venue);
    this.onTrade = onTrade || null;
    this.ctVal = {};
    this.rings = new Map();     // sym -> trade[]
    this.minute = new Map();    // sym -> { m, buyUsd, sellUsd, n } - the minute in progress
    // COMPLETED minutes, kept so a reader can see the SHAPE of the flow rather than a single number that
    // is meaningless three seconds into a minute. Pure memory, MIN_KEEP entries of four numbers per symbol.
    this.mins = new Map();      // sym -> [{ m, buyUsd, sellUsd, n }] oldest first
    this.bigs = new Map();      // sym -> [row] the large prints only, kept far longer than the live ring
    this.huge = new Map();      // sym -> [row] the rare ones, kept for hours so the biggest filters have a list
    this.seen = new Map();      // sym -> Set of recent ids
    this.seenOrder = new Map(); // sym -> id[] (FIFO for trimming)
    this.trades = 0; this.dupes = 0; this.bad = 0; this.skipped = 0;
    this.staleMs = 15 * 60000;  // a venue with zero prints for fifteen minutes has a dead subscription
  }

  async init() {
    if (this.venue !== 'okx') return;
    try {
      const j = await (await fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP')).json();
      let n = 0;
      for (const it of (j.data || [])) if (/^[A-Z0-9]+-USDT-SWAP$/.test(it.instId || '')) { this.ctVal[it.instId] = parseFloat(it.ctVal) || 0; n++; }
      log.info(`[${this.name}] contract values loaded`, { n });
    } catch (e) {
      log.error(`[${this.name}] ctVal fetch failed - venue will stay silent`, { e: String(e) });
    }
  }

  url() { return typeof this.ad.url === 'function' ? this.ad.url(this.symbols) : this.ad.url; }
  subscribeFrames() { return this.ad.subs(this.symbols); }
  pingFrame() { return this.ad.ping ? this.ad.ping() : null; }

  parse(raw) {
    let ts;
    try { ts = this.ad.parse(typeof raw === 'string' ? raw : String(raw), this); } catch (e) { return []; }
    const rxAt = Date.now();
    for (const t of ts || []) this._take(t, rxAt);
    return [];
  }

  _take(t, rxAt) {
    if (!t || !this.symbols.includes(t.sym)) return;
    // AN EXPECTED NON-TRADE IS NOT CORRUPTION, AND CONFLATING THE TWO MAKES THE HEALTH NUMBER USELESS.
    // Binance emits frames shaped exactly like trades but carrying p:"0", q:"0", X:"NA" - 42 of them in
    // ninety seconds, measured. They are placeholders, not damage. They are skipped and counted apart, so
    // `bad` keeps meaning "something we could not parse and should look at".
    if (t.skip) { this.skipped++; return; }
    if (!(t.px > 0) || !(t.qty > 0) || !Number.isFinite(t.ts)) { this.bad++; return; }

    if (t.id) {
      let seen = this.seen.get(t.sym);
      if (!seen) { seen = new Set(); this.seen.set(t.sym, seen); this.seenOrder.set(t.sym, []); }
      if (seen.has(t.id)) { this.dupes++; return; }
      seen.add(t.id);
      const order = this.seenOrder.get(t.sym);
      order.push(t.id);
      if (order.length > DEDUP) { const drop = order.splice(0, order.length - DEDUP); for (const d of drop) seen.delete(d); }
    }

    const row = { ts: t.ts, rxAt, venue: this.venue, sym: t.sym, px: t.px, qty: t.qty,
      usd: Math.round(t.px * t.qty * 100) / 100, side: t.side, id: t.id };

    let ring = this.rings.get(t.sym);
    if (!ring) { ring = []; this.rings.set(t.sym, ring); }
    ring.push(row);
    if (ring.length > RING) ring.splice(0, ring.length - RING);

    // Cumulative delta, per UTC minute. Candle volume cannot express this: it knows how much traded, not
    // who was the aggressor, and that difference is the entire signal.
    const m = Math.floor(t.ts / 60000);
    let b = this.minute.get(t.sym);
    if (!b || b.m !== m) {
      if (b) { // the minute just ended - file it before starting the next
        let h = this.mins.get(t.sym); if (!h) { h = []; this.mins.set(t.sym, h); }
        h.push(b); if (h.length > MIN_KEEP) h.splice(0, h.length - MIN_KEEP);
      }
      b = { m, buyUsd: 0, sellUsd: 0, n: 0 }; this.minute.set(t.sym, b);
    }
    if (row.side === 'buy') b.buyUsd += row.usd; else b.sellUsd += row.usd;
    b.n++;

    if (row.usd >= HUGE_USD) {
      let hg = this.huge.get(t.sym); if (!hg) { hg = []; this.huge.set(t.sym, hg); }
      hg.push(row);
      const cut = row.ts - HUGE_MS;
      while (hg.length && (hg.length > HUGE_KEEP || hg[0].ts < cut)) hg.shift();
    }
    if (row.usd >= BIG_USD) {
      let bg = this.bigs.get(t.sym); if (!bg) { bg = []; this.bigs.set(t.sym, bg); }
      bg.push(row); if (bg.length > BIG_KEEP) bg.splice(0, bg.length - BIG_KEEP);
    }
    this.trades++;
    this.lastEventAt = rxAt;   // BaseCollector's stale watchdog reads this
    if (this.onTrade) this.onTrade(row);
  }

  /** The last `n` trades for a symbol, newest last. */
  read(sym, n = 100) {
    const ring = this.rings.get(sym);
    if (!ring || !ring.length) return null;
    return ring.slice(Math.max(0, ring.length - n));
  }

  /** The minute in progress: taker buy vs taker sell in dollars, and the delta between them. */
  delta(sym) {
    const b = this.minute.get(sym);
    if (!b) return null;
    return { minute: b.m * 60000, trades: b.n,
      buyUsd: Math.round(b.buyUsd), sellUsd: Math.round(b.sellUsd),
      deltaUsd: Math.round(b.buyUsd - b.sellUsd) };
  }

  /** The rare ones, newest last, reaching back hours rather than minutes. */
  hugePrints(sym, n = 400) {
    const a = this.huge.get(sym) || [];
    return a.slice(Math.max(0, a.length - n));
  }

  /** The large prints only, newest last. What a size filter should actually be answered from. */
  big(sym, n = 300) {
    const a = this.bigs.get(sym) || [];
    return a.slice(Math.max(0, a.length - n));
  }

  /** The last completed minutes, oldest first, plus the one in progress. A page draws the flow from this. */
  minutes(sym, n = 30) {
    const h = this.mins.get(sym) || [];
    const out = h.slice(Math.max(0, h.length - n)).map(function (b) {
      return { minute: b.m * 60000, trades: b.n, buyUsd: Math.round(b.buyUsd), sellUsd: Math.round(b.sellUsd), deltaUsd: Math.round(b.buyUsd - b.sellUsd) };
    });
    const cur = this.delta(sym);
    if (cur) out.push(Object.assign({ partial: true }, cur));
    return out;
  }

  status() {
    const base = super.status();
    const syms = {};
    for (const s of this.symbols) {
      const r = this.rings.get(s);
      syms[s] = !r || !r.length ? 'none' : (Date.now() - r[r.length - 1].rxAt > 15 * 60000) ? 'quiet' : 'ok';
    }
    return { ...base, venue: this.venue, trades: this.trades, dupes: this.dupes, bad: this.bad, skipped: this.skipped, symbols: syms };
  }
}

export function createTapeCollectors({ symbols, onTrade, onState }) {
  return TAPE_VENUES.map((v) => new TapeCollector(v, { symbols, onTrade, onState }));
}

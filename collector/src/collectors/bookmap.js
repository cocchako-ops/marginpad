// WHERE THE MONEY HAS BEEN STANDING, AND WHAT HAPPENED TO IT.
//
// The book endpoint answers "what is resting right now". That is a photograph, and a photograph cannot
// tell you that the wall under the price has been sitting there for eleven minutes, or that the one above
// it appeared forty seconds ago, or that the one that was there a minute ago was PULLED rather than eaten.
// Those three facts are what a desk actually reads a book for, and none of them exist in a single sample.
//
// So this keeps a rolling film: every few seconds, each venue's levels are bucketed by ABSOLUTE price and
// summed, and the columns are kept. Price on one axis, time on the other, dollars as the value. That is
// the same shape as the well-known commercial heatmaps, with three differences that are ours:
//
//   1. FIVE BOOKS, TOGETHER OR ONE AT A TIME. The commercial ones show a single exchange. A price that
//      four books agree on is a different object from the same dollars on one venue, and we can say which.
//   2. AGE. Every wall carries when it first appeared, so "big" and "been there a while" stop being the
//      same word. A wall that has survived ten minutes of trading has been tested; one that arrived in the
//      last ten seconds has not.
//   3. WHAT HAPPENED TO IT. When a wall goes, the tape says whether trades consumed it or whether it was
//      simply withdrawn. Eaten means real money changed hands there and the level is spent; PULLED means
//      the order was never a commitment - the single most useful thing a reader can learn about a wall,
//      and it is only knowable because we hold the book and the tape from the same feed.
//
// COST IS THE DESIGN CONSTRAINT. The droplet has ONE vCPU which also runs the SQLite reader the public
// liquidation API depends on. So: sampling is on a timer (never per request), it reads the sort cache the
// book already maintains, buckets are bounded to a band around the mid, and the window is minutes rather
// than hours. Nothing here is written to disk.

import { log } from '../logger.js';

const SAMPLE_MS = 4000;        // one film frame; the page polls slower than this
const KEEP_MS = 30 * 60000;    // half an hour of film
const BAND_PCT = 0.6;          // buckets within +/-0.6% of mid - the books themselves only reach ~0.25%
const BUCKETS = 140;           // per side, hard cap, so one thin-priced coin cannot blow the memory up
const WALL_MIN_USD = 150000;   // a wall is never smaller than this, whatever the coin
const WALL_MIN_REL = 5;        // ...and never less than this many times the median occupied bucket
const WALL_KEEP = 60;          // finished walls kept per symbol, newest last
const EATEN_FRAC = 0.35;       // traded >= this share of the wall's peak while it stood = eaten, not pulled

/** A price step that gives readable rows on any coin: about a thousandth of the price, rounded to 1/2/5. */
export function stepFor(px) {
  if (!(px > 0)) return 1;
  const raw = px / 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

export class BookMap {
  constructor({ bookCols = [], tapeCols = [], symbols = [] } = {}) {
    this.bookCols = bookCols;
    this.tapeCols = tapeCols;
    this.symbols = symbols;
    this.cols = new Map();     // sym -> [column]
    this.live = new Map();     // sym -> Map(key -> live wall)
    this.done = new Map();     // sym -> [finished wall]
    this.step = new Map();     // sym -> price step
    this.samples = 0;
    this.lastMs = 0;
    this._t = null;
  }

  start() {
    if (this._t) return;
    this._t = setInterval(() => { try { this.sample(); } catch (e) { log.error('bookmap sample failed', { e: String(e && e.message || e) }); } }, SAMPLE_MS);
    this._t.unref?.();
  }

  shutdown() { clearInterval(this._t); this._t = null; }

  /** One frame of the film, for every symbol. Pure bookkeeping - no network, no disk. */
  sample() {
    const t0 = Date.now();
    for (const sym of this.symbols) this._sampleSym(sym, t0);
    this.samples++;
    this.lastMs = Date.now() - t0;
  }

  _sampleSym(sym, ts) {
    const per = [];                       // [{venue, mid, bids, asks}]
    for (const c of this.bookCols) {
      const l = c.levels ? c.levels(sym, 400) : null;
      if (l) per.push({ venue: c.venue, ...l });
    }
    if (!per.length) return;

    // Venues do not trade at exactly the same price, so each book is bucketed against the SHARED mid.
    // Bucketing each against its own mid would smear one venue's wall across two rows of the picture.
    const mid = per.reduce((s, v) => s + v.mid, 0) / per.length;
    let step = this.step.get(sym);
    if (!step || Math.abs(Math.log10(mid / (step * 1000))) > 0.5) { step = stepFor(mid); this.step.set(sym, step); }
    const lo = mid * (1 - BAND_PCT / 100), hi = mid * (1 + BAND_PCT / 100);

    const bid = new Map(), ask = new Map();          // bucket -> usd
    const bidV = new Map(), askV = new Map();        // bucket -> Set(venue)
    const put = (m, mv, px, sz, venue) => {
      if (px < lo || px > hi) return;
      const k = Math.round(px / step);
      m.set(k, (m.get(k) || 0) + px * sz);
      let s = mv.get(k); if (!s) { s = new Set(); mv.set(k, s); }
      s.add(venue);
    };
    for (const v of per) {
      for (const [px, sz] of v.bids) { if (px < lo) break; put(bid, bidV, px, sz, v.venue); }
      for (const [px, sz] of v.asks) { if (px > hi) break; put(ask, askV, px, sz, v.venue); }
    }

    const trim = (m) => {
      if (m.size <= BUCKETS) return m;
      const keep = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, BUCKETS);
      return new Map(keep);
    };
    const b = trim(bid), a = trim(ask);

    const col = {
      ts, mid: +mid.toFixed(8), step, venues: per.length,
      b: Object.fromEntries([...b].map(([k, v]) => [k, Math.round(v)])),
      a: Object.fromEntries([...a].map(([k, v]) => [k, Math.round(v)])),
      bv: Object.fromEntries([...b].map(([k]) => [k, (bidV.get(k) || { size: 0 }).size])),
      av: Object.fromEntries([...a].map(([k]) => [k, (askV.get(k) || { size: 0 }).size])),
    };

    let arr = this.cols.get(sym);
    if (!arr) { arr = []; this.cols.set(sym, arr); }
    arr.push(col);
    const cut = ts - KEEP_MS;
    while (arr.length && arr[0].ts < cut) arr.shift();

    this._walls(sym, ts, step, mid, b, a, bidV, askV);
  }

  // ---- WALLS ------------------------------------------------------------------------------------
  // A wall is a bucket carrying far more than the rest of its own book. "Far more" is measured against
  // THIS book's own median occupied bucket, not a fixed number, so a $300k order is a wall on a thin coin
  // and unremarkable on Bitcoin - the same reason the tape calls a print big against its own median.
  _walls(sym, ts, step, mid, bidM, askM, bidV, askV) {
    let live = this.live.get(sym); if (!live) { live = new Map(); this.live.set(sym, live); }
    let done = this.done.get(sym); if (!done) { done = []; this.done.set(sym, done); }

    const all = [...bidM.values(), ...askM.values()].sort((x, y) => x - y);
    const med = all.length ? all[Math.floor(all.length / 2)] : 0;
    const floor = Math.max(WALL_MIN_USD, med * WALL_MIN_REL);

    const seen = new Set();
    const scan = (m, mv, side) => {
      for (const [k, usd] of m) {
        if (usd < floor) continue;
        const key = side + ':' + k;
        seen.add(key);
        let w = live.get(key);
        if (!w) {
          w = { side, bucket: k, price: +(k * step).toFixed(8), first: ts, last: ts, peakUsd: 0, seenN: 0, venues: [] };
          live.set(key, w);
        }
        w.last = ts; w.seenN++;
        if (usd > w.peakUsd) w.peakUsd = Math.round(usd);
        w.usd = Math.round(usd);
        const vs = mv.get(k); if (vs) w.venues = [...vs];
      }
    };
    scan(bidM, bidV, 'bid');
    scan(askM, askV, 'ask');

    // A wall that stopped showing is finished. What finished it is the interesting part.
    for (const [key, w] of live) {
      if (seen.has(key)) continue;
      live.delete(key);
      if (w.seenN < 2) continue;                       // one frame is noise, not a wall
      const traded = this._tradedAt(sym, w.price, step, w.first, ts + SAMPLE_MS);
      w.endedAt = ts;
      w.heldMs = w.last - w.first;
      w.tradedUsd = Math.round(traded);
      // EATEN OR PULLED, and the difference is the whole point. A wall the tape chewed through was real
      // money that changed hands; one that vanished with nothing trading at its price was never a
      // commitment. We never call it "spoofing" - that is an intent, and we can only measure the fact.
      w.ending = traded >= w.peakUsd * EATEN_FRAC ? 'eaten' : traded > 0 ? 'partly eaten' : 'pulled';
      done.push(w);
    }
    while (done.length > WALL_KEEP) done.shift();
  }

  /** Dollars the tape executed inside one bucket between two times. The measurement behind eaten/pulled. */
  _tradedAt(sym, price, step, from, to) {
    const lo = price - step / 2, hi = price + step / 2;
    let usd = 0;
    for (const c of this.tapeCols) {
      const rows = c.read ? c.read(sym, 500) : null;
      if (!rows) continue;
      for (const t of rows) {
        if (t.ts < from || t.ts > to) continue;
        const px = +t.px || 0;
        if (px >= lo && px <= hi) usd += +t.usd || 0;
      }
    }
    return usd;
  }

  // ---- READ -------------------------------------------------------------------------------------
  /** The film, plus the walls standing now and the ones that have just finished. */
  read(sym, { mins = 30, venue = '' } = {}) {
    const arr = this.cols.get(sym) || [];
    if (!arr.length) return null;
    const from = Date.now() - Math.max(1, Math.min(30, +mins || 30)) * 60000;
    const cols = arr.filter((c) => c.ts >= from);
    if (!cols.length) return null;
    const step = this.step.get(sym) || cols[cols.length - 1].step;
    const live = [...(this.live.get(sym) || new Map()).values()]
      .filter((w) => w.seenN >= 2)
      .map((w) => ({ ...w, ageMs: Date.now() - w.first, standing: true }))
      .sort((x, y) => y.peakUsd - x.peakUsd)
      .slice(0, 24);
    const done = (this.done.get(sym) || []).slice(-24).map((w) => ({ ...w, standing: false }));
    return {
      symbol: sym, ts: Date.now(), step, sampleMs: SAMPLE_MS,
      windowMins: Math.round((cols[cols.length - 1].ts - cols[0].ts) / 60000),
      cols, wallsStanding: live, wallsFinished: done,
      note: 'Resting orders bucketed by price every ' + (SAMPLE_MS / 1000) + 's across every venue that had a provable book. '
        + 'A wall that stops showing is marked eaten when the tape traded through it and pulled when it simply went away.',
    };
  }

  status() {
    const out = {};
    for (const s of this.symbols) {
      const a = this.cols.get(s) || [];
      out[s] = { cols: a.length, standing: (this.live.get(s) || new Map()).size, finished: (this.done.get(s) || []).length };
    }
    return { samples: this.samples, lastSampleMs: this.lastMs, sampleMs: SAMPLE_MS, keepMs: KEEP_MS, symbols: out };
  }
}

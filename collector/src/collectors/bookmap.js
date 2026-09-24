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

const SAMPLE_MS = 5000;        // one film frame; the page polls slower than this
const KEEP_MS = 20 * 60000;    // twenty minutes of film - measured against the droplet's free memory
const BAND_PCT = 0.35;         // the near grid: tick-by-tick around the price
const WIDE_PCT = 5;            // the wide grid: where the round-number walls live
const WIDE_LEVELS = 4000;      // raw levels to walk for it (only Binance has anywhere near this many)         // buckets within +/-0.35% of mid - measured, the books themselves reach ~0.25%
const BUCKETS = 170;           // per side, hard cap, so one thin-priced coin cannot blow the memory up
const WALL_MIN_USD = 250000;   // a wall is never smaller than this, whatever the coin
const WALL_MIN_REL = 2.5;      // ...and never less than this many times the median of its SIXTEEN NEIGHBOURS
const WALL_NEIGHBOURS = 8;     // rows either side that decide what 'heavier than around it' means
const WALL_KEEP = 60;          // finished walls kept per symbol, newest last
const ALIVE_FRAC = 0.5;        // a wall that stopped standing out still HAS its money if it kept this much
const EATEN_FRAC = 0.35;       // traded >= this share of the wall's peak while it stood = eaten, not pulled

/** THE ROW HEIGHT COMES FROM HOW FAR THE BOOK REACHES, NOT FROM HOW BIG THE PRICE IS. Measured: a major
 *  coin's book spans about 25 basis points either side of the mid - on Bitcoin that is roughly $200, so a
 *  step taken as a thousandth of the price ($100) drew the entire book in TWO rows. Eight hundredths of a
 *  basis point puts about sixty rows across the part of the book that actually exists, on any coin. */
export function wideStepFor(px) {
  // about a hundred rows across +/-5%, rounded to 1/2/5 so the prices read as prices
  const raw = px * 0.001;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

export function stepFor(px) {
  if (!(px > 0)) return 1;
  const raw = px * 0.00008;
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
    this.step = new Map();     // sym -> price step, near grid
    this.wstep = new Map();    // sym -> price step, wide grid
    this._lastAcc = new Map(); // sym -> when the tape was last folded into the standing walls
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
      const l = c.levels ? c.levels(sym, WIDE_LEVELS) : null;
      if (l) per.push({ venue: c.venue, ...l });
    }
    if (!per.length) return;

    // Venues do not trade at exactly the same price, so each book is bucketed against the SHARED mid.
    // Bucketing each against its own mid would smear one venue's wall across two rows of the picture.
    const mid = per.reduce((s, v) => s + v.mid, 0) / per.length;
    let step = this.step.get(sym);
    var want = stepFor(mid);
    if (!step || step > want * 2 || step < want / 2) { step = want; this.step.set(sym, step); }
    const lo = mid * (1 - BAND_PCT / 100), hi = mid * (1 + BAND_PCT / 100);

    let wstep = this.wstep.get(sym);
    const wwant = wideStepFor(mid);
    if (!wstep || wstep > wwant * 2 || wstep < wwant / 2) { wstep = wwant; this.wstep.set(sym, wstep); }
    const wlo = mid * (1 - WIDE_PCT / 100), whi = mid * (1 + WIDE_PCT / 100);

    const bid = new Map(), ask = new Map();          // bucket -> usd, every venue together
    const bidV = new Map(), askV = new Map();        // bucket -> Set(venue)
    const bidByV = new Map(), askByV = new Map();    // bucket -> Map(venue -> usd)
    const wbidByV = new Map(), waskByV = new Map();  // the same, on the wide grid
    const wbid = new Map(), wask = new Map();
    const wbidV = new Map(), waskV = new Map();
    const put = (m, mv, mbv, px, sz, venue, st, lo2, hi2) => {
      if (px < lo2 || px > hi2) return;
      const k = Math.round(px / st);
      const usd = px * sz;
      m.set(k, (m.get(k) || 0) + usd);
      let s2 = mv.get(k); if (!s2) { s2 = new Set(); mv.set(k, s2); }
      s2.add(venue);
      let bv = mbv.get(k); if (!bv) { bv = new Map(); mbv.set(k, bv); }
      bv.set(venue, (bv.get(venue) || 0) + usd);
    };
    for (const v of per) {
      for (const [px, sz] of v.bids) {
        if (px < wlo) break;
        put(wbid, wbidV, wbidByV, px, sz, v.venue, wstep, wlo, whi);
        if (px >= lo) put(bid, bidV, bidByV, px, sz, v.venue, step, lo, hi);
      }
      for (const [px, sz] of v.asks) {
        if (px > whi) break;
        put(wask, waskV, waskByV, px, sz, v.venue, wstep, wlo, whi);
        if (px <= hi) put(ask, askV, askByV, px, sz, v.venue, step, lo, hi);
      }
    }

    const trim = (m) => {
      if (m.size <= BUCKETS) return m;
      const keep = [...m.entries()].sort((a2, b2) => b2[1] - a2[1]).slice(0, BUCKETS);
      return new Map(keep);
    };
    const b = trim(bid), a = trim(ask);
    const wb = trim(wbid), wa = trim(wask);

    // PER VENUE, NOT JUST THE TOTAL. The whole reason to hold five books is to be able to answer "show me
    // Binance" as well as "show me everybody", and a consolidated total cannot be taken apart afterwards.
    // MEASURED before choosing this: a consolidated column is 1,441 bytes over 53 rows, 2.32 venues quote
    // the average row, so per-venue is about 2.7KB a column - twenty minutes at five seconds across six
    // coins is 3.7MB on the wire and roughly three times that in memory, on a droplet with 224MB free.
    // The API sums whichever venues were asked for, so the page never downloads the breakdown it is not
    // showing.
    const perV = (src, keep) => {
      const o = {};
      for (const [k, byV] of src) {
        if (!keep.has(k)) continue;
        for (const [vn, usd] of byV) { (o[vn] || (o[vn] = {}))[k] = Math.round(usd); }
      }
      return o;
    };
    const col = {
      ts, mid: +mid.toFixed(8), step, wstep, venues: per.length,
      b: perV(bidByV, b), a: perV(askByV, a),
      wb: perV(wbidByV, wb), wa: perV(waskByV, wa),
    };

    let arr = this.cols.get(sym);
    if (!arr) { arr = []; this.cols.set(sym, arr); }
    arr.push(col);
    const cut = ts - KEEP_MS;
    while (arr.length && arr[0].ts < cut) arr.shift();

    this._accrue(sym, ts, step);   // fold the new prints into the standing walls BEFORE any of them ends
    this._walls(sym, ts, step, mid, b, a, bidV, askV, 'near');
    this._walls(sym, ts, wstep, mid, wb, wa, wbidV, waskV, 'wide');
  }

  // ---- WALLS ------------------------------------------------------------------------------------
  // A WALL IS A LOCAL SPIKE, NOT A BIG NUMBER. The first cut measured each row against the median of the
  // whole book - the same rule the tape uses to call a print big - and on this data it found NOTHING, at
  // any threshold down to 3x. MEASURED on a live Bitcoin frame: 66 occupied rows, median $2.3M, maximum
  // $6.9M. Five books bucketed together have no long tail; the dollars sit almost evenly, so "many times
  // the median" describes a shape this data does not have.
  //
  // What a reader's eye actually picks out is a row far heavier than the rows AROUND it, and that IS
  // measurable: the median of the sixteen nearest rows. On the same frame that rule found $4.45M resting
  // at 36x its neighbours - unmistakable - while the ask side topped out at 1.98x, which is worth knowing
  // in itself: there is no wall above right now. A heavy row at the thin outer edge of the book is not an
  // artifact of the rule; a lone block order with nothing around it is exactly what that looks like.
  _walls(sym, ts, step, mid, bidM, askM, bidV, askV, band) {
    let live = this.live.get(sym); if (!live) { live = new Map(); this.live.set(sym, live); }
    let done = this.done.get(sym); if (!done) { done = []; this.done.set(sym, done); }

    const seen = new Set();
    const scan = (m, mv, side) => {
      const rows = [...m.entries()].map(([k, v]) => ({ k: +k, v })).sort((a, b) => a.k - b.k);
      const sorted = rows.map((r) => r.v).sort((a, b) => a - b);
      const sideMed = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.v < WALL_MIN_USD) continue;
        const nb = rows.slice(Math.max(0, i - WALL_NEIGHBOURS), i + WALL_NEIGHBOURS + 1)
          .filter((x) => x.k !== r.k).map((x) => x.v).sort((a, b) => a - b);
        // A LONE BLOCK WITH NOTHING AROUND IT IS THE CLEAREST WALL THERE IS, and the neighbour rule was
        // throwing exactly those away. Out at 3-5% from the price the book is sparse - the money sits on
        // round numbers with empty rows between them - so fewer than six neighbours is the NORMAL case
        // there, not a reason to refuse. When the neighbourhood is too thin to judge, the row is measured
        // against the median of its whole side instead, which is the honest fallback: it still has to be
        // far heavier than a typical row, it just is not asked to beat rows that do not exist.
        const nbMed = nb.length >= 6 ? nb[Math.floor(nb.length / 2)] : sideMed;
        if (!(nbMed > 0)) continue;
        const rel = nbMed > 0 ? r.v / nbMed : 0;
        if (rel < WALL_MIN_REL) continue;
        const key = band + ':' + side + ':' + r.k;
        seen.add(key);
        let w = live.get(key);
        if (!w) {
          w = { band, side, bucket: r.k, price: +(r.k * step).toFixed(8), distPct: +(((r.k * step) - mid) / mid * 100).toFixed(3), first: ts, last: ts, peakUsd: 0, peakRel: 0, seenN: 0, venues: [] };
          live.set(key, w);
        }
        w.last = ts; w.seenN++;
        if (r.v > w.peakUsd) w.peakUsd = Math.round(r.v);
        if (rel > w.peakRel) w.peakRel = +rel.toFixed(1);
        w.usd = Math.round(r.v); w.rel = +rel.toFixed(1);
        const vs = mv.get(r.k); if (vs) w.venues = [...vs];
      }
    };
    scan(bidM, bidV, 'bid');
    scan(askM, askV, 'ask');

    // A WALL THAT STOPS BEING A SPIKE HAS NOT NECESSARILY GONE. It also leaves the detected set when its
    // NEIGHBOURS grow around it - the money is still there, it simply stopped standing out. Finishing it
    // then would report a withdrawal that never happened, which is the worst mistake this feature can
    // make. So the dollars at that price are the judge: still most of what it was, and the wall is alive.
    for (const [key, w] of live) {
      // ONLY THIS BAND'S WALLS. _walls runs twice a frame, once per grid, and they share one live map -
      // so without this the near pass declared every wide wall gone and the wide pass returned the favour.
      // Measured: zero walls standing on either grid while both were full of them.
      if ((w.band || 'near') !== band) continue;
      if (seen.has(key)) continue;
      const m = w.side === 'bid' ? bidM : askM;
      const still = m.get(w.bucket) || 0;
      if (still >= w.peakUsd * ALIVE_FRAC) { w.last = ts; w.usd = Math.round(still); w.rel = null; continue; }
      live.delete(key);
      if (w.seenN < 2) continue;                       // one frame is noise, not a wall
      w.endedAt = ts;
      w.heldMs = w.last - w.first;
      w.leftUsd = Math.round(still);
      w.tradedUsd = Math.round(w.tradedUsd || 0);
      const traded = w.tradedUsd;
      // EATEN OR PULLED, and the difference is the whole point. A wall the tape chewed through was real
      // money that changed hands; one that vanished with nothing trading at its price was never a
      // commitment. We never call it "spoofing" - that is an intent, and we can only measure the fact.
      w.ending = traded >= w.peakUsd * EATEN_FRAC ? 'eaten' : traded > 0 ? 'partly eaten' : 'pulled';
      done.push(w);
    }
    while (done.length > WALL_KEEP) done.shift();
  }

  /** WHAT THE TAPE EXECUTED AT EACH STANDING WALL, ADDED UP AS IT HAPPENS. It has to be accumulated per
   *  frame rather than looked up when the wall ends: the tape ring holds about 500 prints a venue, which
   *  on Bitcoin is half a minute, so asking it afterwards about a wall that stood ten minutes would see
   *  almost none of the trading that hit it and would call an eaten wall "pulled" - the exact error this
   *  measurement exists to avoid. One pass over the new prints per symbol per frame. */
  _accrue(sym, ts, step) {
    const live = this.live.get(sym);
    if (!live || !live.size) { this._lastAcc.set(sym, ts); return; }
    const since = this._lastAcc.get(sym) || (ts - SAMPLE_MS * 2);
    const byBucket = new Map();
    for (const c of this.tapeCols) {
      const rows = c.read ? c.read(sym, 500) : null;
      if (!rows) continue;
      for (const t of rows) {
        if (!(t.ts > since) || t.ts > ts) continue;
        const px = +t.px || 0;
        if (!(px > 0)) continue;
        const k = Math.round(px / step);
        byBucket.set(k, (byBucket.get(k) || 0) + (+t.usd || 0));
      }
    }
    if (byBucket.size) for (const w of live.values()) {
      const v = byBucket.get(w.bucket);
      if (v) w.tradedUsd = (w.tradedUsd || 0) + v;
    }
    this._lastAcc.set(sym, ts);
  }

  // ---- READ -------------------------------------------------------------------------------------
  /** The film, plus the walls standing now and the ones that have just finished.
   *  `venue` picks ONE book or leaves them consolidated; the summing happens here so the page never
   *  downloads a breakdown it is not showing. */
  read(sym, { mins = 20, venue = '', back = 0, band = 'near' } = {}) {
    const arr = this.cols.get(sym) || [];
    if (!arr.length) return null;
    // A WINDOW THAT CAN SIT IN THE PAST. Without `back` the film could only ever show its own tail, so
    // a wall that formed and was pulled four minutes ago was unreachable the moment it scrolled off.
    const span = Math.max(1, Math.min(20, +mins || 20)) * 60000;
    const bk2 = Math.max(0, Math.min(20, +back || 0)) * 60000;
    const to = Date.now() - bk2, from = to - span;
    const raw = arr.filter((c) => c.ts >= from && c.ts <= to);
    if (!raw.length) return null;
    const want = String(venue || '').toLowerCase();
    const flat = (byV) => {
      const o = {}, n = {};
      for (const [vn, rows] of Object.entries(byV)) {
        if (want && want !== 'all' && vn !== want) continue;
        for (const [k, usd] of Object.entries(rows)) { o[k] = (o[k] || 0) + usd; n[k] = (n[k] || 0) + 1; }
      }
      return [o, n];
    };
    const wide = band === 'wide';
    const cols = raw.map((c) => {
      const [b, bv] = flat(wide ? (c.wb || {}) : c.b), [a, av] = flat(wide ? (c.wa || {}) : c.a);
      return { ts: c.ts, mid: c.mid, step: wide ? (c.wstep || c.step) : c.step, venues: c.venues, b, a, bv, av };
    }).filter((c) => Object.keys(c.b).length || Object.keys(c.a).length);
    if (!cols.length) return null;
    const step = (wide ? this.wstep.get(sym) : this.step.get(sym)) || cols[cols.length - 1].step;
    const bOk = (w) => (w.band || 'near') === band;
    const vOk = (w) => bOk(w) && (!want || want === 'all' || (w.venues || []).indexOf(want) >= 0);
    const live = [...(this.live.get(sym) || new Map()).values()]
      .filter((w) => w.seenN >= 2 && vOk(w))
      .map((w) => ({ ...w, ageMs: Date.now() - w.first, tradedUsd: Math.round(w.tradedUsd || 0), standing: true }))
      .sort((x, y) => y.peakUsd - x.peakUsd)
      .slice(0, 24);
    const done = (this.done.get(sym) || []).filter(vOk).slice(-24).map((w) => ({ ...w, standing: false }));
    return {
      symbol: sym, ts: Date.now(), step, sampleMs: SAMPLE_MS, venue: want || 'all', band,
      bandPct: wide ? WIDE_PCT : BAND_PCT,
      backMins: Math.round(bk2 / 60000), keepMins: Math.round(KEEP_MS / 60000),
      oldestKeptTs: arr.length ? arr[0].ts : null, newestKeptTs: arr.length ? arr[arr.length - 1].ts : null,
      venuesAvailable: this.bookCols.map((c) => c.venue),
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

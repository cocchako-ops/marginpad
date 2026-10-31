/* Runs every rule over every market and timeframe, and writes dist/strategies/data/.
   A headline is always an equal-weight BASKET of a whole asset class on the timeframe the rule declared, never the coin it
   happened to suit. Every market's own row is published beside it.

   node build/strategies/run.js [--only ema-9-21-cross] */
const fs = require('fs'), path = require('path');
const S = require('../../dist/assets/mp-strat.js');
const { MARKETS, CLASSES } = require('./markets');
const { RULES, STYLES } = require('./rules');
const DATA = path.join(__dirname, '..', 'data', 'strategies'), OUT = path.join(__dirname, '..', '..', 'dist', 'strategies', 'data');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const only = arg('--only'), START = Date.UTC(2000, 0, 1), WARM = 220, MIN_TRADES = 30;
const rules = only ? RULES.filter((r) => only.split(',').includes(r.slug)) : RULES;
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return null; } };
const fx = (x, d = 2) => (x == null || !isFinite(x) ? null : +x.toFixed(d));
const usable = (r, m) => (!r.only || r.only.includes(m.cls)) && !(r.vol && m.cls === 'forex') && (!r.own || m.cls === 'crypto');
const SIM = path.join(__dirname, '..', 'data', 'sim');
const rdSim = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SIM, f), 'utf8')); } catch (e) { return null; } };
/* Our own series, aligned to the bars. Only what had happened by a bar's close is on it, and a kind with no data leaves the
   market out of that rule rather than filling a gap with zeros. */
function ownSeries(kind, b, m, tf, fund) {
  const n = b.t.length, o = new Float64Array(n).fill(NaN), ms = { '1h': 36e5, '4h': 144e5, '1d': 864e5 }[tf];
  if (kind === 'fund') {
    if (!fund || !fund.t.length) return null;
    let k = 0, last = NaN;
    for (let i = 0; i < n; i++) { while (k < fund.t.length && fund.t[k] <= b.t[i] + ms) last = fund.r[k++]; o[i] = last; }
    return { fund: o, from: fund.t[0] };
  }
  if (kind === 'oi') {
    const d = rdSim(`oi/${m.sym}-60.json`); if (!d) return null;
    let k = 0, last = NaN;
    for (let i = 0; i < n; i++) { while (k < d.length && d[k].t <= b.t[i] + ms) last = d[k++].oi; if (i && b.t[i] > d[d.length - 1].t) last = NaN; o[i] = last; }
    return { oi: o, from: d[0].t, to: d[d.length - 1].t };
  }
  const d = rdSim(`liq/${m.sym}.json`); if (!d) return null;
  const L = new Float64Array(n), S2 = new Float64Array(n); let k = 0;
  for (let i = 0; i < n; i++) { while (k < d.length && d[k].t < b.t[i] + ms) { if (d[k].t >= b.t[i]) { L[i] += d[k].long; S2[i] += d[k].short; } k++; } }
  return { liqL: L, liqS: S2, from: d[0].t, to: d[d.length - 1].t };
}
function window2(b, ext) {
  let a = 0, z = b.t.length; while (a < z && b.t[a] < ext.from) a++; if (ext.to) while (z > a && b.t[z - 1] > ext.to) z--;
  const o = {}; for (const k of ['t', 'o', 'h', 'l', 'c', 'v']) o[k] = b[k].slice(a, z);
  o.x = {}; for (const k of Object.keys(ext)) if (k !== 'from' && k !== 'to') o.x[k] = ext[k].slice(a, z);
  return o;
}

function clip(raw) {
  let i = 0; while (i < raw.t.length && raw.t[i] < START) i++;
  if (!i) return raw;
  const o = {}; for (const k of ['t', 'o', 'h', 'l', 'c', 'v']) o[k] = raw[k].slice(i);
  return o;
}
function summary(rets, year, tr) {
  const m = S.metrics(rets, year), t = S.tradeStats(tr);
  return { ret: fx(m.ret, 1), cagr: fx(m.cagr), sharpe: fx(m.sharpe), sortino: fx(m.sortino), calmar: fx(m.calmar), mdd: fx(m.mdd), vol: fx(m.vol), win: fx(t.win, 1), pf: fx(t.pf), trades: t.trades, hold: fx(t.hold, 1), years: fx(m.years, 1) };
}
/* Equal weight across whichever markets existed that day. */
function basket(rows) {
  const by = new Map();
  for (const r of rows) for (let i = 0; i < r.days.length; i++) {
    const a = by.get(r.days[i]) || [0, 0, 0]; a[0] += r.rets[i]; a[1] += r.bench[i]; a[2]++; by.set(r.days[i], a);
  }
  const days = [...by.keys()].sort((a, b) => a - b);
  return { days, rets: days.map((d) => by.get(d)[0] / by.get(d)[2]), bench: days.map((d) => by.get(d)[1] / by.get(d)[2]), n: days.map((d) => by.get(d)[2]) };
}
function curve(days, rets, bench, pts) {
  const step = Math.max(1, Math.floor(days.length / pts)), o = [];
  let e = 1, b = 1, peak = 1, low = 0;
  for (let i = 0; i < days.length; i++) {
    e *= 1 + rets[i]; b *= 1 + bench[i]; if (e > peak) peak = e;
    low = Math.min(low, e / peak - 1);
    if (i % step === 0 || i === days.length - 1) { o.push([days[i], +e.toFixed(4), +b.toFixed(4), +(low * 100).toFixed(1)]); low = 0; }
  }
  return o;
}
function years(days, rets) {
  const y = {};
  days.forEach((d, i) => { const k = new Date(d * 864e5).getUTCFullYear(); y[k] = (y[k] || 1) * (1 + rets[i]); });
  return Object.keys(y).map((k) => [+k, fx((y[k] - 1) * 100, 1)]);
}
function monthly(days, rets) {
  const m = {};
  days.forEach((d, i) => { const dt = new Date(d * 864e5), k = dt.getUTCFullYear() * 12 + dt.getUTCMonth(); m[k] = (m[k] || 1) * (1 + rets[i]); });
  return Object.keys(m).map((k) => [+k, +(m[k] - 1).toFixed(5)]);
}
function monthsUp(days, rets) {
  const m = {};
  days.forEach((d, i) => { const dt = new Date(d * 864e5), k = dt.getUTCFullYear() * 12 + dt.getUTCMonth(); m[k] = (m[k] || 1) * (1 + rets[i]); });
  const v = Object.values(m); return { up: v.filter((x) => x > 1).length, of: v.length };
}

const store = {}; // slug|cls|tf -> rows
const started = Date.now();
for (const m of MARKETS) {
  const cls = CLASSES[m.cls];
  const fund = m.src === 'binance' ? rd(`${m.sym}-funding.json`) : null;
  for (const tf of cls.tfs) {
    const raw = rd(`${m.sym}-${tf}.json`); if (!raw) continue;
    const b = S.bars(clip(raw)); if (b.c.length < WARM + 100) continue;
    const dayB = S.daily(b.t, Float64Array.from(b.c)); // buy & hold, on the same clock as the rule
    for (const r of rules) {
      if (!usable(r, m)) continue;
      if (r.own && tf !== r.tf) continue;
      let B = b, bench = dayB.rets, days0 = dayB.days;
      if (r.own) {
        const ext = ownSeries(r.own, b, m, tf, fund); if (!ext) continue;
        const raw2 = window2(b, ext); if (raw2.t.length < 300) continue;
        B = S.bars(raw2); const db = S.daily(B.t, Float64Array.from(B.c)); bench = db.rets;
      }
      const res = S.run(r, B, cls, fund);
      const d = S.daily(B.t, res.equity);
      const w = Math.ceil(WARM * { '1d': 1, '4h': 1 / 6, '1h': 1 / 24 }[tf]);
      const row = { sym: m.sym, basket: r.own ? true : m.basket, days: d.days.slice(w), rets: d.rets.slice(w), bench: bench.slice(w), trades: res.trades };
      const k = `${r.slug}|${m.cls}|${tf}`; (store[k] = store[k] || []).push(row);
    }
  }
  console.log(m.sym, Math.round((Date.now() - started) / 1000) + 's');
}

fs.mkdirSync(OUT, { recursive: true });
const index = [];
for (const r of rules) {
  const detail = { id: r.id, slug: r.slug, name: r.name, style: r.style, styleLabel: STYLES[r.style], tf: r.tf, summary: r.summary, classes: {} };
  const card = { id: r.id, slug: r.slug, name: r.name, style: r.style, summary: r.summary, tf: r.tf, stop: r.stop || null, tp: r.tp || null, own: r.own || null, classes: {} };
  for (const cn of Object.keys(CLASSES)) {
    const cls = CLASSES[cn], tfs = {};
    for (const tf of cls.tfs) {
      const rows = store[`${r.slug}|${cn}|${tf}`]; if (!rows) continue;
      const inB = rows.filter((x) => x.basket); if (!inB.length) continue;
      const bk = basket(inB), allTr = inB.flatMap((x) => x.trades);
      const cut = Math.floor(bk.days.length * 0.7);
      tfs[tf] = {
        m: summary(bk.rets, cls.year, allTr),
        bench: summary(bk.bench, cls.year, []),
        is: fx(S.metrics(bk.rets.slice(0, cut), cls.year).sharpe), oos: fx(S.metrics(bk.rets.slice(cut), cls.year).sharpe),
        oosFrom: bk.days[cut], from: bk.days[0], to: bk.days[bk.days.length - 1],
        thin: allTr.length < MIN_TRADES, markets: inB.length,
        months: monthsUp(bk.days, bk.rets), monthly: monthly(bk.days, bk.rets), years: years(bk.days, bk.rets), curve: curve(bk.days, bk.rets, bk.bench, 400),
        spark: curve(bk.days, bk.rets, bk.bench, 110).map((x) => x[1]),
        rows: rows.map((x) => ({ sym: x.sym, basket: x.basket, ...summary(x.rets, cls.year, x.trades), bh: fx(S.metrics(x.bench, cls.year).ret, 1) })),
      };
    }
    if (!Object.keys(tfs).length) continue;
    detail.classes[cn] = tfs;
    const head = tfs[cls.tfs.includes(r.tf) ? r.tf : '1d'] || tfs[Object.keys(tfs)[0]], tf = Object.keys(tfs).find((k) => tfs[k] === head);
    card.classes[cn] = { tf, m: head.m, bench: head.bench.ret, benchS: head.bench.sharpe, benchD: head.bench.mdd, thin: head.thin, oos: head.oos, is: head.is, spark: head.spark, from: head.from, to: head.to };
  }
  fs.writeFileSync(path.join(OUT, r.slug + '.json'), JSON.stringify(detail));
  index.push(card);
}
const meta = { generated: new Date().toISOString(), rules: rules.length, classes: Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, { label: v.label, fee: v.fee, slip: v.slip, markets: MARKETS.filter((m) => m.cls === k && m.basket).map((m) => m.sym) }])), styles: STYLES };
if (!only) fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ meta, rules: index }));
console.log('done', rules.length, Math.round((Date.now() - started) / 1000) + 's');
if (only) console.log(JSON.stringify(index.map((c) => ({ s: c.slug, cls: Object.fromEntries(Object.entries(c.classes).map(([k, v]) => [k, [v.tf, v.m.ret, v.m.sharpe, v.m.mdd, v.m.trades, 'bh', v.bench, 'is/oos', v.is, v.oos]])) })), null, 0));

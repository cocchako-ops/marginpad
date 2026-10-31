/* Downloads the history every strategy is tested on, into build/data/strategies/ (gitignored).
   Run from this machine, never from the Worker: Binance blocks Cloudflare's egress. Re-running continues from the last
   stored bar, so it is cheap to keep current. Yahoo is daily only, and adjusted for splits and dividends through adjclose.

   node build/strategies/fetch-data.js [--only BTC,XAU] [--tf 1d,4h,1h] */
const fs = require('fs'), path = require('path');
const { MARKETS, CLASSES } = require('./markets');
const DIR = path.join(__dirname, '..', 'data', 'strategies');
fs.mkdirSync(DIR, { recursive: true });
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = (arg('--only') || '').split(',').filter(Boolean);
const TFS = (arg('--tf') || '1d,4h,1h').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MS = { '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 };

async function getJson(u, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      return { status: r.status, body: await r.json() };
    } catch (e) { await sleep(1500 * (i + 1)); }
  }
  return { status: 0, body: null };
}
const load = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const save = (f, o) => { fs.writeFileSync(f + '.tmp', JSON.stringify(o)); fs.renameSync(f + '.tmp', f); };

async function binance(m, tf) {
  const f = path.join(DIR, `${m.sym}-${tf}.json`);
  const a = load(f) || { t: [], o: [], h: [], l: [], c: [], v: [] };
  if (a.t.length) for (const k of Object.keys(a)) a[k].pop(); // the last stored bar may have been forming
  let start = a.t.length ? a.t[a.t.length - 1] + MS[tf] : 1500000000000;
  const now = Date.now();
  for (;;) {
    const { status, body } = await getJson(`https://fapi.binance.com/fapi/v1/klines?symbol=${m.pair}&interval=${tf}&limit=1500&startTime=${start}`);
    if (status !== 200 || !Array.isArray(body)) return { ok: false, why: 'klines ' + status };
    const closed = body.filter((k) => k[6] < now);
    for (const k of closed) { a.t.push(k[0]); a.o.push(+k[1]); a.h.push(+k[2]); a.l.push(+k[3]); a.c.push(+k[4]); a.v.push(+k[5]); }
    if (body.length < 1500) break;
    start = body[body.length - 1][0] + MS[tf];
    await sleep(120);
  }
  if (!a.t.length) return { ok: false, why: 'empty' };
  save(f, a);
  return { ok: true, n: a.t.length, from: new Date(a.t[0]).toISOString().slice(0, 10) };
}

async function funding(m) {
  const f = path.join(DIR, `${m.sym}-funding.json`);
  const a = load(f) || { t: [], r: [] };
  let start = a.t.length ? a.t[a.t.length - 1] + 1 : 1500000000000;
  for (;;) {
    const { status, body } = await getJson(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${m.pair}&limit=1000&startTime=${start}`);
    if (status !== 200 || !Array.isArray(body)) return { ok: false };
    for (const x of body) { a.t.push(x.fundingTime); a.r.push(+x.fundingRate); }
    if (body.length < 1000) break;
    start = body[body.length - 1].fundingTime + 1;
    await sleep(250);
  }
  save(f, a);
  return { ok: true, n: a.t.length };
}

async function yahoo(m) {
  const f = path.join(DIR, `${m.sym}-1d.json`);
  const end = Math.floor(Date.now() / 1000);
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(m.y)}?period1=0&period2=${end}&interval=1d&events=div,splits`;
  const { status, body } = await getJson(u);
  const r = body && body.chart && body.chart.result && body.chart.result[0];
  if (status !== 200 || !r || !r.timestamp) return { ok: false, why: 'yahoo ' + status };
  const q = r.indicators.quote[0], adj = r.indicators.adjclose && r.indicators.adjclose[0].adjclose;
  const a = { t: [], o: [], h: [], l: [], c: [], v: [] };
  const today = Math.floor(Date.now() / 86400000);
  for (let i = 0; i < r.timestamp.length; i++) {
    if (Math.floor(r.timestamp[i] / 86400) >= today) continue; // today's bar is still forming
    const c = q.close[i], o = q.open[i], h = q.high[i], l = q.low[i];
    if (![c, o, h, l].every((x) => x > 0)) continue;
    const k = adj && adj[i] > 0 ? adj[i] / c : 1;
    a.t.push(r.timestamp[i] * 1000); a.o.push(o * k); a.h.push(h * k); a.l.push(l * k); a.c.push(c * k); a.v.push(q.volume[i] || 0);
  }
  if (a.t.length < 200) return { ok: false, why: 'short ' + a.t.length };
  save(f, a);
  return { ok: true, n: a.t.length, from: new Date(a.t[0]).toISOString().slice(0, 10) };
}

(async () => {
  const report = {};
  for (const m of MARKETS) {
    if (ONLY.length && !ONLY.includes(m.sym)) continue;
    const row = report[m.sym] = {};
    if (m.src === 'yahoo') row['1d'] = await yahoo(m);
    else {
      for (const tf of TFS.filter((x) => CLASSES[m.cls].tfs.includes(x))) row[tf] = await binance(m, tf);
      row.funding = await funding(m);
    }
    console.log(m.sym, JSON.stringify(row));
    await sleep(150);
  }
  fs.writeFileSync(path.join(DIR, 'fetch-report.json'), JSON.stringify(report, null, 1));
})();

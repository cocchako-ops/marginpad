/* THE LIQUIDATION RECORDS (2026-11-12, owner-approved feature #14): /liquidations/records/ is the archive read as a record book, rolled
   up from the daily recap objects (liqrecap:<day>) once a UTC day.
   --pure (default half): liqRecordsCompute lifted out of the SHIPPED worker and driven with constructed recap days - the biggest event,
            the biggest and quietest days, the biggest hours, the hour-of-day peak, coins with their record day, venue shares, the long
            share, the median, and the streak rule (consecutive days above the archive median, a gap breaks it); an empty archive is null.
   --prod : the live page - 200, the h1, the FAQ with three questions, every record linking its recap day, the sitemap entry, the admin read.
   Run: node build/liq-records-e2e.js [--pure] [--prod] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), BASE = 'https://marginpad.io';
const PURE = process.argv.includes('--pure'), PROD = process.argv.includes('--prod');
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const W = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
const a0 = W.indexOf('function liqRecordsCompute(recs) {'), a1 = W.indexOf('\nasync function liqRecordsBuild(env) {', a0);
if (a0 < 0 || a1 < 0) throw new Error('cannot lift liqRecordsCompute');
const liqRecordsCompute = new Function(W.slice(a0, a1) + '\nreturn liqRecordsCompute;')();
const hours = (peak, usd) => { const h = new Array(24).fill(0); h[peak] = usd; h[(peak + 1) % 24] = usd / 4; return h; };
const day = (d, total, longUsd, big, hourPeak, top, exs) => ({ day: d, totalUsd: total, n: 1000, longUsd, shortUsd: total - longUsd, biggest: big, byHour: hours(hourPeak, total * 0.3), top, exs });
const D = [
  day('2026-08-01', 100e6, 60e6, { usd: 5e6, sym: 'BTC', side: 'long', ex: 'binance', ts: Date.parse('2026-08-01T13:05:00Z') }, 13, [{ sym: 'BTC', usd: 60e6, n: 500 }, { sym: 'ETH', usd: 30e6, n: 400 }], [{ ex: 'binance', usd: 70e6, n: 700 }, { ex: 'bybit', usd: 30e6, n: 300 }]),
  day('2026-08-02', 300e6, 250e6, { usd: 12e6, sym: 'ETH', side: 'long', ex: 'bybit', ts: Date.parse('2026-08-02T14:30:00Z') }, 14, [{ sym: 'ETH', usd: 200e6, n: 900 }, { sym: 'BTC', usd: 80e6, n: 300 }], [{ ex: 'bybit', usd: 200e6, n: 800 }, { ex: 'binance', usd: 100e6, n: 200 }]),
  day('2026-08-03', 200e6, 50e6, { usd: 7e6, sym: 'SOL', side: 'short', ex: 'okx', ts: Date.parse('2026-08-03T02:00:00Z') }, 2, [{ sym: 'SOL', usd: 120e6, n: 600 }, { sym: 'BTC', usd: 50e6, n: 200 }], [{ ex: 'okx', usd: 150e6, n: 700 }, { ex: 'binance', usd: 50e6, n: 300 }]),
  // a gap: 08-04 is missing from the archive, so 08-05 cannot extend a streak
  day('2026-08-05', 250e6, 125e6, { usd: 9e6, sym: 'BTC', side: 'short', ex: 'binance', ts: Date.parse('2026-08-05T14:10:00Z') }, 14, [{ sym: 'BTC', usd: 150e6, n: 800 }], [{ ex: 'binance', usd: 250e6, n: 1000 }]),
  day('2026-08-06', 40e6, 20e6, { usd: 1e6, sym: 'XRP', side: 'long', ex: 'gate', ts: Date.parse('2026-08-06T09:00:00Z') }, 9, [{ sym: 'XRP', usd: 30e6, n: 400 }], [{ ex: 'gate', usd: 40e6, n: 1000 }]),
];
const R = liqRecordsCompute(D.slice().reverse()); // the index lists newest first - order in must not matter
chk('pure: the span is the whole archive, sorted, with the totals summed', R && R.span.first === '2026-08-01' && R.span.last === '2026-08-06' && R.span.days === 5 && R.span.totalUsd === 890e6 && R.span.n === 5000, R && R.span);
chk('pure: the long share and the median day', R.span.longPct === Math.round(505 / 890 * 100) && R.span.medianDay === 200e6 && R.span.avgDay === 178e6, R.span);
chk('pure: the biggest single liquidation is the $12M ETH long on bybit, 08-02 14:30, then $9M, $7M, $5M, $1M', R.biggestEvents.map(e => e.usd).join(',') === '12000000,9000000,7000000,5000000,1000000' && R.biggestEvents[0].sym === 'ETH' && R.biggestEvents[0].ex === 'bybit' && R.biggestEvents[0].day === '2026-08-02', R.biggestEvents[0]);
chk('pure: the biggest day is 08-02 ($300M, 83% long), the quietest 08-06 ($40M)', R.biggestDays[0].day === '2026-08-02' && R.biggestDays[0].longPct === 83 && R.quietestDays[0].day === '2026-08-06' && R.quietestDays[0].usd === 40e6, { b: R.biggestDays[0], q: R.quietestDays[0] });
chk('pure: the biggest hour is 08-02 14:00 ($90M); 14:00 is the hour of the day that liquidates most', R.biggestHours[0].day === '2026-08-02' && R.biggestHours[0].h === 14 && R.biggestHours[0].usd === 90e6 && R.hourOfDay.peak === 14, { h: R.biggestHours[0], peak: R.hourOfDay.peak, share: R.hourOfDay.share });
chk('pure: coins all-time: BTC $340M first with its record day 08-05, ETH second', R.topCoins[0].sym === 'BTC' && R.topCoins[0].usd === 340e6 && R.topCoins[0].best.day === '2026-08-05' && R.topCoins[0].days === 4 && R.topCoins[1].sym === 'ETH', R.topCoins.slice(0, 2));
chk('pure: venue shares sum to the archive and binance leads', Math.abs(R.exchanges.reduce((a, x) => a + x.usd, 0) - 890e6) < 1 && R.exchanges[0].ex === 'binance' && R.exchanges[0].usd === 470e6 && Math.abs(R.exchanges[0].share - 52.8) < 0.1, R.exchanges);
chk('pure: the streak above the median ($200M) is 08-02 alone - 08-03 equals the median and 08-05 sits past a missing day', R.streak && R.streak.len === 1 && R.streak.from === '2026-08-02' && R.streak.to === '2026-08-02', R.streak);
{ const R2 = liqRecordsCompute([D[0], D[1], Object.assign({}, D[2], { totalUsd: 260e6 }), D[3], D[4]]);
  chk('pure: with 08-03 above the median the streak is 08-02 to 08-03 (two consecutive days), never reaching 08-05 across the gap', R2.streak && R2.streak.len === 2 && R2.streak.from === '2026-08-02' && R2.streak.to === '2026-08-03', R2.streak); }
chk('pure: an empty archive is null, a day with no total is dropped', liqRecordsCompute([]) === null && liqRecordsCompute([{ day: '2026-01-01', totalUsd: 0 }]) === null && liqRecordsCompute([D[0], { day: 'x', totalUsd: 0 }]).span.days === 1);
if (!PROD) { console.log('\nliq-records-e2e: ' + okN + ' passed, ' + failN + ' failed [pure]'); process.exit(failN ? 1 : 0); }
(async () => {
  const get = (u, h) => fetch(BASE + u, { headers: h || {}, cache: 'no-store' }).then(async r => ({ st: r.status, ct: r.headers.get('content-type') || '', body: await r.text() }));
  const KEY = fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
  const b = await get('/api/admin/liqrecords?build=1', { 'x-admin-key': KEY }); let j = null; try { j = JSON.parse(b.body); } catch (e) {}
  chk('prod: the record book builds from the archive (100+ days)', b.st === 200 && j && j.ok && j.rec && j.rec.span.days >= 100 && j.rec.biggestEvents.length === 10 && j.rec.topCoins.length >= 10, j && j.rec && j.rec.span);
  const p = await get('/liquidations/records/?nc=1');
  chk('prod: the page answers 200 HTML with the h1, six KPIs and the three FAQ questions', p.st === 200 && /text\/html/.test(p.ct) && /<h1>Crypto Liquidation Records<\/h1>/.test(p.body) && (p.body.match(/class="kpi"/g) || []).length === 6 && /FAQPage/.test(p.body) && /biggest crypto liquidation MarginPad has measured/.test(p.body), { st: p.st, kpi: (p.body.match(/class="kpi"/g) || []).length });
  const links = (p.body.match(/href="\/liquidations\/recap\/\d{4}-\d{2}-\d{2}\/"/g) || []).length;
  chk('prod: every record links the day it happened on (recap pages)', links >= 30, links);
  chk('prod: the biggest event on the page is the one the JSON names', j && j.rec && j.rec.biggestEvents[0] && p.body.indexOf(j.rec.biggestEvents[0].day) >= 0 && p.body.indexOf(j.rec.biggestEvents[0].sym + ' ' + j.rec.biggestEvents[0].side) >= 0);
  const sm = await get('/sitemap.xml');
  chk('prod: the sitemap lists the page', /\/liquidations\/records\//.test(sm.body));
  const nav = await get('/assets/mp-nav.js');
  chk('prod: Browse carries the row with its own trophy icon', /\/liquidations\/records\//.test(nav.body) && /trophy:/.test(nav.body));
  console.log('\nliq-records-e2e: ' + okN + ' passed, ' + failN + ' failed [pure+prod]');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

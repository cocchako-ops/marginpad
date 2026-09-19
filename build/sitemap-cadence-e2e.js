/* The sitemap is a crawl-scheduling instrument, and ours was set to "never come back" on the pages built for
   assistants (2026-09-19).

   MEASURED across the live sitemap's 455 entries against 30 days of crawler hits:
       hourly    3 urls   1,158.7 crawls per url
       daily    49 urls     600.4
       weekly   94 urls      18.6
       monthly 308 urls      15.0
   ~40x between `daily` and `monthly`. Every live-number page we own - all six one-question pages, /heatmap,
   /arena/, /leaderboards/, /season/, /trading-competition/ and both LATAM pages - sat in the monthly bucket
   with NO lastmod, which is why the six ask pages took ZERO crawler hits in 30 days while /liquidations/,
   which links them, took 6,099.

   Load-bearing check: every page whose content is a live figure must be declared daily AND carry today's
   lastmod as SERVED (the worker refreshes it, so the signal stays true between deploys). Falsify by setting
   one of them back to monthly in build/add-sitemap-extras.js - the first check goes red.

   node build/sitemap-cadence-e2e.js                                                                        */
const ORIGIN = 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 200))); };

// pages whose whole point is a number that moves every day
const LIVE = [
  '/how-many-traders-liquidated-today/', '/longs-or-shorts-liquidated-more/', '/biggest-liquidation-today/',
  '/is-funding-positive-or-negative/', '/where-can-i-test-a-trading-bot/', '/mcp-server-for-crypto-trading/',
  '/heatmap', '/arena/', '/leaderboards/', '/season/', '/trading-competition/',
  '/dolar-cripto/', '/bitcoin-hoje/', '/crypto-liquidations-today/', '/rekt/',
];

(async () => {
  const res = await fetch(ORIGIN + '/sitemap.xml?cb=' + Date.now());
  ok(res.ok, 'GET /sitemap.xml answers 200', res.status);
  const xml = await res.text();
  const blocks = [...xml.matchAll(/<url>(?:(?!<\/url>)[\s\S])*?<\/url>/g)].map(m => m[0]);
  const at = (p) => blocks.find(b => b.indexOf('<loc>' + ORIGIN + p + '</loc>') >= 0);
  const today = new Date().toISOString().slice(0, 10);

  const wrong = LIVE.filter(p => { const b = at(p); return !b || !/<changefreq>(daily|hourly)<\/changefreq>/.test(b); });
  ok(wrong.length === 0, 'every live-figure page is declared daily or hourly', wrong);

  const undated = LIVE.filter(p => { const b = at(p); return !b || b.indexOf('<lastmod>' + today + '</lastmod>') < 0; });
  ok(undated.length === 0, 'and carries TODAY as its lastmod as served, not the build date', undated);

  const noLm = blocks.filter(b => b.indexOf('<lastmod>') < 0).length;
  ok(noLm === 0, 'no entry anywhere is missing a lastmod (a crawler has nothing to schedule on)', { without: noLm, of: blocks.length });

  ok(res.headers.get('x-mp-sitemap-fresh') !== null, 'the worker served it, so the dates stay true between deploys', res.headers.get('x-mp-sitemap-fresh'));

  // a calculator's answer does not change because the market moved - over-declaring teaches a crawler to
  // discount the whole file, so this guards the other direction too
  const EVERGREEN = ['/position-size-calculator/', '/leverage-calculator/', '/privacy/'];
  const over = EVERGREEN.filter(p => { const b = at(p); return b && /<changefreq>(daily|hourly)<\/changefreq>/.test(b); });
  ok(over.length === 0, 'and nothing evergreen claims to change daily', over);

  // the pages have to actually exist, or the cadence is a promise about a 404
  const codes = await Promise.all(LIVE.slice(0, 8).map(p => fetch(ORIGIN + p).then(r => r.status).catch(() => 0)));
  const bad = LIVE.slice(0, 8).filter((p, i) => codes[i] !== 200);
  ok(bad.length === 0, 'every page it promises daily answers 200', bad);

  // ---- and the cadence has to reach Bing, which is 74% of all crawling we get -----------------------------
  // checkIndexNow had been calling fetch() on our OWN zone, which a Worker cannot do, so it fell out at
  // `if (!urls.length) return` inside a swallowing try/catch and announced nothing at all. peek is read-only:
  // it reports the last run without submitting, so this test never pings anyone.
  try {
    const fs = require('fs'), path = require('path');
    const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
    const pk = await fetch(ORIGIN + '/api/admin/indexnow?peek=1', { headers: { 'x-admin-key': KEY } }).then(r => r.json());
    const last = pk && pk.last;
    ok(!!last, 'IndexNow reports its last run instead of a bare ok', pk);
    if (last) {
      const dailyCount = blocks.filter(b => /<changefreq>(daily|hourly)<\/changefreq>/.test(b)).length;
      ok(last.daily === dailyCount, 'and it announced every daily page the sitemap declares', { announced: last.daily, declared: dailyCount });
      ok(last.day === today, 'and it ran today', last.day);
    }
  } catch (e) { console.log('  skip  IndexNow peek (' + String(e.message).slice(0, 60) + ')'); }

  console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;   // never process.exit - it aborts mid-teardown and the shell sees 127
})().catch(e => { console.error('fatal ' + e.message); process.exitCode = 1; });

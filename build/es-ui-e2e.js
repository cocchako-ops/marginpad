/* THE SPANISH TABLES MOVED OUT OF THE BUNDLES (2026-10-13) AND THIS IS WHAT PROVES IT STILL WORKS.
   The failure mode of the split is the quiet one - a page that misses /assets/es/<bundle>.js reads as English
   and nothing on screen says why - so this runs a REAL browser over the WORKING TREE (not production: a
   deployed site cannot tell you anything about the branch you are about to merge) and checks both directions:
   the twin is Spanish, the English page is untouched, and a twin with the tag removed goes English AND SAYS SO.

   The load-bearing checks are the last four. Falsify them by deleting the two __esUIMiss lines from
   build/es/lib-es-ui.js and re-splitting: "reported the miss" and "repaired itself" must go red.

     node build/es-ui-e2e.js            headless
     node build/es-ui-e2e.js --head     watch it
   Run after any change to the bundles' Spanish layer, with check-es-ui.js (which is the static half). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { withBrowser } = require('./e2e-browser');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HEAD = process.argv.includes('--head');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra ? '  [' + extra + ']' : '')); } };

// A twin and its English original that both load mp-nav and nothing heavier - the Browse drawer is built from
// mp-nav's own table, so one row title is the whole contract in one string.
const EN_PAGE = '/about/', ES_PAGE = '/es/about/';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

// `drop` lets a leg serve a twin with one tag cut out - the only honest way to test a missing table is to make
// it actually missing over the network, not to stub a global.
let drop = null;
function serve(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(DIST, p);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('no'); return; }
    if (drop && p.indexOf(drop) >= 0) { res.writeHead(404, { 'content-type': 'text/plain' }).end('dropped by the test'); return; }
    let body = fs.readFileSync(f);
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}

// Every string this test judges by comes out of the shipped table, never a literal typed here: a test that
// hardcodes "Escuadras" passes a day after the translation changes and proves nothing about the file that ships.
const TABLE = (function () {
  const s = fs.readFileSync(path.join(DIST, 'assets', 'es', 'mp-nav.js'), 'utf8');
  return JSON.parse(/window\.__esUI\.mpnav = (\{[\s\S]*\});/.exec(s)[1]);
})();

async function visit(browser, url, opts) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  const reqs = [], warns = [];
  page.on('request', r => reqs.push(r.url()));
  // puppeteer's type for console.warn is 'warn', not 'warning' - the first run of this file reported the
  // product broken on that one word while the browser had printed the warning perfectly.
  page.on('console', m => { if (m.type() === 'warn' || m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await new Promise(r => setTimeout(r, opts && opts.wait || 1200));
  const state = await page.evaluate(() => {
    try { if (window.mpNavOpen) window.mpNavOpen(); } catch (e) {}
    return {
      lang: document.documentElement.lang,
      table: window.__esUI && window.__esUI.mpnav ? Object.keys(window.__esUI.mpnav).length : 0,
      missed: JSON.parse(JSON.stringify(window.__esUIMissed || {})),
    };
  });
  await new Promise(r => setTimeout(r, 400));
  const text = await page.evaluate(() => document.body.innerText || '');
  const after = await page.evaluate(() => JSON.parse(JSON.stringify(window.__esUIMissed || {})));
  await page.close();
  return { reqs, warns, errs, state, text, after };
}

withBrowser(async (browser) => {
  const PORT = 8731;
  const srv = await serve(PORT);
  const base = 'http://127.0.0.1:' + PORT;
  const esRow = TABLE.squads, enRow = 'Squads';

  try {
    console.log('ENGLISH PAGE (' + EN_PAGE + ') - must not pay for Spanish at all');
    let r = await visit(browser, base + EN_PAGE);
    ok(r.state.lang === 'en', 'serves lang="en"', r.state.lang);
    ok(!r.reqs.some(u => u.indexOf('/assets/es/') >= 0), 'requests nothing under /assets/es/',
      r.reqs.filter(u => u.indexOf('/assets/es/') >= 0).join(','));
    ok(r.state.table === 0, 'no Spanish table in memory', 'keys=' + r.state.table);
    ok(r.text.indexOf(enRow) >= 0, 'the Browse row reads English ("' + enRow + '")');
    ok(r.text.indexOf(esRow) < 0, 'and never the Spanish ("' + esRow + '")');
    ok(Object.keys(r.after).length === 0, 'reports no miss - an English page is not a broken Spanish page', JSON.stringify(r.after));
    ok(r.errs.length === 0, 'no page errors', r.errs.join(' | '));

    console.log('SPANISH TWIN (' + ES_PAGE + ') - the table arrives with the bundle');
    r = await visit(browser, base + ES_PAGE);
    ok(r.state.lang === 'es', 'serves lang="es"', r.state.lang);
    ok(r.reqs.some(u => u.indexOf('/assets/es/mp-nav.js') >= 0), 'requests /assets/es/mp-nav.js');
    ok(r.state.table === Object.keys(TABLE).length, 'the whole table is in memory', 'keys=' + r.state.table + ' of ' + Object.keys(TABLE).length);
    ok(r.text.indexOf(esRow) >= 0, 'the Browse row reads Spanish ("' + esRow + '")');
    ok(Object.keys(r.after).length === 0, 'reports no miss', JSON.stringify(r.after));
    ok(r.errs.length === 0, 'no page errors', r.errs.join(' | '));
    // the tag has to be IN FRONT of the bundle, or the bundle paints before the table exists
    const html = fs.readFileSync(path.join(DIST, 'es', 'about', 'index.html'), 'utf8');
    ok(html.indexOf('/assets/es/mp-nav.js') < html.indexOf('"/assets/mp-nav.js'), 'the tag is before the bundle tag');

    // mp-auth has no tag on an SEO page - mp-nav pulls it lazily, so its table can only come from __esSide.
    // This is the half check-es-ui cannot see: it reads markup, and there is no markup here to read.
    console.log('A LAZILY LOADED BUNDLE (mp-auth, pulled by mp-nav) - its table comes from __esSide');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      const reqs = [];
      page.on('request', q => reqs.push(q.url()));
      await page.goto(base + ES_PAGE, { waitUntil: 'load', timeout: 45000 });
      const got = await page.evaluate(async () => {
        if (!window.mpEnsureAuth) return { no: 'mpEnsureAuth missing' };
        await new Promise(r => window.mpEnsureAuth(r));
        return { auth: !!window.mpAuth, keys: window.__esUI && window.__esUI.mpauth ? Object.keys(window.__esUI.mpauth).length : 0, missed: JSON.parse(JSON.stringify(window.__esUIMissed || {})) };
      });
      await page.close();
      ok(!got.no, 'mp-nav exposes the lazy loader', got.no);
      ok(reqs.some(u => u.indexOf('/assets/es/mp-auth.js') >= 0), 'the loader asked for /assets/es/mp-auth.js');
      ok(got.keys > 0, 'mp-auth\'s table is in memory after the lazy load', 'keys=' + got.keys);
      ok(!got.missed || Object.keys(got.missed).length === 0, 'and no miss was reported', JSON.stringify(got.missed));
    }

    console.log('THE TABLE GONE (the failure mode) - must fall back AND say so');
    drop = '/assets/es/mp-nav.js';
    r = await visit(browser, base + ES_PAGE, { wait: 2000 });
    ok(r.state.table === 0, 'no table in memory', 'keys=' + r.state.table);
    ok(r.text.indexOf(esRow) < 0 && r.text.indexOf(enRow) >= 0, 'the row falls back to English rather than breaking');
    ok(r.after['mp-nav.js'] === 'did not load', 'reported the miss, with the reason', JSON.stringify(r.after));
    ok(r.warns.some(w => w.indexOf('/assets/es/mp-nav.js') >= 0 && w.indexOf('English') >= 0), 'warned in the console',
      r.warns.slice(0, 2).join(' | '));
    ok(r.reqs.filter(u => u.indexOf('/assets/es/mp-nav.js') >= 0).length >= 2, 'repaired itself - asked for the table a second time',
      'requests=' + r.reqs.filter(u => u.indexOf('/assets/es/mp-nav.js') >= 0).length);
    ok(r.errs.length === 0, 'and still threw nothing', r.errs.join(' | '));
    drop = null;
  } finally {
    srv.close();
  }

  console.log('\nes-ui-e2e: ' + pass + ' ok, ' + fail + ' fail');
  // exitCode, never process.exit: exiting mid-teardown aborts inside libuv and the shell sees 127 on a green run
  process.exitCode = fail ? 1 : 0;
}, HEAD ? { extraLaunch: { headless: false } } : {});

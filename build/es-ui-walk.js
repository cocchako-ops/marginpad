/* DID MOVING THE TABLES OUT OF THE BUNDLES COST A SPANISH READER ANY SPANISH? (2026-10-13)
   The walk CLAUDE.md names as "the only thing that measures what a reader actually meets": a browser with an
   ENGLISH locale and no stored preference opens each page and the VISIBLE text is counted, Spanish function
   words against English ones. A grep cannot do this - what a reader meets is what the bundles paint.

   It serves dist/ from the working tree, and with --before it serves the TEN BUNDLES AND THE PAGES AS THEY ARE
   AT git HEAD instead, so the same pages are measured on both sides of the change with one script. Anything
   below HEAD's number is a regression; equal is the goal (the strings did not change, only where they live).

   WHAT IT CANNOT SEE, and a reviewer should know it: no worker, so nothing the SSR handlers inject is here, and
   no session, so member-only surfaces stay guest. It measures the static layer plus the bundles - which is
   exactly the layer this change touched.

     node build/es-ui-walk.js              the working tree
     node build/es-ui-walk.js --before     git HEAD, for comparison                                           */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const { withBrowser } = require('./e2e-browser');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BEFORE = process.argv.includes('--before');

const PAGES = ['/es/', '/es/about/', '/es/alerts/', '/es/exchanges/', '/es/premium/', '/es/academy/',
  '/es/leaderboards/', '/es/season/', '/es/vault/', '/es/rewards/', '/es/liquidations/', '/es/trading-competition/',
  '/es/paper-trade', '/es/screener', '/es/heatmap'];
const SHELL = { '/es/paper-trade': 'app-es.html', '/es/screener': 'app-es.html', '/es/heatmap': 'app-es.html' };

const ES = ['de', 'la', 'el', 'los', 'las', 'que', 'para', 'con', 'una', 'por', 'tu', 'mas', 'más', 'sin', 'en', 'al', 'del', 'se', 'es', 'su', 'cada', 'cuando', 'como', 'cómo', 'donde', 'dónde', 'tus', 'un', 'no', 'ya'];
const EN = ['the', 'and', 'for', 'with', 'your', 'from', 'this', 'that', 'are', 'you', 'not', 'all', 'will', 'can', 'how', 'what', 'when', 'which', 'than', 'their', 'our', 'every', 'each', 'into', 'about', 'more', 'open', 'close'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

const SPLIT = fs.existsSync(path.join(DIST, 'assets', 'es')) ? fs.readdirSync(path.join(DIST, 'assets', 'es')) : [];
const headCache = new Map();
function fromHead(relPosix) {
  if (headCache.has(relPosix)) return headCache.get(relPosix);
  let buf = null;
  // stderr ignored on purpose: the pages fetch /api/... too, and git complaining that dist/api/price is not in
  // HEAD is noise, not news - the request 404s either way, exactly as it does in the after leg.
  try { buf = cp.execSync('git show HEAD:' + relPosix, { cwd: ROOT, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { buf = null; }
  headCache.set(relPosix, buf);
  return buf;
}

function serve(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (SHELL[p]) p = '/' + SHELL[p];
    else if (p.endsWith('/')) p += 'index.html';
    const f = path.join(DIST, p);
    const relPosix = 'dist' + p;
    let body = null;
    // --before: the bundles AND the pages as HEAD has them (HEAD's twins carry no table tag, which is the point)
    if (BEFORE) body = fromHead(relPosix);
    if (!body) {
      if (BEFORE && p.indexOf('/assets/es/') === 0) { res.writeHead(404).end('x'); return; }
      if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('x'); return; }
      body = fs.readFileSync(f);
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}

withBrowser(async (browser) => {
  const PORT = 8732;
  const srv = await serve(PORT);
  const base = 'http://127.0.0.1:' + PORT;
  const rows = [];
  try {
    for (const url of PAGES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      // an ENGLISH browser with nothing stored: the only honest way to see what a stranger meets
      await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
      let missed = {}, text = '';
      try {
        await page.goto(base + url, { waitUntil: 'load', timeout: 45000 });
        await new Promise(r => setTimeout(r, 1800));
        text = await page.evaluate(() => document.body.innerText || '');
        missed = await page.evaluate(() => JSON.parse(JSON.stringify(window.__esUIMissed || {})));
      } catch (e) { text = ''; }
      await page.close();
      const words = (text.toLowerCase().match(/[a-záéíóúüñ]+/g) || []);
      let es = 0, en = 0;
      for (const w of words) { if (ES.indexOf(w) >= 0) es++; else if (EN.indexOf(w) >= 0) en++; }
      const pct = es + en ? (100 * es / (es + en)) : 0;
      rows.push({ url, pct, es, en, words: words.length, missed: Object.keys(missed).join(',') });
    }
  } finally { srv.close(); }

  const pad = (s, n) => String(s).padEnd(n), rp = (s, n) => String(s).padStart(n);
  console.log((BEFORE ? 'BEFORE (git HEAD, tables inline)' : 'AFTER (working tree, tables in /assets/es/)') + '  -  Spanish share of function words in VISIBLE text');
  for (const r of rows) console.log('  ' + pad(r.url, 30) + rp(r.pct.toFixed(1) + '%', 7) + rp(r.es + '/' + (r.es + r.en), 10) + rp(r.words, 8) + '  ' + (r.missed ? 'MISS ' + r.missed : ''));
  const tot = rows.reduce((a, r) => ({ es: a.es + r.es, en: a.en + r.en }), { es: 0, en: 0 });
  console.log('  ' + pad('ALL PAGES', 30) + rp((100 * tot.es / Math.max(1, tot.es + tot.en)).toFixed(1) + '%', 7) + rp(tot.es + '/' + (tot.es + tot.en), 10));
  console.log('  (' + SPLIT.length + ' tables in dist/assets/es)');
  const anyMiss = rows.filter(r => r.missed).length;
  if (!BEFORE && anyMiss) { console.log('  ' + anyMiss + ' page(s) reported a missing table - that is a FAIL'); process.exitCode = 1; }
}, {});

/* THE REPORT CARD (2026-11-12, owner-approved feature #8): GET /api/report/card.svg?u=<name> = a 1200x630 SVG of the member's season
   (win rate, realized P&L, best ROE, best trade, level, the 30-day curve), and a Share button in the My Trades header that rasterises
   it to a PNG and hands it to navigator.share (or downloads it) with the profile link.
   --pure : reportCardSvg lifted out of the SHIPPED worker - the shape, the figures, the thin-curve and no-trades cards, escaping.
   (default): the pure checks, then a browser: the button in the drawer header on the app shell and on /rekt/ (390 too), a signed-in
   member's click fetches their own card and shares a PNG file, a guest's click opens sign-in, and the share stays off when the drawer
   is closed.
   --prod : adds the live route (a real member's card, a missing one, a bad name).
   Run: node build/report-card-e2e.js [--pure] [--local] [--prod] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), BASE = 'https://marginpad.io';
const PURE = process.argv.includes('--pure'), LOCAL = process.argv.includes('--local'), PROD = process.argv.includes('--prod');
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
const a0 = W.indexOf('function reportCardSvg(d, name) {'), a1 = W.indexOf('\n// Test sink: POST anything', a0);
if (a0 < 0 || a1 < 0) throw new Error('cannot lift reportCardSvg');
const reportCardSvg = new Function(W.slice(a0, a1) + '\nreturn reportCardSvg;')();
const cum = Array.from({ length: 30 }, (_, i) => +(i * 5.2 - 20).toFixed(2));
const FULL = { exists: true, name: 'Papis', level: { k: 'diamond', name: 'Diamond', col: '#8b5cff' }, stats: { trades: 41, closed: 38, wins: 25, winRate: 66, realized: 1234.5, bestRoe: 212, bestPnl: 310.4, season: true }, curve: { from: 0, days: [], cum, n: 38, serverOnly: true } };
const wellFormed = (s) => /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1200" height="630"/.test(s) && /<\/svg>$/.test(s) && !/&(?!amp;|lt;|gt;|quot;|#)/.test(s) && (s.match(/<text\b/g) || []).length === (s.match(/<\/text>/g) || []).length;
{ const s = reportCardSvg(FULL, 'Papis');
  chk('pure: a full card is a 1200x630 SVG with every text closed and every ampersand escaped', wellFormed(s), s.slice(0, 120));
  chk('pure: it names the member, the level and the season figures', /@Papis/.test(s) && /DIAMOND/.test(s) && /WIN RATE/.test(s) && />66%</.test(s) && /\+\$1,235</.test(s) && /\+212%</.test(s) && /\+\$310\.4</.test(s) && /41 trades this season · 38 closed · 25 won/.test(s), s.match(/>[^<]{1,40}</g).slice(0, 30));
  chk('pure: the 30-day curve is drawn as a path with its zero line and its count', /30 DAYS · REALIZED P&amp;L/.test(s) && /stroke-dasharray="4 4"/.test(s) && /<path d="M/.test(s) && /38 server-settled closes/.test(s) && /\+\$130\.8</.test(s), (s.match(/\+\$13[0-9][^<]*/) || [])[0]);
  chk('pure: a losing month colours the curve red', /#ff5a4d/.test(reportCardSvg(Object.assign({}, FULL, { curve: { cum: cum.map(v => -v), n: 30 } }), 'Papis')));
  const thin = reportCardSvg(Object.assign({}, FULL, { curve: { cum: cum, n: 2 } }), 'Papis');
  chk('pure: under three settled closes the curve panel says so instead of drawing', /30-day curve from the third settled close/.test(thin) && /2 of 3 so far/.test(thin) && !/server-settled closes/.test(thin));
  const none = reportCardSvg(Object.assign({}, FULL, { stats: { trades: 0, closed: 0, wins: 0, winRate: 0, realized: 0 }, curve: null }), 'Papis');
  chk('pure: no settled trades = an honest empty card, no tiles', /No settled trades this season yet/.test(none) && !/WIN RATE/.test(none) && wellFormed(none));
  const miss = reportCardSvg({ exists: false }, 'nobody_here');
  chk('pure: an unknown name says so', /No trader called nobody_here/.test(miss) && wellFormed(miss));
  const esc = reportCardSvg(Object.assign({}, FULL, { name: 'a<b&c', level: { name: 'x"y', col: '#fff' } }), 'a<b&c');
  chk('pure: a name and a level are escaped on the way in', /@a&lt;b&amp;c/.test(esc) && !/<b&c/.test(esc) && /X&quot;Y/.test(esc), esc.match(/@[^<]*/)[0]);
}
if (PURE) { console.log('\nreport-card-e2e: ' + okN + ' passed, ' + failN + ' failed [pure]'); process.exit(failN ? 1 : 0); }
const { withBrowser } = require('./e2e-browser');
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); if (p === '/rekt/') return path.join(ROOT, 'dist', 'rekt', 'index.html'); return null; }
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0a0b0d"/><rect x="100" y="100" width="400" height="200" fill="#c2f64a"/></svg>';
async function mk(browser, url, w, member) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
  if (member) await p.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  await p.setRequestInterception(true); const reqs = [];
  p.on('request', r => { const u = r.url(); reqs.push(u);
    if (u.indexOf('/api/track') >= 0) return r.respond({ status: 204, body: '' });
    if (u.indexOf('/api/auth/me') >= 0) return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(member ? { user: { id: 'e2ecard', username: 'e2e_card', xp: 900 } } : { user: null }) });
    if (u.indexOf('/api/auth/xp') >= 0 && r.method() === 'GET') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: !!member, xp: 900, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
    if (u.indexOf('/api/report/card.svg') >= 0) return r.respond({ status: 200, headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' }, body: SVG });
    if (LOCAL) { const f = localFile(u); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } }
    r.continue(); });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} window.__shared = null; try { navigator.canShare = function () { return true; }; navigator.share = function (d) { window.__shared = { files: (d.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })), text: d.text, title: d.title }; return Promise.resolve(); }; } catch (e) {} });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  await p.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => !!window.mpOpenTrades && !!window.mpReportShare, { timeout: 40000 });
  return { ctx, p, errs, reqs };
}
const btnGeo = () => { const b = document.getElementById('jrShare'); if (!b) return null; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const h = b.closest('.jr-head'); const hr = h && h.getBoundingClientRect(); return { inHead: !!h, under: !!(e && (e === b || b.contains(e))), vis: r.width > 0 && r.height > 0 && r.right <= innerWidth, headH: hr && Math.round(hr.height), txt: b.textContent.trim() }; };
(async () => {
  await withBrowser(async (browser) => {
    { // the app shell, a member: the button is in the header, a click shares a PNG with the profile link
      const { ctx, p, errs, reqs } = await mk(browser, '/paper-trade', 1366, true);
      await p.waitForFunction(() => !!(window.mpAuth && window.mpAuth.me && window.mpAuth.me()), { timeout: 20000 }).catch(() => {});
      await p.evaluate(() => window.mpOpenTrades()); await sleep(400);
      const g = await p.evaluate(btnGeo);
      chk('the My Trades header carries a Share button, reachable, one row', !!g && g.inHead && g.under && g.vis && g.txt === 'Share' && g.headH < 60, g);
      await p.evaluate(() => document.getElementById('jrShare').click());
      const shared = await p.waitForFunction(() => window.__mpReportShareLast != null, { timeout: 20000 }).then(() => p.evaluate(() => ({ last: window.__mpReportShareLast, shared: window.__shared }))).catch(() => null);
      chk('a signed-in member shares ONE png file named after them, with the profile link in the text', !!shared && shared.last && shared.last.ok && shared.last.how === 'share' && shared.shared && shared.shared.files.length === 1 && shared.shared.files[0].name === 'marginpad-report-e2e_card.png' && shared.shared.files[0].type === 'image/png' && shared.shared.files[0].size > 500 && /community\/u\/e2e_card/.test(shared.shared.text), shared);
      chk('the card fetched was the member OWN card', reqs.some(u => /\/api\/report\/card\.svg\?u=e2e_card/.test(u)), reqs.filter(u => /card\.svg/.test(u)));
      chk('no page errors', errs.length === 0, errs);
      await ctx.close(); }
    { // a guest: the click opens sign-in and fetches nothing
      const { ctx, p, reqs } = await mk(browser, '/paper-trade', 1366, false);
      await p.evaluate(() => { window.__opened = 0; var o = window.mpAuth.open; window.mpAuth.open = function () { window.__opened++; return o.apply(this, arguments); }; });
      await p.evaluate(() => window.mpOpenTrades()); await sleep(300);
      await p.evaluate(() => document.getElementById('jrShare').click()); await sleep(600);
      const st = await p.evaluate(() => ({ opened: window.__opened, last: window.__mpReportShareLast }));
      chk('a guest is sent to sign in, nothing is fetched or shared', st.opened === 1 && st.last && st.last.why === 'guest' && !reqs.some(u => /card\.svg/.test(u)), st);
      await ctx.close(); }
    { // the other bundle at phone width: /rekt/ (mp-trade.js drawer), the button fits the header
      const { ctx, p, errs } = await mk(browser, '/rekt/', 390, true);
      await p.evaluate(() => window.mpOpenTrades()); await sleep(500);
      const g = await p.evaluate(btnGeo);
      chk('/rekt/ at 390: the Share button is in the drawer header and under the finger', !!g && g.inHead && g.under && g.vis, g);
      const wide = await p.evaluate(() => { const h = document.querySelector('#jrDrawer .jr-head'); return h ? [...h.children].filter(x => x.getBoundingClientRect().right > innerWidth + 1).length : -1; });
      chk('nothing in the header runs off a 390 screen', wide === 0, wide);
      chk('no page errors on /rekt/', errs.length === 0, errs);
      await ctx.close(); }
  }, { timeoutMs: 420000 });
  if (PROD) {
    const get = (u) => fetch(BASE + u, { cache: 'no-store' }).then(async r => ({ st: r.status, ct: r.headers.get('content-type') || '', cc: r.headers.get('cache-control') || '', body: await r.text() }));
    const r = await get('/api/report/card.svg?u=Papis&nc=1');
    chk('prod: a real member answers 200 image/svg+xml, 1200x630, named, cached 300 s', r.st === 200 && /image\/svg\+xml/.test(r.ct) && /max-age=300/.test(r.cc) && wellFormed(r.body) && /@Papis/.test(r.body), { st: r.st, ct: r.ct, cc: r.cc, len: r.body.length });
    const m = await get('/api/report/card.svg?u=nobody_e2e_zzz&nc=1');
    chk('prod: an unknown name is a 404 SVG that says so', m.st === 404 && /No trader called nobody_e2e_zzz/.test(m.body), { st: m.st });
    const b = await get('/api/report/card.svg');
    chk('prod: no name is 400', b.st === 400, b.st);
  }
  console.log('\nreport-card-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : '') + (PROD ? ' [+prod]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

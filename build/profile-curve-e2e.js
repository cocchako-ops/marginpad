/* THE PUBLIC PROFILE CURVE (2026-11-12, owner-approved feature #9): /api/lb/user carries `curve` - thirty UTC days of realized P&L
   from SERVER-SETTLED closes as a daily cumulative line (never a client-synced row, never the RNG class) - and the profile card
   (mp-profile.js) and /community/u/<name> draw it. Nothing under three closes.
   Browser legs run on a CANNED payload (the live shape is market data); --prod adds the live payload's shape.
   Run: node build/profile-curve-e2e.js [--local] [--prod] */
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_DESKTOP, UA_MOBILE } = require('./e2e-browser');
const BASE = 'https://marginpad.io', ROOT = path.join(__dirname, '..'), A = path.join(ROOT, 'dist', 'assets');
const LOCAL = process.argv.includes('--local'), PROD = process.argv.includes('--prod');
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DAY = 86400000, from30 = Math.floor(Date.now() / DAY) * DAY - 29 * DAY;
function mkCurve(vals, nPer) { const days = vals.map((v, i) => [from30 + i * DAY, v, nPer]); let acc = 0; const cum = days.map(d => { acc += d[1]; return +acc.toFixed(2); }); return { from: from30, days, cum, n: nPer * vals.length, serverOnly: true }; }
const UP = mkCurve(Array.from({ length: 30 }, (_, i) => (i % 4 === 3 ? -6 : 9)), 1);   // ends positive: 23*9 - 7*6 = 165 (i%4===3 for i=3,7,...,27 -> 7 days)
const DOWN = mkCurve(Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? 4 : -7)), 1); // ends negative
const THIN = mkCurve(Array.from({ length: 30 }, (_, i) => (i === 28 ? 12 : 0)), 0); THIN.n = 2;
const BASEP = { exists: true, isSelf: false, viewerSignedIn: false, uid: 'u:e2ecurve', name: 'e2e_curve', level: { k: 'silver', name: 'Silver', col: '#b7c2d0', pct: 40, next: 'Gold', toNext: 5000, xp: 7000, stars: 0 }, iFollow: false, followsMe: false, mutual: false, requested: false, bio: '', avatar: '', coins: [], frame: 'default', cardbg: '', records: null, stats: { trades: 31, closed: 30, wins: 20, winRate: 66, realized: 156, bestRoe: 40, bestPnl: 30, weekTrades: 12, weekWinRate: 58, weekPnl: 44, season: true }, sqbadge: '', followers: 3, squad: null };
async function prep(browser, mobile, payload, extra) {
  const page = await newPage(browser, { mobile, ua: mobile ? UA_MOBILE : UA_DESKTOP });
  await page.setViewport({ width: mobile ? 390 : 1366, height: mobile ? 844 : 900, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e).slice(0, 140)));
  await page.setCacheEnabled(false); await page.setRequestInterception(true);
  try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
  page.on('request', (req) => {
    const u = req.url();
    if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
    if (u.includes('/api/lb/user')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    if (extra) { const r = extra(u, req); if (r) return; }
    if (LOCAL && /\/assets\/mp-profile\.js/.test(u)) return req.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, 'mp-profile.js'), 'utf8') });
    if (LOCAL && /\/community\/(\?|$)/.test(u) && !/\/api\//.test(u)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'dist', 'community', 'index.html'), 'utf8') });
    if (LOCAL && /\/community\/u\//.test(u) && !/\/api\//.test(u)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'dist', 'community', 'index.html'), 'utf8') });
    req.continue();
  });
  return { page, errors };
}
async function openCard(page) { await page.goto(BASE + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => !!window.mpOpenProfile || !!window.mpEnsureProfile, { timeout: 40000 }); await page.evaluate(() => { if (!window.mpOpenProfile && window.mpEnsureProfile) window.mpEnsureProfile(); }); await page.waitForFunction(() => !!window.mpOpenProfile, { timeout: 30000 }); await page.evaluate(() => window.mpOpenProfile('e2e_curve')); await page.waitForFunction(() => !!document.querySelector('.lbm-card .lbm-grid'), { timeout: 20000 }); }
const readCard = () => { const c = document.querySelector('.lbm-card .lbm-curve'); if (!c) return { has: false }; const r = c.getBoundingClientRect(), card = document.querySelector('.lbm-card').getBoundingClientRect(); return { has: true, n: +c.getAttribute('data-n'), head: c.querySelector('.lbm-cvh b').textContent, col: c.querySelector('.lbm-cvh b').style.color, path: !!c.querySelector('path.l'), zero: !!c.querySelector('line.z'), foot: c.querySelector('.lbm-cvn').textContent, inside: r.left >= card.left - 1 && r.right <= card.right + 1, w: Math.round(r.width), h: Math.round(r.height) }; };
(async () => {
  await withBrowser(async (browser) => {
    { // the card, positive curve, desktop
      const { page, errors } = await prep(browser, false, Object.assign({}, BASEP, { curve: UP }));
      await openCard(page);
      const c = await page.evaluate(readCard);
      chk('the card draws the 30-day curve under the stats grid', c.has && c.path && c.zero, c);
      chk('its headline is the cumulative figure, green, and the foot says how many server-settled closes', c.head === '+$165' && /52, 217, 154/.test(c.col) && /30 server-settled closes/.test(c.foot), { head: c.head, col: c.col, foot: c.foot });
      chk('it sits inside the card at a readable height', c.inside && c.h >= 70 && c.h <= 120, { w: c.w, h: c.h });
      const order = await page.evaluate(() => { const c = document.querySelector('.lbm-card .lbm-curve'); return { prev: c.previousElementSibling && c.previousElementSibling.className, next: c.nextElementSibling && c.nextElementSibling.className }; });
      chk('it comes right after the stats grid and before the foot', /lbm-grid/.test(order.prev || '') && /lbm-foot/.test(order.next || ''), order);
      chk('no page errors', errors.length === 0, errors);
      await page.close();
    }
    { // the card, negative curve, phone
      const { page } = await prep(browser, true, Object.assign({}, BASEP, { curve: DOWN, stats: Object.assign({}, BASEP.stats, { realized: -90 }) }));
      await openCard(page);
      const c = await page.evaluate(readCard);
      chk('on a phone a losing month is drawn red with its minus figure, inside the card', c.has && c.head === '-$100' && /255, 108, 92/.test(c.col) && c.inside, c);
      await page.close();
    }
    { // under three closes: no curve at all
      const { page } = await prep(browser, false, Object.assign({}, BASEP, { curve: THIN }));
      await openCard(page);
      const c = await page.evaluate(readCard);
      chk('two closes draw no curve - a line through two points is not a record', !c.has, c);
      const none = await page.evaluate(() => !!document.querySelector('.lbm-card .lbm-grid'));
      chk('and the card itself still renders', none);
      await page.close();
    }
    { // /community/u/<name>: the season line and the curve
      const prof = { author: 'e2e_curve', uid: 'e2ecurve', rep: 12, nPosts: 1, nComments: 2, likesRecv: 3, followers: 3, following: 1, joined: Date.now() - 40 * DAY, youFollow: false, posts: [] };
      const { page, errors } = await prep(browser, false, Object.assign({}, BASEP, { curve: UP }), (u, req) => { if (/\/api\/comm\/profile\?author=/.test(u)) { req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(prof) }); return true; } return false; });
      await page.goto(BASE + '/community/u/e2e_curve', { waitUntil: 'domcontentloaded', timeout: 90000 });
      const got = await page.waitForFunction(() => !!document.querySelector('#profCurve .pcv'), { timeout: 30000 }).then(() => page.evaluate(() => { const c = document.querySelector('#profCurve .pcv'); const s = document.querySelector('#profCurve .pseason'); return { n: +c.getAttribute('data-n'), head: c.querySelector('.pcvh b').textContent, svg: !!c.querySelector('svg path'), season: s ? s.textContent : '', wide: c.getBoundingClientRect().right <= innerWidth }; })).catch(() => null);
      chk('/community/u/<name> draws the same curve and the season line (trades, win rate, realized)', !!got && got.n === 30 && got.head === '+$165' && got.svg && /31/.test(got.season) && /66%/.test(got.season) && /\+\$156/.test(got.season) && got.wide, got);
      chk('no page errors on the community profile', errors.length === 0, errors);
      await page.close();
    }
  }, { timeoutMs: 420000 });
  if (PROD) {
    const r = await fetch(BASE + '/api/lb/user?name=Papis&cb=' + Date.now()).then(x => x.json()).catch(() => null);
    const c = r && r.curve;
    chk('prod: the live payload carries a 30-day curve with cumulative values and a count', !!c && Array.isArray(c.days) && c.days.length === 30 && Array.isArray(c.cum) && c.cum.length === 30 && typeof c.n === 'number' && c.serverOnly === true && c.from === from30, c && { days: c.days.length, n: c.n, from: c.from, last: c.cum[29] });
    chk('prod: the cumulative line is the running sum of the days', !!c && Math.abs(c.cum[29] - c.days.reduce((a, d) => a + d[1], 0)) < 0.05, c && { cum: c.cum[29], sum: c.days.reduce((a, d) => a + d[1], 0) });
  }
  console.log('\nprofile-curve-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : '') + (PROD ? ' [+prod]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

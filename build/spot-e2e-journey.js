// Demo Spot E2E (2026-09-03): no account until the card is asked for, journey/reset/coach, plus the empty-account purge. Run after every /spot deploy: node build/spot-e2e-journey.js
const fs = require('fs'); const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const UID = 'spotc' + Date.now().toString(36).slice(-5); const B = 'https://marginpad.io/api/spot';
async function api(p, body) { const r = await fetch(B + p + (p.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); }
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + JSON.stringify(x).slice(0, 140) : ''));
(async () => {
  let p = await api('/portfolio'); chk('no account on read', p.none === true, p);
  p = await api('/portfolio'); chk('still none on second read', p.none === true);
  let r = await api('/start', {}); chk('start mints the card', r.ok && r.fresh === true, r);
  p = await api('/portfolio'); chk('portfolio after start: $10k card, onb 0, buys 0', p.cardUsd === 10000 && p.onb === 0 && p.buys === 0, { card: p.cardUsd, onb: p.onb, buys: p.buys });
  await api('/link', {}); await api('/onramp', { usd: 100 }); r = await api('/wallet/create', {}); await api('/withdraw', { usd: 50, net: 'solana', address: r.addr.sol });
  p = await api('/portfolio'); chk('journey advanced to onb 4', p.onb === 4, { onb: p.onb });
  r = await api('/reset', {}); chk('reset ok', r.ok, r);
  p = await api('/portfolio'); chk('after reset: onb back to 1 (card linked), $10k card, exchange 0', p.onb === 1 && p.cardUsd === 10000 && p.usdtUsd === 0 && p.wusdtUsd === 0, { onb: p.onb, card: p.cardUsd });
  await withBrowser(async (browser) => {
    const NU = UID + 'b'; const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setExtraHTTPHeaders({ 'x-admin-key': K });
    await page.evaluateOnNewDocument((uid) => { const of = window.fetch; window.fetch = function (u, o) { if (typeof u === 'string' && u.indexOf('/api/spot/') === 0 && !/\/(memes|memechart|chain)/.test(u)) u += (u.indexOf('?') > 0 ? '&' : '?') + 'uid=' + uid; return of.call(this, u, o); }; try { Object.defineProperty(window, 'mpAuth', { value: { me: () => ({ id: uid, username: uid }), ready: () => Promise.resolve(), on: () => {} }, writable: false, configurable: false }); } catch (e) {} }, NU);
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 100)));
    await page.goto('https://marginpad.io/spot/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000));
    const g = await page.evaluate(() => { const b = document.querySelector('#gate .cta'); const r = b && b.getBoundingClientRect(); const h = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { gate: !document.getElementById('gate').hidden, app: !document.getElementById('app').hidden, authAttr: b && b.hasAttribute('data-auth-open'), reachable: !!(b && h && (h === b || b.contains(h))), text: b && b.textContent.trim() }; });
    chk('browser: signed-in without account sees the gate, card button reachable, not the auth opener', g.gate && !g.app && g.authAttr === false && g.reachable, g);
    await page.click('#gate .cta'); await new Promise(r => setTimeout(r, 3500));
    const a = await page.evaluate(() => ({ app: !document.getElementById('app').hidden, coach: (document.getElementById('coach') || {}).textContent || '' }));
    chk('browser: card issued, app shown, coach at step 1 of 6', a.app && /STEP 1 OF 6/.test(a.coach), { coach: a.coach.slice(0, 60) });
    chk('browser: zero page errors', errs.length === 0, errs);
    await ctx.close();
  });
  const pg = await (await fetch('https://marginpad.io/api/admin/spotpurge', { method: 'POST', headers: { 'x-admin-key': K } })).json(); chk('purge empty accounts', pg.ok, pg);
  console.log(out.join('\n')); console.log('pass', out.filter(x => x[0] === 'P').length, 'fail', out.filter(x => x[0] === 'F').length);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });

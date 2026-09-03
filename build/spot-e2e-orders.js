// Demo Spot E2E (2026-09-03): limit orders — add/list/cancel, a crossed buy fills through the sweep at the market price, an uncrossed sell stays open, a sell with no funds fails with a note, the trade-modal Limit toggle and the open-orders list in a real browser.
const fs = require('fs'); const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const UID = 'spotord' + Date.now().toString(36).slice(-4); const B = 'https://marginpad.io/api/spot';
async function api(p, body) { const r = await fetch(B + p + (p.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); }
const sweep = async () => (await fetch('https://marginpad.io/api/admin/spotorders', { headers: { 'x-admin-key': K } })).json();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + JSON.stringify(x).slice(0, 150) : ''));
(async () => {
  await api('/start', {}); await api('/link', {}); await api('/onramp', { usd: 500 });
  const btc = (await (await fetch('https://marginpad.io/api/price?symbol=BTC')).json()).price;
  let r = await api('/order', { action: 'add', side: 'buy', kind: 'cex', sym: 'BTC', price: Math.round(btc * 1.5), usd: 100 }); chk('add buy limit above market', r.ok && r.id, r); const idBuy = r.id;
  r = await api('/order', { action: 'add', side: 'sell', kind: 'cex', sym: 'BTC', price: Math.round(btc * 3), pct: 100 }); chk('add sell limit far above', r.ok, r); const idSell = r.id;
  r = await api('/order', { action: 'add', side: 'sell', kind: 'cex', sym: 'ETH', price: 1, pct: 100 }); chk('add sell ETH at $1 (crossed, but nothing held)', r.ok, r);
  chk('bad price rejected', (await api('/order', { action: 'add', side: 'buy', kind: 'cex', sym: 'BTC', price: 0, usd: 10 })).error === 'bad_price');
  chk('min $1 rejected', (await api('/order', { action: 'add', side: 'buy', kind: 'cex', sym: 'BTC', price: 100, usd: 0.5 })).error === 'min_trade');
  let l = await api('/order', { action: 'list' }); chk('list shows 3 open', l.open && l.open.length === 3, { open: l.open && l.open.length });
  const sw = await sweep(); chk('sweep ran', sw.checked >= 3, sw);
  l = await api('/order', { action: 'list' });
  const fb = l.done.find(o => o.id === idBuy), fs2 = l.open.find(o => o.id === idSell), fe = l.done.find(o => o.kind === 'cex' && o.sym === 'ETH');
  chk('crossed buy filled at market with a note', fb && fb.status === 'filled' && /filled at \$/.test(fb.note), fb && { st: fb.status, note: fb.note });
  chk('uncrossed sell still open', !!fs2);
  chk('sell without a position failed with a note', fe && fe.status === 'failed' && /no_position/.test(fe.note), fe && { st: fe.status, note: fe.note });
  const p = await api('/portfolio'); chk('BTC hold exists after the fill', (p.holds || []).some(h => h.sym === 'BTC' && h.valueUsd > 90), { holds: (p.holds || []).map(h => h.sym) });
  r = await api('/order', { action: 'cancel', id: idSell }); chk('cancel open sell', r.ok);
  l = await api('/order', { action: 'list' }); chk('no open orders left', l.open.length === 0, { open: l.open.length, done: l.done.length });
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setExtraHTTPHeaders({ 'x-admin-key': K });
    await page.evaluateOnNewDocument((uid) => { const of = window.fetch; window.fetch = function (u, o) { if (typeof u === 'string' && u.indexOf('/api/spot/') === 0 && !/\/(memes|memechart|chain|board)/.test(u)) u += (u.indexOf('?') > 0 ? '&' : '?') + 'uid=' + uid; return of.call(this, u, o); }; try { Object.defineProperty(window, 'mpAuth', { value: { me: () => ({ id: uid, username: uid }), ready: () => Promise.resolve(), on: () => {} }, writable: false, configurable: false }); } catch (e) {} }, UID);
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 100)));
    await page.goto('https://marginpad.io/spot/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => { const b = document.querySelector('.appsw button[data-view="ex"]'); if (b) b.click(); else document.getElementById('stnEx').click(); }); await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => { const r = document.querySelector('#exHolds .crow[data-hold]'); if (r) r.click(); }); await new Promise(r => setTimeout(r, 2500));
    const m0 = await page.evaluate(() => ({ open: document.getElementById('tmask').classList.contains('on'), sym: (document.getElementById('tmSym') || {}).textContent }));
    chk('browser: trade modal opened for BTC hold', m0.open && /BTC/.test(m0.sym || ''), m0);
    await page.evaluate(() => { document.getElementById('segBuy').click(); document.getElementById('modeLim').click(); }); await new Promise(r => setTimeout(r, 300)); // a held coin opens on Sell; the test places a limit BUY
    const lim = await page.evaluate(() => { const b = document.getElementById('modeLim'); const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { row: !document.getElementById('tmLimitRow').hidden, reachable: !!h && (h === b || b.contains(h)), btn: document.getElementById('tmGo').textContent }; });
    chk('browser: Limit mode shows the price row and relabels the button', lim.row && lim.reachable && /Place limit/.test(lim.btn), lim);
    await page.evaluate(() => { document.getElementById('tmLimit').value = '1000'; document.getElementById('tmUsd').value = '20'; document.getElementById('tmUsd').dispatchEvent(new Event('input')); }); await page.evaluate(() => document.getElementById('tmGo').click()); await new Promise(r => setTimeout(r, 2500));
    const msg = await page.evaluate(() => (document.getElementById('tmMsg') || {}).textContent || '');
    chk('browser: limit order placed from the modal', /Limit order placed/.test(msg), { msg: msg.slice(0, 80) });
    await page.evaluate(() => { const x = document.getElementById('tmX'); if (x) x.click(); }); await new Promise(r => setTimeout(r, 1500));
    const list = await page.evaluate(() => { const b = document.querySelector('#exOrders [data-ocancel]'); if (!b) return { found: false, html: (document.getElementById('exOrders') || {}).textContent }; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { found: true, reachable: !!h && (h === b || b.contains(h)), txt: (document.querySelector('#exOrders .o-b b') || {}).textContent }; });
    chk('browser: open order listed with a reachable Cancel', list.found && list.reachable, list);
    await page.evaluate(() => { const b = document.querySelector('#exOrders [data-ocancel]'); if (b) b.click(); }); await new Promise(r => setTimeout(r, 1500));
    chk('browser: cancelled from the list', await page.evaluate(() => !document.querySelector('#exOrders [data-ocancel]')));
    chk('browser: zero page errors', errs.length === 0, errs);
    await ctx.close();
  });
  console.log(out.join('\n')); console.log('UID', UID, 'pass', out.filter(x => x[0] === 'P').length, 'fail', out.filter(x => x[0] === 'F').length);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });

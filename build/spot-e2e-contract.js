// Demo Spot E2E (2026-09-03): buy any token by contract address — lookup (Solana + EVM auto-net), guards (garbage, unknown, major, thin), buy + sell of an unlisted token, and the wallet search card in a real browser.
const fs = require('fs'); const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const UID = 'spotctr' + Date.now().toString(36).slice(-4); const B = 'https://marginpad.io/api/spot';
async function api(p, body) { const r = await fetch(B + p + (p.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); }
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + JSON.stringify(x).slice(0, 150) : ''));
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', CAKE = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', WSOL = 'So11111111111111111111111111111111111111112';
(async () => {
  await api('/start', {}); await api('/link', {}); await api('/onramp', { usd: 300 }); const w = await api('/wallet/create', {}); await api('/withdraw', { usd: 200, net: 'solana', address: w.addr.sol }); await api('/swap', { asset: 'SOL', usd: 100, dir: 'buy' });
  let t = await api('/token?addr=' + BONK); chk('lookup BONK by mint', t.ok && t.net === 'solana' && t.price > 0 && /^[A-Za-z0-9]{20,60}$/.test(t.pool) && t.liqUsd > 1000, { sym: t.sym, pool: (t.pool || '').slice(0, 6), liq: Math.round(t.liqUsd), listed: t.listed });
  const c = await api('/token?addr=' + CAKE); chk('lookup CAKE auto-detects bsc', c.ok && c.net === 'bsc' && c.sym.toUpperCase() === 'CAKE', { net: c.net, sym: c.sym });
  chk('garbage address -> bad_address', (await api('/token?addr=hello')).error === 'bad_address');
  { const u = await api('/token?addr=So11111111111111111111111111111111111111113'); chk('unknown mint -> not_found (or busy while GT rate-limits)', u.error === 'not_found' || u.error === 'busy', u); }
  const maj = await api('/token?addr=' + WSOL); chk('WSOL -> major (use the exchange)', maj.error === 'major', maj);
  let r = await api('/trade', { side: 'buy', kind: 'meme', mint: t.mint, pool: t.pool, net: t.net, symbol: t.sym, name: t.name, logo: t.logo, usd: 5 }); chk('buy $5 of the contract token in SOL', r.ok && r.native === 'SOL' && r.qty > 0, { qty: r.qty, slip: r.slipPct });
  const p = await api('/portfolio'); const h = (p.holds || []).find(x => x.sym === 'sol:' + BONK); chk('hold appears with the contract identity + live price', !!h && h.valueUsd > 3, h && { v: h.valueUsd, sym: h.meta && h.meta.sym });
  r = await api('/trade', { side: 'sell', kind: 'meme', mint: BONK, pool: t.pool, net: 'solana', holdSym: 'sol:' + BONK, pct: 100, toUsdt: true }); chk('sell 100% + convert to USDT', r.ok && r.swapped && r.swapped.usdUsd > 3, r.swapped);
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setExtraHTTPHeaders({ 'x-admin-key': K });
    await page.evaluateOnNewDocument((uid) => { const of = window.fetch; window.fetch = function (u, o) { if (typeof u === 'string' && u.indexOf('/api/spot/') === 0 && !/\/(memes|memechart|chain|board)/.test(u)) u += (u.indexOf('?') > 0 ? '&' : '?') + 'uid=' + uid; return of.call(this, u, o); }; try { Object.defineProperty(window, 'mpAuth', { value: { me: () => ({ id: uid, username: uid }), ready: () => Promise.resolve(), on: () => {} }, writable: false, configurable: false }); } catch (e) {} }, UID);
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 100)));
    await page.goto('https://marginpad.io/spot/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => document.getElementById('stnWal').click()); await new Promise(r => setTimeout(r, 2000));
    await page.type('#memeQ', BONK); await new Promise(r => setTimeout(r, 3000));
    const card = await page.evaluate(() => { const row = document.getElementById('tokRow'); if (!row) return { card: false, txt: (document.getElementById('tokCard') || {}).textContent }; row.scrollIntoView({ block: 'center' }); const b = row.getBoundingClientRect(); const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { card: true, reachable: !!hit && (hit === row || row.contains(hit)), sym: (row.querySelector('b') || {}).textContent }; });
    chk('browser: pasted address shows a tradeable card', card.card && card.reachable, card);
    await page.evaluate(() => document.getElementById('tokRow').click()); await new Promise(r => setTimeout(r, 2500));
    const modal = await page.evaluate(() => ({ open: document.getElementById('tmask').classList.contains('on'), sym: (document.getElementById('tmSym') || {}).textContent, pay: (document.getElementById('tmPay') || {}).textContent }));
    chk('browser: trade modal opens for the contract token, pays in SOL', modal.open && /BONK/i.test(modal.sym || '') && /SOL/.test(modal.pay || ''), modal);
    await page.evaluate(() => { document.getElementById('memeQ').value = 'hello'; document.getElementById('memeQ').dispatchEvent(new Event('input')); }); await new Promise(r => setTimeout(r, 300));
    chk('browser: non-address input clears the card', await page.evaluate(() => !document.getElementById('tokRow')));
    chk('browser: zero page errors', errs.length === 0, errs);
    await ctx.close();
  });
  console.log(out.join('\n')); console.log('UID', UID, 'pass', out.filter(x => x[0] === 'P').length, 'fail', out.filter(x => x[0] === 'F').length);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });

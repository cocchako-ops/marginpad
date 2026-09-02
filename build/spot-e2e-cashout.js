// Demo Spot E2E (2026-09-03): full cash-out circle on a fresh account, API + browser (desktop + mobile). Run after every /spot deploy: node build/spot-e2e-cashout.js
// Block B proof. 1) API: full circle card -> USDT -> wallet -> SOL -> meme -> sell+convert -> swap rest -> to exchange -> card on a fresh test uid.
// 2) Browser: the same buttons exist, are reachable and the modals behave (fetch shim signs requests with the admin key + test uid).
const fs = require('fs');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const UID = 'spote2e' + Date.now().toString(36).slice(-5);
const B = 'https://marginpad.io/api/spot';
async function api(p, body) { const r = await fetch(B + p + (p.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); }
const out = [];
function chk(name, ok, extra) { out.push((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + JSON.stringify(extra).slice(0, 160) : '')); }
(async () => {
  await api('/start', {}); // accounts are minted only on request (2026-09-03)
  let p = await api('/portfolio'); chk('fresh card $10k', p.cardUsd === 10000 && p.usdtUsd === 0, { card: p.cardUsd });
  chk('link', (await api('/link', {})).ok);
  let r = await api('/onramp', { usd: 1000 }); chk('onramp 1000 (fee 18)', r.ok && r.usdtUsd === 1000 && r.cardUsd === 8982, r);
  r = await api('/wallet/create', {}); chk('wallet', r.ok && r.addr && r.addr.sol, { sol: r.addr && r.addr.sol.slice(0, 6) });
  const sol = r.addr.sol;
  r = await api('/withdraw', { usd: 500, net: 'solana', address: sol }); chk('withdraw 500 sol', r.ok && r.wusdtUsd === 500, r);
  r = await api('/swap', { asset: 'SOL', usd: 100, dir: 'buy' }); chk('swap buy SOL 100', r.ok && r.gas && r.gas.SOL > 0, { SOL: r.gas && r.gas.SOL });
  const memes = (await (await fetch(B + '/memes')).json()).memes.filter(m => m.net === 'solana' && m.liqUsd > 20000);
  const m = memes[0];
  r = await api('/trade', { side: 'buy', kind: 'meme', mint: m.mint, pool: m.pool, net: 'solana', symbol: m.sym, usd: 20 }); chk('buy meme $20 in SOL', r.ok && r.native === 'SOL', { sym: m.sym, qty: r.qty });
  const holdKey = 'sol:' + m.mint;
  r = await api('/trade', { side: 'sell', kind: 'meme', mint: m.mint, pool: m.pool, net: 'solana', holdSym: holdKey, pct: 100, toUsdt: true }); chk('sell meme 100% + convert to USDT', r.ok && r.swapped && r.swapped.usdUsd > 5, { swapped: r.swapped });
  p = await api('/portfolio'); const solLeft = p.gas.SOL; chk('portfolio after sell: wallet USDT grew', p.wusdtUsd > 400, { wusdt: p.wusdtUsd, SOL: solLeft });
  r = await api('/swap', { asset: 'SOL', natQty: Math.max(0, solLeft - 0.01), dir: 'sell' }); chk('swap sell SOL -> USDT (keep gas)', r.ok && r.gas.SOL > 0.005, { SOL: r.gas && r.gas.SOL, wusdt: r.wusdtUsd });
  p = await api('/portfolio');
  r = await api('/toexchange', { usd: 300 }); chk('to exchange 300 (auto net solana)', r.ok && r.net === 'solana' && r.deposited === true, { net: r.net, height: r.height });
  r = await api('/toexchange', { usd: 300, net: 'bsc' }); chk('to exchange on bsc without BNB -> no_gas', r.error === 'no_gas', r);
  p = await api('/portfolio'); chk('exchange USDT >= 799 (499 left + 300 deposited)', p.usdtUsd >= 799, { usdt: p.usdtUsd });
  r = await api('/offramp', { usd: 300 }); chk('cash out 300 -> card +297', r.ok && r.receivedUsd === 297, r);
  const dep = await api('/depaddr'); chk('depaddr has EVM + Solana', /^0x/.test(dep.dep) && /^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(dep.depSol || ''), { depSol: (dep.depSol || '').slice(0, 6) });
  const hist = await api('/history'); chk('history has recv(exchange) + send', hist.tx.some(t => t.side === 'recv') && hist.tx.some(t => t.side === 'send'));
  // ---- browser ----
  await withBrowser(async (browser) => {
    for (const [name, mobile] of [['desktop', false], ['mobile', true]]) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      if (mobile) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); else await page.setViewport({ width: 1366, height: 900 });
      await page.setExtraHTTPHeaders({ 'x-admin-key': K });
      await page.evaluateOnNewDocument((uid) => {
        const of = window.fetch; window.fetch = function (u, o) { if (typeof u === 'string' && u.indexOf('/api/spot/') === 0 && u.indexOf('/memes') < 0 && u.indexOf('/memechart') < 0 && u.indexOf('/chain') < 0) u += (u.indexOf('?') > 0 ? '&' : '?') + 'uid=' + uid; return of.call(this, u, o); };
        try { Object.defineProperty(window, 'mpAuth', { value: { me: () => ({ id: uid, username: uid }), ready: () => Promise.resolve(), on: () => {} }, writable: false, configurable: false }); } catch (e) {}
      }, UID);
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto('https://marginpad.io/spot/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
      await new Promise(r => setTimeout(r, 3000));
      const app = await page.evaluate(() => ({ app: !document.getElementById('app').hidden, gate: !document.getElementById('gate').hidden }));
      chk(name + ' app shown for shimmed user', app.app && !app.gate, app);
      if (!app.app) { await ctx.close(); continue; }
      await page.evaluate(() => { document.getElementById('stnWal').click(); }); await new Promise(r => setTimeout(r, 1200));
      const reach = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return { found: false }; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { found: true, reachable: !!h && (h === el || el.contains(h)), text: (el.textContent || '').trim().slice(0, 30) }; }, sel);
      chk(name + ' wallet Exchange button reachable', (await reach('#wlDep')).reachable, await reach('#wlDep'));
      await page.click('#wlDep'); await new Promise(r => setTimeout(r, 600));
      chk(name + ' chooser shows both directions', !!(await page.$('#ecFrom')) && !!(await page.$('#ecTo')));
      await page.click('#ecTo'); await new Promise(r => setTimeout(r, 900));
      const te = await page.evaluate(() => ({ modal: !!document.getElementById('teGo'), picked: (document.querySelector('#teNets .np.on') || {}).getAttribute ? document.querySelector('#teNets .np.on').getAttribute('data-n') : null, btn: (document.getElementById('teGo') || {}).textContent }));
      chk(name + ' to-exchange modal picks Solana (gas held)', te.modal && te.picked === 'solana', te);
      await page.type('#teAmt', '25'); await page.click('#teGo'); await new Promise(r => setTimeout(r, 2500));
      const teMsg = await page.evaluate(() => (document.getElementById('teMsg') || {}).textContent || '');
      chk(name + ' sent 25 to exchange', /on your exchange balance/.test(teMsg), { msg: teMsg.slice(0, 80) });
      await page.evaluate(() => { const x = document.querySelector('#smod .m-x'); if (x) x.click(); }); await new Promise(r => setTimeout(r, 600));
      await page.click('#wlSwp'); await new Promise(r => setTimeout(r, 700));
      const sw = await page.evaluate(() => ({ dirs: document.querySelectorAll('#swDir .np').length, title: (document.getElementById('swTitle') || {}).textContent }));
      chk(name + ' swap modal has both directions', sw.dirs === 2, sw);
      await page.evaluate(() => { document.querySelector('#swDir .np[data-d="sell"]').click(); }); await new Promise(r => setTimeout(r, 400));
      const swSell = await page.evaluate(() => ({ title: (document.getElementById('swTitle') || {}).textContent, lbl: (document.getElementById('swAmtL') || {}).textContent }));
      chk(name + ' swap sell mode', /back to USDT/.test(swSell.title || ''), swSell);
      await page.evaluate(() => { const x = document.querySelector('#smod .m-x'); if (x) x.click(); }); await new Promise(r => setTimeout(r, 500));
      await page.evaluate(() => { document.querySelector('.appsw button[data-view="bank"]') ? document.querySelector('.appsw button[data-view="bank"]').click() : document.getElementById('stnCard').click(); }); await new Promise(r => setTimeout(r, 1200));
      const guide = await page.evaluate(() => ({ rows: document.querySelectorAll('#bkCashGuide .cop-row').length, first: (document.querySelector('#bkCashGuide .cop-row b') || {}).textContent }));
      chk(name + ' bank shows cash-out guide (money outside bank)', guide.rows >= 1, guide);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      chk(name + ' no horizontal overflow', ov);
      await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/claude/D--part1-money-mission/ce085515-827e-410d-ad3c-a93aaa89df8c/scratchpad/spotB-' + name + '.png' });
      chk(name + ' zero page errors', errs.length === 0, errs.slice(0, 2));
      await ctx.close();
    }
  });
  console.log(out.join('\n')); console.log('UID', UID, 'pass', out.filter(x => x.startsWith('PASS')).length, 'fail', out.filter(x => x.startsWith('FAIL')).length);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });

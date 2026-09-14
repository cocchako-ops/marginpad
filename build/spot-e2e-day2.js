// Demo Spot E2E (2026-09-07): the day-2 hook, the rugged badge, "use my address", the done-state on Buy, the lighter hub.
// Run after every /spot deploy: node build/spot-e2e-day2.js
//   A. API: /api/spot/daily round-trips the opt-in (tg cannot be switched on without a linked chat); the cron's watch list
//      carries the account; the daily text is built from two marks and stays silent on a flat day; the admin preview computes
//      the exact line for one uid; a hold exposes liqUsd so the page can name a rug.
//   B. Browser (390 + 1366): the day-2 card is reachable after the first buy and its buttons are real; the withdraw modal's
//      "Use my address" fills the field for the chosen network and re-fills on a network change; Buy shows "Done" and clears
//      the amount so the same tap cannot buy twice; the hub folds the trail; no console errors; no horizontal overflow.
const fs = require('fs'); const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'e2espd' + Date.now().toString(36).slice(-5); const B = ORIGIN + '/api/spot';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 170) : ''));
async function api(p, body, method) { const r = await fetch(B + p + (p.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID, { method: method || (body ? 'POST' : 'GET'), headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); }
const admin = async (p) => (await fetch(ORIGIN + p, { headers: { 'x-admin-key': K } })).json();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const e2euser = async (op) => (await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: JSON.stringify({ uid: UID, op }) })).json();
(async () => {
  // A. API - a REAL member row (the cron's watch list joins users; a SpotStore-only throwaway would never be walked)
  const mk = await e2euser('mk'); chk('A throwaway member minted', mk && mk.ok, mk);
  await api('/start', {}); await api('/link', {}); await api('/onramp', { usd: 400 });
  let r = await api('/wallet/create', {}); const addr = r.addr; chk('A wallet created', addr && addr.sol && addr.evm);
  r = await api('/daily'); chk('A daily pref starts off, tg not linked', r && r.cfg && !r.cfg.push && !r.cfg.tg && r.tgLinked === false, r);
  r = await api('/daily', { push: true, tg: true }); chk('A opt-in: push on, tg refused without a linked chat', r.ok && r.cfg.push === true && r.cfg.tg === false, r);
  r = await api('/daily'); chk('A pref persisted', r.cfg.push === true, r.cfg);
  const pv = await admin('/api/admin/spotdaily'); chk('A the cron watch list carries the account (dry run)', pv && typeof pv.watched === 'number' && pv.watched >= 1, { watched: pv.watched, sent: pv.sent });
  const t1 = await admin('/api/admin/spotdaily?prev=10000&cur=10212.4'); chk('A daily text: +$212.40 (+2.12%) from two marks', t1.text && /\+\$212\.40 \(\+2\.12%\)/.test(t1.text.title) && /green day/i.test(t1.text.body), t1.text);
  const t2 = await admin('/api/admin/spotdaily?prev=10000&cur=10000'); chk('A a flat day sends nothing', t2.text === null, t2.text);
  const t3 = await admin('/api/admin/spotdaily?prev=10000&cur=9500'); chk('A a red day says so', t3.text && /-\$500\.00 \(-5\.00%\)/.test(t3.text.title) && /red day/i.test(t3.text.body), t3.text && t3.text.title);
  r = await api('/daily', { push: false, tg: false }); chk('A opt-out', r.ok && !r.cfg.push, r.cfg);
  // a meme bag so the page has something to badge and the browser has a Buy to double-tap
  await api('/withdraw', { usd: 150, net: 'solana', address: addr.sol }); await api('/swap', { asset: 'SOL', usd: 60, dir: 'buy' });
  const memes = ((await (await fetch(B + '/memes')).json()).memes || []).filter(m => m.net === 'solana' && m.liqUsd > 20000);
  const m1 = memes[0]; r = await api('/trade', { side: 'buy', kind: 'meme', mint: m1.mint, pool: m1.pool, net: 'solana', symbol: m1.sym, usd: 8 }); chk('A meme bought', r.ok, { sym: m1.sym });
  const p = await api('/portfolio'); const h = (p.holds || []).find(x => x.sym === 'sol:' + m1.mint);
  chk('A the hold carries liqUsd and is not rugged (a $20k+ pool)', h && h.liqUsd > 1000 && h.rugged === false, h && { liq: h.liqUsd, rugged: h.rugged });

  // B. browser
  await withBrowser(async (browser) => {
    for (const vp of [{ width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 1366, height: 800 }]) {
      const W = vp.width; const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport(vp);
      await page.setExtraHTTPHeaders({ 'x-admin-key': K });
      await page.evaluateOnNewDocument((uid) => { const of = window.fetch; window.fetch = function (u, o) { if (typeof u === 'string' && u.indexOf('/api/spot/') === 0 && !/\/(memes|memechart|chain|board)/.test(u)) u += (u.indexOf('?') > 0 ? '&' : '?') + 'uid=' + uid; return of.call(this, u, o); }; try { Object.defineProperty(window, 'mpAuth', { value: { me: () => ({ id: uid, username: uid }), ready: () => Promise.resolve(), on: () => {} }, writable: false, configurable: false }); } catch (e) {} try { localStorage.setItem('mp_cookie_ok', '1'); localStorage.removeItem('mp_spot_d2:' + uid); } catch (e) {} }, UID);
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto(ORIGIN + '/spot/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(4500);
      const reach = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return { none: true }; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { ok: !!hit && (hit === el || el.contains(hit)), w: r.width, txt: (el.textContent || '').trim().slice(0, 60) }; }, sel);
      const d2 = await reach('#d2Card'); chk(W + ' day-2 card shown after the first buy and reachable', d2.ok && /tomorrow/i.test(d2.txt), d2);
      const d2b = await page.evaluate(() => Array.from(document.querySelectorAll('#d2Card .d2-opt')).map(b => ({ t: b.textContent.trim(), a: b.tagName, dis: !!b.disabled })));
      chk(W + ' day-2 card offers push + a Telegram connect link (not linked)', d2b.length === 2 && d2b[1].a === 'A' && /Telegram/.test(d2b[1].t), d2b);
      const foot = await page.evaluate(() => { const f = document.querySelector('.mm-foot'); const s = document.querySelector('.scomp'); return { foot: !!f, box: !!s, border: f ? getComputedStyle(f).borderStyle : '' }; });
      chk(W + ' no-prize note is a quiet line, not a dashed box', foot.foot && !foot.box && /none/.test(foot.border), foot);
      const boardPanel = await page.evaluate(() => { const b = document.getElementById('spotBoard'); return { inPanel: !!(b && b.closest('.panel')), notInEquity: !(b && b.closest('.spark')) }; });
      chk(W + ' board has its own panel', boardPanel.inPanel && boardPanel.notInEquity, boardPanel);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); chk(W + ' hub: no horizontal overflow', !ov);
      // withdraw modal: use my address
      await page.evaluate(() => { const b = document.querySelector('.appsw button[data-view="ex"]'); if (b) b.click(); else document.getElementById('stnEx').click(); }); await sleep(1200);
      await page.evaluate(() => document.getElementById('exWd').click()); await sleep(500);
      await page.evaluate(() => document.getElementById('wcCrypto').click()); await sleep(600);
      const wm = await reach('#wdPaste'); chk(W + ' withdraw modal: "Use my address" button reachable', wm.ok && /Solana/.test(wm.txt), wm);
      await page.evaluate(() => document.getElementById('wdPaste').click()); await sleep(200);
      const filled = await page.evaluate((sol) => ({ v: document.getElementById('wdAddr').value, on: document.getElementById('wdPaste').classList.contains('on'), lbl: document.getElementById('wdMineL').textContent }), addr.sol);
      chk(W + ' one tap fills the Solana address', filled.v === addr.sol && filled.on && /filled/.test(filled.lbl), { on: filled.on, lbl: filled.lbl });
      await page.evaluate(() => document.querySelector('#wdNets .np[data-n="bsc"]').click()); await sleep(200);
      const re = await page.evaluate(() => ({ v: document.getElementById('wdAddr').value, lbl: document.getElementById('wdMineL').textContent }));
      chk(W + ' switching to BNB Chain re-fills the EVM address', re.v === addr.evm && /BNB Chain/.test(re.lbl), re);
      await page.evaluate(() => { const x = document.querySelector('#smod .m-x'); if (x) x.click(); }); await sleep(300);
      // trade modal: buy once, the button says Done and the amount clears
      await page.evaluate(() => { document.querySelector('.ex-tab[data-extab="markets"]').click(); }); await sleep(800);
      await page.evaluate(() => { const r = document.querySelector('#mktList .crow[data-mkt="btc"], #mktList .crow[data-mkt="BTC"]') || document.querySelector('#mktList .crow'); r.click(); }); await sleep(1800);
      await page.evaluate(() => { document.getElementById('tmUsd').value = '5'; document.getElementById('tmUsd').dispatchEvent(new Event('input')); }); await page.evaluate(() => document.getElementById('tmGo').click()); await sleep(300);
      const mid = await page.evaluate(() => ({ dis: document.getElementById('tmGo').disabled }));
      let done = null; for (let i = 0; i < 40; i++) { await sleep(250); done = await page.evaluate(() => ({ txt: document.getElementById('tmGo').textContent, amt: document.getElementById('tmUsd').value, msg: (document.getElementById('tmMsg').textContent || '').slice(0, 60), cls: document.getElementById('tmGo').className })); if (/Bought|failed|error/i.test(done.msg)) break; } // a market fill can take a few seconds when the price source is slow
      chk(W + ' Buy: disabled while filling, then Done with the amount cleared', mid.dis && /Done/.test(done.txt) && /Bought/.test(done.msg) && done.amt === '', { mid, done });
      await sleep(1700);
      const back = await page.evaluate(() => ({ txt: document.getElementById('tmGo').textContent, dis: document.getElementById('tmGo').disabled }));
      chk(W + ' Buy label returns after the done moment', /Buy/.test(back.txt) && !back.dis, back);
      await page.evaluate(() => document.getElementById('tmX').click()); await sleep(300);
      // wallet: collapsible degen note, rug line absent for a healthy bag
      await page.evaluate(() => { const b = document.querySelector('.appsw button[data-view="wal"]'); b.click(); }); await sleep(1500);
      const wal = await page.evaluate(() => ({ details: !!document.querySelector('#v-wal details.why'), open: !!document.querySelector('#v-wal details.why[open]'), rug: document.querySelectorAll('#wlBags .rugline').length, rows: document.querySelectorAll('#memeList .crow').length, h: document.documentElement.scrollHeight, ov: document.documentElement.scrollWidth > window.innerWidth }));
      chk(W + ' wallet: degen note folded, healthy bag has no rug line, trending list paged (' + wal.rows + ' rows)', wal.details && !wal.open && wal.rug === 0 && wal.rows <= (W < 880 ? 12 : 24) && !wal.ov, wal);
      chk(W + ' zero page errors', errs.length === 0, errs);
      await ctx.close();
    }
  });
  const rm = await e2euser('rm'); chk('cleanup: member removed', rm && rm.ok, rm);
  console.log(out.join('\n'));
  const fails = out.filter(l => l.startsWith('FAIL')).length;
  console.log('\n' + (out.length - fails) + '/' + out.length + ' PASS' + (fails ? ' - ' + fails + ' FAIL' : '') + ' · uid ' + UID);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });

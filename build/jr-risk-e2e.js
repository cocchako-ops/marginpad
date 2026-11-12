/* THE RISK TAB IN MY TRADES (2026-11-12, owner-approved feature #3): a fourth tab in the drawer that reads the OPEN positions -
   margin in use, exposure, the nearest liquidation, what a 3% move against every net side costs, a correlation flag when 60%+
   of the margin is one side of crypto across two or more coins, one row per coin. Computed on the client, so the fixture is a
   guest journal seeded at the LIVE prices (read from /api/prices before the page opens) at low leverage, so nothing can be
   liquidated under the test. Both surfaces: the app shell (home.js) and a page whose drawer is mp-trade.js (/rekt/).
   Run: node build/jr-risk-e2e.js [--local] */
const fs = require('fs'), path = require('path'), https = require('https');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io', LOCAL = process.argv.includes('--local'), ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); if (p === '/rekt/') return path.join(ROOT, 'dist', 'rekt', 'index.html'); return null; }
const getJ = (u) => new Promise((res, rej) => https.get(u, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));
function row(sym, side, lev, margin, px, i) { const qty = margin * lev / px, long = side === 'long', mmr = 0.005, im = 1 / lev, me = Math.min(mmr, im / 2); const liq = long ? px * (1 - im + me) : px * (1 + im - me); return { id: String(Date.now() - i * 1000) + '_' + (1000 + i), ts: Date.now() - i * 60000, sym, side, entry: px, stop: null, tp: null, lev, rr: null, qty, notional: margin * lev, margin, riskAmt: margin, liq, mmr, feeRate: 0.00055, status: 'open', pnl: null }; }
async function mk(browser, url, w, journal) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (LOCAL) { const f = localFile(u); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } } r.continue(); });
  await p.evaluateOnNewDocument((j) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} }, journal);
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  await p.goto(ORIGIN + url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => !!window.mpOpenTrades, { timeout: 40000 });
  return { ctx, p, errs };
}
const readRisk = () => { const r = document.querySelector('#jrList .jr-risk'); if (!r) return null; const tiles = [...r.querySelectorAll('.jr-rk-t')].map(t => ({ v: t.querySelector('.v').textContent.trim(), l: t.querySelector('.l').textContent.trim() })); const rows = [...r.querySelectorAll('.jr-rk-row')].map(x => ({ sym: x.getAttribute('data-sym'), side: (x.querySelector('.c i') || {}).textContent, net: x.querySelector('.n b').textContent, m: x.querySelector('.m').textContent, k: x.querySelector('.k').textContent, q: x.querySelector('.q').textContent, hot: x.querySelector('.q').classList.contains('hot') })); const notes = [...r.querySelectorAll('.jr-rk-note')].map(n => ({ t: n.textContent.trim(), cls: n.className })); return { n: +r.getAttribute('data-n'), tiles, rows, notes, empty: !!r.querySelector('.pp-empty'), txt: r.textContent }; };
const openRisk = async (p) => { await p.evaluate(() => window.mpOpenTrades()); await p.waitForFunction(() => !!document.querySelector('#jrList [data-jt="risk"]'), { timeout: 15000 }); await p.evaluate(() => document.querySelector('#jrList [data-jt="risk"]').click()); await p.waitForFunction(() => !!document.querySelector('#jrList .jr-risk'), { timeout: 10000 }); return p.evaluate(readRisk); };
const num = s => +String(s).replace(/[^0-9.\-]/g, '');
(async () => {
  const px = await getJ(ORIGIN + '/api/prices'); const P = (s) => { const v = (px && px.pairs || []).find(x => x.symbol === s + 'USDT'); return +(v && v.price) || 0; }; // /api/prices = {pairs:[{symbol:'BTCUSDT',price:'...'}]}
  const btc = P('BTC'), eth = P('ETH'), sol = P('SOL');
  chk('live prices read for the fixture', btc > 1000 && eth > 10 && sol > 1, { btc, eth, sol });
  // scenario A: three opens, 86% of the margin long crypto -> the correlation flag; SOL short at 10x is the nearest liq
  const A = [row('BTC', 'long', 3, 100, btc, 1), row('ETH', 'long', 3, 200, eth, 2), row('SOL', 'short', 10, 50, sol, 3)];
  await withBrowser(async (browser) => {
    { const { ctx, p, errs } = await mk(browser, '/paper-trade', 1366, A);
      const tabs = await p.evaluate(() => { window.mpOpenTrades(); const t = [...document.querySelectorAll('#jrList .jr-tabs button')]; return t.map(b => ({ jt: b.getAttribute('data-jt'), t: b.textContent.trim() })); });
      chk('the drawer carries a fourth tab, Risk', tabs.length === 4 && tabs[3].jt === 'risk' && /Risk/.test(tabs[3].t), tabs);
      const r = await openRisk(p);
      chk('the tab draws the reading for the 3 open positions', !!r && r.n === 3 && !r.empty, r && { n: r.n, empty: r.empty });
      const margin = num(r.tiles[0].v), notional = num(r.tiles[1].v), cost = num(r.tiles[3].v);
      chk('margin in use = 100 + 200 + 50', Math.abs(margin - 350) < 0.5, r.tiles[0]);
      chk('open exposure ~ 300 + 600 + 500 (sized at the live price, within 2%)', Math.abs(notional - 1400) / 1400 < 0.02, r.tiles[1]);
      chk('a 3% move against every net side = 3% of 1,400 (within 2%)', Math.abs(Math.abs(cost) - 42) / 42 < 0.02, r.tiles[3]);
      chk('the nearest liquidation is the 10x SOL short, about 9.5% away', /SOL short 10x/.test(r.tiles[2].v) && /(8|9|10)\.\d+% away/.test(r.tiles[2].v), r.tiles[2]);
      const corr = r.notes.find(n => /corr/.test(n.cls));
      chk('86% of the margin long crypto across 3 coins raises the correlation flag', !!corr && /86%/.test(corr.t) && /long/.test(corr.t) && /3 coins/.test(corr.t), corr);
      chk('no "inside 3%" warning - nothing is near its level', !r.notes.some(n => /warn/.test(n.cls)), r.notes);
      chk('one row per coin, biggest exposure first (ETH 600, SOL 500, BTC 300)', r.rows.map(x => x.sym).join(',') === 'ETH,SOL,BTC', r.rows.map(x => x.sym));
      const solRow = r.rows.find(x => x.sym === 'SOL');
      chk('the SOL row says short, $500 net, $15 at 3%, and its liq distance', !!solRow && /short/.test(solRow.side) && Math.abs(num(solRow.net) - 500) / 500 < 0.02 && Math.abs(Math.abs(num(solRow.k)) - 15) < 0.5 && /\d%/.test(solRow.q), solRow);
      // the filter bar belongs to the list tabs and is not drawn here
      const fb = await p.evaluate(() => !!document.querySelector('#jrList .jr-fb'));
      chk('the filter bar is not drawn on the Risk tab', !fb);
      // reachability: the tab and the first row are what sits under the pointer; nothing wider than the drawer
      const geo = await p.evaluate(() => { const d = document.getElementById('jrDrawer'); const dr = d.getBoundingClientRect(); const tab = document.querySelector('#jrList [data-jt="risk"]'); const tr = tab.getBoundingClientRect(); const e = document.elementFromPoint(tr.x + tr.width / 2, tr.y + tr.height / 2); const wide = [...d.querySelectorAll('.jr-risk *')].filter(x => x.getBoundingClientRect().right > dr.right + 1).length; return { tabUnder: e === tab, wide, tabsH: Math.round(document.querySelector('#jrList .jr-tabs').getBoundingClientRect().height) }; });
      chk('the Risk tab is reachable and nothing in the reading runs past the drawer', geo.tabUnder && geo.wide === 0 && geo.tabsH < 44, geo);
      // the reading follows the live price: a repaint from renderLive must keep the block (not a flash to empty)
      await sleep(2300);
      const again = await p.evaluate(readRisk);
      chk('after two live ticks the reading is still there with the same rows', !!again && again.n === 3 && again.rows.length === 3, again && again.rows.length);
      // back to Open - the list tabs are untouched
      const openN = await p.evaluate(() => { document.querySelector('#jrList [data-jt="open"]').click(); return document.querySelectorAll('#jrList .pp').length; });
      chk('switching back to Open lists the three cards again', openN === 3, openN);
      chk('no page errors', errs.length === 0, errs);
      await ctx.close(); }
    { // scenario B: balanced book (BTC long $100 / ETH short $100) -> no flag, a plain split sentence
      const B = [row('BTC', 'long', 2, 100, btc, 1), row('ETH', 'short', 2, 100, eth, 2)];
      const { ctx, p } = await mk(browser, '/paper-trade', 1366, B);
      const r = await openRisk(p);
      chk('a 50/50 book raises no correlation flag and states the split', !!r && !r.notes.some(n => /corr/.test(n.cls)) && r.notes.some(n => /Longs 50% \/ shorts 50%/.test(n.t)), r && r.notes);
      await ctx.close(); }
    { // scenario C: empty journal -> the empty state, no tiles
      const { ctx, p } = await mk(browser, '/paper-trade', 1366, []);
      const r = await openRisk(p);
      chk('with nothing open the tab says so and draws no tiles', !!r && r.empty && r.tiles.length === 0 && /nothing at risk/i.test(r.txt), r && { empty: r.empty, tiles: r.tiles.length });
      await ctx.close(); }
    { // the OTHER copy: mp-trade.js on /rekt/, at phone width
      const { ctx, p, errs } = await mk(browser, '/rekt/', 390, A);
      const r = await openRisk(p);
      chk('mp-trade.js draws the same reading on /rekt/ (3 positions, 3 rows, the flag)', !!r && r.n === 3 && r.rows.length === 3 && r.notes.some(n => /corr/.test(n.cls)), r && { n: r.n, rows: r.rows.length });
      const geo = await p.evaluate(() => { const d = document.getElementById('jrDrawer'); const dr = d.getBoundingClientRect(); const wide = [...d.querySelectorAll('.jr-risk *')].filter(x => x.getBoundingClientRect().right > Math.min(dr.right, innerWidth) + 1).length; const tabs = document.querySelector('#jrList .jr-tabs').getBoundingClientRect(); const hid = getComputedStyle(document.querySelector('.jr-rk-row .m')).display; return { wide, tabsH: Math.round(tabs.height), marginColHidden: hid === 'none', scrollW: document.documentElement.scrollWidth, iw: innerWidth }; });
      chk('on a 390 phone the four tabs stay one row, the margin column folds away, nothing runs off the screen', geo.tabsH < 44 && geo.marginColHidden && geo.wide === 0 && geo.scrollW <= geo.iw, geo);
      chk('no page errors on /rekt/', errs.length === 0, errs);
      await ctx.close(); }
  }, { timeoutMs: 420000 });
  console.log('\njr-risk-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

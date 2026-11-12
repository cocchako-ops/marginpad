/* THE TRADE AUTOPSY (2026-11-12, owner-approved feature #1).
   --pure   : autopsyStats + autopsyTradeFromQuery lifted out of the SHIPPED worker and driven with constructed candles - best/worst
              point, the move taken and what was given back, the ATR ladder and where each stop would have held, a short mirrored,
              a window inside one candle, a query that cannot be a trade.
   (default): the pure checks, then a browser: a guest's closed row in the journal, the Why button on its ticket, the sheet built from
              a CANNED route answer (so the drawing, tiles, ladder, liquidations and catalysts are asserted whatever the market does),
              reachability of the X, Escape and the backdrop, the request carrying the id AND the device copy, a 390 phone, and the
              other bundle (mp-trade.js on /rekt/).
   --prod   : adds the live route for a guest (device source) on a real BTC window - run only once the worker is deployed.
   Run: node build/autopsy-e2e.js [--pure] [--local] [--prod] */
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = path.join(__dirname, '..'), ORIGIN = 'https://marginpad.io';
const PURE = process.argv.includes('--pure'), LOCAL = process.argv.includes('--local'), PROD = process.argv.includes('--prod');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
// ── pure ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const W = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
const lift = (from, to) => { const a = W.indexOf(from), b = W.indexOf(to, a); if (a < 0 || b < 0) throw new Error('cannot lift ' + from); return W.slice(a, b); };
const src = lift('function autopsyTradeFromQuery(url) {', '\nasync function tradeAutopsy(env, t) {');
const { autopsyStats, autopsyTradeFromQuery } = new Function(src + '\nreturn { autopsyStats, autopsyTradeFromQuery };')();
const M = 60000, T0 = 1794400000000;
function mkBars(spec) { return spec.map((s, i) => ({ t: T0 + i * M, o: s[0], h: s[1], l: s[2], c: s[3] })); } // [o,h,l,c] per minute
{ // a long: entry 100 at minute 14, exit 103 at minute 24; pre bars range 1 (ATR 1%); best 106 (+6%), worst 98.2 (-1.8%)
  const pre = Array.from({ length: 14 }, (_, i) => [100, 100.5, 99.5, 100]);
  const inw = [[100, 101, 99.4, 100.5], [100.5, 103, 100, 102.5], [102.5, 106, 102, 104], [104, 104.5, 98.2, 99], [99, 103.5, 98.9, 103]];
  const post = [[103, 104, 102, 103.5], [103.5, 105, 103, 104]];
  const bars = mkBars(pre.concat(inw, post));
  const t = { sym: 'BTC', long: true, entry: 100, exit: 103, lev: 10, margin: 100, ts: T0 + 14 * M, cts: T0 + 18 * M + 30000, stop: 97, pnl: 29.5 };
  const s = autopsyStats(t, bars, M);
  chk('pure: 5 candles inside the window, 14 before it', s.bars === 5 && s.preBars === 14, { bars: s.bars, pre: s.preBars });
  chk('pure: best point +6% = $60 on $1,000 of notional, at the candle that printed 106', Math.abs(s.mfePct - 6) < 1e-9 && Math.abs(s.mfeUsd - 60) < 1e-9 && s.mfeT === T0 + 16 * M, { mfePct: s.mfePct, mfeUsd: s.mfeUsd });
  chk('pure: worst point -1.8% at the candle that printed 98.2', Math.abs(s.maePct - 1.8) < 1e-9 && s.maeT === T0 + 17 * M, { maePct: s.maePct });
  chk('pure: took +3%, gave back half of the best', Math.abs(s.movePct - 3) < 1e-9 && Math.abs(s.giveBackShare - 0.5) < 1e-9, { movePct: s.movePct, gb: s.giveBackShare });
  chk('pure: ATR 1% from the 14 pre-trade candles', Math.abs(s.atrPct - 1) < 1e-9, s.atrPct);
  chk('pure: 1 ATR (99) hit, 1.5 ATR (98.5) hit, 2 ATR (98) held - the tightest surviving stop is 2 ATR', s.ladder.length === 3 && s.ladder[0].held === false && s.ladder[1].held === false && s.ladder[2].held === true && s.firstHeldAtr === 2, s.ladder.map(l => [l.atr, l.px, l.held]));
  chk('pure: the trader stop at 97 (3 ATR) held and would have cost $30 if hit', s.yourStop && s.yourStop.held === true && Math.abs(s.yourStop.atr - 3) < 1e-9 && Math.abs(s.yourStop.lossUsd - 30) < 1e-9, s.yourStop);
  chk('pure: the ladder loss is notional x distance (1 ATR = $10)', Math.abs(s.ladder[0].lossUsd - 10) < 1e-9, s.ladder[0].lossUsd);
}
{ // the short, mirrored: entry 100, exit 97 (+3% for a short); best = the low 94, worst = the high 101.5
  const pre = Array.from({ length: 14 }, () => [100, 100.5, 99.5, 100]);
  const inw = [[100, 101.5, 99, 99.5], [99.5, 100, 94, 95], [95, 98, 94.5, 97]];
  const bars = mkBars(pre.concat(inw));
  const t = { sym: 'ETH', long: false, entry: 100, exit: 97, lev: 5, margin: 200, ts: T0 + 14 * M, cts: T0 + 16 * M + 1, stop: 101, pnl: 30 };
  const s = autopsyStats(t, bars, M);
  chk('pure: a short reads best as the LOW (+6%) and worst as the HIGH (-1.5%)', Math.abs(s.mfePct - 6) < 1e-9 && Math.abs(s.maePct - 1.5) < 1e-9, { mfe: s.mfePct, mae: s.maePct });
  chk('pure: a short stop at 101 was HIT (the first candle printed 101.5); 2 ATR (102) held', s.yourStop.held === false && s.ladder[2].held === true && s.ladder[0].held === false, { yours: s.yourStop.held, l: s.ladder.map(l => l.held) });
  chk('pure: the short took +3% ($30 on $1,000)', Math.abs(s.movePct - 3) < 1e-9 && Math.abs(s.moveUsd - 30) < 1e-9, s.movePct);
}
{ // a trade inside ONE candle still has that candle; no pre bars = no ladder, never a crash
  const bars = mkBars([[100, 101, 99, 100.5]]);
  const s = autopsyStats({ sym: 'X', long: true, entry: 100, exit: 100.5, lev: 1, margin: 10, ts: T0 + 20000, cts: T0 + 40000, stop: 0 }, bars, M);
  chk('pure: a 20-second trade inside one candle reads that candle (1 bar, +1% best, -1% worst, no ladder)', s.bars === 1 && Math.abs(s.mfePct - 1) < 1e-9 && Math.abs(s.maePct - 1) < 1e-9 && s.ladder.length === 0 && s.yourStop === null && s.firstHeldAtr === null, s);
  const e = autopsyStats({ sym: 'X', long: true, entry: 100, exit: 0, lev: 1, margin: 10, ts: T0, cts: T0 + M, stop: 0 }, [], M);
  chk('pure: no candles at all is an empty reading, not a throw', e.bars === 0 && e.mfePct === null && e.movePct === null, e);
}
{ // the query reader: a device copy of a row, and the shapes that cannot be a trade
  const q = (s) => autopsyTradeFromQuery(new URL('https://x/api/trade/autopsy?' + s));
  const a = q('sym=sol&side=short&entry=80&exit=78&lev=20&margin=50&ts=1794400000000&cts=1794403600000&stop=81&pnl=25&liq=0');
  chk('pure: the query becomes a trade - symbol upper-cased, short, stop and pnl carried', a && a.sym === 'SOL' && a.long === false && a.entry === 80 && a.exit === 78 && a.lev === 20 && a.margin === 50 && a.stop === 81 && a.pnl === 25 && a.liquidated === false, a);
  chk('pure: a close before the open is refused', q('sym=BTC&entry=100&ts=1794403600000&cts=1794400000000') === null);
  chk('pure: no entry is refused; a leverage over 2000 is clamped', q('sym=BTC&ts=1&cts=2') === null && q('sym=BTC&entry=1&ts=1794400000000&cts=1794400000001&lev=99999').lev === 2000);
}
if (PURE) { console.log('\nautopsy-e2e: ' + okN + ' passed, ' + failN + ' failed [pure]'); process.exit(failN ? 1 : 0); }
// ── browser ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const { withBrowser } = require('./e2e-browser');
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); if (p === '/rekt/') return path.join(ROOT, 'dist', 'rekt', 'index.html'); return null; }
const NOW = Date.now(), OPEN = NOW - 95 * M, CLOSE = NOW - 40 * M;
const ROW = { id: 'e2eautopsy1', ts: OPEN, closeTs: CLOSE, sym: 'BTC', side: 'long', entry: 70000, exit: 70700, stop: 69300, tp: null, lev: 10, qty: 0.0142857, notional: 1000, margin: 100, riskAmt: 100, liq: 63665, mmr: 0.005, feeRate: 0.00055, status: 'win', pnl: 9.1 };
const CANNED = (() => { const bars = []; for (let i = 0; i < 80; i++) { const t = OPEN - 20 * M + i * M, base = 70000 + Math.sin(i / 9) * 400 + (i > 20 && i < 75 ? (i - 20) * 12 : 0); bars.push([t, base, base + 120, base - 110, base + 30]); }
  return { ok: true, source: 'device', trade: { sym: 'BTC', side: 'long', entry: 70000, exit: 70700, lev: 10, margin: 100, pnl: 9.1, roe: 9.1, ts: OPEN, cts: CLOSE, stop: 69300, fee: 0.77, fund: 0.12, liquidated: false, cls: 'crypto' }, interval: '1', covered: true, bars,
    stats: { bars: 55, preBars: 14, mfePct: 1.42, mfeUsd: 14.2, mfeT: OPEN + 40 * M, maePct: 0.63, maeUsd: 6.3, maeT: OPEN + 5 * M, atrPct: 0.33, ladder: [{ atr: 1, px: 69769, pct: 0.33, held: false, lossUsd: 3.3 }, { atr: 1.5, px: 69653.5, pct: 0.495, held: true, lossUsd: 4.95 }, { atr: 2, px: 69538, pct: 0.66, held: true, lossUsd: 6.6 }], yourStop: { px: 69300, pct: 1, held: true, atr: 3.03, lossUsd: 10 }, movePct: 1, moveUsd: 10, giveBackPct: 0.42, giveBackShare: 0.296, firstHeldAtr: 1.5, notional: 1000, heldMs: CLOSE - OPEN },
    liq: { longUsd: 1234567, shortUsd: 234567, n: 41, biggest: { usd: 410000, side: 'long', ts: OPEN + 6 * M, exchange: 'bybit' }, complete: true },
    catalysts: { items: [{ ts: OPEN - 30 * M, title: 'Fed chair says rates stay put through the spring', url: 'https://example.com/fed', kind: 'macro', source: 'fed-press', score: 71, named: false }, { ts: OPEN + 12 * M, title: 'Exchange X lists BTC options for retail', url: '', kind: 'listing', source: 'ex', score: 44, named: true }], seen: 212 }, now: NOW }; })();
async function mk(browser, url, w, journal, canned) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
  await p.setRequestInterception(true); const reqs = [];
  p.on('request', r => { const u = r.url(); if (u.indexOf('/api/trade/autopsy') >= 0) { reqs.push(u); if (canned) return r.respond({ status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(canned) }); } if (LOCAL) { const f = localFile(u); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } } r.continue(); });
  await p.evaluateOnNewDocument((j) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} }, journal);
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  await p.goto(ORIGIN + url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => !!window.mpOpenTrades && !!window.__mpJrWhy, { timeout: 40000 });
  return { ctx, p, errs, reqs };
}
const openWhy = async (p) => { await p.evaluate(() => window.mpOpenTrades()); await p.waitForFunction(() => !!document.querySelector('#jrList [data-jt="closed"]'), { timeout: 15000 }); await p.evaluate(() => document.querySelector('#jrList [data-jt="closed"]').click()); await p.waitForFunction(() => !!document.querySelector('#jrList .pp [data-act="why"]'), { timeout: 10000 }); await p.evaluate(() => document.querySelector('#jrList .pp [data-act="why"]').click()); await p.waitForFunction(() => !!document.querySelector('#jrWhy .jrw-tiles'), { timeout: 15000 }); };
const readSheet = () => { const s = document.getElementById('jrWhy'); if (!s) return null; const r = s.getBoundingClientRect(); return { role: s.getAttribute('role'), tiles: [...s.querySelectorAll('.jrw-tl .v')].map(x => x.textContent.trim()), rows: [...s.querySelectorAll('.jrw-row')].map(x => ({ a: x.querySelector('.a').textContent.trim(), held: x.getAttribute('data-held'), mine: x.classList.contains('mine') })), liq: (s.querySelector('.jrw-liq') || {}).textContent, cx: [...s.querySelectorAll('.jrw-c')].map(a => ({ tag: a.tagName, rel: a.getAttribute('rel'), tgt: a.getAttribute('target'), t: a.querySelector('.h').textContent })), svg: !!s.querySelector('.jrw-svg path.px'), stopLine: !!s.querySelector('.jrw-svg line.st'), foot: (s.querySelector('.jrw-foot') || {}).textContent, note: [...s.querySelectorAll('.jrw-note')].map(n => n.textContent), inView: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, wide: [...s.querySelectorAll('*')].filter(x => x.getBoundingClientRect().right > r.right + 1).length, lesson: !!s.querySelector('.jrw-lesson') }; };
(async () => {
  await withBrowser(async (browser) => {
    { const { ctx, p, errs, reqs } = await mk(browser, '/paper-trade', 1366, [ROW], CANNED);
      await openWhy(p);
      const sh = await p.evaluate(readSheet);
      chk('the closed ticket carries a Why button and it opens a dialog', !!sh && sh.role === 'dialog', sh && sh.role);
      chk('the request names the trade id AND carries the device copy (sym, side, entry, exit, lev, margin, ts, cts, stop, pnl)', reqs.length === 1 && /id=e2eautopsy1/.test(reqs[0]) && /sym=BTC/.test(reqs[0]) && /side=long/.test(reqs[0]) && /entry=70000/.test(reqs[0]) && /exit=70700/.test(reqs[0]) && /lev=10/.test(reqs[0]) && /margin=100/.test(reqs[0]) && new RegExp('ts=' + OPEN).test(reqs[0]) && new RegExp('cts=' + CLOSE).test(reqs[0]) && /stop=69300/.test(reqs[0]) && /pnl=9.1/.test(reqs[0]), reqs[0]);
      chk('four tiles: best +1.42% ($14.20), worst -0.63%, took +1.00% ($9.10), held 55m with the costs', sh.tiles.length === 4 && /\+1\.42%/.test(sh.tiles[0]) && /\+\$14\.20/.test(sh.tiles[0]) && /-0\.63%/.test(sh.tiles[1]) && /\+1\.00%/.test(sh.tiles[2]) && /\+\$9\.10/.test(sh.tiles[2]) && /55m/.test(sh.tiles[3]), sh.tiles);
      const gave = await p.evaluate(() => document.querySelectorAll('#jrWhy .jrw-tl .l')[2].textContent);
      chk('the "took" tile says what was given back from the best (30%)', /gave back 30%/.test(gave), gave);
      chk('the stop ladder: your stop (held, marked as yours), then 1 ATR hit, 1.5 held, 2 held', sh.rows.length === 4 && sh.rows[0].mine && sh.rows[0].held === '1' && /Your stop/.test(sh.rows[0].a) && sh.rows[1].held === '0' && sh.rows[2].held === '1' && sh.rows[3].held === '1', sh.rows);
      chk('and names the tightest surviving stop', sh.note.some(n => /tightest/.test(n) && /1\.5 ATR/.test(n)), sh.note);
      chk('the chart is drawn with the stop line', sh.svg && sh.stopLine);
      chk('liquidations in the window: longs $1.23M, shorts $234,567.00, 41 prints, biggest named', /longs/.test(sh.liq) && /1\.23M/.test(sh.liq) && /234,567/.test(sh.liq) && /41 prints/.test(sh.liq) && /biggest \$410,000\.00 long @ bybit/.test(sh.liq), sh.liq);
      chk('two catalysts: the linked one opens in a new tab with noopener, the market-wide one is labelled, the unlinked one is not an anchor', sh.cx.length === 2 && sh.cx[0].tag === 'A' && sh.cx[0].rel === 'noopener noreferrer' && sh.cx[0].tgt === '_blank' && sh.cx[1].tag === 'DIV', sh.cx);
      const mw = await p.evaluate(() => document.querySelector('#jrWhy .jrw-c .k').textContent);
      chk('the macro item is marked market-wide', /market-wide/.test(mw), mw);
      chk('the foot says where the record came from and the interval; the lesson slot exists for feature 13', /record on this device/.test(sh.foot) && /1m candles/.test(sh.foot) && sh.lesson, sh.foot);
      chk('the sheet sits inside the viewport and nothing in it runs past its edge', sh.inView && sh.wide === 0, { inView: sh.inView, wide: sh.wide });
      // reachability: the X is under the pointer and closes; Escape closes; the backdrop closes
      const xr = await p.evaluate(() => { const x = document.querySelector('#jrWhy .jrw-x'); const r = x.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(e && (e === x || x.contains(e))); });
      chk('the close button is what sits under the pointer', xr);
      await p.evaluate(() => document.querySelector('#jrWhy .jrw-x').click()); await sleep(100);
      chk('X closes the sheet and takes the backdrop with it', await p.evaluate(() => !document.getElementById('jrWhy') && !document.getElementById('jrWhyBd')));
      await p.evaluate(() => document.querySelector('#jrList .pp [data-act="why"]').click()); await p.waitForFunction(() => !!document.querySelector('#jrWhy .jrw-tiles'), { timeout: 15000 });
      await p.keyboard.press('Escape'); await sleep(100);
      chk('Escape closes it', await p.evaluate(() => !document.getElementById('jrWhy')));
      await p.evaluate(() => document.querySelector('#jrList .pp [data-act="why"]').click()); await p.waitForFunction(() => !!document.querySelector('#jrWhy .jrw-tiles'), { timeout: 15000 });
      await p.mouse.click(8, 8); await sleep(100);
      chk('a tap on the backdrop closes it', await p.evaluate(() => !document.getElementById('jrWhy')));
      chk('no page errors', errs.length === 0, errs);
      await ctx.close(); }
    { // a refused answer is said, never a blank
      const { ctx, p } = await mk(browser, '/paper-trade', 1366, [ROW], { error: 'not_found' });
      await p.evaluate(() => window.mpOpenTrades()); await p.waitForFunction(() => !!document.querySelector('#jrList [data-jt="closed"]'), { timeout: 15000 }); await p.evaluate(() => document.querySelector('#jrList [data-jt="closed"]').click()); await p.waitForFunction(() => !!document.querySelector('#jrList .pp [data-act="why"]'), { timeout: 10000 }); await p.evaluate(() => document.querySelector('#jrList .pp [data-act="why"]').click());
      await p.waitForFunction(() => /Could not read/.test((document.querySelector('#jrWhy .jrw-b') || {}).textContent || ''), { timeout: 10000 }).then(() => chk('a refused read says so in the sheet, with the reason', true)).catch(async () => chk('a refused read says so in the sheet, with the reason', false, await p.evaluate(() => (document.querySelector('#jrWhy .jrw-b') || {}).textContent)));
      await ctx.close(); }
    { // the other bundle, on a phone
      const { ctx, p, errs } = await mk(browser, '/rekt/', 390, [ROW], CANNED);
      await openWhy(p);
      const sh = await p.evaluate(readSheet);
      chk('mp-trade.js on /rekt/ at 390 draws the same sheet as a bottom sheet inside the screen', !!sh && sh.tiles.length === 4 && sh.rows.length === 4 && sh.inView && sh.wide === 0, sh && { tiles: sh.tiles.length, inView: sh.inView, wide: sh.wide });
      const geo = await p.evaluate(() => { const s = document.getElementById('jrWhy'); const r = s.getBoundingClientRect(); return { bottom: Math.round(r.bottom), ih: innerHeight, scrollW: document.documentElement.scrollWidth, iw: innerWidth }; });
      chk('it is pinned to the bottom edge on the phone and the page does not scroll sideways', Math.abs(geo.bottom - geo.ih) <= 1 && geo.scrollW <= geo.iw, geo);
      chk('no page errors on /rekt/', errs.length === 0, errs);
      await ctx.close(); }
    if (PROD) { // the live route for a guest: a real BTC window from the last two hours
      const getJ = (u) => new Promise((res, rej) => https.get(u, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res({ st: r.statusCode, j: JSON.parse(b) }); } catch (e) { rej(e); } }); }).on('error', rej));
      const px = await getJ(ORIGIN + '/api/prices'); const btc = +(((px.j.pairs || []).find(x => x.symbol === 'BTCUSDT') || {}).price) || 0;
      const r = await getJ(ORIGIN + '/api/trade/autopsy?sym=BTC&side=long&entry=' + btc + '&exit=' + (btc * 1.001).toFixed(1) + '&lev=10&margin=100&ts=' + (NOW - 90 * M) + '&cts=' + (NOW - 30 * M) + '&stop=' + (btc * 0.98).toFixed(1));
      chk('prod: a guest device autopsy answers with 1m candles that cover the window, stats, liquidations and a catalyst read', r.st === 200 && r.j.ok && r.j.source === 'device' && r.j.interval === '1' && r.j.covered && r.j.bars.length > 50 && typeof r.j.stats.mfePct === 'number' && r.j.stats.ladder.length === 3 && r.j.liq && r.j.liq.n >= 0 && r.j.catalysts && Array.isArray(r.j.catalysts.items), { st: r.st, src: r.j.source, iv: r.j.interval, bars: r.j.bars && r.j.bars.length, mfe: r.j.stats && r.j.stats.mfePct, liq: r.j.liq && r.j.liq.n, cx: r.j.catalysts && r.j.catalysts.items.length });
      const bad = await getJ(ORIGIN + '/api/trade/autopsy?sym=BTC&entry=1&ts=5&cts=2');
      chk('prod: a trade that cannot be one is refused 400', bad.st === 400 && bad.j.error === 'bad_trade', bad);
      const none = await getJ(ORIGIN + '/api/trade/autopsy?id=nothing');
      chk('prod: a guest with no device copy and no row is asked to sign in (401)', none.st === 401, none.st);
    }
  }, { timeoutMs: 420000 });
  console.log('\nautopsy-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : '') + (PROD ? ' [+prod]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

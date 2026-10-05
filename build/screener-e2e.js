// /screener E2E (2026-10-05): the table is the product, and it has to be the first thing on the screen.
//
// Measured before this file existed: the screener was 119 full-width CARDS (16,786px desktop / 25,414px phone) and the first
// screen on BOTH viewports held zero coins - a Telegram banner, a Plus upsell, two tiles, five chips, three pick tiles and a
// search box stood in front of the data. The load-bearing checks here are REACHABILITY ones (CLAUDE.md): a coin row counts only
// when elementFromPoint at its centre returns it, in the DEFAULT page state, as a guest, with the cookie bar still up.
//
// Also proven: every column header sorts (and the preset chips stay in sync), "Show all" expands to every row, the coin sheet
// opens from a row and from a pick, its setup prints ONE leverage (it printed "56–56×" for months: lev and levAgg are the same
// number on every row the server sends), funding carries four decimals (two printed "+0.00%" on every coin), the phone table
// scrolls INSIDE its box with the score + coin columns pinned, and each interaction sends a `screener` beacon - the
// instrumentation the next decision is made from.
//
// Run: node build/screener-e2e.js            (production)
//      node build/screener-e2e.js --local    (serves dist/app.html, home.css and mp-screener.js from the working tree)
const fs = require('fs'), path = require('path');
const { withBrowser, UA_DESKTOP, UA_MOBILE } = require('./e2e-browser.js');
const LOCAL = process.argv.includes('--local');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist'), A = path.join(DIST, 'assets');
const BASE = 'https://marginpad.io';
let pass = 0, fail = 0; const out = [];
function ok(name, cond, note) { if (cond) { pass++; out.push('ok  ' + name + (note ? '  [' + note + ']' : '')); } else { fail++; out.push('X   ' + name + (note ? '  [' + note + ']' : '')); } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function prep(browser, mobile) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setUserAgent(mobile ? UA_MOBILE : UA_DESKTOP);
  if (mobile) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  else await page.setViewport({ width: 1400, height: 900 });
  const track = [], errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  // a 402 from /api/ai/scan (a guest is not Plus) logs "Failed to load resource" - a network status, not a script error
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  // ORDER MATTERS (browse-e2e, 2026-09-15): setBypassServiceWorker only works once the Network domain is enabled, which
  // setRequestInterception does. Sent first it is silently dropped and sw.js answers from Cache Storage - production, not the tree.
  try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
  page.on('request', (req) => {
    const u = req.url();
    if (u.indexOf('/api/track') >= 0) { try { const q = new URL(u).searchParams; track.push({ t: q.get('t'), e: q.get('e') }); } catch (e) {} return req.respond({ status: 204, body: '' }); }
    if (LOCAL) {
      try {
        const p = new URL(u).pathname;
        if (req.resourceType() === 'document' && /^\/screener\/?$/.test(p)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'app.html'), 'utf8') });
        const m = p.match(/^\/assets\/(home\.css|mp-screener\.js)$/);
        if (m) return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, m[1]), 'utf8') });
      } catch (e) {}
    }
    req.continue();
  });
  page._track = track; page._errors = errors;
  return page;
}
async function open(page) {
  await page.goto(BASE + '/screener?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => window.__mpScreener && window.__mpScreener.shown() >= 10, { timeout: 30000 });
  await sleep(600);
}
// rows whose centre point is reachable (elementFromPoint returns the row or something inside it) and fully inside the viewport
const VISIBLE_ROWS = () => {
  const rows = [...document.querySelectorAll('tr.scr-row')];
  // probe the COIN cell's centre, not the row's: on a phone the row is 800px wide inside a 380px scroll box, so the row's
  // own centre sits past the right edge of the screen and elementFromPoint answers null for a perfectly visible row
  return rows.filter(r => { const b = r.getBoundingClientRect(); if (b.top < 0 || b.bottom > innerHeight) return false; const c = (r.querySelector('.c-coin') || r).getBoundingClientRect(); const el = document.elementFromPoint(Math.min(c.left + c.width / 2, innerWidth - 4), b.top + b.height / 2); return !!el && (el === r || r.contains(el)); }).length;
};
const beacons = (page, pre) => page._track.filter(x => x.t === 'screener' && (!pre || (x.e || '').indexOf(pre) === 0));

(async () => {
  await withBrowser(async (browser) => {
    /* ---------------- desktop ---------------- */
    const p = await prep(browser, false);
    await open(p);
    await p.screenshot({ path: path.join(__dirname, 'ops-shots', 'screener-desktop.png') }).catch(() => {});
    const d = await p.evaluate(() => ({
      rows: window.__mpScreener.rows(), shown: window.__mpScreener.shown(), sort: window.__mpScreener.sort(),
      pageH: document.documentElement.scrollHeight,
      tableTop: Math.round(document.querySelector('.scr-tbl').getBoundingClientRect().top),
      ths: [...document.querySelectorAll('.scr-tbl th')].map(t => t.textContent.trim()),
      sortable: document.querySelectorAll('.scr-tbl th[data-k]').length,
      more: (document.querySelector('#scrMore') || {}).textContent || '',
      fund4: [...document.querySelectorAll('tr.scr-row td:nth-child(7)')].filter(td => /[+-]\d\.\d{4}%/.test(td.textContent)).length,
      tgBelow: (() => { const tg = document.querySelector('.scr-tg'), tb = document.querySelector('.scr-tbl'); return !!tg && !!tb && tg.getBoundingClientRect().top > tb.getBoundingClientRect().top; })(),
      aiAbove: (() => { const ai = document.querySelector('#scrAiScan'); return !ai || ai.hidden || ai.getBoundingClientRect().height <= 70; })(),
      chipOn: (document.querySelector('#scrFilters [data-sort].on') || {}).getAttribute ? document.querySelector('#scrFilters [data-sort].on').getAttribute('data-sort') : '',
    }));
    ok('desktop: the table renders the first 30 of ' + d.rows + ' pairs', d.rows > 60 && d.shown === Math.min(30, d.rows), 'shown=' + d.shown);
    ok('desktop: 12 columns, 10 of them sortable', d.ths.length === 12 && d.sortable === 10, d.ths.join('|'));
    const vis0 = await p.evaluate(VISIBLE_ROWS);
    ok('desktop: at least 12 coin rows REACHABLE in the first screen, default state, cookie bar up (was 0)', vis0 >= 12, 'visible=' + vis0 + ' tableTop=' + d.tableTop);
    ok('desktop: page height under 4,000px (was 16,786)', d.pageH < 4000, d.pageH + 'px');
    ok('desktop: "Show all" names the remainder', /Show all \d+ pairs/.test(d.more) && d.more.indexOf(String(d.rows - 30)) > 0, d.more.replace(/\s+/g, ' '));
    ok('desktop: funding prints four decimals', d.fund4 >= 20, d.fund4 + ' rows');
    ok('desktop: the Telegram banner sits BELOW the table', d.tgBelow);
    ok('desktop: a guest\'s Plus strip is one slim line (or absent)', d.aiAbove);
    ok('desktop: default sort is score desc and the Top Score chip is on', d.sort === 'score:desc' && d.chipOn === 'score');
    // header sort: 24h desc, then asc, chip in sync both ways
    await p.click('.scr-tbl th[data-k="chg"]'); await sleep(250);
    const s1 = await p.evaluate(() => { const v = [...document.querySelectorAll('tr.scr-row td:nth-child(4)')].slice(0, 5).map(td => parseFloat(td.textContent)); return { sort: window.__mpScreener.sort(), v, chip: (document.querySelector('#scrFilters [data-sort].on') || { getAttribute: () => '' }).getAttribute('data-sort'), th: (document.querySelector('.scr-tbl th.on') || {}).textContent }; });
    ok('desktop: clicking the 24h header sorts descending (top row is the biggest gainer)', s1.sort === 'chg:desc' && s1.v[0] >= s1.v[1] && s1.v[1] >= s1.v[2], s1.v.join(','));
    ok('desktop: the Gainers chip lights up for the same order', s1.chip === 'gain');
    await p.click('.scr-tbl th[data-k="chg"]'); await sleep(250);
    const s2 = await p.evaluate(() => { const v = [...document.querySelectorAll('tr.scr-row td:nth-child(4)')].slice(0, 5).map(td => parseFloat(td.textContent)); return { sort: window.__mpScreener.sort(), v, chip: (document.querySelector('#scrFilters [data-sort].on') || { getAttribute: () => '' }).getAttribute('data-sort') }; });
    ok('desktop: a second click flips to ascending and the Losers chip follows', s2.sort === 'chg:asc' && s2.v[0] <= s2.v[1] && s2.chip === 'lose', s2.v.join(','));
    // a column with nulls: liq desc must put the dashes LAST
    await p.click('.scr-tbl th[data-k="liq"]'); await sleep(250);
    const s3 = await p.evaluate(() => { const c = [...document.querySelectorAll('tr.scr-row td:nth-child(9)')].map(td => /\$/.test(td.textContent) ? 1 : 0); let firstNa = c.indexOf(0); return { sort: window.__mpScreener.sort(), hasVal: c.filter(Boolean).length, firstNa, valAfterNa: firstNa < 0 ? 0 : c.slice(firstNa).filter(Boolean).length }; });
    ok('desktop: sorting by Liq 24h keeps every empty cell after every filled one', s3.sort === 'liq:desc' && s3.hasVal > 0 && s3.valAfterNa === 0, 'filled=' + s3.hasVal + ' firstEmpty=' + s3.firstNa);
    ok('desktop: each sort sent a screener beacon', beacons(p, 'sort:chg').length >= 2 && beacons(p, 'sort:liq').length === 1, beacons(p, 'sort').map(b => b.e).join(','));
    // show all
    await p.click('#scrMore'); await sleep(300);
    const s4 = await p.evaluate(() => ({ shown: window.__mpScreener.shown(), rows: window.__mpScreener.rows(), more: !!document.querySelector('#scrMore') }));
    ok('desktop: Show all renders every pair and the button is gone', s4.shown === s4.rows && !s4.more, s4.shown + '/' + s4.rows);
    ok('desktop: Show all sent a beacon', beacons(p, 'more').length === 1);
    // every symbol has a logo (owner 2026-10-05): the slim CoinGecko list covered 82 of 127; the rest resolve through /api/coinicon
    // (aliases, exact-ticker search, stock logos, own metal/oil icons). Images are lazy, so walk the page before counting.
    await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 200)); } });
    await p.waitForFunction(() => { const im = [...document.querySelectorAll('tr.scr-row .scr-ic img')]; return im.length > 50 && im.every(i => i.complete); }, { timeout: 30000 }).catch(() => {});
    const lg = await p.evaluate(() => { const rows = [...document.querySelectorAll('tr.scr-row')]; const miss = rows.filter(tr => { const i = tr.querySelector('.scr-ic img'); return !i || !(i.complete && i.naturalWidth > 0) || getComputedStyle(i).display === 'none'; }).map(tr => tr.getAttribute('data-sym')); return { rows: rows.length, miss }; });
    ok('desktop: at least 95% of the rows show a real logo (the rest are tokens no source knows)', lg.rows > 60 && lg.miss.length <= Math.ceil(lg.rows * 0.05), lg.rows + ' rows, missing ' + lg.miss.length + ': ' + lg.miss.join(' '));
    // the sheet from a row
    await p.evaluate(() => { const r = [...document.querySelectorAll('tr.scr-row')].find(x => /^(BTC|ETH|SOL)$/.test(x.getAttribute('data-sym'))); r.scrollIntoView({ block: 'center' }); r.click(); });
    await sleep(900);
    const sh = await p.evaluate(() => { const s = document.querySelector('.scr-sheet.on'); if (!s) return null; const t = s.innerText; return { sym: document.getElementById('scrSheetSym').textContent, text: t, setupH: (s.querySelector('.scr-setup-h') || {}).textContent || '', note: (s.querySelector('.scr-setup-n') || {}).textContent || '', acts: [...s.querySelectorAll('#scrActs [data-act]')].map(a => a.getAttribute('data-act') + '=' + a.getAttribute('href')), exch: s.querySelectorAll('.scr-exch-a').length }; });
    ok('desktop: a row click opens the coin sheet', !!sh && /^(BTC|ETH|SOL)$/.test(sh.sym), sh && sh.sym);
    ok('desktop: the sheet open sent sheet:<SYM>', !!sh && beacons(p, 'sheet:' + sh.sym).length === 1);
    ok('desktop: the setup prints ONE leverage, never a "56–56×" range', !sh || !/\d+–\d+×/.test(sh.setupH), sh && sh.setupH);
    ok('desktop: a setup states what the stop costs in margin', !sh || !sh.setupH || /\d+% of margin/.test(sh.note), sh && sh.note);
    ok('desktop: actions carry paper / chart / alert links for the coin', !!sh && sh.acts.some(a => a.indexOf('paper=/paper-trade?coin=' + sh.sym) === 0) && sh.acts.some(a => a.indexOf('chart=/charts?coin=' + sh.sym) === 0) && sh.acts.some(a => a.indexOf('alert=/alerts/?coin=' + sh.sym) === 0), sh && sh.acts.join(' '));
    ok('desktop: the venue list is there (11 partners)', !!sh && sh.exch >= 10, sh && sh.exch);
    await p.keyboard.press('Escape'); await sleep(300);
    const closed = await p.evaluate(() => !document.querySelector('.scr-sheet.on'));
    ok('desktop: Escape closes the sheet', closed);
    // a pick opens the sheet too
    const pick = await p.evaluate(() => { const b = document.querySelector('.scr-pick'); if (!b) return null; b.scrollIntoView({ block: 'center' }); b.click(); return b.getAttribute('data-pick'); });
    await sleep(500);
    const pk = await p.evaluate(() => (document.querySelector('.scr-sheet.on') ? document.getElementById('scrSheetSym').textContent : ''));
    ok('desktop: a pick chip opens its coin and sends pick:<SYM>', !!pick && pk === pick && beacons(p, 'pick:' + pick).length === 1, pick + '/' + pk);
    ok('desktop: no page errors', p._errors.length === 0, p._errors.slice(0, 3).join(' | '));
    await p.browserContext().close();

    /* ---------------- phone ---------------- */
    const m = await prep(browser, true);
    await open(m);
    await m.screenshot({ path: path.join(__dirname, 'ops-shots', 'screener-phone.png') }).catch(() => {});
    const ph = await m.evaluate(() => ({
      pageH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth,
      tw: (() => { const t = document.querySelector('.scr-tw'); return { sw: t.scrollWidth, cw: t.clientWidth }; })(),
      tableTop: Math.round(document.querySelector('.scr-tbl').getBoundingClientRect().top),
      sub: (() => { const s = document.querySelector('#screener .sec-sub'); return s ? getComputedStyle(s).display : 'none'; })(),
      wide: [...document.querySelectorAll('#screener *')].filter(e => { const b = e.getBoundingClientRect(); if (b.right <= innerWidth + 1) return false; let a = e.parentElement; while (a) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return false; a = a.parentElement; } return true; }).length,
    }));
    const pvis = await m.evaluate(VISIBLE_ROWS);
    ok('phone: at least 6 coin rows REACHABLE in the first screen, default state, cookie bar up (was 0)', pvis >= 6, 'visible=' + pvis + ' tableTop=' + ph.tableTop);
    ok('phone: page height under 8,000px (was 25,414)', ph.pageH < 8000, ph.pageH + 'px');
    ok('phone: the page itself never scrolls sideways', ph.scrollW <= 390 && ph.wide === 0, 'scrollW=' + ph.scrollW + ' wide=' + ph.wide);
    ok('phone: the table scrolls inside its own box', ph.tw.sw > ph.tw.cw + 200, ph.tw.sw + '>' + ph.tw.cw);
    ok('phone: the sub-copy is folded away on a phone', ph.sub === 'none');
    // pinned columns: scroll the table box sideways, the coin cell stays on screen
    const pin = await m.evaluate(() => { const t = document.querySelector('.scr-tw'); t.scrollLeft = 320; const r = document.querySelector('tr.scr-row'); const c = r.querySelector('.c-coin').getBoundingClientRect(), s = r.querySelector('.c-sc').getBoundingClientRect(), px = r.querySelector('.c-px').getBoundingClientRect(); return { sl: t.scrollLeft, coinL: Math.round(c.left), scL: Math.round(s.left), pxL: Math.round(px.left) }; });
    ok('phone: after a sideways scroll the score + coin cells stay pinned at the left edge', pin.sl > 200 && pin.scL >= 0 && pin.scL < 20 && pin.coinL >= 30 && pin.coinL < 80 && pin.pxL < pin.coinL + 200, JSON.stringify(pin));
    // sticky chips while scrolling the page
    const st = await m.evaluate(async () => { window.scrollTo(0, 700); await new Promise(r => setTimeout(r, 250)); const f = document.querySelector('#scrFilters').getBoundingClientRect(); return { top: Math.round(f.top), y: scrollY }; });
    ok('phone: the sort chips stay pinned under the header while scrolling the list', st.y > 500 && st.top >= 30 && st.top <= 130, JSON.stringify(st));
    // tap a row -> sheet inside the viewport
    await m.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    // tap the pinned COIN cell: the pin test above left the table box scrolled sideways, so the row's own left edge is
    // 300px off screen while its sticky cells are exactly where a thumb lands
    const sym = await m.evaluate(() => { document.querySelector('.scr-tw').scrollLeft = 0; const r = document.querySelector('tr.scr-row'); const b = r.querySelector('.c-coin').getBoundingClientRect(); return { s: r.getAttribute('data-sym'), x: b.left + 24, y: b.top + b.height / 2 }; });
    await m.touchscreen.tap(sym.x, sym.y); await sleep(900);
    const msh = await m.evaluate((pt) => { const s = document.querySelector('.scr-sheet.on'); const hit = document.elementFromPoint(pt.x, pt.y); const at = hit ? (hit.tagName + '.' + String(hit.className).slice(0, 40)) : 'null'; if (!s) return { at }; const c = s.querySelector('.scr-sheet-card').getBoundingClientRect(); return { at, sym: document.getElementById('scrSheetSym').textContent, bottom: Math.round(c.bottom), top: Math.round(c.top), ih: innerHeight }; }, sym);
    ok('phone: a tap on a row opens its sheet inside the viewport', !!msh && msh.sym === sym.s && msh.bottom <= msh.ih + 1 && msh.top >= 0, JSON.stringify(msh));
    ok('phone: that tap sent sheet:<SYM>', !!msh && beacons(m, 'sheet:' + sym.s).length === 1);
    ok('phone: no page errors', m._errors.length === 0, m._errors.slice(0, 3).join(' | '));
    await m.browserContext().close();
  }, { timeoutMs: 220000 });
  console.log(out.join('\n'));
  console.log('\nscreener-e2e' + (LOCAL ? ' (--local)' : '') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

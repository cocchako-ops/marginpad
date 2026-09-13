/* Every link to an exchange carries our referral code (owner 2026-09-13: "do the pair links earn commission?").
   Walks /rekt/ (feed rows + ticket cards), /screener (coin sheet), /paper-trade (closed tickets: MEXC line + go-live line),
   /calculators (#exgrid) and /go?ex= in a real browser and asserts every exchange href carries the venue's code.
   Also: Rekt rows carry Bybit + Moon chips (hidden Bybit for a US reader).       node build/aff-links-e2e.js            */
'use strict';
const { withBrowser } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
// host → what the URL must contain to attribute to us
const CODE = [
  [/bybit\.com/, /ref=LZKBERJ/], [/binance\.com/, /ref=MAOZM9DS/], [/okx\.com/, /join\/96160298/], [/bitget\.com/, /clacCode=DSSSQKGK/],
  [/mexc\.com/, /(inviteCode=GND4jI97o0|\/r\/GND4jI97o0)/], [/gate\.com/, /VFIWB10KUG/], [/kucoin\.com/, /(rcode=VHP8AYKY|\/r\/rf\/VHP8AYKY)/],
  [/moon\.com/, /offer=marginpad/], [/hyperliquid\.xyz/, /join\/MARGINPAD/], [/kraken\.com/, /invite\.kraken\.com/], [/base\.app/, /invite\/chakko/],
];
const EXH = /bybit\.com|binance\.com|okx\.com|bitget\.com|mexc\.com|gate\.com|kucoin\.com|moon\.com|hyperliquid\.xyz|kraken\.com|base\.app/;
function audit(list) { const bad = []; for (const h of list) { if (!EXH.test(h)) continue; const rule = CODE.find(r => r[0].test(h)); if (!rule || !rule[1].test(h)) bad.push(h); } return bad; }
const now = Date.now();
const J = [{ id: String(now - 60000) + '_1', sym: 'BTC', side: 'long', lev: 10, margin: 100, qty: 100 * 10 / 60000, entry: 60000, exit: 60600, ts: now - 3600000, closeTs: now - 60000, status: 'win', pnl: 9.34, feeRate: 0.00055, src: 'client' }];
(async () => {
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.evaluateOnNewDocument((j) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.setItem('mp_cc', JSON.stringify({ cc: 'DE', ts: Date.now() })); } catch (e) {} }, J);
    const hrefs = () => page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href));
    // rekt
    await page.goto(O + '/rekt/?cb=' + now, { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 6000));
    let hs = await hrefs(); let bad = audit(hs);
    // 2026-09-13: the per-row Bybit/Moon chips are GONE — the venue list moved inside the ticket window the barcode (phone)
    // or the row itself (desktop) opens. Assert both: the rows are clean, and the window lists venues that carry our codes.
    const rekt = await page.evaluate(() => ({ rows: document.querySelectorAll('.rkt-r').length, chips: document.querySelectorAll('.rkt-go, .tk-go, .rkt-goa, .tk-goa').length, withData: document.querySelectorAll('.rkt-r[data-sym]').length }));
    ok(hs.filter(h => EXH.test(h)).length > 5, '/rekt/: exchange links present (' + hs.filter(h => EXH.test(h)).length + ')');
    ok(bad.length === 0, '/rekt/: every exchange link carries our code' + (bad.length ? ' — bad: ' + bad.slice(0, 3).join(' ') : ''));
    ok(rekt.rows > 0 && rekt.chips === 0, '/rekt/: no venue chips left on the feed rows (' + rekt.rows + ' rows, ' + rekt.chips + ' chips)');
    ok(rekt.withData === rekt.rows, '/rekt/: every terminal row can open its ticket (' + rekt.withData + '/' + rekt.rows + ')');
    const oneLine = await page.evaluate(() => { const r = document.querySelector('.rkt-r'); if (!r) return true; return r.getBoundingClientRect().height < 44; });
    ok(oneLine, '/rekt/: feed row still one line');
    // open the ticket window from a desktop row and read its venue list
    await page.evaluate(() => { const r = document.querySelector('.rkt-r[data-sym]'); if (r) r.click(); }); await new Promise(r => setTimeout(r, 900));
    const modal = await page.evaluate(() => {
      const m = document.getElementById('rkModal'); if (!m || m.hidden) return { open: false };
      const vs = [...m.querySelectorAll('.rkm-ven')];
      const cta = m.querySelector('.rkm-cta');
      const reach = (el) => { const r = el.getBoundingClientRect(); const c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(c && (c === el || el.contains(c))); };
      return { open: true, n: vs.length, hrefs: vs.map(a => a.href).concat(cta ? [cta.href] : []), tracked: vs.filter(a => a.getAttribute('data-mpex')).length, ctaTracked: !!(cta && cta.getAttribute('data-mpex')), names: vs.map(a => (a.querySelector('.rkm-ven-n') || {}).textContent || ''), off: vs.map(a => a.classList.contains('off')), reach: vs.length ? reach(vs[0]) : false };
    });
    ok(modal.open, '/rekt/: a terminal row opens the ticket window');
    ok(modal.n >= 3, '/rekt/ ticket window: the venue list is there (' + modal.n + ' venues)');
    ok(modal.reach, '/rekt/ ticket window: the first venue row is actually clickable (elementFromPoint)');
    ok(modal.tracked === modal.n && modal.ctaTracked, '/rekt/ ticket window: every venue link is money-click tracked (' + modal.tracked + '/' + modal.n + ', cta ' + modal.ctaTracked + ')');
    ok(audit(modal.hrefs || []).length === 0, '/rekt/ ticket window: every venue link carries our code' + (audit(modal.hrefs || []).length ? ' — bad: ' + audit(modal.hrefs).slice(0, 3).join(' ') : ''));
    ok((modal.names || []).every((n, i) => !modal.off[i] || i >= modal.names.length - modal.off.filter(Boolean).length), '/rekt/ ticket window: unavailable venues sort last');
    await page.evaluate(() => { const x = document.getElementById('rkmClose'); if (x) x.click(); });
    // screener coin sheet
    await page.goto(O + '/screener?cb=' + now, { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 4000));
    await page.evaluate(() => { const r = document.querySelector('[data-sym], .scr-row, tr[data-s]'); if (r) r.click(); }); await new Promise(r => setTimeout(r, 1500));
    hs = await hrefs(); bad = audit(hs);
    ok(hs.filter(h => EXH.test(h)).length > 0, '/screener: exchange links present after opening a coin (' + hs.filter(h => EXH.test(h)).length + ')');
    ok(bad.length === 0, '/screener: every exchange link carries our code' + (bad.length ? ' — bad: ' + bad.slice(0, 3).join(' ') : ''));
    ok(!hs.some(h => /okx\.com\/trade-swap/.test(h)), '/screener: OKX no longer links a bare pair page');
    // paper-trade closed ticket (MEXC line + go-live line)
    await page.goto(O + '/paper-trade?cb=' + now, { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 2500));
    await page.evaluate(async () => { window.mpOpenTrades && window.mpOpenTrades(); await new Promise(r => setTimeout(r, 700)); const t = document.querySelector('#jrDrawer [data-jt="closed"]'); t && t.click(); }); await new Promise(r => setTimeout(r, 1500));
    hs = await page.evaluate(() => [...document.querySelectorAll('#jrDrawer a[href]')].map(a => a.href)); bad = audit(hs);
    ok(hs.filter(h => EXH.test(h)).length >= 1, '/paper-trade ticket: exchange links present (' + hs.filter(h => EXH.test(h)).length + ')');
    ok(bad.length === 0, '/paper-trade ticket: every exchange link carries our code' + (bad.length ? ' — bad: ' + bad.slice(0, 3).join(' ') : ''));
    // calculators grid
    await page.goto(O + '/calculators?cb=' + now, { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 3000));
    hs = await hrefs(); bad = audit(hs);
    ok(hs.filter(h => EXH.test(h)).length > 0 && bad.length === 0, '/calculators: exchange links carry our code (' + hs.filter(h => EXH.test(h)).length + ')' + (bad.length ? ' — bad: ' + bad.slice(0, 3).join(' ') : ''));
    // /go interstitial fallbacks
    for (const ex of ['binance', 'bybit', 'mexc']) { const t = await (await fetch(O + '/go?ex=' + ex + '&sym=SOL')).text(); const rule = CODE.find(r => r[0].test(ex + '.com')); ok(rule && rule[1].test(t), '/go?ex=' + ex + ' web fallback carries our code'); }
    // US reader: inside the ticket window, the venues that cannot onboard them are dimmed, labelled and last
    const us = await browser.createBrowserContext(); const p2 = await us.newPage(); await p2.setViewport({ width: 1366, height: 900 });
    await p2.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_cc', JSON.stringify({ cc: 'US', ts: Date.now() })); } catch (e) {} });
    await p2.goto(O + '/rekt/?cb=' + now, { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 6000));
    await p2.evaluate(() => { const r = document.querySelector('.rkt-r[data-sym]'); if (r) r.click(); }); await new Promise(r => setTimeout(r, 900));
    const usr = await p2.evaluate(() => {
      const m = document.getElementById('rkModal'); if (!m || m.hidden) return { open: false };
      const vs = [...m.querySelectorAll('.rkm-ven')];
      return { open: true, n: vs.length, first: (vs[0] && (vs[0].querySelector('.rkm-ven-n') || {}).textContent) || '', byOff: vs.filter(a => /Bybit|Binance/.test(a.textContent) && a.classList.contains('off')).length, byAny: vs.filter(a => /Bybit|Binance/.test(a.textContent)).length, na: vs.filter(a => /not available/i.test(a.textContent)).length };
    });
    ok(usr.open && usr.n >= 3, 'US reader on /rekt/: the ticket window lists venues (' + usr.n + ')');
    ok(usr.byAny === 0 || (usr.byOff === usr.byAny && usr.na >= usr.byOff), 'US reader on /rekt/: Bybit/Binance shown dimmed and labelled, never as a plain option (' + JSON.stringify(usr) + ')');
    ok(!/Bybit|Binance/.test(usr.first || ''), 'US reader on /rekt/: a US-friendly venue is first (' + usr.first + ')');
    await us.close(); await ctx.close();
  });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

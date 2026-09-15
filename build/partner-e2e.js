/* Partner layer E2E (2026-09-09, owner: "poboljsaj referal klikove, ali da ne bude agresivno").
   Five changes, proved on production:
     1 MEASUREMENT  a click-out label must resolve to a real partner (PARTNERS in the worker). An injection string is
                    recorded as 'other', never counted as money and never written to the money-click ring - measured
                    before the fix: 126 of ~380 exchange "clicks" in 30 days were SQL probes from one scanner.
     2 GEO ORDER    /api/geo answers the country (private cache, no store hop); the cards order themselves per reader
                    and venues that cannot onboard that country go last and say so. US: Coinbase/Kraken first.
     3 REWARDS      the payout note carries a real, TRACKED button to open the account a payout needs.
     4 AFTER A WIN  the newest winning ticket carries ONE dismissible line to the same pair; dismiss lasts a DAY
                    (it was 7 days until 2026-09-10 - one X and the owner lost the line on his own site for a week).
     5 EXACT PAIR   every link built by the shared table points at the coin, not at the exchange home page.
   The browser tests never click a partner link (that would write a real money click); they read hrefs and order.
   Run: node build/partner-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K };
const JUNK = " UNION ALL SELECT NULLNULLNULL" + Math.random().toString(36).slice(2, 7);
const DID = 'e2e' + Math.random().toString(16).slice(2).padEnd(29, '0').slice(0, 29);
const beacon = (q) => fetch(ORIGIN + '/api/track?' + q, { headers: { cookie: 'mp_did=' + DID, 'user-agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 e2e-partner', 'x-admin-key': K } }).then(r => r.status);
const J = (p) => fetch(ORIGIN + p, { headers: H }).then(async r => ({ status: r.status, hdr: r.headers, body: await r.json().catch(() => ({})) }));

(async () => {
  // ---- 1. the whitelist
  const g = await J('/api/geo');
  // the invariant that matters is that a SHARED cache can never hand one visitor's country to everybody
  chk('/api/geo answers a country and is never shared-cacheable', g.status === 200 && /^[A-Z]{2}$/.test(g.body.cc || '') && !/public|s-maxage/.test(g.hdr.get('cache-control') || ''), { cc: g.body.cc, cache: g.hdr.get('cache-control') });
  const b1 = await beacon('t=exchange&e=' + encodeURIComponent(JUNK) + '&p=%2F');
  const b2 = await beacon('t=exchange&e=Bybit&p=%2Fpaper-trade');
  chk('both click beacons accepted', b1 === 204 && b2 === 204, { b1, b2 });
  await sleep(2500);
  const act = (await J('/api/admin/activity?h=1&n=600&e2e=1&_=' + Date.now())).body;
  const mine = (act.rows || []).filter(r => r.t === 'exchange' && r.di === DID.slice(0, 8));
  // Since 2026-09-14 a click-out naming no partner is not a ROW at all - it is counted as aff:junk and kept out of
  // evlog, because 429 of 446 exchange rows in one day were a scanner. This check asked for the old 'other' row and
  // had therefore been impossible to pass ever since: always red, hiding whatever else broke in this file.
  chk('a click-out naming no partner is not a row at all, and the real one still is', mine.some(r => r.e === 'Bybit') && !mine.some(r => r.e === 'other') && !mine.some(r => String(r.e || '').indexOf('UNION') >= 0), mine.map(r => r.e));
  chk('a real partner label survives untouched', mine.some(r => r.e === 'Bybit'), mine.map(r => r.e));
  const rev = (await J('/api/admin/revenue?_=' + Date.now())).body;
  const KNOWN = ['Bybit', 'Binance', 'OKX', 'Bitget', 'Kraken', 'Coinbase', 'KuCoin', 'MEXC', 'Moon', 'Gate', 'Crypto.com', 'BingX', 'Phemex', 'Hyperliquid', 'TradingView', 'Koinly', '3Commas', 'Ledger', 'Trezor'];
  const badEx = (rev.byEx || []).filter(r => KNOWN.indexOf(r.ex) < 0);
  chk('Revenue: every exchange row is a real partner (historical junk filtered at read time)', badEx.length === 0 && (rev.byEx || []).length > 0, { rows: (rev.byEx || []).length, bad: badEx.slice(0, 3) });
  chk('Revenue: the junk that used to sit in the table is counted apart and is substantial', (+rev.junk || 0) > 0, { junk: rev.junk, top: (rev.byEx || []).slice(0, 4) });
  chk('Revenue: the money-click list never carries the injection label', !((rev.clicks || []).some(c => String(c.e || '').indexOf('UNION') >= 0)), { clicks: (rev.clicks || []).length });
  const byCcBad = (rev.byCc || []).filter(r => !/^[A-Z]{2}$/.test(r.cc || '') && r.cc !== '');
  chk('Revenue: the country panel is folded from partner rows only', byCcBad.length === 0, byCcBad.slice(0, 3));

  // ---- 2..5 in a browser. mp_cc is the module's own 24h cache, so seeding it is the supported way to look like a reader elsewhere.
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140))); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
    // seeded on a REAL page of the origin (evaluateOnNewDocument runs while the document is still opaque, where
    // localStorage throws) - mp_cc is the module's own 24h cache, which is how a reader elsewhere is simulated
    await page.goto(ORIGIN + '/rewards/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const seed = (cc, journal) => page.evaluate((cc, journal) => {
      try { localStorage.setItem('mp_cc', JSON.stringify({ cc: cc, ts: Date.now() })); } catch (e) {}
      try { localStorage.removeItem('mp_golive_x'); if (journal) localStorage.setItem('mp_journal', journal); else localStorage.removeItem('mp_journal'); } catch (e) {}
    }, cc, journal || '');
    const ORDER = () => page.evaluate(() => Array.prototype.slice.call(document.querySelectorAll('.exch-grid a.exs')).map(a => ({ ex: a.getAttribute('data-ex'), order: a.style.order || '', off: a.classList.contains('mp-ex-off'), tag: (a.querySelector('.exs-tag') || {}).textContent || '' })).sort((x, y) => (+x.order || 99) - (+y.order || 99)));

    // ---- homepage as a US reader
    await page.setViewport({ width: 1366, height: 900 });
    await seed('US');
    await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
    let us = []; for (let w = 0; w < 24; w++) { await sleep(400); us = await ORDER(); if (us.length && us[0].ex === 'Coinbase') break; }
    chk('homepage US: the venues that can actually onboard them come first', us.length >= 6 && ['Coinbase', 'Kraken'].indexOf(us[0].ex) >= 0 && ['Coinbase', 'Kraken'].indexOf(us[1].ex) >= 0, us.slice(0, 4).map(x => x.ex));
    const off = us.filter(x => x.off).map(x => x.ex);
    chk('homepage US: Bybit / Binance / OKX are dimmed, labelled and pushed to the end', off.indexOf('Bybit') >= 0 && off.indexOf('Binance') >= 0 && us.slice(-3).every(x => x.off) && /Not in the US/.test((us.filter(x => x.ex === 'Bybit')[0] || {}).tag || ''), { off, last: us.slice(-3).map(x => x.ex) });
    const hero = await page.evaluate(() => { const b = document.querySelector('.exch-grid .exbig'), g2 = document.querySelector('.exch-grid'); if (!b || !g2) return null; const kids = Array.prototype.slice.call(g2.children); const box = b.getBoundingClientRect(); const first = kids.filter(k => k !== b).map(k => k.getBoundingClientRect().top); return { heroTop: Math.round(box.top), minOther: Math.round(Math.min.apply(null, first)), w: Math.round(box.width), sw: document.documentElement.scrollWidth, ww: window.innerWidth }; });
    chk('homepage US: the Moon panel keeps its place and the grid is intact (no reflow damage)', !!hero && hero.heroTop <= hero.minOther && hero.w > 300 && hero.sw <= hero.ww, hero);
    // the subtitle of THIS band (the page has one per section; the first is the hero's)
    const sub = await page.evaluate(() => { const g2 = document.querySelector('.exch-grid'); const b = g2 && g2.closest('.band'); const s = b && b.querySelector('.band-s'); return s ? s.textContent.replace(/\s+/g, ' ').slice(0, 70) : ''; });
    chk('homepage US: the band says why the order changed', /available in the US first/i.test(sub), { sub });

    // ---- homepage as a Nigerian reader: reordered, but nothing is claimed and nothing is dimmed
    await seed('NG');
    await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
    let ng = []; for (let w = 0; w < 24; w++) { await sleep(400); ng = await ORDER(); if (ng.length && ng[0].ex === 'Bybit') break; }
    chk('homepage NG: measured order (Bybit first), no venue dimmed, no country claim on the cards', ng[0] && ng[0].ex === 'Bybit' && ng.every(x => !x.off) && ng.every(x => !/Not in/.test(x.tag)), ng.slice(0, 4).map(x => x.ex));

    // ---- the terminal: one line under the newest winning ticket, pointing at the same pair
    const tr = (sym, pnl) => ({ id: String(Date.now() - 5000) + '_e2e', ts: Date.now() - 90000, closeTs: Date.now() - 5000, sym: sym, side: 'long', entry: 100, exit: 118, lev: 10, qty: 1, notional: 1000, margin: 100, riskAmt: 100, liq: 90, mmr: 0.005, feeRate: 0.00055, status: 'win', pnl: pnl });
    await seed('NG', JSON.stringify([tr('SOL', 18.3)]));
    await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
    const openClosedTab = async () => { await page.evaluate(() => { const o = document.getElementById('jrOpen'); if (o) o.click(); }); await sleep(600); await page.evaluate(() => { const t = document.querySelector('#jrList [data-jt="closed"]'); if (t) t.click(); }); await sleep(600); };
    await openClosedTab();
    let gl = null; for (let w = 0; w < 20; w++) { await sleep(500); gl = await page.evaluate(() => { const a = document.querySelector('#jrList .mp-gl'); return a ? { txt: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), ex: a.getAttribute('data-mpex'), n: document.querySelectorAll('#jrList .mp-gl').length } : null; }); if (gl) break; if (w === 8) await openClosedTab(); }
    chk('terminal: the winning ticket carries ONE line, with the real percentage and the pair', !!gl && gl.n === 1 && /18\.3%/.test(gl.txt) && /SOL/.test(gl.txt), gl && { txt: gl.txt.slice(0, 90), n: gl.n });
    chk('terminal: the link is the EXACT pair on the venue that fits this reader, marked sponsored', !!gl && gl.href === 'https://www.bybit.com/trade/usdt/SOLUSDT?ref=LZKBERJ' && gl.ex === 'Bybit', gl && { href: gl.href });
    const dis = await page.evaluate(() => { const x = document.querySelector('#jrList .mp-gl .mp-gl-x'); if (!x) return null; x.click(); return { gone: !document.querySelector('#jrList .mp-gl'), stored: !!localStorage.getItem('mp_golive_x') }; });
    chk('terminal: the dismiss button removes it and remembers the choice', !!dis && dis.gone && dis.stored, dis);
    await page.evaluate(() => { if (window.mpJournalRender) window.mpJournalRender(); }); await sleep(700);
    chk('terminal: it stays gone after a re-render (the list rebuilds every second)', await page.evaluate(() => !document.querySelector('#jrList .mp-gl')));
    // "Not now" means today. A dismissal from yesterday must not still be hiding it.
    await page.evaluate((h) => { try { localStorage.setItem('mp_golive_x', String(Date.now() - h * 3600000)); } catch (e) {} }, 25);
    await page.reload({ waitUntil: 'load', timeout: 90000 }); await sleep(6000);
    await page.evaluate(() => { const b = document.querySelector('[data-mytrades]'); if (b) b.click(); }); await sleep(1600);
    await page.evaluate(() => { const t = document.querySelector('#jrDrawer [data-jt="closed"]'); if (t) t.click(); }); await sleep(1300);
    const back = await page.evaluate(() => ({ shown: !!document.querySelector('.mp-gl') }));
    chk('terminal: a dismissal from yesterday has expired - the line is back', back.shown === true, back);
    await page.evaluate((h) => { try { localStorage.setItem('mp_golive_x', String(Date.now() - h * 3600000)); } catch (e) {} }, 1);
    await page.reload({ waitUntil: 'load', timeout: 90000 }); await sleep(6000);
    await page.evaluate(() => { const b = document.querySelector('[data-mytrades]'); if (b) b.click(); }); await sleep(1600);
    await page.evaluate(() => { const t = document.querySelector('#jrDrawer [data-jt="closed"]'); if (t) t.click(); }); await sleep(1300);
    const still = await page.evaluate(() => ({ shown: !!document.querySelector('.mp-gl') }));
    chk('terminal: an X an hour ago still counts - it stays hidden for the rest of the day', still.shown === false, still);
    // a losing ticket never gets the line
    await seed('NG', JSON.stringify([Object.assign(tr('ETH', -12.5), { status: 'loss' })]));
    await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
    await openClosedTab(); await sleep(1200);
    chk('terminal: a losing ticket is left alone', await page.evaluate(() => !document.querySelector('#jrList .mp-gl')));

    // ---- the same win seen from the US: a venue that can actually take them
    await seed('US', JSON.stringify([tr('SOL', 18.3)]));
    await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
    await openClosedTab();
    let glUs = null; for (let w = 0; w < 20; w++) { await sleep(500); glUs = await page.evaluate(() => { const a = document.querySelector('#jrList .mp-gl'); return a ? { ex: a.getAttribute('data-mpex'), href: a.getAttribute('href') } : null; }); if (glUs) break; if (w === 8) await openClosedTab(); }
    chk('terminal US: the line points at a venue that onboards US traders, never at Bybit', !!glUs && ['Coinbase', 'Kraken', 'Crypto.com', 'Moon'].indexOf(glUs.ex) >= 0, glUs);

    // ---- rewards: the payout button is real, tracked and reachable
    await seed('NG');
    await page.goto(ORIGIN + '/rewards/?cb=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
    await sleep(1500);
    const rw = await page.evaluate(() => { const a = document.querySelector('#wdNoteBybit .wd-go'); const s = document.querySelector('.step a[data-mpex="Bybit"]'); return { has: !!a, href: a && a.getAttribute('href'), ex: a && a.getAttribute('data-mpex'), rel: a && a.getAttribute('rel'), step: !!s, stepHref: s && s.getAttribute('href') }; });
    chk('rewards: the payout note has a tracked button to open the account a payout needs', rw.has && rw.ex === 'Bybit' && /bybit\.com\/invite\?ref=LZKBERJ/.test(rw.href || '') && /sponsored/.test(rw.rel || ''), rw);
    chk('rewards: the "how it works" step links there too', rw.step && /bybit\.com\/invite\?ref=LZKBERJ/.test(rw.stepHref || ''), { stepHref: rw.stepHref });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(ORIGIN + '/rewards/?cb=' + Date.now(), { waitUntil: 'load', timeout: 60000 }); await sleep(1500);
    const ph = await page.evaluate(() => { const w = document.getElementById('wdNoteBybit'); if (!w) return { none: true }; // the payout block only exists once a member opens Withdraw - reveal the same DOM the member sees
      const dash = document.getElementById('dash'), row = document.getElementById('wdAddrRow');
      if (dash) dash.hidden = false; if (row) row.hidden = false; w.hidden = false;
      const a = w.querySelector('.wd-go'); if (!a) return { none: true };
      a.scrollIntoView({ block: 'center' }); const b = a.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { reach: !!hit && (a.contains(hit) || hit === a), w: Math.round(b.width), sw: document.documentElement.scrollWidth, ww: window.innerWidth }; });
    chk('phone 390: the payout button is reachable and nothing overflows', !ph.none && ph.reach && ph.sw <= ph.ww, ph);
    chk('browser: no page or console errors anywhere in this walk', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  });

  for (const q of ['"di":"' + DID.slice(0, 8)]) { try { await fetch(ORIGIN + '/api/admin/activity?purge=' + encodeURIComponent(q), { method: 'POST', headers: H }); } catch (e) {} }
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' - ' + f + ' FAIL' : ''));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });

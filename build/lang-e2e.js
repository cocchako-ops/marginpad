/* Language switch E2E (2026-09-13, owner: "kad izaberem španski, uvek treba da bude selektovan taj jezik"):
   choose Spanish on the homepage → every page's dropdown shows ES, English URLs redirect to the /es/ twin once,
   a missing twin bounces back without looping, choosing EN on a Spanish page lands on the English page and sticks.
   node build/lang-e2e.js                                                                                   */
'use strict';
const { withBrowser } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const cb = () => (Math.random().toString(36).slice(2, 7));
(async () => {
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    const st = () => page.evaluate(() => { const s = document.getElementById('langSel'); let ls = null; try { ls = localStorage.getItem('mp_lang'); } catch (e) {} return { url: location.pathname, lang: document.documentElement.lang, sel: s ? (s.options[s.selectedIndex] || {}).textContent : null, ls }; });
    const go = async (p) => { await page.goto(O + p + (p.includes('?') ? '&' : '?') + 'cb=' + cb(), { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}); await new Promise(r => setTimeout(r, 1500)); return st(); };

    let s = await go('/'); ok(s.sel === 'EN' && !s.ls, 'fresh visitor: homepage dropdown says EN');
    // choose Spanish on the homepage
    const opt = await page.evaluate(() => { const sl = document.getElementById('langSel'); const o = [...sl.options].find(o => /^\/es\/?$|^es$/.test(o.value)); return o ? o.value : null; });
    await page.select('#langSel', opt); await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}); await new Promise(r => setTimeout(r, 1200));
    s = await st(); ok(s.url === '/es/' && s.sel === 'ES' && s.ls === 'es', 'choosing ES on the homepage → /es/ with ES selected (' + JSON.stringify(s) + ')');
    for (const p of ['/es/screener', '/es/rewards/', '/es/rekt/', '/es/btc-liquidation-calculator/', '/es/blog/what-is-slippage/']) { s = await go(p); ok(s.url === p && s.sel === 'ES' && s.lang === 'es', p + ' shows ES selected'); }
    s = await go('/es/season/'); ok(s.url === '/es/season/' && s.lang === 'es' && (s.sel === 'ES' || s.sel === null), '/es/season/ stays Spanish (its header carries no language dropdown: ' + s.sel + ')');
    // English URLs redirect to the twin once the reader chose Spanish
    s = await go('/screener'); ok(s.url === '/es/screener' && s.sel === 'ES', '/screener → /es/screener for a Spanish reader');
    s = await go('/rewards/'); ok(s.url === '/es/rewards/' && s.sel === 'ES', '/rewards/ → /es/rewards/');
    s = await go('/'); ok(s.url === '/es/' && s.sel === 'ES', '/ → /es/');
    // a path without a twin bounces back to English exactly once and stays (no loop)
    s = await go('/dolar-cripto/'); ok(s.url === '/dolar-cripto/', '/dolar-cripto/ (Spanish by design, no twin) is left alone');
    s = await go('/liquidations/recap/'); ok(!/^\/es\//.test(s.url) && s.url.indexOf('/liquidations/recap') === 0, 'a page with no twin lands on English without looping (' + s.url + ')');
    // choose EN on a Spanish page → English page, and it sticks
    await go('/es/rewards/');
    const optEn = await page.evaluate(() => { const sl = document.getElementById('langSel'); const o = [...sl.options].find(o => o.value === '/' || o.value === 'en'); return o ? o.value : null; });
    await page.select('#langSel', optEn); await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}); await new Promise(r => setTimeout(r, 1200));
    s = await st(); ok(s.url === '/rewards/' && s.sel === 'EN' && s.ls === 'en', 'choosing EN on /es/rewards/ → /rewards/ with EN selected (' + JSON.stringify(s) + ')');
    s = await go('/btc-liquidation-calculator/'); ok(s.url === '/btc-liquidation-calculator/' && s.sel === 'EN', 'English stays English afterwards');
    s = await go('/es/screener'); ok(s.url === '/es/screener' && s.sel === 'ES', 'a direct Spanish URL still shows ES (URL wins)');
    // German homepage choice keeps working (other languages = homepage only)
    await go('/');
    const optDe = await page.evaluate(() => { const sl = document.getElementById('langSel'); const o = [...sl.options].find(o => o.value === '/de/'); return o ? o.value : null; });
    if (optDe) { await page.select('#langSel', optDe); await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}); s = await st(); ok(s.url === '/de/' && s.sel === 'DE', 'choosing DE → /de/ with DE selected'); }
    // phone: the dropdown is reachable on /es/
    await page.setViewport({ width: 390, height: 800 }); await go('/es/rewards/');
    const reach = await page.evaluate(() => { const s = document.getElementById('langSel'); if (!s) return 'none'; const r = s.getBoundingClientRect(); if (!r.width) return 'hidden'; const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el === s || (el && el.closest && el.closest('#langSel')) ? 'ok' : 'covered'; });
    ok(reach === 'ok' || reach === 'hidden', 'phone /es/rewards/: dropdown reachable or intentionally hidden (' + reach + ')');
  });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

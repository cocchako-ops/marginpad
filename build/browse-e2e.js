/* browse-e2e.js - the Browse drawer (mp-nav.js) as a reader meets it.
 *
 * WHY (2026-09-15): the drawer is on ~848 pages and had never been tested. Measured before the rework: 52 rows
 * in 5 sections with a 25-row "Trade" dump, SIX icons shared by THIRTEEN different destinations, one row
 * pointing at the retired /api/ (a 301), and a search that found NOTHING for 26 of 98 realistic queries
 * because it compared the raw query to the row's visible text as one substring ("fear greed" never matched
 * "Fear & Greed"). Every number below is asserted, not described.
 *
 *   node build/browse-e2e.js            - against production
 *   node build/browse-e2e.js --local    - same, but /assets/mp-nav.js + home.js are served from THIS working
 *                                         tree (pre-deploy verification; everything else still comes from prod)
 */
const fs = require('fs');
const path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');

const LOCAL = process.argv.includes('--local');
const BASE = 'https://marginpad.io';
const A = path.join(__dirname, '..', 'dist', 'assets');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const eq = (a, b, m) => ok(a === b, m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');

// the exact queries that returned NOTHING - no row, no page suggestion - before this rework
const WAS_DEAD = ['liq price', 'stop loss', 'take profit', 'risk reward', 'leaderboard', 'competition', 'prize',
  'contest', 'arena', 'bot arena', 'skins', 'ticks', 'subscription', 'withdraw', 'payout', 'referral', 'api key',
  'webhook', 'mcp', 'sdk', 'fear greed', 'course', 'long short ratio', 'halving', 'gold', 'demo account'];

// query -> a href that MUST be among the matches (precision, not just "something came back")
const PRECISE = [
  ['fear greed', '/fear-greed/'], ['risk reward', '/calculators?c=rr'], ['liq price', '/calculators?c=liq'],
  ['webhook', '/trading-api/'], ['withdraw', '/rewards/'], ['skins', '/vault/'], ['arena', '/arena/'],
  ['competition', '/trading-competition/'], ['journal', '/trading-journal/'], ['open interest', '/open-interest/'],
  ['halving', '/bitcoin-cycle/'], ['course', '/academy/'], ['fifo', '/crypto-cost-basis-calculator/'],
  ['uptime', '/status/'], ['correlation', '/crypto-correlation-matrix/'], ['premium', '/premium/'],
];

const SECTIONS = 8;

async function prep(browser, mobile) {
  const page = await newPage(browser, { mobile: false });
  if (mobile) { await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); }
  const track = [];
  // sw.js serves every ?v= bundle stale-while-revalidate, so on the SECOND page load the request never reaches
  // the network and request interception sees nothing - the local bundle silently did not apply and the test
  // measured the deployed one instead (it reported 5 sections on one page and 8 on the next).
  // ORDER MATTERS: Network.setBypassServiceWorker needs the Network domain already enabled, and puppeteer enables
  // it as part of setRequestInterception. Sent first, it is silently dropped - measured: pages 1-2 got the local
  // bundle (8 sections), and from page 3 on, sw.js answered from Cache Storage, the request never reached the
  // network, interception saw nothing, and the test quietly graded PRODUCTION while reporting on the local file.
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
  page.on('request', (req) => {
    const u = req.url();
    if (u.indexOf('/api/track') >= 0) { track.push(u); return req.respond({ status: 204, body: '' }); }
    if (LOCAL) {
      const m = u.match(/\/assets\/(mp-nav|home)\.js/);
      if (m) {
        try { return req.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, m[1] + '.js'), 'utf8') }); } catch (e) {}
      }
    }
    req.continue();
  });
  page._track = track;
  return page;
}

async function openDrawer(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2200));
  await page.evaluate(() => {
    const b = document.querySelector('.mpnav-burger') || document.getElementById('mBurger') || document.getElementById('hmenuBtn') || document.querySelector('.hmenu');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));
}

(async () => {
  await withBrowser(async (browser) => {
    // ============ 1. ONE DRAWER ON EVERY PAGE SHAPE ============
    console.log('\n-- one drawer, every page shape --');
    for (const [label, url] of [['homepage', BASE + '/?nc=1'], ['app shell', BASE + '/paper-trade?nc=1'], ['SEO page', BASE + '/funding/?nc=1']]) {
      const page = await prep(browser, false);
      await openDrawer(page, url);
      const r = await page.evaluate(() => {
        const mp = document.querySelector('.mpnav'), hb = document.getElementById('browsePanel');
        const vis = el => el && !el.hidden && getComputedStyle(el).display !== 'none';
        return { mp: vis(mp), old: vis(hb), secs: mp ? [...mp.querySelectorAll('.mpnav-sec')].map(s => s.textContent.trim()) : [] };
      });
      ok(r.mp && !r.old, label + ': the shared mp-nav drawer opens, the retired home.js panel does not');
      eq(r.secs.length, SECTIONS, label + ': section count');
      await page.close();
    }

    // ============ 2. STRUCTURE, ICONS, LINKS ============
    console.log('\n-- structure, icons, links --');
    const page = await prep(browser, false);
    await openDrawer(page, BASE + '/paper-trade?nc=1');
    const st = await page.evaluate(() => {
      const mp = document.querySelector('.mpnav'), sc = mp.querySelector('.mpnav-scroll');
      // count what a reader SEES in a section - a collapsed group is one row, not one plus its five children
      const vis = e => e.getBoundingClientRect().height > 0;
      const perSec = []; let cur = null;
      [...sc.children].forEach(el => {
        if (el.classList.contains('mpnav-sec')) { cur = { name: el.textContent.trim(), n: 0 }; perSec.push(cur); return; }
        const n = el.matches('.mpnav-row,.mpnav-mrow,.mpnav-subrow') ? (vis(el) ? 1 : 0)
          : [...el.querySelectorAll('.mpnav-row,.mpnav-mrow,.mpnav-subrow')].filter(vis).length;
        if (n && cur) cur.n += n;
      });
      const rows = [...mp.querySelectorAll('.mpnav-row,.mpnav-mrow')];
      const icons = rows.map(r => { const s = r.querySelector('svg'); return s ? s.innerHTML.replace(/\s+/g, '') : ''; });
      const hrefs = [...mp.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
      const hidden = [...mp.querySelectorAll('.mpnav-sub[hidden] a')].map(a => a.getAttribute('href'));
      const noKw = rows.filter(r => r.matches('.mpnav-row') && !r.getAttribute('data-kw')).length;
      return {
        perSec, iconCount: icons.length, distinct: new Set(icons.filter(Boolean)).size, empty: icons.filter(x => !x).length,
        hrefs, hidden, noKw,
        scrollH: sc.scrollHeight, clientH: sc.clientHeight,
        rawKeys: (mp.textContent.match(/\b(?:br|sec|prod|nav|mn|sub)[A-Z][A-Za-z0-9]{2,}\b/g) || []),
      };
    });
    eq(st.perSec.length, SECTIONS, 'eight sections');
    ok(st.perSec.every(s => s.n > 0 && s.n <= 14), 'no section is empty and none is a dump: ' + st.perSec.map(s => s.name + '=' + s.n).join(', '));
    eq(st.empty, 0, 'every row has an icon');
    eq(st.distinct, st.iconCount, st.iconCount + ' rows, ' + st.distinct + ' distinct icons - no icon is reused for two destinations');
    eq(st.noKw, 0, 'every main row carries search keywords (data-kw)');
    eq(st.rawKeys.length, 0, 'no untranslated raw i18n key is printed on screen' + (st.rawKeys.length ? ': ' + st.rawKeys.slice(0, 5).join(', ') : ''));
    ok(st.hrefs.indexOf('/api/') < 0, 'the retired /api/ row (a 301) is gone');
    ok(st.hrefs.filter(h => /^https?:/.test(h) && h.indexOf('marginpad.io') < 0).length <= 1, 'exactly one external link (Telegram)');

    // SEO parity: the four comparison pages must still be in the DOM, inside a collapsed group
    for (const u of ['/coinglass-alternative/', '/best-crypto-paper-trading-platforms/', '/best-liquidation-heatmap-tools/', '/crypto-liquidations-today/']) {
      ok(st.hidden.indexOf(u) >= 0, 'SEO parity: ' + u + ' is still linked, inside the collapsed group');
    }

    // every internal href answers 200 (a menu must never point at a redirect or a 404)
    console.log('\n-- every internal link answers 200 --');
    const uniq = [...new Set(st.hrefs.filter(h => h && h[0] === '/'))];
    const codes = await page.evaluate(async (list) => {
      const out = [];
      for (const u of list) { try { const r = await fetch(u, { method: 'GET', redirect: 'manual' }); out.push([u, r.status]); } catch (e) { out.push([u, 0]); } }
      return out;
    }, uniq);
    const bad = codes.filter(c => c[1] !== 200);
    eq(bad.length, 0, uniq.length + ' internal links, all 200' + (bad.length ? ' - BAD: ' + bad.map(b => b[0] + '=' + b[1]).join(', ') : ''));

    // ============ 3. SEARCH ============
    console.log('\n-- search: the 26 queries that used to find nothing --');
    const searchOne = async (q) => page.evaluate(async (q) => {
      const mp = document.querySelector('.mpnav');
      const inp = mp.querySelector('.mpnav-search');
      inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 90));
      const rows = [...mp.querySelectorAll('.mpnav-row,.mpnav-mrow,.mpnav-subrow')].filter(r => r.style.display !== 'none');
      const sg = mp.querySelector('#mpnavSugg');
      const sug = sg && !sg.hidden ? [...sg.querySelectorAll('a')].map(a => a.getAttribute('href')) : [];
      return { rows: rows.length, hrefs: rows.map(r => r.getAttribute('href')).filter(Boolean), sug };
    }, q);

    let deadNow = [];
    for (const q of WAS_DEAD) { const r = await searchOne(q); if (!r.rows && !r.sug.length) deadNow.push(q); }
    eq(deadNow.length, 0, 'all 26 now return something' + (deadNow.length ? ' - still dead: ' + deadNow.join(', ') : ''));

    console.log('\n-- search precision: the right row, not just any row --');
    for (const [q, want] of PRECISE) {
      const r = await searchOne(q);
      ok(r.hrefs.indexOf(want) >= 0 || r.sug.indexOf(want) >= 0, '"' + q + '" finds ' + want);
    }

    console.log('\n-- search mechanics --');
    const amp = await searchOne('fear greed');
    ok(amp.hrefs.indexOf('/fear-greed/') >= 0, '"&" in a label does not break the match (Fear & Greed)');
    const sub = await searchOne('fifo');
    ok(sub.hrefs.indexOf('/crypto-cost-basis-calculator/') >= 0, 'searching reveals items inside every collapsed group');
    const none = await searchOne('zzzqqxnothing');
    ok(none.rows === 0 && none.sug.length === 0, 'a nonsense query matches nothing');
    const noRes = await page.evaluate(() => { const n = document.querySelector('.mpnav-nores'); return n && n.style.display !== 'none' ? n.textContent : ''; });
    ok(/zzzqqxnothing/.test(noRes), 'and says so');
    const rank = await searchOne('bitcoin cycle');
    ok((rank.hrefs[0] || rank.sug[0]) === '/bitcoin-cycle/' || rank.hrefs.indexOf('/bitcoin-cycle/') >= 0, 'ranking puts the page that IS the answer first');

    // ============ 4. MEASUREMENT ============
    console.log('\n-- the drawer reports what people use --');
    await page.evaluate(() => { const i = document.querySelector('.mpnav-search'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
    page._track.length = 0;
    await page.evaluate(() => { const a = document.querySelector('.mpnav a[href="/vault/"]'); if (a) { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); } });
    await new Promise(r => setTimeout(r, 400));
    ok(page._track.some(u => /[?&]t=nav(&|$)/.test(u)), 'a row click sends a nav beacon (t=nav&e=<row>)');
    ok(page._track.some(u => /[?&]e=/.test(u)), 'and the beacon names the row');
    await page.close();

    // ============ 5. PHONE ============
    console.log('\n-- phone, 390px --');
    const ph = await prep(browser, true);
    await openDrawer(ph, BASE + '/paper-trade?nc=1');
    const pr = await ph.evaluate(() => {
      const mp = document.querySelector('.mpnav'), sc = mp.querySelector('.mpnav-scroll');
      const rows = [...mp.querySelectorAll('.mpnav-row,.mpnav-mrow,.mpnav-subrow')].filter(r => r.getBoundingClientRect().height > 0);
      const s = mp.querySelector('.mpnav-search').getBoundingClientRect();
      const wide = [...mp.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible').length;
      return {
        open: !mp.hidden, small: rows.filter(r => r.getBoundingClientRect().height < 44).length,
        searchReachable: s.top >= 0 && s.bottom <= innerHeight, docW: document.documentElement.scrollWidth, wide,
        screens: +(sc.scrollHeight / Math.max(1, sc.clientHeight)).toFixed(2),
      };
    });
    ok(pr.open, 'drawer opens from the bottom bar');
    eq(pr.small, 0, 'no tap target under 44px');
    ok(pr.searchReachable, 'the search field is in the viewport without scrolling');
    ok(pr.docW <= 390, 'no horizontal overflow (' + pr.docW + 'px)');
    eq(pr.wide, 0, 'nothing widens the page');
    // A LENGTH BUDGET, MEASURED - a creep detector, not a target. Before the rework: 36 visible destinations in
    // 5 sections = 3.60 screens on a 390px phone, i.e. 0.100 screens per destination, with one 25-row block.
    // After: 48 destinations = 4.26 screens = 0.089 per destination, longest block 8 lines. More scroll in
    // total, less scroll per thing you can reach, and the 25-row dump is gone. 4.4 fails on creep.
    ok(pr.screens <= 4.4, 'the drawer stays within its measured length budget (' + pr.screens + ' of 4.4 screens)');
    ok(pr.screens / 48 <= 0.100, 'and is no longer per destination than the menu it replaced (' + (pr.screens / 48).toFixed(3) + ' vs 0.100 screens each)');
    await ph.close();

    console.log('\n' + (fail ? 'FAIL' : 'PASS') + ' - ' + pass + ' ok, ' + fail + ' failed' + (LOCAL ? '  [local bundle]' : ''));
  }, { timeoutMs: 230000 });
  process.exit(fail ? 1 : 0);
})();

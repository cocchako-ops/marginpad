/* THE GLOSSARY (2026-10-19, owner: "zelim da dobijemo nesto jako cool i prakticno" + "ove kartice nisu iste
   dimenzije ... da mogu na klik da se otvore ... pazi da ne kvare formu drugim karticama")

   The load-bearing checks are the ones that go red if the DESIGN broke, not the ones that prove a page exists:

     THE LIVE FIGURES ARE IN THE HTML - a crawler and an assistant run no JavaScript, so the ten measured
     sentences must be in the served markup, not arrive from a fetch. And a figure we could not measure must be
     ABSENT, never printed as zero: "$0 of BTC positions were closed by the exchange" shipped once.
     EVERY CLOSED CARD IS THE SAME SIZE, and opening one changes the size of no other card.
     THE CALCULATOR IS THE ONE FORMULA - the liquidation tool is checked against build/check-formulas.js's
     canonical here as well, because a reader acts on what this page prints.
     THE SEARCH FINDS A TERM BY WHAT IT DOES, not only by its name.

                                            node build/glossary-e2e.js   [--pure]                            */
'use strict';
const fs = require('fs');
const path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.indexOf('--pure') >= 0;
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 220) : '')); } };
const TERMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'data', 'glossary.json'), 'utf8'));
const U = O + '/glossary/?nc=1&cb=' + Date.now();   // ?cb= alone does NOT bust the SSR edge cache - ?nc= does

(async () => {
  console.log('\nTHE DATA AND THE ONE WRITER');
  ok(TERMS.length >= 60, 'the term table is intact (' + TERMS.length + ')');
  const ids = new Set(TERMS.map(t => t.id));
  ok(ids.size === TERMS.length, 'every id is unique');
  const dead = [];
  TERMS.forEach(t => (t.see || []).forEach(s => { if (!ids.has(s)) dead.push(t.id + ' -> ' + s); }));
  ok(!dead.length, 'no related chip points at a term that does not exist', dead.slice(0, 4));
  ok(TERMS.every(t => t.s && t.s.length > 10 && t.b), 'every term has a one-line answer and a body');
  // ONE WRITER. gen-bigupdate.js wrote this page until today; two writers is how a page silently reverts.
  const big = fs.readFileSync(path.join(ROOT, 'build', 'gen-bigupdate.js'), 'utf8');
  ok(big.indexOf("path.join(gd, 'index.html')") < 0 && big.indexOf("'glossary'), { recursive: true }") < 0,
    'gen-bigupdate.js no longer writes the glossary');
  const gen = fs.readFileSync(path.join(ROOT, 'build', 'gen-glossary.js'), 'utf8');
  ok(gen.indexOf('dist') > 0 && gen.indexOf("'glossary'") > 0, 'gen-glossary.js is the writer');
  // A font shorthand whose family is `inherit` is INVALID and the whole declaration is dropped - six of them
  // shipped once and LIVE NOW rendered at 17px instead of 9.5px.
  ok(!/font:[^;'"]*\binherit\b/.test(gen), 'no font shorthand declares `inherit` as the family');

  console.log('\nWHAT A CRAWLER READS (no JavaScript at all)');
  const res = await fetch(U, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; e2e)' } });
  const html = await res.text();
  const ssr = res.headers.get('x-mp-ssr') || '';
  ok(res.status === 200, 'the page answers 200', res.status);
  ok(/^glossary-\d+$/.test(ssr), 'it is server-rendered', ssr);
  const filled = +(ssr.split('-')[1] || 0);
  const wantLive = TERMS.filter(t => t.live).length;
  ok(filled >= Math.min(6, wantLive), 'the server filled the live slots (' + filled + ' of ' + wantLive + ')', ssr);
  ok(html.indexOf('hidden></p>') < 0 || filled < wantLive, 'no live row was left empty on the page');
  // the figures must be IN the html, not fetched
  const strip = (html.match(/class="gl-st"/g) || []).length;
  ok(strip >= 3, 'the headline strip is rendered into the markup (' + strip + ' figures)');
  ok(/BTC funding is/.test(html) || /of open BTC positions/.test(html), 'a measured sentence is in the raw html');
  // A CONFIDENT BLANK IS THE BUG: zero liquidations in 24h is a dead feed, not a measurement.
  ok(!/\$0 of BTC positions were closed/.test(html) && !/force-sold out of <b>\$0<\/b>/.test(html),
    'no live figure is printed as zero');
  ok((html.match(/class="gl-card"/g) || []).length === TERMS.length, 'every term is a card in the html');
  // structured data: an assistant must be able to cite ONE term
  const ldm = html.match(/<script type="application\/ld\+json">(\{"@context[^<]*DefinedTermSet[^<]*)<\/script>/);
  ok(!!ldm, 'the page declares a DefinedTermSet');
  if (ldm) {
    let ld = null; try { ld = JSON.parse(ldm[1]); } catch (e) {}
    ok(!!(ld && (ld.hasDefinedTerm || []).length === TERMS.length), 'with one DefinedTerm per term', ld && (ld.hasDefinedTerm || []).length);
    ok(!!(ld && (ld.hasDefinedTerm || []).every(t => /#[a-z0-9-]+$/.test(t.url || ''))), 'each one citable at its own anchor');
  }
  ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/glossary\/"/.test(html), 'canonical is itself');

  console.log('\nTHE CALCULATOR IS THE ONE FORMULA');
  // lift glLiq out of the SERVED page and run it against the canonical, the same way check-formulas.js does
  const fnSrc = (html.match(/function glLiq\([\s\S]*?\n\}/) || [])[0];
  ok(!!fnSrc, 'the liquidation calculator is in the served page');
  if (fnSrc) {
    const glLiq = new Function('"use strict";' + fnSrc + ';return glLiq;')();
    const canon = (entry, lev, mmr, long, rate) => {
      lev = Math.max(1, +lev || 1); mmr = Math.max(0, +mmr || 0);
      const im = Math.max(1e-6, 1 / lev - Math.min(0.1 / lev, Math.max(0, +rate || 0)));
      const me = Math.min(mmr, im / 2);
      return long ? entry * (1 - im + me) : entry * (1 + im - me);
    };
    let worst = 0, n = 0;
    for (const e of [0.00012, 109.46, 2478.17, 82305.1]) for (const L of [1, 5, 20, 100, 500, 1000]) for (const m of [0, 0.005, 0.0125]) for (const long of [true, false]) {
      const g = glLiq(e, L, m, long, 0), w = canon(e, L, m, long, 0);
      worst = Math.max(worst, Math.abs(g - w) / Math.max(1e-12, Math.abs(w))); n++;
    }
    ok(worst < 1e-12, 'it matches the canonical over ' + n + ' cases', worst);
  }
  ok(fs.readFileSync(path.join(ROOT, 'build', 'check-formulas.js'), 'utf8').indexOf('dist/glossary/index.html') > 0,
    'and the drift guard knows about this copy');

  if (PURE) { console.log('\n' + pass + ' passed, ' + fail + ' failed  (--pure)'); process.exitCode = fail ? 1 : 0; return; }

  const { withBrowser } = require('./e2e-browser.js');
  await withBrowser(async (browser) => {
    for (const vp of [{ n: 'desktop', width: 1366, height: 900 }, { n: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
      console.log('\n' + vp.n.toUpperCase());
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport(vp);
      await page.setCacheEnabled(false);
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 110)));
      await page.goto(U, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2600);

      // 1. EVERY CLOSED CARD THE SAME SIZE
      const size = await page.evaluate(() => {
        const c = [...document.querySelectorAll('.gl-card')];
        const h = c.map(x => Math.round(x.getBoundingClientRect().height));
        const w = c.map(x => Math.round(x.getBoundingClientRect().width));
        return { n: c.length, hs: [...new Set(h)], ws: [...new Set(w)].length, screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(2), wide: [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width > innerWidth + 2).length };
      });
      ok(size.hs.length === 1, vp.n + ': every closed card is exactly the same height (' + size.hs.join('/') + ')', size.hs.slice(0, 6));
      ok(size.ws === 1, vp.n + ': and the same width');
      ok(size.wide === 0, vp.n + ': nothing is wider than the screen', size.wide);

      // 2. OPENING ONE CHANGES NO OTHER CARD
      const moved = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.gl-card')];
        const before = new Map(cards.map(x => [x.id, x.getBoundingClientRect()]));
        const t = document.getElementById('funding-rate'); t.click();
        const resized = cards.filter(x => x !== t).filter(x => {
          const b = before.get(x.id), a = x.getBoundingClientRect();
          return Math.round(a.height - b.height) !== 0 || Math.round(a.width - b.width) !== 0;
        }).map(x => x.id);
        const r = t.getBoundingClientRect(), g = document.querySelector('.gl-grid').getBoundingClientRect();
        return {
          resized: resized.slice(0, 4), nResized: resized.length,
          grew: Math.round(r.height) > 200, fullRow: Math.round(r.width) >= Math.round(g.width) - 2,
          body: !!t.querySelector('.gl-b').offsetHeight,
          live: !!t.querySelector('.gl-live').offsetHeight,
          tool: !!t.querySelector('.gl-tool').offsetHeight,
          open: document.querySelectorAll('.gl-card.open').length
        };
      });
      ok(moved.nResized === 0, vp.n + ': opening a card resizes no other card', moved.resized);
      ok(moved.grew, vp.n + ': the opened card grows');
      ok(moved.fullRow, vp.n + ': and takes the whole row, so the grid stays square');
      ok(moved.body && moved.live && moved.tool, vp.n + ': the detail, the live figure and the calculator all appear', moved);
      ok(moved.open === 1, vp.n + ': exactly one card is open');
      const second = await page.evaluate(() => { document.getElementById('leverage').click(); return document.querySelectorAll('.gl-card.open').length; });
      ok(second === 1, vp.n + ': opening another closes the first', second);
      await page.evaluate(() => { const c = document.querySelector('.gl-card.open .gl-close'); if (c) c.click(); });
      await sleep(300);
      ok(await page.evaluate(() => !document.querySelector('.gl-card.open')), vp.n + ': close puts it back');

      // 3. THE CALCULATOR RUNS
      const calc = await page.evaluate(() => {
        const c = document.getElementById('liquidation-price'); c.click();
        const e = document.getElementById('glLiqE'), l = document.getElementById('glLiqL');
        e.value = '100'; e.dispatchEvent(new Event('input', { bubbles: true }));
        l.value = '10'; l.dispatchEvent(new Event('input', { bubbles: true }));
        return (document.getElementById('glLiqO').textContent || '').trim();
      });
      // 100 at 10x long, mmr 0.5%: im=0.1, me=0.005 -> 100*(1-0.1+0.005) = 90.50
      ok(/\$90\.50/.test(calc), vp.n + ': the liquidation calculator answers, and answers correctly', calc.slice(0, 60));

      // 4. SEARCH FINDS A TERM BY WHAT IT DOES, NOT ONLY BY ITS NAME
      const found = await page.evaluate(async () => {
        const q = document.getElementById('glQ');
        const type = (v) => new Promise(r => { q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); setTimeout(r, 260); });
        const shown = () => [...document.querySelectorAll('.gl-card')].filter(x => !x.hidden).map(x => x.id);
        await type('forced to sell');
        const a = shown();
        await type('what is funding');          // function words must not kill the query
        const b = shown();
        await type('zzzzqq');
        const c = shown();
        const none = !document.getElementById('glNone').hidden;
        await type('');
        return { a, b, c: c.length, none, all: shown().length };
      });
      ok(found.a.length > 0, vp.n + ': searching what a term DOES finds it ("forced to sell" -> ' + found.a.slice(0, 3).join(', ') + ')', found.a);
      ok(found.b.indexOf('funding-rate') >= 0, vp.n + ': a question with function words still finds the term', found.b.slice(0, 4));
      ok(found.c === 0 && found.none, vp.n + ': a query that matches nothing says so');
      ok(found.all === TERMS.length, vp.n + ': clearing the search brings every term back', found.all);

      // 5. GROUPS AND DEEP LINKS
      const grp = await page.evaluate(async () => {
        const b = [...document.querySelectorAll('#glChips [data-g]')].find(x => x.getAttribute('data-g') === 'risk');
        b.click(); await new Promise(r => setTimeout(r, 220));
        const vis = [...document.querySelectorAll('.gl-card')].filter(x => !x.hidden);
        const heads = [...document.querySelectorAll('.gl-gh')].filter(x => !x.hidden).length;
        [...document.querySelectorAll('#glChips [data-g]')].find(x => x.getAttribute('data-g') === 'all').click();
        return { n: vis.length, allRisk: vis.every(x => x.getAttribute('data-g') === 'risk'), heads };
      });
      ok(grp.n > 0 && grp.allRisk, vp.n + ': a group chip shows only that group (' + grp.n + ')', grp);
      ok(grp.heads === 1, vp.n + ': and the other group headings go with it', grp.heads);
      await page.goto(O + '/glossary/?nc=1&cb=' + Date.now() + '#short-squeeze', { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2200);
      const deep = await page.evaluate(() => { const c = document.getElementById('short-squeeze'); return { open: c.classList.contains('open'), vis: !c.hidden }; });
      ok(deep.open && deep.vis, vp.n + ': a deep link lands on the term, open', deep);

      ok(errs.length === 0, vp.n + ': no page errors', errs.slice(0, 3));
      await ctx.close();
    }
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

/* THE PAPER TRADE TERMINAL (2026-10-24, owner).            node build/pt-terminal-e2e.js  [--falsify]
 *
 * The load-bearing checks are the ones that go red if the DESIGN broke, not if a pixel moved:
 *   - the chart runs to BOTH edges of its own column and the terminal is exactly one screen with the
 *     timeframe strip ON it (the strip used to be 41px past the fold, and nothing said so);
 *   - a level the trader never typed cannot refuse their market order (the owner's bug: open Advanced,
 *     close it, press Open - the prefilled stop stayed in a field nobody could see and the open was refused);
 *   - the percent box and the price box are two views of ONE level and cannot disagree;
 *   - the exchange dropdown on a thumb OPENS, CLOSES and OPENS again, with a backdrop and an X.
 *
 * `--falsify` serves a terminal with the Advanced gate reverted and the percent read as percent OF PRICE:
 * 3 checks must go red, and the load-bearing one is "it carries no stop and no target".
 */
'use strict';
const { withBrowser, newPage } = require('./e2e-browser.js');
const fs = require('fs');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const FALSIFY = process.argv.indexOf('--falsify') >= 0;
const KEY = (fs.readFileSync('ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };

async function member() {
  const uid = 'e2e_pt' + Date.now().toString(36);
  const post = op => fetch(O + '/api/admin/e2euser', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify({ uid, op }) });
  await post('mk');
  const tok = (await (await post('sess')).json()).token;
  return { uid, tok, rm: () => post('rm') };
}
async function open(browser, m, vp) {
  const p = await newPage(browser); await p.setCacheEnabled(false);
  await p.setViewport(vp);
  await p.setCookie({ name: 'mp_sess', value: m.tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  p.__err = []; p.on('pageerror', e => p.__err.push(String(e).slice(0, 120)));
  if (FALSIFY) {
    await p.setRequestInterception(true);
    p.on('request', async (req) => {
      if (!/\/assets\/home\.js/.test(req.url())) return req.continue();
      try {
        const r = await fetch(req.url()); let js = await r.text();
        /* (1) put the stop back the way it was - Advanced's prefill applies even when Advanced is shut, which is
               exactly the bug the owner reported; (2) read the percent as percent OF PRICE, the unit a reader
               would assume and the one that is twenty times wrong at 20x. Neither removes a node the walk drives,
               so the run goes RED rather than throwing. */
        js = js.split("var sl=_advOn?num('planSlOpt'):NaN, tp=_advOn?num('planTpOpt'):NaN, trail=_advOn?num('planTrail'):NaN, be=_advOn?num('planBE'):NaN;")
          .join("var sl=num('planSlOpt'), tp=num('planTpOpt'), trail=num('planTrail'), be=num('planBE');");
        js = js.split('var e = entryNow(), L = levNow(); if (!(e > 0) || !(pct > 0)) return null;')
          .join('var e = entryNow(), L = 1; if (!(e > 0) || !(pct > 0)) return null;');
        js = js.split('var e = entryNow(), L = levNow(); if (!(e > 0) || !(px > 0)) return null;')
          .join('var e = entryNow(), L = 1; if (!(e > 0) || !(px > 0)) return null;');
        req.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: js });
      } catch (e) { req.continue(); }
    });
  }
  await p.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
  await wait(8500);
  return p;
}

(async () => {
  const m = await member();
  try {
    await withBrowser(async (browser) => {
      // ═══════════════════ DESKTOP ═══════════════════
      console.log('\n-- desktop 1366x900');
      let p = await open(browser, m, { width: 1366, height: 900 });

      const geo = await p.evaluate(() => {
        const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) }; };
        const reach = s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 2) return false; const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(t && (e.contains(t) || t === e)); };
        const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); if (r.width <= 0) return false; let a = e.parentElement; while (a) { if (/auto|hidden|scroll/.test(getComputedStyle(a).overflowX)) return false; a = a.parentElement; } return r.right > innerWidth + 1; }).length;
        const px = document.querySelector('.pt2-px-v');
        return {
          vw: innerWidth, vh: innerHeight, ptt: R('.ptt'), chart: R('.ptt-chart'), canvas: R('#ptChart'),
          head: R('.ptc-head'), bar: R('.ptc-bar'), side: R('.ptt-side'),
          barReach: reach('.ptc-bar'), symReach: reach('#ptSymBtn'), gearReach: reach('#ptChSet'), chipReach: reach('[data-stf]'),
          oldPill: !!document.querySelector('.ptt-chart-top:not([hidden])') && getComputedStyle(document.querySelector('.ptt-chart-top')).display !== 'none',
          pxClipped: px ? px.scrollWidth > px.clientWidth + 1 : null,
          pxMono: px ? /Space Mono/.test(getComputedStyle(px).fontFamily) : null,
          statMono: (() => { const b = document.querySelector('.ptt-stats b'); return b ? /Space Mono/.test(getComputedStyle(b).fontFamily) : null; })(),
          seo: R('.pt-seo'), docH: document.documentElement.scrollHeight, wide,
          tfs: [...document.querySelectorAll('[data-stf]')].map(b => b.textContent.trim()),
        };
      });
      ok(geo.chart && geo.chart.x === 0, 'the chart starts at the viewport edge (x=' + (geo.chart ? geo.chart.x : '?') + ')');
      ok(geo.side && geo.side.x + geo.side.w === geo.vw, 'the terminal ends at the other edge (right=' + (geo.side ? geo.side.x + geo.side.w : '?') + ' of ' + geo.vw + ')');
      ok(geo.ptt && geo.chart && geo.chart.w + geo.side.w >= geo.vw - 60, 'nothing is left over between the two columns');
      ok(!geo.oldPill, 'the old floating crypto/pair/timeframe pill is gone');
      ok(geo.head && geo.head.h <= 62, 'the chart head is slim (' + (geo.head ? geo.head.h : '?') + 'px)');
      ok(geo.bar && geo.bar.h <= 38, 'the timeframe strip takes almost no room (' + (geo.bar ? geo.bar.h : '?') + 'px)');
      ok(geo.bar && geo.bar.bottom <= geo.vh, 'THE STRIP IS ON THE SCREEN, not past the fold (' + (geo.bar ? geo.bar.bottom : '?') + ' <= ' + geo.vh + ')');
      ok(geo.ptt && geo.ptt.bottom <= geo.vh + 1, 'the terminal is exactly one screen (bottom ' + (geo.ptt ? geo.ptt.bottom : '?') + ')');
      ok(geo.canvas && geo.canvas.h >= 520, 'the candles get the room that is left (' + (geo.canvas ? geo.canvas.h : '?') + 'px)');
      ok(geo.barReach && geo.symReach && geo.gearReach && geo.chipReach, 'the pair, the strip, a timeframe chip and the gear are all reachable');
      ok(geo.pxClipped === false, 'the live price is not clipped by its own box');
      ok(geo.pxMono === true && geo.statMono === true, 'prices and stats render in Space Mono again');
      ok(geo.wide === 0, 'nothing runs past the right edge (' + geo.wide + ')');
      ok(geo.seo && geo.seo.y >= geo.vh - 2, 'the crawlable block is parked BELOW the fold, not hidden (y=' + (geo.seo ? geo.seo.y : 'absent') + ')');
      ok(geo.docH > geo.vh + 60, 'and it is reachable by scrolling (document ' + geo.docH + ')');
      ok(geo.tfs.join(' ') === '1m 5m 15m 1h 4h 1D', 'the strip carries the six common timeframes (' + geo.tfs.join(' ') + ')');

      // ---- the market picker ----
      await p.click('#ptSymBtn'); await wait(2200);
      const mk = await p.evaluate(() => {
        const l = document.getElementById('ptMkList'), r0 = l.querySelector('.ptmk-r');
        const rr = r0 && r0.getBoundingClientRect();
        const hit = rr ? document.elementFromPoint(rr.x + 40, rr.y + rr.height / 2) : null;
        const tabs = [...document.querySelectorAll('.ptmk-tab')];
        const tabClipped = tabs.some(t => { const w = t.closest('.ptmk-tabs').getBoundingClientRect(); const r = t.getBoundingClientRect(); return r.bottom > w.bottom + 1 || r.top < w.top - 1; });
        return {
          open: !document.getElementById('ptMkt').hidden, n: l.querySelectorAll('.ptmk-r').length,
          icons: l.querySelectorAll('.ptmk-ic img,.ptmk-ic svg').length,
          priced: [...l.querySelectorAll('.ptmk-px')].filter(e => e.textContent.indexOf('$') >= 0).length,
          tabs: tabs.map(t => t.textContent.trim()), tabClipped, reach: !!(hit && r0.contains(hit)),
          stars: l.querySelectorAll('.ptmk-st').length,
        };
      });
      ok(mk.open, 'the pair name opens the market window');
      ok(mk.n >= 40, 'it lists the markets (' + mk.n + ')');
      ok(mk.icons >= mk.n - 2, 'every row carries a face (' + mk.icons + ' of ' + mk.n + ')');
      /* the VISIBLE rows are checked per group below and that is the owner's rule ("svuda treba da budu cene").
         Over the whole 100-row list this is the lazy loader's settle time, not a product property: five in flight
         against an IntersectionObserver. A broken loader reads ~0 here, not 97. */
      ok(mk.priced >= Math.ceil(mk.n * 0.9), 'and a live price on ' + mk.priced + ' of ' + mk.n + ' rows');
      ok(mk.tabs.length === 6, 'six groups: ' + mk.tabs.join(' / '));
      ok(!mk.tabClipped, 'the group chips are not squashed by the list under them');
      ok(mk.reach && mk.stars === mk.n, 'a row is clickable and every row has its own star');

      // ---- commodities: our own icon, never a memecoin wearing the ticker (2026-10-24) ----
      await p.evaluate(() => document.querySelector('.ptmk-tab[data-mt="metal"]').click()); await wait(2200);
      const com = await p.evaluate(async () => {
        const rows = [...document.querySelectorAll('.ptmk-r')];
        const syms = rows.map(r => r.querySelector('.ptmk-s1').textContent.trim());
        const broken = rows.filter(r => { const i = r.querySelector('.ptmk-ic img'); return !i || !i.naturalWidth; }).length;
        const own = [];
        for (const s of syms) {
          // the resolver answers with a 302, so the FINAL url is what says where the picture really came from
          try { const r = await fetch('/api/coinicon?sym=' + s); own.push(s + ':' + (r.ok && r.url.indexOf('/assets/icons/') >= 0 ? 'own' : 'ELSEWHERE(' + r.status + ' ' + r.url.split('/').pop().slice(0, 20) + ')')); }
          catch (e) { own.push(s + ':threw'); }
        }
        return { syms, broken, own };
      });
      ok(com.syms.length >= 6 && com.broken === 0, 'every commodity draws a face (' + com.syms.length + ' rows, ' + com.broken + ' broken)');
      ok(com.own.every(x => /:own$/.test(x)), 'and it is OUR OWN svg, never a coin CDN look-alike (' + com.own.join(' ') + ')');
      ok(com.syms[0] === 'XAU' && com.syms[1] === 'XAG', 'gold and silver lead the group named after them (' + com.syms.slice(0, 3).join(',') + ')');

      const sw = await p.evaluate(async () => {
        document.querySelector('.ptmk-tab[data-mt="stock"]').click();
        await new Promise(r => setTimeout(r, 500));
        const stocks = [...document.querySelectorAll('.ptmk-r')].slice(0, 3).map(r => r.querySelector('.ptmk-s1').textContent);
        const q = document.getElementById('ptMkQ'); q.value = 'nvi'; q.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
        const found = [...document.querySelectorAll('.ptmk-r')].map(r => r.querySelector('.ptmk-s1').textContent);
        document.querySelector('.ptmk-st').click();
        await new Promise(r => setTimeout(r, 300));
        const favs = JSON.parse(localStorage.getItem('mp_pt_favs') || '[]');
        document.querySelector('.ptmk-r').click();
        return { stocks, found, favs };
      });
      ok(sw.found.length === 1 && sw.found[0] === 'NVDA', 'a company is found by its NAME, not only its ticker (nvi -> ' + sw.found.join(',') + ')');
      ok(sw.favs.indexOf('NVDA') >= 0, 'the star pins it to Favourites');
      ok(sw.stocks.indexOf('SNDK') >= 0 || sw.stocks.indexOf('MU') >= 0, 'the Bybit stock perps are filed under Stocks (' + sw.stocks.join(',') + ')');
      await wait(5000);
      const picked = await p.evaluate(() => ({ sym: document.getElementById('planSym').value, head: document.getElementById('ptSymTxt').textContent, cd: document.getElementById('ptCd').textContent, closed: document.getElementById('ptMkt').hidden }));
      ok(picked.closed && picked.sym === 'NVDA' && picked.head === 'NVDA', 'picking a row switches the terminal and closes the window');
      ok(/close in/i.test(picked.cd) || picked.cd === '', 'the candle clock sits under the pair ("' + picked.cd + '")');

      // ---- the timeframe strip drives the real engine ----
      await p.evaluate(() => { const ps = document.getElementById('planSym'); ps.value = 'BTC'; ps.dispatchEvent(new Event('change', { bubbles: true })); });
      await wait(3500);
      await p.evaluate(() => document.querySelector('[data-stf="60"]').click());
      await wait(3500);
      const tf = await p.evaluate(() => ({ dbg: window.__mpPtShellDbg(), lit: [...document.querySelectorAll('[data-stf]')].filter(b => b.classList.contains('on')).map(b => b.textContent.trim()), bars: (window.__mpPT ? window.__mpPT().tf : null) }));
      ok(tf.dbg.tf === '60' && tf.bars === '60', 'a chip on the strip really switches the chart (tf=' + tf.bars + ')');
      ok(tf.lit.join(',') === '1h', 'and exactly one chip is lit (' + tf.lit.join(',') + ')');

      // ---- chart settings ----
      await p.click('#ptChSet'); await wait(700);
      const st = await p.evaluate(async () => {
        const styles = [...document.querySelectorAll('#ptChPop [data-chstyle]')].map(b => b.getAttribute('data-chstyle'));
        const entries = [...document.querySelectorAll('#ptChPop [data-es]')].map(b => b.getAttribute('data-es'));
        document.querySelector('#ptChPop [data-chstyle="line"]').click();
        await new Promise(r => setTimeout(r, 1800));
        const after = { style: window.__mpPtShellDbg().style, ls: localStorage.getItem('mp_ch_style') };
        document.querySelector('#ptChPop [data-es="mark"]').click();
        await new Promise(r => setTimeout(r, 600));
        const em = window.mpEntryMode && window.mpEntryMode();
        document.querySelector('#ptChPop [data-chstyle="candles"]').click();
        await new Promise(r => setTimeout(r, 1200));
        document.querySelector('#ptChPop [data-es="line"]').click();
        return { styles, entries, after, em };
      });
      ok(st.styles.length === 6, 'the settings offer six chart styles (' + st.styles.join(',') + ')');
      ok(st.after.style === 'line' && st.after.ls === 'line', 'picking one changes the chart and is remembered');
      ok(st.entries.join(',') === 'line,mark' && st.em === 'mark', 'the entry style moved here and still drives the engine');
      await p.keyboard.press('Escape'); await wait(400);
      ok(await p.evaluate(() => document.getElementById('ptChPop').hidden), 'Escape closes the settings');

      // ══ THE OWNER'S BUG: a level nobody typed must not refuse a market order ══
      const bug = await p.evaluate(async () => {
        const seg = document.getElementById('planSeg');
        seg.querySelector('[data-side="long"]').click();
        document.getElementById('ptAdvBtn').click();             // open Advanced
        await new Promise(r => setTimeout(r, 800));
        const pre = { sl: document.getElementById('planSlOpt').value, tp: document.getElementById('planTpOpt').value };
        document.getElementById('ptAdvBtn').click();             // close it, having touched nothing
        await new Promise(r => setTimeout(r, 400));
        seg.querySelector('[data-side="short"]').click();        // now the prefilled stop is on the WRONG side
        await new Promise(r => setTimeout(r, 500));
        const a = document.getElementById('planAmt'); a.value = '25'; a.dispatchEvent(new Event('input', { bubbles: true }));
        return { pre, held: document.getElementById('planSlOpt').value, side: seg.querySelector('button.on').getAttribute('data-side'), advOpen: document.getElementById('planAdvChk').checked, before: JSON.parse(localStorage.getItem('mp_journal') || '[]').length };
      });
      ok(+bug.pre.sl > 0 && +bug.pre.tp > 0, 'opening Advanced still suggests a stop and a target (' + bug.pre.sl + ' / ' + bug.pre.tp + ')');
      ok(bug.side === 'short' && !bug.advOpen, 'the setup is right: Advanced shut, side flipped, the suggestion still in the field (' + bug.held + ')');
      await p.click('#planSave'); await wait(6500);
      const after = await p.evaluate((n) => { const t = JSON.parse(localStorage.getItem('mp_journal') || '[]'), l = t[t.length - 1]; return { opened: t.length > n, side: l && l.side, stop: l && l.stop, tp: l && l.tp }; }, bug.before);
      ok(after.opened, 'THE TRADE OPENS - a stop the trader never typed cannot refuse it any more');
      ok(after.opened && after.stop == null && after.tp == null, 'and it carries no stop and no target (' + after.stop + ' / ' + after.tp + ')');
      ok(after.side === 'short', 'on the side that was actually chosen');

      // ---- the percent box and the price box are two views of one level ----
      const pct = await p.evaluate(async () => {
        document.getElementById('planSeg').querySelector('[data-side="long"]').click();
        if (!document.getElementById('planAdvChk').checked) document.getElementById('ptAdvBtn').click();
        await new Promise(r => setTimeout(r, 700));
        const lev = document.getElementById('planLev'); lev.value = '20'; lev.dispatchEvent(new Event('input', { bubbles: true }));
        const e = document.getElementById('planSlPct'); e.value = '30'; e.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 800));
        const live = (window.mpPlanLive || {}).price, sl = +document.getElementById('planSlOpt').value;
        const want = live * (1 - 0.30 / 20);
        document.querySelector('.ptx.tp [data-xp="50"]').click();
        await new Promise(r => setTimeout(r, 700));
        const tp = +document.getElementById('planTpOpt').value, tpPct = +document.getElementById('planTpPct').value;
        // typing a PRICE must rewrite the percent
        const se = document.getElementById('planSlOpt'); se.value = String(+(live * (1 - 0.10 / 20)).toFixed(2)); se.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        const back = +document.getElementById('planSlPct').value;
        const clr = document.querySelector('.ptx.sl .ptx-clr'); const clrShown = !clr.hidden; clr.click();
        await new Promise(r => setTimeout(r, 400));
        return { live, sl, want, tp, tpPct, back, clrShown, cleared: document.getElementById('planSlOpt').value, clearedPct: document.getElementById('planSlPct').value, risk: (document.getElementById('planRiskTp') || {}).innerText || '' };
      });
      ok(pct.live > 0 && Math.abs(pct.sl - pct.want) / pct.want < 0.0005, 'typing 30% puts the stop 30% of MARGIN away, not 30% of price (' + pct.sl + ' vs ' + Math.round(pct.want * 100) / 100 + ')');
      ok(pct.tp > pct.live && Math.abs(pct.tpPct - 50) < 1.5, 'a +50% chip sets the target and the percent agrees (' + pct.tpPct + ')');
      ok(Math.abs(pct.back - 10) < 1.5, 'typing a PRICE rewrites the percent (' + pct.back + ')');
      ok(/\+\$/.test(pct.risk), 'the money readout still answers under the field ("' + pct.risk.split('\n').join(' ') + '")');
      ok(pct.clrShown && pct.cleared === '' && pct.clearedPct === '', 'Clear empties both views at once');

      // ---- the steppers ----
      const stp = await p.evaluate(async () => {
        const a = document.getElementById('planAmt'); a.value = '100'; a.dispatchEvent(new Event('input', { bubbles: true }));
        const box = a.closest('.input-line'), bs = box.querySelectorAll('.stepper button');
        const glyph = [...bs].map(b => b.querySelector('svg') ? 'svg' : b.textContent.trim());
        const r = bs[1].getBoundingClientRect();
        bs[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        bs[1].dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise(r => setTimeout(r, 200));
        return { glyph, w: Math.round(r.width), h: Math.round(r.height), v: a.value };
      });
      ok(stp.glyph.join(',') === 'svg,svg', 'the steppers are drawn, never a unicode triangle (' + stp.glyph.join(',') + ')');
      ok(stp.w >= 28 && stp.h >= 26, 'and big enough for a thumb (' + stp.w + 'x' + stp.h + ')');
      ok(+stp.v > 100, 'plus still steps the value (' + stp.v + ')');

      // ---- the switches ----
      const rz = await p.evaluate(() => {
        const it = document.querySelector('.rz-it'); if (!it) return null;
        const cs = getComputedStyle(it), knob = it.querySelector('.rz-k');
        return { caps: cs.textTransform, size: Math.round(cs.fontSize), knob: knob ? Math.round(knob.getBoundingClientRect().width) : 0, desc: !!it.querySelector('small'), n: document.querySelectorAll('.rz-it').length };
      });
      ok(rz && rz.n === 2 && rz.knob >= 30, 'realistic fills are two real switches (knob ' + (rz ? rz.knob : '?') + 'px)');
      ok(rz && rz.caps === 'none' && rz.desc, 'each says what it does, in sentence case');

      ok(p.__err.length === 0, 'no page errors on the desktop terminal' + (p.__err.length ? ': ' + p.__err[0] : ''));
      await p.close();

      // ═══════════════════ PHONE ═══════════════════
      console.log('\n-- phone 390x844');
      p = await open(browser, m, { width: 390, height: 844, isMobile: true, hasTouch: true });
      const ph = await p.evaluate(() => {
        const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        const reach = s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(t && (e.contains(t) || t === e)); };
        const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); if (r.width <= 0) return false; let a = e.parentElement; while (a) { if (/auto|hidden|scroll/.test(getComputedStyle(a).overflowX)) return false; a = a.parentElement; } return r.right > innerWidth + 1; }).length;
        const bd = document.getElementById('ptChPopBd');
        return { chart: R('.ptt-chart'), bar: R('.ptc-bar'), canvas: R('#ptChart'), wide, barReach: reach('.ptc-bar'), symReach: reach('#ptSymBtn'), bdHidden: bd ? bd.hidden : null, bdPaints: bd ? getComputedStyle(bd).display : null };
      });
      ok(ph.chart && ph.chart.x === 0 && ph.chart.w === 390, 'the chart is edge to edge on a phone (' + (ph.chart ? ph.chart.x + '+' + ph.chart.w : '?') + ')');
      ok(ph.bar && ph.bar.h <= 38 && ph.barReach, 'the timeframe strip is there and reachable');
      ok(ph.canvas && ph.canvas.h >= 240, 'the candles keep a usable height (' + (ph.canvas ? ph.canvas.h : '?') + 'px)');
      ok(ph.bdHidden === true && ph.bdPaints === 'none', 'the settings backdrop is NOT painted over the page at rest');
      ok(ph.symReach, 'the pair button is reachable');
      ok(ph.wide === 0, 'nothing runs past a 390px screen (' + ph.wide + ')');

      // the exchange dropdown under a real thumb
      await p.evaluate(() => { if (!document.getElementById('planAdvChk').checked) document.getElementById('ptAdvBtn').click(); });
      await wait(1200);
      const tr = await p.evaluate(() => { const t = document.getElementById('planEx').closest('.csel').querySelector('.csel-trigger'); t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; });
      const read = () => p.evaluate(() => {
        const open = document.querySelector('.csel-panel.csel-sheet:not([hidden])');
        const own = document.getElementById('planEx').closest('.csel').querySelector('.csel-panel');
        const pn = open || own;
        const bar = document.querySelector('.mpbn');
        return { open: !!open, bd: !!document.querySelector('.csel-sheet-bd:not([hidden])'), x: !!(pn && pn.querySelector('.csel-sh-x')), title: pn && pn.querySelector('.csel-sh-h b') ? pn.querySelector('.csel-sh-h b').textContent : '', logos: pn ? pn.querySelectorAll('.cx-m img').length : 0, barDrawn: !!(bar && bar.getBoundingClientRect().height > 0), onScreen: !open ? true : open.getBoundingClientRect().bottom <= innerHeight + 2, locked: document.body.classList.contains('pt-sheet') };
      });
      await p.touchscreen.tap(tr.x, tr.y); await wait(800); const t1 = await read();
      await p.touchscreen.tap(tr.x, tr.y); await wait(800); const t2 = await read();
      await p.touchscreen.tap(tr.x, tr.y); await wait(800); const t3 = await read();
      ok(t1.open, 'ONE TAP OPENS the exchange dropdown on a phone');
      ok(!t2.open, 'the same tap again CLOSES it - it cannot get stuck open');
      ok(t3.open, 'and opens it again');
      ok(t3.bd && t3.x, 'it is a sheet with a backdrop and a close button, not a floating panel with no exit');
      ok(t3.logos >= 9, 'every venue wears its own mark (' + t3.logos + ' logos)');
      ok(/exchange/i.test(t3.title), 'the sheet is titled with the label the reader already saw ("' + t3.title + '")');
      ok(!t3.barDrawn && t3.onScreen, 'the phone bar is NOT DRAWN while it is open and the sheet is wholly on screen');
      ok(t3.locked, 'and the page underneath it cannot scroll');
      await p.evaluate(() => { const x = document.querySelector('.csel-sh-x'); if (x) x.click(); }); await wait(600);
      ok(!(await read()).open, 'the X closes it');
      // ── the market window on a phone: one height, and a price on every row you can see ──────────────────
      await p.evaluate(() => { const x = document.querySelector('.csel-sh-x'); if (x) x.click(); const a = document.getElementById('ptAdvBtn'); if (a && document.getElementById('planAdvChk').checked) a.click(); });
      await wait(600);
      await p.evaluate(() => document.getElementById('ptSymBtn').click()); await wait(2400);
      const hs = [];
      for (const t of ['crypto', 'stock', 'forex', 'metal', 'index']) {
        await p.evaluate((tt) => { const x = document.querySelector('.ptmk-tab[data-mt="' + tt + '"]'); if (x) x.click(); }, t);
        await wait(1400);
        hs.push(await p.evaluate((tt) => {
          const pan = document.querySelector('.ptmk-p'), list = document.getElementById('ptMkList');
          const lr = list.getBoundingClientRect(), bar = document.querySelector('.mpbn');
          const vis = [...list.querySelectorAll('.ptmk-r')].filter(r => { const q = r.getBoundingClientRect(); return q.bottom > lr.top + 2 && q.top < lr.bottom - 2; });
          return {
            tab: tt, h: Math.round(pan.getBoundingClientRect().height),
            vis: vis.length, visPx: vis.filter(r => (r.querySelector('.ptmk-px') || {}).textContent.indexOf('$') >= 0).length,
            barDrawn: !!(bar && bar.getBoundingClientRect().height > 0), onScreen: pan.getBoundingClientRect().bottom <= innerHeight + 2, locked: document.body.classList.contains('pt-sheet'), docH: Math.round(document.documentElement.scrollHeight), innerH: innerHeight
          };
        }, t));
      }
      const hset = [...new Set(hs.map(x => x.h))];
      ok(hset.length === 1, 'THE WINDOW IS ONE HEIGHT whatever group is picked (' + hs.map(x => x.tab + ':' + x.h).join(' ') + ')');
      const noPx = hs.filter(x => x.vis > 0 && x.visPx < x.vis);
      ok(noPx.length === 0, 'every row you can SEE carries a price, on every group (' + hs.map(x => x.tab + ' ' + x.visPx + '/' + x.vis).join(', ') + ')');
      ok(hs.every(x => !x.barDrawn && x.onScreen), 'the phone bar is NOT DRAWN while the window is open and the window is wholly on screen');
      /* THE OWNER'S 2026-10-25 PHOTO: the window adrift over a scrolled page. Nothing left to scroll is the fix,
         and the document's own height is the only honest way to say it. */
      ok(hs.every(x => x.locked && x.docH <= x.innerH + 2), 'and the page underneath has nothing left to scroll (' + hs.map(x => x.docH + '/' + x.innerH).join(' ') + ')');
      // ── THE LAST ROW OF EVERY GROUP IS REACHABLE (owner: "biranje coin-a koji je poslednji na listi svoje
      //    vrste je nemoguce jer se sakrije iza nav bar-a") ──────────────────────────────────────────────────
      const lastRows = [];
      for (const t of ['crypto', 'forex', 'metal', 'index']) {
        await p.evaluate((tt) => { const x = document.querySelector('.ptmk-tab[data-mt="' + tt + '"]'); if (x) x.click(); }, t);
        await wait(800);
        await p.evaluate(() => { const l = document.getElementById('ptMkList'); l.scrollTop = l.scrollHeight; });
        await wait(1100);
        lastRows.push(await p.evaluate((tt) => {
          const rows = [...document.querySelectorAll('.ptmk-r')], last = rows[rows.length - 1];
          if (!last) return { tab: tt, ok: true, sym: '(empty)' };
          const r = last.getBoundingClientRect(), hit = document.elementFromPoint(r.x + 60, r.y + r.height / 2);
          return { tab: tt, sym: last.querySelector('.ptmk-s1').textContent, ok: !!(hit && last.contains(hit)) };
        }, t));
      }
      ok(lastRows.every(x => x.ok), 'the LAST market of every group can be tapped (' + lastRows.map(x => x.tab + ':' + x.sym + (x.ok ? '' : ' UNREACHABLE')).join(' ') + ')');
      await p.evaluate(() => { const x = document.querySelector('.ptmk-x'); if (x) x.click(); }); await wait(500);

      // ── the settings sheet is above the bar, and every option in it answers a tap ─────────────────────────
      await p.evaluate(() => document.getElementById('ptChSet').click()); await wait(900);
      await p.evaluate(() => window.scrollTo(0, 0)); await wait(400);
      const setSheet = await p.evaluate(() => {
        const pop = document.getElementById('ptChPop'), bar = document.querySelector('.mpbn');
        const r = pop.getBoundingClientRect(), br = bar ? bar.getBoundingClientRect() : null;
        const opts = [...pop.querySelectorAll('button')];
        const bad = opts.filter(o => { const q = o.getBoundingClientRect(); const h = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return !(h && o.contains(h)); });
        return { windowed: getComputedStyle(pop).position === 'absolute' && r.width < innerWidth - 8, onScreen: r.top >= 0 && r.bottom <= innerHeight + 2, barDrawn: !!(bar && bar.getBoundingClientRect().height > 0), n: opts.length, bad: bad.map(o => o.textContent.trim()), w: Math.round(r.width), h: Math.round(r.height) };
      });
      /* owner 2026-10-25: "settings tab moze da bude isti kao i kad se otvori ovaj za timeframe, tako manji
         windowed" - a popover hanging off its own button, never a bottom sheet that has to find the bar */
      ok(setSheet.windowed && setSheet.onScreen, 'chart settings is a WINDOW on a phone, not a bottom sheet (' + setSheet.w + 'x' + setSheet.h + ')');
      ok(setSheet.barDrawn, 'and it needs nothing moved out of its way - the phone bar is still drawn beneath it');
      ok(setSheet.n === 8 && setSheet.bad.length === 0, 'and all eight of its options answer a tap' + (setSheet.bad.length ? ' - dead: ' + setSheet.bad.join(', ') : ''));
      await p.evaluate(() => { const bd = document.getElementById('ptChPopBd'); if (bd) bd.click(); }); await wait(400);

      // ── Balance Mode is a row of its own, never a badge over the order type ───────────────────────────────
      const bal = await p.evaluate(async () => {
        try { localStorage.setItem('mp_balmode', JSON.stringify({ on: true, sid: 'e2e', start: Date.now() })); } catch (e) { }
        window.dispatchEvent(new Event('mp-balmode'));
        await new Promise(r => setTimeout(r, 500));
        const n = document.getElementById('mpBalNote'), t = document.getElementById('planType');
        if (!n || n.hidden) return { shown: false };
        const a = n.getBoundingClientRect(), c = t.getBoundingClientRect();
        const over = !(a.right <= c.left || a.left >= c.right || a.bottom <= c.top || a.top >= c.bottom);
        const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
        try { localStorage.removeItem('mp_balmode'); } catch (e) { }
        window.dispatchEvent(new Event('mp-balmode'));
        return { shown: true, over: over, typeOk: !!(hit && t.contains(hit)), pos: getComputedStyle(n).position };
      });
      ok(bal.shown && !bal.over, 'the Balance Mode badge does not print over Market / Limit');
      ok(bal.shown && bal.typeOk && bal.pos === 'static', 'and the order type is still tappable under it (' + bal.pos + ')');

      // ── the non-candle styles must paint, and must not throw out of the library ──────────────────────────
      const before = p.__err.length;
      await p.evaluate(() => document.getElementById('ptChSet').click()); await wait(700);
      await p.evaluate(() => { const x = document.querySelector('#ptChPop [data-chstyle="line"]'); if (x) x.click(); }); await wait(3000);
      await p.evaluate(() => { const bd = document.getElementById('ptChPopBd'); if (bd) bd.click(); }); await wait(400);
      await p.evaluate(() => { const ps = document.getElementById('planSym'); ps.value = 'ETH'; ps.dispatchEvent(new Event('change', { bubbles: true })); });
      await wait(7000);
      const paint = await p.evaluate(() => {
        const d = window.__mpPT(); const host = document.getElementById('ptChart');
        const c = host && host.querySelector('canvas');
        let lit = 0; try { const g = c.getContext('2d'); const a = g.getImageData(0, 0, c.width, Math.min(c.height, 400)).data; for (let i = 3; i < a.length; i += 4 * 97) if (a[i] > 8) lit++; } catch (e) { lit = -1; }
        return { style: window.__mpPtShellDbg().style, bars: d && d.bars ? d.bars.length : 0, lit };
      });
      ok(paint.style === 'line' && paint.bars > 50 && paint.lit > 40, 'the line style still DRAWS after a symbol switch - never a bare dot at the live price (lit ' + paint.lit + ')');
      ok(p.__err.length === before, 'and the hidden candlestick throws nothing out of lightweight-charts' + (p.__err.length > before ? ': ' + p.__err[p.__err.length - 1] : ''));
      await p.evaluate(() => { try { localStorage.setItem('mp_ch_style', 'candles'); } catch (e) { } });

      ok(p.__err.length === 0, 'no page errors on the phone' + (p.__err.length ? ': ' + p.__err[0] : ''));
      await p.close();
    }, { timeoutMs: 235000 });
  } finally { await m.rm(); }
  console.log('\n' + pass + ' ok, ' + fail + ' failed' + (FALSIFY ? '  (falsify run: 3+ failures are the point)' : ''));
  process.exitCode = FALSIFY ? (fail >= 3 ? 0 : 1) : (fail ? 1 : 0);
})();

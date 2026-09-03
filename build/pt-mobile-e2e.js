// pt-mobile-e2e.js — proof for the MOBILE Paper Trade terminal (chart-first layout + order-form bottom sheet, 2026-09-04).
//   node build/pt-mobile-e2e.js            → against production (cache-busted)
//   node build/pt-mobile-e2e.js --local    → production page, but /assets/home.css + home.js served from the working tree
//                                           (Network interception + service worker bypass) = staging without a deploy
// Every UI claim is REACHABILITY (elementFromPoint at the element's centre returns it, in the viewport, in the state the
// user would be in), never mere existence. Screenshots land in build/pt-shots/.
const { withBrowser, newPage } = require('./e2e-browser.js');
const fs = require('fs'), path = require('path');
const LOCAL = process.argv.includes('--local');
const BASE = (process.argv.find(a => a.startsWith('--url=')) || '--url=https://marginpad.io').slice(6);
const OUT = path.join(__dirname, 'pt-shots'); fs.mkdirSync(OUT, { recursive: true });
const ASSETS = path.join(__dirname, '..', 'dist', 'assets');
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = [];
function ok(name, cond, detail) { if (cond) { pass++; console.log('  OK   ' + name); } else { fail++; fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } }

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
async function setup(b, w, h, tag, ua) {
  // fresh browser context per viewport: isolated localStorage (otherwise the 3 trades of the first run trigger
  // the graduation modal / nudges on the next one and the reachability checks measure that popup, not the layout)
  let ctx = null; try { ctx = b.createBrowserContext ? await b.createBrowserContext() : await b.createIncognitoBrowserContext(); } catch (e) { ctx = null; }
  const p = ctx ? await ctx.newPage() : await newPage(b, { mobile: true });
  if (ctx) { await p.setUserAgent(ua || require('./e2e-browser.js').UA_MOBILE); p._ctx = ctx; } else if (ua) await p.setUserAgent(ua);
  await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const cdp = await p.target().createCDPSession();
  await cdp.send('Network.enable'); // the two commands below are silently ignored without it (the 2nd page then got the cached PROD bundle)
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }); // a cached home.js would skip the interception on the 2nd+ page
  if (LOCAL) {
    await p.setRequestInterception(true);
    p.on('request', req => {
      const u = req.url();
      let m = u.match(/\/assets\/(home\.(css|js))(\?|$)/);
      if (m) { const f = path.join(ASSETS, m[1]); return req.respond({ status: 200, contentType: m[2] === 'css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', headers: { 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); }
      req.continue();
    });
  }
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_BLOCKED_BY_CLIENT|net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); }); // 4xx resource lines are server answers (e.g. a klines miss), not page faults — pageerror still catches every thrown exception
  p._errs = errs; p._tag = tag;
  await p.goto(BASE + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^ok$/i.test(x.textContent.trim())); if (b) b.click(); });
  // wait for candles
  for (let i = 0; i < 40; i++) { const n = await p.evaluate(() => { try { return window.__mpPT ? window.__mpPT().bars.length : -1; } catch (e) { return -2; } }); if (n > 0) break; await wait(400); }
  for (let i = 0; i < 6; i++) { const gone = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^ok$/i.test(x.textContent.trim()) && x.getBoundingClientRect().height > 0); if (b) { b.click(); return false; } return true; }); if (gone) break; await wait(400); } // cookie banner (renders late)
  await wait(400);
  return p;
}
const shot = (p, n) => p.screenshot({ path: path.join(OUT, p._tag + '-' + n + '.png') });
// reachability: centre of the element's rect hits the element (or a descendant); rect inside the viewport
async function reach(p, sel, opts) {
  return p.evaluate((sel, opts) => {
    const el = document.querySelector(sel); if (!el) return { ok: false, why: 'missing' };
    const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return { ok: false, why: 'zero size' };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return { ok: false, why: 'outside viewport ' + JSON.stringify({ x: Math.round(cx), y: Math.round(cy) }) };
    const hit = document.elementFromPoint(cx, cy); if (!hit) return { ok: false, why: 'no hit' };
    if (!(hit === el || el.contains(hit))) return { ok: false, why: 'covered by ' + (hit.id ? '#' + hit.id : hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ')[0]) };
    if (opts && opts.aboveNav) { const nav = document.querySelector('.mpbn'); const navTop = (nav && getComputedStyle(nav).display !== 'none') ? nav.getBoundingClientRect().top : innerHeight; if (r.bottom > navTop + 1) return { ok: false, why: 'below the usable edge (bottom ' + Math.round(r.bottom) + ' > ' + Math.round(navTop) + ')' }; }
    return { ok: true, rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } };
  }, sel, opts || null);
}
async function R(p, name, sel, opts) { const r = await reach(p, sel, opts); ok(name, r.ok, r.why); return r; }
async function tap(p, sel) { const r = await reach(p, sel); if (!r.ok) { console.log('  (tap skipped: ' + sel + ' — ' + r.why + ')'); return false; } await p.touchscreen.tap(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2); await wait(450); return true; }
const ev = (p, fn, ...a) => p.evaluate(fn, ...a);

async function phone(b, w, h, tag, full, ua) {
  console.log('\n== ' + tag + ' (' + w + 'x' + h + (ua ? ', Android UA' : ', iPhone UA') + ') ==');
  const p = await setup(b, w, h, tag, ua);
  try {
    const vhInfo = await ev(p, () => ({ ios: document.documentElement.classList.contains('mp-ios'), vh: document.documentElement.style.getPropertyValue('--pts-vh'), bodyH: Math.round(document.body.getBoundingClientRect().height), inner: innerHeight }));
    if (ua) ok('Android UA: pure-CSS height path (no mp-ios, no --pts-vh)', !vhInfo.ios && !vhInfo.vh && vhInfo.bodyH === vhInfo.inner, JSON.stringify(vhInfo));
    else ok('iPhone UA: mp-ios class, body height = 100svh (no JS var)', vhInfo.ios && !vhInfo.vh && vhInfo.bodyH === vhInfo.inner, JSON.stringify(vhInfo));
    for (let i = 0; i < 8; i++) { const t = await ev(p, () => (document.getElementById('ptsCd') || {}).textContent || ''); if (/\d/.test(t)) break; await wait(400); } // the countdown mirror follows tickCd's 1s tick
    const st = await ev(p, () => {
      const c = document.getElementById('ptChart').getBoundingClientRect(), cc = document.querySelector('.ptt-chart').getBoundingClientRect();
      const nav = document.querySelector('.mpbn'), side = document.querySelector('.ptt-side'), sr = document.querySelector('.ptt').getBoundingClientRect();
      return { bars: window.__mpPT().bars.length, built: !!(window.mpPtSheet && window.mpPtSheet.built()), chartH: Math.round(c.height), chartW: Math.round(c.width), chartTop: Math.round(cc.top), navTop: nav ? Math.round(nav.getBoundingClientRect().top) : null, navShown: !!(nav && getComputedStyle(nav).display !== 'none'),
        sideTop: Math.round(side.getBoundingClientRect().top), sideBottom: Math.round(sr.bottom), open: side.getAttribute('aria-expanded'), ptsH: getComputedStyle(document.querySelector('.ptt')).getPropertyValue('--pts-h').trim(), bodyOverflow: getComputedStyle(document.body).overflow, scrollH: document.documentElement.scrollHeight, vh: innerHeight, bar: !!document.querySelector('.pts-bar'), cdText: (document.getElementById('ptsCd') || {}).textContent || '', cdOld: (() => { const e = document.querySelector('#ptChart .pt-cd'); return e ? getComputedStyle(e).display : 'none'; })() };
    });
    console.log('  state', JSON.stringify(st));
    ok('candles rendered', st.bars > 0, 'bars=' + st.bars);
    ok('sheet built', st.built);
    ok('chart full width', st.chartW >= w - 1, 'w=' + st.chartW);
    ok('chart tall (>= 55% of viewport)', st.chartH >= h * 0.55, 'h=' + st.chartH);
    ok('page does not scroll', st.bodyOverflow === 'hidden' && st.scrollH <= st.vh + 1, 'overflow=' + st.bodyOverflow + ' scrollH=' + st.scrollH);
    ok('bottom tab bar hidden on the terminal (owner 2026-09-04)', st.navShown === false);
    ok('sheet docked on the screen edge', st.vh - st.sideBottom >= 0 && st.vh - st.sideBottom <= 2, 'terminalBottom=' + st.sideBottom + ' vh=' + st.vh);
    ok('sheet collapsed by default', st.open === 'false');
    ok('countdown mirrored into the toolbar', /\d/.test(st.cdText), 'text=' + JSON.stringify(st.cdText));
    ok('old in-chart countdown hidden', st.cdOld === 'none', st.cdOld);
    ok('no page/console errors on load', p._errs.length === 0, p._errs.join(' | '));
    await shot(p, '01-default');
    // toolbar chips
    await R(p, 'class select reachable', '.pts-bar .pt2-class');
    await R(p, 'symbol trigger reachable', '.pts-bar .csel-trigger');
    await R(p, 'timeframe button reachable', '.pts-bar #ptTfBtn');
    await R(p, 'countdown chip visible', '#ptsCd');
    // collapsed head
    await R(p, 'Long reachable (collapsed)', '#planSeg button[data-side="long"]', { aboveNav: true });
    await R(p, 'Short reachable (collapsed)', '#planSeg button[data-side="short"]', { aboveNav: true });
    await R(p, 'grab handle reachable', '.pts-grab', { aboveNav: true });
    await R(p, 'Browse action reachable (sheet top row)', '.pts-act[data-mpbn="browse"]', { aboveNav: true });
    await R(p, 'Trades action reachable (sheet top row)', '.pts-act[data-mpbn="trades"]', { aboveNav: true });
    await R(p, 'Chat action reachable (sheet top row)', '.pts-act[data-mpbn="chat"]', { aboveNav: true });
    await R(p, 'live price visible', '#planLivePx', { aboveNav: true });
    const openHidden = await reach(p, '#planSave');
    ok('Open button hidden while collapsed', !openHidden.ok, JSON.stringify(openHidden));
    if (!full) { // small/big phone: just the core open flow
      await tap(p, '#planSeg button[data-side="long"]'); await wait(400);
      await R(p, 'Open reachable after tapping Long', '#planSave', { aboveNav: true });
      await R(p, 'Amount reachable', '#planAmt', { aboveNav: true });
      await shot(p, '02-open');
      ok('no errors', p._errs.length === 0, p._errs.join(' | '));
      return;
    }
    // --- expand via Long ---
    await tap(p, '#planSeg button[data-side="long"]'); await wait(400);
    ok('sheet opens on Long', await ev(p, () => window.mpPtSheet.isOpen()));
    await R(p, 'Amount reachable (open)', '#planAmt', { aboveNav: true });
    await R(p, 'Leverage reachable (open)', '#planLev', { aboveNav: true });
    await R(p, 'Leverage slider reachable (open)', '#planLevR', { aboveNav: true });
    await R(p, 'Advanced toggle reachable (open)', '.lev-row .adv-toggle', { aboveNav: true });
    await R(p, 'Open button reachable (open)', '#planSave', { aboveNav: true });
    await R(p, 'stats visible (open)', '.ptt-stats', { aboveNav: true });
    const chartOpen = await ev(p, () => { const d = document.querySelector('.ptt'); const cs = getComputedStyle(d, '::after'); return { dim: cs.opacity, chartH: Math.round(document.getElementById('ptChart').getBoundingClientRect().height) }; });
    ok('chart keeps its size while the sheet is open (no reflow)', chartOpen.chartH === st.chartH, JSON.stringify(chartOpen));
    ok('dim overlay visible while open', +chartOpen.dim > 0.4, 'opacity=' + chartOpen.dim);
    await shot(p, '02-open');
    // --- collapse via the dim ---
    await p.touchscreen.tap(Math.round(w / 2), Math.round(st.chartTop + 120)); await wait(450);
    ok('tap on the dim collapses', !(await ev(p, () => window.mpPtSheet.isOpen())));
    // --- grab toggles ---
    await tap(p, '.pts-grab'); ok('grab opens', await ev(p, () => window.mpPtSheet.isOpen()));
    await tap(p, '.pts-grab'); ok('grab closes', !(await ev(p, () => window.mpPtSheet.isOpen())));
    // --- open a trade ---
    await tap(p, '#planSeg button[data-side="long"]'); await wait(300);
    await tap(p, '#planSave'); await wait(1600);
    const after1 = await ev(p, () => { const t = document.querySelector('#ptLastTrade .pt-last'); const z = document.querySelectorAll('.ptt-zones .zone').length; return { open: window.mpPtSheet.isOpen(), strip: !!t && t.getBoundingClientRect().height > 0, stripH: t ? Math.round(t.getBoundingClientRect().height) : 0, zones: z, ptsH: getComputedStyle(document.querySelector('.ptt')).getPropertyValue('--pts-h').trim(), chartH: Math.round(document.getElementById('ptChart').getBoundingClientRect().height) }; });
    console.log('  after open', JSON.stringify(after1));
    ok('sheet collapses after a successful open', after1.open === false);
    ok('position strip appears', after1.strip);
    ok('strip is a single compact row (< 64px)', after1.stripH > 0 && after1.stripH < 64, 'h=' + after1.stripH);
    ok('liq zone drawn on the chart', after1.zones > 0);
    ok('chart shrank to make room for the strip', after1.chartH < st.chartH, after1.chartH + ' vs ' + st.chartH);
    await R(p, 'CLOSE reachable on the strip', '#ptLastTrade .pt-last:first-child .ptl-close', { aboveNav: true });
    await R(p, 'Long still reachable with a strip', '#planSeg button[data-side="long"]', { aboveNav: true });
    await shot(p, '03-position');
    // --- two more trades → +2 badge, single strip, Open still reachable ---
    for (let i = 0; i < 2; i++) { await tap(p, '#planSeg button[data-side="long"]'); await wait(250); await tap(p, '#planSave'); await wait(1500); }
    const after3 = await ev(p, () => ({ more: document.getElementById('ptLastTrade').getAttribute('data-more'), visible: [...document.querySelectorAll('#ptLastTrade .pt-last')].filter(e => e.getBoundingClientRect().height > 0).length, open: window.mpPtSheet.isOpen() }));
    console.log('  after 3', JSON.stringify(after3));
    ok('"+2" badge for the other open positions', after3.more === '+2', after3.more);
    ok('only one strip visible', after3.visible === 1, 'visible=' + after3.visible);
    await tap(p, '#planSeg button[data-side="long"]'); await wait(400);
    await R(p, 'Open reachable with 3 positions (open)', '#planSave', { aboveNav: true });
    await shot(p, '04-three-open');
    await p.touchscreen.tap(Math.round(w / 2), Math.round(st.chartTop + 120)); await wait(400);
    // --- recent rail inside the toolbar row, not intersecting the chip ---
    const railInfo = await ev(p, () => { const r = document.getElementById('ptRecent'), c = document.querySelector('.pts-bar .ptt-chart-top'); if (!r || r.hidden) return { hidden: true }; const rr = r.getBoundingClientRect(), cr = c.getBoundingClientRect(); const b = r.querySelector('.ptr-b'); const br = b && b.getBoundingClientRect(); return { inBar: !!r.closest('.pts-bar'), overlap: !(rr.left >= cr.right - 1 || rr.right <= cr.left + 1), badges: r.querySelectorAll('.ptr-b').length, badgeInBar: br ? (br.top >= cr.top - 6 && br.bottom <= cr.bottom + 6) : false }; });
    console.log('  rail', JSON.stringify(railInfo));
    ok('recent rail lives in the toolbar row', railInfo.inBar === true);
    ok('rail does not overlap the symbol chip', railInfo.overlap === false);
    await R(p, 'rail badge reachable', '#ptRecent .ptr-b');
    // --- strip tap → My Trades drawer ---
    await tap(p, '#ptLastTrade .pt-last:first-child .ptl-top'); await wait(700);
    ok('strip tap opens My Trades', await ev(p, () => { const d = document.getElementById('jrDrawer'); return !!d && !d.hidden; }));
    await shot(p, '05-drawer');
    await ev(p, () => { const x = document.querySelector('#jrDrawer .jr-x'); if (x) x.click(); }); await wait(600);
    ok('drawer closed', await ev(p, () => document.getElementById('jrDrawer').hidden));
    // --- CLOSE on the strip → close sheet → confirm ---
    await tap(p, '#ptLastTrade .pt-last:first-child .ptl-close'); await wait(600);
    ok('close sheet opens from the strip', await ev(p, () => !!document.querySelector('.mpcs.on')));
    await shot(p, '06-close-sheet');
    const closed = await ev(p, () => { const s = document.querySelector('.mpcs.on'); if (!s) return 'no sheet'; const btns = [...s.querySelectorAll('button')]; const b = btns.find(x => /^close\b|close position|close 100|confirm/i.test(x.textContent.trim())) || btns.find(x => /close/i.test(x.textContent)); if (!b) return 'no button: ' + btns.map(x => x.textContent.trim()).join('|'); b.click(); return 'clicked ' + b.textContent.trim(); });
    console.log('  close click', closed); await wait(1400);
    const afterClose = await ev(p, () => ({ more: document.getElementById('ptLastTrade').getAttribute('data-more'), open: JSON.parse(localStorage.getItem('mp_journal') || '[]').filter(e => e.status === 'open').length, sheet: !!document.querySelector('.mpcs.on'), nudge: (() => { const g = document.getElementById('mpGn'); if (!g) return null; const r = g.getBoundingClientRect(), s = document.querySelector('.ptt-side').getBoundingClientRect(); return { bottom: Math.round(r.bottom), sheetTop: Math.round(s.top), clear: r.bottom <= s.top + 1 }; })() }));
    console.log('  after close', JSON.stringify(afterClose));
    ok('position closed (2 open left)', afterClose.open === 2, 'open=' + afterClose.open);
    ok('badge updated to +1', afterClose.more === '+1', afterClose.more);
    if (afterClose.nudge) ok('guest nudge sits above the sheet', afterClose.nudge.clear, JSON.stringify(afterClose.nudge));
    await shot(p, '07-after-close');
    // --- timeframe menu ---
    await tap(p, '#ptTfBtn'); await wait(300);
    await R(p, 'TF menu item reachable (15m)', '#ptTf button[data-tf="15"]');
    await shot(p, '08-tf-menu');
    const barsBefore = await ev(p, () => window.__mpPT().bars.length);
    await tap(p, '#ptTf button[data-tf="15"]'); await wait(2500);
    const tf = await ev(p, () => ({ tf: window.__mpPT().tf, cur: document.getElementById('ptTfCur').textContent, cd: document.getElementById('ptsCd').textContent, bars: window.__mpPT().bars.length }));
    ok('TF switch applied (15m)', tf.tf === '15' && /15m/.test(tf.cur), JSON.stringify(tf));
    ok('countdown follows the new TF', /\d/.test(tf.cd), tf.cd);
    // --- symbol picker ---
    await tap(p, '.pts-bar .csel-trigger'); await wait(350);
    await R(p, 'symbol search reachable', '.csel-panel:not([hidden]) .csel-search');
    await R(p, 'symbol option reachable', '.csel-panel:not([hidden]) .csel-opt');
    await shot(p, '09-symbol');
    await p.keyboard.press('Escape'); await wait(300);
    await ev(p, () => { const t = document.querySelector('.pts-bar .csel-trigger.open'); if (t) t.click(); }); await wait(300);
    // --- Balance Mode tag lives in the Advanced row, never in the price row ---
    await ev(p, () => { localStorage.setItem('mp_balmode', JSON.stringify({ on: true, ts: Date.now() })); window.dispatchEvent(new Event('mp-balmode')); }); await wait(300);
    await tap(p, '.pts-grab'); await wait(400);
    const bal = await ev(p, () => { const n = document.getElementById('mpBalNote'); if (!n) return { missing: true }; const r = n.getBoundingClientRect(), px = document.getElementById('planLivePx').getBoundingClientRect(), adv = document.querySelector('.lev-row .adv-toggle').getBoundingClientRect(); return { inLevRow: !!n.closest('.lev-row'), hidden: n.hidden, sameRowAsAdvanced: Math.abs((r.top + r.height / 2) - (adv.top + adv.height / 2)) < 12, rightOfAdvanced: r.left > adv.right, clearOfPrice: r.top >= px.bottom || r.bottom <= px.top || r.left >= px.right }; });
    ok('Balance Mode tag sits in the Advanced row, right of the checkbox, clear of the price', bal.inLevRow && !bal.hidden && bal.sameRowAsAdvanced && bal.rightOfAdvanced && bal.clearOfPrice, JSON.stringify(bal));
    await R(p, 'Balance Mode tag visible in the open sheet', '#mpBalNote', { aboveNav: true });
    await shot(p, '09b-balance');
    await ev(p, () => { localStorage.removeItem('mp_balmode'); window.dispatchEvent(new Event('mp-balmode')); }); await p.keyboard.press('Escape'); await wait(400);
    // --- signed-in simulation: Advanced + SL/TP fields inside the sheet ---
    await ev(p, () => { window.mpAuth = window.mpAuth || {}; window.mpAuth.me = function () { return { id: 'e2e-sim', name: 'e2e' }; }; document.dispatchEvent(new Event('mp:auth')); });
    await wait(300);
    const gate = await ev(p, () => ({ disabled: document.getElementById('planAdvChk').disabled, note: !!document.getElementById('advGateNote') }));
    ok('Advanced unlocked for a signed-in user', gate.disabled === false && !gate.note, JSON.stringify(gate));
    await tap(p, '.pts-grab'); await wait(300);
    await tap(p, '.lev-row .adv-toggle'); await wait(500);
    ok('Advanced panel opens', await ev(p, () => document.getElementById('planAdvChk').checked && !document.getElementById('planAdvIn').hidden));
    await ev(p, () => document.getElementById('planSlOpt').scrollIntoView({ block: 'center' })); await wait(300);
    await R(p, 'Stop-loss field reachable (scrolled sheet)', '#planSlOpt', { aboveNav: true });
    await ev(p, () => document.getElementById('planSave').scrollIntoView({ block: 'end' })); await wait(300);
    await R(p, 'Open reachable at the bottom of the scrolled sheet', '#planSave', { aboveNav: true });
    await shot(p, '10-advanced');
    await p.keyboard.press('Escape'); await wait(400);
    ok('Escape collapses', !(await ev(p, () => window.mpPtSheet.isOpen())));
    // --- sheet top row actions: chat, browse, trades (replace the hidden bottom tab bar) ---
    await tap(p, '.pts-act[data-mpbn="chat"]'); await wait(900);
    ok('Chat opens from the sheet action', await ev(p, () => { const c = document.getElementById('chatBox'); return !!c && !c.hidden && c.getBoundingClientRect().height > 200; }));
    await shot(p, '11-chat');
    await ev(p, () => { const x = document.getElementById('ctClose'); if (x) x.click(); }); await wait(500);
    await tap(p, '.pts-act[data-mpbn="browse"]'); await wait(700);
    ok('Browse opens from the sheet action', await ev(p, () => { const n = document.querySelector('.mpnav'); return !!n && !n.hidden; }));
    await shot(p, '12-browse');
    await ev(p, () => { const x = document.querySelector('.mpnav-x'); if (x) x.click(); }); await wait(500);
    await tap(p, '.pts-act[data-mpbn="trades"]'); await wait(800);
    ok('Trades opens from the sheet action', await ev(p, () => { const d = document.getElementById('jrDrawer'); return !!d && !d.hidden; }));
    await ev(p, () => { const x = document.querySelector('#jrDrawer .jr-x'); if (x) x.click(); }); await wait(500);
    const dot = await ev(p, () => { const src = document.querySelector('.mpbn [data-mpbn="chat"]'); if (!src) return 'no src'; src.classList.add('ct-alert'); return 'set'; }); await wait(1300);
    ok('unread-chat dot mirrored onto the sheet action', await ev(p, () => document.querySelector('.pts-act[data-mpbn="chat"]').classList.contains('ct-alert')), dot);
    await ev(p, () => { const src = document.querySelector('.mpbn [data-mpbn="chat"]'); if (src) src.classList.remove('ct-alert'); });
    // --- guest nudge card (mp-auth) must clear the collapsed sheet: replay mp-auth's own stylesheet on a stand-in card ---
    const nudge = await ev(p, () => { const s = document.createElement('style'); s.textContent = '#mpGn{position:fixed;right:18px;bottom:18px;z-index:1450;width:min(340px,calc(100vw - 24px));background:#0e1116;border:1px solid rgba(194,246,74,.55);border-radius:14px;padding:14px 16px}@media(max-width:640px){#mpGn{right:12px;left:12px;bottom:76px;width:auto}}'; document.head.appendChild(s); const g = document.createElement('div'); g.id = 'mpGn'; g.textContent = 'stand-in'; document.body.appendChild(g); const r = g.getBoundingClientRect(), t = document.querySelector('.ptt-side').getBoundingClientRect(); const out = { cardBottom: Math.round(r.bottom), sheetTop: Math.round(t.top), clear: r.bottom <= t.top + 1 }; g.remove(); s.remove(); return out; });
    ok('guest nudge card would sit above the sheet', nudge.clear, JSON.stringify(nudge));
    // --- route switch inside the app shell: away to Calculators and back ---
    await ev(p, () => window.mpGo('/calculators')); await wait(900);
    const calc = await ev(p, () => ({ paper: document.body.classList.contains('paper-page'), overflow: getComputedStyle(document.body).overflow, display: getComputedStyle(document.body).display, scrollable: document.documentElement.scrollHeight > innerHeight }));
    ok('Calculators route drops the fit-screen layout (page scrolls again)', !calc.paper && calc.overflow !== 'hidden' && calc.scrollable, JSON.stringify(calc));
    await ev(p, () => window.mpGo('/paper-trade')); await wait(1200);
    const back = await ev(p, () => ({ paper: document.body.classList.contains('paper-page'), built: window.mpPtSheet.built(), chartH: Math.round(document.getElementById('ptChart').getBoundingClientRect().height), open: window.mpPtSheet.isOpen(), bars: window.__mpPT().bars.length }));
    ok('back on Paper Trade: fit-screen + sheet restored', back.paper && back.built && back.chartH > 380 && !back.open && back.bars > 0, JSON.stringify(back));
    await R(p, 'Long reachable after the round trip', '#planSeg button[data-side="long"]', { aboveNav: true });
    // --- rotation / resize across the 720px boundary: everything moves back, then rebuilds ---
    await p.setViewport({ width: 900, height: 600, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await wait(700);
    const wide = await ev(p, () => ({ built: window.mpPtSheet.built(), bar: !!document.querySelector('.pts-bar'), topParent: document.querySelector('.ptt-chart-top').parentNode.className, railPrev: (document.getElementById('ptRecent') || {}).previousElementSibling && document.getElementById('ptRecent').previousElementSibling.className, sidePos: getComputedStyle(document.querySelector('.ptt-side')).position, grab: !!document.querySelector('.pts-grab'), cd: !!document.getElementById('ptsCd') }));
    ok('above 720px: toolbar/rail moved back, sheet gone', !wide.built && !wide.bar && /ptt-chart/.test(wide.topParent) && wide.sidePos !== 'absolute' && !wide.grab && !wide.cd, JSON.stringify(wide));
    await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await wait(700);
    const narrow = await ev(p, () => ({ built: window.mpPtSheet.built(), bar: !!document.querySelector('.pts-bar'), chartH: Math.round(document.getElementById('ptChart').getBoundingClientRect().height), cd: (document.getElementById('ptsCd') || {}).textContent }));
    ok('back under 720px: rebuilt', narrow.built && narrow.bar && narrow.chartH > 380, JSON.stringify(narrow));
    await R(p, 'Long reachable after rotation', '#planSeg button[data-side="long"]', { aboveNav: true });
    ok('no page/console errors during the flow', p._errs.length === 0, p._errs.join(' | '));
  } finally { await p.close(); if (p._ctx) { try { await p._ctx.close(); } catch (e) {} } }
}

async function landscape(b) {
  console.log('\n== landscape 844x390 (legacy stacked layout expected) ==');
  const p = await setup(b, 844, 390, 'land');
  try {
    const st = await ev(p, () => ({ built: !!(window.mpPtSheet && window.mpPtSheet.built()), pos: getComputedStyle(document.querySelector('.ptt-side')).position, overflow: getComputedStyle(document.body).overflow, bar: !!document.querySelector('.pts-bar'), bars: window.__mpPT().bars.length, cd: (document.getElementById('ptsCd') || {}).textContent }));
    console.log('  state', JSON.stringify(st));
    ok('candles rendered', st.bars > 0);
    ok('no sheet in landscape (form in normal flow)', st.pos !== 'absolute', st.pos);
    ok('page scrolls in landscape', st.overflow !== 'hidden', st.overflow);
    ok('nothing built at 844px wide (legacy layout, same as a tablet)', !st.built && !st.bar);
    await ev(p, () => document.getElementById('planSave').scrollIntoView({ block: 'center' })); await wait(400);
    await R(p, 'Open reachable after scrolling', '#planSave');
    await shot(p, '01');
    ok('no errors', p._errs.length === 0, p._errs.join(' | '));
  } finally { await p.close(); if (p._ctx) { try { await p._ctx.close(); } catch (e) {} } }
}
async function tablet(b) {
  console.log('\n== tablet 768x1024 (untouched) ==');
  const p = await setup(b, 768, 1024, 'tab');
  try {
    const st = await ev(p, () => ({ built: !!(window.mpPtSheet && window.mpPtSheet.built()), bar: !!document.querySelector('.pts-bar'), pos: getComputedStyle(document.querySelector('.ptt-side')).position, top: getComputedStyle(document.querySelector('.ptt-chart-top')).position, bars: window.__mpPT().bars.length }));
    console.log('  state', JSON.stringify(st));
    ok('nothing built above 720px', !st.built && !st.bar && st.pos === 'static' && st.top === 'absolute', JSON.stringify(st));
    ok('candles rendered', st.bars > 0);
    await shot(p, '01');
    ok('no errors', p._errs.length === 0, p._errs.join(' | '));
  } finally { await p.close(); if (p._ctx) { try { await p._ctx.close(); } catch (e) {} } }
}

async function desktop(b) {
  console.log('\n== desktop 1366x768 (regression: untouched) ==');
  const p = await setup(b, 1366, 768, 'desk');
  try {
    await p.setUserAgent(require('./e2e-browser.js').UA_DESKTOP); await p.setViewport({ width: 1366, height: 768, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await p.reload({ waitUntil: 'networkidle2' }); await wait(2500);
    const st = await ev(p, () => { const c = document.getElementById('ptChart').getBoundingClientRect(); return { built: !!(window.mpPtSheet && window.mpPtSheet.built()), bar: !!document.querySelector('.pts-bar'), top: getComputedStyle(document.querySelector('.ptt-chart-top')).position, chart: { x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.width), h: Math.round(c.height) }, cd: !!document.querySelector('#ptChart .pt-cd'), cdShown: (() => { const e = document.querySelector('#ptChart .pt-cd'); return e ? getComputedStyle(e).display : 'none'; })(), overflow: getComputedStyle(document.body).overflow, bars: window.__mpPT().bars.length }; });
    console.log('  state', JSON.stringify(st));
    ok('desktop: nothing built, floating toolbar kept', !st.built && !st.bar && st.top === 'absolute');
    ok('desktop: chart geometry unchanged (2026-09-03 baseline 922x654; y shifts only with the cookie bar)', Math.abs(st.chart.w - 922) <= 2 && Math.abs(st.chart.h - 654) <= 2 && st.chart.x === 38, JSON.stringify(st.chart));
    ok('desktop: in-chart countdown still shown', st.cdShown !== 'none');
    ok('desktop: fit-screen (overflow hidden) as before', st.overflow === 'hidden');
    await shot(p, '01');
    ok('no errors', p._errs.length === 0, p._errs.join(' | '));
  } finally { await p.close(); if (p._ctx) { try { await p._ctx.close(); } catch (e) {} } }
}

(async () => {
  const t0 = Date.now();
  await withBrowser(async (b) => {
    await phone(b, 390, 844, 'p390', true);
    await phone(b, 360, 740, 'p360', false, UA_ANDROID);
    await phone(b, 430, 932, 'p430', false);
    await landscape(b);
    await tablet(b);
    await desktop(b);
  }, { timeoutMs: 560000 });
  console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + ' ok, ' + fail + ' failed, ' + Math.round((Date.now() - t0) / 1000) + 's' + (LOCAL ? ' (local assets)' : ''));
  if (fails.length) console.log(fails.map(f => ' - ' + f).join('\n'));
  process.exit(fail ? 1 : 0);
})();

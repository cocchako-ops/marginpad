// Limit orders E2E (2026-09-05). An order is a LEVEL, not a side: below the market it is a classic limit, above it
// a breakout entry ("buy IF it gets to 83.80"). Both must fill, and both must fill AT the level.
//   SERVER - place / list / cancel, the refusals that remain (wrong-side SL/TP, absurd price, one-way mode), and
//   DETERMINISTIC fills in both directions: /api/admin/porders?run=1&px=SYM:price injects the price the fill engine
//   sees, so the exact fill math is proven without waiting for the market to move.
//   BROWSER - the Paper Trade terminal at 390px, the /charts quick trade and the mobile chart window: the
//   Market|Limit switch is reachable, the limit field appears, the hint states which way the market must move, a
//   guest order is placed, shows in My Trades > Orders, and cancels.
const fs = require('fs');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const UID = 'lim' + Date.now().toString(36).slice(-5);
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 190) : ''));
const near = (a, b, tol) => Math.abs(+a - +b) <= (tol == null ? 1e-6 : tol);

async function trade(path, body) {
  const u = ORIGIN + '/api/trade' + path + (path.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID;
  const r = await fetch(u, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const admin = async (p) => (await fetch(ORIGIN + p, { headers: { 'x-admin-key': K } })).json();

(async () => {
  const px = (await (await fetch(ORIGIN + '/api/price?symbol=BTC')).json()).price;
  chk('live BTC price available', px > 0, { px });

  // ── refusals ───────────────────────────────────────────────────────────────────────────────────────────────
  // A LEVEL, NOT A SIDE (owner correction): a buy ABOVE the market is a breakout entry and must be accepted.
  let r = await trade('/order', { action: 'add', sym: 'BTC', side: 'long', px: Math.round(px * 1.05), lev: 10, margin: 100 });
  chk('buy ABOVE the market accepted (breakout entry)', r.status === 200 && r.body.ok && r.body.order.dir === 'up', r.body.order || r.body);
  const upId = r.body.order && r.body.order.id;
  r = await trade('/order', { action: 'add', sym: 'ETH', side: 'short', px: Math.round((await (await fetch(ORIGIN + '/api/price?symbol=ETH')).json()).price * 0.95), lev: 10, margin: 100 });
  chk('sell BELOW the market accepted (breakdown entry)', r.status === 200 && r.body.ok && r.body.order.dir === 'down', r.body.order || r.body);
  const dnId = r.body.order && r.body.order.id;
  r = await trade('/order', { action: 'add', sym: 'BTC', side: 'long', px: Math.round(px / 100), lev: 10, margin: 100 });
  chk('absurd price refused (decimal-point guard)', r.status === 400 && r.body.error === 'price_far', r.body);
  r = await trade('/order', { action: 'add', sym: 'BTC', side: 'long', px: Math.round(px * 0.9), lev: 10, margin: 100, sl: Math.round(px * 0.95) });
  chk('stop-loss above a limit long refused', r.status === 400 && r.body.error === 'sl_wrong_side', r.body);
  r = await trade('/order', { action: 'add', sym: 'BTC', side: 'long', px: Math.round(px * 0.9), lev: 10, margin: 100, tp: Math.round(px * 0.85) });
  chk('take-profit below a limit long refused', r.status === 400 && r.body.error === 'tp_wrong_side', r.body);
  r = await trade('/order', { action: 'add', sym: 'BTC', side: 'long', px: Math.round(px * 0.9), lev: 10, margin: 0.5 });
  chk('margin under $1 refused', r.status === 400 && r.body.error === 'margin_min_1', r.body);
  r = await trade('/order', { action: 'add', sym: 'ZZZZNOPE', side: 'long', px: 1, lev: 10, margin: 100 });
  chk('unknown symbol refused', r.status === 404, r.body);

  // ── place ──────────────────────────────────────────────────────────────────────────────────────────────────
  const LIMIT = Math.round(px * 0.9), LEV = 10, MARGIN = 100;
  r = await trade('/order', { action: 'add', sym: 'BTC', side: 'long', px: LIMIT, lev: LEV, margin: MARGIN, sl: Math.round(px * 0.85), tp: Math.round(px * 0.95) });
  chk('limit long placed below the market', r.status === 200 && r.body.ok && r.body.order && r.body.order.status === 'open', r.body.order || r.body);
  const oid = r.body.order && r.body.order.id;
  chk('order stored with the exact price, side, leverage and margin', r.body.order && near(r.body.order.px, LIMIT) && r.body.order.side === 'long' && r.body.order.lev === LEV && near(r.body.order.margin, MARGIN), r.body.order);
  chk('order expires (GTC with a 30-day limit)', r.body.order && r.body.order.expTs > Date.now() + 25 * 86400000, r.body.order && { expTs: r.body.order.expTs });

  const far = await trade('/order', { action: 'add', sym: 'ETH', side: 'short', px: 0, lev: 5, margin: 50 });
  chk('missing price refused', far.status === 400 && far.body.error === 'price_required', far.body);

  let l = await trade('/orders');
  chk('order appears in the list', (l.body.orders || []).some(o => o.id === oid), { n: (l.body.orders || []).length });
  chk('a level below the market is stamped dir=down', (l.body.orders || []).filter(o => o.id === oid)[0].dir === 'down', { dir: (l.body.orders || []).filter(o => o.id === oid)[0].dir });

  // An UPWARD level must fill when the market RISES through it - the case the first cut refused outright.
  const upCross = Math.round(px * 1.08); // above the order's own level (px*1.05): the market travelled through it
  const runUp = await admin('/api/admin/porders?run=1&nokl=1&uid=' + UID + '&px=BTC:' + upCross);
  const upFill = (runUp.filled || []).filter(f => f.id === upId)[0];
  chk('breakout order fills when the market rises through the level', !!upFill, runUp.filled);
  chk('breakout fill lands AT the level, not at the crossing price', upFill && near(upFill.px, Math.round(px * 1.05)) && !near(upFill.px, upCross), upFill && { got: upFill && upFill.px, level: Math.round(px * 1.05), cross: upCross });
  chk('the downward order was NOT touched by an upward move', !(runUp.filled || []).some(f => f.id === dnId), runUp.filled);
  { const c = await trade('/close', { id: upFill && upFill.tid }); chk('breakout position closed for cleanup', !c.body || !c.body.error || c.body.error === 'already_closed', c.body && (c.body.error || 'ok')); }
  await trade('/order', { action: 'cancel', id: dnId });

  // ── the fill: an injected price that crosses, and NOTHING else changed ──────────────────────────────────────
  const before = await admin('/api/admin/journal?uid=' + UID);
  const nBefore = ((before && before.journal) || []).length;
  // A price far below the limit: a real fill must still land at the LIMIT price, never at the crossing price.
  const CROSS = Math.round(LIMIT * 0.97);
  const run = await admin('/api/admin/porders?run=1&nokl=1&uid=' + UID + '&px=BTC:' + CROSS);
  chk('fill engine ran on this account', run && run.ran, { checked: run && run.checked, filled: (run.filled || []).length });
  const fill = (run.filled || []).filter(f => f.id === oid)[0];
  chk('the crossed order filled', !!fill, run.filled);
  chk('filled AT the limit price, not at the crossing price', fill && near(fill.px, LIMIT) && !near(fill.px, CROSS), fill && { got: fill.px, limit: LIMIT, cross: CROSS });

  const after = await admin('/api/admin/journal?uid=' + UID);
  const jn = (after && after.journal) || [];
  chk('exactly one position was created', jn.length === nBefore + 1, { before: nBefore, after: jn.length });
  const pos = jn.filter(t => t && t.ord === oid)[0];
  chk('position is linked back to its order', !!pos, jn.map(t => t && t.id));
  if (pos) {
    const rate = pos.feeRate || 0;
    chk('entry = the limit price', near(pos.entry, LIMIT), { entry: pos.entry });
    chk('qty = margin x leverage / limit price', near(pos.qty, MARGIN * LEV / LIMIT, 1e-6), { qty: pos.qty, want: MARGIN * LEV / LIMIT });
    chk('notional = margin x leverage', near(pos.notional, MARGIN * LEV, 0.01), { notional: pos.notional });
    // 2026-09-09: a fill stores the margin the trader COMMITTED. It used to store margin - feeOpen while the close still
    // charged both legs, so the entry leg was counted twice by everything reading margin (ROE denominator, equity).
    // feeOpen still reports the entry leg for the ticket's cost breakdown. See build/close-net-e2e.js.
    chk('margin is what the trader committed, with the entry leg reported separately as feeOpen', near(pos.margin, MARGIN, 0.01) && near(pos.feeOpen, MARGIN * LEV * rate, 0.01), { margin: pos.margin, feeOpen: pos.feeOpen, rate });
    chk('liquidation sits below a long entry', pos.liq > 0 && pos.liq < pos.entry, { liq: pos.liq, entry: pos.entry });
    chk('SL/TP carried over from the order', pos.stop != null && pos.tp != null && pos.stop < pos.entry && pos.tp > pos.entry, { sl: pos.stop, tp: pos.tp });
    chk('server-owned position (srv id + src)', String(pos.id).slice(0, 3) === 'srv' && pos.src === 'srv', { id: pos.id, src: pos.src });
    chk('SL/TP watchdog starts at the fill, not at "now"', near(pos.swT, pos.ts, 5), { swT: pos.swT, ts: pos.ts });
  }

  // ── a second run must not fill it again ────────────────────────────────────────────────────────────────────
  const run2 = await admin('/api/admin/porders?run=1&nokl=1&uid=' + UID + '&px=BTC:' + CROSS);
  chk('re-running the engine creates no second position', (run2.filled || []).length === 0, run2.filled);
  const after2 = await admin('/api/admin/journal?uid=' + UID);
  chk('journal still holds exactly one position', ((after2 && after2.journal) || []).length === nBefore + 1, { n: ((after2 && after2.journal) || []).length });
  l = await trade('/orders');
  chk('filled order left the open list and carries its position id', !(l.body.orders || []).some(o => o.id === oid) && (l.body.done || []).some(o => o.id === oid && o.status === 'filled' && o.tid === (pos && pos.id)), { done: (l.body.done || []).map(o => o.status) });

  // ── one-way mode: the account now holds a LONG BTC, so a limit SHORT on BTC must be refused ────────────────
  r = await trade('/order', { action: 'add', sym: 'BTC', side: 'short', px: Math.round(px * 1.1), lev: 10, margin: 100 });
  chk('one-way mode blocks an opposite-side order', r.status === 409 && r.body.error === 'opposite_open', r.body);

  // ── the real candle path (no injected price): an order well below the market must NOT fill ─────────────────
  const eth = (await (await fetch(ORIGIN + '/api/price?symbol=ETH')).json()).price;
  r = await trade('/order', { action: 'add', sym: 'ETH', side: 'long', px: +(eth * 0.5).toFixed(2), lev: 5, margin: 25 });
  const far2 = r.body.order && r.body.order.id;
  chk('a far-below order rests', !!far2, r.body);
  const runK = await admin('/api/admin/porders?run=1&uid=' + UID); // real prices AND real 1m candles this time
  chk('candle+price sweep leaves an uncrossed order alone', (runK.filled || []).length === 0 && runK.checked >= 1, { checked: runK.checked, filled: runK.filled });
  l = await trade('/orders');
  const still = (l.body.orders || []).filter(o => o.id === far2)[0];
  chk('the untouched order advanced its candle watermark instead of rescanning', still && still.swT > still.ts - 1, still && { ts: still.ts, swT: still.swT });

  // ── cancel ────────────────────────────────────────────────────────────────────────────────────────────────
  r = await trade('/order', { action: 'cancel', id: far2 });
  chk('cancelled', r.status === 200 && r.body.ok, r.body);
  r = await trade('/order', { action: 'cancel', id: far2 });
  chk('cancelling twice is refused, never silently "ok"', r.status === 409 && r.body.error === 'already_done', r.body);
  r = await trade('/order', { action: 'cancel', id: 'lo-does-not-exist' });
  chk('cancelling an unknown order 404s', r.status === 404, r.body);

  // ── the Bot API surface ───────────────────────────────────────────────────────────────────────────────────
  const noKey = await (await fetch(ORIGIN + '/api/bot/v1/orders')).json().catch(() => ({}));
  chk('Bot API /orders needs a key', !!(noKey && noKey.error), noKey);

  // ── BROWSER: the terminal at 390px, as a guest ────────────────────────────────────────────────────────────
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
    await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
    await new Promise(r => setTimeout(r, 6000)); // let the live price arrive - the wrong-side hint needs it

    // REACHABILITY, not existence: elementFromPoint at the centre, in the default page state, no scrolling tricks.
    const sw = await page.evaluate(() => {
      const b = document.querySelector('#planType button[data-otype="limit"]');
      if (!b) return { found: false };
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { found: true, reachable: !!h && (h === b || b.contains(h) || b.contains(h.parentNode)), label: b.textContent.trim() };
    });
    chk('browser: the Limit switch exists and is reachable at 390px', sw.found && sw.reachable, sw);

    await page.evaluate(() => document.querySelector('#planType button[data-otype="limit"]').click());
    await new Promise(r => setTimeout(r, 600));
    const on = await page.evaluate(() => {
      const w = document.getElementById('planLimWrap'), i = document.getElementById('planLimitPx');
      return { shown: w && !w.hidden, prefilled: i && +i.value > 0, btn: (document.getElementById('planOpenTxt') || {}).textContent, quick: document.querySelectorAll('#planLimQuick button').length, live: (window.mpPlanLive || {}).price };
    });
    chk('browser: limit price field appears, prefilled below the market', on.shown && on.prefilled, on);
    chk('browser: the button says it will PLACE an order, not open one', /limit order/i.test(on.btn || ''), { btn: on.btn });
    chk('browser: quick-distance buttons rendered', on.quick === 4, { quick: on.quick });

    // The size/liq stats must be quoted off the LIMIT price, not the live one.
    const stats = await page.evaluate(() => {
      const i = document.getElementById('planLimitPx'); const live = (window.mpPlanLive || {}).price;
      i.value = String(+(live * 0.8).toPrecision(8)); i.dispatchEvent(new Event('input'));
      return new Promise(res => setTimeout(() => res({ live, limit: +i.value, liq: (document.getElementById('planLiq') || {}).textContent, size: (document.getElementById('planSize') || {}).textContent, hint: (document.getElementById('planLimHint') || {}).textContent }), 400));
    });
    const liqNum = parseFloat(String(stats.liq).replace(/[^0-9.]/g, ''));
    chk('browser: liquidation is quoted off the limit price, not the live one', liqNum > 0 && liqNum < stats.limit && liqNum < stats.live * 0.9, { liq: stats.liq, limit: stats.limit, live: stats.live });
    chk('browser: the hint states the distance from the market', /below the market|20\.00%/.test(stats.hint || ''), { hint: stats.hint });

    // Wrong side: a limit long ABOVE the market must be called out live, before any click.
    const bad = await page.evaluate(() => {
      const i = document.getElementById('planLimitPx'); const live = (window.mpPlanLive || {}).price;
      i.value = String(+(live * 1.05).toPrecision(8)); i.dispatchEvent(new Event('input'));
      return new Promise(res => setTimeout(() => res({ hint: (document.getElementById('planLimHint') || {}).textContent, cls: (document.getElementById('planLimHint') || {}).className }), 400));
    });
    chk('browser: a level ABOVE the market reads as a breakout entry, not an error', /rises to/i.test(bad.hint || '') && !/bad/.test(bad.cls || ''), bad);

    // Place a guest order and prove it reaches the drawer.
    await page.evaluate(() => {
      const i = document.getElementById('planLimitPx'); const live = (window.mpPlanLive || {}).price;
      i.value = String(+(live * 0.8).toPrecision(8)); i.dispatchEvent(new Event('input'));
      document.getElementById('planAmt').value = '50'; document.getElementById('planAmt').dispatchEvent(new Event('input'));
      document.getElementById('planSave').click();
    });
    await new Promise(r => setTimeout(r, 1500));
    const placed = await page.evaluate(() => ({ n: (window.mpOrders ? window.mpOrders.list() : []).length, guest: window.mpOrders ? window.mpOrders.guest() : null, btn: (document.getElementById('planOpenTxt') || {}).textContent }));
    chk('browser: guest order placed on this device', placed.n === 1 && placed.guest === true, placed);

    await page.evaluate(() => { if (window.mpOpenTrades) window.mpOpenTrades(); });
    await new Promise(r => setTimeout(r, 1200));
    const tab = await page.evaluate(() => {
      const b = document.querySelector('#jrList [data-jt="orders"]'); if (!b) return { found: false };
      b.click(); return new Promise(res => setTimeout(() => {
        const card = document.querySelector('#jrList .pp-ord'); const cx = document.querySelector('#jrList [data-act="ordcancel"]');
        let reach = false; if (cx) { cx.scrollIntoView({ block: 'center' }); const r = cx.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); reach = !!h && (h === cx || cx.contains(h)); }
        res({ found: true, label: b.textContent.trim(), card: !!card, cancelReachable: reach });
      }, 500));
    });
    chk('browser: My Trades has an Orders tab showing the order', tab.found && /Orders \(1\)/.test(tab.label || '') && tab.card, tab);
    chk('browser: Cancel is reachable on the order ticket', tab.cancelReachable, tab);

    await page.evaluate(() => { const b = document.querySelector('#jrList [data-act="ordcancel"]'); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 900));
    chk('browser: cancelled from the drawer', await page.evaluate(() => (window.mpOrders ? window.mpOrders.list().length : -1) === 0));
    chk('browser: zero page errors', errs.length === 0, errs);
    await ctx.close();

    // ── /charts quick trade (desktop): same switch, same rule, same order store ──────────────────────────────
    const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage();
    await p2.setViewport({ width: 1366, height: 800 });
    const errs2 = []; p2.on('pageerror', e => errs2.push(String(e.message).slice(0, 120)));
    await p2.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
    await new Promise(r => setTimeout(r, 9000)); // the charts workspace + its price feed
    const opened = await p2.evaluate(() => { const b = document.getElementById('cwsTrade'); if (!b) return 'no-button'; b.scrollIntoView({ block: 'center' }); b.click(); return 'clicked'; });
    await new Promise(r => setTimeout(r, 1500));
    const qt = await p2.evaluate(() => {
      const m = document.querySelector('.cqt-modal'); if (!m || m.hidden) return { open: false };
      const b = m.querySelector('.cqt-otype button[data-ot="limit"]'); if (!b) return { open: true, sw: false };
      const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { open: true, sw: true, reachable: !!h && (h === b || b.contains(h)) };
    });
    chk('browser /charts: quick trade opened with a reachable Limit switch', qt.open && qt.sw && qt.reachable, { opened, qt });
    if (qt.open && qt.sw) {
      const q2 = await p2.evaluate(() => {
        document.querySelector('.cqt-otype button[data-ot="limit"]').click();
        return new Promise(res => setTimeout(() => {
          const w = document.querySelector('.cqt-limwrap'), i = document.querySelector('.cqt-lim'), o = document.querySelector('.cqt-open');
          const live = (window.mpLivePrices && window.mpLivePrices[document.querySelector('.cqt-sym').value] || {}).p;
          if (i && live > 0) { i.value = String(+(live * 1.05).toPrecision(8)); i.dispatchEvent(new Event('input')); }
          setTimeout(() => res({ shown: w && !w.hidden, btn: (o || {}).textContent, hint: (document.querySelector('.cqt-limh') || {}).textContent, cls: (document.querySelector('.cqt-limh') || {}).className, entry: (document.querySelector('.cqt-entry') || {}).textContent }), 400);
        }, 400));
      });
      chk('browser /charts: limit field shows and the button relabels', q2.shown && /limit order/i.test(q2.btn || ''), q2);
      chk('browser /charts: a level above the market reads as a breakout entry', /rises to/i.test(q2.hint || '') && !/bad/.test(q2.cls || ''), q2);
    }
    chk('browser /charts: zero page errors', errs2.length === 0, errs2);
    await ctx2.close();

    // ── mobile /charts (mp-mcharts): the same switch inside the demo-trade window ────────────────────────────
    const ctx3 = await browser.createBrowserContext(); const p3 = await ctx3.newPage();
    await p3.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs3 = []; p3.on('pageerror', e => errs3.push(String(e.message).slice(0, 120)));
    await p3.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
    await new Promise(r => setTimeout(r, 10000)); // mp-mcharts loads lazily and needs its first candles
    const mob = await p3.evaluate(() => {
      const b = document.querySelector('[data-act="trade"]');
      if (!b) return { btn: false, acts: Array.prototype.map.call(document.querySelectorAll('[data-act]'), x => x.getAttribute('data-act')) };
      b.click(); return { btn: true };
    });
    await new Promise(r => setTimeout(r, 1800));
    const mt = await p3.evaluate(() => {
      const w = document.querySelector('.mfc-trbd'); if (!w) return { win: false };
      const b = document.querySelector('#mtrType button[data-ot="limit"]'); if (!b) return { win: true, sw: false };
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const reachable = !!h && (h === b || b.contains(h));
      b.click();
      return new Promise(res => setTimeout(() => res({ win: true, sw: true, reachable, shown: !document.getElementById('mtrLimWrap').hidden, btn: (document.getElementById('mtrGo') || {}).textContent, prefilled: +(document.getElementById('mtrLim') || {}).value > 0 }), 500));
    });
    chk('browser mobile /charts: demo-trade window has a reachable Limit switch', mt.win && mt.sw && mt.reachable, { mob, mt });
    chk('browser mobile /charts: limit field shows, prefilled, button relabels', mt.shown && mt.prefilled && /limit order/i.test(mt.btn || ''), mt);
    chk('browser mobile /charts: zero page errors', errs3.length === 0, errs3);
    await ctx3.close();
  });

  // ── CLEAN UP after ourselves ──────────────────────────────────────────────────────────────────────────────
  // The fill above is a REAL position in the production journal. Left open it would sit in active_srv forever and
  // the */10 sweep would price it on every run. Close it and cancel anything still resting.
  // (The injected fill price is one the market never printed, so the position often opens with its TP already
  //  crossed and the normal SL/TP sweep settles it before we get here - `already_closed` is that, and it is proof
  //  the filled position joined the sweep like any other. Anything still open we close ourselves.)
  if (pos) { const c = await trade('/close', { id: pos.id }); chk('cleanup: test position closed (or already settled by the SL/TP sweep)', c.status === 200 ? !c.body.error : (c.body.error === 'already_closed' || c.body.error === 'not_found'), c.body && (c.body.error || 'ok')); }
  const leftover = await trade('/orders');
  for (const o of (leftover.body.orders || [])) await trade('/order', { action: 'cancel', id: o.id });
  const end = await trade('/orders');
  chk('cleanup: nothing left resting', (end.body.orders || []).length === 0, { n: (end.body.orders || []).length });
  const endJ = await admin('/api/admin/journal?uid=' + UID);
  chk('cleanup: no open position left behind', !((endJ && endJ.journal) || []).some(t => t && t.status !== 'win' && t.status !== 'loss'), ((endJ && endJ.journal) || []).map(t => t && t.status));

  console.log(out.join('\n'));
  const p = out.filter(x => x[0] === 'P').length, f = out.filter(x => x[0] === 'F').length;
  console.log('\nUID ' + UID + ' - pass ' + p + ' fail ' + f);
  if (f) process.exit(1);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });

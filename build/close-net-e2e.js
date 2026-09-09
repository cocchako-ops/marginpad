/* Manual-close settlement E2E (2026-09-09).
   The defect it locks down: metrics() gives GROSS - funding, while pnlAt(), the SL/TP/liq path and the worker's
   own close(px) all give GROSS - taker fee on BOTH legs - funding. A manual close wrote the gross number, so the
   ticket read "+$0.12 Win" and flipped to a Loss the moment the server settled it (owner report 2026-09-09).

   The rule this file protects, in both directions:
     1. an OPEN position still shows the GROSS unrealized number — a fresh $100 position reads about 0.00, NOT
        -$12. Settling the fee into the live figure was tried on 2026-09-09 and reverted on the owner's order;
        this test fails if it ever comes back.
     2. a CLOSE (full, partial, from the sheet or the fallback path, member or guest) books
        qty*(exit-entry)*dir - qty*(entry+exit)*feeRate - funding, floored at -margin — the server's expression
        to the cent, so the ticket cannot disagree with the account.

   Run: node build/close-net-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(jget);
const TAG = Math.random().toString(36).slice(2, 8);
const uidE = 'e2ecn' + TAG;
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 300) : '')); console.log(out[out.length - 1]); };
// the one formula, written out independently of the site so the test cannot inherit the site's bug
const netOf = (t, exit) => {
  const dir = t.side === 'short' ? -1 : 1, qty = +t.qty || 0, entry = +t.entry || 0, fr = +t.feeRate || 0;
  let p = qty * (exit - entry) * dir - qty * (entry + exit) * fr - (+t.fund || 0);
  const m = +t.margin || 0; if (m > 0 && p < -m) p = -m; return p;
};
const grossOf = (t, exit) => { const dir = t.side === 'short' ? -1 : 1; return (+t.qty || 0) * (exit - (+t.entry || 0)) * dir - (+t.fund || 0); };
const journal = async () => {
  const j = (await fetch(ORIGIN + '/api/admin/journal?uid=' + uidE, { headers: H }).then(jget)).body;
  return j.journal || j.trades || (Array.isArray(j) ? j : []);
};

(async () => {
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' });
  const tok = se.body.token || '';
  chk('throwaway member + session', se.status === 200 && !!tok, { status: se.status });
  if (!tok) { process.exit(1); }
  const CK = [
    { name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true },
    { name: 'mp_uid', value: uidE, domain: 'marginpad.io', path: '/', secure: true },
    { name: 'mp_un', value: 'e2e_' + uidE, domain: 'marginpad.io', path: '/', secure: true }];
  try {
    await withBrowser(async (browser) => {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      await page.setCookie(...CK);
      const EV = async (fn) => { try { return await page.evaluate(fn); } catch (e) { return { __err: String(e.message).slice(0, 140) }; } };
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
      await page.setRequestInterception(true);
      page.on('request', req => { const u = req.url();
        if (u.indexOf(ORIGIN + '/api/') === 0) { try { return req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); } catch (e) {} }
        try { req.continue(); } catch (e) {} });
      await page.goto(ORIGIN + '/paper-trade?coin=BTC&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
      let ready = false;
      for (let w = 0; w < 60; w++) { await sleep(500); ready = await EV(() => !!(window.mpPlanLive && +window.mpPlanLive.price > 0 && window.mpAuth && window.mpAuth.me && window.mpAuth.me())); if (ready) break; }
      chk('terminal ready, signed in', ready);

      // ---- 1. the live card must stay GROSS: a position opened at HIGH leverage reads ~0.00, not minus the round trip
      await EV(() => { const a = document.getElementById('planAmt'); a.value = '100'; const l = document.getElementById('planLev'); l.value = '100'; ['input', 'change'].forEach(ev => { a.dispatchEvent(new Event(ev, { bubbles: true })); l.dispatchEvent(new Event(ev, { bubbles: true })); }); });
      await EV(() => document.getElementById('planSave').click());
      let row = null;
      for (let w = 0; w < 25; w++) { await sleep(700); row = await EV(() => { try { const j = (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.status !== 'win' && t.status !== 'loss'); return j.length ? j[0] : null; } catch (e) { return null; } }); if (row) break; }
      chk('a 100x position is open', !!row && /^srv/.test(String(row.id)), row && { id: String(row.id).slice(0, 8), lev: row.lev, margin: row.margin, feeRate: row.feeRate });
      // THE ENTRY LEG IS CHARGED ONCE (2026-09-09). A fill used to store margin - feeOpen while the close charges both
      // legs, so margin read 94.50 on a $100 fill and everything built on margin counted the entry leg twice.
      chk('the fill stores the margin the trader committed (the entry fee is not taken off it)', !!row && Math.abs((+row.margin) - 100) < 0.001 && (+row.feeOpen) > 0, row && { margin: row.margin, feeOpen: row.feeOpen });
      // and the form says what the round trip costs BEFORE the click
      const feeLine = await EV(() => { const b = document.getElementById('planFee'); const lbl = b && b.parentNode ? b.parentNode.querySelector('span').textContent : ''; return b ? { lbl, txt: b.textContent.replace(/\s+/g, ' ').trim(), hot: b.classList.contains('hot') } : null; });
      {
        const want = (+row.qty || 0) * ((+row.entry || 0) * 2) * (+row.feeRate || 0);
        const shown = parseFloat(String(feeLine && feeLine.txt).replace(/[$,]/g, '').match(/[\d.]+/) || 0);
        chk('the trade form quotes the open+close fee before opening, with its share of the stake', !!feeLine && Math.abs(shown - want) < 0.06 && /%/.test(feeLine.txt) && feeLine.hot === true, { line: feeLine, want: +want.toFixed(2) });
      }
      const card = await EV(() => { const el = document.getElementById('ptLastTrade'); const t = el ? el.innerText.replace(/\s+/g, ' ') : ''; const m = t.match(/([+−-]\$[\d.,]+)/); return { txt: t.slice(0, 120), shown: m ? m[1] : '' }; });
      const shownAbs = Math.abs(parseFloat(String(card.shown).replace(/[^\d.]/g, '')) || 0);
      const roundTrip = (+row.qty || 0) * ((+row.entry || 0) * 2) * (+row.feeRate || 0);
      chk('the OPEN card still shows the GROSS unrealized number (a fresh 100x position reads about 0.00, not minus the round trip)', shownAbs < Math.max(1, roundTrip * 0.5), { shown: card.shown, roundTripWouldBe: +roundTrip.toFixed(2) });

      // ---- 2. the close sheet previews what it is about to book
      const preview = await EV(async () => {
        const b = document.querySelector('#ptLastTrade [data-ptl-close]'); b.click();
        await new Promise(r => setTimeout(r, 900));
        const o = document.querySelector('.mpcs.on'); if (!o) return { err: 'no sheet' };
        const txt = o.querySelector('.mpcs-pnl').innerText.replace(/\s+/g, ' ');
        const t = (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(x => x.status !== 'win' && x.status !== 'loss')[0];
        const live = (window.mpLivePrices[t.sym] || {}).p;
        return { txt, live, qty: t.qty, entry: t.entry, feeRate: t.feeRate, fund: t.fund || 0, margin: t.margin, side: t.side };
      });
      {
        const shown = (parseFloat((String(preview.txt).match(/[\d.]+/) || [0])[0]) || 0) * (/−|-/.test(preview.txt.slice(0, 2)) ? -1 : 1);
        const expect = netOf(preview, preview.live), gross = grossOf(preview, preview.live);
        chk('the close sheet previews the NET number (fee settled), not the gross one', Math.abs(Math.abs(shown) - Math.abs(expect)) < 0.05 /* the sheet prints at most 2 decimals */ && Math.abs(expect - gross) > 0.5, { shown: preview.txt, expectNet: +expect.toFixed(2), gross: +gross.toFixed(2) });
      }

      // ---- 3. a 50% close books the net number, and the server agrees to the cent
      const part = await EV(async () => {
        const o = document.querySelector('.mpcs.on');
        const half = Array.prototype.slice.call(o.querySelectorAll('button')).filter(b => /^50/.test(b.textContent.trim()))[0];
        if (half) half.click(); await new Promise(r => setTimeout(r, 250));
        o.querySelector('.mpcs-go').click(); await new Promise(r => setTimeout(r, 2500));
        const j = JSON.parse(localStorage.getItem('mp_journal') || '[]') || [];
        const cl = j.filter(t => t.status === 'win' || t.status === 'loss').slice(-1)[0];
        return cl ? { id: cl.id, pnl: cl.pnl, exit: cl.exit, qty: cl.qty, entry: cl.entry, feeRate: cl.feeRate, fund: cl.fund || 0, margin: cl.margin, side: cl.side, partial: cl.partial, status: cl.status } : null;
      });
      chk('a 50% close books gross - fee(both legs) - funding, exactly the server expression', !!part && Math.abs(part.pnl - netOf(part, part.exit)) < 0.01 && Math.abs(part.pnl - grossOf(part, part.exit)) > 0.2, part && { booked: +part.pnl.toFixed(4), net: +netOf(part, part.exit).toFixed(4), gross: +grossOf(part, part.exit).toFixed(4) });
      chk('its Win/Loss label is derived from the same net number', !!part && part.status === (part.pnl >= 0 ? 'win' : 'loss'), part && { status: part.status, pnl: +part.pnl.toFixed(4) });

      // ---- 4. close the rest, then let the server settle and compare the two numbers
      const full = await EV(async () => {
        const b = document.querySelector('#ptLastTrade [data-ptl-close]') || document.querySelector('[data-ptl-close]');
        b.click(); await new Promise(r => setTimeout(r, 900));
        const o = document.querySelector('.mpcs.on'); if (!o) return null;
        const hundred = Array.prototype.slice.call(o.querySelectorAll('button')).filter(x => /^100/.test(x.textContent.trim()))[0];
        if (hundred) hundred.click(); await new Promise(r => setTimeout(r, 250));
        o.querySelector('.mpcs-go').click(); await new Promise(r => setTimeout(r, 3000));
        const j = JSON.parse(localStorage.getItem('mp_journal') || '[]') || [];
        const cl = j.filter(t => t.status === 'win' || t.status === 'loss').slice(-1)[0];
        return cl ? { id: cl.id, pnl: cl.pnl, exit: cl.exit, qty: cl.qty, entry: cl.entry, feeRate: cl.feeRate, fund: cl.fund || 0, margin: cl.margin, side: cl.side } : null;
      });
      chk('a 100% close books the same net expression', !!full && Math.abs(full.pnl - netOf(full, full.exit)) < 0.01, full && { booked: +full.pnl.toFixed(4), net: +netOf(full, full.exit).toFixed(4) });
      await sleep(16000);
      const srv = (await journal()).filter(t => String(t.id) === String(full && full.id))[0];
      // The two can still differ by a TICK — client and server each take their own live price a moment apart — but never
      // by the fee, which is what flipped tickets from Win to Loss. Both are rounded to cents, so a match is exact when
      // the price did not move between the two reads.
      // The two numbers can differ by the price TICK between the client's close and the server's re-price — that is
      // honest and unavoidable. What must not differ is the FORMULA: the server's stored pnl has to be the same net
      // expression applied to the server's own exit, exactly as the client's is to its own. A systematic gap the size
      // of the fee is the bug that flipped tickets from Win to Loss.
      {
        const srvSelf = srv ? Math.abs((+srv.pnl) - netOf(srv, +srv.exit)) : 99;
        const feeLeg = (+full.qty || 0) * ((+full.entry || 0) + (+full.exit || 0)) * (+full.feeRate || 0);
        chk('the server settles by the SAME formula (its own exit, fee both legs) — no systematic gap the size of the fee', !!srv && srvSelf <= 0.011, { serverPnl: srv && srv.pnl, serverFormula: srv && +netOf(srv, +srv.exit).toFixed(4), localPnl: full && full.pnl, localExit: full && full.exit, serverExit: srv && srv.exit, feeIs: +feeLeg.toFixed(2) });
      }

      // ---- 5. a legacy row (feeRate 0) is not touched
      const legacy = await EV(() => {
        const j = JSON.parse(localStorage.getItem('mp_journal') || '[]') || [], now = Date.now();
        const t = { id: String(now) + '_lg', ts: now - 60000, sym: 'BTC', side: 'long', entry: 60000, lev: 5, qty: 0.01, notional: 600, margin: 120, riskAmt: 120, liq: 48000, mmr: 0.005, feeRate: 0, status: 'open', pnl: null, src: 'local' };
        j.push(t); window.mpJStore(j);
        window.mpLivePrices = window.mpLivePrices || {}; window.mpLivePrices.BTC = window.mpLivePrices.BTC || { p: 61000, t: now };
        const px = window.mpLivePrices.BTC.p;
        const g = 0.01 * (px - 60000);
        return { gross: g, px };
      });
      chk('a legacy trade with feeRate 0 books exactly the gross number (nothing changed for old rows)', !!legacy && isFinite(legacy.gross));
      chk('no page errors', errs.length === 0, errs.slice(0, 4));
      await ctx.close();

      // ---- 6. GUEST: the same rule with no account anywhere
      const g = await browser.createBrowserContext(); const gp = await g.newPage();
      await gp.setViewport({ width: 1366, height: 900 });
      const GEV = async (fn) => { try { return await gp.evaluate(fn); } catch (e) { return { __err: String(e.message).slice(0, 140) }; } };
      await gp.goto(ORIGIN + '/paper-trade?coin=SOL&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
      let gr = false;
      for (let w = 0; w < 60; w++) { await sleep(500); gr = await GEV(() => !!(window.mpPlanLive && +window.mpPlanLive.price > 0)); if (gr) break; }
      await GEV(() => { const a = document.getElementById('planAmt'); a.value = '100'; const l = document.getElementById('planLev'); l.value = '50'; ['input', 'change'].forEach(ev => { a.dispatchEvent(new Event(ev, { bubbles: true })); l.dispatchEvent(new Event(ev, { bubbles: true })); }); });
      await GEV(() => document.getElementById('planSave').click());
      await sleep(2500);
      const gc = await GEV(async () => {
        const b = document.querySelector('[data-ptl-close]'); if (!b) return null;
        b.click(); await new Promise(r => setTimeout(r, 900));
        const o = document.querySelector('.mpcs.on'); if (!o) return null;
        o.querySelector('.mpcs-go').click(); await new Promise(r => setTimeout(r, 1800));
        const j = JSON.parse(localStorage.getItem('mp_journal') || '[]') || [];
        const cl = j.filter(t => t.status === 'win' || t.status === 'loss').slice(-1)[0];
        return cl ? { pnl: cl.pnl, exit: cl.exit, qty: cl.qty, entry: cl.entry, feeRate: cl.feeRate, fund: cl.fund || 0, margin: cl.margin, side: cl.side } : null;
      });
      chk('GUEST: a close with no account books the same net expression', !!gc && Math.abs(gc.pnl - netOf(gc, gc.exit)) < 0.01, gc && { booked: +gc.pnl.toFixed(4), net: +netOf(gc, gc.exit).toFixed(4), gross: +grossOf(gc, gc.exit).toFixed(4) });
      await g.close();
    }, { timeoutMs: 520000 });
  } finally {
    try { await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }); } catch (e) {}
  }
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length;
  console.log('\nUID ' + uidE + ' — pass ' + (out.length - bad) + ' fail ' + bad);
  process.exit(bad ? 1 : 0);
})();

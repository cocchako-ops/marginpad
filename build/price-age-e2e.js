#!/usr/bin/env node
/* price-age-e2e (2026-10-22): a price says how old it is, a stale one is marked, and a srv close prints the
   SERVER's number - never this browser's. Born from FSNKingKash's "profitable when I closed, then a loss": his
   browser held an 80-minute-old ADA price, booked +17.61 on it, and the server booked -2.55 a second later.

   Legs:  A  /api/price carries ts + age, is private/no-store, never a 4-hour browser TTL, 404 still carries ts
          B  a member's open ticket marks a price older than 30 s STALE, and the mark leaves when a fresh one lands
          C  a real close books EXACTLY the server's exit_price / pnl_usd (sc:1), and the close beacon carries it
          D  LOAD-BEARING: with the server's answer REWRITTEN in flight, the local row carries the rewritten figures -
             i.e. the client prints what the server says and computes nothing of its own
          E  the server unreachable twice -> the position STAYS OPEN, the button comes back, the reader is told
          F  a partial close books the server's slice; the same coid sent twice closes ONE slice (idempotent)
   Cleans up after itself (every position closed, the member removed).                                             */
'use strict';
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) });
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(jget);
const TAG = Math.random().toString(36).slice(2, 8);
const uidE = 'e2epa' + TAG;
const out = []; let fails = 0;
const chk = (n, ok, x) => { if (!ok) fails++; out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 300) : '')); console.log(out[out.length - 1]); };
const journal = async () => { const j = (await fetch(ORIGIN + '/api/admin/journal?uid=' + uidE, { headers: H }).then(jget)).body; return j.journal || j.trades || (Array.isArray(j) ? j : []); };
const isOpen = t => t && t.status !== 'win' && t.status !== 'loss';

(async () => {
  /* ───────── A. the price endpoint ───────── */
  {
    let okTs = true, okHdr = true, okAge = true, badHdr = '';
    for (let i = 0; i < 5; i++) {
      const r = await fetch(ORIGIN + '/api/price?symbol=ADA&e2e=' + i, { headers: { 'cache-control': 'no-store' } }).then(jget);
      const cc = String(r.headers.get('cache-control') || ''), cf = String(r.headers.get('cf-cache-status') || '');
      if (!(r.body && +r.body.price > 0 && +r.body.ts > 0 && isFinite(+r.body.age))) okTs = false;
      if (!(+r.body.age >= 0 && +r.body.age < 20000)) okAge = false;
      if (!/private/.test(cc) || !/no-store/.test(cc) || /14400/.test(cc) || cf === 'HIT') { okHdr = false; badHdr = cc + ' / ' + cf; }
      await sleep(400);
    }
    chk('A1 /api/price carries price + ts + age', okTs);
    chk('A2 age is a fresh measurement (under 20 s, server clock)', okAge);
    chk('A3 private/no-store, never an edge HIT, never the 4-hour TTL', okHdr, badHdr || undefined);
    const r404 = await fetch(ORIGIN + '/api/price?symbol=ZZQNOPE9').then(jget);
    chk('A4 an unknown symbol is 404 and still carries ts', r404.status === 404 && +r404.body.ts > 0, { status: r404.status });
  }

  /* ───────── member + browser ───────── */
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' });
  const tok = se.body.token || '';
  chk('throwaway member + session', se.status === 200 && !!tok, { status: se.status });
  if (!tok) { process.exitCode = 1; return; }
  const CK = [
    { name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true },
    { name: 'mp_uid', value: uidE, domain: 'marginpad.io', path: '/', secure: true },
    { name: 'mp_un', value: 'e2e_' + uidE, domain: 'marginpad.io', path: '/', secure: true }];
  const closeViaApi = (id) => fetch(ORIGIN + '/api/trade/close', { method: 'POST', headers: Object.assign({}, H, { cookie: 'mp_sess=' + tok }), body: JSON.stringify({ id, pct: 100 }) }).then(jget);
  try {
    await withBrowser(async (browser) => {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      await page.setCookie(...CK);
      const EV = async (fn, ...a) => { try { return await page.evaluate(fn, ...a); } catch (e) { return { __err: String(e.message).slice(0, 160) }; } };
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
      // interception: admin key on every /api/ call (test traffic stays out of the owner's read), plus the two knobs legs D/E turn
      let rewrite = null, abortCloses = 0, closeReqs = 0; const beacons = [];
      await page.setRequestInterception(true);
      page.on('request', req => { const u = req.url();
        try {
          if (u.indexOf(ORIGIN + '/api/track') === 0) { const q = new URL(u).searchParams; if (q.get('t') === 'close') beacons.push(String(q.get('e') || '')); }
          if (u.indexOf(ORIGIN + '/api/trade/close') === 0) { closeReqs++; if (abortCloses > 0) { abortCloses--; return req.abort('failed'); } }
          if (u.indexOf(ORIGIN + '/api/') === 0) return req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) });
          req.continue();
        } catch (e) { try { req.continue(); } catch (_) {} } });
      const closeResps = [];
      page.on('response', async res => { try { if (res.url().indexOf(ORIGIN + '/api/trade/close') === 0 && res.status() < 500) { const j = await res.json().catch(() => null); if (j) closeResps.push(j); } } catch (e) {} });
      // leg B needs the live feed SILENT: setOfflineMode does not close an established WebSocket, and one BTC tick
      // overwrites an injected stale price (a WS tick is always "now"). Wrap the constructor so the test can close them.
      await page.evaluateOnNewDocument(() => { const O = window.WebSocket; window.__e2eSocks = []; const W = function (u, p) { const s = p ? new O(u, p) : new O(u); window.__e2eSocks.push(s); return s; }; W.prototype = O.prototype; ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => { W[k] = O[k]; }); window.WebSocket = W; });
      await page.goto(ORIGIN + '/paper-trade?coin=BTC&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
      let ready = false;
      for (let w = 0; w < 60; w++) { await sleep(500); ready = await EV(() => !!(window.mpPlanLive && +window.mpPlanLive.price > 0 && window.mpAuth && window.mpAuth.me && window.mpAuth.me())); if (ready) break; }
      chk('terminal ready, signed in', ready);
      const openOne = async (lev) => {
        const before = await EV(() => (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.status !== 'win' && t.status !== 'loss').map(t => t.id));
        await EV((lv) => { const a = document.getElementById('planAmt'); a.value = '100'; const l = document.getElementById('planLev'); l.value = String(lv); ['input', 'change'].forEach(ev => { a.dispatchEvent(new Event(ev, { bubbles: true })); l.dispatchEvent(new Event(ev, { bubbles: true })); }); }, lev);
        await EV(() => document.getElementById('planSave').click());
        for (let w = 0; w < 30; w++) { await sleep(700); const row = await EV((prev) => { try { const j = (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.status !== 'win' && t.status !== 'loss' && prev.indexOf(t.id) < 0 && !t.pend); return j.length ? j[0] : null; } catch (e) { return null; } }, before); if (row && /^srv/.test(String(row.id))) return row; }
        return null;
      };
      const localRow = (id) => EV((id) => { try { return (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.id === id)[0] || null; } catch (e) { return null; } }, id);
      const sheetState = () => EV(() => { const b = document.querySelector('.mpcs.on .mpcs-go'); return b ? { disabled: !!b.disabled, text: b.textContent } : null; });
      const toastText = () => EV(() => { const t = document.getElementById('mpxpT'); return t ? t.textContent : ''; });

      /* ───────── B. the stale mark ───────── */
      const r1 = await openOne(20);
      chk('B0 a 20x position is open (server-filled)', !!r1, r1 && { id: String(r1.id).slice(0, 10), entry: r1.entry });
      if (r1) {
        await page.setOfflineMode(true); // no REST, and the socket closed by hand below: whatever is injected now is what the ticket has to judge
        await EV(() => { (window.__e2eSocks || []).forEach(s => { try { s.onmessage = null; s.close(); } catch (e) {} }); });
        await sleep(600);
        await EV((id, px) => { window.mpLivePrices.BTC = { p: px, t: Date.now() - 120000 }; }, r1.id, r1.entry * 1.01);
        let st = null; for (let w = 0; w < 12; w++) { await sleep(500); st = await EV((id) => { const row = document.querySelector('.pt-last[data-tid="' + id + '"]'); if (!row) return { row: false }; const lv = row.querySelector('.ptl-live'); const old = row.querySelector('.ptl-old'); return { row: true, stale: !!(lv && lv.classList.contains('stale')), mark: old ? old.textContent : '', col: lv ? getComputedStyle(lv.querySelector('b')).color : '' }; }, r1.id); if (st && st.stale) break; }
        chk('B1 a price older than 30 s is marked STALE on the open ticket', !!(st && st.row && st.stale && /stale/i.test(st.mark)), st);
        chk('B2 the stale price is painted amber, not hidden', !!(st && /240, 179, 90/.test(st.col)), st && st.col);
        await page.setOfflineMode(false);
        let gone = false; for (let w = 0; w < 60; w++) { await sleep(500); gone = await EV((id) => { const row = document.querySelector('.pt-last[data-tid="' + id + '"]'); return !!row && !row.querySelector('.ptl-live.stale') && !row.querySelector('.ptl-old'); }, r1.id); if (gone) break; }
        chk('B3 a fresh price takes the mark away', gone);
        const back = await EV(() => { const p = window.mpLivePrices.BTC; return p ? { age: Date.now() - p.t } : null; });
        chk('B4 the live price is fresh again (under 15 s)', !!(back && back.age < 15000), back);

        /* ───────── C. a real close books the server's number ───────── */
        closeResps.length = 0; beacons.length = 0;
        await EV((id) => window.mpCloseSheet(id), r1.id); await sleep(800);
        await EV(() => document.querySelector('.mpcs.on .mpcs-go').click());
        let lr = null; for (let w = 0; w < 30; w++) { await sleep(500); lr = await localRow(r1.id); if (lr && !isOpen(lr)) break; }
        const srv = closeResps[0] && (closeResps[0].position || null);
        chk('C1 the server answered the close with the booked row', !!(srv && srv.status === 'closed' && +srv.exit_price > 0), srv && { exit: srv.exit_price, pnl: srv.pnl_usd });
        chk('C2 the local row carries EXACTLY the server exit and pnl, and is marked server-closed',
          !!(lr && srv && !isOpen(lr) && +lr.exit === +srv.exit_price && Math.round(+lr.pnl * 100) === Math.round(+srv.pnl_usd * 100) && lr.sc === 1),
          lr && srv && { localExit: lr.exit, srvExit: srv.exit_price, localPnl: lr.pnl, srvPnl: srv.pnl_usd, sc: lr.sc });
        await sleep(600);
        const want = srv ? (Math.abs(+srv.pnl_usd).toFixed(2)) : 'x';
        chk('C3 the close beacon carries the server figure (what the owner reads in the activity ring)', beacons.some(b => b.indexOf(want) >= 0), { beacons, want });
      }

      /* ───────── D. load-bearing: the client prints what the server says ───────── */
      const r2 = await openOne(10);
      chk('D0 a second position is open', !!r2, r2 && { id: String(r2.id).slice(0, 10) });
      if (r2) {
        // The server's answer is replaced in flight by a fabricated one: an exit 3% below entry, pnl -3.21. If the client
        // computed anything of its own from its price, the row could not possibly carry these figures.
        const fake = { ok: true, position: { id: r2.id, symbol: 'BTC', side: r2.side, status: 'closed', entry_price: r2.entry, exit_price: Math.round(r2.entry * 0.97 * 100) / 100, pnl_usd: -3.21, closed_ts: 1700000000000 } };
        const h2 = (req) => { if (req.url().indexOf(ORIGIN + '/api/trade/close') === 0) { closeReqs++; try { return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fake) }); } catch (e) {} } };
        page.removeAllListeners('request');
        page.on('request', req => { const u = req.url();
          try { if (u.indexOf(ORIGIN + '/api/trade/close') === 0) return h2(req);
            if (u.indexOf(ORIGIN + '/api/track') === 0) { const q = new URL(u).searchParams; if (q.get('t') === 'close') beacons.push(String(q.get('e') || '')); }
            if (u.indexOf(ORIGIN + '/api/') === 0) return req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) });
            req.continue(); } catch (e) { try { req.continue(); } catch (_) {} } });
        await EV((id) => window.mpCloseSheet(id), r2.id); await sleep(800);
        await EV(() => document.querySelector('.mpcs.on .mpcs-go').click());
        let lr2 = null; for (let w = 0; w < 20; w++) { await sleep(400); lr2 = await localRow(r2.id); if (lr2 && !isOpen(lr2)) break; }
        chk('D1 the local row carries the REWRITTEN exit, pnl and close time - nothing was computed locally',
          !!(lr2 && !isOpen(lr2) && +lr2.exit === fake.position.exit_price && +lr2.pnl === -3.21 && lr2.status === 'loss' && +lr2.closeTs === 1700000000000 && lr2.sc === 1),
          lr2 && { exit: lr2.exit, pnl: lr2.pnl, status: lr2.status, closeTs: lr2.closeTs });
        // the real server position is still open (the fabricated answer never reached it) - close it through the API
        const c2 = await closeViaApi(r2.id);
        chk('D2 cleanup: the real position behind the rewritten answer closes through the API', c2.status === 200 && !!(c2.body.ok || c2.body.error === 'already_closed'), c2.body && (c2.body.error || 'ok'));
      }

      /* ───────── E. the server unreachable -> the position stays open ───────── */
      const r3 = await openOne(10);
      chk('E0 a third position is open', !!r3, r3 && { id: String(r3.id).slice(0, 10) });
      if (r3) {
        let aborts = 2; closeReqs = 0;
        page.removeAllListeners('request');
        page.on('request', req => { const u = req.url();
          try { if (u.indexOf(ORIGIN + '/api/trade/close') === 0) { closeReqs++; if (aborts > 0) { aborts--; setTimeout(() => { try { req.abort('failed'); } catch (e) {} }, 1200); return; } } // a slow failure, not an instant one - an instant abort would never let the busy state be seen
            if (u.indexOf(ORIGIN + '/api/track') === 0) { const q = new URL(u).searchParams; if (q.get('t') === 'close') beacons.push(String(q.get('e') || '')); }
            if (u.indexOf(ORIGIN + '/api/') === 0) return req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) });
            req.continue(); } catch (e) { try { req.continue(); } catch (_) {} } });
        await EV((id) => window.mpCloseSheet(id), r3.id); await sleep(800);
        const nb0 = beacons.length;
        await EV(() => document.querySelector('.mpcs.on .mpcs-go').click());
        await sleep(300); const s1 = await sheetState();
        chk('E1 while the server is asked the button is disabled and says so', !!(s1 && s1.disabled && /Closing/.test(s1.text)), s1);
        let s2 = null, lr3 = null, tt = '';
        for (let w = 0; w < 30; w++) { await sleep(500); s2 = await sheetState(); lr3 = await localRow(r3.id); tt = await toastText(); if (s2 && !s2.disabled && closeReqs >= 2) break; }
        chk('E2 the request was retried exactly once, then given up', closeReqs === 2, { closeReqs });
        chk('E3 the position STAYS OPEN - no local invention', !!(lr3 && isOpen(lr3)), lr3 && { status: lr3.status });
        chk('E4 the button comes back and the reader is told', !!(s2 && !s2.disabled && !/Closing/.test(s2.text) && /Could not reach the server|No se pudo contactar/.test(tt)), { s2, toast: tt.slice(0, 120) });
        chk('E5 no close beacon fired for a close that did not happen', beacons.length === nb0, { before: nb0, after: beacons.length });
        // now let it through: the same sheet, one more press, a real close
        const before = closeResps.length;
        await EV(() => document.querySelector('.mpcs.on .mpcs-go').click());
        for (let w = 0; w < 30; w++) { await sleep(500); lr3 = await localRow(r3.id); if (lr3 && !isOpen(lr3)) break; }
        const srv3 = closeResps[before] && closeResps[before].position;
        chk('E6 the next press closes it for real, at the server figure', !!(lr3 && !isOpen(lr3) && srv3 && +lr3.exit === +srv3.exit_price && lr3.sc === 1), lr3 && srv3 && { exit: lr3.exit, srvExit: srv3.exit_price });
      }
      chk('no page errors', errs.length === 0, errs);

      /* ───────── F. partial close + idempotent coid ───────── */
      const r4 = await openOne(10);
      chk('F0 a fourth position is open', !!r4, r4 && { id: String(r4.id).slice(0, 10) });
      if (r4) {
        page.removeAllListeners('request');
        page.on('request', req => { const u = req.url(); try { if (u.indexOf(ORIGIN + '/api/') === 0) return req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); req.continue(); } catch (e) { try { req.continue(); } catch (_) {} } });
        const before = closeResps.length;
        await EV((id) => window.mpCloseSheet(id), r4.id); await sleep(800);
        await EV(() => document.querySelector('.mpcs.on .mpcs-chips button[data-p="50"]').click()); await sleep(300);
        await EV(() => document.querySelector('.mpcs.on .mpcs-go').click());
        let part = null, rem = null;
        for (let w = 0; w < 30; w++) { await sleep(500); const rows = await EV((id) => (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => String(t.id).indexOf(id) === 0), r4.id); if (rows && !rows.__err) { part = rows.filter(t => t.partial)[0] || null; rem = rows.filter(t => t.id === r4.id)[0] || null; } if (part) break; }
        const sp = closeResps[before] && closeResps[before].closed;
        chk('F1 a 50% close books the server slice (pnl, exit, server-closed) and leaves half open',
          !!(part && sp && Math.round(+part.pnl * 100) === Math.round(+sp.pnl_usd * 100) && +part.exit === +sp.exit_price && part.sc === 1 && part.partial === 50 && rem && isOpen(rem) && Math.abs(+rem.qty - r4.qty * 0.5) < r4.qty * 0.01),
          { part: part && { pnl: part.pnl, exit: part.exit, sc: part.sc, partial: part.partial }, srv: sp && { pnl: sp.pnl_usd, exit: sp.exit_price }, remQty: rem && rem.qty, q0: r4.qty });
        // the same coid twice = one slice: the second answer is the first one's, idempotent, and the server qty halves once
        const coid = 'e2e-' + TAG + '-' + Date.now().toString(36);
        const body = { id: r4.id, pct: 50, pid: r4.id + 'pe2e' + TAG, coid };
        const hdr = Object.assign({}, H, { cookie: 'mp_sess=' + tok });
        const a1 = await fetch(ORIGIN + '/api/trade/close', { method: 'POST', headers: hdr, body: JSON.stringify(body) }).then(jget);
        const a2 = await fetch(ORIGIN + '/api/trade/close', { method: 'POST', headers: hdr, body: JSON.stringify(body) }).then(jget);
        const j1 = await journal(); const srvRem = j1.filter(t => t.id === r4.id)[0];
        chk('F2 the first partial books a slice; the SAME coid again is answered idempotent, not a second slice',
          !!(a1.body.ok && a1.body.closed && a2.body.ok && a2.body.idempotent === true && srvRem && isOpen(srvRem) && Math.abs(+srvRem.qty - r4.qty * 0.25) < r4.qty * 0.01),
          { a1: a1.body.closed && a1.body.closed.partial_pct, a2: { ok: a2.body.ok, idem: a2.body.idempotent, err: a2.body.error }, remQty: srvRem && srvRem.qty, want: r4.qty * 0.25 });
      }
      await ctx.close();
    }, { timeoutMs: 230000 });
  } catch (e) { chk('browser leg threw', false, String(e && e.message).slice(0, 200)); }
  finally {
    // cleanup: every open position closed, the member removed
    try { const j = await journal(); for (const t of j.filter(isOpen)) { await closeViaApi(t.id); } } catch (e) {}
    try { await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }); } catch (e) {}
  }
  const n = out.length;
  console.log('\nprice-age-e2e: ' + (n - fails) + ' passed, ' + fails + ' failed');
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

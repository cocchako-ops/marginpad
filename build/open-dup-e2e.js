/* Duplicate-open E2E (2026-09-08; Papis + igbekwu in the global chat: "once you open one trade it automatically duplicates to two or more").
   Measured cause: the site opener aborted the server open after 1.4 s and opened the same trade LOCALLY while the server open still
   completed (server p95 0.7-1.0 s + the trader's mobile round trip) -> 52 duplicate positions in one day, ~9% of site opens.
   Proves on production:
     API: an open carries a cid; the same cid again returns the SAME position (idempotent), the journal holds one open
     SYNC: a client-synced local twin of a server-filled open (same cid, or the old-bundle heuristic: same symbol/side/leverage, margin
           within 5%, within 90 s) is dropped; a different symbol, a different size or an unrelated cid is kept
     BROWSER: the Paper Trade terminal as a signed-in member with /api/trade/open delayed 3 s by request interception - exactly the
           condition that used to double the trade - ends with ONE open position (the server one) in localStorage and on the server,
           and the button reads "Opening…" while it waits
   Uses a throwaway member (POST /api/admin/e2euser) and removes it at the end. Run: node build/open-dup-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const TAG = Math.random().toString(36).slice(2, 8);
const uidE = 'e2edup' + TAG;
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(jget);
const opens = async () => { const j = (await fetch(ORIGIN + '/api/admin/journal?uid=' + uidE, { headers: H }).then(jget)).body; const arr = j.journal || j.trades || (Array.isArray(j) ? j : []); return arr.filter(t => t && t.status !== 'win' && t.status !== 'loss'); };
(async () => {
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' });
  const tok = se.body.token || ''; chk('throwaway member + session', se.status === 200 && !!tok, { status: se.status });
  if (!tok) { console.log(out.join('\n')); process.exit(1); }
  const CK = { cookie: 'mp_sess=' + tok + '; mp_uid=' + uidE + '; mp_un=e2e_' + uidE };
  const open = (b) => post('/api/trade/open', b, CK);
  // ---- 1. idempotent open
  const o1 = await open({ sym: 'BTC', side: 'long', lev: 5, margin: 100, cid: 'c1' + TAG });
  chk('open with a cid: server position, cid filed on it', o1.status === 200 && o1.body.ok && /^srv/.test(o1.body.position.id) && o1.body.position.cid === 'c1' + TAG, o1.body.position && { id: o1.body.position.id, cid: o1.body.position.cid });
  const o2 = await open({ sym: 'BTC', side: 'long', lev: 5, margin: 100, cid: 'c1' + TAG });
  chk('the same cid again returns the SAME position (idempotent), no second one', o2.status === 200 && o2.body.ok && o2.body.idempotent === true && o2.body.position.id === o1.body.position.id, { id: o2.body.position && o2.body.position.id, idem: o2.body.idempotent });
  let op = await opens(); chk('journal holds one open after two calls', op.length === 1, { opens: op.length });
  const srv = op[0] || {};
  // ---- 2. sync twins
  const twinNoCid = { id: String(Date.now()) + '_1', ts: Date.now(), sym: 'BTC', side: 'long', lev: 5, margin: 100, riskAmt: 100, entry: +srv.entry || 1, qty: (+srv.qty || 1), notional: 500, liq: +srv.liq || 1, mmr: 0.005, feeRate: 0.00055, status: 'open', pnl: null };
  const push = (arr) => post('/api/auth/trades', { journal: arr }, CK);
  let r = await push([srv, twinNoCid]); op = await opens();
  chk('old-bundle twin (no cid, same sym/side/lev, margin within 5%, within 90 s) is dropped by the sync', r.status === 200 && op.length === 1 && /^srv/.test(op[0].id), { status: r.status, opens: op.length });
  const legit = Object.assign({}, twinNoCid, { id: String(Date.now()) + '_2', sym: 'ETH', cid: 'c9' + TAG });
  r = await push([srv, legit]); op = await opens();
  chk('a different symbol with its own cid is kept (2 opens)', op.length === 2, { opens: op.map(t => t.sym) });
  const twinCid = Object.assign({}, twinNoCid, { id: String(Date.now()) + '_3', cid: 'c1' + TAG, margin: 100 });
  r = await push([srv, legit, twinCid]); op = await opens();
  chk('a local fallback carrying the server position\'s cid is dropped', op.length === 2, { opens: op.map(t => t.sym + ':' + (t.cid || '-')) });
  const bigger = Object.assign({}, twinNoCid, { id: String(Date.now()) + '_4', margin: 200, riskAmt: 200 });
  r = await push([srv, legit, bigger]); op = await opens();
  chk('same coin but a different size (outside 5%) is a real second position and stays', op.length === 3, { opens: op.map(t => t.sym + ':' + t.margin) });
  await sleep(2000); // the ops row is pushed after the sync answers
  const act = (await fetch(ORIGIN + '/api/admin/activity?h=1&n=300&e2e=1&actor=u:e2e_' + uidE.toLowerCase(), { headers: H }).then(jget)).body;
  chk('ops activity records the dropped twin (type twin, e2 tagged)', (act.rows || []).some(x => x.t === 'twin'), { types: Array.from(new Set((act.rows || []).map(x => x.t))) });
  // ---- 3. the terminal, with the server made slow: the exact condition that doubled trades
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_uid', value: uidE, domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_un', value: 'e2e_' + uidE, domain: 'marginpad.io', path: '/', secure: true });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    await page.setRequestInterception(true); let opened = 0;
    page.on('request', req => { const u = req.url(); if (u.indexOf('/api/trade/open') > 0) { opened++; setTimeout(() => { try { req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); } catch (e) {} }, 3000); return; } if (u.indexOf('/api/auth/trades') > 0 || u.indexOf('/api/track') > 0) { try { req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); } catch (e) {} return; } try { req.continue(); } catch (e) {} });
    await page.goto(ORIGIN + '/paper-trade?coin=SOL&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
    let live = false; for (let w = 0; w < 60; w++) { await sleep(500); live = await page.evaluate(() => !!(window.mpPlanLive && window.mpPlanLive.sym === 'SOL' && +window.mpPlanLive.price > 0 && Date.now() - window.mpPlanLive.t < 3000 && window.mpAuth && window.mpAuth.me && window.mpAuth.me() && document.getElementById('planSave'))); if (live) break; }
    chk('browser: terminal signed in with a live SOL price', live);
    const before = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.status !== 'win' && t.status !== 'loss' && t.sym === 'SOL').length; } catch (e) { return -1; } });
    await page.evaluate(() => { const a = document.getElementById('planAmt'); if (a) a.value = '100'; const l = document.getElementById('planLev'); if (l) l.value = '5'; ['input', 'change'].forEach(ev => { if (a) a.dispatchEvent(new Event(ev, { bubbles: true })); if (l) l.dispatchEvent(new Event(ev, { bubbles: true })); }); });
    await page.click('#planSave'); await sleep(700);
    const waiting = await page.evaluate(() => { const b = document.getElementById('planSave'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : ''; });
    chk('browser: the button says "Opening…" while the slow server open is in flight (no local trade yet)', /Opening/.test(waiting), { waiting });
    await page.click('#planSave'); // an impatient second click must not open anything
    await sleep(9000);
    const after = await page.evaluate(() => { try { const j = (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.status !== 'win' && t.status !== 'loss' && t.sym === 'SOL'); return { n: j.length, ids: j.map(t => String(t.id).slice(0, 5)), cid: j.map(t => t.cid || '-') }; } catch (e) { return { n: -1 }; } });
    chk('browser: exactly ONE SOL position locally, and it is the server one (srv id)', after.n === before + 1 && after.ids.every(i => i === 'srvmt' || /^srv/.test(i)), { before, after, opened });
    const srvOp = (await opens()).filter(t => t.sym === 'SOL');
    chk('browser: exactly ONE SOL position on the server, one /api/trade/open request', srvOp.length === 1 && opened === 1, { srv: srvOp.length, requests: opened });
    chk('browser: no page errors', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  });
  // ---- cleanup
  try { await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }); } catch (e) {}
  try { await post('/api/admin/activity?purge=' + encodeURIComponent(TAG)); } catch (e) {}
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' - ' + f + ' FAIL' : ''));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });

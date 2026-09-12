/* Profile card records + DM thread refresh + fee-breakdown MEXC line + homepage tape (2026-09-12, owner reports).
   1. /api/lb/user records are SEASON records from the close ledger (scope:"season"); the card tiles never overflow (compact values)
   2. a DM thread polls: a reply sent by the other member appears in the open thread without closing it (<= 6 s)
   3. the fee breakdown's MEXC line prints MEXC's cost for the SAME round trip (smaller than what was paid), never the paid fee
   4. the mobile homepage tape is sticky under the header, has a fixed slot per coin and does not rebuild its DOM
   Two throwaway members (POST /api/admin/e2euser), removed at the end. Run: node build/card-dm-fee-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const TAG = Math.random().toString(36).slice(2, 8), A = 'e2ecdA' + TAG, B = 'e2ecdB' + TAG;
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(jget);
const ck = (uid, tok) => ({ cookie: 'mp_sess=' + tok + '; mp_uid=' + uid + '; mp_un=e2e_' + uid });
const cookies = (uid, tok) => [{ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_uid', value: uid, domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_un', value: 'e2e_' + uid, domain: 'marginpad.io', path: '/', secure: true }];
(async () => {
  const sa = await post('/api/admin/e2euser', { uid: A, op: 'sess' }), sb = await post('/api/admin/e2euser', { uid: B, op: 'sess' });
  const ta = sa.body.token || '', tb = sb.body.token || ''; chk('two throwaway members', !!ta && !!tb); if (!ta || !tb) { console.log(out.join('\n')); process.exit(1); }
  try {
    // ---- 1. records: a season close for A, then the card
    const o1 = await post('/api/trade/open', { sym: 'BTC', side: 'long', lev: 5, margin: 1234.56, cid: 'r' + TAG }, ck(A, ta));
    const pid = o1.body.position && o1.body.position.id; chk('member A opens a position', !!pid, { status: o1.status });
    if (pid) { const c1 = await post('/api/trade/close', { id: pid, pct: 100 }, ck(A, ta)); chk('member A closes it (a season close event)', c1.status === 200 && c1.body.ok !== false, { status: c1.status, err: c1.body.error }); }
    await sleep(1500);
    const card = await fetch(ORIGIN + '/api/lb/user?name=e2e_' + A + '&cb=' + Date.now(), { headers: { accept: 'application/json' } }).then(jget);
    const R = card.body.records || {};
    chk('card records are SEASON records from the close ledger (scope season, 1 close counted)', R.scope === 'season' && R.closes >= 1 && (R.pnl != null || R.roe != null || R.day >= 1), R);
    const papis = await fetch(ORIGIN + '/api/lb/user?name=Papis&cb=' + Date.now(), { headers: { accept: 'application/json' } }).then(jget);
    chk('Papis: season records carry real values (owner: "he has better records")', papis.body.records && papis.body.records.scope === 'season' && papis.body.records.pnl > 0, papis.body.records);
    // ---- 2 + 3 + 4 in the browser
    await withBrowser(async (browser) => {
      // card tiles + fee line as member A on desktop /paper-trade
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 1366, height: 900 }); await page.setCookie(...cookies(A, ta));
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      // the card with records lives in mp-profile.js, shipped by /season/, /levels/, /rekt/, /rewards/ (the bento homepage has its own inline card without records)
      await page.goto(ORIGIN + '/season/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(2500);
      await page.evaluate(() => { if (window.mpOpenProfile) window.mpOpenProfile('Papis'); }); await sleep(3500);
      const tiles = await page.evaluate(() => { const h = document.querySelector('.lbm-rech'); const bs = Array.prototype.map.call(document.querySelectorAll('.lbm-r b'), b => ({ t: b.textContent, over: b.scrollWidth > b.clientWidth + 1 })); return { head: h ? h.textContent.replace(/\s+/g, ' ').trim() : null, bs }; });
      chk('profile card (Papis): "Records this season" heading, every value fits its tile', !!tiles.head && /this season/.test(tiles.head) && tiles.bs.length > 0 && tiles.bs.every(b => !b.over), tiles);
      await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(3500);
      // fee line: open My Trades, Closed tab, the fees chip on the newest closed ticket
      await page.evaluate(() => { const b = document.querySelector('[data-mytrades]'); if (b) b.click(); }); await sleep(1500);
      await page.evaluate(() => { const t = document.querySelector('#jrList [data-jt="closed"]'); if (t) t.click(); }); await sleep(800);
      const fee = await page.evaluate(() => { const chip = document.querySelector('#jrList .pp .pp-fee'); if (!chip) return { none: true }; chip.click(); const bd = document.querySelector('#jrList .pp-feebd'); if (!bd) return { nobd: true }; const mx = bd.querySelector('.fb-mx'); const legs = Array.prototype.map.call(bd.querySelectorAll('.fb-r b'), b => b.textContent); return { legs, mx: mx ? mx.textContent.replace(/\s+/g, ' ').trim() : null }; });
      const nums = fee.mx ? (fee.mx.match(/\$[\d,.]+/g) || []).map(s => +s.replace(/[$,]/g, '')) : [];
      chk('fee breakdown: the MEXC line prints MEXC\'s own cost for this round trip, smaller than what was paid', !!fee.mx && /instead of/.test(fee.mx) && nums.length >= 3 && nums[0] < nums[1] && Math.abs(nums[1] - nums[0] - nums[2]) < 0.02, fee);
      chk('desktop: no page errors', errs.length === 0, errs);
      // DM: A follows B and B follows A (mutual), A opens the thread, B replies through the API, A sees it without reopening
      const fa = await post('/api/lb/follow', { tuid: B, tname: 'e2e_' + B }, ck(A, ta)); const fb = await post('/api/lb/follow', { tuid: A, tname: 'e2e_' + A }, ck(B, tb));
      chk('A and B follow each other', fa.status === 200 && fb.status === 200, { fa: fa.body, fb: fb.body });
      let polls = 0; await page.setRequestInterception(true); page.on('request', req => { if (req.url().indexOf('/api/dm/thread') > 0) polls++; try { req.continue(); } catch (e) {} });
      await page.evaluate((n) => { if (window.mpAuth && window.mpAuth.dm) window.mpAuth.dm(n); }, 'e2e_' + B); await sleep(2500);
      const opened = await page.evaluate(() => !!document.getElementById('mpaDmScroll'));
      chk('A opened the DM thread with B', opened);
      const sent = await post('/api/dm/send', { to: 'e2e_' + A, text: 'ping ' + TAG }, ck(B, tb)); chk('B sends A a message through the API', sent.status === 200 && sent.body.ok === true, sent.body);
      let seen = false; for (let w = 0; w < 16; w++) { await sleep(500); seen = await page.evaluate((t) => { const s = document.getElementById('mpaDmScroll'); return !!(s && s.textContent.indexOf('ping ' + t) >= 0); }, TAG); if (seen) break; }
      chk('the reply appears in the OPEN thread within 8 s (no close/reopen), thread polled', seen && polls >= 2, { seen, polls });
      await ctx.close();
      // 4. tape on the mobile homepage (guest)
      const pg = await browser.newPage(); await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await pg.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(2500);
      const t1 = await pg.evaluate(() => { const m = document.querySelector('.mpqm'); if (!m) return { none: true }; const cs = getComputedStyle(m); const hd = document.querySelector('header'); const trk = document.getElementById('mpqMT'); return { pos: cs.position, top: Math.round(parseFloat(cs.top)), hdrH: hd.offsetHeight, kids: trk.children.length, btc: (trk.querySelector('[data-tp="BTC"] [data-p]') || {}).textContent, first: trk.firstElementChild }; });
      await sleep(4000);
      const t2 = await pg.evaluate(() => { const trk = document.getElementById('mpqMT'); return { kids: trk.children.length, btc: (trk.querySelector('[data-tp="BTC"] [data-p]') || {}).textContent, sameFirst: trk.firstElementChild === window.__tapeFirst }; });
      await pg.evaluate(() => { window.__tapeFirst = document.getElementById('mpqMT').firstElementChild; });
      await sleep(3200);
      const t3 = await pg.evaluate(() => { const trk = document.getElementById('mpqMT'); return { sameFirst: trk.firstElementChild === window.__tapeFirst, rect: Math.round(document.querySelector('.mpqm').getBoundingClientRect().top) }; });
      chk('mobile tape: sticky right under the header, 13 fixed slots, BTC filled, DOM nodes reused across ticks', t1.pos === 'sticky' && t1.top === t1.hdrH && t1.kids === 13 && t2.kids === 13 && /\d/.test(String(t2.btc)) && t3.sameFirst === true, { t1: { pos: t1.pos, top: t1.top, hdrH: t1.hdrH, kids: t1.kids }, btc: t2.btc, reused: t3.sameFirst });
      await pg.evaluate(() => window.scrollTo(0, 900)); await sleep(600);
      const t4 = await pg.evaluate(() => { const r = document.querySelector('.mpqm').getBoundingClientRect(); const hd = document.querySelector('header').getBoundingClientRect(); return { tapeTop: Math.round(r.top), hdrBottom: Math.round(hd.bottom), visible: r.top >= hd.bottom - 1 && r.top < 200 }; });
      chk('mobile tape: after scrolling it sits below the header, not under it', t4.visible, t4);
      await pg.close();
    });
  } finally { await post('/api/admin/e2euser', { uid: A, op: 'rm' }).catch(() => {}); await post('/api/admin/e2euser', { uid: B, op: 'rm' }).catch(() => {}); }
  console.log(out.join('\n')); const bad = out.filter(l => l.indexOf('FAIL') === 0).length; console.log('\n' + (out.length - bad) + '/' + out.length + ' PASS'); process.exit(bad ? 1 : 0);
})();

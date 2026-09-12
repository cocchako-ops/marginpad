/* Double-tap E2E (2026-09-12): three openers had no busy guard, so a second tap while the server open was in flight opened a SECOND
   real position (two cids, so the twin guard could not catch it): the mobile Paper Trade terminal (#mtpGo), the /charts quick trade
   (.cqt-open) and the mobile charts trade sheet (#mtrGo). Each case: two clicks 60 ms apart -> exactly ONE open on the server.
   Also prints whether the shared bottom bar's Chat is reachable on mobile /charts (diagnostic).
   Throwaway member via POST /api/admin/e2euser, removed at the end. Run: node build/dbltap-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 240) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const TAG = Math.random().toString(36).slice(2, 8), uidE = 'e2edbl' + TAG;
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(jget);
const opens = async (sym) => { const j = (await fetch(ORIGIN + '/api/admin/journal?uid=' + uidE, { headers: H }).then(jget)).body; const arr = j.journal || j.trades || (Array.isArray(j) ? j : []); return arr.filter(t => t && t.status !== 'win' && t.status !== 'loss' && (!sym || t.sym === sym)); };
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
(async () => {
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' }); const tok = se.body.token || '';
  chk('throwaway member + session', se.status === 200 && !!tok, { status: se.status }); if (!tok) { console.log(out.join('\n')); process.exit(1); }
  const cookies = [{ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_uid', value: uidE, domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_un', value: 'e2e_' + uidE, domain: 'marginpad.io', path: '/', secure: true }];
  const prep = async (browser, mobile) => { const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); if (mobile) { await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await page.setUserAgent(UA); } else await page.setViewport({ width: 1366, height: 900 }); await page.setCookie(...cookies); await page.setRequestInterception(true); const st = { opens: 0, errs: [] }; page.on('request', req => { const u = req.url(); if (u.indexOf('/api/trade/open') > 0) st.opens++; if (/\/api\/(trade\/open|auth\/trades|track)/.test(u)) { try { req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); } catch (e) {} return; } try { req.continue(); } catch (e) {} }); page.on('pageerror', e => st.errs.push(String(e.message).slice(0, 120))); return { ctx, page, st }; };
  const dbl = async (page, sel) => { await page.evaluate((s) => { const b = document.querySelector(s); b.scrollIntoView({ block: 'center' }); b.click(); setTimeout(() => b.click(), 60); }, sel); await sleep(6000); };
  try {
    await withBrowser(async (browser) => {
      // ---- a. mobile Paper Trade plan form (the #mtpGo "living terminal" shows only on the old landing, never on /paper-trade)
      { const { ctx, page, st } = await prep(browser, true);
        await page.goto(ORIGIN + '/paper-trade?coin=SOL&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
        let ready = false; for (let w = 0; w < 60; w++) { await sleep(500); ready = await page.evaluate(() => !!(document.getElementById('planSave') && window.mpAuth && window.mpAuth.me && window.mpAuth.me() && window.mpPlanLive && window.mpPlanLive.sym === 'SOL' && +window.mpPlanLive.price > 0 && Date.now() - window.mpPlanLive.t < 3000)); if (ready) break; }
        chk('mobile plan form: member, live SOL price', ready);
        if (ready) { await page.evaluate(() => { const a = document.getElementById('planAmt'); if (a) a.value = '100'; const l = document.getElementById('planLev'); if (l) l.value = '5'; ['input', 'change'].forEach(ev => { if (a) a.dispatchEvent(new Event(ev, { bubbles: true })); if (l) l.dispatchEvent(new Event(ev, { bubbles: true })); }); }); await dbl(page, '#planSave'); const op = await opens('SOL'); chk('mobile plan form: two taps 60 ms apart = ONE server position, one /api/trade/open', op.length === 1 && st.opens === 1, { server: op.length, requests: st.opens }); }
        chk('mobile plan form: no page errors', st.errs.length === 0, st.errs); await ctx.close(); }
      // ---- b. desktop /charts quick trade (#cwsTrade in the side panel opens the modal)
      { const { ctx, page, st } = await prep(browser, false);
        await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(4000);
        const opened = await page.evaluate(() => { const b = document.querySelector('#cwsTrade'); if (!b) return 'no-btn'; b.click(); return !!document.querySelector('.cqt-modal:not([hidden])'); });
        chk('quick trade: modal opens from a chart window', opened === true, opened);
        if (opened === true) { await page.evaluate(() => { const s = document.querySelector('.cqt-sym'); if (s) { s.value = 'ETH'; s.dispatchEvent(new Event('change', { bubbles: true })); } const a = document.querySelector('.cqt-amt'); a.value = '100'; a.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(2500);
          await dbl(page, '.cqt-open'); const op = await opens('ETH'); chk('quick trade: two clicks 60 ms apart = ONE server position, one request', op.length === 1 && st.opens === 1, { server: op.length, requests: st.opens }); }
        chk('quick trade: no page errors', st.errs.length === 0, st.errs); await ctx.close(); }
      // ---- c. mobile /charts trade sheet
      { const { ctx, page, st } = await prep(browser, true);
        await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(4000);
        const diag = await page.evaluate(() => { const c = document.querySelector('[data-mpbn="chat"]'); if (!c) return 'no-bar'; const r = c.getBoundingClientRect(); const cs = getComputedStyle(c.closest('.mpbn')); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { display: cs.display, top: Math.round(r.top), hit: hit ? hit.tagName + '.' + hit.className : null, reach: !!(hit && (hit === c || c.contains(hit))) }; });
        out.push('INFO mobile /charts bottom-bar Chat: ' + JSON.stringify(diag));
        const sheet = await page.evaluate(() => { const b = document.querySelector('[data-act="trade"]'); if (!b) return 'no-btn'; b.click(); return !!document.getElementById('mtrGo'); });
        chk('mobile charts: trade sheet opens', sheet === true, sheet);
        if (sheet === true) { await page.evaluate(() => { const a = document.getElementById('mtrAmt'); if (a) { a.value = '100'; a.dispatchEvent(new Event('input', { bubbles: true })); } }); await sleep(1500);
          const before = (await opens()).length;
          await dbl(page, '#mtrGo'); const op = await opens(); chk('mobile charts: two taps 60 ms apart = ONE new server position, one request', op.length === before + 1 && st.opens === 1, { before, after: op.length, requests: st.opens }); }
        chk('mobile charts: no page errors', st.errs.length === 0, st.errs); await ctx.close(); }
    });
  } finally { await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }).catch(() => {}); }
  console.log(out.join('\n')); const checks = out.filter(l => !l.startsWith('INFO')), bad = checks.filter(l => l.indexOf('FAIL') === 0).length; console.log('\n' + (checks.length - bad) + '/' + checks.length + ' PASS'); process.exit(bad ? 1 : 0);
})();

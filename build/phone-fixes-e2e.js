// three phone fixes, measured in a browser against production:
//  A. cookie notice: html.mp-ckbar while mounted, the header does NOT add the top inset again, OK removes the class
//  B. chat look follows the account: set size L as a member, open a NEW context with the session cookie only (storage wiped) -> ct-fs-l back
//  C. cold start with ?chat=1: the room stays on the newest message while rows grow late (Safari has no scroll anchoring - we fake late growth)
const fs = require('fs');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const KEY = (fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io', H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const J = (u, o) => fetch(B + u, o).then(r => r.json());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = 'e2e-phfix';
let pass = 0, fail = 0; const ok = (c, m, d) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 240) : '')); };
(async () => {
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
  const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) }); const tok = se.token || se.sess;
  await withBrowser(async (browser) => {
    const mk = async (withSess) => { const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); page._errs = []; page.on('pageerror', e => page._errs.push(String(e.message).slice(0, 120))); if (withSess) await page.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' }); return { ctx, page }; };
    // ---- A. cookie notice
    { const { ctx, page } = await mk(false);
      await page.goto(B + '/paper-trade?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForSelector('#mpCkBar', { timeout: 15000 }).catch(() => {});
      const a = await page.evaluate(() => { const b = document.getElementById('mpCkBar'); const h = document.querySelector('body>.wrap>header,body>header'); const cs = h && getComputedStyle(h); return { bar: !!b, cls: document.documentElement.classList.contains('mp-ckbar'), headPad: cs && cs.paddingTop, barBottom: b && Math.round(b.getBoundingClientRect().bottom), headTop: h && Math.round(h.getBoundingClientRect().top) }; });
      ok(a.bar && a.cls && a.headPad === '14px' && a.headTop - a.barBottom <= 1, 'A: notice mounted, html.mp-ckbar set, header padding 14px (no second inset), header starts right under the notice', a);
      await page.evaluate(() => document.getElementById('mpCkOk').click()); await sleep(300);
      const a2 = await page.evaluate(() => ({ bar: !!document.getElementById('mpCkBar'), cls: document.documentElement.classList.contains('mp-ckbar'), ls: !!localStorage.getItem('mp_ck_ok'), ck: /mp_ck_ok=1/.test(document.cookie) }));
      ok(!a2.bar && !a2.cls && a2.ls && a2.ck, 'A: OK removes the notice and the class, and writes both the local flag and the cookie', a2);
      await ctx.close(); }
    // ---- B. chat prefs follow the account
    { const { ctx, page } = await mk(true);
      await page.goto(B + '/paper-trade?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction("window.mpChatPrefs && window.mpAuth", { timeout: 30000 });
      await page.evaluate(() => { window.mpChatPrefs.set('size', 'l'); window.mpChatPrefs.set('trades', 'link'); });
      await sleep(1500);
      const srv = await page.evaluate(async () => { const r = await fetch('/api/push/device'); return r.json(); });
      ok(srv && srv.prefs && srv.prefs.chat && srv.prefs.chat.v && srv.prefs.chat.v.size === 'l' && srv.prefs.chat.v.trades === 'link', 'B: a change is written to the account (GET /api/push/device carries it)', srv && srv.prefs && srv.prefs.chat);
      await ctx.close();
      // a fresh device: session cookie only, nothing in storage
      const f = await mk(true);
      await f.page.goto(B + '/paper-trade?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await f.page.waitForFunction("window.mpChatPrefs && document.getElementById('chatBox') && document.getElementById('chatBox').classList.contains('ct-fs-l')", { timeout: 25000 }).catch(() => {});
      const b = await f.page.evaluate(() => ({ cls: document.getElementById('chatBox').className, get: window.mpChatPrefs.get(), ls: localStorage.getItem('mp_ct_prefs') }));
      ok(/ct-fs-l/.test(b.cls) && b.get.size === 'l' && b.get.trades === 'link' && /"size":"l"/.test(b.ls || ''), 'B: LOAD-BEARING - a device with no local copy gets the account\'s chat look back and rewrites its local copy', b);
      await f.ctx.close(); }
    // ---- C. cold start with the chat open: the room stays on the newest message while rows grow late
    { const { ctx, page } = await mk(true);
      await page.goto(B + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction("document.getElementById('ctMsgs') && document.querySelectorAll('#ctMsgs .ct-msg').length > 5", { timeout: 40000 }).catch(() => {});
      await sleep(2500);
      const gap0 = await page.evaluate(() => { const m = document.getElementById('ctMsgs'); return Math.round(m.scrollHeight - m.scrollTop - m.clientHeight); });
      // fake LATE hydration far above the view: grow the first ten rows by 120px each, 6 s after the open (past the old 2 s pin and inside what used to be a 12 s watch)
      await sleep(4000);
      await page.evaluate(() => { const rows = document.querySelectorAll('#ctMsgs .ct-msg'); for (let i = 0; i < 10 && i < rows.length; i++) { const d = document.createElement('div'); d.style.height = '120px'; d.className = 'e2e-grow'; rows[i].appendChild(d); } });
      await sleep(700);
      const gap1 = await page.evaluate(() => { const m = document.getElementById('ctMsgs'); return Math.round(m.scrollHeight - m.scrollTop - m.clientHeight); });
      // and again at 15 s after open, past the retired 12 s watch window
      await sleep(8000);
      await page.evaluate(() => { const rows = document.querySelectorAll('#ctMsgs .ct-msg'); for (let i = 10; i < 20 && i < rows.length; i++) { const d = document.createElement('div'); d.style.height = '120px'; d.className = 'e2e-grow'; rows[i].appendChild(d); } });
      await sleep(700);
      const gap2 = await page.evaluate(() => { const m = document.getElementById('ctMsgs'); return Math.round(m.scrollHeight - m.scrollTop - m.clientHeight); });
      ok(gap0 <= 2 && gap1 <= 2 && gap2 <= 2, 'C: LOAD-BEARING - opened on ?chat=1 the room is on the newest message, and stays there through 1,200px of late growth at 6 s AND at 15 s', { gap0, gap1, gap2 });
      // the reader scrolls up -> nothing pulls them back
      await page.evaluate(() => { const m = document.getElementById('ctMsgs'); m.scrollTop = m.scrollTop - 600; m.dispatchEvent(new Event('scroll')); });
      await sleep(300);
      await page.evaluate(() => { const rows = document.querySelectorAll('#ctMsgs .ct-msg'); const r = rows[rows.length - 1]; const d = document.createElement('div'); d.style.height = '200px'; r.appendChild(d); });
      await sleep(600);
      const gap3 = await page.evaluate(() => { const m = document.getElementById('ctMsgs'); return Math.round(m.scrollHeight - m.scrollTop - m.clientHeight); });
      ok(gap3 >= 500, 'C: once the reader scrolled up, late growth does not pull the view back down', { gap3 });
      ok(page._errs.length === 0, 'C: no page errors', page._errs);
      await ctx.close(); }
  });
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log('\nphone-fixes: pass ' + pass + '  fail ' + fail);
})().catch(e => { console.error(e); process.exit(1); });

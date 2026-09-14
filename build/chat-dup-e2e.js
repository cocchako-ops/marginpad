/* Chat-tap duplicate + room selector E2E (2026-09-12; owner: "the duplicate trade still shows up for the user", "the chat sometimes
   has the room dropdown and sometimes not").
   Measured cause: home.js never exported window.mpOpenChat, so mp-nav's bottom-bar Chat (window.mpEnsureChat) pulled mp-trade.js on
   top of the app shell. That bundle bound a SECOND, local-only add() to #planSave (every open after a Chat tap filed a twin next to
   the server position: 70 twin drops in 7 days, all mobile) and wired a SECOND chat (the room selector came and went depending on
   which copy rendered). The Premium room entry also depended on window._mpPrem, filled by the /api/auth/xp poll - often after the
   chat was opened, so the selector was skipped and never rebuilt.
   Proves on production:
     1. mobile /paper-trade as a member: mpOpenChat exists before any tap; the bottom-bar Chat opens the chat in place WITHOUT loading
        mp-trade.js; one chat box; one Open click = exactly ONE position (server id), ONE /api/trade/open request
     2. a limit refusal (rate_limited) never becomes a local open
     3. Premium member: the chat opened the instant the FAB exists (before the xp poll answers) still grows the room selector with the
        Premium entry within 6 s - app shell (home.js chat) AND homepage (mp-trade.js chat)
   Throwaway member via POST /api/admin/e2euser (+ a temporary Premium grant), removed at the end. Run: node build/chat-dup-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const TAG = Math.random().toString(36).slice(2, 8), uidE = 'e2echat' + TAG, UN = 'e2e_' + uidE;
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(jget);
const get = (p) => fetch(ORIGIN + p, { headers: H }).then(jget);
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
(async () => {
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' }); const tok = se.body.token || '';
  chk('throwaway member + session', se.status === 200 && !!tok, { status: se.status });
  if (!tok) { console.log(out.join('\n')); process.exit(1); }
  const cookies = [{ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_uid', value: uidE, domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_un', value: UN, domain: 'marginpad.io', path: '/', secure: true }];
  const tagReq = (page, extra) => { page.on('request', req => { const u = req.url(); if (extra && extra(req)) return; if (/\/api\/(trade\/open|auth\/trades|track)/.test(u)) { try { req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); } catch (e) {} return; } try { req.continue(); } catch (e) {} }); };
  try {
    await withBrowser(async (browser) => {
      // ---- 1. mobile app shell: Chat tap must not load mp-trade.js; one click = one position
      {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await page.setUserAgent(UA);
        await page.setCookie(...cookies); await page.setRequestInterception(true); let opens = 0;
        tagReq(page, (req) => { if (req.url().indexOf('/api/trade/open') > 0) opens++; return false; });
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
        await page.goto(ORIGIN + '/paper-trade?coin=SOL&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
        let live = false; for (let w = 0; w < 60; w++) { await sleep(500); live = await page.evaluate(() => !!(window.mpPlanLive && window.mpPlanLive.sym === 'SOL' && +window.mpPlanLive.price > 0 && window.mpAuth && window.mpAuth.me && window.mpAuth.me() && document.getElementById('planSave'))); if (live) break; }
        chk('phone: terminal signed in with a live SOL price', live);
        const pre = await page.evaluate(() => ({ openChat: typeof window.mpOpenChat, tradeJs: !!document.querySelector('script[src*="mp-trade.js"]'), bar: !!document.querySelector('[data-mpbn="chat"]') }));
        chk('phone: home.js exports window.mpOpenChat before any tap; mp-trade.js not on the page', pre.openChat === 'function' && !pre.tradeJs && pre.bar, pre);
        await page.click('[data-mpbn="chat"]'); await sleep(2500);
        const post1 = await page.evaluate(() => ({ tradeJs: !!document.querySelector('script[src*="mp-trade.js"]'), open: !!(document.getElementById('chatBox') && !document.getElementById('chatBox').hidden), boxes: document.querySelectorAll('#chatBox').length, msgs: document.querySelectorAll('#ctMsgs').length }));
        chk('phone: bottom-bar Chat opens the chat in place, mp-trade.js NOT loaded, one chat box', post1.open && !post1.tradeJs && post1.boxes === 1 && post1.msgs === 1, post1);
        await page.evaluate(() => { const x = document.getElementById('ctClose'); if (x) x.click(); }); await sleep(300);
        await page.evaluate(() => { const a = document.getElementById('planAmt'); if (a) a.value = '100'; const l = document.getElementById('planLev'); if (l) l.value = '5'; ['input', 'change'].forEach(ev => { if (a) a.dispatchEvent(new Event(ev, { bubbles: true })); if (l) l.dispatchEvent(new Event(ev, { bubbles: true })); }); });
        await page.evaluate(() => document.getElementById('planSave').click()); await sleep(4500);
        const j = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.status !== 'win' && t.status !== 'loss' && t.sym === 'SOL').map(t => ({ id: String(t.id).slice(0, 3), cid: !!t.cid })); } catch (e) { return [String(e)]; } });
        chk('phone: one Open click after the Chat tap = exactly ONE SOL position, the server one, one request', j.length === 1 && j[0].id === 'srv' && opens === 1, { j, opens });
        // ---- 2. a limit refusal is a message, not a local open
        await page.setRequestInterception(true);
        page.removeAllListeners('request');
        page.on('request', req => { const u = req.url(); if (u.indexOf('/api/trade/open') > 0) { try { req.respond({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'rate_limited', max: 20 }) }); } catch (e) {} return; } if (/\/api\/(auth\/trades|track)/.test(u)) { try { req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); } catch (e) {} return; } try { req.continue(); } catch (e) {} });
        await sleep(1200);
        await page.evaluate(() => { const s = document.getElementById('planSym'); if (s) { s.value = 'SOL'; } });
        await page.evaluate(() => document.getElementById('planSave').click()); await sleep(2500);
        const j2 = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.status !== 'win' && t.status !== 'loss' && t.sym === 'SOL').length; } catch (e) { return -1; } });
        const toast = await page.evaluate(() => (document.body.innerText.match(/opens per minute/) || [])[0] || '');
        chk('phone: a rate_limited refusal shows the limit and opens NOTHING locally', j2 === 1 && !!toast, { opens: j2, toast });
        chk('phone: no page errors', errs.length === 0, errs);
        await ctx.close();
      }
      // ---- 3. Premium member: chat opened before the xp poll answers still gets the room selector
      const g = await get('/api/admin/premium?add=' + encodeURIComponent(UN)); chk('temporary Premium grant for the throwaway member', g.status === 200, { status: g.status });
      for (const P of [{ url: '/paper-trade?cb=', label: 'app shell (home.js chat)', vp: { width: 1366, height: 900 } }, { url: '/?cb=', label: 'homepage (mp-trade.js chat)', vp: { width: 1366, height: 900 } }]) {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport(P.vp);
        await page.setCookie(...cookies); await page.setRequestInterception(true); tagReq(page);
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
        await page.goto(ORIGIN + P.url + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
        // open the chat the instant the FAB is clickable and the member is known - usually before _mpPrem is a boolean
        let st = null; for (let w = 0; w < 80; w++) { st = await page.evaluate(() => { const f = document.getElementById('chatFab'); const me = window.mpAuth && window.mpAuth.me && window.mpAuth.me(); if (!f || !me) return null; const premBefore = typeof window._mpPrem; f.click(); return { premBefore, open: !!(document.getElementById('chatBox') && !document.getElementById('chatBox').hidden) }; }); if (st) break; await sleep(150); }
        chk(P.label + ': chat opened as a member', !!(st && st.open), st);
        let sel = null; for (let w = 0; w < 40; w++) { await sleep(300); sel = await page.evaluate(() => { const s = document.querySelector('.ct-roomsel'); if (!s) return null; return { items: Array.prototype.map.call(s.querySelectorAll('[data-room]'), b => b.getAttribute('data-room')), prem: window._mpPrem }; }); if (sel && sel.items.indexOf('PREMIUM') >= 0) break; }
        chk(P.label + ': the room selector with the Premium entry exists within 6 s of opening (premium known before open: ' + (st && st.premBefore) + ')', !!(sel && sel.items.indexOf('PREMIUM') >= 0), sel);
        chk(P.label + ': no page errors', errs.length === 0, errs);
        await ctx.close();
      }
    });
  } finally {
    await get('/api/admin/premium?remove=' + encodeURIComponent(UN)).catch(() => {});
    await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }).catch(() => {});
  }
  console.log(out.join('\n')); const bad = out.filter(l => l.indexOf('FAIL') === 0).length; console.log('\n' + (out.length - bad) + '/' + out.length + ' PASS'); process.exit(bad ? 1 : 0);
})();

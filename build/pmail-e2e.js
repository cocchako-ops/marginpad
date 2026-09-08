/* Inbox > milan@ E2E (2026-09-08, owner: "ne vidim milan@ nigde na mp-ops, gde stize posta?").
   Proves on production: the status endpoint answers 200 for the admin (set / locked / count, never a 4xx the view walk would flag);
   the ops view renders the lock form (its own password, not the admin session) or the message list; milan@ is a sendable identity;
   "Reply from milan@" prefills the Email view (to, subject, from + reply-to); phone 390 reaches the password box.
   The owner's inbox password is never typed here, so an unlocked list is checked only when this browser already holds the cookie.
   Run: node build/pmail-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 240) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K };
(async () => {
  const st = await fetch(ORIGIN + '/api/admin/pmail/status', { headers: H }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  chk('status endpoint: 200 with set/locked/n (key auth)', st.status === 200 && typeof st.body.set === 'boolean' && typeof st.body.locked === 'boolean' && typeof st.body.n === 'number', st.body);
  const bare = await fetch(ORIGIN + '/api/admin/pmail/status').then(r => r.status);
  chk('status endpoint refuses a stranger', bare === 404 || bare === 401 || bare === 403, { bare });
  const data = await fetch(ORIGIN + '/api/admin/pmail/data', { headers: H }).then(r => r.status);
  chk('the mail itself stays behind the inbox password (admin key alone is refused)', data === 401, { data });
  const fr = await fetch(ORIGIN + '/api/admin/sendmail', { headers: H }).then(r => r.json()).catch(() => ({}));
  chk('milan@marginpad.io is a sendable identity', (fr.addresses || []).some(a => a.key === 'milan' && a.addr === 'milan@marginpad.io'), (fr.addresses || []).map(a => a.key));
  const sess = await (await fetch(ORIGIN + '/api/stats/session', { method: 'POST', headers: H })).json();
  chk('ops session minted', !!sess.ok);
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
    const errs = [], bad = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140))); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
    page.on('response', r => { try { const u = r.url(); if (u.indexOf(ORIGIN + '/api/') === 0 && r.status() >= 400) bad.push(r.status() + ' ' + u.slice(ORIGIN.length, ORIGIN.length + 60)); } catch (e) {} });
    await page.goto(ORIGIN + '/api/stats?cb=' + Date.now() + '#inbox/pmail', { waitUntil: 'load', timeout: 60000 });
    let v = null; for (let w = 0; w < 30; w++) { await sleep(500); v = await page.evaluate(() => { const lock = document.getElementById('pmPass'); const list = document.querySelector('.sup.pm'); if (!lock && !list) return null; return { lock: !!lock, list: !!list, rows: document.querySelectorAll('.sup.pm .sup-row').length, reply: !!document.querySelector('a[href^="#inbox/mail/"]'), nav: !!Array.from(document.querySelectorAll('#nav a')).filter(a => a.textContent.indexOf('milan@') >= 0)[0], text: (document.getElementById('view').innerText || '').replace(/\s+/g, ' ').slice(0, 160) }; }); if (v) break; }
    chk('browser: the milan@ view is in the Inbox nav and renders the lock form or the list', !!v && v.nav && (v.lock || v.list), v);
    if (v && v.lock) chk('browser: the lock form explains where the mail lands and asks for the inbox password', /milan@marginpad\.io/.test(v.text) && /password/i.test(v.text), { text: v.text });
    if (v && v.list) chk('browser: the list shows messages with a Reply from milan@ button', v.rows >= 0 && (v.rows === 0 || v.reply), { rows: v.rows, reply: v.reply });
    chk('browser: no failed admin fetch and no page error while the inbox is locked', bad.length === 0 && errs.length === 0, { bad: bad.slice(0, 3), errs: errs.slice(0, 3) });
    // Reply prefill: to, subject, from + reply-to
    await page.goto(ORIGIN + '/api/stats?cb=' + Date.now() + '#inbox/mail/' + encodeURIComponent('partner@moon.com') + '/' + encodeURIComponent('Re: MarginPad x Moon') + '/milan', { waitUntil: 'load', timeout: 60000 });
    let pf = null; for (let w = 0; w < 30; w++) { await sleep(500); pf = await page.evaluate(() => { const to = document.getElementById('mlTo'); if (!to) return null; return { to: to.value, subj: (document.getElementById('mlSubj') || {}).value, from: (document.getElementById('mlFrom') || {}).value, reply: (document.getElementById('mlReply') || {}).value, hasMilan: !!document.querySelector('#mlFrom option[value="milan"]') }; }); if (pf && pf.to) break; }
    chk('browser: Email view prefilled with to, subject, From milan@ and Reply-To milan@', !!pf && pf.to === 'partner@moon.com' && pf.subj === 'Re: MarginPad x Moon' && pf.from === 'milan' && pf.reply === 'milan' && pf.hasMilan, pf);
    // phone
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await page.goto(ORIGIN + '/api/stats?cb=' + Date.now() + '#inbox/pmail', { waitUntil: 'load', timeout: 60000 }); await sleep(3000);
    const ph = await page.evaluate(() => { const el = document.getElementById('pmPass') || document.querySelector('.sup.pm .sup-row') || document.querySelector('.sup.pm .empty'); if (!el) return { none: true }; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + Math.min(20, b.width / 2), b.top + b.height / 2); return { reach: !!hit && (el.contains(hit) || hit.contains(el)), sw: document.documentElement.scrollWidth, ww: window.innerWidth }; });
    chk('phone 390: the inbox control is reachable and nothing overflows', !ph.none && ph.reach && ph.sw <= ph.ww, ph);
    await ctx.close();
  });
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' — ' + f + ' FAIL' : ''));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });

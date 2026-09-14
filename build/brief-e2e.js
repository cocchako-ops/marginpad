/* Daily Brief v2 + DM-notification E2E (2026-09-12).
   Owner: "a DM notification must count as seen when I open the DM itself, without visiting the bell" and
   "pack the brief proposals into the profile card, tidy and good-looking".
   Proves, against prod, with throwaway members (POST /api/admin/e2euser):
     API  - /api/brief?teaser=1 is public and carries bias / setups / next event
          - /api/brief signed out -> 401; free member -> 402 WITH the teaser; Premium -> market + mine + you + prefs
          - POST /api/brief saves delivery prefs (h 16, push) and GET reads them back
          - a DM from A to B lights B's dm notification; B opening the thread (never the bell) clears it,
            the thread response carries notifUnread 0 and /api/auth/notifs agrees
     UI   - desktop + phone: the profile card shows the Today card with a teaser line; clicking it opens the brief
            with the reading-order sections; every control in it is reachable; a free member sees the lock.
   Run: node build/brief-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(jget);
const asUser = (tok, p, opts) => fetch(ORIGIN + p, Object.assign({ headers: Object.assign({ cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }, (opts && opts.headers) || {}) }, opts || {}, { headers: Object.assign({ cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }, (opts && opts.headers) || {}) })).then(jget);
const rnd = () => Math.random().toString(36).slice(2, 6);
const uidA = 'e2ebrfa' + rnd(), uidB = 'e2ebrfb' + rnd();
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 320) : '')); console.log(out[out.length - 1]); };

(async () => {
  let tokA = '', tokB = '', nameA = 'e2e_' + uidA, nameB = 'e2e_' + uidB;
  try {
    const mkA = await post('/api/admin/e2euser', { uid: uidA, op: 'mk' }), mkB = await post('/api/admin/e2euser', { uid: uidB, op: 'mk' });
    const sA = await post('/api/admin/e2euser', { uid: uidA, op: 'sess' }), sB = await post('/api/admin/e2euser', { uid: uidB, op: 'sess' });
    tokA = sA.body.token || ''; tokB = sB.body.token || '';
    chk('two throwaway members with sessions', mkA.status === 200 && mkB.status === 200 && !!tokA && !!tokB, { mkA: mkA.status, mkB: mkB.status });
    if (!tokA || !tokB) process.exit(1);

    // ---- teaser: public ----
    const tz = await fetch(ORIGIN + '/api/brief?teaser=1&cb=' + Date.now()).then(jget);
    chk('teaser is public and carries bias / setups / next', tz.status === 200 && typeof tz.body.setups === 'number' && ('bias' in tz.body) && ('next' in tz.body), tz.body);

    // ---- full: signed out / free / premium ----
    const anon = await fetch(ORIGIN + '/api/brief').then(jget);
    chk('full brief signed out -> 401', anon.status === 401, anon.status);
    const free = await asUser(tokB, '/api/brief');
    chk('free member -> 402 with the teaser attached', free.status === 402 && free.body.error === 'premium_required' && free.body.teaser && ('bias' in free.body.teaser), { status: free.status, teaser: free.body.teaser });
    const gr = await fetch(ORIGIN + '/api/admin/premium?add=' + encodeURIComponent(nameB) + '&days=1', { headers: H }).then(jget);
    chk('grant Premium to B for the test (admin)', gr.status === 200, gr.status);
    // fresh session: premiumFor reads the session user (cached) — mint a new one after the grant
    const sB2 = await post('/api/admin/e2euser', { uid: uidB, op: 'sess' }); tokB = sB2.body.token || tokB;
    await asUser(tokB, '/api/auth/xp', { method: 'POST', body: JSON.stringify({ ack: 1 }) }); // a freshly granted account would otherwise fire the Premium celebration overlay over the brief in the browser leg (test-only artefact)
    const full = await asUser(tokB, '/api/brief');
    const M = full.body.market || {};
    chk('Premium member -> full brief: market picture + majors + setups array', full.status === 200 && full.body.ok && M.bias && Array.isArray(M.majors) && Array.isArray(M.setups), { status: full.status, bias: M.bias, majors: (M.majors || []).length, setups: (M.setups || []).length, at: M.at });
    chk('full brief carries the personal blocks (mine array, you object or null, prefs)', Array.isArray(full.body.mine) && ('you' in full.body) && full.body.prefs && typeof full.body.prefs.push === 'boolean', { mine: full.body.mine.length, you: !!full.body.you, prefs: full.body.prefs });
    chk('an account with no closes gets a thin "you" (never a made-up pattern) or none', !full.body.you || full.body.you.thin === true || (full.body.you.week && full.body.you.week.n === 0), full.body.you && { n: full.body.you.week && full.body.you.week.n, thin: full.body.you.thin, findings: (full.body.you.findings || []).length });
    // prefs roundtrip
    const sv = await asUser(tokB, '/api/brief', { method: 'POST', body: JSON.stringify({ push: true, tg: true, h: 16 }) });
    chk('POST prefs saves push + hour; Telegram stays off without a linked chat', sv.status === 200 && sv.body.ok && sv.body.prefs.push === true && sv.body.prefs.h === 16 && sv.body.prefs.tg === false, sv.body);
    const rd = await asUser(tokB, '/api/brief');
    chk('GET reads the saved prefs back (h 16, push on)', rd.status === 200 && rd.body.prefs && rd.body.prefs.h === 16 && rd.body.prefs.push === true, rd.body.prefs);
    const svOff = await asUser(tokB, '/api/brief', { method: 'POST', body: JSON.stringify({ push: false, tg: false, h: 8 }) });
    chk('prefs off again (so the cron never mails a test account)', svOff.status === 200 && svOff.body.prefs.push === false, svOff.body.prefs);

    // ---- DM notification: seen on opening the thread ----
    const fo = await asUser(tokA, '/api/lb/follow', { method: 'POST', body: JSON.stringify({ tuid: uidB, tname: nameB }) }); // DMs need a follow (or an earlier thread) between the two — _canDm
    chk('A follows B (DMs are gated on a connection)', fo.status === 200 && (fo.body.following === true || fo.body.ok), fo.body);
    const dm = await asUser(tokA, '/api/dm/send', { method: 'POST', body: JSON.stringify({ to: nameB, text: 'brief e2e ' + Date.now() }) });
    chk('A sends B a DM', dm.status === 200 && dm.body.ok, dm.body);
    await sleep(600);
    const nf1 = await asUser(tokB, '/api/auth/notifs');
    const dmN = (nf1.body.notifs || []).filter(n => n.kind === 'dm' && !n.seen);
    chk('B has an unread dm notification (bell lit)', nf1.status === 200 && nf1.body.unread >= 1 && dmN.length >= 1, { unread: nf1.body.unread, dm: dmN.map(n => n.link) });
    const other1 = nf1.body.unread - dmN.length; // the follow above also left a "followed you" notification: that one must STAY unread (only the dm is being read)
    const th = await asUser(tokB, '/api/dm/thread?with=' + encodeURIComponent(nameA));
    chk('B opens the thread (never the bell): the response reports the remaining unread count (dm gone, follow kept)', th.status === 200 && th.body.ok && th.body.notifUnread === other1, { status: th.status, notifUnread: th.body.notifUnread, expected: other1, msgs: (th.body.messages || []).length });
    const nf2 = await asUser(tokB, '/api/auth/notifs');
    const dmN2 = (nf2.body.notifs || []).filter(n => n.kind === 'dm' && !n.seen);
    chk('the dm notification is seen; the other kinds are untouched', nf2.body.unread === other1 && dmN2.length === 0, { unread: nf2.body.unread, expected: other1, dmStillUnread: dmN2.length, kinds: (nf2.body.notifs || []).map(n => n.kind + (n.seen ? '' : '*')) });
    const xp = await asUser(tokB, '/api/auth/xp?fresh=1');
    chk('the badge poll agrees', xp.status === 200 && xp.body.notifUnread === other1, { notifUnread: xp.body.notifUnread, expected: other1 });

    // ---- browser ----
    await withBrowser(async (browser) => {
      for (const [w, h, label] of [[1366, 900, 'DESKTOP'], [390, 780, 'PHONE']]) {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: 2 });
        await page.setCookie(
          { name: 'mp_sess', value: tokB, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true },
          { name: 'mp_uid', value: uidB, domain: 'marginpad.io', path: '/', secure: true },
          { name: 'mp_un', value: nameB, domain: 'marginpad.io', path: '/', secure: true },
          { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/', secure: true },
          { name: 'mp_ck', value: '1', domain: 'marginpad.io', path: '/', secure: true });
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
        await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
        await sleep(4000);
        await page.evaluate(() => window.mpAuth.open());
        await sleep(2500);
        const card = await page.evaluate(() => { const b = document.getElementById('mpaBrief'); if (!b) return null; const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { cls: b.className, line: (document.getElementById('mpaTdyL') || {}).innerText || '', reach: !!(hit && (hit === b || b.contains(hit))), inView: r.top >= 0 && r.bottom <= innerHeight, newTag: !(document.getElementById('mpaTdyNew') || { hidden: true }).hidden }; });
        chk(label + ': the profile card shows the Today card with a live teaser line, reachable without scrolling', !!card && card.cls === 'mpa-tdy' && card.line.length > 8 && card.reach && card.inView, card);
        await page.click('#mpaBrief');
        await sleep(4500);
        await page.evaluate(() => { var lv = document.getElementById('mpxpLv'); if (lv) lv.classList.remove('on'); }); // belt: the centre celebration (level-up / Premium) is a legitimate overlay, not part of what this test measures
        const m = await page.evaluate(() => {
          const p = document.querySelector('.mpb'); if (!p) return null;
          const secs = Array.from(p.querySelectorAll('.mpb-s h4')).map(x => x.firstChild && x.firstChild.textContent.trim());
          const ctrls = Array.from(p.querySelectorAll('button,label,.mpb-seg b,.mpb-todo a')).map(b => { const q = b.getBoundingClientRect(); if (!q.width) return null; const hit = document.elementFromPoint(q.left + q.width / 2, Math.min(innerHeight - 1, Math.max(0, q.top + q.height / 2))); return { t: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 20), reach: !!(hit && (hit === b || b.contains(hit) || (hit.closest && hit.closest('label,button,a') === b))), off: q.top < 0 || q.bottom > innerHeight }; }).filter(Boolean);
          return { secs, bias: (p.querySelector('.mpb-bias b') || {}).innerText || '', todo: p.querySelectorAll('#mpbTodo a').length, unreach: ctrls.filter(c => !c.reach && !c.off).map(c => c.t), n: ctrls.length, op: getComputedStyle(p).opacity, w: Math.round(p.getBoundingClientRect().width), scrollable: p.scrollHeight > p.clientHeight || document.querySelector('.mpb-ov').scrollHeight > innerHeight, lock: !!p.querySelector('.mpb-lock'), newHidden: (document.getElementById('mpaTdyNew') || { hidden: false }).hidden };
        });
        chk(label + ': the brief opens with a bias line and the reading-order sections (positions, season, next up, setups, majors)', !!m && /Market/.test(m.bias) && ['Your positions', 'Your season', 'Next up', 'Where the setups are', 'Majors'].every(s => m.secs.indexOf(s) >= 0), m && { bias: m.bias, secs: m.secs, w: m.w });
        chk(label + ': "Next up" filled from the season endpoints', !!m && m.todo >= 1, m && { todo: m.todo });
        chk(label + ': every on-screen control in the brief is reachable', !!m && m.unreach.length === 0 && m.n >= 6, m && { unreach: m.unreach, n: m.n });
        chk(label + ': no lock for a Premium member', !!m && !m.lock);
        chk(label + ': no page errors', errs.length === 0, errs.slice(0, 3));
        await page.screenshot({ path: path.join(__dirname, 'pt-shots', 'brief-' + label.toLowerCase() + '.png') });
        await ctx.close();
      }
      // free member sees the lock
      await fetch(ORIGIN + '/api/admin/premium?remove=' + encodeURIComponent(nameB), { headers: H });
      const sB3 = await post('/api/admin/e2euser', { uid: uidB, op: 'sess' }); const tokB3 = sB3.body.token || tokB;
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      await page.setCookie({ name: 'mp_sess', value: tokB3, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_uid', value: uidB, domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_ck', value: '1', domain: 'marginpad.io', path: '/', secure: true });
      await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
      await sleep(3500);
      await page.evaluate(() => window.mpBrief.show());
      await sleep(3500);
      const fr = await page.evaluate(() => { const p = document.querySelector('.mpb'); return p ? { lock: !!p.querySelector('.mpb-lock'), bias: (p.querySelector('.mpb-bias b') || {}).innerText || '', go: !!p.querySelector('#mpbGo') } : null; });
      chk('FREE member: the brief shows the market line and the Premium lock with a Go Premium button', !!fr && fr.lock && fr.go && /Market/.test(fr.bias), fr);
      await ctx.close();
    }, { timeoutMs: 420000 });
  } finally {
    try { await fetch(ORIGIN + '/api/admin/premium?remove=' + encodeURIComponent(nameB), { headers: H }); } catch (e) {}
    try { await post('/api/admin/e2euser', { uid: uidA, op: 'rm' }); } catch (e) {}
    try { await post('/api/admin/e2euser', { uid: uidB, op: 'rm' }); } catch (e) {}
  }
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();

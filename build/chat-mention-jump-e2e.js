/* A MENTION NOTIFICATION LANDS ON THE MESSAGE, AND THE MENTION TOAST IS TEXT SHOWN ONCE (2026-10-22).
   Malikush: "if I'm tagged on the chat section and am notified, if I click on it it doesn't take me directly to the
   message, instead it takes me to the recent message." Owner: a mention he had already read popped up again on return
   as "<b>@ibrar0805</b> mentioned you in chat" - brackets included. (The room socket connects only once the chat has
   been opened and reconnects on its own after a drop with a full history replay - that replay is where the old mention
   came back from, with the box shut.)
   Two real members in two real browsers against production:
     - PURE: ctMnFresh lifted out of the SHIPPED bundle answers true once per message id and false for a day-old one;
     - B joins the room and shuts the box; A mentions B and buries it under fillers; B gets the live toast with the name
       in BOLD and no escaped markup, and the message id is recorded so a replay cannot toast it again;
     - the bell row for B carries ?m=<id> (the worker half - a long-lived ChatRoom DO serves the previous deploy for a
       while after a deploy, in which case this one check is red and the rest still proves the client);
     - opening /paper-trade?chat=1&m=<id> lands INSIDE the box on that row, with the newest message out of view.
   Cleans both members up; run e2e-sweep afterwards (the messages are real room rows). Run: node build/chat-mention-jump-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : ''));
const api = (p, body) => fetch(ORIGIN + p, body ? { method: 'POST', headers: H, body: JSON.stringify(body) } : { headers: H }).then(r => r.json());
const t = Date.now().toString(36);
const A = 'e2emja' + t, B = 'e2emjb' + t;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // ---- PURE: the once-per-message rule, from the shipped bundle
  for (const f of ['home.js', 'mp-trade.js']) {
    try {
      const src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', f), 'utf8');
      const i = src.indexOf('function ctMnFresh(m){'); const j = src.indexOf('\n', i);
      const store = {}; const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
      const fn = new Function('localStorage', src.slice(i, j) + '\nreturn ctMnFresh;')(ls);
      const now = Date.now();
      const r = [fn({ id: 'abc1', ts: now - 60000 }), fn({ id: 'abc1', ts: now - 60000 }), fn({ id: 'abc2', ts: now - 90000000 }), fn({ id: 'abc3', ts: now - 5000 })];
      chk(f + ': ctMnFresh answers true once per id, false the second time, false for a day-old mention', r[0] === true && r[1] === false && r[2] === false && r[3] === true, r);
    } catch (e) { chk(f + ': ctMnFresh lifted from the bundle', false, String(e).slice(0, 120)); }
  }
  await api('/api/admin/e2euser', { uid: A, op: 'mk' }); await api('/api/admin/e2euser', { uid: B, op: 'mk' });
  const sa = await api('/api/admin/e2euser', { uid: A, op: 'sess' }), sb = await api('/api/admin/e2euser', { uid: B, op: 'sess' });
  const nameB = 'e2e_' + B;
  let mid = '';
  await withBrowser(async (browser) => {
    const mk = async (token, w) => { const page = await browser.newPage(); await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: w, height: 760 }); await page.setCookie({ name: 'mp_sess', value: token, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' }); return page; };
    const ready = "document.getElementById('ctInput') && document.getElementById('ctInput').offsetWidth>0 && document.querySelectorAll('#ctMsgs [data-mid]').length>0";
    // ---- B joins the room, then shuts the box (the socket stays up - that is the state the owner's toast fired in)
    const pb = await mk(sb.token, 1200);
    await pb.goto(ORIGIN + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await pb.waitForFunction(ready, { timeout: 40000 });
    await pb.evaluate(() => document.getElementById('ctClose').click());
    await sleep(500);
    chk('B joined the room and shut the box (socket stays)', await pb.evaluate(() => document.getElementById('chatBox').hidden && document.querySelectorAll('#ctMsgs [data-mid]').length > 0));
    // ---- A mentions B, then buries it under fourteen fillers
    const pa = await mk(sa.token, 1200);
    await pa.goto(ORIGIN + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await pa.waitForFunction(ready, { timeout: 40000 });
    const post = async (txt) => { await pa.evaluate((s) => { const i = document.getElementById('ctInput'); i.value = s; i.dispatchEvent(new Event('input', { bubbles: true })); }, txt); await pa.focus('#ctInput'); await pa.keyboard.press('Enter'); await sleep(1400); };
    await post('@' + nameB + ' jump test ' + t);
    await sleep(1500);
    mid = await pa.evaluate((s) => { const rows = [...document.querySelectorAll('#ctMsgs [data-mid]')]; const r = rows.reverse().find(x => (x.textContent || '').indexOf(s) >= 0); return r ? r.getAttribute('data-mid') : ''; }, 'jump test ' + t);
    chk('A posted the mention and the room gave it an id', /^[a-z0-9]{6,}$/i.test(mid), { mid });
    // ---- B, box shut: the live toast, bold, no brackets, and the id recorded against a replay
    const toast1 = await pb.evaluate(() => { const c = [...document.querySelectorAll('#mpxpT *')].map(x => x.textContent || '').find(s => /mentioned you in chat/.test(s)) || ''; return { txt: c.replace(/\s+/g, ' ').trim().slice(0, 120), bold: !!document.querySelector('#mpxpT b'), rec: localStorage.getItem('mp_ct_mntoast') || '' }; });
    chk('B (box shut) got the live mention toast with the name in BOLD and no escaped markup', /mentioned you in chat/.test(toast1.txt) && toast1.bold && toast1.txt.indexOf('<b>') < 0 && toast1.txt.indexOf('</b>') < 0, toast1);
    chk('the message id is recorded, so a history replay on reconnect cannot toast it again', toast1.rec.indexOf(mid) >= 0, { rec: toast1.rec.slice(0, 80), mid });
    for (let i = 1; i <= 14; i++) await post('filler ' + i + ' ' + t + ' lorem ipsum dolor sit amet');
    await pa.close();
    // ---- the bell row for B carries the message id (worker half)
    let notif = null;
    for (let i = 0; i < 8 && !notif; i++) { const n = await api('/api/auth/notifs?uid=' + B); notif = ((n && n.notifs) || []).find(x => x.kind === 'mention'); if (!notif) await sleep(1500); }
    const link = (notif && notif.link) || '';
    chk('B\'s bell row links the message (?m=<id>) - red means the ChatRoom DO is still on the previous deploy, re-run later', !!notif && link === '/paper-trade?chat=1&m=' + mid, { link, body: notif && notif.body });
    // ---- the landing (client half, on the link the worker is meant to produce)
    await pb.goto(ORIGIN + '/paper-trade?chat=1&m=' + mid + '&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await pb.waitForFunction("!document.getElementById('chatBox').hidden && document.querySelectorAll('#ctMsgs [data-mid]').length>0", { timeout: 40000 });
    await sleep(2000);
    const land = await pb.evaluate((id) => { const box = document.getElementById('ctMsgs'); const r = box.querySelector('[data-mid="' + id + '"]'); if (!r) return { found: false, n: box.querySelectorAll('[data-mid]').length }; const br = box.getBoundingClientRect(), rr = r.getBoundingClientRect(); const rows = box.querySelectorAll('[data-mid]'); const last = rows[rows.length - 1].getBoundingClientRect(); return { found: true, inBox: rr.top >= br.top - 2 && rr.bottom <= br.bottom + 2, lastInBox: last.top >= br.top && last.bottom <= br.bottom, hit: r.className.indexOf('ct-hit') >= 0, overflow: box.scrollHeight > box.clientHeight + 40, scrolledUp: box.scrollTop < box.scrollHeight - box.clientHeight - 20 }; }, mid);
    chk('?chat=1&m=<id> lands ON the mentioned message: inside the box, newest message out of view', land.found && land.inBox && land.overflow && !land.lastInBox && land.scrolledUp, land);
    chk('the landed row is marked as a mention of the reader', !!land.hit, land);
    // ---- an id the room does not hold says so instead of landing at the bottom in silence
    await pb.goto(ORIGIN + '/paper-trade?chat=1&m=zzznotarealid&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await pb.waitForFunction("!document.getElementById('chatBox').hidden && document.querySelectorAll('#ctMsgs [data-mid]').length>0", { timeout: 40000 });
    await sleep(1500);
    const older = await pb.evaluate(() => [...document.querySelectorAll('#mpxpT *')].some(x => /older than the room keeps/.test(x.textContent || '')));
    chk('a message the room no longer holds is said out loud', older, { older });
    await pb.close();
  });
  await api('/api/admin/e2euser', { uid: A, op: 'rm' }); await api('/api/admin/e2euser', { uid: B, op: 'rm' });
  console.log(out.join('\n'));
  const failed = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + failed + ' failed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

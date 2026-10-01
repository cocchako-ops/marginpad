/* squad-room-e2e (2026-09-30): the squad's chat room, in real browsers.
   The server gate is proven by squads-e2e; this proves the half that only a browser can show - that a member
   can actually REACH the room from /squads/, that the room bar rebuilds when the squad arrives on the /xp poll
   (it is built once on first open, so a member who just joined would otherwise have a room and no way to pick
   it), that two members see each other's messages in it, and that the crest and tag reach the page.
                                                                     node build/squad-room-e2e.js   */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser.js');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io', H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 200) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json().catch(() => ({})));
const adm = (p, b) => J(p, { method: 'POST', headers: H, body: JSON.stringify(b) });
const sq = (op, uid, b) => J('/api/squad/' + op + '?uid=' + encodeURIComponent(uid), { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
const R4 = () => { const A = 'ABCDFGHJKLMNPQRSTVWXYZ0123456789'; let v = ''; for (let i = 0; i < 4; i++) v += A[Math.floor(Math.random() * A.length)]; return v; };

(async () => {
  if (!KEY) { console.error('no admin key'); process.exitCode = 1; return; }
  const UIDS = ['e2esqrm1', 'e2esqrm2', 'e2esqrm3'], real = {}, sess = {};
  for (const u of UIDS) {
    await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {});
    await adm('/api/admin/e2euser', { uid: u, op: 'mk' });
    real[u] = ((await J('/api/admin/xpdiag?u=e2e_' + u, { headers: H })).user || {}).id;
    const s = await adm('/api/admin/e2euser', { uid: u, op: 'sess' });
    sess[u] = s.token || s.sess;
  }
  // founding is gated on Platinum + 5,000 Ticks since 2026-09-30 - joining still is not, which is why only
  // the founder is topped up here
  await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: real['e2esqrm1'], level: 'platinum', note: 'squad-room-e2e' }) });
  await adm('/api/admin/ticks', { uid: real['e2esqrm1'], amt: 5000, note: 'squad-room-e2e' });
  const TAG = R4();
  const c = await sq('create', real['e2esqrm1'], { name: 'Room Test ' + TAG, tag: TAG, crest: { shape: 'circle', sym: 'star', bg: '#2ebd85', fg: '#0a0b0d', ring: 'solid' } /* level-1 pieces only */, open: true });
  const SID = c.squad && c.squad.sid;
  ok(!!SID, 'a squad to test the room with', { SID, err: c.error });
  await sq('join', real['e2esqrm2'], { sid: SID });

  const MSG = 'squad room probe ' + Date.now().toString(36);
  await withBrowser(async browser => {
    const mk = async (uid, w) => {
      const p = await browser.newPage();
      await p.setViewport({ width: w || 1366, height: 900 });
      await p.setCookie({ name: 'mp_sess', value: sess[uid], domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
      const errs = []; p.on('pageerror', e => errs.push(String(e && e.message || e)));
      p._errs = errs; return p;
    };
    // ---- member A opens the room from /squads/
    const A = await mk('e2esqrm1');
    await A.goto(B + '/squads/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    const head = await A.evaluate(() => ({ crest: !!document.querySelector('.sqhead svg.mp-crest'), name: (document.querySelector('.sqhead .nm') || {}).textContent || '', btn: !!document.querySelector('#roomGo') }));
    ok(head.crest && head.btn, 'the squad page draws the crest and offers the room', head);
    ok(!A._errs.length, 'no page errors on /squads/', A._errs.slice(0, 2));
    // THE H1 MUST SURVIVE THE LIVE DOM, not just the served HTML. mp-nav's normalizeHeader() rebuilds
    // body>.wrap>header into the canonical site nav, so a page title placed inside a <header> is wiped for
    // every reader while every static check still passes on the raw markup. That is exactly what happened here.
    const live = await A.evaluate(() => { const h = document.querySelector('h1'); return { n: document.querySelectorAll('h1').length, txt: h ? h.textContent.trim() : '', lead: !!document.querySelector('.hd .lead'), nav: !!document.querySelector('header .mpnav-burger, header .hmenu, header .brand') }; });
    ok(live.n === 1 && live.txt.length > 6, 'the h1 is still in the DOM after the bundles have run', live);
    ok(live.lead, 'and so is the lead paragraph that explains the feature', live);

    await A.evaluate(() => { const b = document.querySelector('#roomGo'); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 6000));
    const opened = await A.evaluate(() => {
      const cur = document.querySelector('.ct-roomcur');
      return { chat: !!document.querySelector('.ct-box, #chatBox'), room: cur ? cur.textContent.trim() : null, items: [...document.querySelectorAll('[data-room]')].map(x => x.getAttribute('data-room')) };
    });
    ok(opened.chat, 'the chat opened on the squads page itself, without leaving it', { room: opened.room });
    ok(String(opened.room || '').toUpperCase() === TAG, 'AND IT LANDED ON THE SQUAD ROOM, named by the tag', { room: opened.room, want: TAG });
    ok(opened.items.indexOf(SID) >= 0, 'the room list contains the squad room', opened.items);

    const sent = await A.evaluate(async (m) => {
      const inp = document.getElementById('ctInput'); // the chat's real ids: ctForm / ctInput / ctMsgs
      if (!inp) return { err: 'no input' };
      inp.focus(); inp.value = m;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      const f = document.getElementById('ctForm') || inp.closest('form');
      if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      else inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      await new Promise(r => setTimeout(r, 2500));
      return { txt: (document.getElementById('ctMsgs') || document.body).textContent.indexOf(m) >= 0 };
    }, MSG);
    ok(sent.txt, 'a member can post in the squad room', sent);

    // ---- member B, who JOINED AFTER the page loaded for them, must still get the room
    const Bp = await mk('e2esqrm2');
    await Bp.goto(B + '/squads/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    await Bp.evaluate(() => { const b = document.querySelector('#roomGo'); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 7000));
    const sees = await Bp.evaluate(m => ({ room: (document.querySelector('.ct-roomcur') || {}).textContent || '', has: document.body.textContent.indexOf(m) >= 0 }), MSG);
    ok(String(sees.room).trim().toUpperCase() === TAG, 'the second member lands on the same room', sees);
    ok(sees.has, 'AND SEES THE OTHER MEMBER\'S MESSAGE', sees);

    // ---- THE SHEET (2026-10-01): clicking a squad in the directory shows who is in it. The third member is in
    //      no squad, so the directory is their page - the card must open the sheet, name the members, mark the
    //      leader, offer Join to a signed-in outsider, and close on Escape. Checked on a phone too, where it is
    //      a bottom sheet and must sit entirely inside the viewport.
    for (const [w, h, tag] of [[1366, 900, 'desktop'], [390, 844, 'phone']]) {
      const D = await mk('e2esqrm3');
      await D.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
      await D.setCacheEnabled(false);
      try { const cdp = await D.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
      await D.goto(B + '/squads/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 3000));
      const card = await D.evaluate(sid => { const c = document.querySelector('.dsq[data-sid="' + sid + '"]'); if (!c) return null; c.click(); return true; }, SID);
      ok(card === true, tag + ': the squad is in the directory and its card is clickable');
      await new Promise(r => setTimeout(r, 2600));
      const sh = await D.evaluate(() => { const el = document.querySelector('.sqsh.on .sqsh-p'); const r = el ? el.getBoundingClientRect() : null;
        return { open: !!el, members: [...document.querySelectorAll('.sqsh .mcard .mn a')].map(a => a.textContent.trim()), crown: document.querySelectorAll('.sqsh .crown').length, cta: ((document.querySelector('.sqsh-cta') || {}).textContent || '').trim(), inView: !!r && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1 }; });
      ok(sh.open, tag + ': THE SHEET OPENS', sh);
      ok(sh.members.indexOf('e2e_e2esqrm1') >= 0 && sh.members.indexOf('e2e_e2esqrm2') >= 0, tag + ': and names every member', sh.members);
      ok(sh.crown === 1, tag + ': exactly one crown, on the leader', { crowns: sh.crown });
      ok(/Join this squad/i.test(sh.cta), tag + ': a signed-in outsider is offered Join', sh.cta);
      ok(sh.inView, tag + ': the panel sits entirely inside the viewport', sh);
      await D.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 300));
      ok(await D.evaluate(() => !document.querySelector('.sqsh.on')), tag + ': Escape closes it');
      await D.close();
    }
    // ---- a non-member must not even have the room in their list
    const C = await mk('e2esqrm3');
    await C.goto(B + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4500));
    const nc = await C.evaluate(sid => ({ has: !!window.mpChatRoom && window.mpChatRoom(sid), sq: window.mpSquad || null }), SID);
    ok(nc.has === false && !nc.sq, 'a NON-MEMBER cannot switch into the squad room and has no squad', nc);
    for (const p of [A, Bp, C]) await p.close();
  });

  for (const u of UIDS) await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log(out.join('\n'));
  console.log('\nsquad-room-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

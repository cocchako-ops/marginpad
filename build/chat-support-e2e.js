#!/usr/bin/env node
/* THE WELCOME ROOM IS GONE AND SUPPORT LIVES IN THE CHAT WINDOW - E2E (2026-11-12). See build/fix-chat-no-welcome.js
   and window.mpChatSupport in dist/assets/mp-auth.js.
   A real throwaway member on the app shell (home.js chat, desktop) and on a standalone page (mp-trade.js chat via
   mp-nav, phone 390), then a guest:
     - the room menu carries no Welcome room, no welcome row is ever drawn, mpWelcomeCard is gone;
     - the lifebuoy sits in the chat header exactly once, as an icon with an aria-label;
     - pressing it turns the box into the support desk (stream, composer and room chip hidden, the panel in their place),
       a NEW TICKET really reaches the ledger (read back through /api/reward/support/mine with the member's own session),
       a reply lands in the same conversation, the list shows the ticket as OPEN, and pressing the button again hands the
       chat back untouched;
     - on the phone the panel fits the screen and the composer is what sits under the finger;
     - a guest meets a sign-in gate, never the ticket list.
   `--local` serves the five bundles from the working tree (the API still answers from production).
   Cleanup: e2euser rm removes the account AND its support rows (/support/e2erm, 2026-10-18). */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const LOCAL = process.argv.includes('--local');
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIST = path.join(__dirname, '..', 'dist', 'assets');
const LOCAL_FILES = ['home.js', 'mp-trade.js', 'mp-auth.js', 'home.css', 'mp-trade.css'];

async function prep(p, tok) {
  await p.setCacheEnabled(false);
  if (tok) await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  await p.setRequestInterception(true);
  const cdp = await p.target().createCDPSession(); await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  p.on('request', req => {
    const u = req.url();
    if (LOCAL) { const m = u.match(/\/assets\/([a-z-]+\.(?:js|css))(?:\?|$)/); if (m && LOCAL_FILES.indexOf(m[1]) >= 0) { const f = path.join(DIST, m[1]); return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(f) }); } }
    req.continue();
  });
}
const WAIT_BTN = "window.mpChatSupport && document.querySelector('#chatBox .ct-head .ct-sup-btn')";

(async () => {
  console.log('# pure: the bundles');
  for (const f of ['home.js', 'mp-trade.js', 'mp-auth.js']) {
    const s = fs.readFileSync(path.join(DIST, f), 'utf8');
    ok(!/WELCOME|welcRow|mpWelcomeCard|CT_WAVE/.test(s), f + ' carries nothing of the Welcome room');
  }
  for (const f of ['home.js', 'mp-trade.js']) { const s = fs.readFileSync(path.join(DIST, f), 'utf8'); ok(s.indexOf('function roomItemHtml(') > 0 && s.indexOf('ct-roomsq') > 0 && s.indexOf("var b=['global'];") > 0, f + ' draws the squad room as a card and lists All first'); }
  for (const f of ['home.css', 'mp-trade.css']) { const s = fs.readFileSync(path.join(DIST, f), 'utf8'); ok(s.indexOf('.ct-roomitem.ct-roomsq{') > 0 && s.indexOf('.ct-roombtn.ct-rbsq{') > 0, f + ' styles the squad row and the squad chip'); }
  { const w = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8'); ok(w.indexOf("idFromName('room_WELCOME')") < 0 && w.indexOf("rmI !== 'room_WELCOME'") < 0, 'the worker posts no welcome line and exempts no Welcome room on the socket gate'); }

  const uid = 'e2esup' + Date.now().toString(36);
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const se = await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());
  const mine = () => fetch(O + '/api/reward/support/mine', { headers: { cookie: 'mp_sess=' + se.token } }).then(r => r.json()).catch(() => ({}));
  let conv = '';
  try {
    await withBrowser(async (b) => {
      console.log('# app shell /paper-trade, desktop 1366, member');
      let p = await b.newPage(); await p.setViewport({ width: 1366, height: 768 }); await prep(p, se.token);
      const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
      await p.goto(O + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await p.waitForFunction(WAIT_BTN, { timeout: 45000 });
      await p.waitForFunction("document.querySelector('#chatBox .ct-roomsel') || document.querySelector('#chatBox .ct-msg')", { timeout: 30000 }).catch(() => {});
      let d = await p.evaluate(() => ({ btns: document.querySelectorAll('#chatBox .ct-sup-btn').length, label: (document.querySelector('#chatBox .ct-sup-btn') || {}).getAttribute('aria-label'), txt: (document.querySelector('#chatBox .ct-sup-btn') || {}).textContent, beforeGear: (() => { const h = document.querySelector('#chatBox .ct-head'), s = h && h.querySelector('.ct-sup-btn'), g = h && h.querySelector('.ct-gear'); return !!(s && g && s.compareDocumentPosition(g) & 4); })(), rooms: Array.from(document.querySelectorAll('#chatBox [data-room]')).map(x => x.getAttribute('data-room')), welc: document.querySelectorAll('.ct-welcrow').length, wc: typeof window.mpWelcomeCard, ph: (document.getElementById('ctInput') || {}).placeholder }));
      ok(d.btns === 1 && d.beforeGear, 'the lifebuoy sits in the chat header exactly once, before the gear', d);
      ok(d.label === 'Support' && !/\S/.test(d.txt || ''), 'it is an icon with an aria-label, no text', d);
      ok(d.rooms.indexOf('WELCOME') < 0 && (d.rooms.length === 0 || d.rooms[0] === 'global'), 'the room menu carries no Welcome room and lists All first', d.rooms);
      ok(d.welc === 0 && d.wc === 'undefined' && !/hello/i.test(d.ph || ''), 'no welcome row, no mpWelcomeCard, no "Say hello" placeholder', d);
      // into the desk
      await p.click('#chatBox .ct-sup-btn');
      await p.waitForFunction("window.mpChatSupport.state().n !== null", { timeout: 20000 });
      d = await p.evaluate(() => { const bx = document.getElementById('chatBox'), vis = el => !!(el && el.offsetWidth && el.offsetHeight && getComputedStyle(el).display !== 'none'); return { mode: bx.classList.contains('ct-supmode'), panel: vis(bx.querySelector('.ct-sup')), msgs: vis(document.getElementById('ctMsgs')), form: vis(document.getElementById('ctForm')), room: vis(bx.querySelector('.ct-roomsel')), ttl: vis(bx.querySelector('.ct-sup-ttl')), empty: !!bx.querySelector('.cts-empty'), st: window.mpChatSupport.state(), on: bx.querySelector('.ct-sup-btn').classList.contains('on') }; });
      ok(d.mode && d.panel && d.ttl && d.on, 'the box is the support desk: panel up, header says Support, button lit', d);
      ok(!d.msgs && !d.form && !d.room, 'the stream, the composer and the room chip are hidden underneath', d);
      ok(d.st.view === 'list' && d.st.n === 0 && d.empty, 'a fresh account sees the empty list', d.st);
      // a new ticket
      await p.click('#chatBox .ct-sup [data-cts="new"]'); await sleep(150);
      await p.click('#chatBox .ct-sup [data-cts="topic"][data-t="payout"]'); await sleep(100);
      await p.type('#chatBox .ct-sup [data-msg]', 'E2E ticket from the chat support desk - please ignore');
      await p.click('#chatBox .ct-sup [data-cts="create"]');
      await p.waitForFunction("window.mpChatSupport.state().view === 'thread'", { timeout: 25000 });
      d = await p.evaluate(() => { const pn = document.querySelector('#chatBox .ct-sup'); return { st: window.mpChatSupport.state(), bubs: pn.querySelectorAll('.cts-bub.in').length, outs: pn.querySelectorAll('.cts-bub.out').length, status: (pn.querySelector('.cts-tb .cts-st') || {}).textContent, days: pn.querySelectorAll('.cts-day').length, reply: !!pn.querySelector('[data-reply]') }; });
      conv = d.st.conv;
      ok(d.st.view === 'thread' && !!conv && d.bubs === 1 && d.outs === 0, 'opening a ticket lands in its thread with one bubble of ours', d);
      ok(d.status === 'OPEN' && d.days === 1 && d.reply, 'the thread says OPEN, carries a day separator and a composer', d);
      let m = await mine();
      const c0 = (m.conversations || []).filter(x => x.conv === conv)[0];
      ok(!!c0 && c0.messages.length === 1 && /^\[Payout\] E2E ticket/.test(c0.messages[0].body) && !c0.closed, 'the ledger holds the ticket under this account, with the topic prefix', c0);
      // a reply in the same conversation
      await p.type('#chatBox .ct-sup [data-reply]', 'Second line, Enter sends it');
      await p.keyboard.press('Enter');
      await p.waitForFunction("document.querySelectorAll('#chatBox .ct-sup .cts-bub.in').length === 2", { timeout: 25000 }).catch(() => {});
      m = await mine(); const c1 = (m.conversations || []).filter(x => x.conv === conv)[0];
      ok(c1 && c1.messages.length === 2 && c1.messages[1].body === 'Second line, Enter sends it', 'Enter sends a reply into the SAME conversation', c1 && c1.messages.map(x => x.body));
      ok((await p.evaluate(() => document.querySelectorAll('#chatBox .ct-sup .cts-bub.in').length)) === 2, 'and the thread shows both bubbles');
      // back to the list
      await p.click('#chatBox .ct-sup [data-cts="back"]'); await sleep(200);
      d = await p.evaluate(() => { const rows = document.querySelectorAll('#chatBox .ct-sup .cts-row'); return { n: rows.length, open: rows[0] && rows[0].classList.contains('open'), st: (rows[0] && rows[0].querySelector('.cts-st') || {}).textContent, cnt: (document.querySelector('#chatBox .ct-sup .cts-cnt') || {}).textContent }; });
      ok(d.n === 1 && d.open && d.st === 'OPEN' && /1 ticket/.test(d.cnt || ''), 'the list shows the one ticket as OPEN with the count', d);
      // and back to the chat
      await p.click('#chatBox .ct-sup-btn'); await sleep(300);
      d = await p.evaluate(() => { const bx = document.getElementById('chatBox'), vis = el => !!(el && el.offsetWidth && el.offsetHeight); return { mode: bx.classList.contains('ct-supmode'), panel: !!bx.querySelector('.ct-sup'), msgs: vis(document.getElementById('ctMsgs')), form: vis(document.getElementById('ctForm')), on: bx.querySelector('.ct-sup-btn').classList.contains('on'), heads: bx.querySelectorAll('.ct-head').length }; });
      ok(!d.mode && !d.panel && d.msgs && d.form && !d.on, 'pressing the button again hands the chat back - stream and composer visible, panel gone', d);
      ok(errs.length === 0, 'no page errors on the app shell', errs);
      await p.close();

      console.log('# standalone page /rekt/, phone 390, member (mp-trade.js chat)');
      p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await prep(p, se.token);
      const errs2 = []; p.on('pageerror', e => errs2.push(String(e.message || e)));
      await p.goto(O + '/rekt/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await p.waitForSelector('#chatFab', { timeout: 45000 });
      await p.evaluate(() => { const c = document.getElementById('mpCkBar'); if (c) c.remove(); });
      await p.evaluate(() => { const f = document.getElementById('chatFab'); if (f) f.click(); });
      await p.waitForFunction(WAIT_BTN + " && document.getElementById('chatBox').offsetWidth > 0", { timeout: 45000 });
      d = await p.evaluate(() => ({ btns: document.querySelectorAll('#chatBox .ct-sup-btn').length, rooms: Array.from(document.querySelectorAll('#chatBox [data-room]')).map(x => x.getAttribute('data-room')) }));
      ok(d.btns === 1 && d.rooms.indexOf('WELCOME') < 0, 'the standalone chat carries the lifebuoy once and no Welcome room', d);
      await p.tap('#chatBox .ct-sup-btn');
      await p.waitForFunction("window.mpChatSupport.state().n !== null", { timeout: 20000 });
      d = await p.evaluate(() => { const pn = document.querySelector('#chatBox .ct-sup'), r = pn.getBoundingClientRect(); return { fits: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1, rows: pn.querySelectorAll('.cts-row').length, h: r.height }; });
      ok(d.fits && d.h > 300, 'the panel fits the 390px screen', d);
      ok(d.rows === 1, 'the phone lists the ticket opened on the desktop', d);
      await p.tap('#chatBox .ct-sup .cts-row');
      await p.waitForFunction("window.mpChatSupport.state().view === 'thread'", { timeout: 10000 });
      d = await p.evaluate(() => { const pn = document.querySelector('#chatBox .ct-sup'), ta = pn.querySelector('[data-reply]'), q = ta.getBoundingClientRect(), s = pn.querySelector('[data-cts="send"]'), qs = s.getBoundingClientRect(); return { bubs: pn.querySelectorAll('.cts-bub.in').length, taUnder: document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2) === ta, sendUnder: document.elementFromPoint(qs.left + qs.width / 2, qs.top + qs.height / 2) === s || s.contains(document.elementFromPoint(qs.left + qs.width / 2, qs.top + qs.height / 2)), fs: parseFloat(getComputedStyle(ta).fontSize), inView: q.bottom <= innerHeight && qs.bottom <= innerHeight }; });
      ok(d.bubs === 2, 'the thread holds both messages', d);
      ok(d.taUnder && d.sendUnder && d.inView, 'the composer and Send are what sit under the finger, inside the viewport', d);
      ok(d.fs >= 16, 'the reply field is 16px or more (no iOS zoom)', d.fs);
      ok(errs2.length === 0, 'no page errors on the standalone page', errs2);
      await p.close();

      console.log('# guest, desktop');
      const ctx = await b.createBrowserContext(); p = await ctx.newPage(); await p.setViewport({ width: 1366, height: 768 }); await prep(p, null);
      const errs3 = []; p.on('pageerror', e => errs3.push(String(e.message || e)));
      await p.goto(O + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await p.waitForFunction(WAIT_BTN, { timeout: 45000 });
      await p.click('#chatBox .ct-sup-btn'); await sleep(400);
      d = await p.evaluate(() => { const pn = document.querySelector('#chatBox .ct-sup'); return { st: window.mpChatSupport.state(), gate: !!(pn && pn.querySelector('.cts-gate')), signin: !!(pn && pn.querySelector('[data-cts="signin"]')), rows: pn ? pn.querySelectorAll('.cts-row').length : -1 }; });
      ok(d.st.view === 'gate' && d.gate && d.signin && d.rows === 0, 'a guest meets the sign-in gate, never a ticket list', d);
      ok(errs3.length === 0, 'no page errors for the guest', errs3);
      await ctx.close();
    });
  } finally {
    await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) });
    const after = await mine();
    ok(!(after.conversations || []).length, 'cleanup: the account and its support rows are gone');
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

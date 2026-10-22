/* THE WELCOME ROOM, THE NEWCOMER'S WELCOME, AND A SHARED TRADE AS A CARD (2026-10-22, owner).
   - PURE: window.mpWelcomeCard lifted out of the SHIPPED mp-auth.js with stubs: a week-old account with no remembered room
     opens in WELCOME, an old one in All, a remembered choice wins; the card is wanted once and not after Got it; the text
     names the member and the XP they still need. Structural: both chat copies carry the room, the welcome row and the
     hydrate call; the worker exempts room_WELCOME from the squad gate and posts the public welcome there.
   - API: a WebSocket upgrade to ?room=WELCOME is admitted (101) with and without a session; a squad-looking room still
     answers 403 to an outsider; a share minted for a closed trade carries a baked sparkline.
   - BROWSER (a real brand-new member on production): the chat opens in the Welcome room with the personal welcome row
     naming them; Got it removes it and it stays gone on reload; switching to All is remembered across a reload; a
     `trade:<id>` posted in the room renders as the card (tag, ROE, dollar P&L, sparkline, entry/exit foot), fits the box,
     and a click opens the full ticket.
   The messages are real room rows: run `node build/e2e-sweep.js` afterwards (it covers the Welcome room).
   Run: node build/chat-welcome-e2e.js   |   --pure for the offline checks only */
const fs = require('fs'), path = require('path'), https = require('https'), crypto = require('crypto');
const PURE = process.argv.indexOf('--pure') >= 0;
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : ''));
const api = (p, body) => fetch(ORIGIN + p, body ? { method: 'POST', headers: H, body: JSON.stringify(body) } : { headers: H }).then(r => r.json());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function pure() {
  const auth = SRC('dist/assets/mp-auth.js');
  const i = auth.indexOf('(function () {\n  if (window.mpWelcomeCard) return;'); const j = auth.indexOf('})();', i) + 5;
  chk('mpWelcomeCard block exists in mp-auth.js', i > 0 && j > i);
  if (i > 0) {
    const store = {}; const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
    const win = {}; const doc = { addEventListener: () => {} };
    try {
      new Function('window', 'document', 'localStorage', auth.slice(i, j))(win, doc, ls);
      const W = win.mpWelcomeCard, now = Date.now();
      const fresh = { id: 'u1', username: 'newbie', created: now - 3600000, xp: 120 }, old = { id: 'u2', username: 'vet', created: now - 40 * 86400000, xp: 9000 };
      chk('pure: a week-old account with no remembered room opens in WELCOME', W.defaultRoom(fresh) === 'WELCOME');
      chk('pure: an old account opens in All', W.defaultRoom(old) === 'global');
      chk('pure: a guest (no account) opens in All', W.defaultRoom(null) === 'global');
      W.remember('global');
      chk('pure: a remembered choice wins even for a new account', W.defaultRoom(fresh) === 'global');
      chk('pure: the card is wanted for a new member and not for an old one', W.want(fresh) === true && W.want(old) === false);
      const h = W.html(fresh);
      chk('pure: the text names the member and the XP still needed, with the lesson count', /@newbie/.test(h) && /380 more XP/.test(h) && /16 lessons/.test(h) && /ONLY YOU SEE THIS/.test(h), h.slice(0, 160));
      chk('pure: a Bronze member is told the money is already open', /already Bronze/.test(W.html(old)));
      W.dismiss(fresh);
      chk('pure: after Got it the card is not wanted again', W.want(fresh) === false);
    } catch (e) { chk('pure: mpWelcomeCard runs in a sandbox', false, String(e).slice(0, 160)); }
  }
  for (const f of ['home.js', 'mp-trade.js']) {
    const s = SRC('dist/assets/' + f);
    chk(f + ': WELCOME is in the room list, labelled, with its own icon and placeholder', s.indexOf("var b=['global','WELCOME']") > 0 && s.indexOf("if(r==='WELCOME')return 'Welcome'") > 0 && s.indexOf("if(r==='WELCOME')return CT_WAVE") > 0 && s.split("room==='WELCOME'?'Say hello…'").length === 3);
    chk(f + ': the welcome row is appended after the history frame and a switch is remembered', s.indexOf('try{welcRow();}catch(e){}') > 0 && s.indexOf('function welcRow()') > 0 && s.indexOf('mpWelcomeCard.remember(r)') > 0 && s.indexOf('showChat._picked') > 0);
    chk(f + ': a rendered row and an edited row are handed to mpTradeCard.hydrate', s.indexOf('window.mpTradeCard.hydrate(d)') > 0 && s.indexOf('window.mpTradeCard.hydrate(_r)') > 0);
  }
  const w = SRC('src/worker.js');
  chk('worker: room_WELCOME is exempt from the squad gate', /rmI !== 'room_WELCOME' && sidI\.length >= 5/.test(w));
  chk('worker: the public welcome line is posted into room_WELCOME, not the global room', /idFromName\('room_WELCOME'\)\)\.fetch\(new Request\('https:\/\/do\/post'/.test(w) && !/idFromName\('global2'\)\)\.fetch\(new Request\('https:\/\/do\/post', \{ method: 'POST', headers: \{ 'content-type': 'application\/json' \}, body: JSON\.stringify\(\{ text: 'Welcome @'/.test(w));
  chk('worker: the share bakes a sparkline', w.indexOf('snap.spark = pts.map') > 0);
}

function upgrade(room, cookie) { // raw WebSocket upgrade; resolves the status the server answered (101 = admitted)
  return new Promise((resolve) => {
    const key = crypto.randomBytes(16).toString('base64');
    const req = https.request(ORIGIN + '/chat/ws?room=' + encodeURIComponent(room), { method: 'GET', headers: Object.assign({ Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key, Origin: 'https://marginpad.io' }, cookie ? { Cookie: cookie } : {}) });
    req.on('upgrade', (res, sock) => { try { sock.destroy(); } catch (e) {} resolve(res.statusCode); });
    req.on('response', (res) => { resolve(res.statusCode); res.resume(); });
    req.on('error', () => resolve(0));
    req.setTimeout(15000, () => { try { req.destroy(); } catch (e) {} resolve(0); });
    req.end();
  });
}

(async () => {
  pure();
  if (PURE) { console.log(out.join('\n')); const f = out.filter(x => x.indexOf('FAIL') === 0).length; console.log('\n' + (out.length - f) + ' ok, ' + f + ' failed'); process.exitCode = f ? 1 : 0; return; }
  const { withBrowser } = require('./e2e-browser');
  const t = Date.now().toString(36);
  const U = 'e2ewelc' + t, NAME = 'e2e_' + U;
  let sess = null, shareId = '';
  try {
    await api('/api/admin/e2euser', { uid: U, op: 'mk' });
    sess = (await api('/api/admin/e2euser', { uid: U, op: 'sess' })).token;
    chk('a brand-new throwaway member and a session for it', !!sess);
    // ---- API: the room is open, the squad gate is not
    chk('ws: ?room=WELCOME admits a signed-in member (101)', await upgrade('WELCOME', 'mp_sess=' + sess) === 101);
    chk('ws: ?room=WELCOME admits a guest to read (101)', await upgrade('WELCOME', '') === 101);
    chk('ws: a squad-shaped room still refuses an outsider (403)', await upgrade('ZZQX7K', 'mp_sess=' + sess) === 403);
    // ---- a share with a baked sparkline
    const now = Date.now();
    const sh = await api('/api/tshare?uid=' + U, { ticket: { sym: 'BTC', side: 'long', status: 'win', entry: 100000, exit: 101500, lev: 50, margin: 20, notional: 1000, qty: 0.01, roe: 75, pnl: 15, ts: now - 3 * 3600000, closeTs: now - 600000 } });
    shareId = (sh && sh.id) || '';
    chk('a share is minted for a closed trade and reports its baked sparkline', !!shareId && sh.spark >= 3, sh);
    const got = await (await fetch(ORIGIN + '/api/tshare?id=' + shareId)).json();
    chk('the public snapshot carries spark[] and the sharer\'s name, nothing private', got.ok && Array.isArray(got.ticket.spark) && got.ticket.spark.length >= 3 && got.ticket.by === U && !('uid' in got.ticket) && !('email' in got.ticket), got.ticket && { n: got.ticket.spark && got.ticket.spark.length, by: got.ticket.by, iv: got.ticket.sparkIv });
    // ---- BROWSER
    await withBrowser(async (browser) => {
      const page = await browser.newPage(); await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1200, height: 760 });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 160)));
      await page.setCookie({ name: 'mp_sess', value: sess, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
      const ready = "document.getElementById('ctInput') && document.getElementById('ctInput').offsetWidth>0 && !!document.querySelector('.ct-roomcur')";
      await page.goto(ORIGIN + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForFunction(ready, { timeout: 40000 });
      await page.waitForFunction("!!document.querySelector('#ctMsgs .ct-welcrow') || document.querySelectorAll('#ctMsgs [data-mid]').length>0", { timeout: 20000 }).catch(() => {});
      await sleep(800);
      const first = await page.evaluate(() => ({ room: (document.querySelector('.ct-roomcur') || {}).textContent || '', ph: (document.getElementById('ctInput') || {}).placeholder || '', welc: !!document.querySelector('#ctMsgs .ct-welcrow'), txt: ((document.querySelector('#ctMsgs .ct-welcrow') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 200), items: [...document.querySelectorAll('.ct-roomitem .ct-ri-l')].map(x => x.textContent) }));
      chk('[LB] a brand-new member\'s chat opens in the Welcome room', first.room === 'Welcome' && /Say hello/.test(first.ph), first);
      chk('the room menu offers All and Welcome', first.items.indexOf('All') >= 0 && first.items.indexOf('Welcome') >= 0, first.items);
      chk('[LB] the personal welcome row is there and names the member', first.welc && first.txt.indexOf('@' + NAME) >= 0 && /ONLY YOU SEE THIS/.test(first.txt), first.txt);
      const fit = await page.evaluate(() => { const r = document.querySelector('#ctMsgs .ct-welc'); const b = document.getElementById('ctMsgs'); if (!r || !b) return null; const rr = r.getBoundingClientRect(), br = b.getBoundingClientRect(); return { fits: rr.right <= br.right + 1 && rr.left >= br.left - 1, links: r.querySelectorAll('a[href]').length, btn: !!r.querySelector('[data-welcx]') }; });
      chk('the welcome card fits the box, links the three steps and carries Got it', !!fit && fit.fits && fit.links >= 3 && fit.btn, fit);
      // ---- the row is local: it is not in the room's history
      const hist = await (await fetch(ORIGIN + '/chat/admin/history?key=' + K + '&room=WELCOME')).json();
      chk('[LB] the welcome row is NOT a message - the room\'s history has no such row', !(hist.messages || []).some(m => /ONLY YOU SEE THIS/.test(String(m.t || ''))), { n: (hist.messages || []).length });
      // ---- Got it
      await page.click('#ctMsgs [data-welcx]'); await sleep(600);
      const gone = await page.evaluate(() => ({ welc: !!document.querySelector('#ctMsgs .ct-welcrow'), flag: Object.keys(localStorage).some(k => k.indexOf('mp_welc_x:') === 0) }));
      chk('Got it removes the row and remembers it', !gone.welc && gone.flag, gone);
      await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }); await page.waitForFunction(ready, { timeout: 40000 }); await sleep(1500);
      const again = await page.evaluate(() => ({ room: (document.querySelector('.ct-roomcur') || {}).textContent || '', welc: !!document.querySelector('#ctMsgs .ct-welcrow') }));
      chk('after a reload the welcome row stays gone and the room is still Welcome', again.room === 'Welcome' && !again.welc, again);
      // ---- a switch is remembered
      await page.evaluate(() => window.mpChatRoom('global')); await sleep(800);
      await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }); await page.waitForFunction(ready, { timeout: 40000 }); await sleep(1200);
      const sw = await page.evaluate(() => ({ room: (document.querySelector('.ct-roomcur') || {}).textContent || '', pick: localStorage.getItem('mp_ctroom') }));
      chk('[LB] switching to All is remembered across a reload', sw.room === 'All' && sw.pick === 'global', sw);
      // ---- the shared trade is a card
      await page.evaluate(() => window.mpChatRoom('WELCOME')); await sleep(1200);
      await page.evaluate((id) => window.mpChatSay('trade:' + id), shareId);
      await page.waitForFunction((id) => !!document.querySelector('#ctMsgs .ct-tk[data-trade="' + id + '"] .ct-tk-roe'), { timeout: 20000 }, shareId).catch(() => {});
      const card = await page.evaluate((id) => { const c = document.querySelector('#ctMsgs .ct-tk[data-trade="' + id + '"]'); if (!c) return null; const b = document.getElementById('ctMsgs'); const cr = c.getBoundingClientRect(), br = b.getBoundingClientRect(); const q = s => (c.querySelector(s) || {}).textContent || ''; return { tag: q('.ct-tk-tag'), roe: q('.ct-tk-roe'), pnl: q('.ct-tk-pnl').replace(/\s+/g, ' '), who: q('.ct-tk-who').replace(/\s+/g, ' '), foot: q('.ct-tk-f').replace(/\s+/g, ' '), spark: !!c.querySelector('.ct-tk-sp path'), fits: cr.right <= br.right + 1 && cr.width > 200, link: !!c.closest('a'), cls: c.className }; }, shareId);
      chk('[LB] trade:<id> renders as the ticket card: WIN tag, +ROE hero, dollar P&L on the margin', !!card && card.tag === 'WIN' && /^\+75%/.test(card.roe) && /\+\$15\.00/.test(card.pnl) && /on \$20/.test(card.pnl), card);
      chk('the card names the coin, the side and the leverage (the poster is already on the row above it)', !!card && /closed/.test(card.who) && /BTC/.test(card.who) && /long/.test(card.who) && /50x/.test(card.who), card && card.who);
      chk('the card draws the baked sparkline and the entry/exit foot, and fits the box', !!card && card.spark && /entry/.test(card.foot) && /100,000/.test(card.foot) && /101,500/.test(card.foot) && card.fits, card);
      chk('the card is not wrapped in the old link - it IS the .ct-trade element', !!card && !card.link && /ct-trade/.test(card.cls));
      await page.click('#ctMsgs .ct-tk[data-trade="' + shareId + '"]');
      await page.waitForFunction("!!document.querySelector('.mptk') && (document.querySelector('.mptk').textContent||'').indexOf('BTC')>=0", { timeout: 15000 }).catch(() => {});
      const modal = await page.evaluate(() => { const m = document.querySelector('.mptk'); return m ? (m.textContent || '').replace(/\s+/g, ' ').slice(0, 120) : ''; });
      chk('a click on the card opens the full ticket', /BTC/.test(modal), modal);
      chk('no page errors', errs.length === 0, errs);
      // ---- phone: the card fits 390px
      await page.setViewport({ width: 390, height: 844 });
      await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }); await page.waitForFunction(ready, { timeout: 40000 });
      await page.evaluate(() => window.mpChatRoom('WELCOME')); await sleep(1500);
      await page.waitForFunction((id) => !!document.querySelector('#ctMsgs .ct-tk[data-trade="' + id + '"] .ct-tk-roe'), { timeout: 20000 }, shareId).catch(() => {});
      const ph = await page.evaluate((id) => { const c = document.querySelector('#ctMsgs .ct-tk[data-trade="' + id + '"]'); if (!c) return null; const cr = c.getBoundingClientRect(); return { right: cr.right, w: cr.width, docW: document.documentElement.scrollWidth, vw: innerWidth }; }, shareId);
      chk('phone 390: the card fits the screen and the page does not scroll sideways', !!ph && ph.right <= ph.vw + 1 && ph.docW <= ph.vw + 1 && ph.w > 220, ph);
      await page.close();
    });
  } catch (e) { chk('threw: ' + String(e.message || e).slice(0, 200), false); }
  finally {
    try { await api('/api/admin/e2euser', { uid: U, op: 'rm' }); } catch (e) {}
  }
  console.log(out.join('\n'));
  const f = out.filter(x => x.indexOf('FAIL') === 0).length;
  console.log('\n' + (out.length - f) + ' ok, ' + f + ' failed' + (f ? '' : '') + '  (run node build/e2e-sweep.js - the share and the probe row are real room rows)');
  process.exitCode = f ? 1 : 0;
})();

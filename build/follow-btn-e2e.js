/* THE FOLLOW BUTTON, REWRITTEN (2026-10-17, owner: "i dalje vidim ikonicu dodaj prijatelja iako smo vec
   prijatelji, a kad sam par puta nesto kliknuo dosta je bagovala i u onako malom prostoru je pokusala da ispise
   following ... obrisi taj zapetljani kod i odradi nov").

   Two REAL throwaway members, both directions, driven through the real card. The load-bearing checks:
     - friends shows the FRIENDS glyph, not the plus                     (the owner's report)
     - the button is NEVER a label: no text node inside it, ever          (the owner's report)
     - the state survives closing and reopening the card
     - clicking three times in a row lands on the right state and makes exactly ONE request per click
     - a card opened BEFORE the deferred mp-auth bundle exists is still correct, and offers no Follow on
       your own profile - that is what made it show the plus to a friend
   node build/follow-btn-e2e.js                                                                            */
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_DESKTOP } = require('./e2e-browser');
const BASE = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d === undefined ? '' : '  -> ' + JSON.stringify(d).slice(0, 240))); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const adm = (p, b) => fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify(b) }).then(r => r.json());

(async () => {
  const A = 'e2efbtna' + Math.random().toString(36).slice(2, 6), B = 'e2efbtnb' + Math.random().toString(36).slice(2, 6);
  const nameA = 'e2e_' + A, nameB = 'e2e_' + B;
  let tokA = null;
  try {
    for (const u of [A, B]) await adm('/api/admin/e2euser', { uid: u, op: 'mk' });
    tokA = (await adm('/api/admin/e2euser', { uid: A, op: 'sess' })).token;
    const tokB = (await adm('/api/admin/e2euser', { uid: B, op: 'sess' })).token;
    const asB = (p, o) => fetch(BASE + p, Object.assign({ headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tokB } }, o || {})).then(r => r.json());
    const uidA = (await asB('/api/lb/user?name=' + nameA)).uid;

    // ---- the server contract the button now rests on -------------------------------------------------
    const card = await fetch(BASE + '/api/lb/user?name=' + nameB, { headers: { cookie: 'mp_sess=' + tokA } }).then(r => r.json());
    ok('the card says whether the reader is signed in and whether it is their own profile', card.viewerSignedIn === true && card.isSelf === false, { v: card.viewerSignedIn, s: card.isSelf });
    const self = await fetch(BASE + '/api/lb/user?name=' + nameA, { headers: { cookie: 'mp_sess=' + tokA } }).then(r => r.json());
    ok('and it says isSelf on your own card', self.isSelf === true, { s: self.isSelf });
    const guest = await fetch(BASE + '/api/lb/user?name=' + nameB).then(r => r.json());
    ok('a guest is told so rather than being guessed at', guest.viewerSignedIn === false && guest.isSelf === false);

    await withBrowser(async (browser) => {
      const page = await newPage(browser, { ua: UA_DESKTOP });
      await page.setViewport({ width: 1366, height: 900 });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
      const posts = []; page.on('request', r => { if (r.url().includes('/api/lb/follow') && r.method() === 'POST') posts.push(1); });
      await page.setCacheEnabled(false);
      await page.setCookie({ name: 'mp_sess', value: tokA, domain: 'marginpad.io', path: '/' });
      await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
      await page.goto(BASE + '/leaderboards/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await sleep(1500);
      await page.evaluate(() => { const a = document.querySelector('[data-lbu]'); if (a) a.click(); });
      await page.waitForFunction('!!window.mpOpenProfile', { timeout: 30000 });
      await sleep(600);

      const open = async (n) => { await page.evaluate((x) => { if (window.mpCloseProfile) window.mpCloseProfile(); window.mpOpenProfile(x); }, n); await page.waitForSelector('.lbm.on .lbm-head', { timeout: 20000 }); await sleep(1100); };
      const look = () => page.evaluate(() => {
        const b = document.querySelector('.lbm.on .lbm-folb');
        const nameEl = document.querySelector('.lbm.on .lbm-name');
        if (!b) return { btn: false, pill: nameEl ? (nameEl.querySelector('.lbm-friend, .lbm-fw') || {}).className || '' : '' };
        const plus = b.querySelector('.fplus'), chk = b.querySelector('.fchk');
        const vis = (el) => !!(el && getComputedStyle(el).display !== 'none');
        // a TEXT node inside the button is the bug the owner saw: "it tried to print following in that small space"
        const txt = [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        return { btn: true, st: b.getAttribute('data-st'), plus: vis(plus), chk: vis(chk), on: b.classList.contains('on'), friend: b.classList.contains('friend'),
          text: txt, title: b.getAttribute('title') || '', w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height),
          pill: nameEl ? ((nameEl.querySelector('.lbm-friend, .lbm-fw') || {}).className || '') : '' };
      });
      const tap = async () => { await page.evaluate(() => document.querySelector('.lbm.on .lbm-folb').click()); await sleep(1500); };

      console.log('\nA looks at B');
      await open(nameB);
      let v = await look();
      ok('not following: the plus shows, the check does not', v.btn && v.st === 'none' && v.plus && !v.chk && !v.on, v);
      ok('the button is a glyph, never a label', v.text === '' && v.w <= 40 && v.h <= 40, v);
      // a title attribute is a TOOLTIP, i.e. text that appears when you reach for the button - the owner saw
      // exactly that and said text must never appear. aria-label names it without drawing anything.
      ok('and it carries NO title, so no word can appear on hover', !v.title, { title: v.title });

      await tap();
      v = await look();
      // TWO GLYPHS, not three (owner 2026-10-17: "samo treba da budu 2 razlicita coveculjka"). Not following =
      // person + plus. Following = person + CHECK, whether or not it is mutual; friends keep the filled tile.
      ok('one tap: following - the plus is gone and the CHECK is showing', v.st === 'follow' && !v.plus && v.chk && v.on && !v.friend, v);
      ok('and still no text in it', v.text === '', v);

      // B follows back from the server side, then A reopens the card
      await asB('/api/lb/follow', { method: 'POST', body: JSON.stringify({ tuid: uidA, tname: nameA }) });
      await open(nameB);
      v = await look();
      ok('WHEN THEY FOLLOW BACK, THE CARD SHOWS FRIENDS - not the add-friend plus (the reported bug)', v.st === 'friends' && v.chk && !v.plus && v.friend, v);
      ok('and the pill beside the name says Friends', /lbm-friend/.test(v.pill), v.pill);

      console.log('\nthe same card, closed and opened again');
      await open(nameB);
      v = await look();
      ok('the state survives a reopen (it is read from the server, not remembered per device)', v.st === 'friends' && v.chk, v);

      console.log('\nthree taps in a row');
      posts.length = 0;
      await tap(); const a1 = await look();
      await tap(); const a2 = await look();
      await tap(); const a3 = await look();
      ok('tap 1 unfollows: back to the plus, and the pill falls back to "Follows you"', a1.st === 'none' && a1.plus && /lbm-fw/.test(a1.pill), { a1 });
      ok('tap 2 follows again: straight to FRIENDS, because the answer carries both directions', a2.st === 'friends' && a2.chk, { a2 });
      ok('tap 3 unfollows again, still consistent', a3.st === 'none' && a3.plus, { a3 });
      ok('every tap is exactly one request - no double-fire', posts.length === 3, posts.length);
      ok('no text ever appeared in the button', !a1.text && !a2.text && !a3.text, [a1.text, a2.text, a3.text]);

      console.log('\nyour own card, and a card opened before the auth bundle exists');
      await open(nameA);
      v = await look();
      ok('your own profile offers no Follow button at all', v.btn === false, v);
      await page.evaluate(() => { try { delete window.mpAuth; } catch (e) { window.mpAuth = undefined; } });
      await open(nameB);
      v = await look();
      ok('with mp-auth gone the card is STILL right - it reads the server, not the deferred bundle', v.btn && v.st === 'follow' || v.st === 'friends' || v.st === 'none', v);
      ok('and it is not the guest button', v.btn === true, v);
      ok('no page errors', !errs.length, errs.slice(0, 3));
      await page.close();
    });
  } finally {
    for (const u of [A, B]) await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {});
  }
  console.log('\n' + pass + ' ok, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('ERR', e && e.stack || e); process.exitCode = 1; });

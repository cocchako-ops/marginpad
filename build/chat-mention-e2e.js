/* @MENTIONS, THE COMPOSER THAT SUGGESTS REAL ACCOUNTS, AND THE ROOM THAT KEEPS THE READER'S PLACE
   (2026-10-18, owner: "kad kucam @, hocu da kako kucam username da mi se ponudi taj korisnik kog zelim da
   tagujem. Svaki mora da postoji." + "da radi bas bas smooth")

   The load-bearing checks are the ones that go red if the DESIGN broke, not the ones that prove a panel exists:

     EVERY SUGGESTION IS A REAL ACCOUNT - each name the endpoint offers is looked up again, one at a time, and
     must resolve to a live account; a made-up name handed to the verification mode must come back empty; a
     suspended member must stop being suggestible the moment they are suspended.
     THE AUTHOR IS THE SESSION - a raw socket claiming somebody else's display name must be published under its
     OWN name, and a raw socket carrying a forged x-mp-cuid must not be able to delete the message it points at.
     ENTER DOES NOT SEND WHILE A SUGGESTION IS UP - that is the one keystroke a mention feature can ruin.
     A NEW MESSAGE DOES NOT MOVE A READER WHO SCROLLED UP - with the count of what they have not seen.

                                                       node build/chat-mention-e2e.js   [--pure]
   --pure runs only the legs that need no browser.                                                            */
'use strict';
const fs = require('fs');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.indexOf('--pure') >= 0;
const K = fs.readFileSync(__dirname + '/../ADMIN_KEY.local.txt', 'utf8').replace(/^﻿/, '').match(/mpadm_[a-f0-9]+/)[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const api = async (p, b) => (await fetch(O + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
const get = async (p) => (await fetch(O + p, { headers: { 'x-admin-key': K } })).json();
const pub = async (p) => (await fetch(O + p)).json();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FALS = process.argv.indexOf('--falsify') >= 0;
let pass = 0, fail = 0; const failed = [];
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; failed.push(m); console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 240) : '')); } };
/* --falsify SERVES A BROKEN BUNDLE and requires the named checks to go red. Three mutations, each the exact state
   of the code before this change: the composer engine removed, mentionify back to MarginPad's own lines only, and
   the scroll yank restored. A suite that cannot fail is worth nothing, and these three are the owner-visible half. */
const BREAK = [
  ['dist/assets/mp-auth.js', 'window.mpMention = function (input, opts) {', 'window.mpMention = function () { return null; }; var _dead = function (input, opts) {'],
  ['dist/assets/home.js', ':mentionify(linkifyMsg(m.t));', ':linkifyMsg(m.t);if(m.admin)_body=mentionify(_body);'],
  ['dist/assets/home.js', 'msgs.appendChild(d);ctAfterAdd(d,m);', 'msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;']
];
const MUST_FAIL = [
  'desktop: typing @ and two letters offers somebody',
  'desktop: Enter picked the name and did NOT send the message',
  'the @name rendered as a mention chip, not plain text',
  'and the row is marked because it named the reader',
  'the reader stayed where they were',
  'and a pill says how much they have not seen'
];
async function armFalsify(page) {
  if (!FALS) return;
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const u = req.url();
    const hit = BREAK.filter(b => u.indexOf('/assets/' + b[0].split('/').pop()) >= 0);
    if (!hit.length) { try { await req.continue(); } catch (e) {} return; }
    try {
      let body = fs.readFileSync(__dirname + '/../' + hit[0][0], 'utf8');
      hit.forEach(b => { body = body.split(b[1]).join(b[2]); });
      await req.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body });
    } catch (e) { try { await req.continue(); } catch (x) {} }
  });
}

let WSLib = null; try { WSLib = require('../node_modules/ws'); } catch (e) {}
// speak to the room as a raw client: the security checks must not depend on what a page chooses to send
function forge(opts, msgs, collect) {
  return new Promise((res) => {
    if (!WSLib) return res(null);
    const hdr = { origin: O };
    if (opts.token) hdr.cookie = 'mp_sess=' + opts.token;
    if (opts.cuid) hdr['x-mp-cuid'] = opts.cuid;
    if (opts.cun) hdr['x-mp-cun'] = opts.cun;
    const seen = [];
    const ws = new WSLib(O.replace('https://', 'wss://') + '/chat/ws?room=global', { headers: hdr });
    const done = () => { try { ws.close(); } catch (e) {} res(seen); };
    ws.on('message', (d) => { try { seen.push(JSON.parse(String(d))); } catch (e) {} });
    ws.on('open', () => { setTimeout(() => { msgs.forEach(m => { try { ws.send(JSON.stringify(m)); } catch (e) {} }); setTimeout(done, collect || 1600); }, 500); });
    ws.on('error', () => res(null));
    setTimeout(() => res(seen), 12000);
  });
}
const roomHist = async () => (await get('/chat/admin/history')).messages || [];

(async () => {
  const A = 'e2ecmna' + Math.random().toString(36).slice(2, 6);
  const B = 'e2ecmnb' + Math.random().toString(36).slice(2, 6);
  await api('/api/admin/e2euser', { uid: A, op: 'mk' });
  await api('/api/admin/e2euser', { uid: B, op: 'mk' });
  const sa = await api('/api/admin/e2euser', { uid: A, op: 'sess' });
  const sb = await api('/api/admin/e2euser', { uid: B, op: 'sess' });
  const NA = 'e2e_' + A, NB = 'e2e_' + B;

  console.log('\nTHE SUGGESTIONS ARE REAL ACCOUNTS');
  // a one-letter prefix is a member directory, not a suggestion
  const one = await pub('/chat/who?q=p');
  ok(Array.isArray(one.more) && !one.more.length && !one.room.length, 'a one-character prefix suggests nothing', one);

  // every name offered for a two-letter prefix must resolve to a live account, checked one at a time
  const pre = await pub('/chat/who?q=ch');
  ok((pre.more || []).length > 0, 'a two-character prefix offers somebody', pre);
  let realN = 0, badName = null;
  for (const it of (pre.more || []).slice(0, 8)) {
    const u = await get('/api/auth/user?username=' + encodeURIComponent(it.u));
    if (u && u.exists && u.user && String(u.user.username).toLowerCase() === String(it.u).toLowerCase()) realN++;
    else badName = it.u;
  }
  ok(badName === null && realN > 0, 'every suggested name resolves to a live account (' + realN + ' checked)', badName);
  ok((pre.more || []).every(x => x.u && typeof x.col === 'string'), 'each row carries the name and its level colour');

  // the verification mode is what makes the room half trustworthy: a name the page shows but the table does
  // not know must be dropped, or the whole "svaki mora da postoji" promise is empty
  const mix = await pub('/chat/who?c=' + encodeURIComponent((pre.more[0] || {}).u + ',NotARealName99x,' + NA));
  const got = (mix.room || []).map(x => String(x.u).toLowerCase());
  ok(got.indexOf(String((pre.more[0] || {}).u).toLowerCase()) >= 0, 'verification returns the real name');
  ok(got.indexOf('notarealname99x') < 0, 'verification DROPS a name no account has');
  ok(got.indexOf(NA.toLowerCase()) < 0, 'a test account is never suggested', got);
  const e2eq = await pub('/chat/who?q=e2e');
  ok(!(e2eq.more || []).length, 'and not by prefix either', e2eq);

  // A BANNED MEMBER IS NOT SUGGESTIBLE - an @ that can never be read is the bug, not the feature. Measured against
  // a REAL banned account rather than one made for the test: an e2e account is filtered by NAME, so banning one
  // would have proved nothing at all (the first cut of this check did exactly that).
  const secRows = (await get('/api/admin/security')).rows || [];
  const banned = secRows.filter(x => x.username && x.status === 'banned')[0];
  const live = secRows.filter(x => x.username && (!x.status || x.status === 'active') && String(x.username).toLowerCase().indexOf('e2e_') !== 0)[0];
  ok(!!banned && !!live, 'setup: the site has a banned account and a live one to compare against', { banned: !!banned, live: !!live });
  if (banned && live) {
    const bq = await pub('/chat/who?c=' + encodeURIComponent(banned.username + ',' + live.username));
    const names = (bq.room || []).map(x => String(x.u).toLowerCase());
    ok(names.indexOf(String(live.username).toLowerCase()) >= 0, 'the live account comes back (so the check below means something)', names);
    ok(names.indexOf(String(banned.username).toLowerCase()) < 0, 'a banned account does NOT', names);
  }

  console.log('\nTHE AUTHOR IS THE SESSION, NOT THE PAYLOAD');
  const tag = 'mn' + Math.random().toString(36).slice(2, 7);
  const claim = 'TotallyNotMe' + Math.random().toString(36).slice(2, 5);
  await forge({ token: sa.token }, [{ type: 'msg', u: claim, t: 'author probe ' + tag }]);
  await sleep(900);
  let hist = await roomHist();
  const mine = hist.filter(m => String(m.t || '').indexOf('author probe ' + tag) >= 0).pop();
  ok(!!mine, 'the forged socket posted', mine && mine.u);
  ok(!!mine && mine.u === NA, 'the message is published under the SESSION\'S username, not the claimed one', mine && mine.u);
  ok(!!mine && mine.u !== claim, 'the claimed name is discarded');

  // a socket with no session cannot post at all - it can still read, as it always could
  const g = 'guest probe ' + Math.random().toString(36).slice(2, 7);
  const seenG = await forge({}, [{ type: 'msg', u: 'SomebodyElse', t: g }]);
  await sleep(900);
  hist = await roomHist();
  ok(!hist.some(m => String(m.t || '') === g), 'a socket with no session cannot post');
  ok((seenG || []).some(x => x && x.type === 'actfail' && x.why === 'signin'), 'and it is TOLD why, never silently dropped', (seenG || []).map(x => x && x.type));
  ok((seenG || []).some(x => x && x.type === 'history'), 'a guest socket still receives the room');

  // A FORGED x-mp-cuid MUST NOT AUTHORISE ANYTHING. `new Request(request,{headers})` copies the caller's headers,
  // so before this was stripped a raw client could claim any account id - and that header is what decides
  // whose message you may delete.
  const uid = (await get('/api/auth/user?username=' + encodeURIComponent(NA))).user.id;
  ok(!!mine.id, 'the author\'s message has an id to aim at');
  await forge({ cuid: uid, cun: NA }, [{ type: 'del', id: mine.id }]);
  await sleep(900);
  hist = await roomHist();
  ok(hist.some(m => m.id === mine.id), 'a forged x-mp-cuid cannot delete that member\'s message', mine.id);
  // and the real session still can - otherwise the check above would pass with the whole feature broken
  await forge({ token: sa.token }, [{ type: 'del', id: mine.id }]);
  await sleep(900);
  hist = await roomHist();
  ok(!hist.some(m => m.id === mine.id), 'the real session still can (so the check above means something)');

  if (PURE) { await api('/api/admin/e2euser', { uid: A, op: 'rm' }); await api('/api/admin/e2euser', { uid: B, op: 'rm' }); console.log('\n' + pass + ' passed, ' + fail + ' failed  (--pure)'); process.exit(fail ? 1 : 0); }

  const { withBrowser } = require('./e2e-browser.js');
  await withBrowser(async (browser) => {
    async function chatPage(token, vp) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport(vp || { width: 1366, height: 900 });
      await page.setCacheEnabled(false);
      await armFalsify(page);   // interception must be armed BEFORE the first navigation
      await page.setCookie({ name: 'mp_sess', value: token, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2600);
      await page.evaluate(() => { const f = document.getElementById('chatFab'); if (f) f.click(); });
      await sleep(3000);
      return { ctx, page, errs };
    }
    const panel = (page) => page.evaluate(() => {
      const p = document.querySelector('#ctForm .mpac');
      if (!p) return { none: true };
      const rows = [...p.querySelectorAll('[data-i]')].map(r => ({ t: (r.textContent || '').trim(), on: r.className.indexOf('on') >= 0 }));
      return { on: p.className.indexOf('on') >= 0, rows: rows, w: p.getBoundingClientRect().width };
    });

    for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
      const tagv = vp.width < 500 ? 'phone' : 'desktop';
      console.log('\nTHE COMPOSER, ' + tagv);
      const pa = await chatPage(sa.token, vp);

      const open = await pa.page.evaluate(() => { const i = document.getElementById('ctInput'); return !!i && !!(i.offsetWidth || i.offsetHeight); });
      ok(open, tagv + ': the chat opens for a signed-in member');

      // the panel must not exist before anything is typed
      ok((await panel(pa.page)).none || !(await panel(pa.page)).on, tagv + ': nothing is suggested before anything is typed');

      await pa.page.focus('#ctInput');
      await pa.page.type('#ctInput', 'hey @ch', { delay: 35 });
      await sleep(1400);
      let P = await panel(pa.page);
      ok(!P.none && P.on && P.rows.length > 0, tagv + ': typing @ and two letters offers somebody', P);
      ok(!P.none && P.rows.every(r => r.t.charAt(0) === '@'), tagv + ': every row is a name', P.rows);
      ok(!P.none && P.rows.filter(r => r.on).length === 1, tagv + ': exactly one row is selected', P.rows);

      // ENTER MUST NOT SEND while a suggestion is up - the one keystroke this feature can ruin
      const nBefore = await pa.page.evaluate(() => document.querySelectorAll('#ctMsgs [data-mid]').length);
      await pa.page.keyboard.press('ArrowDown');
      await sleep(260);
      P = await panel(pa.page);
      ok(!P.none && P.rows.length > 1 ? P.rows[1].on : true, tagv + ': the arrow keys move the selection', P.rows);
      await pa.page.keyboard.press('Enter');
      await sleep(1200);
      const after = await pa.page.evaluate(() => ({ v: document.getElementById('ctInput').value, n: document.querySelectorAll('#ctMsgs [data-mid]').length }));
      ok(after.n === nBefore, tagv + ': Enter picked the name and did NOT send the message', after);
      ok(/^hey @\w+ $/.test(after.v), tagv + ': the name was inserted at the caret with a trailing space', after.v);
      ok(!(await panel(pa.page)).on, tagv + ': the panel closes once a name is picked');

      // the name it inserted must be an account that exists
      const ins = (after.v.match(/@(\w+)/) || [])[1] || '';
      const insReal = ins ? await get('/api/auth/user?username=' + encodeURIComponent(ins)) : null;
      ok(!!(insReal && insReal.exists), tagv + ': the inserted name is a real account', ins);

      // Escape closes the panel and NOT the chat
      await pa.page.type('#ctInput', '@ch', { delay: 35 });
      await sleep(1300);
      ok((await panel(pa.page)).on, tagv + ': it offers again further along the line');
      await pa.page.keyboard.press('Escape');
      await sleep(300);
      ok(!(await panel(pa.page)).on, tagv + ': Escape closes the panel');
      ok(await pa.page.evaluate(() => { const b = document.getElementById('chatBox'); return !!b && !b.hidden; }), tagv + ': and leaves the chat open');

      /* THE SLASH PALETTE IS MODERATOR-ONLY, AND ALWAYS HAS BEEN - measured: /api/auth/chatcmd answers an
         ordinary member "Unknown command" for /cmds, so ccProbe sets ccDeny and the list never appears. The first
         cut of this check asserted the opposite and went red on working code. What EVERY member has is the
         in-page commands the submit handler answers itself (/leaderboard, /signal), and what matters here is that
         Enter still submits when no suggestion is up - the half of the keyboard this feature could have broken. */
      await pa.page.evaluate(() => { const i = document.getElementById('ctInput'); i.value = ''; i.focus(); i.dispatchEvent(new Event('input', { bubbles: true })); });
      await pa.page.type('#ctInput', '/le', { delay: 40 });
      await sleep(1500);
      P = await panel(pa.page);
      ok(P.none || !P.on, tagv + ': an ordinary member is offered no command list (they have no commands)', P);
      await pa.page.evaluate(() => { const i = document.getElementById('ctInput'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
      await pa.page.focus('#ctInput');
      const nb2 = await pa.page.evaluate(() => document.querySelectorAll('#ctMsgs .ct-sys').length);
      await pa.page.type('#ctInput', '/lb', { delay: 40 });
      await sleep(600);
      await pa.page.keyboard.press('Enter');
      await sleep(2200);
      const lb = await pa.page.evaluate((n) => ({ sys: document.querySelectorAll('#ctMsgs .ct-sys').length > n, v: document.getElementById('ctInput').value }), nb2);
      ok(lb.sys, tagv + ': Enter still runs an in-page command when nothing is suggested', lb);
      ok(lb.v === '', tagv + ': and the composer is cleared', lb);

      // an email typed into the room must not raise the mention panel
      await pa.page.evaluate(() => { const i = document.getElementById('ctInput'); i.value = ''; i.focus(); });
      await pa.page.type('#ctInput', 'write me at bob@gma', { delay: 25 });
      await sleep(1200);
      ok(!(await panel(pa.page)).on, tagv + ': a mid-word @ (an email address) suggests nothing');
      await pa.page.evaluate(() => { const i = document.getElementById('ctInput'); i.value = ''; });

      if (tagv === 'desktop') {
        console.log('\nA MENTION IS VISIBLE, AND NAMING SOMEBODY REACHES THEM');
        // B names A in the room; A's row must be marked and the chip clickable
        const t = 'oi @' + NA + ' look ' + Math.random().toString(36).slice(2, 6);
        await forge({ token: sb.token }, [{ type: 'msg', u: NB, t: t }]);
        await sleep(2600);
        const hit = await pa.page.evaluate((txt) => {
          const r = [...document.querySelectorAll('#ctMsgs [data-mid]')].filter(x => (x.innerText || '').indexOf(txt) >= 0).pop();
          if (!r) return { none: true };
          const mn = r.querySelector('[data-mn]');
          return { hit: r.className.indexOf('ct-hit') >= 0, mn: !!mn, ok: !!(mn && mn.className.indexOf('ok') >= 0), lbu: mn ? mn.getAttribute('data-lbu') : null };
        }, 'look ');
        ok(!hit.none, 'the message arrived', hit);
        ok(!hit.none && hit.mn, 'the @name rendered as a mention chip, not plain text', hit);
        ok(!hit.none && hit.hit, 'and the row is marked because it named the reader', hit);
        ok(!hit.none && hit.ok && hit.lbu, 'the chip is clickable because the account was confirmed', hit);
        await pa.page.evaluate(() => { const m = document.querySelector('#ctMsgs [data-mn].ok'); if (m) m.click(); });
        await sleep(1600);
        ok(await pa.page.evaluate(() => !!document.querySelector('.lbm-card') || !!window.mpOpenProfile), 'tapping a mention opens that trader\'s card');

        console.log('\nA NEW MESSAGE DOES NOT MOVE A READER WHO SCROLLED UP');
        // fill the stream so there is somewhere to scroll to, then park the reader at the top
        for (let i = 0; i < 3; i++) await forge({ token: sb.token }, [{ type: 'msg', u: NB, t: 'filler ' + i + ' ' + Math.random().toString(36).slice(2, 6) }]);
        await sleep(2200);
        const park = await pa.page.evaluate(() => { const m = document.getElementById('ctMsgs'); m.scrollTop = 0; return { top: m.scrollTop, h: m.scrollHeight, c: m.clientHeight }; });
        ok(park.h > park.c + 60, 'setup: the stream is long enough to scroll', park);
        await sleep(600);
        await forge({ token: sb.token }, [{ type: 'msg', u: NB, t: 'arrived while reading ' + Math.random().toString(36).slice(2, 6) }]);
        await sleep(2600);
        const kept = await pa.page.evaluate(() => {
          const m = document.getElementById('ctMsgs'), p = document.querySelector('#chatBox .ct-newp');
          return { top: m.scrollTop, pill: !!(p && p.className.indexOf('on') >= 0), txt: p ? (p.textContent || '').trim() : '' };
        });
        ok(kept.top < 40, 'the reader stayed where they were', kept);
        ok(kept.pill && /\d/.test(kept.txt), 'and a pill says how much they have not seen', kept);
        await pa.page.evaluate(() => { const p = document.querySelector('#chatBox .ct-newp'); if (p) p.click(); });
        await sleep(700);
        const back = await pa.page.evaluate(() => { const m = document.getElementById('ctMsgs'), p = document.querySelector('#chatBox .ct-newp'); return { atEnd: (m.scrollHeight - m.scrollTop - m.clientHeight) < 48, pill: !!(p && p.className.indexOf('on') >= 0) }; });
        ok(back.atEnd, 'tapping the pill returns them to the newest message', back);
        ok(!back.pill, 'and the pill goes away');

        // their OWN message always scrolls into view - a composer that sends into the void is worse
        await pa.page.evaluate(() => { document.getElementById('ctMsgs').scrollTop = 0; });
        await sleep(400);
        await pa.page.focus('#ctInput');
        await pa.page.type('#ctInput', 'my own line ' + Math.random().toString(36).slice(2, 5), { delay: 12 });
        await pa.page.keyboard.press('Enter');
        await sleep(2600);
        ok(await pa.page.evaluate(() => { const m = document.getElementById('ctMsgs'); return (m.scrollHeight - m.scrollTop - m.clientHeight) < 60; }), 'sending always jumps to your own message');
      }

      ok(pa.errs.length === 0, tagv + ': no page errors', pa.errs.slice(0, 3));
      await pa.ctx.close();
    }
  });

  await api('/api/admin/e2euser', { uid: A, op: 'rm' });
  await api('/api/admin/e2euser', { uid: B, op: 'rm' });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (FALS) {
    const missed = MUST_FAIL.filter(m => failed.indexOf(m) < 0);
    console.log('\n--falsify: ' + (MUST_FAIL.length - missed.length) + ' of ' + MUST_FAIL.length + ' load-bearing checks went red');
    missed.forEach(m => console.log('  DID NOT FAIL (so it proves nothing): ' + m));
    process.exitCode = missed.length ? 1 : 0;
    return;
  }
  process.exitCode = fail ? 1 : 0;   // never process.exit mid-teardown: libuv aborts and the shell reads 127 on a green run
})().catch(e => { console.error(e); process.exitCode = 1; });

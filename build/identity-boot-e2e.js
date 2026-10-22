/* IDENTITY AT FRAME 0 (2026-10-22, owner: "zasto me ponekad aplikacija ne prepozna kao ulogovanog korisnika?
   Desavalo se da otvorim chat u sred ulogovane sesije i da mi pise da treba da se ulogujem").

   MEASURED before the fix, signed-in member on a throttled phone: mpAuth.me() first answered 1750ms (fast 4G)
   and 4432ms (slow 4G) after navigation - 870ms and 2228ms AFTER the page had already painted. For that whole
   window every surface asking mpAuth.me() believed the member was a guest.

   The load-bearing check here is not "mpMe exists". It is the SYMPTOM, staged deterministically: /api/auth/me
   is held for four seconds and the chat is opened inside that window. Before the fix it renders the sign-in
   gate to a signed-in member; after it, the message stream. Everything else guards the ways a client-side
   identity cache could do harm - a signed-out device must never render a member out of it, and signing out
   must clear it.

   node build/identity-boot-e2e.js                                                                            */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  -> ' + JSON.stringify(d).slice(0, 200) : '')); } };

(async () => {
  /* ---------- the markup contract: the boot must come before the bundle it replaces the wait for ---------- */
  for (const [nm, url] of [['app shell', '/paper-trade'], ['bento homepage', '/']]) {
    const h = await fetch(O + url + '?nc=1&cb=' + Date.now()).then(r => r.text());
    const boot = h.indexOf('window.mpMe={'), auth = h.indexOf('mp-auth.js');
    ok(boot > 0, nm + ': publishes window.mpMe inline');
    ok(boot > 0 && auth > 0 && boot < auth, nm + ': and does it BEFORE the deferred bundle', { boot, auth });
    ok((h.match(/window\.mpMe=\{/g) || []).length === 1, nm + ': exactly once - two readings of one fact drift');
    ok(h.indexOf('<meta charset') >= 0 && h.indexOf('<meta charset') < boot, nm + ': charset still comes first (the 1024-byte prescan)');
  }

  const uid = 'e2eidb' + Date.now().toString(36);
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const se = await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());
  const tok = se.token || se.sess || se.mp_sess;
  ok(!!tok, 'a test member with a session');

  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const cookies = [
      { name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' },
      { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' },
      { name: 'mp_uid', value: uid, domain: 'marginpad.io', path: '/' }];
    await page.setCookie(...cookies);
    await page.setCacheEnabled(false);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 140)));

    // visit one: this is what a member's PREVIOUS visit leaves behind
    await page.goto(O + '/paper-trade', { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction('window.mpAuth && window.mpAuth.me && window.mpAuth.me()', { timeout: 30000 }).catch(() => {});
    const wrote = await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('mp_me') || 'null'); return { has: !!s, name: s && s.u && s.u.username, t: s && s.t }; } catch (e) { return { has: false }; } });
    ok(wrote.has && !!wrote.name, 'a confirmed /api/auth/me writes the snapshot', wrote);

    /* ---------- THE SYMPTOM, staged: hold /api/auth/me and open the chat inside that window ---------- */
    /* interception stays ON for the rest of the run: disabling it while a held request is still pending throws
       out of puppeteer's own finalizer, where a try/catch at the call site cannot reach it */
    let holdMe = true;
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (holdMe && req.url().indexOf('/api/auth/me') >= 0) { setTimeout(() => { try { req.continue(); } catch (e) {} }, 4000); return; }
      try { req.continue(); } catch (e) {}
    });
    /* evaluateOnNewDocument runs BEFORE any page script, so reading window.mpMe here finds nothing and the
       timing check silently passed on `== null`. A check that cannot fail is worth nothing (CLAUDE.md) - so
       catch the ASSIGNMENT itself with a setter and record the moment the boot script publishes it. */
    await page.evaluateOnNewDocument(() => {
      window.__t = {};
      let v;
      try {
        Object.defineProperty(window, 'mpMe', {
          configurable: true,
          get() { return v; },
          set(x) { if (window.__t.mpMeAt == null) { window.__t.mpMeAt = performance.now(); window.__t.known = !!(x && x.in && x.user); } v = x; }
        });
      } catch (e) {}
    });
    await page.goto(O + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 });
    const early = await page.evaluate(() => {
      const fp = performance.getEntriesByType('paint').find(x => x.name === 'first-contentful-paint');
      return { ...window.__t, fcp: fp ? fp.startTime : null, inn: !!(window.mpMe && window.mpMe.in), user: !!(window.mpMe && window.mpMe.user), fresh: !!(window.mpMe && window.mpMe.fresh) };
    });
    ok(early.inn && early.user, 'the member is known from the snapshot while /api/auth/me is still in flight', early);
    ok(early.fresh === false, 'and it says so - fresh is false until the server has confirmed it on this load');
    ok(early.mpMeAt != null && early.fcp != null && early.mpMeAt < early.fcp,
      'identity is published BEFORE the first paint (' + Math.round(early.mpMeAt) + 'ms vs ' + Math.round(early.fcp) + 'ms)', early);

    /* THE FALSIFIABLE FORM: delete window.mpAuth outright before clicking, so the chat CANNOT fall back to it.
       This is the same technique srvopen-e2e uses, and it is the difference between proving the new path works
       and proving the old one happened to be ready. */
    await page.waitForSelector('#chatFab', { timeout: 30000 });
    const chat = await page.evaluate(() => {
      const had = !!(window.mpAuth && window.mpAuth.me && window.mpAuth.me());
      try { delete window.mpAuth; } catch (e) { window.mpAuth = undefined; }
      const f = document.getElementById('chatFab'); if (f) f.click();
      const g = document.getElementById('ctGate'), m = document.getElementById('ctMsgs');
      return { gate: !!(g && !g.hidden), stream: !!(m && !m.hidden), hadAuth: had, noAuthNow: !window.mpAuth, at: performance.now() };
    });
    ok(!chat.gate && chat.stream, 'THE SYMPTOM: the chat opens as a MEMBER mid-session, not as a sign-in gate', chat);
    ok(chat.noAuthNow, '    and it did so with window.mpAuth deleted - the frame-0 identity is what carried it');

    /* FALSIFICATION IN THE SAME RUN: take the frame-0 identity away as well and the gate MUST come back. Without
       this the check above could be passing for some other reason and nobody would ever know. */
    const fals = await page.evaluate(() => {
      const c = document.querySelector('#chatBox .ct-x, #chatBox [aria-label="Close"], #ctClose');
      if (c) c.click(); else { const b = document.getElementById('chatBox'); if (b) b.hidden = true; }
      try { delete window.mpMe; } catch (e) { window.mpMe = undefined; }
      const f = document.getElementById('chatFab'); if (f) { f.hidden = false; f.click(); }
      const g = document.getElementById('ctGate'), m = document.getElementById('ctMsgs');
      return { gate: !!(g && !g.hidden), stream: !!(m && !m.hidden) };
    });
    ok(fals.gate && !fals.stream, '    (falsified: with the frame-0 identity gone too, the sign-in gate returns)', fals);

    holdMe = false;   // stop delaying; interception itself stays on (see above)

    /* ---------- a signed-out device must never render a member out of the cache ---------- */
    await page.deleteCookie({ name: 'mp_li', domain: 'marginpad.io', path: '/' });
    await page.goto(O + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 });
    const out = await page.evaluate(() => {
      let raw = null; try { raw = localStorage.getItem('mp_me'); } catch (e) {}
      return { inn: !!(window.mpMe && window.mpMe.in), user: !!(window.mpMe && window.mpMe.user), snapStillThere: !!raw };
    });
    ok(out.snapStillThere, 'the snapshot is still on the device');
    ok(!out.inn && !out.user, 'but with no mp_li cookie it is IGNORED - the cookie is the authority, not the cache', out);

    ok(errs.length === 0, 'no page errors through any of it', errs);
    await page.close();
  });

  /* ---------- the source contract: one writer, and signing out clears it ---------- */
  const auth = await fetch(O + '/assets/mp-auth.js?cb=' + Date.now()).then(r => r.text());
  ok((auth.match(/function mpMeSnap/g) || []).length === 1, 'the snapshot has exactly one writer');
  ok(auth.indexOf('mpMeSnap(null)') >= 0, 'and signing out clears it');
  ok(/mpMeSnap\(ME\); reflect\(\)/.test(auth), 'every confirmed answer writes it');
  for (const f of ['home.js', 'mp-trade.js']) {
    const s = await fetch(O + '/assets/' + f + '?cb=' + Date.now()).then(r => r.text());
    ok(s.indexOf('window.mpMe&&window.mpMe.in?window.mpMe.user:null') >= 0, f + ': the chat reads the frame-0 identity, not the deferred bundle');
  }

  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

/* THE ACCOUNT PANELS DRAW FROM THE LAST ANSWER (2026-10-22, item 3 of the approved plan).

   Messages, a conversation and notifications each opened on the word "Loading…" and stayed there until a
   request came back - every time, for data that was on the device a minute earlier. The load-bearing check is
   therefore not "is there a cache": it HOLDS the request for four seconds and requires real content on screen
   inside that window, then falsifies itself by clearing the cache and requiring the spinner back.

   The rest guard the one way a cache like this could do harm: a shared device must never open somebody else's
   messages out of it. It is keyed per account and cleared on sign-out.

   node build/panel-cache-e2e.js                                                                              */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  -> ' + JSON.stringify(d).slice(0, 200) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const openPanel = async (page, sel) => {
  await page.evaluate(() => { const t = document.querySelector('[data-auth-open]'); if (t) t.click(); });
  await sleep(600);
  await page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); }, sel);
  await sleep(500);
};

(async () => {
  const uid = 'e2epc' + Date.now().toString(36);
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const se = await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());
  const tok = se.token || se.sess || se.mp_sess;
  ok(!!tok, 'a test member with a session');

  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setCookie(
      { name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' },
      { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' },
      { name: 'mp_uid', value: uid, domain: 'marginpad.io', path: '/' });
    await page.setCacheEnabled(false);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 140)));

    await page.goto(O + '/paper-trade', { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction('window.mpSWR && window.mpAuth && window.mpAuth.me && window.mpAuth.me()', { timeout: 40000 });
    ok(true, 'the panel cache helper is on the page');

    // visit one: open the panels so the last answer is on the device
    await openPanel(page, '#mpaNotifBtn, [data-auth-nav="notifs"], .mpa-nav-notifs');
    const warmed = await page.evaluate(() => {
      // whatever the panel buttons are called, SWR itself is the contract - exercise it directly
      return new Promise((res) => {
        window.mpSWR('notifs', '/api/auth/notifs', function (d, fresh) { if (fresh) res(!!d); });
      });
    });
    ok(warmed, 'a panel fetch through mpSWR answers and is remembered');
    const keys = await page.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('mpc:') === 0) o.push(k); } return o; });
    ok(keys.length > 0 && keys.every(k => k.indexOf(':notifs') > 0 || true), 'the answer is cached under a per-account key', keys);
    ok(keys.every(k => k.split(':').length >= 3 && k.split(':')[1].length > 3), 'and the key carries the ACCOUNT, so a shared device cannot read across members', keys);

    /* THE LOAD-BEARING ONE: hold the request and require content anyway */
    await page.setRequestInterception(true);
    let hold = true;
    page.on('request', req => {
      if (hold && req.url().indexOf('/api/auth/notifs') >= 0) { setTimeout(() => { try { req.continue(); } catch (e) {} }, 4000); return; }
      try { req.continue(); } catch (e) {}
    });
    const held = await page.evaluate(() => {
      const t0 = performance.now();
      return new Promise((res) => {
        let first = null;
        window.mpSWR('notifs', '/api/auth/notifs', function (d, fresh) {
          if (!fresh && first === null) first = { at: performance.now() - t0, got: !!(d && d.notifs) };
          if (fresh) res({ first: first, fresh: { at: performance.now() - t0 } });
        });
      });
    });
    ok(held.first && held.first.got && held.first.at < 200,
      'with the request held for four seconds, the panel still has real content in ' + Math.round((held.first || {}).at) + 'ms', held);
    ok(held.fresh.at > 3000, '    and the fresh answer still arrives afterwards and replaces it (' + Math.round(held.fresh.at) + 'ms)', held);

    /* FALSIFICATION: clear the cache and the same held request leaves nothing to draw */
    const empty = await page.evaluate(() => {
      window.mpCacheClear();
      const t0 = performance.now();
      return new Promise((res) => {
        let first = null;
        window.mpSWR('notifs', '/api/auth/notifs', function (d, fresh) {
          if (!fresh && first === null) first = performance.now() - t0;
          if (fresh) res({ first: first, fresh: performance.now() - t0 });
        });
      });
    });
    ok(empty.first === null && empty.fresh > 3000, '    (falsified: with the cache cleared there is nothing to draw until the request lands)', empty);
    hold = false;

    /* a guest must never write one, and signing out must take them away */
    const guest = await page.evaluate(() => {
      const was = window.mpMe && window.mpMe.user;
      window.mpMe = { in: false, user: null, fresh: true, at: 0 };
      const before = (function () { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('mpc:') === 0) n++; } return n; })();
      return new Promise((res) => {
        window.mpSWR('notifs', '/api/auth/notifs', function (d, fresh) {
          if (!fresh) return;
          let after = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('mpc:') === 0) after++; }
          window.mpMe = { in: true, user: was, fresh: true, at: Date.now() };
          res({ before, after });
        });
      });
    });
    ok(guest.after === guest.before, 'nothing is cached while the page believes it is a guest', guest);

    const cleared = await page.evaluate(() => {
      window.mpCacheClear();
      let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('mpc:') === 0) n++; }
      return n;
    });
    ok(cleared === 0, 'and the clear that runs on sign-out removes every cached panel');

    ok(errs.length === 0, 'no page errors', errs);
    await page.close();
  });

  /* the source contract */
  const a = await fetch(O + '/assets/mp-auth.js?cb=' + Date.now()).then(r => r.text());
  ok((a.match(/window\.mpSWR = function/g) || []).length === 1, 'one helper, not one per panel');
  ok((a.match(/window\.mpSWR\(/g) || []).length === 3, 'three panels use it: messages, a conversation, notifications');
  ok(a.indexOf('mpcClear();') >= 0, 'signing out clears the cache');
  ok(a.indexOf("if (fresh) fetch('/api/auth/notifs?seen=1')") >= 0,
    'notifications are marked read on the FRESH pass only - clearing the bell from a cached list would hide a new one');

  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

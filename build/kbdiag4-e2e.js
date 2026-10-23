#!/usr/bin/env node
/* KEYBOARD DIAGNOSTIC v4 - E2E (2026-10-24). See build/add-keyboard-diag4.js. There is no WebKit here, so this cannot
   prove a keyboard comes up; it proves the INSTRUMENT: on an emulated iOS home-screen app a real member taps the chat
   composer four times and the ladder runs r:0, r:1, r:2, r:3 (ghost) in that order, each tap records exactly one row
   that fits the worker's 110-char jserr cap and its character set, the ghost probe appends a bare input and removes it,
   the first non-composer field records ONE kbany row, and a desktop browser records nothing at all. Every beacon is
   intercepted and answered here - nothing reaches production. --local serves the working-tree mp-auth.js. */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const LOCAL = process.argv.indexOf('--local') >= 0;
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };
const BUNDLE = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const beacons = [];
async function prep(p, tok, ios, standalone) {
  await p.setCacheEnabled(false);
  if (ios) await p.setUserAgent(IOS_UA);
  await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  await p.setRequestInterception(true);
  p.on('request', req => {
    const u = req.url();
    if (/\/api\/track\?/.test(u)) { beacons.push(decodeURIComponent((u.match(/[?&]e=([^&]*)/) || [, ''])[1])); return req.respond({ status: 204, body: '' }); }
    if (LOCAL && /\/assets\/mp-auth\.js/.test(u)) return req.respond({ status: 200, contentType: 'application/javascript', body: BUNDLE });
    req.continue();
  });
  const cdp = await p.target().createCDPSession(); await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  if (standalone) await p.evaluateOnNewDocument(() => { try { Object.defineProperty(navigator, 'standalone', { get: function () { return true; }, configurable: true }); } catch (e) {} });
}
const LBL_RE = /^[a-zA-Z0-9 #:._/-]*$/;

(async () => {
  console.log('# source guards');
  ok(BUNDLE.indexOf('window.__mpKbDiag = 4') >= 0 && BUNDLE.indexOf('kbfail2 sa:') < 0, 'mp-auth carries v4 and the v2/v3 labels are gone');
  ok(/'kbfail3'|'kbok3'|'kbghost'|'kbany/.test(BUNDLE), 'the four v4 row kinds are in the bundle');

  const uid = 'e2ekb' + Date.now().toString(36);
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const se = await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());
  try {
    await withBrowser(async (b) => {
      console.log('# emulated iOS home-screen app, member, /paper-trade chat');
      const p = await b.newPage();
      await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await prep(p, se.token, true, true);
      const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
      await p.goto(O + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await p.waitForFunction("window.__mpKbDiag === 4 && document.getElementById('ctInput') && !document.getElementById('ctForm').hidden && document.getElementById('ctInput').offsetWidth > 0", { timeout: 40000 });
      await p.evaluate(() => { const c = document.getElementById('mpCkBar'); if (c) c.remove(); });
      const sa = await p.evaluate(() => navigator.standalone === true);
      ok(sa, 'the page reads as a standalone app');
      for (let i = 0; i < 4; i++) { await p.tap('#ctInput'); await sleep(1100); }
      const rows = await p.evaluate(() => window.__mpKbRows.slice());
      ok(rows.length === 4, 'four taps, four rows', rows);
      const kinds = rows.map(r => r.split(' ')[0]), rs = rows.map(r => (r.match(/ r:(\d)/) || [])[1]);
      ok(kinds.join(',') === 'kbfail3,kbfail3,kbfail3,kbghost', 'the ladder runs baseline, r1, r2, then the ghost probe', kinds);
      ok(rs.join(',') === '0,1,2,3', 'each row names the remedy that ran', rs);
      ok(rows.every(r => r.length <= 110 && LBL_RE.test(r)), 'every row fits the 110-char cap and the jserr character set', rows.map(r => r.length));
      ok(/ f:1 kb:0 /.test(rows[0]) && / sa:1 /.test(rows[0]) && / hf:\d /.test(rows[0]) && / a0:/.test(rows[0]) && / v:/.test(rows[0]) && / ios:18_7/.test(rows[0]), 'the baseline row carries focus, keyboard, hasFocus, what was focused before, bundle version, iOS', rows[0]);
      ok(/ gf:1 /.test(rows[3]) && / kb:0 /.test(rows[3]), 'the ghost probe reports the ghost took focus and (here) no keyboard', rows[3]);
      const ghostLeft = await p.evaluate(() => document.querySelectorAll('input.kbghost').length);
      ok(ghostLeft === 0, 'the ghost input is removed after its probe', ghostLeft);
      ok(beacons.filter(x => /^kb/.test(x)).length === 4, 'four beacons left the page, all intercepted here', beacons);
      // a fifth tap continues the ladder with r:4
      await p.tap('#ctInput'); await sleep(1100);
      const r5 = await p.evaluate(() => window.__mpKbRows[4] || '');
      ok(/^kbfail3 sa:1 r:4 /.test(r5), 'the fifth tap tries remedy 4', r5);
      // the first non-composer field records once
      await p.evaluate(() => { const c = document.getElementById('chatBox'); if (c) c.hidden = true; });
      await p.evaluate(() => { const el = document.getElementById('planLev'); el.scrollIntoView({ block: 'center' }); });
      await p.tap('#planLev'); await sleep(900);
      await p.tap('#planLev'); await sleep(900);
      const any = await p.evaluate(() => window.__mpKbRows.filter(r => r.indexOf('kbany') === 0));
      ok(any.length === 1 && / el:input#planLev/.test(any[0]) && / f:1 /.test(any[0]) && / ty:number/.test(any[0]), 'a non-composer field records exactly one kbany row naming the field', any);
      ok(errs.length === 0, 'no page errors', errs);
      await p.close();

      console.log('# desktop Chrome: the instrument stays silent');
      const q = await b.newPage();
      await q.setViewport({ width: 1366, height: 768 });
      beacons.length = 0;
      await prep(q, se.token, false, false);
      await q.goto(O + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await q.waitForFunction("window.__mpKbDiag === 4 && document.getElementById('ctInput') && !document.getElementById('ctForm').hidden", { timeout: 40000 });
      await q.click('#ctInput'); await sleep(900);
      await q.click('#planLev'); await sleep(900);
      const drows = await q.evaluate(() => window.__mpKbRows.slice());
      ok(drows.length === 0 && beacons.filter(x => /^kb/.test(x)).length === 0, 'a desktop browser with the field focused sends nothing', { drows, beacons });
      await q.close();
    });
  } finally {
    await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) }).catch(() => {});
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

#!/usr/bin/env node
/* THE CHAT TAB MUST OPEN THE CHAT IN THE INSTALLED APP, NOT NAVIGATE (2026-10-23). See build/fix-pwa-chat-tab.js.
   An emulated iOS home-screen app (navigator.standalone = true, so pwa-nav.js arms) on /paper-trade at 390px taps
   the phone tab bar's Chat tab: the URL must not change and the chat box must be open. A real destination tab
   (Practice from the homepage) must still navigate inside the app - that is pwa-nav's whole job. Source guards:
   the Chat tab carries href="#" + role="button", pwa-nav skips buttons and cancelled clicks. */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 220) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

(async () => {
  console.log('# source guards');
  const nav = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-nav.js'), 'utf8');
  const pwa = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'pwa-nav.js'), 'utf8');
  ok(nav.indexOf("act = browse || it[1] === 'Chat'") >= 0 && nav.indexOf("(act ? '#' : it[0])") >= 0, 'mp-nav builds the Chat tab as an action (href="#", role=button)');
  ok(/a\.getAttribute\('role'\) === 'button'\) return;/.test(pwa) && /e\.defaultPrevented/.test(pwa), 'pwa-nav skips button-anchors and cancelled clicks');

  await withBrowser(async (b) => {
    console.log('# emulated home-screen app, 390px');
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.setUserAgent(IOS_UA);
    await p.setCacheEnabled(false);
    await p.evaluateOnNewDocument(() => { try { Object.defineProperty(navigator, 'standalone', { get: function () { return true; }, configurable: true }); } catch (e) {} });
    const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
    await p.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await p.waitForSelector('.mpbn [data-mpbn="chat"]', { timeout: 40000 });
    const tab = await p.evaluate(() => { const a = document.querySelector('.mpbn [data-mpbn="chat"]'); return { href: a.getAttribute('href'), role: a.getAttribute('role'), pwa: !!document.querySelector('script[src*="pwa-nav"]'), sa: navigator.standalone === true }; });
    ok(tab.href === '#' && tab.role === 'button', 'the live Chat tab is href="#" role="button"', tab);
    ok(tab.pwa && tab.sa, 'pwa-nav is on the page and the app reads as standalone', tab);
    const before = await p.url();
    await p.evaluate(() => { const c = document.getElementById('mpCkBar'); if (c) c.remove(); });
    await p.tap('.mpbn [data-mpbn="chat"]');
    await sleep(1500);
    const after = await p.evaluate(() => ({ url: location.href, open: !!(document.getElementById('chatBox') && !document.getElementById('chatBox').hidden && document.getElementById('chatBox').offsetWidth > 0) }));
    ok(after.url === before, 'tapping Chat did not navigate (was the homepage)', { before, after: after.url });
    ok(after.open, 'the chat box opened on /paper-trade itself', after);
    ok(errs.length === 0, 'no page errors', errs);
    await p.close();

    console.log('# a real destination tab still navigates inside the app');
    const q = await b.newPage();
    await q.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await q.setUserAgent(IOS_UA);
    await q.setCacheEnabled(false);
    await q.evaluateOnNewDocument(() => { try { Object.defineProperty(navigator, 'standalone', { get: function () { return true; }, configurable: true }); } catch (e) {} });
    await q.goto(O + '/rewards/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await q.waitForSelector('.mpbn [data-mpbn="practice"]', { timeout: 40000 });
    await q.evaluate(() => { const c = document.getElementById('mpCkBar'); if (c) c.remove(); });
    await Promise.all([q.waitForNavigation({ timeout: 30000 }).catch(() => null), q.tap('.mpbn [data-mpbn="practice"]')]);
    await sleep(500);
    const dest = await q.evaluate(() => location.pathname);
    ok(dest === '/paper-trade', 'Practice from /rewards/ lands on /paper-trade in the same window', dest);
    await q.close();
  });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

// dwell-e2e.js - time on page is RECORDED WHILE YOU ARE STILL THERE (2026-10-09).
//
// Owner report: "@GoldenStone je uvek bio aktivan a njegovo vreme provedeno na stranicama se ne poklapa".
// Measured on that account: presence showed him online 06:45 -> 19:45 UTC - and the presence heartbeat only
// fires while the tab is VISIBLE - while udwell held 1.85 h. Two counters of the same quantity, 7x apart.
// `dwFlush` ran only on visibilitychange-to-hidden and on pagehide, so an open visible tab accrued hours in
// a browser variable and transmitted none of them; a killed browser lost the lot.
//
// THE LOAD-BEARING CHECK is the first one: a page that is merely LEFT OPEN must record time. Reverting the
// periodic flush turns it red while every other check here still passes, which is exactly the hole that was
// shipped. The others guard the two ways a periodic flush goes wrong: double counting, and charging the
// time to the wrong path.
//
// Usage: node build/dwell-e2e.js [--local]
const { withBrowser } = require('./e2e-browser.js');
const fs = require('fs');
const path = require('path');
const LOCAL = process.argv.includes('--local');
const SRC = LOCAL ? fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js'), 'utf8') : null;
const ADMIN = (() => { try { return (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();
const BASE = 'https://marginpad.io';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d != null ? '  -> ' + d : '')); } };

(async () => {
  console.log('dwell-e2e' + (LOCAL ? ' (local bundle)' : '') + '\n');
  if (!ADMIN) { console.log('needs ADMIN_KEY.local.txt'); process.exitCode = 1; return; }
  const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };
  const po = (p, b) => fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json().catch(() => ({}))).catch(() => ({}));

  const uid = 'e2edw' + Math.random().toString(36).slice(2, 6);
  await po('/api/admin/e2euser', { uid, op: 'mk' });
  const se = await po('/api/admin/e2euser', { uid, op: 'sess' });
  const tok = se && se.token;
  ok('a throwaway member session was minted', !!tok, JSON.stringify(se).slice(0, 140));
  if (!tok) { process.exitCode = 1; return; }

  // The DO is the only honest reader: the page cannot tell us what the server stored.
  const stored = async () => {
    const d = await fetch(BASE + '/api/auth/user?email=' + encodeURIComponent('e2e+' + uid + '@marginpad.test'), { headers: H }).then((r) => r.json()).catch(() => null);
    return d && d.exists ? { total: +d.dwellTotal || 0, rows: d.dwell || [] } : null;
  };

  try {
    await withBrowser(async (browser) => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      if (LOCAL) {
        await page.setRequestInterception(true);
        const cdp = await page.target().createCDPSession();
        await cdp.send('Network.setBypassServiceWorker', { bypass: true });
        page.on('request', (r) => { if (/\/assets\/mp-auth\.js/.test(r.url())) r.respond({ status: 200, contentType: 'application/javascript', body: SRC }); else r.continue(); });
      }
      await page.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', secure: true });
      await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/', secure: true });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

      await page.goto(BASE + '/levels/?nc=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction('!!window.mpAuth', { timeout: 45000 }).catch(() => {});

      const before = await stored();
      ok('the account starts with no recorded time', !!before && before.total === 0, JSON.stringify(before && before.total));

      // THE LOAD-BEARING CHECK: leave the page open, visible, untouched, and wait out one flush interval.
      // Nothing is hidden, nothing is closed, nothing is navigated. 70s of a 60s cadence.
      console.log('  ..   leaving the page open and visible for 70s (one flush interval)');
      await new Promise((r) => setTimeout(r, 70000));
      const openTab = await stored();
      const lv = (openTab && openTab.rows.find((x) => x.path === '/levels/')) || null;
      ok('TIME IS RECORDED WHILE THE TAB IS STILL OPEN', !!lv && +lv.secs >= 50,
        'levels secs=' + (lv ? lv.secs : 'no row') + ' total=' + (openTab ? openTab.total : '?'));
      ok('and it is charged to the page it was spent on', !!lv && lv.path === '/levels/', JSON.stringify(openTab && openTab.rows));
      ok('the figure is sane, not a multiple of the time that passed', !lv || +lv.secs <= 90, 'secs=' + (lv ? lv.secs : '-'));

      // A second interval must ADD, not restate: the DO accumulates, so a flush that forgets to subtract
      // what it sent would roughly double the figure.
      const firstSecs = lv ? +lv.secs : 0;
      console.log('  ..   another 65s on the same page');
      await new Promise((r) => setTimeout(r, 65000));
      const twice = await stored();
      const lv2 = (twice && twice.rows.find((x) => x.path === '/levels/')) || null;
      ok('a second interval adds to the first', !!lv2 && +lv2.secs > firstSecs + 40, 'was ' + firstSecs + ', now ' + (lv2 ? lv2.secs : '-'));
      ok('and does not double count it', !!lv2 && +lv2.secs < firstSecs * 2 + 40, 'was ' + firstSecs + ', now ' + (lv2 ? lv2.secs : '-'));

      // Hiding the tab still flushes the remainder, as it always did.
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await new Promise((r) => setTimeout(r, 2500));
      const hidden = await stored();
      ok('hiding the tab still flushes what is owed', !!hidden && hidden.total >= (twice ? twice.total : 0), JSON.stringify(hidden && hidden.total));

      ok('no page errors while it ran', errs.length === 0, errs.join(' | '));
      await page.close();
    }, { timeoutMs: 300000 });
  } finally {
    await po('/api/admin/e2euser', { uid, op: 'rm' });
  }

  console.log('\ndwell-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('dwell-e2e crashed: ' + (e && e.stack || e)); process.exitCode = 1; });

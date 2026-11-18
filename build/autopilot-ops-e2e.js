// mp-ops Trading > Autopilot (2026-11-18): the member row and its Trades panel (open, closed, signals, execution log),
// with a throwaway member holding one shadow position. Screenshots in build/ap-shots/ops-*.png. Cleans up after itself.
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const BASE = 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_]+/)[0];
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d === undefined ? '' : '  -> ' + JSON.stringify(d).slice(0, 300))); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const adm = (p, b) => fetch(BASE + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-admin-key': K }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
(async () => {
  const U = 'e2eapo' + Math.random().toString(36).slice(2, 7);
  try {
    await adm('/api/admin/e2euser', { uid: U, op: 'mk' });
    ok('granted', (await adm('/api/admin/autopilot', { op: 'grant', uid: U, username: 'e2e_' + U })).ok);
    const t = await adm('/api/admin/autopilot', { op: 'shadowtest', uid: U, sym: 'ETH', long: false }); ok('a shadow ETH short opened', t.taken === true, t);
    const one = await adm('/api/admin/autopilot?uid=' + U); ok('the desk reads one member\'s trades', (one.trades || []).length === 1 && one.trades[0].sym === 'ETH', one.error || (one.trades || []).length);
    ok('the desk refuses a uid that is not a member', (await adm('/api/admin/autopilot?uid=nobody123')).error === 'not_a_member');
    const sess = await (await fetch(BASE + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } })).json();
    await withBrowser(async (browser) => {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
      await page.goto(BASE + '/api/stats#trading/autopilot', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction((u) => !!document.querySelector('[data-tr="' + u + '"]'), { timeout: 40000 }, U).catch(() => {});
      ok('the member is listed with a Trades button', !!(await page.$('[data-tr="' + U + '"]')));
      await page.click('[data-tr="' + U + '"]');
      await page.waitForFunction(() => /ETH/.test((document.getElementById('apTr') || {}).innerText || '') && !/loading/.test(document.getElementById('apTr').innerText), { timeout: 30000 }).catch(() => {});
      const txt = await page.evaluate(() => (document.getElementById('apTr') || {}).innerText || '');
      ok('the Trades panel shows the open ETH short with entry, stop and targets', /ETH/.test(txt) && /short/i.test(txt) && /TP1/.test(txt), txt.slice(0, 200));
      await page.screenshot({ path: path.join(__dirname, 'ap-shots', 'ops-open.png'), fullPage: true });
      for (const tab of ['sigs', 'log']) {
        await page.click('[data-tt="' + tab + '"]');
        await page.waitForFunction((tb) => { const b = document.querySelector('[data-tt="' + tb + '"]'); return b && b.classList.contains('on') && !/loading/.test(document.getElementById('apTr').innerText); }, { timeout: 30000 }, tab).catch(() => {});
        const x = await page.evaluate(() => document.getElementById('apTr').innerText);
        ok(tab === 'sigs' ? 'Signals tab: the signal is marked taken' : 'Execution log tab: the entry and the stop are listed', tab === 'sigs' ? /taken/.test(x) : /STOP_MARKET/.test(x) && /entry MARKET/.test(x), x.slice(0, 200));
        await page.screenshot({ path: path.join(__dirname, 'ap-shots', 'ops-' + tab + '.png'), fullPage: true });
      }
      ok('no page errors', !errs.length, errs);
    });
  } catch (e) { ok('no crash', false, String(e && e.stack || e)); }
  finally {
    try { await adm('/api/admin/autopilot', { op: 'flatten', uid: U }); } catch (e) {}
    try { const f = await adm('/api/admin/autopilot', { op: 'forget', uid: U }); ok('cleanup', f.ok, f); } catch (e) {}
    try { await adm('/api/admin/e2euser', { uid: U, op: 'rm' }); } catch (e) {}
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0;
})();

// Prove: when the server refuses an open, NO phantom local trade is created (2026-10-03).
const fs = require('fs'), path = require('path');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const KEY = (fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io', H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const J = (u, o) => fetch(B + u, o).then(r => r.json().catch(() => ({})));
const adm = (p, b) => J(p, { method: 'POST', headers: H, body: JSON.stringify(b) });
let pass = 0, fail = 0; const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 160) : '')); };
(async () => {
  const u = 'e2ephan1'; await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {});
  await adm('/api/admin/e2euser', { uid: u, op: 'mk' });
  const tok = (await adm('/api/admin/e2euser', { uid: u, op: 'sess' })).token;
  await withBrowser(async browser => {
    const p = await browser.newPage();
    await p.setViewport({ width: 1200, height: 1000, deviceScaleFactor: 1.5 });
    await p.setCacheEnabled(false);
    await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    // Intercept /api/trade/open and force a definite server refusal, to simulate "server did not take it"
    await p.setRequestInterception(true);
    p.on('request', req => {
      if (req.url().includes('/api/trade/open') && req.method() === 'POST') {
        return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'forced_test_refusal' }) });
      }
      req.continue();
    });
    const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
    await p.goto(B + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    // read journal before
    const before = await p.evaluate(() => { try { return (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).length; } catch (e) { return -1; } });
    // open a trade via the plan form: set amount, click Open. Use the terminal's own add() through the Open button.
    const clicked = await p.evaluate(() => {
      // fill amount + click the plan Open button
      var amt = document.querySelector('#planMargin, input[name="margin"], .plan-amt'); if (amt) { amt.value = '100'; amt.dispatchEvent(new Event('input', { bubbles: true })); }
      var btn = document.getElementById('planSave'); if (!btn) return 'no-open-button';
      btn.click(); return 'clicked';
    });
    await new Promise(r => setTimeout(r, 9000)); // wait out the 5s+retry+timeout path
    const after = await p.evaluate(() => { try { var j = JSON.parse(localStorage.getItem('mp_journal') || '[]') || []; return { n: j.length, locals: j.filter(e => /^\d{13}_/.test(String(e.id || ''))).length, open: j.filter(e => !e.status || e.status === 'open').length }; } catch (e) { return { err: String(e) }; } });
    console.log('click:', clicked, '| before:', before, '| after:', JSON.stringify(after));
    ok(clicked === 'clicked', 'the Open button was clicked', { clicked });
    ok(after.n === before, 'NO phantom trade was added after a forced server refusal', { before, after: after.n });
    ok(errs.length === 0, 'no page errors', errs.slice(0, 2));
    await p.close();
  });
  await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log('\nphantom-probe: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

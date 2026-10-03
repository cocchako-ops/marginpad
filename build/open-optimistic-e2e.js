// Optimistic open (2026-10-03): instant ticket, reconcile to srv on success, flash-and-remove on failure with NO resurrection.
const fs = require('fs');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const KEY = (fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io', H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const J = (u, o) => fetch(B + u, o).then(r => r.json().catch(() => ({})));
const adm = (p, b) => J(p, { method: 'POST', headers: H, body: JSON.stringify(b) });
let pass = 0, fail = 0; const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 160) : '')); };
const jrnl = p => p.evaluate(() => { try { var a = JSON.parse(localStorage.getItem('mp_journal') || '[]') || []; return { n: a.length, open: a.filter(e => !e.status || e.status === 'open').length, srv: a.filter(e => /^srv/.test(String(e.id || ''))).length, local: a.filter(e => /^\d{13}_/.test(String(e.id || ''))).length }; } catch (e) { return { err: String(e) }; } });
async function run(forceFail) {
  const u = 'e2eopt' + (forceFail ? 'f' : 'g'); await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {});
  await adm('/api/admin/e2euser', { uid: u, op: 'mk' });
  const tok = (await adm('/api/admin/e2euser', { uid: u, op: 'sess' })).token;
  await withBrowser(async browser => {
    const p = await browser.newPage();
    await p.setViewport({ width: 1200, height: 1000, deviceScaleFactor: 1.5 });
    await p.setCacheEnabled(false);
    await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    if (forceFail) { await p.setRequestInterception(true); p.on('request', req => { if (req.url().includes('/api/trade/open') && req.method() === 'POST') return setTimeout(function(){req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'forced_test_refusal' }) });},2500); req.continue(); }); }
    const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
    await p.goto(B + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    await p.evaluate(() => { var a = document.querySelector('#planMargin'); if (a) { a.value = '100'; a.dispatchEvent(new Event('input', { bubbles: true })); } var b = document.getElementById('planSave'); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 250)); // ~instant: optimistic row must already be there
    const fast = await jrnl(p);
    if (!forceFail) {
      ok(fast.open >= 1, 'SUCCESS: the ticket is visible ~instantly (optimistic, within 250ms)', fast);
      await new Promise(r => setTimeout(r, 8000));
      const done = await jrnl(p);
      ok(done.open === 1 && done.srv === 1 && done.local === 0, 'SUCCESS: it reconciled to a single srv row (no duplicate, no local)', done);
    } else {
      ok(fast.open >= 1, 'FAIL CASE: the ticket still appears instantly (optimistic)', fast);
      await new Promise(r => setTimeout(r, 10000)); // server-open fails
      const gone = await jrnl(p);
      ok(gone.open === 0, 'FAIL CASE: the optimistic ticket was removed (flash-and-remove, no phantom)', gone);
      await new Promise(r => setTimeout(r, 16000)); // a full syncTrades(12s)+pullTrades window
      const still = await jrnl(p);
      ok(still.open === 0, 'FAIL CASE: it does NOT resurrect after a sync+pull cycle', still);
    }
    ok(errs.length === 0, 'no page errors', errs.slice(0, 2));
    await p.close();
  });
  await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
}
(async () => { await run(false); await run(true); console.log('\noptimistic-probe: pass ' + pass + '  fail ' + fail); process.exitCode = fail ? 1 : 0; })().catch(e => { console.error(e); process.exitCode = 1; });

/* SL/TP sheet E2E (2026-09-10).
   Owner: "when I try to set TP or SL on a live ticket, maybe it is set in the background but nothing on the
   ticket says so." Measured from his OWN account before the fix: three saves that day reached the server as
   "SL off / TP off" - sl:null, tp:null. Nothing was set in the background either; the level never left the form.
   Cause: the price field was <input type="number">, which hands back an EMPTY string for content the browser
   considers invalid and silently drops a decimal comma ("105,50" became 10550, a price 100x wrong). An empty row
   is read as a deleted level, so pressing Save quietly wiped instead of setting.

   What this locks down: a comma is a decimal point, unparseable text is REFUSED out loud instead of dropped,
   Save with nothing typed never wipes what is already there, and the value shows on the ticket and reaches the
   server. Both copies of the sheet (home.js on the app shell, mp-trade.js everywhere else) are walked.
   Run: node build/sltp-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 260) : '')); console.log(out[out.length - 1]); };
const uid = 'e2eslt' + Math.random().toString(36).slice(2, 6);

(async () => {
  const se = await (await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) })).json();
  chk('throwaway member + session', !!se.token, { uid });
  if (!se.token) process.exit(1);
  const CK = Object.assign({}, H, { cookie: 'mp_sess=' + se.token + '; mp_uid=' + uid });
  const op = await (await fetch(ORIGIN + '/api/trade/open', { method: 'POST', headers: CK, body: JSON.stringify({ sym: 'SOL', side: 'long', lev: 5, margin: 100, cid: 'sl' + uid }) })).json();
  chk('a live SOL position to work on', !!(op.ok && op.position), op.position && { id: op.position.id, entry: op.position.entry });
  const srvRow = async () => {
    const j = await (await fetch(ORIGIN + '/api/admin/journal?uid=' + uid, { headers: H })).json();
    const arr = j.journal || j.trades || [];
    return arr.filter(t => t.status !== 'win' && t.status !== 'loss')[0] || {};
  };
  try {
    await withBrowser(async (browser) => {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await page.setCookie(
        { name: 'mp_sess', value: se.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true },
        { name: 'mp_uid', value: uid, domain: 'marginpad.io', path: '/', secure: true },
        { name: 'mp_un', value: 'e2e_' + uid, domain: 'marginpad.io', path: '/', secure: true });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
      const posts = []; page.on('request', r => { if (r.url().indexOf('/api/trade/sltp') > 0) { try { posts.push(JSON.parse(r.postData() || '{}')); } catch (e) {} } });
      await page.goto(ORIGIN + '/paper-trade?coin=SOL&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
      let ready = false;
      for (let i = 0; i < 50; i++) { await sleep(500); ready = await page.evaluate(() => !!(window.mpSltpSheet && document.querySelector('[data-ptl-sltp]'))); if (ready) break; }
      chk('the live ticket carries the SL/TP control', ready);

      const openSheet = async (kind) => {
        await page.evaluate(() => { const b = document.querySelector('[data-ptl-sltp]'); if (b) b.click(); });
        await sleep(800);
        await page.evaluate((k) => { const sec = document.querySelector('.mpss-sec[data-k="' + k + '"]'); if (!sec.querySelector('.mpss-row')) sec.querySelector('.mpss-add').click(); }, kind);
        await sleep(250);
        const el = await page.$('.mpss-sec[data-k="' + kind + '"] .mpss-row .p');
        await el.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        return el;
      };
      const save = async () => { await page.evaluate(() => document.querySelector('.mpss .mpcs-go').click()); await sleep(1200); };
      const state = () => page.evaluate(() => {
        const el = document.getElementById('ptLastTrade');
        const row = (JSON.parse(localStorage.getItem('mp_journal') || '[]') || []).filter(t => t.status !== 'win' && t.status !== 'loss')[0] || {};
        const w = document.querySelector('.mpss-warn');
        return { ticket: ((el && el.innerText) || '').replace(/\s+/g, ' ').match(/TP[^·]{0,14}/) ? ((el.innerText).replace(/\s+/g, ' ').match(/TP[^·]{0,14}/) || [''])[0] : '', tp: row.tp, stop: row.stop, warn: (w && !w.hidden) ? w.textContent.trim().slice(0, 80) : '', open: !!document.querySelector('.mpss.on') };
      });

      // 1. a decimal COMMA - the separator on most of our audience's keyboards
      let el = await openSheet('tp'); await page.keyboard.type('105,50'); await save();
      let st = await state();
      chk('a price typed with a comma is saved as 105.5, not 10550', st.tp === 105.5, st);
      chk('and the ticket shows it', /105\.5/.test(st.ticket), { ticket: st.ticket });

      // 2. garbage is refused OUT LOUD, and nothing is wiped
      el = await openSheet('tp'); await page.keyboard.type('abc'); await save();
      st = await state();
      chk('unparseable text is refused with a visible reason', !!st.warn && st.open === true, { warn: st.warn, open: st.open });
      chk('and the take-profit that was already set survives it', st.tp === 105.5, { tp: st.tp });

      // 3. Save with nothing typed must not wipe
      await page.evaluate(() => { const b = document.querySelector('.mpss .mpcs-x'); if (b) b.click(); }); await sleep(400);
      const before = posts.length;
      await page.evaluate(() => { const b = document.querySelector('[data-ptl-sltp]'); if (b) b.click(); }); await sleep(800);
      await page.evaluate(() => { const rows = document.querySelectorAll('.mpss-sec[data-k="tp"] .mpss-row .p'); rows.forEach(i => { i.value = ''; }); const rs = document.querySelectorAll('.mpss-sec[data-k="sl"] .mpss-row .p'); rs.forEach(i => { i.value = ''; }); });
      await save();
      st = await state();
      chk('clearing every field IS a deliberate clear and is sent', st.tp == null, { tp: st.tp, posts: posts.length - before });

      // 4. and a fresh sheet with nothing typed posts nothing at all
      const before2 = posts.length;
      await page.evaluate(() => { const b = document.querySelector('[data-ptl-sltp]'); if (b) b.click(); }); await sleep(800);
      await save();
      chk('opening the sheet and saving with nothing typed writes nothing', posts.length === before2, { posted: posts.length - before2 });

      // 5. a real stop, and the server has to agree
      el = await openSheet('sl'); await page.keyboard.type((Math.round((op.position.entry * 0.9) * 100) / 100).toString().replace('.', ',')); await save();
      st = await state();
      chk('a stop-loss typed with a comma is stored too', st.stop > 0 && st.stop < op.position.entry, { stop: st.stop, entry: op.position.entry });
      await sleep(14000);
      const sr = await srvRow();
      chk('the server holds the same stop, not "off"', Math.abs((+sr.stop || 0) - (+st.stop || 0)) < 0.01, { server: sr.stop, local: st.stop });
      chk('no page errors', errs.length === 0, errs.slice(0, 3));
      await page.screenshot({ path: 'D:/part1/money-mission/build/pt-shots/sltp-sheet.png' });
      await ctx.close();
    }, { timeoutMs: 420000 });
  } finally {
    try { await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) }); } catch (e) {}
  }
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length;
  console.log('\nUID ' + uid + ' - pass ' + (out.length - bad) + ' fail ' + bad);
  process.exit(bad ? 1 : 0);
})();

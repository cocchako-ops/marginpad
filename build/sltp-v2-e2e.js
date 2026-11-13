/* SL/TP sheet v2 (2026-11-13, owner: "za SL/TP mozemo da nudimo i opciju u % (ROE), a ne samo da unesu cenu" + an unlabelled green
   button in the sheet on his phone).

   --pure : the two conversions the sheet binds its fields with are lifted out of BOTH bundles (home.js, mp-trade.js) and must agree
            with the arithmetic (price = entry * (1 +- roe / lev)) and with each other; the close-% control is a labelled BUTTON, there
            is no <select> left in the sheet; every button in the sheet template carries text or an aria-label.
   browser: a real member with a BTC 10x long, the sheet opened on /paper-trade (home.js) at 1366 and 390 and on /rekt/ (the
            mp-trade.js copy): typing -25 ROE gives the price, the +50% chip fills a target row, typing a price back gives the ROE,
            the close-% button cycles 100 -> 75 and the readout scales the dollars, trailing 2% + break-even 30% save onto the row,
            a second stop level switches the dynamic stop off, the saved levels come back on reopen, the server holds the stop, the
            card fits the viewport and nothing reaches past it, no button in the sheet is empty, no page errors.

   Run: node build/sltp-v2-e2e.js [--pure]
*/
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), O = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.includes('--pure');
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) pass++; else fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  ' + (d === undefined ? '' : String(d).slice(0, 320)))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(function pure() {
  for (const f of ['home.js', 'mp-trade.js']) {
    const s = fs.readFileSync(path.join(ROOT, 'dist/assets', f), 'utf8');
    const a = s.indexOf('SL/TP sheet v2 (2026-11-13'), b = s.indexOf('window.__mpSltpRoe=', a);
    ok(f + ': carries the v2 sheet', a > 0 && b > a);
    const blk = s.slice(a, b);
    ok(f + ': the close-% control is a labelled button, no <select> in the sheet', /class="pc" data-pc=/.test(blk) && !/<select/.test(blk));
    ok(f + ': every button in the template has text or an aria-label', !/<button[^>]*>(<\/button>|'\+'<\/button>)/.test(blk));
    const lift = new Function('var e=null;' + blk.replace(/^[\s\S]*?function dpOf/, 'function dpOf').replace(/function fmtRoe[\s\S]*$/, '') + ' return {roeOf:roeOf,pxOf:pxOf};');
    let R; try { R = lift(); } catch (e) { R = null; }
    ok(f + ': roeOf / pxOf lift', !!R, R ? '' : 'lift failed');
    if (R) {
      const L = { side: 'long', lev: 10, entry: 100 }, S = { side: 'short', lev: 20, entry: 50 };
      ok(f + ': long 10x, stop at 97.5 = -25% ROE; target at 110 = +100%', Math.abs(R.roeOf(L, 97.5) + 25) < 1e-9 && Math.abs(R.roeOf(L, 110) - 100) < 1e-9);
      ok(f + ': short 20x, price 51.25 = -50% ROE; 48.75 = +50%', Math.abs(R.roeOf(S, 51.25) + 50) < 1e-9 && Math.abs(R.roeOf(S, 48.75) - 50) < 1e-9);
      ok(f + ': pxOf is the inverse (long -25 -> 97.5, short +50 -> 48.75, break-even 0 -> entry)', R.pxOf(L, -25) === 97.5 && R.pxOf(S, 50) === 48.75 && R.pxOf(L, 0) === 100 && R.pxOf(S, 0) === 50);
      ok(f + ': a round trip holds (roe -> px -> roe) to a tenth of a percent at the price decimals', Math.abs(R.roeOf({ side: 'long', lev: 10, entry: 71244 }, R.pxOf({ side: 'long', lev: 10, entry: 71244 }, -25)) + 25) < 0.1);
    }
  }
  const h = fs.readFileSync(path.join(ROOT, 'dist/assets/home.js'), 'utf8');
  ok('the order form prints reward-to-risk under the take-profit readout', /pr-rr/.test(h) && /gainFrac\/_lf/.test(h));
  ok('home.css + mp-trade.css carry the v2 sheet styles (price + ROE fields, chips, the dynamic stop, a scrolling card)', ['home.css', 'mp-trade.css'].every(f => { const c = fs.readFileSync(path.join(ROOT, 'dist/assets', f), 'utf8'); return /\.mpss-row \.r\{/.test(c) && /\.mpss-q button/.test(c) && /\.mpss-dyn\{/.test(c) && /\.mpss \.mpcs-card\{max-height/.test(c); }));
})();
if (PURE) { console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0; }
else (async () => {
  const { withBrowser, newPage, UA_DESKTOP, UA_MOBILE } = require('./e2e-browser');
  const K = fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
  const J = (u, b) => fetch(O + u, { method: b ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
  const uid = 'e2e_sltpv' + Math.floor(Math.random() * 900 + 100);
  const sess = await J('/api/admin/e2euser', { uid, op: 'sess' }); const tok = sess.token;
  ok('a throwaway member and a session', !!tok, JSON.stringify(sess).slice(0, 120));
  const op = await fetch(O + '/api/trade/open', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok + '; mp_uid=' + uid }, body: JSON.stringify({ sym: 'BTC', side: 'long', lev: 10, margin: 100, cid: 'v2' + uid }) }).then(r => r.json());
  ok('a real BTC 10x long to edit', !!(op.ok && op.position), JSON.stringify(op).slice(0, 120));
  try {
    await withBrowser(async (browser) => {
      for (const leg of [{ page: '/paper-trade', mob: false }, { page: '/paper-trade', mob: true }, { page: '/rekt/', mob: false }]) {
        const MOB = leg.mob, tag = leg.page + ' ' + (MOB ? '390' : '1366');
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setUserAgent(MOB ? UA_MOBILE : UA_DESKTOP);
        await page.setViewport({ width: MOB ? 390 : 1366, height: MOB ? 844 : 900, isMobile: MOB, hasTouch: MOB, deviceScaleFactor: 1 });
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
        await page.setCacheEnabled(false); await page.setBypassServiceWorker(true);
        await page.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_uid', value: uid, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
        await page.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} });
        await page.goto(O + leg.page + '?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
        if (leg.page !== '/paper-trade') { await page.waitForFunction(() => window.mpEnsureChat, { timeout: 60000 }); await page.evaluate(() => window.mpEnsureChat && window.mpEnsureChat(function () {})); }
        const ready = await page.waitForFunction(() => window.mpSltpSheet && window.__mpSltpRoe && window.mpAuth && window.mpAuth.me && window.mpAuth.me() && (JSON.parse(localStorage.getItem('mp_journal') || '[]')).some(x => x.status === 'open'), { timeout: 60000 }).then(() => true).catch(() => false);
        ok(tag + ': the sheet, the member and the open row are there', ready);
        if (!ready) { await ctx.close(); continue; }
        await sleep(1200);
        const r = await page.evaluate(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const j = JSON.parse(localStorage.getItem('mp_journal') || '[]'); const e = j.filter(x => x.status === 'open')[0];
          window.mpSltpSheet(e.id); await sleep(300);
          const ov = document.querySelector('.mpss.on'); if (!ov) return { ov: false };
          const Q = s => ov.querySelector(s), QA = s => [...ov.querySelectorAll(s)];
          const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
          const out = { ov: true, entry: e.entry, lev: e.lev, empty: QA('button').filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).map(b => b.className) };
          // the three legs share one position: start each from a clean sheet (the previous leg's levels would otherwise make the chip fill a second row)
          QA('.mpss-row .rm').forEach(b => b.click()); set(Q('.mpss-dynw .tr'), ''); set(Q('.mpss-dynw .be'), ''); await sleep(80);
          const save0 = Q('.mpss .mpcs-go'); out.saveTxt = save0 ? save0.textContent.trim() : ''; const sr = save0.getBoundingClientRect(); out.saveUnder = (function () { const x = document.elementFromPoint(sr.x + sr.width / 2, sr.y + sr.height / 2); return x === save0 || save0.contains(x); })();
          Q('.mpss-sec[data-k="sl"] .mpss-add').click(); await sleep(50);
          const slRow = Q('.mpss-sec[data-k="sl"] .mpss-row'); set(slRow.querySelector('.r'), '-25'); await sleep(60);
          out.slPx = +slRow.querySelector('.p').value; out.slWant = +(e.entry * (1 - 0.25 / e.lev)).toFixed(1); out.slRo = slRow.querySelector('.mpss-ro').textContent;
          Q('.mpss-sec[data-k="tp"] .mpss-q [data-q="50"]').click(); await sleep(60);
          const tpRow = Q('.mpss-sec[data-k="tp"] .mpss-row'); out.tpChipPx = +tpRow.querySelector('.p').value; out.tpChipWant = +(e.entry * (1 + 0.5 / e.lev)).toFixed(1); out.tpChipRoe = tpRow.querySelector('.r').value;
          set(tpRow.querySelector('.p'), String(+(e.entry * 1.1).toFixed(1))); await sleep(60); out.tpRoeAfterPx = tpRow.querySelector('.r').value;
          tpRow.querySelector('.pc').click(); await sleep(40); out.pc = tpRow.querySelector('.pc').textContent; out.tpRo = tpRow.querySelector('.mpss-ro').textContent;
          set(Q('.mpss-dynw .tr'), '2'); set(Q('.mpss-dynw .be'), '30'); await sleep(60); out.dynNote = Q('.mpss-dynn').textContent; out.dynOff = Q('.mpss-dynw').classList.contains('off');
          Q('.mpss-sec[data-k="sl"] .mpss-q [data-q="-50"]').click(); await sleep(60); out.slRows = QA('.mpss-sec[data-k="sl"] .mpss-row').length; out.dynOff2 = Q('.mpss-dynw').classList.contains('off');
          QA('.mpss-sec[data-k="sl"] .mpss-row .rm')[1].click(); await sleep(60); out.dynOff3 = Q('.mpss-dynw').classList.contains('off');
          const card = Q('.mpcs-card').getBoundingClientRect(); out.card = { h: Math.round(card.height), inVp: card.bottom <= innerHeight + 1 && card.top >= -1 };
          out.wide = QA('*').filter(x => x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().right > card.right + 1).length;
          Q('.mpss .mpcs-go').click(); await sleep(1500);
          const e2 = JSON.parse(localStorage.getItem('mp_journal') || '[]').filter(x => x.id === e.id)[0];
          out.saved = { stop: e2.stop, tps: e2.tps, trail: e2.trail, be: e2.be, hwm: e2.hwm }; out.closed = !document.querySelector('.mpss.on'); out.warn = (Q('.mpss-warn') || {}).textContent;
          window.mpSltpSheet(e.id); await sleep(300);
          out.reopen = { slR: Q('.mpss-sec[data-k="sl"] .mpss-row .r').value, tpPc: Q('.mpss-sec[data-k="tp"] .mpss-row .pc').textContent, tr: Q('.mpss-dynw .tr').value, be: Q('.mpss-dynw .be').value };
          Q('.mpss .mpcs-x').click();
          return out;
        });
        ok(tag + ': the sheet opens and no button in it is empty (the Save button reads and is under the finger)', r.ov && r.empty.length === 0 && /Save/.test(r.saveTxt) && r.saveUnder, JSON.stringify({ empty: r.empty, saveTxt: r.saveTxt, under: r.saveUnder }));
        ok(tag + ': -25 typed as ROE gives entry * (1 - 0.025) and the readout says -25% ROE, -$25.00', r.slPx === r.slWant && /-25% ROE/.test(r.slRo) && /\$25\.00/.test(r.slRo), JSON.stringify({ slPx: r.slPx, want: r.slWant, ro: r.slRo }));
        ok(tag + ': the +50% chip fills a target row at entry * (1 + 0.05) and names the ROE', r.tpChipPx === r.tpChipWant && r.tpChipRoe === '+50%', JSON.stringify({ px: r.tpChipPx, want: r.tpChipWant, roe: r.tpChipRoe }));
        ok(tag + ': a price typed back gives the ROE (+10% price at 10x = +100%)', r.tpRoeAfterPx === '+100%', r.tpRoeAfterPx);
        ok(tag + ': the close-% button cycles to 75% and the dollars scale with it', r.pc === '75%' && /\$75\.00 \(75%\)/.test(r.tpRo), JSON.stringify({ pc: r.pc, ro: r.tpRo }));
        ok(tag + ': trailing 2% + break-even 30% preview where they would sit; a second stop level switches them off, removing it switches them back', /trail would sit/.test(r.dynNote) && /break-even arms/.test(r.dynNote) && !r.dynOff && r.slRows === 2 && r.dynOff2 && !r.dynOff3, JSON.stringify({ note: r.dynNote, off: [r.dynOff, r.dynOff2, r.dynOff3] }));
        ok(tag + ': the save lands - stop at the typed level or tighter (the trail may already have ratcheted it), a 75% target level, trail 2, break-even 30, a high-water mark', r.closed && !r.warn && r.saved.stop >= r.slWant - 0.01 && r.saved.tps && r.saved.tps[0].pct === 75 && r.saved.trail === 2 && r.saved.be === 30 && r.saved.hwm > 0, JSON.stringify(r.saved) + ' warn=' + r.warn);
        ok(tag + ': reopening shows the levels as saved (ROE filled, 75%, trail, break-even)', /%$/.test(r.reopen.slR) && r.reopen.tpPc === '75%' && r.reopen.tr === '2' && r.reopen.be === '30', JSON.stringify(r.reopen));
        ok(tag + ': the card fits the viewport and nothing in it reaches past its edge', r.card.inVp && r.wide === 0, JSON.stringify(r.card) + ' wide=' + r.wide);
        ok(tag + ': no page errors', errs.length === 0, errs.join(' | '));
        await ctx.close();
      }
    }, { timeoutMs: 300000 });
    const srv = await fetch(O + '/api/auth/trades', { headers: { cookie: 'mp_sess=' + tok + '; mp_uid=' + uid } }).then(r => r.json()).catch(() => null);
    const row = srv && (srv.trades || srv.journal || srv.rows || []).filter(x => x.status === 'open')[0];
    ok('the server holds a stop on the position (the sheet posted /api/trade/sltp)', !!(row && row.stop > 0), JSON.stringify(row ? { stop: row.stop, tp: row.tp } : srv).slice(0, 160));
  } finally { await J('/api/admin/e2euser', { uid, op: 'rm' }); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

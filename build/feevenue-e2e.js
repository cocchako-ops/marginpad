/* "Fees as on" picker E2E (2026-09-12). Owner: "you put the fee venue on the terminal itself instead of under Advanced;
   move it next to the other exchange dropdown, make it look identical (with the logo), and none of that Windows default look."

   Proves on the live /paper-trade (desktop 1366 + phone 390): the picker is INSIDE the Advanced block right after
   "Exchange (sets margin rate)", both are the same custom-select component (no native <select> is visible), both option
   lists draw the same branded rows (initial tile + name + rate), picking MEXC changes the quoted round-trip fee and is
   persisted, the trigger is REACHABLE (elementFromPoint at its centre), and the pair hides together on a non-crypto class.
   Run: node build/feevenue-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const uidE = 'e2efee' + Math.random().toString(36).slice(2, 8);
// Advanced is gated to members (guest SL/TP are client-only), so the picker under it is walked as a signed-in member
const asMember = async (page, tok) => { if (tok) await page.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_uid', value: uidE, domain: 'marginpad.io', path: '/', secure: true }); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 320) : '')); console.log(out[out.length - 1]); };

// expect = what the picker must read on arrival: 'MarginPad' on a fresh device, 'MEXC' on the phone because the SAME member picked
// it on the desktop and the account default travels with the account (that is the feature, not a stale device value)
async function walk(page, label, expect) {
  const target = expect === 'MEXC' ? 'MarginPad' : 'MEXC', tval = target === 'MEXC' ? 'mexc' : '';
  await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 120000 });
  for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => !!document.querySelector('#planFeeVenue') && !!document.querySelector('#planEx') && document.querySelector('#planEx').closest('.csel'))) break; }
  const before = await page.evaluate(() => {
    const fee = document.getElementById('planFeeVenue'), ex = document.getElementById('planEx'), adv = document.getElementById('planAdvIn');
    const r = fee.getBoundingClientRect();
    return { inAdvanced: !!(adv && adv.contains(fee)), advHidden: adv.hidden, feeVisibleWhileCollapsed: r.width > 0 && r.height > 0, nativeSelectShown: !!fee.closest('.csel') && getComputedStyle(fee).position !== 'absolute', bothCsel: !!(fee.closest('.csel') && ex.closest('.csel')), order: (function () { const f = Array.from(adv.querySelectorAll('.field')); return f.indexOf(ex.closest('.field')) + 1 === f.indexOf(fee.closest('.field')); })(), strayOldBox: !!document.querySelector('.ptt-feev') };
  });
  chk(label + ': the fee picker sits inside Advanced, directly after the margin-rate picker, hidden until Advanced opens, no old box left', before.inAdvanced && before.advHidden && !before.feeVisibleWhileCollapsed && before.order && before.bothCsel && !before.nativeSelectShown && !before.strayOldBox, before);
  for (let w = 0; w < 40; w++) { await sleep(500); if (await page.evaluate(() => { const c = document.getElementById('planAdvChk'); return c && !c.disabled; })) break; }
  await page.evaluate(() => { const c = document.getElementById('planAdvChk'); if (!c.checked) c.click(); }); await sleep(600);
  const open = await page.evaluate(() => {
    const fee = document.getElementById('planFeeVenue'), ex = document.getElementById('planEx');
    const tf = fee.closest('.csel').querySelector('.csel-trigger'), te = ex.closest('.csel').querySelector('.csel-trigger');
    const rf = tf.getBoundingClientRect(), re = te.getBoundingClientRect();
    tf.scrollIntoView({ block: 'center' }); const r2 = tf.getBoundingClientRect();
    const hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
    const csF = getComputedStyle(tf), csE = getComputedStyle(te);
    return { feeW: Math.round(rf.width), exW: Math.round(re.width), sameWidth: Math.abs(rf.width - re.width) < 2, sameFont: csF.fontFamily === csE.fontFamily && csF.fontSize === csE.fontSize && csF.borderRadius === csE.borderRadius && csF.padding === csE.padding, reachable: !!(hit && tf.contains(hit)), feeLabel: tf.innerText.replace(/\s+/g, ' ').trim(), exLabel: te.innerText.replace(/\s+/g, ' ').trim(), feeTile: !!tf.querySelector('.csel-ex .cx-m'), exTile: !!te.querySelector('.csel-ex .cx-m') };
  });
  chk(label + ': both triggers are the same component (same width, font, radius, padding) and both show the branded tile', open.sameWidth && open.sameFont && open.feeTile && open.exTile, open);
  chk(label + ': the fee trigger is reachable at its centre and reads ' + expect + (expect === 'MEXC' ? ' (the account default picked on the desktop)' : ' by default'), open.reachable && open.feeLabel.indexOf(expect) >= 0, { hit: open.reachable, label: open.feeLabel });
  const fee0 = await page.evaluate(() => document.getElementById('planFee').textContent.trim());
  await page.evaluate(() => { document.getElementById('planFeeVenue').closest('.csel').querySelector('.csel-trigger').click(); }); await sleep(350);
  const list = await page.evaluate(() => {
    const p = document.getElementById('planFeeVenue').closest('.csel').querySelector('.csel-panel'); const rows = Array.from(p.querySelectorAll('.csel-opt'));
    const exOpts = Array.from(document.getElementById('planEx').closest('.csel').querySelectorAll('.csel-opt'));
    return { open: !p.hidden, n: rows.length, tiles: rows.filter(r => r.querySelector('.csel-ex .cx-m')).length, names: rows.map(r => (r.querySelector('b') || {}).textContent), rates: rows.map(r => (r.querySelector('small') || {}).textContent), mexc: rows.findIndex(r => /MEXC/.test(r.textContent)) };
  });
  chk(label + ': the list opens with 10 branded rows (MarginPad + 9 venues), each with a tile, name and rate', list.open && list.n === 10 && list.tiles === 10 && list.mexc > 0 && /Hyperliquid/.test(list.names.join(',')) && list.rates.every(r => /%/.test(r || '')), { n: list.n, names: list.names, rates: list.rates });
  await page.evaluate((target) => { const p = document.getElementById('planFeeVenue').closest('.csel').querySelector('.csel-panel'); Array.from(p.querySelectorAll('.csel-opt')).find(r => r.textContent.indexOf(target) >= 0).click(); }, target); await sleep(500);
  const after = await page.evaluate(() => ({ val: document.getElementById('planFeeVenue').value, mp: window.mpFeeVenue, ls: localStorage.getItem('mp_feevenue'), fee: document.getElementById('planFee').textContent.trim(), label: document.getElementById('planFeeVenue').closest('.csel').querySelector('.csel-trigger').innerText.replace(/\s+/g, ' ').trim(), closed: document.getElementById('planFeeVenue').closest('.csel').querySelector('.csel-panel').hidden }));
  const num = s => parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0;
  const moved = target === 'MEXC' ? num(after.fee) < num(fee0) : num(after.fee) > num(fee0);
  chk(label + ': picking ' + target + ' closes the list, relabels the trigger, persists, and the quoted round-trip fee ' + (target === 'MEXC' ? 'drops (0.02% vs 0.055%)' : 'rises back (0.055% vs 0.02%)'), after.val === tval && after.mp === tval && after.ls === tval && after.closed && after.label.indexOf(target) >= 0 && moved && num(after.fee) > 0, { before: fee0, after: after.fee, label: after.label });
  // the "?" circles: reachable, and each reveals a plain-words hint that says what the picker moves (owner 2026-09-12: "I did not know")
  const q = await page.evaluate(() => {
    const out = {}; ['planExHint', 'planFeeHint'].forEach(id => { const b = document.querySelector('.ptt-q[data-hint="' + id + '"]'), h = document.getElementById(id); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const wasHidden = h.hidden; b.click(); out[id] = { reachable: !!(hit && (hit === b || b.contains(hit))), wasHidden, nowShown: !h.hidden && h.getBoundingClientRect().height > 20, text: h.innerText.replace(/\s+/g, ' ').slice(0, 80), on: b.classList.contains('on') }; b.click(); out[id].closesAgain = h.hidden; }); return out;
  });
  chk(label + ': the margin-rate "?" is reachable and opens a hint that names maintenance margin and the liquidation price', q.planExHint.reachable && q.planExHint.wasHidden && q.planExHint.nowShown && q.planExHint.on && q.planExHint.closesAgain && /Maintenance margin/.test(q.planExHint.text), q.planExHint);
  chk(label + ': the fee "?" is reachable and opens a hint about the taker fee', q.planFeeHint.reachable && q.planFeeHint.wasHidden && q.planFeeHint.nowShown && q.planFeeHint.closesAgain && /Taker fee/.test(q.planFeeHint.text), q.planFeeHint);
  await page.evaluate(() => { document.getElementById('planEx').closest('.csel').querySelector('.csel-trigger').click(); }); await sleep(350);
  const exl = await page.evaluate(() => { const p = document.getElementById('planEx').closest('.csel').querySelector('.csel-panel'); const rows = Array.from(p.querySelectorAll('.csel-opt')); const names = rows.map(r => (r.querySelector('b') || {}).textContent); const rates = rows.map(r => (r.querySelector('small') || {}).textContent); document.getElementById('planEx').closest('.csel').querySelector('.csel-trigger').click(); return { n: rows.length, names, rates, sel: document.getElementById('planEx').closest('.csel').querySelector('.csel-trigger').innerText.replace(/\s+/g, ' ').trim(), tiles: rows.filter(r => r.querySelector('.csel-ex .cx-m')).length }; });
  chk(label + ': the margin-rate list has MarginPad (default), MEXC 0.1%, Hyperliquid 1.25% and Coinbase 1.33% among 11 branded rows', exl.n === 11 && exl.tiles === 11 && /MarginPad/.test(exl.sel) && exl.names.indexOf('MEXC') > 0 && exl.rates[exl.names.indexOf('MEXC')] === '0.1%' && exl.rates[exl.names.indexOf('Hyperliquid')] === '1.25%' && exl.rates[exl.names.indexOf('Coinbase')] === '1.33%', exl);
  // non-crypto class hides BOTH exchange pickers together
  await page.evaluate(() => { const pc = document.getElementById('planClass'); pc.value = 'forex'; pc.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(900);
  const fx = await page.evaluate(() => ({ ex: document.getElementById('planEx').closest('.field').style.display, fee: document.getElementById('planFeeField').style.display }));
  chk(label + ': on Forex both pickers hide together', fx.ex === 'none' && fx.fee === 'none', fx);
  await page.evaluate(() => { const pc = document.getElementById('planClass'); pc.value = 'crypto'; pc.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(900);
  const back = await page.evaluate(() => ({ ex: document.getElementById('planEx').closest('.field').style.display, fee: document.getElementById('planFeeField').style.display }));
  chk(label + ': back on Crypto both return', back.ex === '' && back.fee === '', back);
  // reload: the device value survives and the custom label follows it (no change event of its own)
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(2500);
  for (let w = 0; w < 40; w++) { await sleep(500); if (await page.evaluate(() => { const c = document.getElementById('planAdvChk'); return c && !c.disabled; })) break; }
  await page.evaluate(() => { const c = document.getElementById('planAdvChk'); if (!c.checked) c.click(); }); await sleep(300);
  const re = await page.evaluate(() => ({ val: document.getElementById('planFeeVenue').value, label: document.getElementById('planFeeVenue').closest('.csel').querySelector('.csel-trigger').innerText.replace(/\s+/g, ' ').trim() }));
  chk(label + ': after a reload the picker still says ' + target, re.val === tval && re.label.indexOf(target) >= 0, re);
}

(async () => {
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' }); const tok = se.body.token || '';
  chk('throwaway member + session', se.status === 200 && !!tok, { status: se.status });
  try {
    await withBrowser(async (browser) => {
      { const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 1366, height: 900 }); await asMember(page, tok);
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
        await walk(page, 'desktop', 'MarginPad'); chk('desktop: no page errors', errs.length === 0, errs); await ctx.close(); }
      { const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'); await asMember(page, tok);
        await walk(page, 'phone', 'MEXC'); await ctx.close(); } // same member, fresh device: the desktop pick must already be there
    });
  } catch (e) { chk('run', false, String(e && e.stack || e).slice(0, 400)); }
  finally { try { await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }); } catch (e) {} }
  const fails = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + (out.length - fails) + '/' + out.length + ' passed');
  process.exit(fails ? 1 : 0);
})();

#!/usr/bin/env node
/* CHAT SETTINGS - E2E (2026-10-23). See build/add-chat-prefs.js.
   A real member on the app shell (home.js chat) and on a standalone page (mp-trade.js chat injected by mp-nav):
   the gear sits in the chat header exactly once, opens a popover with chips (never a native select), the
   shared-trade setting switches an EXISTING card to the plain link and back (the wire format is untouched -
   the message is still `trade:<id>`), the text size is a class on #chatBox with the measured font sizes, and
   both survive a reload. The trade ticket is a fake answer to /api/tshare so the test owns its own fixture. */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 220) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TICKET = { ok: true, ticket: { sym: 'BTC', side: 'long', lev: 20, entry: 60000, exit: 61200, roe: 40, pnl: 20, margin: 50, status: 'win', ts: Date.now() - 3600e3, closeTs: Date.now(), by: 'e2e', spark: [59800, 59900, 60000, 60300, 60100, 60600, 60900, 61200] } };

async function prep(p, tok) {
  await p.setCacheEnabled(false);
  await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  await p.setRequestInterception(true);
  p.on('request', req => { const u = req.url(); if (/\/api\/tshare\?id=e2eprefs/.test(u)) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(TICKET) }); req.continue(); });
}
// a chat row carrying a shared trade, exactly as linkifyMsg writes it
const INJECT = (id) => `(function(){var ms=document.getElementById('ctMsgs');if(!ms)return false;var d=document.createElement('div');d.className='ct-msg';d.innerHTML='<span class="ct-body"><a class="ct-trade" data-trade="${id}" role="button" tabindex="0">trade:${id}</a></span>';ms.appendChild(d);return true;})()`;

(async () => {
  const uid = 'e2ecp' + Date.now().toString(36);
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const se = await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());
  try {
    await withBrowser(async (b) => {
      console.log('# app shell /paper-trade, desktop 1366');
      let p = await b.newPage(); await p.setViewport({ width: 1366, height: 768 }); await prep(p, se.token);
      const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
      await p.goto(O + '/paper-trade?chat=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await p.waitForFunction("window.mpChatPrefs && document.querySelector('#chatBox .ct-head .ct-gear')", { timeout: 40000 });
      let d = await p.evaluate(() => ({ gears: document.querySelectorAll('#chatBox .ct-gear').length, selects: document.querySelectorAll('#chatBox select').length, inHead: !!document.querySelector('#chatBox .ct-head .ct-gear'), label: (document.querySelector('#chatBox .ct-gear') || {}).getAttribute('aria-label'), txt: (document.querySelector('#chatBox .ct-gear') || {}).textContent }));
      ok(d.gears === 1 && d.inHead, 'the gear sits in the chat header exactly once', d);
      ok(d.label === 'Chat settings' && !/\S/.test(d.txt || ''), 'it is an icon with an aria-label, no text', d);
      ok(d.selects === 0, 'no native select anywhere in the chat', d.selects);
      // a shared trade hydrates to a card under the default
      ok(await p.evaluate(INJECT('e2eprefs1')), 'a trade:<id> row was injected');
      await p.evaluate(() => window.mpTradeCard.hydrate(document));
      await p.waitForSelector('#chatBox .ct-tk[data-trade="e2eprefs1"]', { timeout: 8000 }).catch(() => {});
      d = await p.evaluate(() => ({ card: !!document.querySelector('#chatBox .ct-tk[data-trade="e2eprefs1"]'), roe: (document.querySelector('#chatBox .ct-tk[data-trade="e2eprefs1"] .ct-tk-roe') || {}).textContent }));
      ok(d.card && d.roe === '+40%', 'under the default setting the shared trade is the card', d);
      // open the popover
      await p.click('#chatBox .ct-gear'); await sleep(300);
      d = await p.evaluate(() => { const pop = document.querySelector('#chatBox .ct-prefs'); if (!pop) return { pop: false }; const r = pop.getBoundingClientRect(), box = document.getElementById('chatBox').getBoundingClientRect(); return { pop: true, rows: pop.querySelectorAll('.ctp-r').length, chips: pop.querySelectorAll('.ctp-c button').length, on: Array.from(pop.querySelectorAll('.ctp-c button.on')).map(b => b.getAttribute('data-v')), inside: r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top, selects: pop.querySelectorAll('select').length, role: pop.getAttribute('role') }; });
      ok(d.pop && d.rows === 2 && d.chips === 5, 'the popover opens with two rows and five chips', d);
      ok(d.on && d.on.join(',') === 'card,m', 'the defaults are lit (card, M)', d.on);
      ok(d.inside && d.role === 'dialog', 'it sits inside the chat box and is a dialog', d);
      // link look
      await p.click('#chatBox .ct-prefs [data-k="trades"][data-v="link"]'); await sleep(300);
      d = await p.evaluate(() => ({ pref: JSON.parse(localStorage.getItem('mp_ct_prefs') || '{}'), card: !!document.querySelector('#chatBox .ct-tk[data-trade="e2eprefs1"]'), a: (() => { const a = document.querySelector('#chatBox a.ct-trade[data-trade="e2eprefs1"]'); return a ? { txt: a.textContent, tk: a.hasAttribute('data-tk') } : null; })(), on: Array.from(document.querySelectorAll('#chatBox .ct-prefs .ctp-c button.on')).map(b => b.getAttribute('data-v')) }));
      ok(d.pref.trades === 'link', 'the choice is saved on the device', d.pref);
      ok(!d.card && d.a && d.a.txt === 'trade:e2eprefs1' && !d.a.tk, 'the existing card turned back into the plain trade:<id> link, hydratable again', d);
      ok(d.on.indexOf('link') >= 0, 'the popover repainted with Link lit', d.on);
      ok(await p.evaluate(INJECT('e2eprefs2')), 'a second trade row was injected');
      await p.evaluate(() => window.mpTradeCard.hydrate(document)); await sleep(700);
      d = await p.evaluate(() => ({ cards: document.querySelectorAll('#chatBox .ct-tk').length, links: document.querySelectorAll('#chatBox a.ct-trade[data-trade^="e2eprefs"]').length }));
      ok(d.cards === 0 && d.links === 2, 'with Link chosen a new share stays a link too', d);
      // back to the card
      await p.click('#chatBox .ct-prefs [data-k="trades"][data-v="card"]');
      await p.waitForFunction("document.querySelectorAll('#chatBox .ct-tk[data-trade^=\"e2eprefs\"]').length === 2", { timeout: 8000 }).catch(() => {});
      d = await p.evaluate(() => document.querySelectorAll('#chatBox .ct-tk[data-trade^="e2eprefs"]').length);
      ok(d === 2, 'switching back to Card hydrates both shares again', d);
      // text size
      const fs0 = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#chatBox .ct-msg')).fontSize));
      await p.click('#chatBox .ct-prefs [data-k="size"][data-v="l"]'); await sleep(200);
      const fsL = await p.evaluate(() => ({ cls: document.getElementById('chatBox').classList.contains('ct-fs-l'), fs: parseFloat(getComputedStyle(document.querySelector('#chatBox .ct-msg')).fontSize) }));
      await p.click('#chatBox .ct-prefs [data-k="size"][data-v="s"]'); await sleep(200);
      const fsS = await p.evaluate(() => ({ cls: document.getElementById('chatBox').classList.contains('ct-fs-s'), fs: parseFloat(getComputedStyle(document.querySelector('#chatBox .ct-msg')).fontSize) }));
      ok(Math.abs(fs0 - 13.5) < 0.6, 'the default message size is 13.5px', fs0);
      ok(fsL.cls && Math.abs(fsL.fs - 15.5) < 0.6, 'L makes the messages 15.5px', fsL);
      ok(fsS.cls && Math.abs(fsS.fs - 12) < 0.6, 'S makes them 12px', fsS);
      // closes on an outside click
      await p.mouse.click(200, 300); await sleep(250);
      ok(!(await p.evaluate(() => !!document.querySelector('#chatBox .ct-prefs'))), 'a click outside closes the popover');
      // survives a reload
      await p.reload({ waitUntil: 'networkidle2' });
      await p.waitForFunction("window.mpChatPrefs && document.querySelector('#chatBox .ct-gear')", { timeout: 40000 });
      // the history arrives over the socket after the box opens - wait for a row, or measure an injected one
      await p.waitForSelector('#chatBox .ct-msg', { timeout: 15000 }).catch(() => {});
      await p.evaluate(INJECT('e2eprefs3'));
      d = await p.evaluate(() => ({ cls: document.getElementById('chatBox').classList.contains('ct-fs-s'), fs: parseFloat(getComputedStyle(document.querySelector('#chatBox .ct-msg')).fontSize), pref: JSON.parse(localStorage.getItem('mp_ct_prefs') || '{}') }));
      ok(d.cls && Math.abs(d.fs - 12) < 0.6 && d.pref.size === 's', 'after a reload the size is applied before anyone taps', d);
      ok(errs.length === 0, 'no page errors on the app shell', errs);
      await p.evaluate(() => localStorage.removeItem('mp_ct_prefs'));
      await p.close();

      console.log('# standalone page /rekt/, phone 390 (mp-trade.js chat)');
      p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await prep(p, se.token);
      const errs2 = []; p.on('pageerror', e => errs2.push(String(e.message || e)));
      await p.goto(O + '/rekt/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await p.waitForSelector('#chatFab', { timeout: 30000 });
      await p.evaluate(() => { const c = document.getElementById('mpCkBar'); if (c) c.remove(); });
      // the FAB may sit under the phone tab bar at rest - open the chat the way its own tab does
      await p.evaluate(() => { const f = document.getElementById('chatFab'); if (f) f.click(); });
      await p.waitForFunction("document.querySelector('#chatBox .ct-head .ct-gear') && document.getElementById('chatBox').offsetWidth > 0", { timeout: 40000 });
      d = await p.evaluate(() => ({ gears: document.querySelectorAll('#chatBox .ct-gear').length, selects: document.querySelectorAll('#chatBox select').length }));
      ok(d.gears === 1 && d.selects === 0, 'the standalone chat carries the same gear, once, no select', d);
      await p.tap('#chatBox .ct-gear'); await sleep(400);
      d = await p.evaluate(() => { const pop = document.querySelector('#chatBox .ct-prefs'); if (!pop) return { pop: false }; const r = pop.getBoundingClientRect(); const hs = Array.from(pop.querySelectorAll('.ctp-c button')).map(b => b.getBoundingClientRect().height); return { pop: true, fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, minH: Math.min.apply(null, hs), centre: (() => { const b = pop.querySelector('[data-v="l"]'), q = b.getBoundingClientRect(); return document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2) === b; })() }; });
      ok(d.pop && d.fits, 'the popover fits the 390px screen', d);
      ok(d.minH >= 26 && d.centre, 'the chips are tappable and reachable at their centre', d);
      await p.tap('#chatBox .ct-prefs [data-k="size"][data-v="l"]'); await sleep(200);
      await p.evaluate(INJECT('e2eprefs4'));
      d = await p.evaluate(() => ({ cls: document.getElementById('chatBox').classList.contains('ct-fs-l'), fs: parseFloat(getComputedStyle(document.querySelector('#chatBox .ct-msg')).fontSize) }));
      ok(Math.abs(d.fs - 15.5) < 0.6, 'and the standalone rows measure 15.5px', d);
      ok(d.cls, 'the size class lands on the standalone chat box too', d);
      ok(errs2.length === 0, 'no page errors on the standalone page', errs2);
      await p.evaluate(() => localStorage.removeItem('mp_ct_prefs'));
      await p.close();
    });
  } finally {
    await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) });
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

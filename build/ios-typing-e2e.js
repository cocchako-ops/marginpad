/* NOTHING MAY TAKE THE FOCUS FROM A FIELD SOMEBODY IS TYPING IN (2026-10-30, owner: on the installed iPhone app the keyboard closed the
   moment @ was typed). On iOS the only web haptic is a click on a hidden <input switch>, the click moves focus, and a text field losing
   focus takes the keyboard with it. No emulator has that keyboard, so the invariant is the cause: with an iPhone UA and no
   navigator.vibrate, the hidden switch must receive NO click while a text field holds focus - from the @ panel opening, a pick,
   or a direct buzz - and must still receive one when nothing is being typed (or the guard has simply killed iOS haptics).
   Also: the panel's list stays inside the room above the composer, and opening it scrolls no ancestor.
   node build/ios-typing-e2e.js [--local] [--falsify]      --local serves mp-auth.js from the tree; --falsify removes the guard   */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');
const O = 'https://marginpad.io', LOCAL = process.argv.includes('--local') || process.argv.includes('--falsify'), FALS = process.argv.includes('--falsify');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
(async () => {
  let src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js'), 'utf8');
  if (FALS) { const a = src.indexOf("var ae = document.activeElement, tag = ae && ae.tagName;"), b = src.indexOf('\n', src.indexOf("if (ae && (tag === 'TEXTAREA'", a)); if (a < 0) throw new Error('guard not found'); src = src.slice(0, a) + src.slice(b); }
  await withBrowser(async (br) => {
    const p = await newPage(br); await p.setCacheEnabled(false);
    await p.setUserAgent(UA);
    await p.setViewport({ width: 390, height: 500, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await p.evaluateOnNewDocument(() => { try { delete Navigator.prototype.vibrate; } catch (e) {} window.__sw = 0; document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('[data-mp-haptic]') && e.target.tagName === 'INPUT') window.__sw++; }, true); });
    if (LOCAL) { await p.setRequestInterception(true); p.on('request', r => { if (/\/assets\/mp-auth\.js/.test(r.url())) r.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: src }); else r.continue(); }); }
    await p.goto(O + '/rewards/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => window.mpMention && window.mpHaptic, { timeout: 30000 });
    await p.evaluate(() => {
      const box = document.createElement('div'); box.id = 'chatBox'; box.style.cssText = 'position:fixed;left:14px;right:14px;top:60px;height:300px;overflow:hidden;background:#111;z-index:99999;display:flex;flex-direction:column';
      box.innerHTML = '<div style="flex:1"></div><form id="tf" style="padding:10px;position:relative"><input id="ti" autocomplete="off" style="width:100%;font-size:16px"></form>';
      document.body.appendChild(box);
      const names = Array.from({ length: 8 }, (_, i) => ({ ins: 'trader' + i, label: 'trader' + i, col: '#c2f64a' }));
      window.__ctl = window.mpMention(document.getElementById('ti'), { host: document.getElementById('tf'), triggers: { '@': (q, cb) => cb(names) } });
      window.__scrolls = 0; document.addEventListener('scroll', () => window.__scrolls++, true); window.addEventListener('scroll', () => window.__scrolls++);
    });
    await p.focus('#ti'); await p.keyboard.type('@');
    await wait(150);
    const a = await p.evaluate(() => { const pal = document.querySelector('.mpac'), l = document.querySelector('.mpac-l'), bx = document.getElementById('chatBox').getBoundingClientRect(), r = pal.getBoundingClientRect(); return { on: pal.classList.contains('on'), sw: window.__sw, focus: document.activeElement && document.activeElement.id, maxH: l.style.maxHeight, inBox: r.top >= bx.top, rows: l.children.length, scrolls: window.__scrolls }; });
    ok(a.on && a.rows === 8, 'typing @ opens the panel with the names', a);
    ok(a.sw === 0, 'the hidden switch got NO click from the panel opening (that click is what closed the keyboard)', a.sw);
    ok(a.focus === 'ti', 'the field still holds focus', a.focus);
    ok(a.inBox, 'the panel fits inside the room above the composer', a);
    ok(a.scrolls === 0, 'opening it scrolled nothing', a.scrolls);
    await p.evaluate(() => { window.mpHaptic('tick'); window.mpBuzz([14]); });
    ok(await p.evaluate(() => window.__sw) === 0, 'neither does a toast or any other buzz while typing');
    await p.keyboard.type('t'); await wait(80);
    await p.tap('.mpac-r[data-i="2"]'); await wait(200);
    const b = await p.evaluate(() => ({ v: document.getElementById('ti').value, sw: window.__sw, focus: document.activeElement && document.activeElement.id, on: document.querySelector('.mpac').classList.contains('on') }));
    ok(b.v === '@trader2 ', 'a tap on a row writes the name', b.v);
    ok(b.sw === 0 && b.focus === 'ti' && !b.on, 'and the field keeps focus, no switch click, panel shut', b);
    await p.evaluate(() => { document.getElementById('ti').blur(); window.mpHaptic('tick'); });
    ok(await p.evaluate(() => window.__sw) === 1, 'with nothing being typed the iOS haptic still fires (the guard did not simply kill it)');
    await p.close();
  }, { timeoutMs: 120000 });
  console.log('\nios-typing-e2e: ' + pass + ' ok, ' + fail + ' fail'); process.exitCode = fail ? 1 : 0;
})();

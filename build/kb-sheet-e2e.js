/* No emulator raises an iOS keyboard, so the keyboard is FAKED: visualViewport.height is overridden on the
   instance and the sheet's own sync is called, which is exactly what a real keyboard does to it. The question
   is one measurement - with 336px of keyboard up, is the DM composer still on screen above it, or behind it? */
'use strict';
const { withBrowser, newPage } = require('./e2e-browser.js');
const fs = require('fs');
const O = 'https://marginpad.io';
const KEY = (fs.readFileSync('ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const wait = ms => new Promise(r => setTimeout(r, ms));
const KB = 336;                                     // an iPhone keyboard with the suggestion strip
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); c ? pass++ : fail++; };

(async () => {
  const a = 'e2e_kba' + Date.now().toString(36), b2 = 'e2e_kbb' + Date.now().toString(36);
  const post = (uid, op) => fetch(O + '/api/admin/e2euser', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify({ uid, op }) });
  await post(a, 'mk'); await post(b2, 'mk');
  const tok = (await (await post(a, 'sess')).json()).token;
  await withBrowser(async (br) => {
    const p = await newPage(br); await p.setCacheEnabled(false);
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    await p.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await wait(8000);

    ok(await p.evaluate(() => typeof window.__mpKbSheet === 'function'), 'the sheet carries a keyboard sync');
    ok(await p.evaluate(() => { const s = [...document.querySelectorAll('style')].map(x => x.textContent).join(''); return s.indexOf('mpa-kb') >= 0; }), 'and the body.mpa-kb rules are in the stylesheet');

    await p.evaluate((nm) => { try { window.mpAuth.dm(nm); } catch (e) {} }, 'e2e_' + b2);
    await wait(3000);
    const before = await p.evaluate(() => {
      const pan = document.querySelector('.mpa-panel'), f = document.querySelector('.mpa-dm-form');
      return { panel: !!pan, form: !!f, formBottom: f ? Math.round(f.getBoundingClientRect().bottom) : null, panelH: pan ? Math.round(pan.getBoundingClientRect().height) : null, vh: innerHeight };
    });
    ok(before.form, 'the DM composer is on the page' + (before.form ? ' (bottom ' + before.formBottom + ' of ' + before.vh + ')' : ''));

    // raise the keyboard: the visual viewport shrinks, innerHeight does NOT - that is iOS exactly
    await p.evaluate((kb) => {
      const vv = window.visualViewport, h = vv.height;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => h - kb });
      vv.dispatchEvent(new Event('resize'));
      if (window.__mpKbSheet) window.__mpKbSheet();
    }, KB);
    await wait(400);
    const after = await p.evaluate(() => {
      const pan = document.querySelector('.mpa-panel'), f = document.querySelector('.mpa-dm-form'), sc = document.querySelector('.mpa-dm-scroll');
      const fr = f ? f.getBoundingClientRect() : null;
      return { kbClass: document.body.classList.contains('mpa-kb'),
        vvh: getComputedStyle(document.documentElement).getPropertyValue('--mpa-vvh').trim(),
        formBottom: fr ? Math.round(fr.bottom) : null, formTop: fr ? Math.round(fr.top) : null,
        panelH: pan ? Math.round(pan.getBoundingClientRect().height) : null,
        panelBottom: pan ? Math.round(pan.getBoundingClientRect().bottom) : null,
        scrollH: sc ? Math.round(sc.getBoundingClientRect().height) : null, vh: innerHeight };
    });
    const line = after.vh - KB;                       // the top edge of the keyboard
    console.log('\n   keyboard top at y=' + line + '   panel bottom ' + after.panelBottom + '   composer ' + after.formTop + '-' + after.formBottom + '   scroll area ' + after.scrollH + 'px');
    ok(after.kbClass, 'the keyboard is recognised (body.mpa-kb)');
    ok(after.vvh === (after.vh - KB) + 'px', 'and the room that is left is published as --mpa-vvh (' + after.vvh + ')');
    ok(after.formBottom !== null && after.formBottom <= line, 'THE COMPOSER IS ABOVE THE KEYBOARD (' + after.formBottom + ' <= ' + line + ')');
    ok(after.panelBottom !== null && after.panelBottom <= line + 1, 'and so is the whole sheet (' + after.panelBottom + ')');
    ok(after.scrollH > 60, 'the thread still has room to read (' + after.scrollH + 'px)');

    console.log('--- where the room goes ---');
    const diag = await p.evaluate(() => { const pan=document.querySelector('.mpa-panel'); const r=pan.getBoundingClientRect();
      const cs=getComputedStyle(pan);
      const kids=[...pan.children].map(c=>({t:(c.tagName+'.'+(c.className||'')).slice(0,34),h:Math.round(c.getBoundingClientRect().height)}));
      const dm=document.querySelector('.mpa-dm'); const dcs=dm?getComputedStyle(dm):null;
      return {panelTop:Math.round(r.top),panelH:Math.round(r.height),display:cs.display,dir:cs.flexDirection,maxH:cs.maxHeight,overflow:cs.overflowY,kids,dmH:dm?Math.round(dm.getBoundingClientRect().height):null,dmFlex:dcs?dcs.flex:null,dmHeight:dcs?dcs.height:null,dmMin:dcs?dcs.minHeight:null}; });
    console.log(JSON.stringify(diag,null,1));
    await p.screenshot({ path: 'kb-sheet.png' });

    // put it away again: everything must go back exactly as it was
    await p.evaluate(() => { const vv = window.visualViewport; delete vv.height; vv.dispatchEvent(new Event('resize')); if (window.__mpKbSheet) window.__mpKbSheet(); });
    await wait(400);
    const back = await p.evaluate(() => ({ kb: document.body.classList.contains('mpa-kb'), formBottom: Math.round(document.querySelector('.mpa-dm-form').getBoundingClientRect().bottom) }));
    ok(!back.kb, 'the keyboard going away takes the class with it');
    ok(Math.abs(back.formBottom - before.formBottom) <= 2, 'and the sheet is exactly where it started (' + back.formBottom + ' vs ' + before.formBottom + ')');
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await p.close();
  }, { timeoutMs: 240000 });
  await post(a, 'rm'); await post(b2, 'rm');
  console.log('\n' + pass + ' ok, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

// Sign-in modal E2E (2026-09-07, after the "Network error" regression): the real modal in a real browser, English on
// /paper-trade and Spanish on /spot/?lang=es — enter an e2e address, Send code, the code step must appear (the request is
// a real POST /api/auth/start against the DO; e2e addresses on marginpad.test never reach a mailbox), a wrong code must be
// refused with a readable message, no page errors. Run after ANY change to dist/assets/mp-auth.js: node build/auth-modal-e2e.js
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 160) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const start = await (await fetch(O + '/api/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'e2e-authapi' + Date.now().toString(36) + '@marginpad.test' }) })).json();
  chk('API: /api/auth/start answers ok for a fresh address', start && start.ok === true, start);
  await withBrowser(async (browser) => {
    for (const [path, lang, exp] of [['/paper-trade?', 'en', { h3: /Check your inbox/, verify: /^Verify$/ }], ['/spot/?lang=es&', 'es', { h3: /Revisá tu correo/, verify: /^Verificar$/ }]]) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto(O + path + 'cb=' + Date.now(), { waitUntil: 'load', timeout: 60000 }); await sleep(3500);
      await page.evaluate(() => { const b = document.querySelector('#gate .cta, [data-auth-open]'); b.click(); }); await sleep(1000);
      const step1 = await page.evaluate(() => ({ h3: (document.querySelector('.mpa-modal h3') || {}).textContent, send: (document.getElementById('mpaSend') || {}).textContent }));
      chk(lang + ': modal opens with the email step', !!step1.h3 && !!step1.send, step1);
      await page.type('#mpaEmail', 'e2e-modal' + lang + Date.now().toString(36) + '@marginpad.test'); await page.click('#mpaSend'); await sleep(4000);
      const st = await page.evaluate(() => ({ h3: (document.querySelector('.mpa-modal h3') || {}).textContent, msg: (document.querySelector('.mpa-msg') || {}).textContent, hasCode: !!document.getElementById('mpaCode'), verify: (document.getElementById('mpaVerify') || {}).textContent }));
      chk(lang + ': Send code leads to the code step (no "Network error")', st.hasCode && exp.h3.test(st.h3 || '') && exp.verify.test(st.verify || '') && !/Network error/.test(st.msg || ''), st);
      await page.type('#mpaCode', '000000'); await page.click('#mpaVerify'); await sleep(2500);
      const st2 = await page.evaluate(() => (document.querySelector('.mpa-msg') || {}).textContent || '');
      chk(lang + ': a wrong code is refused with a readable message', /tries left|Wrong code|intentos|incorrecto/i.test(st2), st2);
      chk(lang + ': zero page errors', errs.length === 0, errs);
      await ctx.close();
    }
  });
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' — ' + f + ' FAIL' : ''));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });

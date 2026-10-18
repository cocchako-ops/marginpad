/* THE GRADUATION PANEL MUST NOT BILL A THUMB AIMED AT "OPEN" (2026-10-18, owner, after Papis said in DMs:
   "Yes, sometimes by accident when I'm opening multiples positions ... 10 or 15 in a few seconds").

   MEASURED before this was written, from the activity ring over 9 hours (05:58-15:00 UTC, 2026-10-18):
     - 7 of 26 money clicks site-wide (27%) landed 0.86-1.60 s after that visitor's own `grad` event, every one of
       them on /paper-trade, across TWO members (Papis 5, Malikush 2);
     - in 5 of the 7 the trader carried on tapping Open 1-5 s later, i.e. never left the page;
     - open -> open gap inside those bursts: n=63, p50 701 ms, p90 1678 ms;
     - the panel is CENTRED and the trade form's "Open demo trade" button sits at the centre of a phone, so the
       Bybit card covers that button 100% at 390x844 and 49% at 844x390.
   So the panel appeared 600 ms after the trader's own tap, on the pixels they were tapping, and the next tap of the
   burst was recorded as a money click - inflating the one number the owner prices decisions from, and pinging his
   Telegram each time.

   Two guards, asserted here: GRAD_IDLE (never raise it while opens are still arriving) and GRAD_ARM (the partner
   cards are pointer-events:none until long enough has passed that no tap can be a mistake). The CSS half is the
   guarantee - an <a> navigates on touch whether or not our JS cooperates.

   node build/grad-guard-e2e.js              against production
   node build/grad-guard-e2e.js --local      app.html + home.js/home.css from the tree (pre-deploy)
   node build/grad-guard-e2e.js --local --falsify   guards stripped from the served files: the 6 load-bearing
                                                    checks MUST go red (a suite that cannot fail is worth nothing) */
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_MOBILE } = require('./e2e-browser');
const BASE = 'https://marginpad.io', DIST = path.join(__dirname, '..', 'dist'), A = path.join(DIST, 'assets');
const LOCAL = process.argv.includes('--local'), FALSIFY = process.argv.includes('--falsify');
if (FALSIFY && !LOCAL) { console.error('--falsify needs --local (it rewrites the served bundles)'); process.exit(2); }
let pass = 0, fail = 0;
const ok = (n, c, note) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (note !== undefined ? '  -> ' + String(typeof note === 'string' ? note : JSON.stringify(note)).slice(0, 240) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// A REAL member session, because the geometry depends on it: the member-only Advanced block makes the page long
// enough to scroll the Open button to the middle of the screen, which is exactly where this fixed centred panel
// lands. Mocked auth produced a shorter page where the button sat at y=656 and nothing overlapped - a layout no
// signed-in trader ever sees, and Papis is a signed-in trader.
const KEY = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim(); } catch (e) { return ''; } })();
const UID = 'e2e_gradguard';
async function e2e(op) {
  const r = await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ uid: UID, op }) });
  return r.json();
}

// --falsify restores exactly the two guards, nothing else: the CSS rule and the idle wait.
function serveFile(name) {
  let s = fs.readFileSync(path.join(A, name), 'utf8');
  if (!FALSIFY) return s;
  if (name === 'home.css') s = s.split('.grad-modal:not(.armed) .grad-ex{pointer-events:none;}').join('/* stripped by --falsify */');
  if (name === 'home.js') s = s.split('setTimeout(tryShow,600)').join('setTimeout(show,600)')
    .split("_armT=setTimeout(function(){if(elm)elm.classList.add('armed');},GRAD_ARM)").join("elm.classList.add('armed')");
  return s;
}

let TOKEN = '';
async function prep(browser, w, h) {
  const page = await newPage(browser, { mobile: true, ua: UA_MOBILE });
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  const tracked = [], popped = [];
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
  await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' }, { name: 'mp_sess', value: TOKEN, domain: 'marginpad.io', path: '/' });
  page.on('request', (req) => {
    const u = req.url();
    // Every beacon is RECORDED and swallowed: a test click must never reach aff:total (the figure this bug inflated).
    if (u.indexOf('/api/track') >= 0) { try { tracked.push(new URL(u).search); } catch (e) {} return req.respond({ status: 204, body: '' }); }
    if (/partner\.bybit\.com|moon\.com/.test(u)) { popped.push(u); return req.abort(); }
    if (LOCAL) { try { const p = new URL(u).pathname;
      if (req.resourceType() === 'document' && /^\/paper-trade\/?$/.test(p)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'app.html'), 'utf8') });
      const m = p.match(/^\/assets\/(home\.css|home\.js|mp-auth\.js|mp-nav\.js)$/);
      if (m) return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: serveFile(m[1]) });
    } catch (e) {} }
    req.continue();
  });
  await page.goto(BASE + '/paper-trade?nc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('!!document.getElementById("planSave") && !!window.mpCheckGrad', { timeout: 40000 });
  await sleep(2600); // past the boot mpCheckGrad (1500 ms) so it cannot be mistaken for an open
  // the partner hrefs are neutralised: this suite proves WHEN the card is clickable, and must never send a real
  // datacentre click into the affiliate dashboards it is protecting.
  await page.evaluate(() => { window.__gradArm = 0; });
  page._t = tracked; page._pop = popped; page._errors = errors;
  return page;
}

const btnRect = (page) => page.evaluate(() => {
  const b = document.getElementById('planSave'); b.scrollIntoView({ block: 'center' });
  return new Promise(res => setTimeout(() => { const r = b.getBoundingClientRect(); res({ y: r.y, h: r.height, cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), txt: (b.textContent || '').trim().slice(0, 20) }); }, 400));
});
const seedMilestone = (page) => page.evaluate(() => {
  localStorage.setItem('mp_grad_next', '8'); localStorage.setItem('mp_grad_fw', '1');
  localStorage.setItem('mp_journal', JSON.stringify(new Array(158).fill({ status: 'win', pnl: 1, margin: 1 })));
  window.__gradN = 158; window.__gradFW = 0;
  document.querySelectorAll('.grad-modal').forEach(m => { m.hidden = true; });
  Array.from(document.querySelectorAll('.grad-card')).forEach(a => { a.setAttribute('href', 'about:blank#' + a.getAttribute('data-ex')); });
});
const up = (page) => page.evaluate(() => !!document.querySelector('.grad-modal:not([hidden]) .grad-ex'));
const armed = (page) => page.evaluate(() => { const m = document.querySelector('.grad-modal:not([hidden]) .grad-ex'); return !!(m && m.closest('.grad-modal').classList.contains('armed')); });
const sent = (page, re) => page._t.filter(s => re.test(s)).length;

withBrowser(async (browser) => {
  if (!KEY) { console.error('ADMIN_KEY.local.txt line 2 is needed: this suite walks a real member session'); process.exitCode = 2; return; }
  await e2e('mk'); TOKEN = (await e2e('sess')).token || '';
  ok('a real member session was minted (the layout under test is a member layout)', !!TOKEN);
  for (const vp of [{ w: 390, h: 844, n: 'phone portrait 390x844' }, { w: 844, h: 390, n: 'phone landscape 844x390' }]) {
    console.log('\n' + vp.n + (LOCAL ? ' (--local)' : '') + (FALSIFY ? ' (--falsify)' : ''));
    const page = await prep(browser, vp.w, vp.h);
    const b0 = await btnRect(page);
    ok('the Open button is the thing being tapped', /open/i.test(b0.txt), b0);

    // --- the premise: the panel really does land on that button ---
    // GEOMETRY IS ASSERTED AGAINST PRODUCTION ONLY. --local serves the bundle but not the worker's injections
    // (SPA_META, the mp-nav header, the cookie bar): the page comes out ~6 KB shorter, the document cannot scroll
    // the form to the middle of the screen, and the button lands at y=656 instead of y=438 - a layout no signed-in
    // trader ever sees. --local exists to prove the GUARD, which is bundle code; the overlap is a page fact.
    await seedMilestone(page);
    await page.evaluate(() => window.mpCheckGrad());
    await page.waitForFunction('!!document.querySelector(".grad-modal:not([hidden]) .grad-ex")', { timeout: 9000 }).catch(() => {}); // a panel that never came is a red check below, not an exception
    // By RECTANGLE, not elementFromPoint: the guard makes the cards input-transparent on purpose, so a hit test
    // through them proves the guard, not the geometry. What matters here is that the card lies ON the button.
    const over = await page.evaluate(() => {
      const b = document.getElementById('planSave').getBoundingClientRect();
      let cov = 0, who = null;
      Array.from(document.querySelectorAll('.grad-modal:not([hidden]) .grad-card')).forEach(c => {
        const r = c.getBoundingClientRect();
        const ox = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)), oy = Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top));
        if (ox * oy > 0) { cov += ox * oy; who = who || c.getAttribute('data-ex'); }
      });
      return { pct: Math.round(cov / (b.width * b.height) * 100), who };
    });
    if (LOCAL) console.log('       (geometry not asserted under --local; measured ' + over.pct + '% here)');
    else {
      ok('a partner card covers the Open button (the premise of this whole suite)', over.pct > 0, over);
      ok('its centre is reachable when no panel is up', await page.evaluate((x, y) => { const m = document.querySelector('.grad-modal:not([hidden])'); if (m) m.hidden = true; const e = document.elementFromPoint(x, y); const b = document.getElementById('planSave'); return !!(e && (e === b || b.contains(e))); }, b0.cx, b0.cy));
      console.log('       (' + over.pct + '% of the Open button is under the ' + over.who + ' card)');
      await page.evaluate(() => { const m = document.querySelector('.grad-modal'); if (m) m.hidden = false; });
    }

    // --- GRAD_ARM: the first tap cannot be a money click ---
    ok('the panel opens UNARMED', !(await armed(page)));
    const t0 = page._t.length, p0 = page._pop.length, g0 = (await browser.pages()).length;
    await page.mouse.click(b0.cx, b0.cy); // the thumb, still aiming at Open
    await sleep(500);
    ok('a tap inside the arming window sends NO exchange beacon', sent(page, /t=exchange/) === 0, page._t.slice(t0));
    ok('a tap inside the arming window opens no tab', page._pop.length === p0 && (await browser.pages()).length === g0, { pop: page._pop.slice(p0), tabs: (await browser.pages()).length - g0 });
    ok('and it is COUNTED, not swallowed in silence', sent(page, /t=grad&e=miss/) >= 1, page._t.slice(t0));
    ok('the panel is dismissed by that tap (it was meant for what it covered)', !(await up(page)));

    // --- the offer still works once nobody could have mistaken it ---
    await seedMilestone(page);
    await page.evaluate(() => window.mpCheckGrad());
    await page.waitForFunction('!!document.querySelector(".grad-modal:not([hidden]) .grad-ex")', { timeout: 9000 }).catch(() => {}); // a panel that never came is a red check below, not an exception
    await page.waitForFunction('!!document.querySelector(".grad-modal.armed:not([hidden])")', { timeout: 9000 }).catch(() => {});
    ok('it arms by itself', await armed(page));
    const t1 = page._t.length;
    const card = await page.evaluate(() => { const a = document.querySelector('.grad-card[data-ex="Bybit"]'); const r = a.getBoundingClientRect(); return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; });
    await page.mouse.click(card.cx, card.cy);
    await sleep(450);
    ok('an armed tap on the Bybit card IS a money click', sent(page, /t=exchange&e=Bybit/) >= 1, page._t.slice(t1));

    // --- GRAD_IDLE: never raised under a thumb that is still opening trades ---
    await page.evaluate(() => { document.querySelectorAll('.grad-modal').forEach(m => { m.hidden = true; }); });
    await seedMilestone(page);
    const burst = await page.evaluate(() => new Promise(res => { // the MEASURED cadence: one open every 700 ms
      let n = 0, seen = false;
      const t = setInterval(() => { n++; window.mpCheckGrad(); if (document.querySelector('.grad-modal:not([hidden]) .grad-ex')) seen = true; if (n >= 8) { clearInterval(t); res({ seen }); } }, 700);
    }));
    ok('no panel appears DURING a burst of opens', !burst.seen);
    await sleep(3400); // the burst stopped: it is allowed through now
    ok('it appears once the trader stops', await up(page), 'still hidden after the burst ended');

    ok('no page errors', page._errors.length === 0, page._errors.slice(0, 3));
    await page.close();
  }
}, { timeoutMs: 230000 }).then(async () => {
  try { if (TOKEN || KEY) await e2e('rm'); } catch (e) {}
  console.log('\ngrad-guard-e2e' + (LOCAL ? ' (--local)' : '') + (FALSIFY ? ' (--falsify)' : '') + ': ' + pass + ' passed, ' + fail + ' failed');
  /* MEASURED 2026-10-18: stripping the two guards turns exactly 10 checks red, and the run reproduces the bug -
     a tap aimed at the Open button sends `t=exchange&e=Moon` and opens a tab. */
  if (FALSIFY) {
    const want = 10;
    console.log(fail >= want ? 'falsification OK: the guards are load-bearing (' + fail + ' red)' : 'FALSIFICATION FAILED: expected at least ' + want + ' red with the guards stripped, got ' + fail);
    process.exitCode = fail >= want ? 0 : 1; return;
  }
  process.exitCode = fail ? 1 : 0;
}).catch(e => { console.error(e); process.exitCode = 1; });

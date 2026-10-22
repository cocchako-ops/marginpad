#!/usr/bin/env node
/* MP TAPE EVENT MODE - E2E (2026-10-23). See build/add-tape-event.js.
   The homepage is loaded with /api/calendar INTERCEPTED so a fake event sits 28 minutes ahead; both strips must
   read the static line, the marquee animation must be off, and moving the clock past the window through
   window.__mpTapeEv.tick() must bring the ordinary tape back with its content. The pure rules (impact floor,
   all-day entries, which of two events wins) are driven through the shipped pick(). A last leg loads the page
   with the REAL calendar and requires the ordinary tape unless a real event is inside the window right now. */
'use strict';
const path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 220) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fakeCal(p, events) {
  await p.setRequestInterception(true);
  p.on('request', req => {
    const u = req.url();
    if (/\/api\/calendar\?/.test(u)) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, events }) });
    req.continue();
  });
}
async function load(p) {
  await p.goto(O + '/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
  await p.waitForFunction('window.__mpTapeEv && window.__mpTapeEv.state().n > 0', { timeout: 30000 });
  await sleep(400);
}

(async () => {
  const now = Date.now(), T = 'FOMC rate decision (e2e)';
  const EV = [{ ts: now + 28 * 60000, type: 'fomc', title: T, impact: 3, desc: 'x' }];
  await withBrowser(async (b) => {
    /* ---- desktop ---- */
    console.log('# desktop 1366 - a fake event 28 minutes ahead');
    let p = await b.newPage(); await p.setViewport({ width: 1366, height: 768 }); await p.setCacheEnabled(false);
    const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
    await fakeCal(p, EV); await load(p);
    let d = await p.evaluate(() => {
      const tp = document.getElementById('tape'), tw = tp && tp.closest('.tape'), a = tp && tp.querySelector('.tape-ev a');
      const cs = tp && getComputedStyle(tp);
      return { ev: !!(tw && tw.classList.contains('ev')), txt: tp ? tp.textContent.replace(/\s+/g, ' ').trim() : '', anim: cs && cs.animationName, href: a && a.getAttribute('href'),
        // the marquees' own duplicated spans sit past the edge inside overflow:hidden by design - the invariant is the
        // document (never a sideways scroll) and the event line itself (readable to its last character)
        over: (document.documentElement.scrollWidth > innerWidth + 1 ? 1 : 0) + ((tp && tp.querySelector('.tape-ev') && tp.querySelector('.tape-ev').getBoundingClientRect().right > innerWidth + 1) ? 1 : 0),
        st: window.__mpTapeEv.state() };
    });
    ok(d.ev, 'the desktop tape is in event mode', d.st);
    ok(/IN 2[789] MIN/.test(d.txt), 'it counts down in minutes ("IN 28 MIN")', d.txt);
    ok(d.txt.indexOf(T) >= 0, 'it names the event', d.txt);
    ok(d.anim === 'none', 'the marquee animation is off while the line stands', d.anim);
    ok(d.href === '/calendar/', 'the line links the calendar', d.href);
    ok(d.over === 0, 'nothing runs past the right edge', d.over);
    // the clock moves: five minutes into the event, then past the window
    d = await p.evaluate((ts) => { window.__mpTapeEv.tick(ts + 5 * 60000); const tp = document.getElementById('tape'); return { ev: tp.closest('.tape').classList.contains('ev'), txt: tp.textContent.replace(/\s+/g, ' ').trim() }; }, EV[0].ts);
    ok(d.ev && /\bNOW\b/.test(d.txt), 'five minutes in it reads NOW', d.txt);
    d = await p.evaluate((ts) => { window.__mpTapeEv.tick(ts + 20 * 60000); const tp = document.getElementById('tape'); return { ev: tp.closest('.tape').classList.contains('ev'), kids: tp.children.length, anim: getComputedStyle(tp).animationName, hasEv: !!tp.querySelector('.tape-ev') }; }, EV[0].ts);
    ok(!d.ev && !d.hasEv, 'twenty minutes after the start the mode is over', d);
    ok(d.kids >= 6 && d.anim === 'tape', 'the ordinary price tape is back with its pairs and its animation', d);
    // the pure rules through the shipped pick()
    const r = await p.evaluate((now) => {
      const P = window.__mpTapeEv.pick;
      return {
        allday: P([{ ts: now + 600000, impact: 3, allday: true, title: 'x' }], now),
        low: P([{ ts: now + 600000, impact: 1, title: 'x' }], now),
        far: P([{ ts: now + 61 * 60000, impact: 3, title: 'x' }], now),
        old: P([{ ts: now - 16 * 60000, impact: 3, title: 'x' }], now),
        two: (P([{ ts: now - 5 * 60000, impact: 3, title: 'started' }, { ts: now + 40 * 60000, impact: 2, title: 'coming' }], now) || {}).title,
        near: (P([{ ts: now + 50 * 60000, impact: 3, title: 'later' }, { ts: now + 10 * 60000, impact: 2, title: 'sooner' }], now) || {}).title,
      };
    }, now);
    ok(r.allday === null, 'an all-day entry never takes the tape (nothing to count down to)', r.allday);
    ok(r.low === null, 'impact 1 never takes the tape', r.low);
    ok(r.far === null && r.old === null, 'outside -15 / +60 minutes nothing happens', { far: r.far, old: r.old });
    ok(r.two === 'coming', 'an upcoming event outranks one that already started', r.two);
    ok(r.near === 'sooner', 'the nearest upcoming event wins', r.near);
    ok(errs.length === 0, 'no page errors on the desktop', errs);
    await p.close();

    /* ---- phone ---- */
    console.log('# phone 390 - the MP·TAPE strip');
    p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await p.setCacheEnabled(false);
    const errs2 = []; p.on('pageerror', e => errs2.push(String(e.message || e)));
    await fakeCal(p, EV); await load(p);
    d = await p.evaluate(() => {
      const mt = document.getElementById('mpqMT'), ms = mt && mt.closest('.mpqm'), mc = ms && ms.querySelector('.mpqm-cap'), a = mt && mt.querySelector('.tape-ev a');
      const r = ms && ms.getBoundingClientRect();
      return { ev: !!(ms && ms.classList.contains('ev')), cap: mc ? mc.textContent.trim() : '', txt: mt ? mt.textContent.replace(/\s+/g, ' ').trim() : '', anim: mt && getComputedStyle(mt).animationName,
        linkHidden: !a || getComputedStyle(a).display === 'none', fits: !!(r && r.left >= -1 && r.right <= innerWidth + 1), cursor: ms && getComputedStyle(ms).cursor };
    });
    ok(d.ev, 'the phone strip is in event mode');
    ok(/^EVENT/.test(d.cap), 'its caption reads EVENT', d.cap);
    ok(/IN 2[789] MIN/.test(d.txt) && d.txt.indexOf(T) >= 0, 'the line carries the countdown and the title', d.txt);
    ok(d.anim === 'none', 'the phone marquee is off', d.anim);
    ok(d.linkHidden && d.cursor === 'pointer', 'on the phone the whole strip is the link (no inline anchor)', d);
    ok(d.fits, 'the strip fits the 390px screen');
    d = await p.evaluate((ts) => { window.__mpTapeEv.tick(ts + 20 * 60000); const mt = document.getElementById('mpqMT'), ms = mt.closest('.mpqm'); return { ev: ms.classList.contains('ev'), slots: mt.querySelectorAll('[data-tp]').length, cap: ms.querySelector('.mpqm-cap').textContent.trim(), anim: getComputedStyle(mt).animationName }; }, EV[0].ts);
    ok(!d.ev && d.slots >= 12 && d.anim !== 'none', 'after the window the price slots and the marquee come back', d);
    ok(/MP/.test(d.cap), 'the caption is MP·TAPE again', d.cap);
    ok(errs2.length === 0, 'no page errors on the phone', errs2);
    await p.close();

    /* ---- the real calendar ---- */
    console.log('# the real calendar');
    p = await b.newPage(); await p.setViewport({ width: 1366, height: 768 }); await p.setCacheEnabled(false);
    await load(p);
    d = await p.evaluate(() => { const st = window.__mpTapeEv.state(); const tp = document.getElementById('tape'); return { mode: st.mode, ev: st.ev && st.ev.title, n: st.n, kids: tp.children.length, cls: tp.closest('.tape').classList.contains('ev') }; });
    ok(d.n > 0, 'the real calendar loaded (' + d.n + ' events)');
    if (d.mode) console.log('  note a real event is inside the window right now: ' + d.ev + ' - the marquee check is skipped');
    else ok(!d.cls && d.kids >= 6, 'with no event close the ordinary tape scrolls', d);
    const calReq = await p.evaluate(() => performance.getEntriesByType('resource').filter(e => /\/api\/calendar\?/.test(e.name)).length);
    ok(calReq === 1, 'the page makes ONE calendar request (the tile and the tape share it)', calReq);
    await p.close();
  });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

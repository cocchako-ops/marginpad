/* ONE NOTIFICATION AT A TIME, THE REST WAIT (2026-10-28, owner: "ne moze vise od jedne notifikacije da izadje, ako
   ima vise nek cekaju dok ta pre njih ne bude sklonjena ili se ne skloni sama, tad ide sledeca")

   The invariant is COUNTED IN THE DOM over a burst, not asserted off a flag: fire several at once and no frame may
   ever hold two cards, every one must still be shown in order, and the queue must drain by itself. `--falsify`
   restores the old four-at-once renderer and the load-bearing checks must go red.
   node build/toast-queue-e2e.js [--local] [--falsify]                                                            */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const LOCAL = process.argv.indexOf('--local') >= 0;
const FALSIFY = process.argv.indexOf('--falsify') >= 0;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const AUTH = path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js');

/* The old renderer, put back on the wire: four at once and the OLDEST dropped to make room. With it, "no frame holds
   two" and "every card was shown" both have to fail - the first because four stack, the second because a burst of
   six evicts two before they are ever read. */
function revert(src) {
  return src
    .replace(/if \(cur && cur\.isConnected\) \{\n\s*if \(key\) \{ for \(var qi[\s\S]*?return paint\(opts\);/,
      'var _h0 = host(); while (_h0.children.length >= 4) { _h0.removeChild(_h0.firstChild); } return paint(opts);');
}

(async () => {
  const src0 = fs.readFileSync(AUTH, 'utf8');
  const served = FALSIFY ? revert(src0) : src0;
  if (FALSIFY) {
    ok(served !== src0, 'the falsify rewrite found the queue and removed it');
    if (served === src0) { console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }
  }

  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setCacheEnabled(false);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e && e.message || e)));

    await page.setRequestInterception(true);
    try { await page._client().send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
    page.on('request', r => {
      const u = r.url();
      if ((LOCAL || FALSIFY) && /\/assets\/mp-auth\.js/.test(u)) {
        return r.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: served });
      }
      r.continue();
    });

    await page.goto(O + '/paper-trade', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('!!window.mpToast', { timeout: 30000 });
    ok(true, 'the notification channel is on the page');

    /* THE MEASUREMENT: fire six, then sample the DOM every 60 ms for twelve seconds. A frame is what a reader sees,
       so the count that matters is the maximum number of cards alive at any one sample. */
    const r = await page.evaluate(async () => {
      const host = () => document.getElementById('mpxpT');
      const live = () => { const h = host(); return h ? Array.prototype.filter.call(h.children, c => c.className.indexOf('mpxp') >= 0).length : 0; };
      const textOf = () => { const h = host(); return h ? Array.prototype.map.call(h.children, c => c.textContent || '').join('|') : ''; };
      for (let i = 1; i <= 6; i++) window.mpToast({ msg: 'QN' + i, ms: 1300, key: 'qn' + i });
      let maxLive = 0; const seen = {}; const order = [];
      for (let t = 0; t < 200; t++) {
        const n = live(); if (n > maxLive) maxLive = n;
        const tx = textOf();
        for (let i = 1; i <= 6; i++) { const k = 'QN' + i; if (tx.indexOf(k) >= 0 && !seen[k]) { seen[k] = 1; order.push(k); } }
        await new Promise(r2 => setTimeout(r2, 60));
      }
      return { maxLive, order, shown: order.length, end: live(), q: window.mpToastQueue ? window.mpToastQueue() : null };
    });

    ok(r.maxLive === 1, 'no frame ever held more than one card over a burst of six (max ' + r.maxLive + ')');
    ok(r.shown === 6, 'all six were shown, none dropped (' + r.shown + ': ' + r.order.join(' ') + ')');
    ok(r.order.join(',') === 'QN1,QN2,QN3,QN4,QN5,QN6', 'they appeared in the order they were fired');
    ok(r.end === 0, 'the queue drained by itself and the corner is empty again');
    ok(!r.q || r.q.waiting === 0, 'nothing is left waiting (' + JSON.stringify(r.q) + ')');

    // THE X MUST ADVANCE THE QUEUE, not only remove the card - that is the owner's "or it is dismissed" half.
    const r2 = await page.evaluate(async () => {
      const host = () => document.getElementById('mpxpT');
      const first = () => (host() && host().firstChild) ? host().firstChild.textContent : '';
      window.mpToast({ msg: 'HOLD-A', ms: 60000, dismissible: true, key: 'ha' });
      window.mpToast({ msg: 'NEXT-B', ms: 2000, key: 'hb' });
      await new Promise(r3 => setTimeout(r3, 400));
      const aUp = first().indexOf('HOLD-A') >= 0, waiting = window.mpToastQueue ? window.mpToastQueue().waiting : -1;
      const x = host() && host().querySelector('.mpxp-x'); if (x) x.click();
      await new Promise(r3 => setTimeout(r3, 1200));
      const bUp = first().indexOf('NEXT-B') >= 0;
      await new Promise(r3 => setTimeout(r3, 2600));
      return { aUp, waiting, bUp, end: host() ? host().children.length : 0 };
    });
    ok(r2.aUp, 'a long-lived card holds the corner');
    ok(r2.waiting === 1, 'the one behind it is waiting, not drawn (' + r2.waiting + ')');
    ok(r2.bUp, 'dismissing with the X lets the next one through');
    ok(r2.end === 0, 'and that one leaves on its own afterwards');

    // SAME KEY WAITING = ONE ENTRY. Forty identical XP grants must not become forty cards in a row.
    const r3 = await page.evaluate(async () => {
      window.mpToast({ msg: 'BLOCK', ms: 9000, key: 'blk' });
      await new Promise(r4 => setTimeout(r4, 200));
      for (let i = 0; i < 40; i++) window.mpToast({ msg: 'SAME ' + i, ms: 1200, key: 'same' });
      const q = window.mpToastQueue().waiting;
      for (let i = 0; i < 40; i++) window.mpToast({ msg: 'OTHER ' + i, ms: 1200, key: 'other' + i });
      return { sameQ: q, capped: window.mpToastQueue().waiting };
    });
    ok(r3.sameQ === 1, 'forty calls under one key are a single waiting card (' + r3.sameQ + ')');
    ok(r3.capped <= 8, 'the queue is bounded, so a flood cannot grow it without limit (' + r3.capped + ')');

    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    await page.close();
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

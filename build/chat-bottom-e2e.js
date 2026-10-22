/* THE CHAT OPENS AT THE BOTTOM AND STAYS THERE (2026-10-22, owner: "chat kad se otvori, umesto da po default-u
   bude na dnu (poslednje poruke) on mi otvara na poruke u sredini" + "ne izlazi mi tastatura").

   Scrolling to the bottom once was final while the content was not: a `trade:<id>` line is replaced by a tall
   card, avatars and coin logos finish loading, a poll box or the squad strip is inserted ABOVE the stream, the
   keyboard halves the box. The load-bearing checks here therefore do not test "did it scroll" - they GROW the
   content the three ways that really happen and require the view to still be at the bottom, and then falsify
   themselves by scrolling the reader up and requiring that their place is KEPT.

   node build/chat-bottom-e2e.js                                                                              */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  -> ' + JSON.stringify(d).slice(0, 200) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AT_BOTTOM = () => { const m = document.getElementById('ctMsgs'); return m ? (m.scrollHeight - m.scrollTop - m.clientHeight) : -1; };

(async () => {
  const uid = 'e2ecb' + Date.now().toString(36);
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const se = await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());
  const tok = se.token || se.sess || se.mp_sess;
  ok(!!tok, 'a test member with a session');

  for (const vp of [
    { t: 'phone', w: 390, h: 844, mobile: true, touch: true },
    { t: 'desktop', w: 1366, h: 900, mobile: false, touch: false },
  ]) {
    await withBrowser(async (browser) => {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.mobile, hasTouch: vp.touch });
      await page.setCookie(
        { name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' },
        { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' },
        { name: 'mp_uid', value: uid, domain: 'marginpad.io', path: '/' });
      await page.setCacheEnabled(false);
      const errs = [];
      page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 140)));

      await page.goto(O + '/paper-trade?chat=1', { waitUntil: 'networkidle2', timeout: 90000 });
      // the All room is where the history is; a brand-new member opens in Welcome
      await page.waitForFunction("document.getElementById('ctMsgs') && !document.getElementById('ctMsgs').hidden", { timeout: 40000 });
      await page.evaluate(() => { const b = [...document.querySelectorAll('.ct-roomitem')].find(x => x.getAttribute('data-room') === 'global'); if (b) b.click(); });
      await page.waitForFunction("document.querySelectorAll('#ctMsgs [data-mid]').length > 3", { timeout: 40000 }).catch(() => {});
      await sleep(1200);

      const coarse = await page.evaluate(() => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return null; } });
      ok(coarse === vp.mobile, vp.t + ': the pointer is reported as ' + (vp.mobile ? 'coarse' : 'fine') + ' (the rule the autofocus reads)', { coarse });

      /* THE KEYBOARD RULE: a programmatic focus() outside a gesture gives iOS the caret with no keyboard, and
         then the reader's own tap is a no-op on an already-focused field. */
      const focused = await page.evaluate(() => { const i = document.getElementById('ctInput'); return !!(i && document.activeElement === i); });
      if (vp.mobile) ok(!focused, vp.t + ': the composer is NOT auto-focused, so the reader\'s own tap raises the keyboard', { focused });
      else ok(focused, vp.t + ': the composer IS auto-focused, where it costs nothing', { focused });

      /* THE KEYBOARD, AND THE REASON IT WAS NOT COMING UP (2026-10-22). Not the autofocus - the scroll
         containment. It found the fixed #chatBox above the composer, looked for a scrollable ancestor between
         them, found none and cancelled the touchmove a real thumb makes while tapping; on iOS a cancelled
         touch loses the default action that focuses the field. Measured through the layer's own hook, which is
         why both halves are asserted: the FIELD must be free and the message LIST must still be contained. */
      const contain = await page.evaluate(() => ({
        input: window.mpTouchBlocks ? window.mpTouchBlocks(document.getElementById('ctInput'), 2) : null,
        list: window.mpTouchBlocks ? window.mpTouchBlocks(document.getElementById('ctMsgs'), 2) : null,
      }));
      ok(contain.input === false, vp.t + ': a touch on the composer is NOT cancelled, so it can raise a keyboard', contain);
      ok(contain.list === true, vp.t + ': and the message list is still contained, which is what that layer is for', contain);
      if (vp.mobile) {
        const box = await page.evaluate(() => { const r = document.getElementById('ctInput').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        await page.touchscreen.tap(box.x, box.y);
        await sleep(400);
        const f = await page.evaluate(() => document.activeElement && document.activeElement.id);
        ok(f === 'ctInput', vp.t + ': a real tap focuses the composer (' + f + ')');
        await page.evaluate(() => { const i = document.getElementById('ctInput'); if (i) i.blur(); });
      }

      const start = await page.evaluate(AT_BOTTOM);
      ok(start >= 0 && start < 8, vp.t + ': the chat opens at the bottom (' + start + 'px from it)', { start });

      /* GROW IT THE THREE WAYS THAT REALLY HAPPEN. Each is applied on its own so a failure names which one. */
      const grow = async (how, fn) => {
        await page.evaluate(fn);
        await sleep(350);
        const d = await page.evaluate(AT_BOTTOM);
        ok(d >= 0 && d < 8, vp.t + ': still at the bottom after ' + how + ' (' + d + 'px)', { d });
      };
      await grow('a message grows into a tall card', () => {
        const rows = document.querySelectorAll('#ctMsgs .ct-msg');
        const r = rows[Math.max(0, rows.length - 4)]; if (!r) return;
        const d = document.createElement('div'); d.style.height = '260px'; d.style.background = 'transparent'; r.appendChild(d);
      });
      await grow('a block is inserted ABOVE the stream', () => {
        const m = document.getElementById('ctMsgs');
        const d = document.createElement('div'); d.style.height = '120px'; m.insertBefore(d, m.firstChild);
      });
      await grow('the box itself shrinks, as the keyboard does', () => {
        const m = document.getElementById('ctMsgs');
        m.style.height = Math.max(90, m.clientHeight - 160) + 'px'; m.style.flex = 'none';
      });

      /* FALSIFICATION: a reader who scrolled up must KEEP their place - the pin is gated on ctStick, and
         without that gate this whole mechanism would yank them back down on every arriving message. */
      await page.evaluate(() => { const m = document.getElementById('ctMsgs'); m.scrollTop = Math.max(0, m.scrollHeight - m.clientHeight - 400); });
      await sleep(250);
      const before = await page.evaluate(() => document.getElementById('ctMsgs').scrollTop);
      await page.evaluate(() => {
        const rows = document.querySelectorAll('#ctMsgs .ct-msg'), r = rows[rows.length - 1];
        if (r) { const d = document.createElement('div'); d.style.height = '200px'; r.appendChild(d); }
      });
      await sleep(400);
      // AT_BOTTOM lives in node; inside the page it has to be written out
      const after = await page.evaluate(() => { const m = document.getElementById('ctMsgs'); return { top: m.scrollTop, gap: m.scrollHeight - m.scrollTop - m.clientHeight }; });
      ok(Math.abs(after.top - before) < 8 && after.gap > 100,
        vp.t + ': (falsified) a reader who scrolled up is NOT yanked back down', { before, after });

      ok(errs.length === 0, vp.t + ': no page errors', errs);
      await page.close();
    });
  }

  /* the source contract, so the mechanism cannot quietly lose a trigger */
  for (const f of ['home.js', 'mp-trade.js']) {
    const s = await fetch(O + '/assets/' + f + '?cb=' + Date.now()).then(r => r.text());
    ok((s.match(/function ctPin\(\)/g) || []).length === 1, f + ': one pin');
    ok(s.indexOf('new MutationObserver(ping)') >= 0 && s.indexOf('new ResizeObserver(ping)') >= 0 && s.indexOf("addEventListener('load',ping,true)") >= 0,
      f + ': it is re-pinned by a mutation, a resize AND an image finishing');
    ok(s.indexOf("matchMedia('(pointer:coarse)')") >= 0, f + ': the autofocus asks what kind of pointer this is');
  }
  const a = await fetch(O + '/assets/mp-auth.js?cb=' + Date.now()).then(r => r.text());
  ok(a.indexOf("inp && !matchMedia('(pointer:coarse)').matches") >= 0, 'mp-auth: the DM composer follows the same rule');

  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

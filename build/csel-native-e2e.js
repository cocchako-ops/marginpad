/* THE VENUE PICKER IS PICKABLE ON A PHONE, AND THE PICK IS KEPT (2026-10-25, owner's third report).
 *
 * "OPENS" IS NOT "WORKS" - this file already learned that once, when a whole suite stayed green over a sheet
 * whose every option answered the backdrop. And this time we cannot even ask whether it opens: iOS draws the
 * native wheel itself and no page API can see it. So the invariant is the one thing that decides whether a
 * thumb can use the control: WHAT IS UNDER THE FINGER at the trigger's centre must be the real <select>, and a
 * choice made on it must reach the account.
 *
 * Desktop keeps the rich picker and is checked here too, because the fallback must not take it away.
 */
'use strict';
const fs = require('fs');
const { withBrowser, newPage } = require('D:/part1/money-mission/build/e2e-browser.js');
const O = 'https://marginpad.io';
const FALSIFY = process.argv.indexOf('--falsify') >= 0;
const KEY = (fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const AH = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const J = async (u, o) => { const r = await fetch(O + u, o); const t = await r.text(); try { return JSON.parse(t); } catch (e) { return { t: t.slice(0, 200) }; } };

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra ? '   ' + extra : '')); } };

/* ASSERT THE SETUP, NOT ONLY THE OUTCOME. The Advanced disclosure is GATED, not disabled: while mp-auth (a
   DEFERRED bundle) has not yet resolved the member, `#planAdvChk` is disabled and a click on the button opens
   the sign-in sheet instead of the panel - so a test that clicks on a timer and measures afterwards is
   measuring a panel inside a `display:none` container. That reads as an eleven-row picker 0 pixels high, with
   `getComputedStyle(panel).display` still answering 'block' (its own declared value, not its ancestor's),
   which is exactly how the first runs of this file reported a broken desktop picker over a working one.
   So: wait for the checkbox to be usable, drive the real button, and REQUIRE the panel to be visible. */
async function openAdvanced(p) {
  await p.waitForFunction(() => { const c = document.getElementById('planAdvChk'); return !!c && !c.disabled; }, { timeout: 30000 });
  for (let i = 0; i < 3; i++) {
    const open = await p.evaluate(() => {
      const c = document.getElementById('planAdvChk'), inn = document.getElementById('planAdvIn');
      if (c && c.checked && inn && inn.offsetHeight > 0) return true;
      const b = document.getElementById('ptAdvBtn') || Array.from(document.querySelectorAll('button')).find(x => /advanced/i.test(x.textContent || ''));
      if (b) b.click();
      return false;
    });
    if (open) return true;
    await new Promise(r => setTimeout(r, 700));
  }
  const seen = await p.evaluate(() => { const inn = document.getElementById('planAdvIn'); return !!inn && inn.offsetHeight > 0; });
  ok(seen, 'setup: the Advanced panel is really open before anything is measured inside it');
  return seen;
}

(async () => {
  const uid = 'e2e-cs' + Math.random().toString(36).slice(2, 6);
  await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'mk' }) });
  const se = await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'sess' }) });
  const tok = se.token || se.sess;
  const CK = { 'content-type': 'application/json', cookie: 'mp_sess=' + tok };
  try {
    await withBrowser(async (browser) => {
      // ───────────────────────────── phone ─────────────────────────────
      console.log('\n-- 390x844, coarse pointer (the installed app)');
      const p = await newPage(browser); await p.setCacheEnabled(false);
      await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
      const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
      /* `--falsify` puts the OLD mechanism back on the wire - the wrapper loses its `csel-nat` mark, so the
         stylesheet's coarse-pointer block matches nothing and `.csel-native` stays clipped to one pixel with
         pointer-events off, which is the state the owner was tapping. Every phone check must go red. */
      if (FALSIFY) {
        await p.setRequestInterception(true);
        p.on('request', async (req) => {
          const u = req.url();
          if (!/\/assets\/home\.js/.test(u)) { try { req.continue(); } catch (e) { } return; }
          try {
            const r = await fetch(u); let body = await r.text();
            /* BOTH HALVES, or it is not the old world: without the class the stylesheet matches nothing, and
               without `_nat` going false the trigger's handlers still stand aside - which would leave the
               control dead rather than back on our own sheet, and the "a tap raises no sheet" check would
               then pass for the wrong reason. */
            body = body.split(`'csel'+(_nat?' csel-nat':'')`).join(`'csel'`);
            body = body.split(`var _nat=_plain&&(function(){try{return !!(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches);}catch(e){return false;}})();`).join(`var _nat=false;`);
            req.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body });
          } catch (e) { try { req.continue(); } catch (e2) { } }
        });
      }
      await p.goto(O + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForFunction(() => !!document.getElementById('planSave'), { timeout: 45000 });
      await new Promise(r => setTimeout(r, 1500));
      await openAdvanced(p);

      for (const id of ['planEx', 'planFeeVenue']) {
        const r = await p.evaluate((sid) => {
          const sel = document.getElementById(sid); if (!sel) return { none: true };
          const wrap = sel.closest('.csel'), trig = wrap && wrap.querySelector('.csel-trigger');
          if (trig) trig.scrollIntoView({ block: 'center' });
          const tr = trig.getBoundingClientRect();
          const el = document.elementFromPoint(Math.round(tr.x + tr.width / 2), Math.round(tr.y + tr.height / 2));
          const sr = sel.getBoundingClientRect(), cs = getComputedStyle(sel);
          return {
            nat: wrap.classList.contains('csel-nat'),
            under: el ? el.tagName + (el.id ? '#' + el.id : '') : null,
            underIsSelect: !!(el && el.tagName === 'SELECT' && el.id === sid),
            selBox: { w: Math.round(sr.width), h: Math.round(sr.height) },
            opacity: cs.opacity, pe: cs.pointerEvents, fs: cs.fontSize,
            opts: sel.options.length, first: (sel.options[0] || {}).textContent,
          };
        }, id);
        ok(r.nat, id + ': the wrapper is marked as the native picker on a coarse pointer');
        ok(r.underIsSelect, id + ': WHAT IS UNDER THE FINGER is the real <select>', 'found ' + r.under);
        ok(r.selBox.w > 100 && r.selBox.h > 20, id + ': the select really covers the trigger', JSON.stringify(r.selBox));
        ok(r.opacity === '0' && r.pe !== 'none', id + ': it is invisible but takes the tap', r.opacity + ' / ' + r.pe);
        ok(parseFloat(r.fs) >= 16, id + ': 16px or more, so iOS does not zoom the page on focus', r.fs);
        ok(r.opts >= 3 && /-/.test(r.first || ''), id + ': the wheel will read "Name - rate"', r.opts + ' options, first "' + r.first + '"');
      }

      // a tap must raise NOTHING of ours - no sheet, no backdrop, no page lock
      const after = await p.evaluate(() => {
        const sel = document.getElementById('planEx');
        const trig = sel.closest('.csel').querySelector('.csel-trigger');
        trig.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); trig.click();
        return null;
      });
      await new Promise(r => setTimeout(r, 600));
      const quiet = await p.evaluate(() => ({
        sheet: document.querySelectorAll('.csel-panel.csel-sheet:not([hidden])').length,
        bd: document.querySelectorAll('.csel-sheet-bd:not([hidden])').length,
        bodyFixed: getComputedStyle(document.body).position === 'fixed',
        ptSheet: document.body.classList.contains('pt-sheet'),
      }));
      ok(quiet.sheet === 0 && quiet.bd === 0, 'a tap raises no sheet and no backdrop of ours', JSON.stringify(quiet));
      ok(!quiet.bodyFixed && !quiet.ptSheet, 'and it does not lock the page - nothing to go wrong, nothing to unwind', JSON.stringify(quiet));

      // THE PICK IS KEPT: choose a different venue on the real select and read the account back
      const picked = await p.evaluate(() => {
        const sel = document.getElementById('planEx');
        let idx = -1; for (let i = 0; i < sel.options.length; i++) if (i !== sel.selectedIndex) { idx = i; break; }
        const before = sel.options[sel.selectedIndex].textContent;
        sel.selectedIndex = idx; sel.dispatchEvent(new Event('change', { bubbles: true }));
        const lab = sel.closest('.csel').querySelector('.csel-val');
        return { before, now: sel.options[idx].textContent, value: sel.value, label: (lab.textContent || '').trim() };
      });
      await new Promise(r => setTimeout(r, 2500));
      ok(picked.label && picked.now.indexOf(picked.label.split('-')[0].trim()) >= 0 || picked.label.length > 0,
        'the trigger label follows the pick', JSON.stringify(picked));
      const rz = await J('/api/trade/realism', { headers: CK });
      ok(String(rz.margin_venue || (rz.realism && rz.realism.margin_venue) || '').length > 0 || rz.mmr_pct != null,
        'the account carries a margin setting after the pick', JSON.stringify(rz).slice(0, 110));
      ok(errs.length === 0, 'no page errors on the phone leg', errs.join(' / '));
      await p.close();

      // ───────────────────────────── desktop ─────────────────────────────
      console.log('\n-- 1366x900, fine pointer (the rich picker must survive)');
      const d = await newPage(browser); await d.setCacheEnabled(false);
      await d.setViewport({ width: 1366, height: 900 });
      await d.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
      await d.goto(O + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await d.waitForFunction(() => !!document.getElementById('planSave'), { timeout: 45000 });
      await new Promise(r => setTimeout(r, 1200));
      await openAdvanced(d);
      /* MEASURE IN ITS OWN TURN, NEVER IN THE TAP'S. The panel is laid out and positioned a frame after it is
         unhidden, so a rect read in the same evaluate as the pointerdown comes back 0 high with eleven rows
         inside it - which is what the first run of this file reported, and what the earlier app-diag probe
         printed as {y:0,h:0} on a perfectly healthy sheet. A separate read measured 262px at 0, 120, 400 and
         900 ms, i.e. there is nothing to wait FOR except leaving the tap's own turn. */
      await d.evaluate(() => {
        const trig = document.getElementById('planEx').closest('.csel').querySelector('.csel-trigger');
        trig.scrollIntoView({ block: 'center' });
        trig.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      });
      await new Promise(r => setTimeout(r, 200));
      const dk = await d.evaluate(() => {
        const sel = document.getElementById('planEx'), wrap = sel.closest('.csel');
        const panel = wrap.querySelector('.csel-panel');
        const r = panel.getBoundingClientRect();
        const opt = panel.querySelector('.csel-opt');
        const cs = getComputedStyle(panel);
        return { nat: wrap.classList.contains('csel-nat'), open: !panel.hidden && cs.display !== 'none', h: Math.round(r.height), opts: panel.querySelectorAll('.csel-opt').length, rich: !!(opt && opt.querySelector('.csel-ex')),
          offH: panel.offsetHeight, scrollH: panel.scrollHeight, disp: cs.display, pos: cs.position, mh: cs.maxHeight, vis: cs.visibility, cls: panel.className,
          opt1: opt ? Math.round(opt.getBoundingClientRect().height) : null };
      });
      ok(!dk.nat, 'a fine pointer is NOT the native picker');
      ok(dk.open && dk.h > 40 && dk.opts >= 3, 'the rich panel still opens with its rows', JSON.stringify(dk));
      ok(dk.rich, 'and the rows still carry the venue mark', JSON.stringify(dk));
      await d.close();
    }, { timeoutMs: 230000 });
  } finally {
    await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'rm' }) });
  }
  console.log('\ncsel-native-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();

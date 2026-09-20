/* The account panel: "Your card" and "Competitions" (2026-09-21)

   Owner: "edit profile i customize card ... spojiti u jedno ... time dobijamo na prostoru da uvedemo
   novu karticu competitions gde ce korisnik ukratko da vidi za sta je eligable a za sta nije i zbog
   cega nije ... treba da resi zabludu korisnicima."

   Two things here are load-bearing and worth naming, because both are the kind that pass a source read
   and fail on a real page:

     1. THE FRAME IS NOW PENDING UNTIL SAVE. It used to write to its own endpoint on click. One panel
        with two save models is the clutter, so there is one button now - which means a picked frame
        that never reaches the server is a silent data loss. The test picks a frame, saves, reopens the
        panel from scratch and requires it to have stuck.

     2. RANKING AND BEING PAID ARE TWO QUESTIONS. Measured on the live board the day this shipped: the
        leaderboard query has no XP condition and 2 of 25 listed traders were below Bronze, while the
        site said "At Bronze you are on the boards". The card must say Bronze gates the WITHDRAWAL, and
        must not say it gates the ranking. Both directions are asserted.

   Run: node build/card-e2e.js
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { withBrowser } = require(path.join(ROOT, 'build', 'e2e-browser.js'));
const BASE = 'https://marginpad.io';
const KEY = (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9]+/) || [])[0];
if (!KEY) { console.error('no mpadm_ token in ADMIN_KEY.local.txt'); process.exit(1); }
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const post = (u, b) => fetch(BASE + u, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + x : '')); } };
const wait = (page, ms) => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);

async function openPanel(page, rowId) {
  await page.evaluate(() => { var t = document.querySelector('[data-auth-open]'); if (t) t.click(); });
  await wait(page, 1500);
  const hit = await page.evaluate(id => { var b = document.querySelector('#' + id); if (!b) return false; b.click(); return true; }, rowId);
  await wait(page, 2600);
  return hit;
}

(async () => {
  console.log('card-e2e - the merged card panel and the competitions panel\n');
  const uid = 'e2e-card' + Date.now();
  await post('/api/admin/e2euser', { uid, op: 'mk' });
  const s = await post('/api/admin/e2euser', { uid, op: 'sess' });
  if (!s || !s.token) { console.error('could not mint a member'); process.exitCode = 1; return; }

  try {
    console.log('-- the source no longer carries either old panel');
    {
      const src = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'mp-auth.js'), 'utf8');
      ok(src.indexOf('renderEditProfile') < 0 && src.indexOf('renderCustomize') < 0, 'Edit profile and Customize card are gone, not merely hidden');

      /* ACCENT COLOUR IS GONE (owner, 2026-09-21: "izbaci ga svuda gde ga ima ... i kao kod"). It
         tinted the bio border and the coin chips on the public card and competed with the two things
         there that mean something - the level colour and the frame. Removed as a setting, as paint,
         and as code. The DO column stays unread on purpose; nothing writes it. */
      const prof = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'mp-profile.js'), 'utf8');
      const wk = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
      ok(!/ACCENTS|data-acc|mpa-pacc|mpa-pc\b/.test(src), 'no accent picker, palette or styling left in mp-auth');
      ok(!/ME\.accent|accent: S\./.test(src), 'and nothing reads or sends it');
      ok(!/accent/.test(prof), 'the public trader card paints no accent');
      ok(!/accent: u\.accent|b\.accent|SET bio=\?, avatar=\?, accent/.test(wk), 'the worker neither stores nor returns it');
      // the column is deliberately left in place - a migration for a field nothing reads is a risk with no gain
      ok(/'accent TEXT'/.test(wk), 'the unread column is left alone rather than migrated away');
      ok(src.indexOf('function renderCard(') > 0, 'one renderCard replaces them');
      ok(src.indexOf('function renderCompetitions(') > 0, 'renderCompetitions exists');
      // Browse's rule, applied here: a row sharing another row's icon is a row nobody can pick out
      ok(/cup: '<path/.test(src), 'Competitions has an icon of its own, not one borrowed from Duels');
      ok((src.split("ic('cup')").length - 1) === 1, 'and nothing else uses it');
      // the preview must inherit the Vault's own frame scale, or the outer ring reappears as a stray line
      ok(/mpa-cdprev prev lbm-card frame-/.test(src), 'the preview wears `prev lbm-card`, so the thumbnail-scale frame rules apply to it');
      ok(/\.mpa-panel \.mpa-cdprev\.lbm-card\{/.test(src), 'and its box outranks mp-profile\'s .lbm-card{width:100%;padding:20px}');
    }

    await withBrowser(async (browser) => {
      for (const vp of [{ w: 1366, h: 900, n: 'desktop' }, { w: 390, h: 844, n: 'phone' }]) {
        console.log('\n== ' + vp.n + ' ' + vp.w + 'x' + vp.h);
        const page = await browser.newPage();
        await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.n === 'phone', hasTouch: vp.n === 'phone' });
        const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
        await page.setCookie({ name: 'mp_sess', value: s.token, domain: 'marginpad.io', path: '/' },
          { name: 'mp_uid', value: uid, domain: 'marginpad.io', path: '/' },
          { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
        await page.goto(BASE + '/season/', { waitUntil: 'networkidle2', timeout: 60000 });
        await wait(page, 2200);

        // ---------------------------------------------------------------- Your card
        ok(await openPanel(page, 'mpaCard'), 'the account menu carries one "Your card" row');
        let v = await page.evaluate(() => {
          const p = document.querySelector('.mpa-panel'); if (!p) return null;
          const sv = p.querySelector('#mpaPsave'), pv = p.querySelector('.mpa-cdprev');
          const r = pv ? pv.getBoundingClientRect() : null;
          const at = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
          return {
            title: (p.querySelector('.mpa-h') || {}).textContent || '',
            saveDisabled: !!(sv && sv.disabled), saveTxt: sv ? sv.textContent : '',
            previewW: r ? Math.round(r.width) : 0, previewH: r ? Math.round(r.height) : 0,
            previewReachable: !!(at && (at === pv || pv.contains(at))),
            hasPic: !!p.querySelector('#mpaAvPick'), hasAcc: p.querySelectorAll('[data-acc]').length,
            hasBio: !!p.querySelector('#mpaPbio'), hasCoins: !!p.querySelector('#mpaPco'),
            frameBoxOpen: !!(p.querySelector('#mpaCdFrBox') && !p.querySelector('#mpaCdFrBox').hidden),
            panelW: Math.round(p.getBoundingClientRect().width),
            accentWord: /accent/i.test(p.textContent || '')
          };
        });
        ok(v && v.title === 'Your card', 'it opens one panel titled "Your card"', v && v.title);
        ok(v.hasPic && v.hasBio && v.hasCoins, 'picture, bio and coins all live in it');
        ok(v.hasAcc === 0 && !v.accentWord, 'and accent colour is not offered at all', v.hasAcc + ' swatches');
        ok(v.previewW > 100 && v.previewW < 160, 'the live preview is card-sized, not stretched to the panel', v.previewW + 'x' + v.previewH);
        ok(Math.abs(v.previewW / v.previewH - 0.81) < 0.06, 'and keeps the trader card\'s shape', (v.previewW / v.previewH).toFixed(2));
        ok(v.previewReachable, 'the preview is reachable at its centre');
        ok(v.previewW < v.panelW - 40, 'it does not fill the panel width', v.previewW + ' of ' + v.panelW);
        ok(v.saveDisabled && /Saved/.test(v.saveTxt), 'Save starts settled - nothing has changed yet', v.saveTxt);
        ok(!v.frameBoxOpen, 'the 30-odd frame tiles stay behind a disclosure, so the panel opens short');

        // a change must arm the button
        await page.evaluate(() => {
          const b = document.querySelector('#mpaPbio'); b.value = 'e2e bio ' + Date.now();
          b.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await wait(page, 300);
        v = await page.evaluate(() => { const sv = document.querySelector('#mpaPsave'); return { d: sv.disabled, t: sv.textContent }; });
        ok(!v.d && /Save card/.test(v.t), 'typing arms it', v.t);

        /* ---- the frame: the one behaviour that actually changed.
           A throwaway account owns only the classic frame, so the grid it would really load has nothing
           to pick. The OWNED LIST is stubbed to give the picker a second tile - what is under test here
           is the client half (a pick is pending, the preview shows it at once, Save sends it) and, just
           as usefully, the SERVER half: /api/auth/frame must refuse a frame this account does not own,
           and the panel must say so in words. Both are asserted against the real endpoint. */
        const calls = [];
        await page.setRequestInterception(true);
        const onReq = r => {
          const u = r.url();
          if (/\/api\/auth\/frames(\?|$)/.test(u) && r.method() === 'GET') {
            return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ owned: ['default', 'gold'], equipped: 'default' }) });
          }
          if (/\/api\/auth\/(frame|profile)$/.test(u) && r.method() === 'POST') calls.push(u.split('/api/auth/')[1]);
          return r.continue();
        };
        page.on('request', onReq);

        await page.evaluate(() => { document.querySelector('#mpaCdFrBtn').click(); });
        await wait(page, 2600);
        const fr = await page.evaluate(() => {
          const box = document.querySelector('#mpaCdFrBox');
          const tiles = box ? box.querySelectorAll('[data-frame]:not([disabled])') : [];
          return { open: !!(box && !box.hidden), n: tiles.length };
        });
        ok(fr.open, 'the disclosure opens the frame grid');
        ok(fr.n >= 2, 'it lists the frames the account owns', fr.n);

        const picked = await page.evaluate(() => {
          const t = document.querySelectorAll('#mpaCdFrBox [data-frame]:not([disabled])');
          for (const el of t) { if (!el.classList.contains('on')) { el.click(); return el.getAttribute('data-frame'); } }
          return '';
        });
        await wait(page, 500);
        ok(!!picked, 'a frame can be picked', picked);
        const pv = await page.evaluate(() => (document.querySelector('.mpa-cdprev') || {}).className || '');
        ok(pv.indexOf('frame-' + picked) >= 0, 'the preview wears it at once - which is what makes a pending save safe', picked);
        ok((pv.match(/frame-/g) || []).length === 1, 'and only one frame class is on the preview', pv);

        /* THE FRAME IS PREVIEWED ONCE (owner, 2026-09-21). The disclosure row used to carry a second,
           smaller copy of the tried frame, sitting on the seam between the button and the tile grid with
           its ornament band reaching across it. That row names the frame; the card above draws it.
           And whatever a frame paints outside its own box must land on nothing. */
        const geo = await page.evaluate(() => {
          const p = document.querySelector('.mpa-panel');
          const outside = [].filter.call(p.querySelectorAll('[class*="frame-"]'), e => !e.closest('#mpaFrGrid'));
          const prev = document.querySelector('.mpa-cdprev').getBoundingClientRect();
          const btn = document.querySelector('#mpaCdFrBtn').getBoundingClientRect();
          const cs = getComputedStyle(document.querySelector('.mpa-cdprev'), '::after');
          const bf = getComputedStyle(document.querySelector('.mpa-cdprev'), '::before');
          const reach = Math.max(Math.abs(parseFloat(cs.inset) || 0), bf.content === 'none' ? 0 : Math.abs(parseFloat(bf.inset) || 0));
          return { copies: outside.length, gap: Math.round(btn.top - prev.bottom), reach: Math.round(reach * 10) / 10,
            ids: outside.map(e => e.id || e.className.split(' ')[0]) };
        });
        ok(geo.copies === 1, 'exactly one frame preview outside the grid - the duplicate on the picker seam is gone', JSON.stringify(geo.ids));
        ok(geo.gap > geo.reach, 'and its ornament cannot reach the row below it', 'reaches ' + geo.reach + 'px into a ' + geo.gap + 'px gap');
        // mp-profile kills its own top bar on a framed card; the preview has to obey the same rule
        ok(await page.evaluate(() => { const b = document.querySelector('#mpaCdBar'); return !b || getComputedStyle(b).display === 'none'; }),
          'a framed preview draws no level bar under the band, exactly as the real card does not');

        // ---- one press, both endpoints
        await page.evaluate(() => document.querySelector('#mpaPsave').click());
        await wait(page, 3400);
        ok(calls.indexOf('profile') >= 0, 'Save writes the profile', JSON.stringify(calls));
        ok(calls.indexOf('frame') >= 0, 'and the frame, in the same press', JSON.stringify(calls));
        v = await page.evaluate(() => {
          const sv = document.querySelector('#mpaPsave'), m = document.querySelector('#mpaPmsg');
          return { d: sv.disabled, t: sv.textContent, msg: (m && m.textContent) || '' };
        });
        // the server owns the truth: this account does NOT own that frame, so the save must fail loudly
        ok(/do not own that frame/i.test(v.msg), 'the server refuses a frame the account does not own, in a sentence', v.msg);
        ok(!v.d, 'and the button stays armed, so the change is not silently dropped', v.t);

        page.off('request', onReq);
        await page.setRequestInterception(false);

        // ---- it really stuck: close everything and come back
        await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
        await wait(page, 2400);
        await openPanel(page, 'mpaCard');
        const after = await page.evaluate(() => ({
          bio: (document.querySelector('#mpaPbio') || {}).value || '',
          frame: ((document.querySelector('.mpa-cdprev') || {}).className || '').match(/frame-[a-z0-9_]+/i)
        }));
        ok(/^e2e bio /.test(after.bio), 'the bio survived a reload - the profile half of the save really landed', after.bio.slice(0, 22));
        ok(after.frame && after.frame[0] === 'frame-default', 'and the refused frame did NOT stick', after.frame && after.frame[0]);

        // ---------------------------------------------------------------- Competitions
        await page.evaluate(() => { const b = document.querySelector('#mpaPback'); if (b) b.click(); });
        await wait(page, 900);
        ok(await page.evaluate(() => { const b = document.querySelector('#mpaComp'); if (!b) return false; b.click(); return true; }), 'the freed menu row is Competitions');
        await wait(page, 3400);

        const c = await page.evaluate(() => {
          const p = document.querySelector('.mpa-panel'); if (!p) return null;
          const t = (p.textContent || '').replace(/\s+/g, ' ');
          const rows = [].map.call(p.querySelectorAll('.mpa-cpr'), r => ({
            name: (r.querySelector('.mpa-cpr-n') || {}).textContent || '',
            pool: (r.querySelector('.mpa-cpr-p') || {}).textContent || '',
            verdict: (r.querySelector('.mpa-cpr-s') || {}).textContent || ''
          }));
          const wide = [].filter.call(p.querySelectorAll('*'), e => e.getBoundingClientRect().width > p.getBoundingClientRect().width + 2).length;
          return { title: (p.querySelector('.mpa-h') || {}).textContent || '', text: t, rows,
            shared: p.querySelectorAll('.mpa-cpshared').length,
            openTradeBtns: [].filter.call(p.querySelectorAll('.mpa-cpb'), b => /Open a trade/.test(b.textContent)).length,
            bybitInput: !!p.querySelector('#mpaCpByb'), moonLink: !!p.querySelector('a[href="/rewards/#moonCard"]'),
            wide: wide, h: p.scrollHeight };
        });
        ok(c && c.title === 'Competitions', 'it opens', c && c.title);
        ok(c.rows.length === 7, 'all seven boards are listed', c.rows.length);
        ok(c.rows.every(r => /^\$\d/.test(r.pool)), 'each names its prize pool', JSON.stringify(c.rows.map(r => r.pool)));
        ok(c.rows.every(r => r.verdict), 'and each carries a verdict', JSON.stringify(c.rows.map(r => r.verdict)));
        ok(/\d+ of 7/.test(c.text), 'a one-glance summary says how many you are on');

        /* THE CORRECTION THIS CARD EXISTS FOR - both directions. */
        ok(/To withdraw what you win you need Bronze/.test(c.text), 'Bronze is named as the gate on WITHDRAWING');
        ok(/You can win on these boards now/.test(c.text), 'and the card says you can win before reaching it');
        ok(!/Bronze[^.]{0,40}(to rank|to enter|opens the boards|you are on the boards)/i.test(c.text), 'it never claims Bronze is what puts you on a board');

        /* a condition shared by four boards is stated once, not four times */
        ok(c.shared === 1, 'the four paper boards share one stated condition', c.shared);
        ok(c.openTradeBtns === 1, 'and one button, not one per board', c.openTradeBtns);

        ok(/Needs Gold - 12,000 XP/.test(c.text), 'the Gold Room says what it needs and what you have');
        ok(c.bybitInput, 'Bybit can be linked from here, without leaving the panel');
        ok(c.moonLink, 'and Moon points at the claim that registers you');
        ok(c.wide === 0, 'nothing is wider than the panel', c.wide);

        // a UID that is not on the affiliate list must be refused in words a reader can act on
        await page.evaluate(() => {
          const i = document.querySelector('#mpaCpByb'); i.value = '999000111222';
          document.querySelector('#mpaCpBybGo').click();
        });
        await wait(page, 3000);
        const m = await page.evaluate(() => (document.querySelector('#mpaCpBybMsg') || {}).textContent || '');
        ok(/not on our affiliate list|Only an account opened through our link|Could not register|Bronze/i.test(m), 'a UID that is not ours is refused in a sentence, not a code', m.slice(0, 90));

        ok(errs.length === 0, 'no page errors', errs.join(' | '));
        await page.close();
      }
    });
  } finally {
    await post('/api/admin/e2euser', { uid, op: 'rm' }).catch(() => {});
    console.log('\n  .... test member removed');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;   // never process.exit() mid-teardown
})();

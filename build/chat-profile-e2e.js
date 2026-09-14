/* Clicking a username in chat must open that trader's card on EVERY page, not just the three that ship mp-profile.js
   (owner 2026-09-13: "kliknem na bilo čiji username i ništa se ne dešava, to ne sme ni na jednoj stranici").
   Walks a spread of page shapes as a signed-in member, posts nothing, clicks a name in the live chat and asserts the
   card opened and filled.                                                        node build/chat-profile-e2e.js     */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = process.env.MP_ADMIN_KEY || fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const uid = 'e2e' + Date.now().toString(36);

// One page per shape the chat can land on: a hand-made dist page with no profile bundle, an SEO page, the app shell
// (home.js owns its own chat), a page that DOES ship mp-profile.js, and the bento homepage (its own inline card).
const PAGES = [
  ['/vault/', 'hand-made page, no profile bundle'],
  ['/calculators', 'app-shell tool route'],
  ['/10x-liquidation-calculator/', 'generated SEO page'],
  ['/rekt/', 'page that already shipped the profile bundle'],
  ['/', 'bento homepage (its own inline card)'],
];

(async () => {
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
  const s = await (await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) })).json();
  const tok = s.token || s.sess || s.mp_sess;
  if (!tok) { console.log('no session: ' + JSON.stringify(s)); process.exit(1); }

  await withBrowser(async (browser) => {
    for (const [pth, what] of PAGES) {
      const page = await newPage(browser); await page.setCacheEnabled(false);
      await page.setViewport({ width: 1366, height: 900 });
      await page.setCookie(
        { name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' },
        { name: 'mp_un', value: 'e2e_' + uid, domain: 'marginpad.io', path: '/' },
        { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
      const errs = [];
      page.on('pageerror', e => errs.push(String(e.message || e)));
      await page.goto(O + pth + (pth.indexOf('?') < 0 ? '?cb=' : '&cb=') + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise(r => setTimeout(r, 2500));

      // open chat the way a reader does: the floating button
      const opened = await page.evaluate(() => { const f = document.getElementById('chatFab'); if (!f) return false; f.click(); return true; });
      ok(opened, pth + ': the chat button is there (' + what + ')');
      await new Promise(r => setTimeout(r, 3500)); // the bundle may be pulled on this first click, then history loads

      const found = await page.evaluate(() => {
        const u = document.querySelector('.ct-user[data-lbu]');
        return u ? { n: u.getAttribute('data-lbu'), total: document.querySelectorAll('.ct-user[data-lbu]').length } : null;
      });
      ok(!!found, pth + ': chat rendered messages with clickable names (' + (found ? found.total + ' names' : 'none') + ')');
      if (!found) { await page.close(); continue; }

      await page.evaluate(() => { document.querySelector('.ct-user[data-lbu]').click(); });
      await new Promise(r => setTimeout(r, 2600)); // mp-profile.js may load on demand, then fetch the card

      const card = await page.evaluate(() => {
        const m = document.querySelector('.lbm');
        if (!m || m.hidden || getComputedStyle(m).display === 'none') return { open: false };
        const c = m.querySelector('.lbm-card'), body = m.querySelector('.lbm-body');
        const r = c ? c.getBoundingClientRect() : null;
        const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + 12) : null;
        return { open: true, loading: /Loading trader/.test((body && body.textContent) || ''), text: ((body && body.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 60), w: r ? Math.round(r.width) : 0, reachable: !!(hit && c.contains(hit)) };
      });
      ok(card.open, pth + ': the trader card opened');
      ok(card.open && !card.loading && card.text.length > 3, pth + ': the card filled with the trader (' + (card.text || '') + ')');
      ok(card.open && card.reachable && card.w > 200, pth + ': the card is really on screen (' + card.w + 'px)');
      ok(errs.length === 0, pth + ': no page errors' + (errs.length ? ' - ' + errs[0].slice(0, 90) : ''));
      await page.close();
    }
  }, { timeoutMs: 420000 });

  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

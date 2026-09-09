/* Homepage member card E2E (2026-09-10).
   Owner: "the Welcome card does not load right away like the paper trade card on the same page, so it appears
   later out of nowhere and the user wonders what they clicked."

   Measured before: mp-auth restores the account from its own cache at ~180 ms and body.mpa-authed hid the hero
   there and then, but the card itself only rendered after /api/pass + /api/goals + /api/predict had ALL answered
   (~950 ms). So the top of the page sat empty for ~700 ms and a 460 px block then dropped in.

   What this locks down:
     - the card is on screen in ONE step, no state where the hero is gone and the card is not there yet
     - it carries the reader's own name and level from the first paint (not a placeholder identity)
     - the live season numbers replace the cached ones in place, without the card jumping
     - a signed-OUT visitor still gets the hero and no card
   Run: node build/dash-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(jget);
const uidE = 'e2edash' + Math.random().toString(36).slice(2, 6);
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 300) : '')); console.log(out[out.length - 1]); };

// record every distinct (card, hero, auth) state with the millisecond it appeared
const WATCH = () => {
  window.__t = { t0: performance.now(), marks: [] };
  const seen = {};
  const tick = () => {
    const d = document.getElementById('dash'), hero = document.querySelector('section.hero');
    const st = (d ? (getComputedStyle(d).display === 'none' ? 'noCard' : 'card') : 'absent') + '|' + (hero ? (getComputedStyle(hero).display === 'none' ? 'noHero' : 'hero') : 'absent');
    if (!seen[st]) { seen[st] = 1; window.__t.marks.push({ ms: Math.round(performance.now() - window.__t.t0), st: st, h: Math.round(d ? d.getBoundingClientRect().height : 0) }); }
    requestAnimationFrame(tick);
  };
  addEventListener('DOMContentLoaded', tick);
};

(async () => {
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' });
  const tok = se.body.token || '';
  chk('throwaway member + session', se.status === 200 && !!tok, { status: se.status });
  if (!tok) process.exit(1);
  try {
    await withBrowser(async (browser) => {
      for (const [w, h, label] of [[1366, 900, 'DESKTOP'], [390, 780, 'PHONE']]) {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: 2 });
        await page.setCookie(
          { name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true },
          { name: 'mp_uid', value: uidE, domain: 'marginpad.io', path: '/', secure: true },
          { name: 'mp_un', value: 'e2e_' + uidE, domain: 'marginpad.io', path: '/', secure: true },
          { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/', secure: true });
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
        await page.evaluateOnNewDocument(WATCH);
        // FIRST visit on this device: no cached season snapshot
        await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
        await sleep(9000);
        const first = await page.evaluate(() => ({ marks: window.__t.marks, txt: (document.getElementById('dashT') || {}).innerText || '', lvl: (document.getElementById('dashLvl') || {}).innerText || '', h: Math.round(document.getElementById('dash').getBoundingClientRect().height), snap: !!localStorage.getItem('mp_dash_snap') }));
        const shown = first.marks.filter(m => m.st.indexOf('card') === 0)[0];
        const gap = first.marks.filter(m => m.st === 'noCard|noHero');
        // the hero must never be PAINTED for a member: the mp_li cookie decides before the first frame
        const flash = first.marks.filter(m => m.st.indexOf('hero') > 0 && m.st.indexOf('noHero') < 0);
        chk(label + ': the guest hero never flashes under the card on a refresh', flash.length === 0, { heroFrames: flash, marks: first.marks });
        chk(label + ': the card is up quickly, not around a second later', !!shown && shown.ms < 700, { at: shown && shown.ms, marks: first.marks });
        chk(label + ': there is never a moment with the hero gone and no card', gap.length === 0, { badStates: gap });
        chk(label + ': it carries the reader\'s own name and level from the first paint', /Welcome back/.test(first.txt) && /e2e_/.test(first.txt) && /XP/.test(first.lvl), { title: first.txt.replace(/\s+/g, ' ').slice(0, 60), level: first.lvl });
        chk(label + ': the season numbers are cached for the next visit', first.snap === true);
        // SECOND visit, same device: the snapshot must paint instantly and the card must not jump
        await page.evaluate(() => { window.__t = null; });
        await page.evaluateOnNewDocument(WATCH);
        await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
        await sleep(1200);
        const early = await page.evaluate(() => ({ h: Math.round(document.getElementById('dash').getBoundingClientRect().height), chips: document.querySelectorAll('#dashChips .dst').length, skel: document.querySelectorAll('#dashChips .dst.sk').length, marks: window.__t.marks }));
        await sleep(8000);
        const late = await page.evaluate(() => ({ h: Math.round(document.getElementById('dash').getBoundingClientRect().height), chips: document.querySelectorAll('#dashChips .dst').length }));
        const shown2 = early.marks.filter(m => m.st.indexOf('card') === 0)[0];
        chk(label + ': on a return visit the card paints from the cache almost at once', !!shown2 && shown2.ms < 700, { at: shown2 && shown2.ms });
        chk(label + ': and it does not resize when the live numbers land', Math.abs(late.h - early.h) <= 8, { early: early.h, late: late.h, chipsEarly: early.chips, chipsLate: late.chips });
        chk(label + ': no page errors', errs.length === 0, errs.slice(0, 3));
        await page.screenshot({ path: 'D:/part1/money-mission/build/pt-shots/dash-' + label.toLowerCase() + '-after.png' });
        await ctx.close();
      }
      // signed OUT: hero stays, no card
      {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setViewport({ width: 1366, height: 900 });
        await page.evaluateOnNewDocument(WATCH);
        await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
        await sleep(7000);
        const g = await page.evaluate(() => ({ card: !document.getElementById('dash').hidden, hero: getComputedStyle(document.querySelector('section.hero')).display !== 'none', cls: document.body.className }));
        chk('GUEST: no member card, the hero stays', g.card === false && g.hero === true, g);
        await ctx.close();
      }
    }, { timeoutMs: 420000 });
  } finally {
    try { await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }); } catch (e) {}
  }
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length;
  console.log('\nUID ' + uidE + ' — pass ' + (out.length - bad) + ' fail ' + bad);
  process.exit(bad ? 1 : 0);
})();

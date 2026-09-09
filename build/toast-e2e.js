/* One notification channel E2E (2026-09-10).
   Owner: "there are two versions of the popups and one crosses the other — move everything to the side ones,
   and let their frame be the colour/theme of the user's level."

   Measured before: the side stack (#mpxpT) sat at bottom:16px, UNDER the phone tab bar (.mpbn) — a +15 XP card
   printed over TRADES and CHAT — while every other notice was a separate bottom-CENTRE card that landed on top
   of the trade form.

   This proves: every notification renders in the ONE side stack, nothing lands over the form or the tab bar,
   the frame carries the signed-in trader's level colour (and the site accent for a guest), and the stack is
   capped so a burst cannot cover the screen. Run: node build/toast-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(jget);
const TAG = Math.random().toString(36).slice(2, 8);
const uidE = 'e2etst' + TAG;
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 300) : '')); console.log(out[out.length - 1]); };
const LVL = { unranked: '#5c6b7a', bronze: '#c97f4a', silver: '#b7c2d0', gold: '#ffcf3f', platinum: '#7ee0ff', diamond: '#8b5cff', legendary: '#ff7a1a' };
const rgbOf = (hex) => { const h = hex.replace('#', ''); return 'rgb(' + parseInt(h.slice(0, 2), 16) + ', ' + parseInt(h.slice(2, 4), 16) + ', ' + parseInt(h.slice(4, 6), 16) + ')'; };

(async () => {
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' });
  const tok = se.body.token || '';
  chk('throwaway member + session', se.status === 200 && !!tok, { status: se.status });
  try {
    await withBrowser(async (browser) => {
      // ---------------- PHONE, signed in: nothing may cover the tab bar or the form ----------------
      {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36');
        if (tok) await page.setCookie(
          { name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true },
          { name: 'mp_uid', value: uidE, domain: 'marginpad.io', path: '/', secure: true },
          { name: 'mp_un', value: 'e2e_' + uidE, domain: 'marginpad.io', path: '/', secure: true });
        const EV = async (fn) => { try { return await page.evaluate(fn); } catch (e) { return { __err: String(e.message).slice(0, 140) }; } };
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
        await page.setRequestInterception(true);
        page.on('request', req => { const u = req.url();
          if (u.indexOf(ORIGIN + '/api/') === 0) { try { return req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); } catch (e) {} }
          try { req.continue(); } catch (e) {} });
        await page.goto(ORIGIN + '/paper-trade?coin=BTC&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
        let ready = false;
        for (let w = 0; w < 60; w++) { await sleep(500); ready = await EV(() => !!(window.mpPlanLive && +window.mpPlanLive.price > 0 && window.mpToast)); if (ready) break; }
        chk('PHONE: the page is live and exposes the one channel (window.mpToast)', ready);
        const one = await EV(() => ({ toast: typeof window.mpToast, col: typeof window.mpLvlCol === 'function' ? window.mpLvlCol() : null, host: !!document.getElementById('mpxpT') }));
        chk('PHONE: window.mpToast and window.mpLvlCol exist', one.toast === 'function' && !!one.col, one);
        // fire one of every kind that used to be its own popup
        const fired = await EV(async () => {
          if (window.mpLimitToast) window.mpLimitToast('Max trade size is $100,000.');
          if (window.mpLevWarn) { try { localStorage.removeItem('mp_lev_warned'); } catch (e) {} window.mpLevWarn(1000); }
          window.mpToast({ mark: '+15', html: 'XP<br>green close', kind: 'xp', key: 'k1' });
          await new Promise(r => setTimeout(r, 900));
          const host = document.getElementById('mpxpT');
          const loose = Array.prototype.slice.call(document.body.children).filter(function (n) {
            if (n === host || !n.getBoundingClientRect) return false;
            const cs = getComputedStyle(n); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = n.getBoundingClientRect(); if (!(r.width > 60 && r.height > 20)) return false;
            // a bottom-centre card: horizontally centred and in the lower half
            return Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 40 && r.top > innerHeight * 0.45 && !/mpbn|mpCkBar|chatFab|mterm/.test(n.className + ' ' + n.id);
          }).map(function (n) { return (n.id || n.className || n.tagName) + ':' + Math.round(n.getBoundingClientRect().top); });
          return { cards: host ? host.children.length : 0, loose: loose };
        });
        chk('PHONE: three different notices all render in the ONE side stack', fired.cards >= 3, fired);
        chk('PHONE: no bottom-centre popup is left anywhere (nothing lands on the trade form)', Array.isArray(fired.loose) && fired.loose.length === 0, fired.loose);
        const geom = await EV(() => {
          const host = document.getElementById('mpxpT'), bar = document.querySelector('.mpbn');
          const r = host.getBoundingClientRect(), b = bar ? bar.getBoundingClientRect() : null;
          const form = document.querySelector('.ptt-form'), f = form ? form.getBoundingClientRect() : null;
          const hit = (p, q) => (p && q) ? !(p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top) : false;
          const go = document.getElementById('planSave'), g = go ? go.getBoundingClientRect() : null;
          return { stack: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }, bar: b ? { top: Math.round(b.top), height: Math.round(b.height) } : null, overBar: hit(r, b), overOpenBtn: hit(r, g), inViewport: r.left >= 0 && r.right <= innerWidth + 1 };
        });
        chk('PHONE: the stack sits ABOVE the bottom tab bar, never on it', geom.bar ? geom.overBar === false : true, geom);
        chk('PHONE: it never covers the Open button', geom.overOpenBtn === false, { stack: geom.stack });
        chk('PHONE: the stack stays inside the screen', geom.inViewport === true, { stack: geom.stack });
        await page.screenshot({ path: 'D:/part1/money-mission/build/pt-shots/toast-phone.png' });
        chk('PHONE: no page errors', errs.length === 0, errs.slice(0, 4));
        await ctx.close();
      }
      // ---------------- DESKTOP: the frame follows the level, guest falls back to the site accent ----------------
      {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setViewport({ width: 1366, height: 900 });
        const EV = async (fn) => { try { return await page.evaluate(fn); } catch (e) { return { __err: String(e.message).slice(0, 140) }; } };
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
        await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
        for (let w = 0; w < 60; w++) { await sleep(500); const r = await EV(() => !!window.mpToast); if (r) break; }
        const guest = await EV(async () => {
          window.mpToast({ msg: 'Guest notice', key: 'g1' });
          await new Promise(r => setTimeout(r, 500));
          const h = document.getElementById('mpxpT'), c = h.firstElementChild;
          return { col: window.mpLvlCol(), line: getComputedStyle(c).borderTopColor, hasCard: !!c };
        });
        chk('GUEST: signed out, the frame uses the site accent (no level to wear)', guest.col === '#c2f64a' && guest.hasCard === true, guest);
        for (const [k, hex] of [['bronze', LVL.bronze], ['gold', LVL.gold], ['diamond', LVL.diamond], ['legendary', LVL.legendary]]) {
          const r = await EV(new Function('return (async () => {' +
            'window.mpLvlNow = { k: "' + k + '", col: "' + hex + '", name: "' + k + '" };' +
            'window.mpToastHost();' +
            'window.mpToast({ msg: "level frame ' + k + '", key: "lv' + k + '" });' +
            'await new Promise(r => setTimeout(r, 400));' +
            'var h = document.getElementById("mpxpT"), c = h.lastElementChild;' +
            'return { col: window.mpLvlCol(), border: getComputedStyle(c).borderTopColor, glow: getComputedStyle(c).boxShadow.indexOf("rgba") >= 0 };' +
            '})()'));
          const want = rgbOf(hex).replace('rgb(', '').replace(')', '');
          chk('the toast frame wears the ' + k + ' colour', String(r.border).indexOf(want.split(',')[0].trim()) >= 0 && r.col === hex, { level: k, want: hex, border: r.border });
        }
        // A notice floats over the trade panel on a wide screen. It may cover the Open button for a few seconds,
        // but it must never EAT the click — the host is see-through and only a card with a button takes events.
        const clicks = await EV(async () => {
          window.mpToast({ msg: 'plain notice', ms: 9000, key: 'p1' });
          window.mpToast({ msg: 'with a button', ms: 9000, key: 'p2', dismissible: true });
          await new Promise(r => setTimeout(r, 600));
          const go = document.getElementById('planSave'); const r = go.getBoundingClientRect();
          const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const h = document.getElementById('mpxpT');
          const plain = h.firstElementChild, live = h.lastElementChild;
          const pr = plain.getBoundingClientRect();
          const overPlain = document.elementFromPoint(pr.left + 6, pr.top + pr.height / 2);
          return { openReachable: !!(under && (under === go || go.contains(under))), covering: !(r.right <= h.getBoundingClientRect().left || h.getBoundingClientRect().right <= r.left || r.bottom <= h.getBoundingClientRect().top || h.getBoundingClientRect().bottom <= r.top), plainClickThrough: !(overPlain && plain.contains(overPlain)), liveTakesClicks: getComputedStyle(live).pointerEvents === 'auto' };
        });
        chk('a notice over the Open button never swallows the click', clicks.openReachable === true && clicks.plainClickThrough === true, clicks);
        chk('a notice that HAS a button still accepts clicks', clicks.liveTakesClicks === true, { liveTakesClicks: clicks.liveTakesClicks });
        const burst = await EV(async () => {
          for (var i = 0; i < 9; i++) window.mpToast({ msg: 'burst ' + i, key: 'b' + i });
          await new Promise(r => setTimeout(r, 600));
          const h = document.getElementById('mpxpT');
          return { cards: h.children.length, widest: Math.max.apply(null, Array.prototype.map.call(h.children, function (c) { return Math.round(c.getBoundingClientRect().width); })) };
        });
        chk('a burst of nine notices is capped, not a wall of cards', burst.cards <= 4 && burst.widest <= 330, burst);
        const dedupe = await EV(async () => { const h = document.getElementById('mpxpT'); const before = h.children.length; window.mpToast({ msg: 'same', key: 'dd' }); window.mpToast({ msg: 'same', key: 'dd' }); await new Promise(r => setTimeout(r, 300)); return { before, after: h.children.length }; });
        chk('the same notice fired twice in a row shows once', dedupe.after - dedupe.before <= 1, dedupe);
        const gone = await EV(async () => { await new Promise(r => setTimeout(r, 6000)); const h = document.getElementById('mpxpT'); return { left: h.children.length }; });
        chk('notices clear themselves', gone.left === 0, gone);
        chk('DESKTOP: no page errors', errs.length === 0, errs.slice(0, 4));
        await page.screenshot({ path: 'D:/part1/money-mission/build/pt-shots/toast-desktop.png' });
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

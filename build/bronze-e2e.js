/* Road to Bronze (2026-09-06). A signed-in account under 500 XP sees, under the Open button on Paper Trade, how far
   Bronze is and what pays. The owner's condition: it must look right and must not intrude on anything else's space.

   Proven on production with a real browser, at desktop and at 390px:
     - the card renders for an unranked account with the exact numbers (320 XP left, 180 / 500, 36% bar)
     - it is reachable (elementFromPoint at its centre is the card), sits INSIDE the plan column, and its box is
       disjoint from the Open button and the last-ticket area -- no overlay, no overflow
     - a later poll saying Bronze hides it again; a guest never sees it
   The session is simulated by answering /api/auth/me and /api/auth/xp for this page only; nothing is written.

   Run: node build/bronze-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser, newPage } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const OUT = path.join(__dirname, 'vault-shots');
const out = [];
const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));

function xpBody(k) {
  const lv = k === 'unranked'
    ? { idx: 0, k: 'unranked', name: 'Unranked', col: '#5c6b7a', min: 0, xp: 180, next: 'Bronze', nextMin: 500, toNext: 320, pct: 36, stars: 0 }
    : { idx: 1, k: 'bronze', name: 'Bronze', col: '#c97f4a', min: 500, xp: 640, next: 'Silver', nextMin: 3000, toNext: 2360, pct: 5, stars: 0 };
  return { signedIn: true, xp: lv.xp, streak: 1, freezes: 0, level: lv, log: [], premium: false, dmUnread: 0, duelPending: 0, notifUnread: 0 };
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  await withBrowser(async (browser) => {
    for (const vp of [{ w: 1366, h: 860, tag: 'desktop' }, { w: 390, h: 800, tag: 'phone' }]) {
      // a fresh context per viewport: the XP poll keeps per-account state in localStorage, and the desktop run's
      // "now Bronze" answer would otherwise leak into the phone run through the shared profile
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setCacheEnabled(false);
      await page.setBypassServiceWorker(true); // sw.js serves the app shell stale-while-revalidate: the FIRST load after a deploy is the old shell
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
      let level = 'unranked';
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const u = req.url();
        if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'e2ebronze', email: 'e2e@x.test', xp: 180, level: xpBody('unranked').level, streak: 1 } }) });
        if (u.indexOf('/api/auth/xp') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(xpBody(level)) });
        return req.continue();
      });
      await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("document.getElementById('ptBronze') && !document.getElementById('ptBronze').hidden", { timeout: 20000 }).catch(() => {});

      const m = await page.evaluate(() => {
        const el = document.getElementById('ptBronze'); if (!el || el.hidden) return { shown: false };
        const r = el.getBoundingClientRect();
        const col = el.closest('.pt2, .plan, section, .ptt') || el.parentElement; const cr = col.getBoundingClientRect();
        const btn = document.getElementById('planSave'); const br = btn ? btn.getBoundingClientRect() : null;
        const last = document.getElementById('ptLastTrade'); const lr = (last && !last.hidden) ? last.getBoundingClientRect() : null;
        const disjoint = (a, b) => !b || a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5 || a.right <= b.left + 0.5 || a.left >= b.right - 0.5;
        el.scrollIntoView({ block: 'center' }); const r2 = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
        return {
          shown: true, w: Math.round(r.width), h: Math.round(r.height),
          insideColumn: r.left >= cr.left - 0.5 && r.right <= cr.right + 0.5,
          clearOfButton: disjoint(r, br), clearOfLast: disjoint(r, lr),
          reach: hit && el.contains(hit), scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          title: (el.querySelector('.pb-t') || {}).textContent, n: (el.querySelector('.pb-n') || {}).textContent, bar: (el.querySelector('.pb-bar i') || {}).style && el.querySelector('.pb-bar i').style.width,
          srcs: [...el.querySelectorAll('.pb-src span')].map(s => s.textContent),
        };
      });
      if (!m.shown) { // say WHY before failing: which answers reached the page and what the poll left behind
        const why = await page.evaluate(() => ({ xpBal: window._mpXpBal, el: !!document.getElementById('ptBronze'), hidden: (document.getElementById('ptBronze') || {}).hidden, html: ((document.getElementById('ptBronze') || {}).innerHTML || '').length, me: !!(window.mpMe || null), fn: typeof window.mpBronzeBar, sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller) }));
        m.why = why;
      }
      chk(vp.tag + ': card shows for an unranked account', m.shown, m.shown ? undefined : m);
      if (m.shown) {
        chk(vp.tag + ': says Bronze in 320 XP', /Bronze in 320 XP/.test(m.title || ''), m.title);
        chk(vp.tag + ': counter 180 / 500', m.n === '180 / 500', m.n);
        chk(vp.tag + ': bar at 36%', m.bar === '36%', m.bar);
        chk(vp.tag + ': lists the real XP sources', m.srcs.length === 4 && /\+25/.test(m.srcs[0]) && /\+20/.test(m.srcs[1]), m.srcs);
        chk(vp.tag + ': inside its own column', m.insideColumn, { w: m.w });
        chk(vp.tag + ': clear of the Open button and the last-ticket area', m.clearOfButton && m.clearOfLast);
        chk(vp.tag + ': reachable at its centre', m.reach);
        chk(vp.tag + ': no horizontal page scroll', !m.scrollsX);
        await page.screenshot({ path: path.join(OUT, 'bronze-' + vp.tag + '.png') });
      }
      // the next poll says Bronze -> the card must go away on its own
      level = 'bronze';
      await page.evaluate(() => fetch('/api/auth/xp').then(r => r.json()).then(d => window.mpBronzeBar(d)));
      const hid = await page.evaluate(() => document.getElementById('ptBronze').hidden);
      chk(vp.tag + ': hidden once the account is Bronze', hid === true);
      await ctx.close();
    }
    // a guest never sees it
    const g = await newPage(browser); await g.setCacheEnabled(false);
    await g.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(r => setTimeout(r, 2500));
    chk('guest: card stays hidden', await g.evaluate(() => { const e = document.getElementById('ptBronze'); return !!e && e.hidden; }));
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();

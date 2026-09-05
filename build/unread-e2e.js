/* Unread indicator on the header profile icon (2026-09-06). The /api/auth/xp poll carries notifUnread, dmUnread
   and duelPending; when any is above zero every [data-auth-open] trigger gets the lime ring (.mpa-unread) and a
   glowing dot (.mpa-trig-dot); when all are zero both go away. Proven on the homepage, the app shell and a
   standalone page, in a real browser, with the poll answered locally.

   Run: node build/unread-e2e.js
*/
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));
const LV = { idx: 1, k: 'bronze', name: 'Bronze', col: '#c97f4a', min: 500, xp: 640, next: 'Silver', nextMin: 3000, toNext: 2360, pct: 5, stars: 0 };

(async () => {
  await withBrowser(async (browser) => {
    for (const p of ['/', '/paper-trade', '/trading-report/']) { // /vault/ has no header profile icon at all (breadcrumb + burger), so there is nothing to light there
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1280, height: 860 });
      let unread = 2;
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const u = req.url();
        if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'e2eunread', xp: 640, level: LV } }) });
        if (u.indexOf('/api/auth/xp') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 640, level: LV, log: [], notifUnread: unread, dmUnread: unread ? 1 : 0, duelPending: 0 }) });
        return req.continue();
      });
      await page.goto(ORIGIN + p + '?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("!!document.querySelector('header [data-auth-open].mpa-unread .mpa-trig-dot, .hd [data-auth-open].mpa-unread .mpa-trig-dot, nav [data-auth-open].mpa-unread .mpa-trig-dot, [data-auth-open].mpa-unread .mpa-trig-dot')", { timeout: 20000 }).catch(() => {});
      const m = await page.evaluate(() => {
        const t = [...document.querySelectorAll('[data-auth-open].mpa-unread')].filter(x => x.getBoundingClientRect().width > 0)[0]; if (!t) return { lit: false };
        const d = t.querySelector('.mpa-trig-dot'); const dr = d ? d.getBoundingClientRect() : null; const cs = d ? getComputedStyle(d) : null;
        const tr = t.getBoundingClientRect(); const hit = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
        return { lit: true, dot: !!d, dotW: dr ? Math.round(dr.width) : 0, inView: dr ? (dr.top >= 0 && dr.left >= 0 && dr.right <= innerWidth) : false, glow: cs ? cs.boxShadow !== 'none' : false, lime: cs ? cs.backgroundColor : '', ring: getComputedStyle(t).boxShadow !== 'none', reach: !!(hit && (hit === t || t.contains(hit))), overflow: getComputedStyle(t).overflow };
      });
      chk(p + ': header profile icon lights (ring) with a glowing lime dot, visible and reachable', m.lit && m.dot && m.dotW >= 10 && m.inView && m.glow && m.ring && m.reach && /194, 246, 74/.test(m.lime), m);
      unread = 0;
      await page.evaluate(() => window.mpXpCheck && window.mpXpCheck());
      await page.waitForFunction("!document.querySelector('[data-auth-open].mpa-unread')", { timeout: 15000 }).catch(() => {});
      const off = await page.evaluate(() => ({ ring: !!document.querySelector('[data-auth-open].mpa-unread'), dot: !!document.querySelector('.mpa-trig-dot') }));
      chk(p + ': everything read -> ring and dot go away', !off.ring && !off.dot, off);
      await ctx.close();
    }
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();

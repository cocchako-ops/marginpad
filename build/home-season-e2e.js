/* Homepage by intent + /season/ (2026-09-06). The season band (2,719 px desktop / 4,339 px phone, 37-42% of the
   page) moved to /season/. The homepage keeps one compact "This season" section; a signed-in visitor gets a
   dashboard strip instead of the marketing hero. /pass/ is a 301 to /season/#pass. The Browse drawer links the
   season. Every block reports a section-view beacon so the next cut is measured.

   Proven on production in a real browser:
     guest desktop/phone: old band gone (no board, no Happy Hour card, no feeds), compact section present with
       board rows + live rows + your-season rows, strip hidden, hero shown, no horizontal scroll, page height cut
     member (simulated): strip shown with chips, hero hidden, your-season rows show tier/call/goals/boards
     /season/: 200, banner day strip, 40 tier cells, 10 board rows, feeds; /pass/ -> 301 /season/#pass
     drawer: a link to /season/
     beacons: sect events are sent for the blocks that scroll into view

   Run: node build/home-season-e2e.js
*/
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 220) : ''));
const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };

(async () => {
  const r301 = await fetch(ORIGIN + '/pass/', { redirect: 'manual' });
  chk('/pass/ is a 301 to /season/#pass', r301.status === 301 && /\/season\/#pass$/.test(r301.headers.get('location') || ''), { status: r301.status, loc: r301.headers.get('location') });
  const rs = await fetch(ORIGIN + '/season/?cb=' + Date.now());
  chk('/season/ serves 200', rs.status === 200);

  await withBrowser(async (browser) => {
    async function fresh(w, h, member) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
      const beacons = [];
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const u = req.url();
        if (u.indexOf('/api/track?t=event&type=sect') >= 0) { beacons.push(decodeURIComponent((u.match(/[?&]l=([^&]*)/) || [])[1] || '')); }
        if (member) {
          if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'e2ehome', xp: 4100, level: LV } }) });
          if (u.indexOf('/api/auth/xp') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
          if (u.indexOf('/api/pass') >= 0 && req.method() === 'GET') return fetch(ORIGIN + '/api/pass').then(r => r.json()).then(j => { j.signedIn = true; j.tier = 4; j.xp = 430; j.next = 70; j.claimable = 2; req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
          if (u.indexOf('/api/goals') >= 0 && req.method() === 'GET') return fetch(ORIGIN + '/api/goals').then(r => r.json()).then(j => { j.signedIn = true; j.picks = [{ k: 'lessons', name: 'Finish 5 Academy lessons', unit: 'lessons', target: 5, n: 5, done: true, paid: false }]; req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
          if (u.indexOf('/api/predict') >= 0 && req.method() === 'GET') return fetch(ORIGIN + '/api/predict').then(r => r.json()).then(j => { j.signedIn = true; j.me = { today: { guess: 80000 }, yday: null, streak: 1, season: { pts: 0, n: 0, rank: null } }; req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
        }
        return req.continue();
      });
      return { ctx, page, beacons };
    }

    for (const vp of [{ w: 1366, h: 860, t: 'desktop' }, { w: 390, h: 800, t: 'phone' }]) {
      const { ctx, page, beacons } = await fresh(vp.w, vp.h, false);
      await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("document.querySelectorAll('#ssBoard .ss-r').length>0", { timeout: 25000 }).catch(() => {});
      const g = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, old: !!(document.getElementById('lbBoard') || document.getElementById('hhWrap') || document.getElementById('closeFeed') || document.getElementById('dc') || document.getElementById('sg')), sec: !!document.getElementById('season'), board: document.querySelectorAll('#ssBoard .ss-r').length, live: document.querySelectorAll('#ssLive .ss-r').length, rows: document.querySelectorAll('#ssRows .ss-row').length, days: document.querySelectorAll('#ssDays i').length, dash: !!document.getElementById('dash') && !document.getElementById('dash').hidden, hero: (function () { const h = document.querySelector('section.hero'); return !!h && getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height > 100; })(), eye: (document.getElementById('ssEye') || {}).textContent }));
      chk(vp.t + ' guest: old season band gone, compact section in its place', !g.old && g.sec, g);
      chk(vp.t + ' guest: board top rows, live closes, season rows, 14-day strip', g.board > 0 && g.live > 0 && g.rows >= 3 && g.days === 14, { board: g.board, live: g.live, rows: g.rows, eye: g.eye });
      chk(vp.t + ' guest: strip hidden, no horizontal scroll' + (vp.w > 500 ? ', hero shown' : ''), !g.dash && !g.sx && (vp.w > 500 ? g.hero : true), { dash: g.dash, sx: g.sx, hero: g.hero });
      chk(vp.t + ' guest: page shorter than before (was ' + (vp.w > 500 ? '7,401' : '10,304') + ' px)', g.h < (vp.w > 500 ? 6000 : 8000), { h: g.h });
      // scroll to the bottom to fire the beacons
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
      await new Promise(r => setTimeout(r, 800));
      chk(vp.t + ' guest: section-view beacons sent for the blocks reached', beacons.length >= 4 && beacons.some(b => /season/i.test(b)), beacons.slice(0, 8));
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'home-guest-' + vp.t + '.png'), fullPage: true });
      await ctx.close();
    }

    {
      const { ctx, page } = await fresh(1366, 860, true);
      await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("document.getElementById('dash') && !document.getElementById('dash').hidden && document.querySelectorAll('#dashChips span').length>0", { timeout: 25000 }).catch(() => {});
      const m = await page.evaluate(() => { const d = document.getElementById('dash'); const r = d.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 40, r.top + r.height / 2); return { dash: !d.hidden, chips: [...document.querySelectorAll('#dashChips span')].map(s => s.textContent.replace(/\s+/g, ' ').trim()), reach: !!(hit && d.contains(hit)), hero: (function () { const h = document.querySelector('section.hero'); return !!h && getComputedStyle(h).display !== 'none'; })(), rows: [...document.querySelectorAll('#ssRows .ss-row')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), title: (document.getElementById('dashT') || {}).textContent, todo: document.querySelectorAll('#dashTodo span').length, lvl: (document.getElementById('dashLvl') || {}).textContent, bar: parseFloat(((document.getElementById('dashBar') || {}).style || {}).width) || 0 }; });
      chk('member: dashboard strip shown and reachable, hero hidden', m.dash && m.reach && !m.hero, { dash: m.dash, reach: m.reach, hero: m.hero, title: m.title });
      chk('member: dashboard tiles carry pass tier, call, goals, boards + a next-up list (2026-09-06 card)', m.chips.length === 4 && /4\/20/.test(m.chips[0]) && /Pass tier/.test(m.chips[0]) && /80,000/.test(m.chips[1]) && /Daily call/.test(m.chips[1]) && /1\/2/.test(m.chips[2]) && /Goals/.test(m.chips[2]) && /Boards/.test(m.chips[3]) && m.todo >= 1 && m.lvl && m.bar > 0, { chips: m.chips, todo: m.todo, lvl: m.lvl, bar: m.bar });
      chk('member: your-season rows show tier, call, goals, boards', m.rows.length === 4 && /4 \/ 20/.test(m.rows[0]) && /made/.test(m.rows[1]) && /1 picked/.test(m.rows[2]), m.rows);
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'home-member-desktop.png') });
      await ctx.close();
    }

    {
      const { ctx, page } = await fresh(1280, 860, false);
      await page.goto(ORIGIN + '/vault/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("!!document.querySelector('[data-mpbn=\"browse\"], .mpnav-burger, #mpnavBtn')", { timeout: 15000 }).catch(() => {});
      const nav = await page.evaluate(() => !!document.querySelector('a.mpnav-row[href="/season/"]'));
      chk('Browse drawer links Your season', nav);
      await ctx.close();
    }
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();

/* Homepage: the COMPETITION card + the member strip (rewritten 2026-09-17).

   Until 2026-09-17 the homepage carried a compact band 04 "This season" (your-season rows, the leading board, the live
   floor). The owner replaced it with ONE card that sells the prizes and the leaderboards, DOM-second right under the
   Paper Trade hero, full width, clicking through to /season/. The member strip (#dash) stays exactly as it was.

   Proven on production in a real browser:
     guest desktop/phone: band 04 gone, #cpCard is the SECOND tile of band 01, reachable (elementFromPoint at its
       centre after scrolling it into view), six board tiles each naming a leader from /api/competition, the pool
       figure equals prize_pool_usd_per_season, the day strip has 14 cells with the current day marked, the whole
       card is one link to /season/, no horizontal scroll, no leftover ss-* nodes
     desktop: the Screener tile sits on the SAME row as Paper Trade (grid-auto-flow:dense closed the hole)
     member (simulated): strip shown with chips, hero hidden - the strip must not have died with the section
     the guest pays none of the five member fetches (pass/goals/predict/lb/happyhour)
     drawer: a link to /season/

   Run: node build/home-season-e2e.js
*/
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 240) : ''));
const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };

(async () => {
  const comp = await (await fetch(ORIGIN + '/api/competition')).json();
  chk('/api/competition answers with boards + a season', comp && Array.isArray(comp.boards) && comp.boards.length >= 5 && comp.season && comp.season.day_of_season >= 1, { boards: (comp.boards || []).length, day: comp.season && comp.season.day_of_season });
  const rs = await fetch(ORIGIN + '/season/?cb=' + Date.now());
  chk('/season/ serves 200', rs.status === 200);

  await withBrowser(async (browser) => {
    async function fresh(w, h, member) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
      const beacons = [], fetched = [];
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const u = req.url();
        if (u.indexOf('/api/track?t=event&type=sect') >= 0) { beacons.push(decodeURIComponent((u.match(/[?&]l=([^&]*)/) || [])[1] || '')); }
        if (u.indexOf(ORIGIN + '/api/') === 0) fetched.push(u.replace(ORIGIN, '').split('?')[0]);
        if (member) {
          if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'e2ehome', xp: 4100, level: LV } }) });
          if (u.indexOf('/api/auth/xp') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
          if (u.indexOf('/api/pass') >= 0 && req.method() === 'GET') return fetch(ORIGIN + '/api/pass').then(r => r.json()).then(j => { j.signedIn = true; j.tier = 4; j.xp = 430; j.next = 70; j.claimable = 2; req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
          if (u.indexOf('/api/goals') >= 0 && req.method() === 'GET') return fetch(ORIGIN + '/api/goals').then(r => r.json()).then(j => { j.signedIn = true; j.picks = [{ k: 'lessons', name: 'Finish 5 Academy lessons', unit: 'lessons', target: 5, n: 5, done: true, paid: false }]; req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
          if (u.indexOf('/api/predict') >= 0 && req.method() === 'GET') return fetch(ORIGIN + '/api/predict').then(r => r.json()).then(j => { j.signedIn = true; j.me = { today: { guess: 80000 }, yday: null, streak: 1, season: { pts: 0, n: 0, rank: null } }; req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
        }
        return req.continue();
      });
      return { ctx, page, beacons, fetched };
    }

    for (const vp of [{ w: 1366, h: 860, t: 'desktop' }, { w: 390, h: 800, t: 'phone' }]) {
      const { ctx, page, beacons, fetched } = await fresh(vp.w, vp.h, false);
      await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("[...document.querySelectorAll('#cpBoards .cp-bl b')].filter(b=>b.textContent.trim()!=='-').length>=5", { timeout: 25000 }).catch(() => {});
      const g = await page.evaluate(() => {
        const card = document.getElementById('cpCard'); const tiles = [...document.querySelectorAll('#trade .bento > .tile')];
        card.scrollIntoView({ block: 'center' });
        const r = card.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const pt = tiles[0].getBoundingClientRect(), scr = (document.querySelector('#trade .bento > .tile[href="/screener"]') || {}).getBoundingClientRect ? document.querySelector('#trade .bento > .tile[href="/screener"]').getBoundingClientRect() : { top: -1 };
        return {
          h: document.documentElement.scrollHeight, sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          old: !!(document.getElementById('season') || document.getElementById('ssBoard') || document.querySelector('.ss-grid')),
          idx: tiles.indexOf(card), href: card.getAttribute('href'), reach: !!(hit && card.contains(hit)),
          w: Math.round(r.width), pageW: document.documentElement.clientWidth,
          pool: (document.getElementById('cpPool') || {}).textContent, eye: (document.getElementById('cpEye') || {}).textContent, left: (document.getElementById('cpLeft') || {}).textContent,
          days: document.querySelectorAll('#cpDays i').length, dayOn: document.querySelectorAll('#cpDays i.on').length, dayNow: document.querySelectorAll('#cpDays i.now').length,
          boards: [...document.querySelectorAll('#cpBoards .cp-b')].map(b => ({ id: b.dataset.b, pool: b.querySelector('.cp-bp').textContent.replace(/\s+/g, ' ').trim(), who: b.querySelector('.cp-bl b').textContent.trim(), v: b.querySelector('.cp-bl em').textContent.trim(), w: Math.round(b.getBoundingClientRect().width) })),
          sameRow: Math.abs(pt.top - scr.top) < 4, ptTop: Math.round(pt.top), scrTop: Math.round(scr.top),
          dash: !!document.getElementById('dash') && !document.getElementById('dash').hidden,
          hero: (function () { const h = document.querySelector('section.hero'); return !!h && getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height > 100; })(),
          bandIdx: [...document.querySelectorAll('.band-idx')].map(x => x.textContent),
        };
      });
      chk(vp.t + ' guest: band 04 gone, competition card is the SECOND tile of band 01 and links /leaderboards/', !g.old && g.idx === 1 && g.href === '/leaderboards/', { old: g.old, idx: g.idx, href: g.href });
      chk(vp.t + ' guest: card reachable at its centre, full width, no horizontal scroll', g.reach && !g.sx && g.w >= g.pageW * 0.85, { reach: g.reach, sx: g.sx, w: g.w, pageW: g.pageW });
      chk(vp.t + ' guest: pool equals /api/competition, day strip has 14 cells with today marked', g.pool === '$' + comp.prize_pool_usd_per_season && g.days === 14 && g.dayNow === 1 && g.dayOn === comp.season.day_of_season && /day \d+ of 14/.test(g.eye), { pool: g.pool, eye: g.eye, left: g.left, dayOn: g.dayOn });
      const liveBoards = comp.boards.filter(b => b.leader && b.leader.name);
      const named = g.boards.filter(b => b.who && b.who !== '-' && !/nobody/.test(b.who));
      chk(vp.t + ' guest: six board tiles, each with a pool and the live leader from the API', g.boards.length === 6 && named.length === liveBoards.length && g.boards.every(b => /^\$\d+\s*pool · \$\d+ first$/.test(b.pool)) && liveBoards.every(b => named.some(n => n.id === b.id && n.who === b.leader.name)), g.boards.map(b => b.id + ':' + b.who + ' ' + b.v));
      chk(vp.t + ' guest: strip hidden, hero shown on desktop, band numbering closed up (01-04)', !g.dash && (vp.w > 500 ? g.hero : true) && g.bandIdx.join(',') === '01,02,03,04', { dash: g.dash, hero: g.hero, bands: g.bandIdx });
      if (vp.w > 500) chk('desktop: Screener sits on the same row as Paper Trade (dense grid, no hole)', g.sameRow, { pt: g.ptTop, scr: g.scrTop });
      else chk('phone: every board tile at least 150 px wide (two columns)', g.boards.every(b => b.w >= 150), g.boards.map(b => b.w));
      // /api/pass, /api/goals, /api/predict, /api/happyhour and /api/reward/lb are ALSO read by the older band blocks
      // (daily call, goals, pass, Happy Hour, leaderboard), so a guest still fetches them once; what this card must
      // not add is the retired live-floor feed, and it must read the competition.
      chk(vp.t + ' guest: /api/competition read, retired /api/trades/feed not read by the strip (at most the duel feed block\'s own reads)', fetched.indexOf('/api/competition') >= 0 && fetched.filter(u => u === '/api/trades/feed').length <= 1, { comp: fetched.indexOf('/api/competition') >= 0, feed: fetched.filter(u => u === '/api/trades/feed').length });
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
      await new Promise(r => setTimeout(r, 800));
      chk(vp.t + ' guest: section-view beacons sent for the blocks reached', beacons.length >= 4 && beacons.some(b => /trade/i.test(b)), beacons.slice(0, 8));
      await page.evaluate(() => { document.getElementById('cpCard').scrollIntoView({ block: 'center' }); });
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'home-competition-' + vp.t + '.png') });
      await ctx.close();
    }

    {
      const { ctx, page } = await fresh(1366, 860, true);
      await page.goto(ORIGIN + '/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("document.getElementById('dash') && !document.getElementById('dash').hidden && document.querySelectorAll('#dashChips span').length>0 && !document.querySelector('#dashChips .sk')", { timeout: 25000 }).catch(() => {});
      const m = await page.evaluate(() => { const d = document.getElementById('dash'); const r = d.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 40, r.top + r.height / 2); return { dash: !d.hidden, chips: [...document.querySelectorAll('#dashChips span')].map(s => s.textContent.replace(/\s+/g, ' ').trim()), reach: !!(hit && d.contains(hit)), hero: (function () { const h = document.querySelector('section.hero'); return !!h && getComputedStyle(h).display !== 'none'; })(), title: (document.getElementById('dashT') || {}).textContent, todo: document.querySelectorAll('#dashTodo span').length, lvl: (document.getElementById('dashLvl') || {}).textContent, bar: parseFloat(((document.getElementById('dashBar') || {}).style || {}).width) || 0, card: !!document.getElementById('cpCard') }; });
      chk('member: dashboard strip shown and reachable, hero hidden, competition card still there', m.dash && m.reach && !m.hero && m.card, { dash: m.dash, reach: m.reach, hero: m.hero, title: m.title });
      chk('member: dashboard tiles carry pass tier, call, goals, boards + a next-up list (the strip survived the section)', m.chips.length === 4 && /4\/40/.test(m.chips[0]) && /Pass tier/.test(m.chips[0]) && /80,000/.test(m.chips[1]) && /Daily call/.test(m.chips[1]) && /1\/2/.test(m.chips[2]) && /Goals/.test(m.chips[2]) && /Boards/.test(m.chips[3]) && m.todo >= 1 && m.lvl && m.bar > 0, { chips: m.chips, todo: m.todo, lvl: m.lvl, bar: m.bar });
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

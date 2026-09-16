/* /leaderboards/ (2026-09-17, owner: "posebna stranica ... tabele i pravila, i to je to; kartica na pocetnoj vodi tamo").

   Proven on production:
     raw: 200, indexable, canonical, WebPage + FAQPage + Breadcrumb JSON-LD, six tab buttons and a rules block in the static HTML
     browser desktop + phone: season strip filled from /api/reward/lb (day of 14, ends-in), six tabs each naming the live leader,
       the ROE table lists the same names in the same order as the API with prizes on the top five, switching to the Bybit board
       swaps the columns, the Gold Room tab carries the GOLD+ ribbon, the first row is reachable at its centre, no sideways scroll,
       every row links a trader profile, the guest "you" line asks to sign in, a member (simulated) sees "You are #N" when ranked
     homepage: the competition card links /leaderboards/; the Browse drawer has a Leaderboards row

   Run: node build/leaderboards-e2e.js
*/
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 240) : ''));

(async () => {
  const r = await fetch(ORIGIN + '/leaderboards/?cb=' + Date.now()); const raw = await r.text();
  const lb = await (await fetch(ORIGIN + '/api/reward/lb', { cache: 'no-store' })).json();
  chk('raw: 200, indexable, canonical, JSON-LD (WebPage, FAQPage, Breadcrumb), six tabs, rules in static HTML', r.status === 200 && /index, follow/.test(raw) && /rel="canonical" href="https:\/\/marginpad.io\/leaderboards\/"/.test(raw) && /"@type":"WebPage"/.test(raw) && /"@type":"FAQPage"/.test(raw) && /"@type":"BreadcrumbList"/.test(raw) && (raw.match(/class="tab[ "]/g) || []).length === 6 && /Rules every board shares/.test(raw));
  const home = await (await fetch(ORIGIN + '/?cb=' + Date.now())).text();
  chk('homepage: the competition card links /leaderboards/ and carries no Enter button', /id="cpCard" href="\/leaderboards\/"/.test(home) && !/Enter free/.test(home) && /class="cp-rib">GOLD\+/.test(home));
  await withBrowser(async (browser) => {
    async function fresh(w, h, member) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
      if (member) {
        await page.setRequestInterception(true);
        page.on('request', (req) => { const u = req.url();
          if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: member, xp: 100 } }) });
          if (u.indexOf('/api/auth/xp') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 100, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
          return req.continue(); });
      }
      return { ctx, page };
    }
    for (const vp of [{ w: 1366, h: 900, t: 'desktop' }, { w: 390, h: 800, t: 'phone' }]) {
      const { ctx, page } = await fresh(vp.w, vp.h, null);
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto(ORIGIN + '/leaderboards/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("document.querySelectorAll('#bBody tr td.who').length>3", { timeout: 25000 }).catch(() => {});
      const g = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#bBody tr')]; const first = rows[0]; let reach = false;
        if (first) { first.scrollIntoView({ block: 'center' }); const b = first.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); reach = !!(h && first.contains(h)); }
        return { eye: (document.getElementById('sEye') || {}).textContent, left: (document.getElementById('sLeft') || {}).textContent, days: document.querySelectorAll('#sDays i.on').length, tabs: document.querySelectorAll('.tab').length, leaders: [...document.querySelectorAll('.tab .l')].map(x => x.textContent).filter(t => /leads|open/.test(t)).length, names: rows.map(tr => (tr.querySelector('td.who') || {}).textContent), prizes: rows.slice(0, 5).map(tr => (tr.querySelector('td.prz') || {}).textContent), links: rows.filter(tr => tr.querySelector('td.who a[href^="/community/u/"]')).length, reach, sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, rib: !!document.querySelector('.tab[data-b="gold"] .rib'), you: (document.getElementById('bYou') || {}).textContent, rules: document.querySelectorAll('#bRules li').length };
      });
      const apiNames = (lb.top || []).map(x => x.who);
      chk(vp.t + ': season strip filled, six tabs each naming a leader, GOLD+ ribbon on the Gold Room', /Day \d+ of 14/.test(g.eye) && /ends in/.test(g.left) && g.days >= 1 && g.tabs === 6 && g.leaders === 6 && g.rib, { eye: g.eye, left: g.left, leaders: g.leaders, rib: g.rib });
      chk(vp.t + ': the ROE table lists the API names in order, prizes on the top five, every row links a profile, first row reachable, no sideways scroll, rules listed', g.names.join('|') === apiNames.join('|') && g.prizes.every(p => /^\$\d+$/.test(p)) && g.links === g.names.length && g.reach && !g.sx && g.rules >= 3, { n: g.names.length, api: apiNames.length, prizes: g.prizes, reach: g.reach, sx: g.sx });
      chk(vp.t + ': a guest is asked to sign in to see where they stand', /Sign in/.test(g.you || ''), g.you);
      const sw = await page.evaluate(async () => { document.querySelector('.tab[data-b="bybit"]').click(); await new Promise(r => setTimeout(r, 200)); return { head: [...document.querySelectorAll('#bHead th')].map(x => x.textContent), title: (document.getElementById('bT') || {}).textContent, hash: location.hash, pz: document.querySelectorAll('#bPz .pz').length, first: (document.querySelector('#bPz .pz b') || {}).textContent }; });
      chk(vp.t + ': switching to the Bybit board swaps the columns, prizes and title', /Volume traded/.test(sw.head.join('|')) && /Bybit/.test(sw.title) && sw.hash === '#bybit' && sw.pz === 5 && sw.first === '$100', sw);
      chk(vp.t + ': no page errors', errs.length === 0, errs);
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'leaderboards-' + vp.t + '.png') });
      await ctx.close();
    }
    {
      const ranked = (lb.top || [])[0] && lb.top[0].who;
      const { ctx, page } = await fresh(1366, 900, ranked || 'nobody');
      await page.goto(ORIGIN + '/leaderboards/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("/You are #/.test((document.getElementById('bYou')||{}).textContent||'')", { timeout: 20000 }).catch(() => {});
      const m = await page.evaluate(() => ({ you: (document.getElementById('bYou') || {}).textContent, me: document.querySelectorAll('#bBody tr.me').length }));
      chk('member (simulated as the ROE leader): the you-line says #1 with the prize, the row is highlighted', /You are #1/.test(m.you || '') && /\$\d+/.test(m.you || '') && m.me === 1, m);
      await ctx.close();
    }
    {
      const { ctx, page } = await fresh(1280, 860, null);
      await page.goto(ORIGIN + '/vault/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("!!document.querySelector('[data-mpbn=\"browse\"], .mpnav-burger, #mpnavBtn')", { timeout: 15000 }).catch(() => {});
      const nav = await page.evaluate(() => !!document.querySelector('a.mpnav-row[href="/leaderboards/"]'));
      chk('Browse drawer links Leaderboards', nav);
      await ctx.close();
    }
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();

// ROAD TO BRONZE (2026-09-20, owner: "jel mozemo da stavimo neke misije da budu lakse za njih unranked").
//
// The load-bearing checks are the two that make this safe to ship: a task cannot be claimed before the server
// can SEE it was done (never client-trusted), and the whole card is gone the moment the member is Bronze.
//
//   node build/bronze-e2e.js
const fs = require('fs');
const { withBrowser } = require('./e2e-browser.js');
const KEY = (fs.readFileSync(__dirname + '/../ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';

const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + JSON.stringify(x).slice(0, 220) : ''));
const api = async (op, uid, extra) => (await fetch(B + '/api/admin/e2euser', { method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid, op }, extra || {})) })).json();

(async () => {
  const U = 'e2ebz' + Math.random().toString(36).slice(2, 6);
  await api('mk', U);
  const sess = await api('sess', U);
  let internal = '';
  try { const w = await (await fetch(B + '/api/admin/xpdiag?u=' + encodeURIComponent('e2e_' + U), { headers: { 'x-admin-key': KEY } })).json(); internal = (w && w.user && w.user.id) || ''; } catch (e) {}
  // uevForward keys the per-user event on the mp_uid COOKIE, not on the session - a browser sends both, so a
  // test that sends only mp_sess proves nothing about what a real member's action records.
  const ck = { cookie: 'mp_sess=' + sess.token + '; mp_uid=' + internal };
  const get = async () => (await fetch(B + '/api/bronze', { headers: ck })).json();
  const claim = async (tid) => (await fetch(B + '/api/bronze', { method: 'POST', headers: { ...ck, 'content-type': 'application/json' }, body: JSON.stringify({ tid }) })).json();

  try {
    // ---------- the catalogue is public, the state is not
    const g = await (await fetch(B + '/api/bronze')).json();
    chk('a guest gets the task list but no state', g.signedIn === false && (g.tasks || []).length === 9 && g.tasks[0].done === undefined, { n: (g.tasks || []).length });
    chk('the nine add up to 400 of the 500', g.totalXp === 400 && g.need === 500 && g.tasks.reduce((a, t) => a + t.xp, 0) === 400, { totalXp: g.totalXp, need: g.need });
    chk('every task either links somewhere or is the one that cannot',
      g.tasks.filter(t => t.url).length === 8 && !g.tasks.find(t => t.tid === 'back').url, { linked: g.tasks.filter(t => t.url).length });

    // ---------- a fresh member: nothing done, nothing claimable
    let d = await get();
    chk('a fresh member is unranked and has nothing done', d.signedIn === true && d.ranked === false && d.xp === 0 && !d.tasks.some(t => t.done), { xp: d.xp, ranked: d.ranked });

    // ---------- THE LOAD-BEARING ONE: the client cannot claim what the server has not seen
    const r1 = await claim('trade');
    chk('a task that was never done is refused, whatever the client says', r1.error === 'not_done', r1);
    const rb = await claim('nope');
    chk('an unknown task id is refused', rb.error === 'bad_task', rb);

    // ---------- do the thing for real, then it becomes claimable
    chk('the e2e account resolved to an internal uid', !!internal, { internal: !!internal });
    // handleTrack reads the event type from `t`, NOT from a `type` param - and the per-user row is written by
    // the browser's beacon, not by /api/trade/open, so a server-side open alone records nothing here. This is
    // the same signal the daily "Open a paper trade" mission has verified against for months.
    await fetch(B + '/api/track?t=paper&l=e2e&p=/paper-trade', { headers: { ...ck, 'x-admin-key': KEY } });
    let ok = false;
    for (let i = 0; i < 10 && !ok; i++) { await new Promise(r => setTimeout(r, 1500)); d = await get(); ok = !!(d.tasks.find(t => t.tid === 'trade') || {}).done; }
    chk('once the event really exists, the server marks the task done', ok, { prog: (d.tasks.find(t => t.tid === 'trade') || {}).prog });

    // measure the DELTA, never the total: the beacon above also tripped the daily check-in, so a total of 40
    // would only be right on an account that had done nothing else that day.
    const before = (await get()).xp;
    const r2 = await claim('trade');
    chk('claiming a finished task pays its exact XP and nothing more',
      r2.ok === true && r2.gained === 40 && r2.xp - before === 40, { gained: r2.gained, before, after: r2.xp });
    const r3 = await claim('trade');
    chk('and it can never be claimed twice', r3.error === 'already_claimed', r3);
    d = await get();
    chk('the state comes back claimed', !!(d.tasks.find(t => t.tid === 'trade') || {}).claimed && d.xp === r2.xp, { xp: d.xp });

    // ---------- crossing 500 ends the card, and a claim after that is refused
    const lift = internal ? await (await fetch(B + '/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ uid: internal, level: 'bronze', note: 'bronze-e2e' }) })).json() : null;
    chk('the member really reached Bronze before the ending is judged', !!(lift && lift.ok && lift.xp >= 500), { lifted: lift && lift.xp });
    d = await get();
    chk('at Bronze the endpoint says the card is over', d.ranked === true, { ranked: d.ranked, xp: d.xp });
    const r4 = await claim('sltp');
    chk('and nothing more can be claimed from it', r4.error === 'already_bronze', r4);

    // ---------- the page: hidden for a guest, hidden for a Bronze member, shown for an unranked one
    await withBrowser(async (browser) => {
      const open = async (opts) => {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        page.on('pageerror', e => out.push('FAIL page error: ' + String(e.message).slice(0, 90)));
        await page.setViewport(opts.phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1366, height: 900 });
        if (opts.token) await page.setCookie(
          { name: 'mp_sess', value: opts.token, domain: 'marginpad.io', path: '/', secure: true },
          { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/', secure: true });
        await page.goto(B + (opts.path || '/season/') + '?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise(r => setTimeout(r, 5000));
        return { ctx, page };
      };
      const read = (page) => page.evaluate(() => {
        const s = document.getElementById('bronze');
        if (!s) return { missing: true };
        const tiles = [...s.querySelectorAll('.bz-t')];
        const R = tiles.map(t => t.getBoundingClientRect());
        return {
          hidden: s.hidden, tiles: tiles.length,
          shown: tiles.filter(t => t.offsetParent !== null).length,
          // symmetry: every tile in a row is the same height, and the grid really is three across
          heights: [...new Set(R.map(r => Math.round(r.height)))].length,
          cols: new Set(R.map(r => Math.round(r.left))).size,
          clickable: tiles.filter(t => t.getAttribute('data-url')).length,
          wide: [...s.querySelectorAll('*')].filter(el => el.getBoundingClientRect().width > window.innerWidth + 1).length,
          txt: s.innerText.replace(/\s+/g, ' ').slice(0, 600),
        };
      });

      { const { ctx, page } = await open({}); const v = await read(page);
        chk('a guest never sees the card', v.missing || v.hidden === true, v); await ctx.close(); }

      { const { ctx, page } = await open({ token: sess.token }); const v = await read(page);
        chk('a Bronze member never sees it either', v.hidden === true, { hidden: v.hidden }); await ctx.close(); }

      // an unranked member, for the real look
      const U2 = 'e2ebz' + Math.random().toString(36).slice(2, 6);
      await api('mk', U2); const s2 = await api('sess', U2);
      try {
        { const { ctx, page } = await open({ token: s2.token }); const v = await read(page);
          chk('an unranked member sees all nine tiles', v.hidden === false && v.tiles === 9 && v.shown === 9, v);
          chk('the grid is three across and every tile is the same height', v.cols === 3 && v.heights === 1, { cols: v.cols, heights: v.heights });
          chk('eight tiles carry a link to where the task is done', v.clickable === 8, { clickable: v.clickable });
          // clicking an unfinished task navigates rather than claiming
          await page.evaluate(() => document.querySelector('.bz-t[data-tid="charts"]').click());
          await new Promise(r => setTimeout(r, 2500));
          chk('tapping an unfinished task takes them to the page that does it', /\/charts/.test(page.url()), { url: page.url() });
          await ctx.close(); }
        { const { ctx, page } = await open({ token: s2.token, phone: true }); const v = await read(page);
          chk('phone 390: one column, nothing wider than the screen', v.hidden === false && v.cols === 1 && v.wide === 0, v); await ctx.close(); }
        { const { ctx, page } = await open({ token: s2.token, path: '/es/season/' }); const v = await read(page);
          chk('the Spanish twin shows the card in Spanish', v.hidden === false && /[áéíóúñ]/.test(v.txt) && !/Go and do it|Waiting on you/.test(v.txt), { txt: v.txt.slice(0, 120) }); await ctx.close(); }
      } finally { await api('rm', U2); }
    }, { timeoutMs: 900000 });
  } finally { await api('rm', U); }

  console.log(out.join('\n'));
  const fail = out.filter(l => l.startsWith('FAIL')).length;
  console.log('\nbronze-e2e: ' + (out.length - fail) + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();

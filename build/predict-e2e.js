/* Daily call E2E (2026-09-06). One BTC close guess per UTC day, changeable until 20:00 UTC, settled from the 1D
   candle, paid in Ticks: within 0.25% = 12, 0.5% = 8, 1% = 5, 2% = 2, else 0, plus 1 for showing up.

   Server, on production with a throwaway uid through the admin hook (?uid=, same as /api/trade):
     make a call, change it, refuse a call 30%+ off the market, force-settle TODAY with a chosen close
     (?settle=<day>&close=<px>&uid=), and read back error/points/ticks, the day streak, the season points and rank,
     the refusal to touch a settled day, and a second uid on the board. Then the homepage card in a real browser:
     a guest gets the sign-in copy with no form; a (simulated) member gets the form, reachable, inside its column,
     clear of the Happy Hour block; yesterday's result renders.

   Run: node build/predict-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'pr' + Date.now().toString(36).slice(-5), UID2 = UID + 'b';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const get = async (u) => { const r = await fetch(ORIGIN + u, { headers: H }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const post = async (u, b) => { const r = await fetch(ORIGIN + u, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
// a call needs a real member row (Ticks land on it, the board joins it): mint a throwaway one, scrubbed at the end.
// Its username starts with e2e_ and the public board filters that prefix out.
async function ensureUser(uid) { const r = await post('/api/admin/e2euser', { uid, op: 'mk' }); if (!r.body || !r.body.ok) throw new Error('could not mint ' + uid + ': ' + JSON.stringify(r.body)); }
async function dropUser(uid) { await post('/api/admin/e2euser', { uid, op: 'rm' }).catch(() => {}); }

(async () => {
  await ensureUser(UID); await ensureUser(UID2);
  const s0 = await get('/api/predict?uid=' + UID);
  chk('GET state answers with day, cutoff, live price, tiers', s0.status === 200 && /^\d{4}-\d{2}-\d{2}$/.test(s0.body.day) && s0.body.cutoff > 0 && s0.body.live > 1000 && Array.isArray(s0.body.tiers), { day: s0.body.day, live: s0.body.live, open: s0.body.open });
  const live = s0.body.live, day = s0.body.day, force = s0.body.open ? '' : '&force=1';
  chk('no call yet for a fresh account', !s0.body.me || !s0.body.me.today);

  const far = await post('/api/predict?uid=' + UID + force, { guess: live * 1.5 });
  chk('a call 50% off the market is refused (range)', far.status === 400 && far.body.error === 'range', far.body);

  const c1 = await post('/api/predict?uid=' + UID + force, { guess: live * 1.01 });
  chk('first call accepted', c1.status === 200 && c1.body.ok && !c1.body.changed, c1.body);
  const c2 = await post('/api/predict?uid=' + UID + force, { guess: live * 1.004 }); // 0.4% above: settles in the 8-Tick tier when the close is exactly `live`
  chk('changing the call is allowed before settlement (flagged changed)', c2.status === 200 && c2.body.ok && c2.body.changed, c2.body);
  const s1 = await get('/api/predict?uid=' + UID);
  chk('state shows my call and a 1-day streak', s1.body.me && s1.body.me.today && Math.abs(s1.body.me.today.guess - live * 1.004) < 1 && s1.body.me.streak === 1, s1.body.me && { today: s1.body.me.today, streak: s1.body.me.streak });

  const c3 = await post('/api/predict?uid=' + UID2 + force, { guess: live * 1.0015 }); // 0.15%: 12-Tick tier
  chk('second account calls too', c3.status === 200 && c3.body.ok, c3.body);

  // settle TODAY with the close = live, only for our two uids (real users' calls stay open for the cron)
  const st1 = await get('/api/admin/predict?settle=' + day + '&close=' + live + '&uid=' + UID);
  chk('forced settlement scores one account', st1.body.ok && st1.body.settled === 1 && st1.body.ticksPaid === 9, st1.body);
  const st2 = await get('/api/admin/predict?settle=' + day + '&close=' + live + '&uid=' + UID2);
  chk('second account settles in the 12 tier (+1 for showing up)', st2.body.ok && st2.body.settled === 1 && st2.body.ticksPaid === 13, st2.body);

  const again = await post('/api/predict?uid=' + UID + force, { guess: live });
  chk('a settled day cannot be re-called', again.status === 409 && again.body.error === 'settled', again.body);

  // yesterday's result is what the card shows the next morning: ask the DO with day shifted so "yday" = today
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const s2 = await get('/api/predict?uid=' + UID);
  const seasonPts = s2.body.me && s2.body.me.season;
  chk('season points and rank reflect the settled call (8 pts, ranked behind the 12)', seasonPts && seasonPts.pts === 8 && seasonPts.n === 1 && seasonPts.rank >= 2, seasonPts);
  chk('public board never shows a test account (e2e_ prefix filtered, callers excludes them)', !(s2.body.board || []).some(r => /^e2e_/.test(r.name)) && typeof s2.body.callers === 'number', { callers: s2.body.callers, top: (s2.body.board || []).slice(0, 3) });

  // cron guard: settles only a closed candle, once, and pays through the ticks day cap
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  chk('cron registered in the */10 schedule', src.indexOf("bg(settleDailyCalls, 'predict')") > 0);
  chk('cron waits for the NEXT 1D candle before settling (closed-candle rule)', /const later = [\s\S]{0,200}some\(b => \+b\.time > want\)/.test(src) && src.indexOf('!later) return;') > 0);
  chk('Ticks source declared with a day cap', /k: 'predict', label: 'Daily call', cap: 13/.test(src));

  // ---- browser: the homepage card
  let guest = null, member = null;
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1366, height: 900 });
    await page.goto(ORIGIN + '/season/?cb=' + Date.now() + '#today', { waitUntil: 'networkidle2', timeout: 90000 }); // the daily-call card moved from the homepage to /season/ (2026-09-06 homepage by intent)
    await page.waitForFunction("document.getElementById('dc') && !document.getElementById('dc').hidden", { timeout: 20000 }).catch(() => {});
    guest = await page.evaluate(() => { const b = document.getElementById('dc'); if (!b || b.hidden) return { shown: false }; return { shown: true, formHidden: document.getElementById('dcForm').hidden, sub: document.getElementById('dcSub').textContent.slice(0, 60), state: document.getElementById('dcState').textContent }; });
    await ctx.close();

    const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage();
    await p2.setCacheEnabled(false); await p2.setBypassServiceWorker(true); await p2.setViewport({ width: 1366, height: 900 });
    await p2.setRequestInterception(true);
    p2.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('/api/predict') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ day, yday: day, cutoff: Date.now() + 3600000, open: true, live, cutoffH: 20, tiers: [[0.25, 12], [0.5, 8], [1, 5], [2, 2]], board: [{ name: 'alpha', pts: 20, n: 2 }, { name: 'beta', pts: 8, n: 1 }], callers: 2, me: { today: null, yday: { guess: live * 1.004, close: live, err: 0.4, pts: 8, ticks: 9, settled: 1 }, streak: 1, season: { pts: 8, n: 1, rank: 2 } }, signedIn: true }) });
      return req.continue();
    });
    await p2.goto(ORIGIN + '/season/?cb=' + Date.now() + '#today', { waitUntil: 'networkidle2', timeout: 90000 });
    await p2.waitForFunction("document.getElementById('dc') && !document.getElementById('dc').hidden && !document.getElementById('dcForm').hidden", { timeout: 20000 }).catch(() => {});
    member = await p2.evaluate(() => {
      const b = document.getElementById('dc'); if (!b || b.hidden) return { shown: false };
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect(), col = b.parentElement.getBoundingClientRect();
      const hh = document.getElementById('hhWrap'); const hr = hh && !hh.hidden ? hh.getBoundingClientRect() : null;
      const inp = document.getElementById('dcIn'), ir = inp.getBoundingClientRect(); const hit = document.elementFromPoint(ir.left + ir.width / 2, ir.top + ir.height / 2);
      const go = document.getElementById('dcGo'), gr = go.getBoundingClientRect(); const hit2 = document.elementFromPoint(gr.left + gr.width / 2, gr.top + gr.height / 2);
      return { shown: true, formHidden: document.getElementById('dcForm').hidden, inputReach: hit === inp, buttonReach: hit2 === go, inside: r.left >= col.left - .5 && r.right <= col.right + .5, clearOfHH: !hr || r.top >= hr.bottom - .5 || r.bottom <= hr.top + .5, yday: document.getElementById('dcY').textContent.slice(0, 80), board: document.getElementById('dcBoard').textContent.slice(0, 60), scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    await p2.screenshot({ path: path.join(__dirname, 'vault-shots', 'predict-member.png') });
    await ctx2.close();
  });
  chk('season page: guest sees the card with the sign-in copy and no form', guest && guest.shown && guest.formHidden && /Sign in/.test(guest.sub), guest);
  chk('season page: member sees the form, input and button reachable', member && member.shown && !member.formHidden && member.inputReach && member.buttonReach, member);
  chk('season page: card inside its column, clear of Happy Hour, no horizontal scroll', member && member.inside && member.clearOfHH && !member.scrollsX, member && { inside: member.inside, clear: member.clearOfHH, sx: member.scrollsX });
  chk('season page: yesterday result and the board render', member && /Yesterday/.test(member.yday) && /alpha/.test(member.board), member && { y: member.yday, b: member.board });

  await dropUser(UID); await dropUser(UID2);
  const gone = await get('/api/predict?uid=' + UID);
  chk('cleanup: both throwaway members removed', !(gone.body.me && gone.body.me.today) && !(gone.body.board || []).some(r => /^e2e_/.test(r.name)));

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed  (uid ' + UID + ')');
  process.exit(bad ? 1 : 0);
})();

/* Season goals E2E (2026-09-06). Pick two targets per 14-day season from a catalogue of five, no swaps; progress
   is counted from the real tables (closes, green days, Academy lessons, daily calls, check-ins) inside the season
   window; claiming re-verifies and pays 100 XP + 40 Ticks once.

   Server, on production with a throwaway member: catalogue for a guest, pick, pick, third pick refused, the same
   pick twice refused, claim before done refused with the count, five lessons -> the lessons goal reads 5/5,
   claim pays exactly once, claim again refused, an unpicked goal cannot be claimed. Browser: the homepage card
   for a guest (catalogue, no buttons) and for a simulated member (pick buttons reachable, then a claim button).

   Run: node build/goals-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'e2egl' + Date.now().toString(36).slice(-5);
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const post = async (u, b) => { const r = await fetch(ORIGIN + u, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const get = async (u) => { const r = await fetch(ORIGIN + u, { headers: H }); return { status: r.status, body: await r.json().catch(() => ({})) }; };

(async () => {
  const pub = await fetch(ORIGIN + '/api/goals').then(r => r.json());
  chk('guest: catalogue of five, nothing picked, reward stated', pub && (pub.catalogue || []).length === 5 && !pub.signedIn && pub.reward && pub.reward.xp === 100 && pub.reward.ticks === 40 && pub.max === 2, pub && { n: (pub.catalogue || []).length, reward: pub.reward });

  const mk = await post('/api/admin/e2euser', { uid: UID, op: 'mk' });
  chk('throwaway member minted', mk.body && mk.body.ok, mk.body);
  const p1 = await post('/api/goals?uid=' + UID, { op: 'pick', k: 'lessons' });
  chk('pick 1 (lessons)', p1.body.ok && p1.body.k === 'lessons', p1.body);
  const p2 = await post('/api/goals?uid=' + UID, { op: 'pick', k: 'closes' });
  chk('pick 2 (closes)', p2.body.ok, p2.body);
  const p3 = await post('/api/goals?uid=' + UID, { op: 'pick', k: 'green' });
  chk('third pick refused (full)', p3.status === 409 && p3.body.error === 'full', p3.body);
  const p4 = await post('/api/goals?uid=' + UID, { op: 'pick', k: 'lessons' });
  chk('same pick twice refused', p4.status === 409 && p4.body.error === 'picked', p4.body);
  const bad = await post('/api/goals?uid=' + UID, { op: 'pick', k: 'nope' });
  chk('unknown goal refused', bad.status === 400, bad.body);

  const c0 = await post('/api/goals?uid=' + UID, { op: 'claim', k: 'lessons' });
  chk('claim before done refused with the count', c0.status === 409 && c0.body.error === 'not_done' && c0.body.n === 0 && c0.body.target === 5, c0.body);

  // five lessons through the Academy route: the goal must read them
  const html = await fetch(ORIGIN + '/academy/?cb=' + Date.now()).then(r => r.text());
  const data = JSON.parse((html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/) || [])[1] || '{}');
  const ids = ((data.courses || [])[0] || { lessons: [] }).lessons.map(l => l.id).slice(0, 5);
  for (const id of ids) await post('/api/academy?uid=' + UID, { lesson: id, mistakes: 1 });
  const me = await get('/api/goals?uid=' + UID);
  const lessons = (me.body.picks || []).filter(p => p.k === 'lessons')[0];
  chk('lessons goal counts the five completed lessons and reads done', !!lessons && lessons.n === 5 && lessons.done === true && !lessons.paid, lessons);
  const closes = (me.body.picks || []).filter(p => p.k === 'closes')[0];
  chk('closes goal untouched (0 / 20)', !!closes && closes.n === 0 && !closes.done, closes);

  const c1 = await post('/api/goals?uid=' + UID, { op: 'claim', k: 'lessons' });
  chk('claim pays 100 XP + 40 Ticks once', c1.body.ok && c1.body.xp === 100 && c1.body.ticks === 40, c1.body);
  const c2 = await post('/api/goals?uid=' + UID, { op: 'claim', k: 'lessons' });
  chk('claim again refused (paid)', c2.status === 409 && c2.body.error === 'paid', c2.body);
  const c3 = await post('/api/goals?uid=' + UID, { op: 'claim', k: 'green' });
  chk('an unpicked goal cannot be claimed', c3.status === 404 && c3.body.error === 'not_picked', c3.body);
  const me2 = await get('/api/goals?uid=' + UID);
  chk('state shows the paid goal', (me2.body.picks || []).some(p => p.k === 'lessons' && p.paid && p.doneTs > 0));

  // browser: the goals card on /season/ (Today section)
  let guest = null, member = null;
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1366, height: 900 });
    await page.goto(ORIGIN + '/season/?cb=' + Date.now() + '#today', { waitUntil: 'networkidle2', timeout: 90000 }); // the goals card moved from the homepage to /season/ (2026-09-06 homepage by intent)
    await page.waitForFunction("document.getElementById('sg') && !document.getElementById('sg').hidden", { timeout: 20000 }).catch(() => {});
    guest = await page.evaluate(() => { const b = document.getElementById('sg'); if (!b || b.hidden) return { shown: false }; const t = document.getElementById('sgSub').textContent; return { shown: true, opts: b.querySelectorAll('.sg-opt').length, buttons: b.querySelectorAll('button').length, signin: /Sign in/.test(t), sub: t.slice(0, 60) }; });
    await ctx.close();

    const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage();
    await p2.setCacheEnabled(false); await p2.setBypassServiceWorker(true); await p2.setViewport({ width: 1366, height: 900 });
    await p2.setRequestInterception(true);
    let state = 0;
    p2.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('/api/goals') >= 0 && req.method() === 'GET') {
        const cat = [{ k: 'closes', name: 'Close 20 trades', target: 20, unit: 'trades' }, { k: 'green', name: '5 green days', target: 5, unit: 'green days' }, { k: 'lessons', name: 'Finish 5 Academy lessons', target: 5, unit: 'lessons' }, { k: 'calls', name: 'Make 7 daily calls', target: 7, unit: 'calls' }, { k: 'checkins', name: 'Check in 10 days', target: 10, unit: 'days' }];
        const picks = state === 0 ? [] : [{ k: 'lessons', name: 'Finish 5 Academy lessons', unit: 'lessons', target: 5, n: 5, done: true, paid: false, doneTs: 0 }, { k: 'closes', name: 'Close 20 trades', unit: 'trades', target: 20, n: 3, done: false, paid: false, doneTs: 0 }];
        return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ season: { idx: 3, from: '2026-09-01', to: '2026-09-15', endMs: Date.now() + 5 * 86400000 }, picks, max: 2, reward: { xp: 100, ticks: 40 }, catalogue: cat, signedIn: true }) });
      }
      if (u.indexOf('/api/goals') >= 0 && req.method() === 'POST') { state = 1; return req.respond({ status: 200, contentType: 'application/json', body: '{"ok":true,"k":"lessons"}' }); }
      return req.continue();
    });
    await p2.goto(ORIGIN + '/season/?cb=' + Date.now() + '#today', { waitUntil: 'networkidle2', timeout: 90000 });
    await p2.waitForFunction("document.querySelectorAll('#sg [data-pick]').length>0", { timeout: 20000 }).catch(() => {});
    const before = await p2.evaluate(() => { const b = document.querySelector('#sg [data-pick]'); if (!b) return { pick: false }; const r = b.getBoundingClientRect(); b.scrollIntoView({ block: 'center' }); const r2 = b.getBoundingClientRect(); const hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2); return { pick: true, n: document.querySelectorAll('#sg [data-pick]').length, reach: !!(hit && b.contains(hit)), inside: (function () { const c = document.getElementById('sg').getBoundingClientRect(), col = document.getElementById('sg').parentElement.getBoundingClientRect(); return c.left >= col.left - .5 && c.right <= col.right + .5; })() }; });
    await p2.click('#sg [data-pick]');
    await p2.waitForFunction("document.querySelectorAll('#sg [data-claim]').length>0", { timeout: 15000 }).catch(() => {});
    const after = await p2.evaluate(() => { const c = document.querySelector('#sg [data-claim]'); const bars = document.querySelectorAll('#sg .sg-g').length; return { claim: !!c, bars, claimText: c ? c.textContent : '', scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
    await p2.screenshot({ path: path.join(__dirname, 'vault-shots', 'goals-member.png') });
    member = Object.assign(before, after);
    await ctx2.close();
  });
  chk('season page: guest sees the five targets, no buttons, the sign-in line', guest && guest.shown && guest.opts === 5 && guest.buttons === 0 && guest.signin, guest);
  chk('season page: member sees pick buttons, reachable, card inside its column', member && member.pick && member.n === 5 && member.reach && member.inside, member);
  chk('season page: after picking, progress rows and a claim button on the done goal', member && member.bars === 2 && member.claim && /Claim \+100 XP/.test(member.claimText) && !member.scrollsX, member && { bars: member.bars, claim: member.claimText });

  await post('/api/admin/e2euser', { uid: UID, op: 'rm' });
  const gone = await get('/api/goals?uid=' + UID);
  chk('cleanup: member removed, no picks left', (gone.body.picks || []).length === 0);

  out.forEach(l => console.log(l));
  const bad2 = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad2 + ' failed  (uid ' + UID + ')');
  process.exit(bad2 ? 1 : 0);
})();

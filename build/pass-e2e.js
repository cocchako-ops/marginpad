/* Season pass E2E (2026-09-06). 20 tiers per 14-day season, one every 100 season XP. Free track: 15 Ticks a tier
   and the Arctic frame at 20. Pro track (2,500 Ticks, $2.99 from the rewards balance, or a code): 30 Ticks a tier
   plus four Vault items. Claims are per tier per track, once; unclaimed reached tiers are granted at season end.

   Server, on production with throwaway members and codes generated through the ops route (?e2e=1 + key):
     fresh member: tier 0, nothing claimable, free/pro tiers listed with prices
     claim tier 1 before reaching it -> not_reached; pro claim without a pass -> no_pass
     earn 250 season XP through the Academy (10 lessons x 25) -> tier 2, 2 claimable
     claim free tier 1 -> 15 Ticks; claim again -> claimed; tier 3 -> not_reached
     buy with Ticks with too few -> short_ticks; redeem a bad code -> bad_code
     generate a 1-use code, redeem it -> pro; second member redeems the same code -> used_up; same member again -> already
     pro claim tier 1 -> 30 Ticks; free claim tier 2 -> 15; state shows both claimed and pro
     revoke a fresh code -> bad_code on redeem
   Browser: /pass/ for a guest (gate, tiers visible) and a simulated pro member (claim buttons reachable, no
   horizontal page scroll - the track scrolls inside itself). Cleanup scrubs members; codes stay revoked.

   Run: node build/pass-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'e2eps' + Date.now().toString(36).slice(-5), UID2 = UID + 'b';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const post = async (u, b) => { const r = await fetch(ORIGIN + u, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const get = async (u) => { const r = await fetch(ORIGIN + u, { headers: H }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const pass = (uid) => get('/api/pass?uid=' + uid);
const buy = (uid, src, code) => post('/api/pass?uid=' + uid, { op: 'buy', src, code });
const claim = (uid, t, track) => post('/api/pass?uid=' + uid, { op: 'claim', t, track });

(async () => {
  const pub = await fetch(ORIGIN + '/api/pass').then(r => r.json());
  chk('guest: 20 tiers, prices, step 100, not signed in', pub && (pub.tiers || []).length === 20 && pub.price && pub.price.ticks === 2500 && pub.price.cents === 299 && pub.step === 100 && !pub.signedIn, pub && { n: (pub.tiers || []).length, price: pub.price });
  chk('guest: tier 20 free = Arctic, pro items at 5/10/15/20 ending on Leviathan', pub.tiers[19].free.item === 'arctic' && pub.tiers[4].pro.item === 'bg_static' && pub.tiers[19].pro.item === 'leviathan' && pub.tiers[0].free.ticks === 15 && pub.tiers[0].pro.ticks === 30);

  for (const u of [UID, UID2]) { const mk = await post('/api/admin/e2euser', { uid: u, op: 'mk' }); chk('member minted ' + u, mk.body && mk.body.ok); }
  const s0 = (await pass(UID)).body;
  chk('fresh member: tier 0, 100 XP to tier 1, nothing claimable, not pro', s0.tier === 0 && s0.xp === 0 && s0.next === 100 && s0.claimable === 0 && !s0.pro, { tier: s0.tier, xp: s0.xp, next: s0.next });
  const c0 = await claim(UID, 1, 'free');
  chk('claim before reaching the tier -> not_reached', c0.status === 409 && c0.body.error === 'not_reached', c0.body);
  const c1 = await claim(UID, 1, 'pro');
  chk('pro claim without a pass -> no_pass (once reached it still needs the pass)', c1.body.error === 'not_reached' || c1.body.error === 'no_pass', c1.body);

  // 250 season XP through the Academy: 10 lessons x 25
  const html = await fetch(ORIGIN + '/academy/?cb=' + Date.now()).then(r => r.text());
  const data = JSON.parse((html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/) || [])[1] || '{}');
  const ids = (data.courses || []).flatMap(c => c.lessons.map(l => l.id)).slice(0, 10);
  for (const id of ids) await post('/api/academy?uid=' + UID, { lesson: id, mistakes: 2 });
  const s1 = (await pass(UID)).body;
  // 10 lessons = 250 XP, +50 when they complete a whole course: the tier follows the real XP, so everything below is relative to it
  const T = s1.tier;
  chk('after 10 lessons: season XP >= 250, tier = floor(xp/100), claimable = tier', s1.xp >= 250 && T === Math.floor(s1.xp / 100) && s1.claimable === T && T >= 2, { xp: s1.xp, tier: T, claimable: s1.claimable });
  const f1 = await claim(UID, 1, 'free');
  chk('free tier 1 claimed: 15 Ticks', f1.body.ok && f1.body.ticks === 15 && f1.body.track === 'free', f1.body);
  const f1b = await claim(UID, 1, 'free');
  chk('claiming it again -> claimed', f1b.status === 409 && f1b.body.error === 'claimed', f1b.body);
  const f3 = await claim(UID, T + 1, 'free');
  chk('the tier above the current one is not reached yet', f3.body.error === 'not_reached' && f3.body.need === (T + 1) * 100, f3.body);
  const p1 = await claim(UID, 1, 'pro');
  chk('pro tier 1 without a pass -> no_pass', p1.status === 402 && p1.body.error === 'no_pass', p1.body);

  const bt = await buy(UID, 'ticks');
  chk('buy with Ticks with too few -> short_ticks (a fresh member holds far less than 2,500)', bt.body.error === 'short_ticks' && bt.body.need === 2500 && bt.body.have < 2500 && bt.body.have >= 15, bt.body);
  const bc = await buy(UID, 'code', 'MP-NOPE1-NOPE2');
  chk('bad code refused', bc.status === 404 && bc.body.error === 'bad_code', bc.body);

  const gen = await post('/api/admin/passcodes?e2e=1', { op: 'gen', n: 2, uses: 1, days: 1, note: 'e2e ' + UID });
  chk('ops: two 1-use codes generated', gen.body.ok && (gen.body.codes || []).length === 2 && /^MP-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(gen.body.codes[0]), gen.body);
  const [CODE, CODE2] = gen.body.codes;
  const rc = await buy(UID, 'code', CODE.toLowerCase());
  chk('redeem the code (case-insensitive) -> pro', rc.body.ok && rc.body.src === 'code', rc.body);
  const rc2 = await buy(UID2, 'code', CODE);
  chk('second member on the same 1-use code -> used_up', rc2.status === 409 && rc2.body.error === 'used_up', rc2.body);
  const rc3 = await buy(UID, 'code', CODE2);
  chk('a pro member cannot buy again -> already', rc3.status === 409 && rc3.body.error === 'already', rc3.body);
  const p1b = await claim(UID, 1, 'pro');
  chk('pro tier 1 claimed: 30 Ticks', p1b.body.ok && p1b.body.ticks === 30, p1b.body);
  const f2 = await claim(UID, 2, 'free');
  chk('free tier 2 claimed: 15 Ticks', f2.body.ok && f2.body.ticks === 15, f2.body);
  const s2 = (await pass(UID)).body;
  // reached T tiers, 2 tracks = 2T rewards; claimed so far: free 1, free 2, pro 1
  chk('state: pro, tiers 1 (both) and 2 (free) claimed, the rest still claimable', s2.pro && s2.tiers[0].free.claimed && s2.tiers[0].pro.claimed && s2.tiers[1].free.claimed && !s2.tiers[1].pro.claimed && s2.claimable === 2 * T - 3, { pro: s2.pro, claimable: s2.claimable, T });
  const list = await get('/api/admin/passcodes');
  const row = (list.body.codes || []).filter(c => c.code === CODE)[0];
  chk('ops list shows the code used 1/1 and the pro holder count', !!row && row.used === 1 && row.uses === 1 && list.body.holders >= 1, row && { used: row.used, holders: list.body.holders });
  const rv = await post('/api/admin/passcodes?e2e=1', { op: 'revoke', code: CODE2 });
  const rc4 = await buy(UID2, 'code', CODE2);
  chk('revoked code cannot be redeemed', rv.body.ok && rc4.status === 404 && rc4.body.error === 'bad_code', rc4.body);

  // ---- browser
  let guest = null, member = null;
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1280, height: 900 });
    await page.goto(ORIGIN + '/pass/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction("document.querySelectorAll('#grid .tier').length>=40", { timeout: 20000 }).catch(() => {});
    guest = await page.evaluate(() => ({ gate: !document.getElementById('gate').hidden, tiers: document.querySelectorAll('#grid .tier').length, buyHidden: document.getElementById('buyCard').hidden, scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, ends: document.getElementById('ends').textContent }));
    await ctx.close();

    const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage();
    await p2.setCacheEnabled(false); await p2.setBypassServiceWorker(true); await p2.setViewport({ width: 1280, height: 900 });
    await p2.setRequestInterception(true);
    p2.on('request', (req) => {
      if (req.url().indexOf('/api/pass') >= 0 && req.method() === 'GET') { const b = JSON.parse(JSON.stringify(s2)); b.signedIn = true; return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(b) }); }
      return req.continue();
    });
    await p2.goto(ORIGIN + '/pass/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await p2.waitForFunction("document.querySelectorAll('#grid [data-claim]').length>0", { timeout: 20000 }).catch(() => {});
    member = await p2.evaluate(() => { const b = document.querySelector('#grid [data-claim]'); if (!b) return { claim: false }; b.scrollIntoView({ block: 'center', inline: 'center' }); const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { claim: true, n: document.querySelectorAll('#grid [data-claim]').length, reach: !!(hit && b.contains(hit)), pro: !document.getElementById('proPill').hidden, tier: document.getElementById('tier').textContent, scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, gate: !document.getElementById('gate').hidden }; });
    await p2.screenshot({ path: path.join(__dirname, 'vault-shots', 'pass-member.png') });
    await ctx2.close();
  });
  chk('page: guest sees the gate and all 40 tier cells, no buy card, no horizontal page scroll', guest && guest.gate && guest.tiers === 40 && guest.buyHidden && !guest.scrollsX && guest.ends !== '—', guest);
  chk('page: pro member sees reachable Claim buttons for every remaining reward, the pro pill, the tier, no gate', member && member.claim && member.n === 2 * T - 3 && member.reach && member.pro && member.tier === String(T) && !member.scrollsX && !member.gate, member);

  for (const u of [UID, UID2]) await post('/api/admin/e2euser', { uid: u, op: 'rm' });
  const gone = (await pass(UID)).body;
  chk('cleanup: members scrubbed (tier 0, not pro)', gone.tier === 0 && !gone.pro);

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed  (uid ' + UID + ')');
  process.exit(bad ? 1 : 0);
})();

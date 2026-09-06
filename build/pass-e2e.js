/* Season pass E2E (2026-09-06). 20 tiers per 14-day season, one every 100 season XP. Free track: 15 Ticks a tier
   and the Arctic frame at 20. Pro track (2,500 Ticks, $2.99 from the rewards balance, or a code): 30 Ticks a tier
   plus Vault items, supplies (Shield / Surge), <= $1.00 of real money a season, 3 days of Premium and two skin-gift vouchers
   (2026-09-06). Claims are per tier per track, once; unclaimed reached tiers are granted at season end.

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
// browser requests to the site carry the admin key so pageviews / profile views / beacons from the test browser are tagged e2 (hidden from the owner's Activity read); third-party hosts never see the key
const tagE2 = (req) => { try { if (req.url().indexOf(ORIGIN) === 0 && !req.isInterceptResolutionHandled()) { req.continue({ headers: Object.assign({}, req.headers(), { 'x-admin-key': K }) }); return true; } } catch (e) {} return false; };

(async () => {
  const pub = await fetch(ORIGIN + '/api/pass').then(r => r.json());
  chk('guest: 20 tiers, prices, step 100, not signed in', pub && (pub.tiers || []).length === 20 && pub.price && pub.price.ticks === 2500 && pub.price.cents === 299 && pub.step === 100 && !pub.signedIn, pub && { n: (pub.tiers || []).length, price: pub.price });
  chk('guest: tier 20 free = Arctic, pro items at 5/10/15/20 ending on Leviathan', pub.tiers[19].free.item === 'arctic' && pub.tiers[4].pro.item === 'bg_static' && pub.tiers[19].pro.item === 'leviathan' && pub.tiers[0].free.ticks === 15 && pub.tiers[0].pro.ticks === 30);
  // 2026-09-06 (owner): the pro track carries real money (<= $1.00 a season, enforced in passTiers), supplies, Premium days and skin-gift vouchers
  const proCents = pub.tiers.reduce((a, t) => a + (t.pro.cents || 0), 0), freeCents = pub.tiers.reduce((a, t) => a + (t.free.cents || 0), 0);
  chk('pro track money: season total <= $1.00 cap, spread over several tiers, none on the free track', proCents > 0 && proCents <= 100 && pub.centsCap === 100 && pub.centsTotal === proCents && pub.tiers.filter(t => t.pro.cents > 0).length >= 3 && freeCents === 0, { proCents, cap: pub.centsCap, tiers: pub.tiers.filter(t => t.pro.cents).map(t => t.t + ':' + t.pro.cents) });
  chk('pro track extras: Streak Shield at 3, skin gift (300 T) at 6, XP Surge at 9, 3 days Premium at 11, skin gift (1,200 T) at 14', pub.tiers[2].pro.sup === 'shield' && pub.tiers[5].pro.gift === 300 && pub.tiers[8].pro.sup === 'surge' && pub.tiers[10].pro.prem === 3 && pub.tiers[13].pro.gift === 1200, pub.tiers.map(t => t.pro.sup || t.pro.gift || t.pro.prem || '').join(','));
  chk('names for every item and supply come from the catalogue', pub.names && pub.names.shield === 'Streak Shield' && pub.names.surge === 'XP Surge' && pub.names.leviathan === 'Leviathan' && pub.names.tkt_kraft === 'Kraft Stub', pub.names);
  const gi = pub.giftItems || [];
  chk('giftable skins: Ticks-priced only, <= 1,200 T, no supplies / nation frames / earn-only frames, frames + tickets + backgrounds present', gi.length >= 20 && gi.every(i => i.ticks > 0 && i.ticks <= 1200 && i.kind !== 'c' && !/^nat_/.test(i.id)) && gi.some(i => i.kind === 'frame') && gi.some(i => i.kind === 't') && gi.some(i => i.kind === 'bg') && !gi.some(i => i.id === 'ice' || i.id === 'streak7' || i.id === 'realtrader'), { n: gi.length, kinds: gi.reduce((a, i) => { a[i.kind] = (a[i.kind] || 0) + 1; return a; }, {}) });

  for (const u of [UID, UID2]) { const mk = await post('/api/admin/e2euser', { uid: u, op: 'mk' }); chk('member minted ' + u, mk.body && mk.body.ok); }
  const s0 = (await pass(UID)).body;
  chk('fresh member: tier 0, 100 XP to tier 1, nothing claimable, not pro', s0.tier === 0 && s0.xp === 0 && s0.next === 100 && s0.claimable === 0 && !s0.pro, { tier: s0.tier, xp: s0.xp, next: s0.next });
  const c0 = await claim(UID, 1, 'free');
  chk('claim before reaching the tier -> not_reached', c0.status === 409 && c0.body.error === 'not_reached', c0.body);
  const c1 = await claim(UID, 1, 'pro');
  chk('pro claim without a pass -> no_pass (once reached it still needs the pass)', c1.body.error === 'not_reached' || c1.body.error === 'no_pass', c1.body);

  // 600+ season XP through the Academy: 24 lessons x 25 (reaches tier 6 = the first skin-gift voucher, past the $0.10 tier and the Shield tier)
  const html = await fetch(ORIGIN + '/academy/?cb=' + Date.now()).then(r => r.text());
  const data = JSON.parse((html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/) || [])[1] || '{}');
  const ids = (data.courses || []).flatMap(c => c.lessons.map(l => l.id)).slice(0, 24);
  for (const id of ids) await post('/api/academy?uid=' + UID, { lesson: id, mistakes: 2 });
  const s1 = (await pass(UID)).body;
  // 24 lessons = 600 XP, +50 per whole course completed: the tier follows the real XP, so everything below is relative to it
  const T = s1.tier;
  chk('after 24 lessons: season XP >= 600, tier = floor(xp/100), claimable = tier', s1.xp >= 600 && T === Math.floor(s1.xp / 100) && s1.claimable === T && T >= 6, { xp: s1.xp, tier: T, claimable: s1.claimable });
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
  chk('redeem the code (case-insensitive) -> pro', rc.body.ok && rc.body.kind === 'pass', rc.body); // since 2026-09-06 codes go through /code/redeem (kind: pass | cents | premium | ticks)
  const rc2 = await buy(UID2, 'code', CODE);
  chk('second member on the same 1-use code -> used_up', rc2.status === 409 && rc2.body.error === 'used_up', rc2.body);
  const rc3 = await buy(UID, 'code', CODE2);
  chk('the second code of the same drop is refused for the member who already took one (batch_taken; one code per drop per account, 2026-09-06)', rc3.status === 409 && rc3.body.error === 'batch_taken', rc3.body);
  const p1b = await claim(UID, 1, 'pro');
  chk('pro tier 1 claimed: 30 Ticks', p1b.body.ok && p1b.body.ticks === 30, p1b.body);
  const f2 = await claim(UID, 2, 'free');
  chk('free tier 2 claimed: 15 Ticks', f2.body.ok && f2.body.ticks === 15, f2.body);
  const s2 = (await pass(UID)).body;
  // reached T tiers, 2 tracks = 2T rewards; claimed so far: free 1, free 2, pro 1
  chk('state: pro, tiers 1 (both) and 2 (free) claimed, the rest still claimable', s2.pro && s2.tiers[0].free.claimed && s2.tiers[0].pro.claimed && s2.tiers[1].free.claimed && !s2.tiers[1].pro.claimed && s2.claimable === 2 * T - 3, { pro: s2.pro, claimable: s2.claimable, T });
  // ---- the richer pro track (2026-09-06): a supply, real money, a skin-gift voucher, and the voucher spent on another member
  const p3 = await claim(UID, 3, 'pro');
  chk('pro tier 3: 30 Ticks + Streak Shield banked (supply applied on claim)', p3.body.ok && p3.body.ticks === 30 && p3.body.sup === 'shield' && !p3.body.supErr, p3.body);
  const p4 = await claim(UID, 4, 'pro');
  chk('pro tier 4: $0.10 credited on the rewards ledger (credited flag + balance)', p4.body.ok && p4.body.cents === 10 && p4.body.credited === true && +p4.body.balanceUsd >= 0.10, p4.body);
  const ml = (await get('/api/admin/acctlog?uid=' + UID)).body;
  chk('money history: the pass cents show as a durable ledger row (gift, from pass, 10 cents)', (ml.rows || []).some(r => r.type === 'gift' && r.detail === 'pass' && r.amount === 10), (ml.rows || []).map(r => r.type + ':' + r.detail + ':' + r.amount));
  const p6 = await claim(UID, 6, 'pro');
  chk('pro tier 6: a skin-gift voucher (cap 300 T) with an id', p6.body.ok && p6.body.gift && p6.body.gift.cap === 300 && p6.body.gift.id > 0, p6.body);
  const s3 = (await pass(UID)).body;
  chk('state lists the voucher, unused, with the giftable catalogue beside it', (s3.gifts || []).length === 1 && !s3.gifts[0].used && s3.gifts[0].cap === 300 && s3.gifts[0].t === 6 && (s3.giftItems || []).length > 0, s3.gifts);
  const GID = s3.gifts[0].id;
  const gift = (uid, body) => post('/api/pass?uid=' + uid, Object.assign({ op: 'gift' }, body));
  const g1 = await gift(UID, { id: GID, to: 'e2e_' + UID, item: 'carbon' });
  chk('gift to yourself refused', g1.status === 400 && g1.body.error === 'self', g1.body);
  const g2 = await gift(UID, { id: GID, to: 'e2e_' + UID2, item: 'ice' });
  chk('an epic (3,000 T, also sold for cash) is over the 300 T cap -> not_giftable', g2.status === 400 && g2.body.error === 'not_giftable' && g2.body.cap === 300, g2.body);
  const g3 = await gift(UID, { id: GID, to: 'e2e_' + UID2, item: 'shield' });
  chk('a supply is never giftable', g3.body.error === 'not_giftable', g3.body);
  const g4 = await gift(UID, { id: GID, to: 'nobody_' + UID, item: 'carbon' });
  chk('unknown member -> no_target', g4.status === 404 && g4.body.error === 'no_target', g4.body);
  const g5 = await gift(UID, { id: GID, to: 'E2E_' + UID2, item: 'carbon' });
  chk('Carbon (300 T) sent to the second member (username case-insensitive): ok, names echoed', g5.body.ok && g5.body.item === 'carbon' && g5.body.to === 'e2e_' + UID2 && g5.body.from === 'e2e_' + UID && g5.body.name === 'Carbon', g5.body);
  const shop2 = (await get('/api/auth/shop?uid=' + UID2)).body;
  chk('the second member now OWNS Carbon (cosmetics row, verified from the store)', (shop2.owned || []).indexOf('carbon') >= 0, shop2.owned);
  const g6 = await gift(UID, { id: GID, to: 'e2e_' + UID2, item: 'jade' });
  chk('the same voucher cannot be spent twice', g6.status === 409 && g6.body.error === 'voucher_used', g6.body);
  const g7 = await gift(UID2, { id: GID, to: 'e2e_' + UID, item: 'jade' });
  chk('someone else cannot spend my voucher', g7.status === 404 && g7.body.error === 'no_voucher', g7.body);
  const s4 = (await pass(UID)).body;
  chk('state shows the voucher spent: to + item recorded', s4.gifts[0].used && s4.gifts[0].to === 'e2e_' + UID2 && s4.gifts[0].item === 'carbon', s4.gifts[0]);
  // the gift row is written by the store under the member; the claim row is written by the worker under the REQUEST's identity (the admin hook here), so it is looked up without the actor filter
  const act = (await get('/api/admin/activity?h=1&e2e=1&actor=u:e2e_' + UID)).body, actAll = (await get('/api/admin/activity?h=1&e2e=1&n=2000')).body;
  const giftRows = (act.rows || []).filter(r => r.t === 'pass'), claimRows = (actAll.rows || []).filter(r => r.t === 'pass' && /claim 4 pro \+\$0\.10/.test(r.e || ''));
  chk('live activity: the gift is a pass row under the member, the $0.10 claim is a pass row with the amount', giftRows.some(r => /gift Carbon -> @e2e_/.test(r.e || '')) && claimRows.length >= 1, { gift: giftRows.map(r => r.e), claim: claimRows.map(r => r.e) });

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
    await page.setRequestInterception(true); page.on('request', (req) => tagE2(req) || req.continue()); // every same-origin beacon carries the admin key -> rows are e2-tagged, never in the owner's daily read
    await page.goto(ORIGIN + '/season/?cb=' + Date.now() + '#pass', { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction("document.querySelectorAll('#road .tier').length>=40", { timeout: 20000 }).catch(() => {});
    guest = await page.evaluate(() => ({ gate: !document.getElementById('gate').hidden, tiers: document.querySelectorAll('#road .tier').length, buyHidden: document.getElementById('buy').hidden, scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, ends: document.getElementById('ends').textContent, fill: parseFloat(document.getElementById('roadFill').style.width) || 0 }));
    await ctx.close();

    // simulated pro member: the page's own /api/pass + /api/auth/* are answered from the state minted above;
    // claims are answered too (and mutate the state) so "Claim all" can be exercised end-to-end in the DOM.
    const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
    const st = JSON.parse(JSON.stringify(s2)); st.signedIn = true;
    st.gifts = [{ id: 7, season: st.season.idx, t: 6, cap: 300, ts: Date.now(), used: false, to: null, item: null }]; st.giftItems = pub.giftItems; st.names = pub.names; // one unspent voucher for the modal
    const recount = () => { st.claimable = st.tiers.reduce((a, t) => a + (t.reached ? (t.free.claimed ? 0 : 1) + (st.pro && !t.pro.claimed ? 1 : 0) : 0), 0); };
    recount();
    const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage();
    await p2.setCacheEnabled(false); await p2.setBypassServiceWorker(true); await p2.setViewport({ width: 1280, height: 900 });
    await p2.setRequestInterception(true);
    p2.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'e2e_' + UID, xp: 4100, level: LV } }) });
      if (u.indexOf('/api/auth/xp') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
      if (u.indexOf('/api/pass') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(st) });
      if (u.indexOf('/api/pass') >= 0 && req.method() === 'POST') {
        let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
        if (b.op === 'gift') { const g = st.gifts[0]; if (!g || g.used || g.id !== b.id) return req.respond({ status: 409, contentType: 'application/json', body: '{"error":"voucher_used"}' }); g.used = true; g.to = b.to; g.item = b.item; const it = (st.giftItems || []).filter(i => i.id === b.item)[0] || {}; return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: b.id, item: b.item, name: it.name || b.item, kind: it.kind || 'frame', to: b.to, from: 'e2e_' + UID }) }); }
        const t = st.tiers[b.t - 1]; if (b.op !== 'claim' || !t || !t.reached || t[b.track].claimed) return req.respond({ status: 400, contentType: 'application/json', body: '{"error":"bad"}' });
        t[b.track].claimed = true; recount();
        return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, t: b.t, track: b.track, ticks: t[b.track].ticks, item: t[b.track].item || null, cents: t[b.track].cents || 0, sup: t[b.track].sup || null, prem: t[b.track].prem || 0, gift: t[b.track].gift ? { id: 8, cap: t[b.track].gift } : null }) });
      }
      return tagE2(req) || req.continue();
    });
    await p2.goto(ORIGIN + '/season/?cb=' + Date.now() + '#pass', { waitUntil: 'networkidle2', timeout: 90000 });
    await p2.waitForFunction("document.querySelectorAll('#road [data-claim]').length>0 && parseFloat(document.getElementById('roadFill').style.width)>0", { timeout: 20000 }).catch(() => {});
    member = await p2.evaluate(() => {
      const road = document.getElementById('road'), nodes = road.querySelectorAll('.tier[data-t] .n');
      const c = (i) => nodes[i].parentNode.offsetLeft + nodes[i].offsetLeft + nodes[i].offsetWidth / 2;
      const b = document.querySelector('#road [data-claim]'); if (!b) return { claim: false };
      b.scrollIntoView({ block: 'center', inline: 'center' }); const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const cur = road.querySelector('.tier.cur .n');
      const cb = document.getElementById('codeBtn'); cb.scrollIntoView({ block: 'center' }); const cr = cb.getBoundingClientRect(); const chit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
      const gb = document.querySelector('#gifts [data-gift]'); let ghit = null; if (gb) { gb.scrollIntoView({ block: 'center' }); const gr = gb.getBoundingClientRect(); ghit = document.elementFromPoint(gr.left + gr.width / 2, gr.top + gr.height / 2); }
      return { claim: true, n: document.querySelectorAll('#road [data-claim]').length, reach: !!(hit && b.contains(hit)), pill: document.getElementById('passPill').textContent, tier: document.getElementById('meTier').textContent, scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, gate: !document.getElementById('gate').hidden, fill: document.getElementById('roadFill').offsetLeft + parseFloat(document.getElementById('roadFill').style.width), curCenter: cur ? cur.parentNode.offsetLeft + cur.offsetLeft + cur.offsetWidth / 2 : -1, nextCenter: cur ? c(Math.min(19, +cur.parentNode.getAttribute('data-t'))) : -1, claimAll: !document.getElementById('claimAll').hidden, claimAllT: document.getElementById('claimAll').textContent, scrollL: document.getElementById('roadWrap').scrollLeft,
        sum: document.querySelectorAll('#proSum em').length, sumText: document.getElementById('proSum').textContent, sumOneLine: document.getElementById('proSum').getBoundingClientRect().height < 20, gmEmpty: document.getElementById('gm').children.length === 0, idleInputs: Array.from(document.querySelectorAll('input')).filter(i => i.placeholder && /name/i.test(i.placeholder)).length, usdCells: document.querySelectorAll('#road .rw.pro .x.usd').length, giftCells: document.querySelectorAll('#road .rw.pro .x.gift').length, supCells: document.querySelectorAll('#road .rw.pro .x.sup').length, premCells: document.querySelectorAll('#road .rw.pro .x.prem').length,
        redeemReach: !!(chit && cb.contains(chit)), redeemInBuy: !!document.querySelector('#buy #codeIn'), buyOpts: document.querySelectorAll('#buy .opt').length, giftBtn: !!gb, giftReach: !!(ghit && gb.contains(ghit)) };
    });
    // Claim all: the road must update in place (same scroll position), every button gone, toast shown
    await p2.evaluate(() => { document.getElementById('claimAll').scrollIntoView({ block: 'center' }); });
    const before = await p2.evaluate(() => document.getElementById('roadWrap').scrollLeft);
    await p2.click('#claimAll');
    await p2.waitForFunction("document.querySelectorAll('#road [data-claim]').length===0 && document.getElementById('tst').classList.contains('on')", { timeout: 20000 }).catch(() => {});
    member.after = await p2.evaluate(() => ({ n: document.querySelectorAll('#road [data-claim]').length, scrollL: document.getElementById('roadWrap').scrollLeft, toast: document.getElementById('tst').textContent, claimed: document.querySelectorAll('#road .rw .done').length, claimAll: !document.getElementById('claimAll').hidden, toClaim: document.getElementById('meClaim').textContent }));
    member.after.before = before;
    await p2.screenshot({ path: path.join(__dirname, 'vault-shots', 'pass-member.png') });
    // the skin-gift modal: open from the voucher row, pick a skin, name a member, send -> toast, voucher row reads SENT
    await p2.evaluate(() => { const b = document.querySelector('#gifts [data-gift]'); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); } });
    await p2.waitForFunction("document.getElementById('gm').classList.contains('on') && document.querySelectorAll('#gmGrid [data-gi]').length>0", { timeout: 8000 }).catch(() => {});
    member.gm = await p2.evaluate(() => { const g = document.getElementById('gm'); const first = document.querySelector('#gmGrid [data-gi]'); const r = first ? first.getBoundingClientRect() : null; const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null; return { on: g.classList.contains('on'), tabs: document.querySelectorAll('#gmTabs button').length, items: document.querySelectorAll('#gmGrid [data-gi]').length, maxT: Math.max(...Array.from(document.querySelectorAll('#gmGrid .gi i')).map(i => parseInt(i.textContent.replace(/,/g, ''), 10) || 0)), cap: document.getElementById('gmCap').textContent, sendOff: document.getElementById('gmSend').disabled, firstReach: !!(hit && first && first.contains(hit)) }; });
    await new Promise(r => setTimeout(r, 400)); // let the 200 ms open transition finish so the shot shows the settled modal
    await p2.screenshot({ path: path.join(__dirname, 'vault-shots', 'pass-gift-modal.png') });
    await p2.evaluate(() => { const t = document.querySelector('#gmTabs [data-gk="t"]'); if (t) t.click(); });
    await p2.evaluate(() => { const f = document.querySelector('#gmGrid [data-gi]'); if (f) f.click(); });
    member.gm.afterPick = await p2.evaluate(() => ({ sel: !!document.querySelector('#gmGrid .gi.sel'), sendOn: !document.getElementById('gmSend').disabled, allTickets: Array.from(document.querySelectorAll('#gmGrid .gi small')).every(s => /ticket/.test(s.textContent)) }));
    await p2.type('#gmTo', 'e2e_' + UID2);
    await p2.click('#gmSend');
    await p2.waitForFunction("!document.getElementById('gm').classList.contains('on') && /got the/.test(document.getElementById('tst').textContent)", { timeout: 8000 }).catch(() => {});
    await p2.waitForFunction("/SENT/.test(document.getElementById('gifts').textContent)", { timeout: 8000 }).catch(() => {}); // the voucher row repaints after the page re-pulls /api/pass, a beat after the toast
    member.gm.sent = await p2.evaluate(() => ({ closed: !document.getElementById('gm').classList.contains('on'), toast: document.getElementById('tst').textContent, rowSent: /SENT/.test(document.getElementById('gifts').textContent), give0: /0 to give/.test(document.getElementById('gifts').textContent) }));
    await ctx2.close();
  });
  chk('page: guest sees the gate and all 40 tier cells, no buy card, empty fill, no horizontal page scroll', guest && guest.gate && guest.tiers === 40 && guest.buyHidden && guest.fill === 0 && !guest.scrollsX && guest.ends !== '—', guest);
  chk('page: pro member sees reachable Claim buttons for every remaining reward, PRO pill, tier, Claim all, no gate', member && member.claim && member.n === 2 * T - 3 && member.reach && /pro/i.test(member.pill) && member.tier === T + '/20' && member.claimAll && member.claimAllT === 'Claim all ' + (2 * T - 3) && !member.scrollsX && !member.gate, member);
  chk('page: the road fill ends between the reached tier node and the next one (measured from node centers, not a %; fill = its left offset + width)', member && member.nextCenter > member.curCenter + 50 && member.fill >= member.curCenter - 1 && member.fill <= member.nextCenter + 1, member && { fill: member.fill, cur: member.curCenter, next: member.nextCenter });
  chk('page: Claim all claims every reward in place: 0 buttons left, toast, scroll kept, counter 0', member && member.after && member.after.n === 0 && /Claimed/.test(member.after.toast) && Math.abs(member.after.scrollL - member.after.before) < 2 && member.after.claimed >= 2 * T - 3 && !member.after.claimAll && member.after.toClaim === '0', member && member.after);
  chk('page: the pro track sums itself up in ONE muted label line (Ticks, $, items, supplies, Premium, gifts), no chips; every extra is drawn in its tier cell', member && member.sum >= 6 && member.sumOneLine && /\$1\.00/.test(member.sumText) && /Premium/.test(member.sumText) && /skin gift/.test(member.sumText) && member.usdCells === 5 && member.giftCells === 2 && member.supCells === 4 && member.premCells === 1, member && { sum: member.sum, oneLine: member.sumOneLine, text: member.sumText, usd: member.usdCells, gift: member.giftCells, sup: member.supCells, prem: member.premCells });
  chk('page: the gift modal is EMPTY until opened (no idle "name" input for iOS to autofill on load)', member && member.gmEmpty && member.idleInputs === 0, member && { gmEmpty: member.gmEmpty, idleInputs: member.idleInputs });
  chk('page: one redeem box for every code, outside the pro purchase card, reachable; the buy card has only Ticks + balance', member && member.redeemReach && !member.redeemInBuy && member.buyOpts === 2, member && { reach: member.redeemReach, inBuy: member.redeemInBuy, opts: member.buyOpts });
  chk('page: the voucher row shows a reachable Choose button', member && member.giftBtn && member.giftReach, member && { btn: member.giftBtn, reach: member.giftReach });
  chk('page: gift modal opens with tabs + skins at or under the cap (300 T), first skin reachable, Send disabled until a pick', member && member.gm && member.gm.on && member.gm.tabs >= 3 && member.gm.items >= 10 && member.gm.maxT <= 300 && /300 T/.test(member.gm.cap) && member.gm.sendOff && member.gm.firstReach, member && member.gm);
  chk('page: Tickets tab filters to tickets, a pick selects and enables Send', member && member.gm && member.gm.afterPick && member.gm.afterPick.sel && member.gm.afterPick.sendOn && member.gm.afterPick.allTickets, member && member.gm && member.gm.afterPick);
  chk('page: sending closes the modal, toasts "@name got the ...", the voucher row reads SENT and 0 to give', member && member.gm && member.gm.sent && member.gm.sent.closed && /got the/.test(member.gm.sent.toast) && member.gm.sent.rowSent && member.gm.sent.give0, member && member.gm && member.gm.sent);

  for (const u of [UID, UID2]) await post('/api/admin/e2euser', { uid: u, op: 'rm' });
  const gone = (await pass(UID)).body;
  chk('cleanup: members scrubbed (tier 0, not pro)', gone.tier === 0 && !gone.pro);

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed  (uid ' + UID + ')');
  process.exit(bad ? 1 : 0);
})();

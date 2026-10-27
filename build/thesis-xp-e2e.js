/* thesis-xp-e2e (2026-10-26, owner: "po tezi mogu da zarade xp ako neko kupi coin o kom je neko pisao ... daily cap 1000 xp").
   Two throwaway members. A publishes a thesis naming SOL; B buys $100 of SOL on Demo Spot -> A is paid THESIS_BUY_XP once,
   the buy's response names the credited thesis, A's XP really rose, A's bell carries the line. B buys SOL again -> nothing
   more (one buyer pays an author once per thesis). A buys SOL -> nothing (an author cannot pay themselves). A $10 buy by a
   third member -> nothing (under the $25 floor). The season-reset desk answers a DRY RUN and never moves money here.
   Cleans up both members (the thesis post goes with its author). Needs ADMIN_KEY.local.txt.   node build/thesis-xp-e2e.js */
const fs = require('fs'), path = require('path');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io', H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 300) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const M = [{ uid: 'e2e-thxa' }, { uid: 'e2e-thxb' }, { uid: 'e2e-thxc' }].map(m => ({ ...m, un: 'e2e_' + m.uid }));
(async () => {
  for (const m of M) {
    await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: m.uid, op: 'rm' }) }).catch(() => {});
    await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: m.uid, op: 'mk' }) });
    const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: m.uid, op: 'sess' }) });
    m.MH = { cookie: 'mp_sess=' + (se.token || se.sess), 'content-type': 'application/json' };
    m.spot = (p, body) => fetch(B + '/api/spot' + p, { method: body ? 'POST' : 'GET', headers: m.MH, body: body ? JSON.stringify(body) : undefined }).then(r => r.json());
    const who = await J('/api/admin/xpdiag?u=' + encodeURIComponent(m.un), { headers: H }); m.id = who && who.user && who.user.id;
    await m.spot('/start', {});
  }
  const xpOf = async m => { const d = await J('/api/admin/xpdiag?u=' + encodeURIComponent(m.un), { headers: H }); return d && d.user ? +d.user.xp_life || +d.user.xp || 0 : null; };
  const [A, Bm, C] = M;
  ok(A.id && Bm.id && C.id, 'three throwaway members minted with Demo Spot accounts');
  // A THESIS IS ABOUT A COIN YOU HOLD (2026-10-27, owner): a thesis naming a coin the author does not hold is refused before
  // it reaches the Community DO, and a holder's thesis goes through. A holds nothing yet -> refused; then A buys SOL and publishes.
  const bodyEarly = ('I hold SOL on Demo Spot because the trend on the daily chart is still up and every pullback to the twenty day average has been bought for six weeks. The thesis is simple: as long as price holds above the last swing low I stay in, and if it closes below that level for two days in a row I am out. ').repeat(3);
  const th0 = await J('/api/comm/post', { method: 'POST', headers: A.MH, body: JSON.stringify({ title: 'E2E thesis: why this demo account holds SOL this season', body: bodyEarly, cat: 'thesis', syms: 'SOL' }) });
  ok(th0 && th0.error === 'no_holdings', 'a member who holds nothing cannot publish a thesis (no_holdings)', th0);
  const a0 = await A.spot('/trade', { side: 'buy', kind: 'cex', sym: 'SOL', usd: 50 });
  ok(a0 && a0.ok, 'A buys $50 of SOL first', a0 && { ok: a0.ok, error: a0.error });
  const th1 = await J('/api/comm/post', { method: 'POST', headers: A.MH, body: JSON.stringify({ title: 'E2E thesis: why this demo account holds BTC this season', body: bodyEarly, cat: 'thesis', syms: 'BTC' }) });
  ok(th1 && th1.error === 'not_held' && Array.isArray(th1.coins) && th1.coins[0] === 'BTC', 'a thesis naming a coin A does NOT hold is refused (not_held) and names the coin', th1);
  const xpA0 = await xpOf(A);
  const body = ('I hold SOL on Demo Spot because the trend on the daily chart is still up and every pullback to the twenty day average has been bought for six weeks. The thesis is simple: as long as price holds above the last swing low I stay in, and if it closes a daily candle below it I am wrong and I sell the position whole. The level that proves me wrong is the one marked on my chart, not a feeling. I am sizing this at fifteen percent of the account so a loss there costs about two percent of the portfolio. ').repeat(2).trim();
  const th = await J('/api/comm/post', { method: 'POST', headers: A.MH, body: JSON.stringify({ title: 'E2E thesis: why this demo account holds SOL this season', body, cat: 'thesis', syms: 'SOL' }) });
  ok(th && th.ok && th.id && th.reward && th.reward.xp >= 0, 'A publishes a thesis naming SOL (the reward rides on the response)', th && { id: th.id, reward: th.reward });
  const xpA1 = await xpOf(A);
  ok(xpA1 - xpA0 === (th.reward && th.reward.xp), 'publishing paid exactly what the response said (' + (th.reward && th.reward.xp) + ' XP)', { before: xpA0, after: xpA1 });
  // B buys $100 of SOL -> the author is credited once
  const b1 = await Bm.spot('/trade', { side: 'buy', kind: 'cex', sym: 'SOL', usd: 100 });
  ok(b1 && b1.ok && Array.isArray(b1.thesis) && b1.thesis.some(t => t.pid === th.id && t.xp === 25), 'B buys $100 SOL: the response names the credited thesis with +25 XP to its author', b1 && { ok: b1.ok, thesis: b1.thesis });
  await sleep(1500);
  const xpA2 = await xpOf(A);
  ok(xpA2 - xpA1 === 25, 'LOAD-BEARING: the author really has 25 XP more', { before: xpA1, after: xpA2 });
  const bell = await J('/api/auth/notifs?uid=' + encodeURIComponent(A.id), { headers: H });
  const row = ((bell && (bell.notifs || bell.rows || bell.items)) || []).find(n => /bought SOL after reading your thesis/.test(JSON.stringify(n)));
  ok(!!row, 'the author\'s bell carries "bought SOL after reading your thesis: +25 XP" with a link to the Theses view', row ? JSON.stringify(row).slice(0, 160) : (bell && Object.keys(bell)));
  // the same buyer again -> no second credit
  const b2 = await Bm.spot('/trade', { side: 'buy', kind: 'cex', sym: 'SOL', usd: 100 });
  ok(b2 && b2.ok && !(b2.thesis && b2.thesis.length), 'the same buyer buying again credits nothing more (one buyer, one credit per thesis)', b2 && { ok: b2.ok, thesis: b2.thesis });
  // the author buying their own coin -> nothing
  const b3 = await A.spot('/trade', { side: 'buy', kind: 'cex', sym: 'SOL', usd: 100 });
  ok(b3 && b3.ok && !(b3.thesis && b3.thesis.length), 'the author buying the coin credits nobody', b3 && { ok: b3.ok, thesis: b3.thesis });
  // a $10 buy -> under the $25 floor, nothing
  const b4 = await C.spot('/trade', { side: 'buy', kind: 'cex', sym: 'SOL', usd: 10 });
  ok(b4 && b4.ok && !(b4.thesis && b4.thesis.length), 'a $10 buy is under the $25 floor and credits nothing', b4 && { ok: b4.ok, thesis: b4.thesis });
  const b5 = await C.spot('/trade', { side: 'buy', kind: 'cex', sym: 'SOL', usd: 50 });
  ok(b5 && b5.ok && Array.isArray(b5.thesis) && b5.thesis.some(t => t.pid === th.id), 'a second distinct buyer at $50 credits the author again', b5 && { thesis: b5.thesis });
  await sleep(1200);
  const xpA3 = await xpOf(A);
  // A's OWN buy above also earned the ordinary Demo Spot buy XP, so the total is read off the bell: exactly two thesis credits, and the XP rose by at least both
  const bell2 = await J('/api/auth/notifs?uid=' + encodeURIComponent(A.id), { headers: H });
  const thn = ((bell2 && (bell2.notifs || bell2.rows || bell2.items)) || []).filter(n => /after reading your thesis: \+25 XP/.test(JSON.stringify(n))).length;
  ok(thn === 2 && xpA3 - xpA2 >= 25, 'two distinct buyers = two thesis credits of 25 XP (the author\'s own buy earned the ordinary buy XP beside them)', { credits: thn, after1: xpA2, after2: xpA3 });
  // the pay table is published with the list
  const list = await J('/api/spot/theses?n=30&cb=' + Date.now());
  ok(list && list.pays && list.pays.publishXp === 50 && list.pays.perBuyerXp === 25 && list.pays.dailyCapXp === 1000 && list.pays.windowDays === 14 && list.pays.minBuyUsd === 25 && (list.rows || []).length <= 30, '/api/spot/theses?n=30 publishes the pay table (50 publish, 25 per buyer, 1,000 a day, 14 days, $25 floor) and up to thirty rows', list && list.pays);
  ok(!(list.rows || []).some(r => /^e2e_/i.test(r.author)), 'the public list never shows a test author');
  // the season-reset desk is a DRY RUN by default and moved nothing
  const dr = await J('/api/admin/spotreset', { method: 'POST', headers: H, body: JSON.stringify({}) });
  const pA = await A.spot('/portfolio');
  ok(dr && dr.ok && dr.dry === true && dr.accounts > 0 && dr.applied === false && pA && (pA.holds || []).length === 1, 'POST /api/admin/spotreset with no apply:true is a dry run - it counts the accounts and bags and moves nothing', { dr: dr && { dry: dr.dry, accounts: dr.accounts, bags: dr.holdRows }, holds: pA && pA.holds.length });
  for (const m of M) await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: m.uid, op: 'rm' }) });
  console.log(out.join('\n')); console.log('\nthesis-xp-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exitCode = 1; });

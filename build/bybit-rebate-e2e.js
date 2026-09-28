/* bybit-rebate-e2e (2026-09-28): THE BYBIT POOL IS A SHARE OF THE COMMISSION THE BOARD EARNED, AND IT IS PAID TO THE CENT.
   A throwaway member registers a test UID; reports with a known commission are stored on a PAST season (never paid, never public),
   and the admin view must answer with the pool the payer would use: min(cap, share x commission), the tier by size, the number of
   ranks that tier pays, prizes that add up to the pool exactly, zeros beyond the paid ranks. Then the live surfaces: the config
   carries the knobs, /api/reward/lb carries bybitPool + a ten-slot split, /api/competition names the pool as a rebate.
   Needs ADMIN_KEY.local.txt (the mpadm_ token). Cleans up after itself.                          node build/bybit-rebate-e2e.js */
const fs = require('fs');
const KEY = (fs.readFileSync(require('path').join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 240) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json());
const WS = Date.UTC(2026, 6, 20); // the first season on the grid - long over, before BYBIT_LB_START, so payBybitPrizes never touches it
const UID = 'e2e-rebate1', TU = '9999' + String(Date.now()).slice(-8);
const near = (a, b) => Math.abs(a - b) < 0.006;
(async () => {
  const cfg = await J('/api/reward/config', { headers: H });
  const c = (cfg && cfg.config) || {};
  ok(c.bybitShare === 0.52 && c.bybitCap === 100 && Array.isArray(c.bybitSplit) && c.bybitSplit.join() === '50,25,10,5,5,1,1,1,1,1' && Array.isArray(c.bybitTiers) && c.bybitTiers.length === 4, 'config: share 52%, cap $100, split 50/25/10/5/5/1x5, four tiers', { share: c.bybitShare, cap: c.bybitCap, split: c.bybitSplit });
  ok(!('lbBybit' in c) || c.lbBybit == null, 'the old fixed lbBybit array is gone from the config');
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) }).catch(() => {});
  const mk = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'mk' }) });
  const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'sess' }) });
  const MH = { cookie: 'mp_sess=' + (se.token || se.sess), 'content-type': 'application/json' };
  const reg = await J('/api/reward/bybitlink', { method: 'POST', headers: MH, body: JSON.stringify({ uid: TU }) });
  ok(mk && reg && reg.ok, 'throwaway member registers a test UID', reg);
  await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ clear: true }) });
  // one row on the past season, with a commission - the pool follows it through the tiers
  const cases = [
    { com: 10, usd: 5.2, tier: 'Warming up', paid: 3 },
    { com: 30, usd: 15.6, tier: 'Heating up', paid: 5 },
    { com: 60, usd: 31.2, tier: 'Hot', paid: 10 },
    { com: 120, usd: 62.4, tier: 'On fire', paid: 10 },
    { com: 400, usd: 100, tier: 'On fire', paid: 10, maxed: true },
  ];
  for (const k of cases) {
    const up = await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ rows: [{ uid: TU, vol: 12345.67, com: k.com }], final: false }) });
    const adm = await J('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: H });
    const P = adm && adm.poolAll;
    ok(up && up.ok && P && near(P.usd, k.usd) && P.tier.name === k.tier && P.tier.paid === k.paid && !!P.maxed === !!k.maxed, 'commission $' + k.com + ' -> pool $' + k.usd + ' (' + k.tier + ', top ' + k.paid + (k.maxed ? ', maxed' : '') + ')', P && { usd: P.usd, tier: P.tier.name, paid: P.tier.paid, maxed: P.maxed });
    const sum = (P ? P.prizes : []).reduce((a, x) => a + Math.round(x * 100), 0) / 100;
    ok(P && P.prizes.length === 10 && near(sum, P.usd) && P.prizes.slice(k.paid).every(x => x === 0) && P.prizes.slice(0, k.paid).every(x => x > 0), '  prizes: ten slots, the paid ones add up to the pool to the cent, the rest are zero', P && P.prizes);
    ok(P && P.prizes[0] >= P.prizes[1] && P.prizes[1] >= P.prizes[2], '  rank 1 >= rank 2 >= rank 3', P && P.prizes.slice(0, 3));
    ok(adm && adm.pool && adm.pool.usd === 0, '  the PUBLIC pool for that season stays $0 (a test account never earns anyone a prize)', adm && adm.pool && adm.pool.usd);
  }
  // the split on a $5.20 pool over three ranks: 50/25/10 normalised = 58.82 / 29.41 / 11.76 % -> 3.06 / 1.53 / 0.61 (rounding cent to the top)
  await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ rows: [{ uid: TU, vol: 1, com: 10 }], final: false }) });
  const a5 = await J('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: H });
  ok(a5.poolAll && a5.poolAll.prizes.slice(0, 3).join() === '3.06,1.53,0.61', 'the three-rank split of $5.20 is 3.06 / 1.53 / 0.61', a5.poolAll && a5.poolAll.prizes.slice(0, 3));
  // a typed volume keeps the commission the API recorded
  const pv = await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ manual: TU + ',777.77' }) });
  const a6 = await J('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: H });
  const row6 = (a6.matched || []).find(r => r.buid === TU);
  ok(pv && pv.ok && row6 && row6.vol === 777.77 && row6.com === 10, 'a hand-typed volume keeps the commission already recorded for that UID', row6 && { vol: row6.vol, com: row6.com });
  // live surfaces
  const lb = await J('/api/reward/lb?nc=1&cb=' + Date.now());
  ok(lb && lb.bybitPool && typeof lb.bybitPool.usd === 'number' && lb.bybitPool.share === 0.52 && lb.bybitPool.tier && Array.isArray(lb.boardPrizes.bybit) && lb.boardPrizes.bybit.length === 10 && Array.isArray(lb.bybitTiers), '/api/reward/lb: bybitPool (usd, share, tier), boardPrizes.bybit = ten slots, bybitTiers', lb && lb.bybitPool && { usd: lb.bybitPool.usd, tier: lb.bybitPool.tier.name });
  const comp = await J('/api/competition?cb=' + Date.now());
  const bb = comp && (comp.boards || []).find(b => b.id === 'bybit');
  ok(bb && bb.pool && bb.pool.rebate === true && bb.pool.share_of_commission === 0.52 && bb.pool.cap_usd === 100 && Array.isArray(bb.prize_usd_ranks) && bb.prize_usd_ranks.length === 10 && near(bb.prize_pool_usd, lb.bybitPool.usd), '/api/competition: the Bybit board is a rebate, same pool as /lb, ten ranks', bb && { pool: bb.prize_pool_usd, how: (bb.pool || {}).how });
  ok(comp && comp.prize_pool_usd_per_season >= 170 && comp.prize_pool_usd_per_season < 170 + 100.01, 'the season total is $170 of fixed prizes plus the pool', comp && comp.prize_pool_usd_per_season);
  const season = await fetch(B + '/season/?cb=' + Date.now()).then(r => r.text());
  ok(/function bybPool\(/.test(season) && /data-tier=/.test(season) && /The prize pool is a rebate: 52%/.test(season) && !/\$200/.test(season), '/season/: pool helpers, tier attribute, the rebate rule, no $200 left');
  const lbp = await fetch(B + '/leaderboards/?cb=' + Date.now()).then(r => r.text());
  ok(/OF FEES BACK/.test(lbp) && /thePoolIsA/.test(lbp) && !/\$200/.test(lbp), '/leaderboards/: the tab says 52% of fees back, the rule is there, no $200 left');
  // clean up
  await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ clear: true }) });
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) });
  const gone = await J('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: H });
  ok(gone && (!gone.upload || gone.upload.n === 0) && gone.poolAll && gone.poolAll.usd === 0, 'past-season report cleared, member removed');
  console.log(out.join('\n')); console.log('\nbybit-rebate-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

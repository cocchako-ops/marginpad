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
  ok(c.bybitShare === 0.52 && c.bybitBase === 100 && c.bybitCap === 1000 && Array.isArray(c.bybitSplit) && c.bybitSplit.join() === '50,25,10,5,5,1,1,1,1,1' && Array.isArray(c.bybitTiers) && c.bybitTiers.length === 5 && c.bybitTiers.every(t => t.paid === 10), 'config: base $100, share 52%, cap $1000, split 50/25/10/5/5/1x5, five volume tiers all paying ten', { share: c.bybitShare, base: c.bybitBase, cap: c.bybitCap, split: c.bybitSplit });
  ok(!('lbBybit' in c) || c.lbBybit == null, 'the old fixed lbBybit array is gone from the config');
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) }).catch(() => {});
  const mk = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'mk' }) });
  const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'sess' }) });
  const MH = { cookie: 'mp_sess=' + (se.token || se.sess), 'content-type': 'application/json' };
  const reg = await J('/api/reward/bybitlink', { method: 'POST', headers: MH, body: JSON.stringify({ uid: TU }) });
  ok(mk && reg && reg.ok, 'throwaway member registers a test UID', reg);
  await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ clear: true }) });
  // one row on the past season, with a commission - the pool follows it through the tiers
  const cases = [ // {com, vol} -> pool = 100 + 0.52 x com, tier by volume, all ten paid
    { com: 0, vol: 0, usd: 100, tier: 'Warming up', per: 11.65 },
    { com: 10, vol: 50000, usd: 105.2, tier: 'Warming up', per: 10.4 },
    { com: 30, vol: 120000, usd: 115.6, tier: 'Heating up', per: 13 },
    { com: 60, vol: 300000, usd: 131.2, tier: 'Hot', per: 10.4 },
    { com: 120, vol: 600000, usd: 162.4, tier: 'On fire', per: 10.4 },
    { com: 400, vol: 1500000, usd: 308, tier: 'Inferno', per: 13.87 },
    { com: 2000, vol: 9000000, usd: 1000, tier: 'Inferno', maxed: true, per: 11.56 },
  ];
  for (const k of cases) {
    const up = await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ rows: [{ uid: TU, vol: k.vol, com: k.com }], final: false }) });
    const adm = await J('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: H });
    const P = adm && adm.poolAll;
    ok(up && up.ok && P && near(P.usd, k.usd) && P.base === 100 && near(P.fromVolume, Math.max(0, k.usd - 100)) && P.tier.name === k.tier && P.tier.paid === 10 && !!P.maxed === !!k.maxed && near(P.perHundredK, k.per), 'commission $' + k.com + ' on $' + k.vol + ' -> pool $' + k.usd + ' (' + k.tier + ', about $' + k.per + ' per $100k' + (k.maxed ? ', maxed' : '') + ')', P && { usd: P.usd, from: P.fromVolume, tier: P.tier.name, per: P.perHundredK, maxed: P.maxed });
    const sum = (P ? P.prizes : []).reduce((a, x) => a + Math.round(x * 100), 0) / 100;
    ok(P && P.prizes.length === 10 && near(sum, P.usd) && P.prizes.every(x => x > 0), '  prizes: ten slots, all paid, adding up to the pool to the cent', P && P.prizes);
    ok(P && P.prizes[0] >= P.prizes[1] && P.prizes[1] >= P.prizes[2], '  rank 1 >= rank 2 >= rank 3', P && P.prizes.slice(0, 3));
    ok(adm && adm.pool && adm.pool.usd === 100 && adm.pool.fromVolume === 0, '  the PUBLIC pool for that season stays at the $100 base (a test account never grows anyone\'s prize)', adm && adm.pool && adm.pool.usd);
  }
  // the start split of $100 over ten ranks: 50 / 25 / 10 / 5 / 5 / 1 x 5
  await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ rows: [{ uid: TU, vol: 1, com: 0 }], final: false }) });
  const a5 = await J('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: H });
  ok(a5.poolAll && a5.poolAll.prizes.join() === '50,25,10,5,5,1,1,1,1,1', 'the start split of $100 is 50 / 25 / 10 / 5 / 5 / 1 x 5', a5.poolAll && a5.poolAll.prizes);
  // a typed volume keeps the commission the API recorded
  const pv = await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ manual: TU + ',777.77' }) });
  const a6 = await J('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: H });
  const row6 = (a6.matched || []).find(r => r.buid === TU);
  ok(pv && pv.ok && row6 && row6.vol === 777.77 && row6.com === 0, 'a hand-typed volume keeps the commission already recorded for that UID', row6 && { vol: row6.vol, com: row6.com });
  // live surfaces
  const lb = await J('/api/reward/lb?nc=1&cb=' + Date.now());
  ok(lb && lb.bybitPool && lb.bybitPool.usd >= 100 && lb.bybitPool.base === 100 && lb.bybitPool.share === 0.52 && lb.bybitPool.tier && Array.isArray(lb.boardPrizes.bybit) && lb.boardPrizes.bybit.length === 10 && lb.boardPrizes.bybit[0] >= 50 && Array.isArray(lb.bybitTiers), '/api/reward/lb: bybitPool (usd >= 100, base, share, tier), boardPrizes.bybit = ten slots from $50 down, bybitTiers', lb && lb.bybitPool && { usd: lb.bybitPool.usd, tier: lb.bybitPool.tier.name });
  const comp = await J('/api/competition?cb=' + Date.now());
  const bb = comp && (comp.boards || []).find(b => b.id === 'bybit');
  ok(bb && bb.pool && bb.pool.rebate === true && bb.pool.base_usd === 100 && bb.pool.share_of_commission === 0.52 && typeof bb.pool.per_100k_volume_usd === 'number' && Array.isArray(bb.prize_usd_ranks) && bb.prize_usd_ranks.length === 10 && near(bb.prize_pool_usd, lb.bybitPool.usd), '/api/competition: the Bybit board starts at $100 and states its growth per $100k, same pool as /lb, ten ranks', bb && { pool: bb.prize_pool_usd, how: (bb.pool || {}).how });
  ok(comp && comp.prize_pool_usd_per_season >= 270, 'the season total is at least $270 ($170 fixed + the $100 Bybit start)', comp && comp.prize_pool_usd_per_season);
  const season = await fetch(B + '/season/?cb=' + Date.now()).then(r => r.text());
  ok(/function bybPool\(/.test(season) && /data-tier=/.test(season) && /The pool starts at \$100 every season/.test(season) && /\$50, \$25, \$10, \$5, \$5 and \$1 each/.test(season) && !/\$200/.test(season), '/season/: pool helpers, tier attribute, the $100-start rule with the per-rank split, no $200 left');
  const lbp = await fetch(B + '/leaderboards/?cb=' + Date.now()).then(r => r.text());
  ok(/START · GROWS WITH VOLUME/.test(lbp) && /\$100 is the start, volume adds to it/.test(lbp) && !/\$200/.test(lbp), '/leaderboards/: the tab says $100 start, the rule says volume adds to it, no $200 left');
  // clean up
  await J('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: H, body: JSON.stringify({ clear: true }) });
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) });
  const gone = await J('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: H });
  ok(gone && (!gone.upload || gone.upload.n === 0) && gone.poolAll && gone.poolAll.usd === 100, 'past-season report cleared (pool back to the bare $100 base), member removed');
  console.log(out.join('\n')); console.log('\nbybit-rebate-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

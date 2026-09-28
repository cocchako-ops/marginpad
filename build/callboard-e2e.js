/* callboard-e2e (2026-09-28): THE DAILY BTC CALL IS A PAID SEASON BOARD, AND THE PAYER MUST SEE WHAT THE PAGE SEES.
   A throwaway member makes a call, an admin settlement scores it against a chosen close, and then:
   - the points land on the board exactly as the tiers say (0.3% off -> 8 points), and NO Ticks are paid (the free reward is gone);
   - /api/admin/callboard (the payer's view, predBoardRows) carries the member with those points;
   - /api/reward/lb publishes topCall + boardPrizes.call + callPaidFrom, /api/competition lists the board with its $20;
   - /season/ has no Today card for the call any more and carries the board + the call box; /leaderboards/ has the tab.
   Needs ADMIN_KEY.local.txt (the mpadm_ token). Creates e2e-callboard1 and removes it at the end. */
const fs = require('fs');
const KEY = (fs.readFileSync(require('path').join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 220) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json());
const UID = 'e2e-callboard1';
(async () => {
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) }).catch(() => {});
  const mk = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'mk' }) });
  ok(mk && (mk.ok || mk.username), 'throwaway member minted', mk && mk.username);
  const day = new Date().toISOString().slice(0, 10);
  const st = await J('/api/predict?uid=' + UID, { headers: H });
  ok(st && st.day === day && Array.isArray(st.prizes) && st.prizes.reduce((a, x) => a + x, 0) === 20 && st.paidFrom > 0, '/api/predict states the prizes ($20) and the season it pays from', { prizes: st && st.prizes, paidFrom: st && st.paidFrom });
  const live = +st.live || 0; ok(live > 0, 'a live BTC price is on the response', live);
  // a call 0.30% above the live price; force past the cutoff so the test works after 20:00 UTC too
  const guess = Math.round(live * 1.003 * 100) / 100;
  const put = await J('/api/predict?uid=' + UID + '&force=1', { method: 'POST', headers: H, body: JSON.stringify({ guess }) });
  ok(put && put.ok && Math.abs(put.guess - guess) < 0.01, 'the call is recorded', put);
  // Ticks before the settlement
  const xp0 = await J('/api/auth/xp?uid=' + UID + '&fresh=1', { headers: H }).catch(() => null);
  const t0 = xp0 && (xp0.ticks != null ? +xp0.ticks : null);
  // settle THIS member's call for today against the live price: 0.3% off -> 8 points
  const set = await J('/api/admin/predict?settle=' + day + '&close=' + live + '&uid=' + UID, { headers: H });
  ok(set && set.ok && set.settled === 1 && set.ticksPaid === 0, 'settled one call and paid ZERO Ticks (the free reward is gone)', set);
  const me = await J('/api/predict?uid=' + UID, { headers: H });
  const y = me && me.me && me.me.today; // today's row, now settled, is read back through /pred/me as `today`
  const mySeason = me && me.me && me.me.season;
  ok(mySeason && mySeason.pts === 8 && mySeason.n === 1, 'the season score is 8 points from 1 call (0.30% off = the 0.5% tier)', mySeason);
  const xp1 = await J('/api/auth/xp?uid=' + UID + '&fresh=1', { headers: H }).catch(() => null);
  const t1 = xp1 && (xp1.ticks != null ? +xp1.ticks : null);
  ok(t0 == null || t1 == null || t1 === t0, 'the member\'s Ticks did not move', { before: t0, after: t1 });
  // the payer's view
  const cb = await J('/api/admin/callboard?e2e=1', { headers: H });
  const row = cb && (cb.rows || []).find(r => r.uid === UID);
  ok(row && row.pts === 8 && row.n === 1 && row.name, 'the payer\'s candidate list (predBoardRows) carries the member with 8 points', row);
  ok(cb && Array.isArray(cb.prizes) && cb.prizes.reduce((a, x) => a + x, 0) === 20 && cb.paidFrom === Date.UTC(2026, 8, 28), 'payer view: $20 prizes, pays from 2026-09-28', { prizes: cb && cb.prizes, paidFrom: cb && cb.paidFrom });
  const cbPub = await J('/api/admin/callboard', { headers: H });
  ok(cbPub && !(cbPub.rows || []).some(r => r.uid === UID), 'without ?e2e=1 the test account is invisible (public boards never show e2e names)');
  // public surfaces
  const lb = await J('/api/reward/lb?nc=1&cb=' + Date.now());
  ok(lb && Array.isArray(lb.topCall) && lb.boardPrizes && Array.isArray(lb.boardPrizes.call) && lb.callPaidFrom === Date.UTC(2026, 8, 28) && lb.entrants && 'call' in lb.entrants, '/api/reward/lb publishes topCall, boardPrizes.call, callPaidFrom, entrants.call', { n: lb && lb.topCall && lb.topCall.length, prizes: lb && lb.boardPrizes && lb.boardPrizes.call });
  ok(lb && !(lb.topCall || []).some(r => /^e2e/i.test(String(r.who || ''))), 'no e2e name on the public call board');
  const comp = await J('/api/competition?cb=' + Date.now());
  const cbd = comp && (comp.boards || []).find(b => b.id === 'call');
  ok(cbd && cbd.prize_pool_usd === 20 && cbd.entry === 'free_call' && cbd.period_days === 14, '/api/competition lists the Daily BTC Call board ($20, free, 14 days)', cbd && { pool: cbd.prize_pool_usd, entry: cbd.entry });
  ok(comp && comp.boards.length === 8 && comp.prize_pool_usd_per_season === 370, 'eight boards, $370 a season', comp && { boards: comp.boards.length, pool: comp.prize_pool_usd_per_season });
  const season = await fetch(B + '/season/?cb=' + Date.now()).then(r => r.text());
  const todaySec = season.slice(season.indexOf('<section class="sec" id="today">'), season.indexOf('<section class="sec" id="pass">'));
  ok(todaySec.length > 200 && !/id="dc"/.test(todaySec) && !/dcForm/.test(todaySec) && !/Daily call/.test(todaySec), '/season/ no longer carries the free daily-call card in the Today section (the form is built by script under the board)');
  ok(/id="callbox"/.test(season) && /k:'call',key:'topCall'/.test(season) && /Daily BTC call\.<\/b>/.test(season), '/season/ carries the call box under the boards, the board definition and its rule');
  const lbp = await fetch(B + '/leaderboards/?cb=' + Date.now()).then(r => r.text());
  ok(/data-b="call"/.test(lbp) && /id="tl-call"/.test(lbp) && (lbp.match(/class="tab[ "]/g) || []).length === 8, '/leaderboards/ has the Daily BTC call tab (eight tabs)');
  const home = await fetch(B + '/?cb=' + Date.now()).then(r => r.text());
  ok(/data-b="call"/.test(home) && /\$370/.test(home), 'the homepage competition card lists the board and the $370 pool');
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) });
  const gone = await J('/api/admin/callboard?e2e=1', { headers: H });
  ok(gone && !(gone.rows || []).some(r => r.uid === UID), 'the throwaway member and its call are removed (upred is in BY_USER)');
  console.log(out.join('\n')); console.log('\ncallboard-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

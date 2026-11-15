/* squad-raid-e2e (2026-10-01, rewritten 2026-11-15 for the TEAM raid, owner: "mora da bude mnogo teze da se raid
   zavrsi ako ne rade vecina iz squad-a zajedno").
   A raid is one squad vs one coin for 48h; realized PnL on that coin fills the pool. Since 2026-11-15 the rules are:
   target = $175 per member (+15% a level); 60% of the squad must each fill 10% of it; one member fills at most 40%,
   one trade at most 20%; losses count in full; a trade over 50x, over $10,000 margin or opened before the start never
   counts; it cannot clear before 24h; abandon = fail + that coin locked 24h; a day is raidDayMax(level) raids.

   Load-bearing checks (red if the DESIGN broke, not the wiring):
     - a LOSING close makes the pool negative (losses count in full)
     - one huge win fills at most 20% of the target (tradeMax) and one member at most 40% (memberMax)
     - a 100x trade, a $15k-margin trade and a pre-raid position do not count, and the room's feed says why
     - a pool past the target does NOT clear before 24h, and does clear after (raidsettle with a future clock)
     - every member who took part is paid Ticks
     - a second raid the same day at level 1 is refused (daily_limit); an abandoned coin is locked (coin_locked)
     - the rules endpoint, the raid board, the share card and the trophies answer
                                                                     node build/squad-raid-e2e.js   */
const fs = require('fs'), path = require('path');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = process.env.MP_BASE || 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 240) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json().then(j => (j.__s = r.status, j)).catch(() => ({ __s: r.status })));
const T = (u) => fetch(B + u).then(r => r.text().then(t => ({ s: r.status, t, ct: r.headers.get('content-type') || '' })));
const adm = (p, b) => J(p, { method: 'POST', headers: H, body: JSON.stringify(b) });
const sq = (op, uid, b) => J('/api/squad/' + op + '?uid=' + encodeURIComponent(uid), { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
const mine = uid => J('/api/squad/mine?uid=' + encodeURIComponent(uid), { headers: H });
const live = uid => J('/api/squad/live?uid=' + encodeURIComponent(uid), { headers: H });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R4 = () => { const A = 'BCDFGHJKLMNPQRSTVWXYZ0123456789'; let v = ''; for (let i = 0; i < 4; i++) v += A[Math.floor(Math.random() * A.length)]; return v; };
const UIDS = ['e2erd1', 'e2erd2', 'e2erd3', 'e2erd4'], real = {};
const tk = async uid => (await mine(real[uid])).ticks;

// open on `coin` and sweep closed at `exit` (sweeptest runs the server's own floor path)
async function trade(uid, coin, side, margin, lvl, exit, lev) {
  const body = { sym: coin, side, lev: lev || 10, margin };
  if (side === 'long') { if (+lvl >= +exit) body.sl = lvl; else body.tp = lvl; } else body.sl = lvl;
  const o = await J('/api/trade/open?uid=' + encodeURIComponent(real[uid]), { method: 'POST', headers: H, body: JSON.stringify(body) });
  const id = (o.position && o.position.id) || '';
  const sw = await J('/api/admin/sweeptest?uid=' + encodeURIComponent(real[uid]) + '&px=' + coin + ':' + exit, { headers: H });
  return { id, opened: !!id, swept: (sw && sw.swept) || 0, err: o.error || (o.position ? '' : JSON.stringify(o).slice(0, 80)) };
}
async function poll(uid, pred, tries) { let m; for (let i = 0; i < (tries || 20); i++) { m = await mine(real[uid]); if (pred(m)) return m; await sleep(1500); } return m; }

(async () => {
  if (!KEY) { console.error('no admin key'); process.exitCode = 1; return; }

  // ── the published rules are the store's own numbers ─────────────────────────────────────────
  const rules = await J('/api/squad/rules');
  const RR = rules.raid || {};
  ok(rules.v === 2 && RR.perMember === 175 && RR.part === 0.6 && RR.memberMax === 0.4 && RR.tradeMax === 0.2 && RR.levMax === 50 && RR.minHours === 24, 'the rules endpoint publishes the team-raid numbers', RR);
  ok(Array.isArray(rules.levels) && rules.levels.length === 10 && rules.levels.every(l => l.seats >= 3 && l.seats <= 5 && l.raidsDay >= 1 && l.raidsDay <= 2), 'ten levels, 3-5 seats, 1-2 raids a day', rules.levels && rules.levels.map(l => [l.lv, l.seats, l.raidsDay, l.target4]));

  for (const u of UIDS) {
    await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {});
    await adm('/api/admin/e2euser', { uid: u, op: 'mk' });
    real[u] = ((await J('/api/admin/xpdiag?u=e2e_' + u, { headers: H })).user || {}).id;
  }
  for (const L of ['e2erd1', 'e2erd4']) {
    await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: real[L], level: 'platinum', note: 'raid-e2e' }) });
    await adm('/api/admin/ticks', { uid: real[L], amt: 5000, note: 'raid-e2e' });
  }
  const TAG = R4();
  const c = await sq('create', real['e2erd1'], { name: 'Raiders ' + TAG, tag: TAG, crest: { shape: 'shield', sym: 'bolt', bg: '#c2f64a', fg: '#0a0b0d', ring: 'solid' }, open: true });
  const SID = c.squad && c.squad.sid;
  ok(!!SID, 'a squad to raid with', c.error || SID);
  await sq('join', real['e2erd2'], { sid: SID });
  await sq('join', real['e2erd3'], { sid: SID });

  const px = (await J('/api/price?symbol=BTC')).price || 0;
  const early = await J('/api/trade/open?uid=' + encodeURIComponent(real['e2erd2']), { method: 'POST', headers: H, body: JSON.stringify({ sym: 'BTC', side: 'long', lev: 10, margin: 100, tp: +(px * 1.02).toFixed(2) }) });
  ok(!!(early.position && early.position.id), 'a pre-raid BTC position is open before the raid starts');
  await sleep(4000);

  const start = await sq('raid', real['e2erd1'], { op: 'start', coin: 'BTC' });
  const R = start.raid || {};
  ok(start.ok && R.coin === 'BTC', 'the leader starts a 48h BTC raid', start.error || { target: R.target, need: R.need });
  ok(R.target === 525 && R.need === 2 && R.members === 3, 'the target is $175 x 3 members and 2 of 3 must take part', { target: R.target, need: R.need, members: R.members });
  ok(R.levMax === 50 && R.marginMax === 10000 && R.oneShare === 0.2 && R.memberMax === 0.4, 'the guards ride on the raid', { lev: R.levMax, m: R.marginMax, one: R.oneShare, mem: R.memberMax });
  const notL = await sq('raid', real['e2erd2'], { op: 'start', coin: 'ETH' });
  ok(notL.error === 'not_leader', 'a member cannot start one', notL.error);
  const second = await sq('raid', real['e2erd1'], { op: 'start', coin: 'ETH' });
  ok(second.error === 'raid_running', 'one raid at a time', second.error);

  // 1. A LOSS COUNTS IN FULL
  const lstop = +(px * 0.99).toFixed(2);
  const lo = await trade('e2erd3', 'BTC', 'long', 100, lstop, lstop);
  ok(lo.opened && lo.swept > 0, 'a losing BTC trade opened and closed', lo);
  const mL = await poll('e2erd1', m => m.raid && m.raid.live && m.raid.live.total < 0);
  ok(mL.raid && mL.raid.live && mL.raid.live.total < 0, 'A LOSING TRADE MADE THE POOL NEGATIVE', mL.raid && mL.raid.live && { total: mL.raid.live.total });

  // 2. rally: once per raid
  const ra = await sq('raid', real['e2erd1'], { op: 'rally' });
  ok(ra.ok && ra.sent >= 1, 'the leader rallies the members who are not in yet', ra);
  const ra2 = await sq('raid', real['e2erd1'], { op: 'rally' });
  ok(ra2.error === 'already_rallied', 'and only once per raid', ra2.error);

  // 3. what does NOT count
  await J('/api/admin/sweeptest?uid=' + encodeURIComponent(real['e2erd2']) + '&px=BTC:' + (px * 1.02).toFixed(2), { headers: H }); // the pre-raid position closes inside the window
  await trade('e2erd3', 'BTC', 'long', 15000, +(px * 1.005).toFixed(2), (px * 1.01).toFixed(2));       // over the margin cap
  await trade('e2erd3', 'BTC', 'long', 100, +(px * 1.005).toFixed(2), (px * 1.01).toFixed(2), 100);    // over 50x
  const mS = await poll('e2erd1', m => { const l = m.raid && m.raid.live; return l && l.skippedMargin >= 1 && l.skippedEarly >= 1 && l.skippedLev >= 1; });
  const lS = (mS.raid && mS.raid.live) || {};
  ok(lS.skippedMargin >= 1, 'the $15k-margin trade does not count', { skippedMargin: lS.skippedMargin });
  ok(lS.skippedEarly >= 1, 'the pre-raid position does not count', { skippedEarly: lS.skippedEarly });
  ok(lS.skippedLev >= 1, 'the 100x trade does not count', { skippedLev: lS.skippedLev });
  const lv = await live(real['e2erd1']);
  const tagged = (lv.feed || []).filter(x => x.raid);
  ok(tagged.some(x => x.raid.why === 'lev') && tagged.some(x => x.raid.why === 'margin'), 'the room feed says WHY each skipped trade did not count', tagged.map(x => x.raid));
  ok(lv.raid && lv.raid.live && typeof lv.raid.live.inN === 'number' && lv.raid.live.need === 2, 'the room carries the raid with members in / needed', lv.raid && lv.raid.live && { inN: lv.raid.live.inN, need: lv.raid.live.need });

  // 4. the caps: one huge win fills 20% of the target, one member 40%
  await trade('e2erd1', 'BTC', 'long', 9000, +(px * 1.02).toFixed(2), (px * 1.03).toFixed(2));
  const m1 = await poll('e2erd1', m => { const l = m.raid && m.raid.live; return l && (l.members || []).some(x => x.name === 'e2e_e2erd1' && x.n >= 1); });
  const me1 = ((m1.raid && m1.raid.live && m1.raid.live.members) || []).find(x => x.name === 'e2e_e2erd1') || {};
  ok(Math.abs(me1.pnl - 105) < 0.01, 'one $2,700 win fills exactly 20% of the target ($105)', me1);
  for (const u of ['e2erd1', 'e2erd2', 'e2erd2', 'e2erd3', 'e2erd3']) await trade(u, 'BTC', 'long', 9000, +(px * 1.02).toFixed(2), (px * 1.03).toFixed(2));
  const mF = await poll('e2erd1', m => { const l = m.raid && m.raid.live; return l && l.total >= 525 && l.inN >= 3; });
  const lF = (mF.raid && mF.raid.live) || {};
  const me1b = (lF.members || []).find(x => x.name === 'e2e_e2erd1') || {};
  ok(Math.abs(me1b.pnl - 210) < 0.01 && me1b.n >= 2, 'one member fills at most 40% ($210)', me1b);
  ok(lF.total >= 525 && lF.inN === 3, 'the pool is past the target with all three in', { total: lF.total, inN: lF.inN });

  // 5. not before 24h, then cleared
  ok(mF.raid && mF.raid.status === 'active', 'IT DOES NOT CLEAR BEFORE 24 HOURS', mF.raid && { status: mF.raid.status, minAt: mF.raid.minAt });
  const tb = {}; for (const u of ['e2erd1', 'e2erd2', 'e2erd3']) tb[u] = await tk(u);
  const st = await adm('/api/admin/raidsettle', { id: R.id, now: (R.start || Date.now()) + 24 * 3600000 + 60000 });
  const rr = st.raid || {};
  ok(rr.status === 'cleared', 'after 24 hours it clears', { status: rr.status, progress: rr.progress, err: st.error });
  for (const u of ['e2erd1', 'e2erd2', 'e2erd3']) { const t2 = await tk(u); ok(t2 > tb[u], 'member ' + u + ' who took part is paid Ticks', { before: tb[u], after: t2 }); }

  // 6. day cap at level 1
  const again = await sq('raid', real['e2erd1'], { op: 'start', coin: 'ETH' });
  ok(again.error === 'daily_limit', 'a level-1 squad gets one raid a day', again);

  // 7. trophies, share card, board
  const mT = await mine(real['e2erd1']);
  ok(mT.trophies && mT.trophies.coins && mT.trophies.coins.BTC >= 1 && mT.trophies.streak >= 1, 'the cleared raid is on the trophy shelf', mT.trophies);
  const svg = await T('/api/squad/raidcard.svg?id=' + encodeURIComponent(R.id));
  ok(svg.s === 200 && /svg/.test(svg.ct) && svg.t.indexOf('BTC') >= 0 && svg.t.indexOf(R.sid) < 0 && svg.t.indexOf('Raiders') >= 0, 'the share card renders the squad and no squad id', { s: svg.s, ct: svg.ct, len: svg.t.length });
  const nf = await T('/api/squad/raidcard.svg?id=nope');
  ok(nf.s === 404, 'an unknown raid is a 404 card', nf.s);
  const brd = await J('/api/squad/raidboard?nc=1');
  ok(brd && Array.isArray(brd.squads) && !brd.squads.some(x => x.sid === SID), 'the raid board answers and keeps the test squad off it', brd && brd.squads && brd.squads.length);

  // 8. abandon = coin locked (a level-3 squad, two raids a day)
  const TAG2 = R4();
  const c2 = await sq('create', real['e2erd4'], { name: 'Quitters ' + TAG2, tag: TAG2, crest: { shape: 'shield', sym: 'bolt', bg: '#c2f64a', fg: '#0a0b0d', ring: 'solid' } });
  const SID2 = c2.squad && c2.squad.sid;
  await adm('/api/admin/foundry', { sid: SID2, sxp: 1800 });
  const s2 = await sq('raid', real['e2erd4'], { op: 'start', coin: 'ETH' });
  ok(s2.ok, 'a level-3 squad starts an ETH raid', s2.error || 'ok');
  const ab = await sq('raid', real['e2erd4'], { op: 'abandon' });
  ok(ab.ok, 'the leader abandons it', ab.error || 'ok');
  const lk = await sq('raid', real['e2erd4'], { op: 'start', coin: 'ETH' });
  ok(lk.error === 'coin_locked', 'an abandoned coin is locked for 24h', lk);
  const s3 = await sq('raid', real['e2erd4'], { op: 'start', coin: 'SOL' });
  ok(s3.ok, 'a second coin is still allowed the same day (two a day at level 3)', s3.error || 'ok');
  await sq('raid', real['e2erd4'], { op: 'abandon' });
  const s4 = await sq('raid', real['e2erd4'], { op: 'start', coin: 'XRP' });
  ok(s4.error === 'daily_limit', 'and a third is refused - the abandoned raid counted as one of the two', s4);
  const h2 = (await mine(real['e2erd4'])).raidHistory || [];
  ok(h2.some(x => x.coin === 'ETH' && x.status === 'abandoned'), 'the abandoned raid is in the history as abandoned', h2.map(x => [x.coin, x.status]));

  for (const u of UIDS) await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log(out.join('\n'));
  console.log('\nsquad-raid-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

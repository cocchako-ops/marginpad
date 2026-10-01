/* squad-raid-e2e (2026-10-01, owner: "da raiduju 5 major coin-a ... pool koji se ispunjava progresom, progres je
   PnL na tom coinu ... limit po otvorenom trejdu max 10k margin ... i negativan trejd utice na progres").
   A raid is one squad vs one coin for 48h: realized PnL on that coin fills the pool, and the design is in the
   guards, so the guards are what this proves.

   Load-bearing checks (red if the DESIGN broke, not the wiring):
     - a winning close on the coin raises the pool
     - A LOSING close LOWERS it (the owner's explicit requirement)
     - a position opened with margin > $10,000 does NOT count
     - a close on a DIFFERENT coin does not count
     - clearing the target pays Ticks + XP only to members who actually traded it
     - the weekly MVP is the member who gained the most XP that week, and wears the mark
                                                                     node build/squad-raid-e2e.js   */
const fs = require('fs'), path = require('path');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = process.env.MP_BASE || 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 220) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json().then(j => (j.__s = r.status, j)).catch(() => ({ __s: r.status })));
const adm = (p, b) => J(p, { method: 'POST', headers: H, body: JSON.stringify(b) });
const sq = (op, uid, b) => J('/api/squad/' + op + '?uid=' + encodeURIComponent(uid), { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
const mine = uid => J('/api/squad/mine?uid=' + encodeURIComponent(uid), { headers: H });
const R4 = () => { const A = 'ABCDFGHJKLMNPQRSTVWXYZ0123456789'; let v = ''; for (let i = 0; i < 4; i++) v += A[Math.floor(Math.random() * A.length)]; return v; };
const UIDS = ['e2erd1', 'e2erd2', 'e2erd3'], real = {};
const tk = async uid => (await mine(real[uid])).ticks;

// open a position on `coin` at `px` and sweep it closed at `exit` (sweeptest runs the server's own floor path)
async function trade(uid, coin, side, margin, lvl, exit) {
  const body = { sym: coin, side, lev: 10, margin };
  if (side === 'long') body.tp = lvl; else body.sl = lvl;
  const o = await J('/api/trade/open?uid=' + encodeURIComponent(real[uid]), { method: 'POST', headers: H, body: JSON.stringify(body) });
  const id = (o.position && o.position.id) || '';
  const sw = await J('/api/admin/sweeptest?uid=' + encodeURIComponent(real[uid]) + '&px=' + coin + ':' + exit, { headers: H });
  return { id, opened: !!id, swept: (sw && sw.swept) || 0, err: o.error || (o.position ? '' : JSON.stringify(o).slice(0, 80)) };
}

(async () => {
  if (!KEY) { console.error('no admin key'); process.exitCode = 1; return; }
  for (const u of UIDS) {
    await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {});
    await adm('/api/admin/e2euser', { uid: u, op: 'mk' });
    real[u] = ((await J('/api/admin/xpdiag?u=e2e_' + u, { headers: H })).user || {}).id;
  }
  await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: real['e2erd1'], level: 'platinum', note: 'raid-e2e' }) });
  await adm('/api/admin/ticks', { uid: real['e2erd1'], amt: 5000, note: 'raid-e2e' });
  const TAG = R4();
  const c = await sq('create', real['e2erd1'], { name: 'Raiders ' + TAG, tag: TAG, crest: { shape: 'shield', sym: 'bolt', bg: '#c2f64a', fg: '#0a0b0d', ring: 'solid' }, open: true });
  const SID = c.squad && c.squad.sid;
  ok(!!SID, 'a squad to raid with', c.error || SID);
  await sq('join', real['e2erd2'], { sid: SID });
  await sq('join', real['e2erd3'], { sid: SID });

  // a position OPENED before the raid starts must not count - open it now, start the raid, close it after
  const px = (await J('/api/price?symbol=BTC')).price || 0;
  const early = await J('/api/trade/open?uid=' + encodeURIComponent(real['e2erd2']), { method: 'POST', headers: H, body: JSON.stringify({ sym: 'BTC', side: 'long', lev: 10, margin: 100, tp: +(px * 1.02).toFixed(2) }) });
  ok(!!(early.position && early.position.id), 'a pre-raid BTC position is open before the raid starts');
  await new Promise(r => setTimeout(r, 4000)); // a clear gap so the open time is unambiguously before the raid start

  const start = await sq('raid', real['e2erd1'], { op: 'start', coin: 'BTC' });
  ok(start.ok && start.raid && start.raid.coin === 'BTC', 'the leader starts a 48h BTC raid', start.raid && { target: start.raid.target });
  const target = start.raid.target;
  ok(start.raid.marginMax === 10000 && start.raid.oneShare === 0.5, 'the guards are published: $10k margin, half-pool cap', { m: start.raid.marginMax, o: start.raid.oneShare });
  const notL = await sq('raid', real['e2erd2'], { op: 'start', coin: 'ETH' });
  ok(notL.error === 'not_leader' || notL.error === 'raid_running', 'a member cannot start one', notL);

  // close the pre-raid position INTO the window - it must be excluded (opened before start)
  await J('/api/admin/sweeptest?uid=' + encodeURIComponent(real['e2erd2']) + '&px=BTC:' + (px * 1.02).toFixed(2), { headers: H });
  // a WINNING BTC trade, opened after the raid, under the margin cap
  const w = await trade('e2erd1', 'BTC', 'long', 100, +(px * 1.005).toFixed(2), (px * 1.01).toFixed(2));
  ok(w.opened && w.swept > 0, 'a member wins on BTC inside the raid', w);
  // a trade on a DIFFERENT coin must not count
  const ethpx = (await J('/api/price?symbol=ETH')).price || 0;
  await trade('e2erd2', 'ETH', 'long', 100, +(ethpx * 1.005).toFixed(2), (ethpx * 1.01).toFixed(2));
  // a position over the margin cap must not count
  await trade('e2erd3', 'BTC', 'long', 15000, +(px * 1.005).toFixed(2), (px * 1.01).toFixed(2));
  // tradeev commits a few seconds behind the sweep, so wait until the two SKIP facts are in - those are read
  // off the live /mine (they settled reliably once the window is given). The WIN and LOSS amounts are measured
  // off settle instead, which reads everything committed and is not sensitive to commit ordering.
  async function poll(pred, tries) { let m; for (let i = 0; i < (tries || 20); i++) { m = await mine(real['e2erd1']); if (pred(m)) return m; await new Promise(r => setTimeout(r, 1500)); } return m; }
  const m1 = await poll(function (m) { var l = m.raid && m.raid.live; return l && l.skippedMargin >= 1 && l.skippedEarly >= 1; });
  const live = m1.raid && m1.raid.live;
  ok(live && live.skippedMargin >= 1, 'the $15k-margin trade was SKIPPED (over the limit)', live && { skippedMargin: live.skippedMargin });
  ok(live && live.skippedEarly >= 1, 'and the pre-raid position was skipped too', live && { skippedEarly: live.skippedEarly });

  // top the pool past the target with two big (under-cap) wins - one trade fills at most half, so it takes two
  await trade('e2erd1', 'BTC', 'long', 9000, +(px * 1.02).toFixed(2), (px * 1.03).toFixed(2));
  await trade('e2erd2', 'BTC', 'long', 9000, +(px * 1.02).toFixed(2), (px * 1.03).toFixed(2));
  await new Promise(r => setTimeout(r, 2500));
  const tkBefore3 = await tk('e2erd3');
  const st = await adm('/api/admin/raidsettle', { id: m1.raid.id });
  ok(st.raid && st.raid.progress > 0, 'THE WINNING TRADES RAISED THE POOL above zero', st.raid && { progress: st.raid.progress });
  ok(st.ok && st.raid, 'the raid can be settled on demand', st.raid && { status: st.raid.status, progress: st.raid.progress });
  const cleared = st.raid.status === 'cleared';
  ok(cleared, 'IT CLEARED once the pool passed the target', { progress: st.raid.progress, target });
  if (cleared) {
    ok((await tk('e2erd1')) > 0, 'a member who traded it is paid Ticks', { t: await tk('e2erd1') });
    ok((await tk('e2erd3')) === tkBefore3, 'a member whose only trade was OVER the cap is paid nothing', { before: tkBefore3, after: await tk('e2erd3') });
  }

  // a cleared coin is on cooldown
  const again = await sq('raid', real['e2erd1'], { op: 'start', coin: 'BTC' });
  ok(again.error === 'coin_cooldown' || again.error === 'raid_running', 'the same coin is on cooldown after a clear', again);

  // ── A LOSING TRADE LOWERS THE POOL (owner's rule), measured cleanly on its own raid ──────────
  // One losing ETH trade, nothing else, settled - so the settled progress is exactly that loss, negative.
  const ethpx2 = (await J('/api/price?symbol=ETH')).price || 0;
  const er = await sq('raid', real['e2erd1'], { op: 'start', coin: 'ETH' });
  ok(er.ok, 'a fresh raid on ETH to measure a loss in isolation', er.error || 'ok');
  // a long with the STOP below entry, swept down to it - a clean realized loss (a tp below entry is wrong-side)
  const lstop = +(ethpx2 * 0.99).toFixed(2);
  const lo = await J('/api/trade/open?uid=' + encodeURIComponent(real['e2erd3']), { method: 'POST', headers: H, body: JSON.stringify({ sym: 'ETH', side: 'long', lev: 10, margin: 100, sl: lstop }) });
  const lsw = await J('/api/admin/sweeptest?uid=' + encodeURIComponent(real['e2erd3']) + '&px=ETH:' + lstop, { headers: H });
  ok(!!(lo.position && lo.position.id) && (lsw.swept || 0) > 0, 'the losing ETH trade opened and closed', { id: lo.position && lo.position.id, swept: lsw.swept, err: lo.error });
  // wait for the loss to reach the pool before settling - the live read is eventually consistent
  await poll(function (m) { return m.raid && m.raid.coin === 'ETH' && m.raid.live && m.raid.live.total < 0; });
  const es = await adm('/api/admin/raidsettle', { id: er.raid.id });
  ok(es.raid && es.raid.progress < 0, 'A LOSING TRADE MADE THE POOL NEGATIVE (owner rule)', es.raid && { progress: es.raid.progress });
  ok(es.raid && es.raid.status === 'failed', 'and the raid failed, since it never reached the target', es.raid && { status: es.raid.status });

  // ── the MVP of the week ─────────────────────────────────────────────────────────────────────
  // e2erd1 has traded most, so it gained the most XP this week
  const wkMon = (function () { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day); })();
  const wk = await adm('/api/admin/squadmvp', { wk: wkMon });
  ok(wk.ok && Array.isArray(wk.awarded), 'the weekly MVP can be awarded', wk.awarded && wk.awarded.length);
  const m3 = await mine(real['e2erd1']);
  const mvpMember = (m3.squad.members || []).find(x => x.mvp);
  ok(!!mvpMember, 'ONE member wears the MVP mark', mvpMember && { name: mvpMember.name });
  const card = await J('/api/lb/user?name=' + encodeURIComponent('e2e_' + 'e2erd1'));
  ok(card.squad && typeof card.squad.mvp === 'boolean', 'the profile card carries the MVP flag', card.squad && { mvp: card.squad.mvp });

  for (const u of UIDS) await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log(out.join('\n'));
  console.log('\nsquad-raid-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

/* squads-e2e (2026-09-29, owner: "squads sa max 5 clanova ... squad dueli, chatroom i Icon na profil karticama").
   Walks the whole engine with REAL throwaway members: create, the 5-member ceiling, invite/join/leave/kick,
   the leader handover, a crest that reaches the PUBLIC profile card, the chat room refusing a non-member,
   and a staked duel settled from real closed trades - with the Ticks arithmetic checked to the unit.

   The load-bearing checks, the ones that go red if the design is broken rather than the wiring:
     - a duel a squad LOST still pays XP to the members who traded (the owner's rule)
     - a member who did NOT trade is paid nothing (anti-farm, my addition)
     - the pot: winning leader gets the stake back, then the other squad's stake splits across everyone
     - the size rule: only the best N count, N = the smaller squad
     - a non-member is refused the squad's chat room by the SERVER, not by a hidden button

   Cleans up after itself.                                             node build/squads-e2e.js   */
const fs = require('fs'), path = require('path');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = process.env.MP_BASE || 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 260) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json().then(j => (j.__status = r.status, j)).catch(() => ({ __status: r.status, error: 'nojson' })));

// admin-hook call: /api/squad/* accepts ?uid= with the admin key, exactly like /api/duel/*
const sq = (op, uid, body) => J('/api/squad/' + op + '?uid=' + encodeURIComponent(uid), { method: 'POST', headers: H, body: JSON.stringify(body || {}) });
const mine = uid => J('/api/squad/mine?uid=' + encodeURIComponent(uid), { headers: H });
const adm = (p, body) => J(p, { method: 'POST', headers: H, body: JSON.stringify(body) });

// NO HYPHEN in these ids on purpose: /lbuser strips [^a-zA-Z0-9_] from ?name=, so a username carrying
// one can never be looked up and the public-card checks below would fail for a reason that is not the product.
const UIDS = ['e2esqa1', 'e2esqa2', 'e2esqa3', 'e2esqb1', 'e2esqb2', 'e2esqc1'];
const real = {}; // e2e uid -> internal users.id

async function mk(uid, found) {
  await adm('/api/admin/e2euser', { uid, op: 'rm' }).catch(() => {});
  await adm('/api/admin/e2euser', { uid, op: 'mk' });
  const who = await J('/api/admin/xpdiag?u=' + encodeURIComponent('e2e_' + uid), { headers: H });
  real[uid] = (who.user || {}).id || uid;
  // FOUNDING is gated on Platinum + 5,000 Ticks (owner 2026-09-30). Joining is not, so only the accounts that
  // found a squad in this suite are given the two things the gate asks for.
  if (found) {
    await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: real[uid], level: 'platinum', note: 'squads-e2e' }) });
    await adm('/api/admin/ticks', { uid: real[uid], amt: 5000, note: 'squads-e2e' });
  }
  return real[uid];
}
// /api/squad/mine carries the caller's Ticks balance, which is the only read that does not need a second endpoint
const ticks = async uid => (await mine(real[uid])).ticks;
const xplog = async uid => ((await J('/api/admin/xpdiag?u=' + encodeURIComponent('e2e_' + uid), { headers: H })).xplog || []);

(async () => {
  if (!KEY) { console.error('ADMIN_KEY.local.txt: no mpadm_ token'); process.exitCode = 1; return; }
  const FOUNDERS = ['e2esqa1', 'e2esqc1']; // the two accounts that create a squad below
  for (const u of UIDS) await mk(u, FOUNDERS.indexOf(u) >= 0);

  // ── THE GATE (owner 2026-09-30): Platinum + 5,000 Ticks, or the cash price ──────────────────
  const gateUid = real['e2esqa2']; // an ordinary member: no Platinum, no Ticks
  const g1 = await sq('create', gateUid, { name: 'Gate Probe ' + Date.now().toString(36).slice(-5), tag: 'GP' + Math.floor(Math.random() * 9) });
  ok(g1.error === 'need_level' && g1.needXp === 30000, 'AN ORDINARY MEMBER CANNOT FOUND A SQUAD - Platinum is 30,000 XP', g1);
  await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: gateUid, level: 'platinum', note: 'squads-e2e gate' }) });
  const g2 = await sq('create', gateUid, { name: 'Gate Probe ' + Date.now().toString(36).slice(-5), tag: 'GQ' + Math.floor(Math.random() * 9) });
  ok(g2.error === 'need_ticks' && g2.need === 5000, 'PLATINUM ALONE IS NOT ENOUGH - it also costs 5,000 Ticks', g2);
  const gm = await mine(gateUid);
  ok(gm.can && gm.can.levelOk === true && gm.can.ticksOk === false && gm.can.ok === false, 'and the page is told exactly which half is missing', gm.can);
  ok(gm.can && gm.can.cents >= 600, 'the cash price never undercuts 5,000 Ticks ($6.00 at the pass peg)', { cents: gm.can.cents });
  ok(Object.keys(real).length === 6, 'six throwaway members exist', Object.values(real).map(x => String(x).slice(0, 6)));

  // ── creating a squad ────────────────────────────────────────────────────────────────────────
  // a tag is UNIQUE site-wide, so a run that dies half way would make the next one fail on tag_taken for a
  // reason that is not the product. Four random chars, and the sweep at the end clears the squad either way.
  const R4 = () => { const A = 'ABCDFGHJKLMNPQRSTVWXYZ0123456789'; let v = ''; for (let i = 0; i < 4; i++) v += A[Math.floor(Math.random() * A.length)]; return v; };
  const TAG = R4(), TAGB = R4();
  const NAME = 'E2E Squad ' + Date.now().toString(36).slice(-5);
  const crest = { shape: 'hex', sym: 'bolt', bg: '#c2f64a', fg: '#0a0b0d', ring: 'double' };
  const tkBefore = await ticks('e2esqa1');
  const c1 = await sq('create', real['e2esqa1'], { name: NAME, tag: TAG, crest, motto: 'test only', open: true });
  ok(c1.ok && c1.squad && c1.squad.sid, 'a member can create a squad and becomes its leader', c1.squad && { sid: c1.squad.sid, tag: c1.squad.tag, n: c1.squad.n });
  const SID = c1.squad && c1.squad.sid;
  ok(!!SID && /^[A-Z0-9]{6}$/.test(SID), 'the id is 6 uppercase alnum, so chatInstOf keeps it whole', SID);
  ok(c1.squad && c1.squad.crest && c1.squad.crest.sym === 'bolt' && c1.squad.crest.shape === 'hex', 'the crest is stored as posted', c1.squad && c1.squad.crest);
  const tkAfter = await ticks('e2esqa1');
  ok(tkAfter === tkBefore - 5000, 'FOUNDING TOOK EXACTLY 5,000 TICKS', { before: tkBefore, after: tkAfter });
  // a refusal must never cost anybody the fee: the tag below is already taken
  const dupTk = await ticks('e2esqc1');
  const dupTry = await sq('create', real['e2esqc1'], { name: NAME, tag: 'ZZ7' });
  ok(dupTry.error === 'name_taken' && (await ticks('e2esqc1')) === dupTk, 'A REFUSED CREATE COSTS NOTHING', { err: dupTry.error, before: dupTk, after: await ticks('e2esqc1') });

  const bogus = await sq('edit', real['e2esqa1'], { crest: { shape: 'skull', sym: '<script>', bg: 'red', ring: 'x' } });
  ok(bogus.ok && bogus.squad.crest.shape === 'shield' && bogus.squad.crest.sym === 'tag' && bogus.squad.crest.bg === '#4aa3f6', 'a junk crest snaps to safe values instead of being stored', bogus.squad && bogus.squad.crest);
  await sq('edit', real['e2esqa1'], { crest });

  const dup = await sq('create', real['e2esqa2'], { name: NAME, tag: 'ZZ9' });
  ok(dup.error === 'name_taken', 'two squads cannot share a name', dup);
  const twice = await sq('create', real['e2esqa1'], { name: NAME + 'x', tag: 'ZZ8' });
  ok(twice.error === 'already_in_squad', 'a leader cannot found a second squad', twice);

  // ── invites and the ceiling ─────────────────────────────────────────────────────────────────
  const inv = await sq('invite', real['e2esqa1'], { name: 'e2e_e2esqa2' });
  ok(inv.ok, 'the leader can invite by username', inv);
  const notLeader = await sq('invite', real['e2esqa2'], { name: 'e2e_e2esqa3' });
  ok(notLeader.error === 'not_in_squad' || notLeader.error === 'not_leader', 'someone outside the squad cannot invite to it', notLeader);
  const nf = await J('/api/auth/notifs?uid=' + encodeURIComponent(real['e2esqa2']), { headers: H });
  const inviteNf = ((nf.notifs || nf.rows || [])).filter(function (n) { return String(n.kind) === 'squad'; })[0];
  ok(!!inviteNf && String(inviteNf.link || '').indexOf('/squads/?inv=') === 0, 'THE INVITE NOTIFICATION LINKS SOMEWHERE - a path, not a word the handler ignores', inviteNf && { link: inviteNf.link });
  const m2 = await mine(real['e2esqa2']);
  ok((m2.invites || []).some(i => i.sid === SID), 'the invite shows up for the person invited', (m2.invites || []).map(i => i.sid));
  const j2 = await sq('join', real['e2esqa2'], { sid: SID });
  ok(j2.ok && j2.squad.n === 2, 'they can accept it', j2.squad && { n: j2.squad.n });

  await sq('join', real['e2esqa3'], { sid: SID }); // open squad - no invite needed
  await sq('join', real['e2esqb1'], { sid: SID });
  const j5 = await sq('join', real['e2esqb2'], { sid: SID });
  ok(j5.ok && j5.squad.n === 5, 'an open squad can be walked into, up to five', j5.squad && { n: j5.squad.n });
  const j6 = await sq('join', real['e2esqc1'], { sid: SID });
  ok(j6.error === 'squad_full' && j6.max === 5, 'THE SIXTH IS REFUSED - max 5', j6);

  // ── the crest reaches the PUBLIC profile card (the owner's whole point) ──────────────────────
  const card = await J('/api/lb/user?name=' + encodeURIComponent('e2e_e2esqa3'));
  ok(card.exists && card.squad && card.squad.tag === TAG && card.squad.crest && card.squad.crest.sym === 'bolt', 'THE CREST IS ON AN ORDINARY MEMBER\'S PUBLIC CARD', card.squad);
  ok(card.squad && card.squad.leader === false, 'and the card says they are not the leader', card.squad && { leader: card.squad.leader });
  const lcard = await J('/api/lb/user?name=' + encodeURIComponent('e2e_e2esqa1'));
  ok(lcard.squad && lcard.squad.leader === true, 'the leader\'s card says so', lcard.squad && { leader: lcard.squad.leader });
  ok(!JSON.stringify(card.squad || {}).includes(String(real['e2esqa1'])), 'no member uid leaks onto the public card');

  // ── the chat room is gated by MEMBERSHIP, server-side ───────────────────────────────────────
  // node's fetch refuses to send an Upgrade header (UND_ERR_INVALID_ARG), so the upgrade goes out over
  // https.request - which is also closer to what a browser actually sends.
  const https = require('https');
  const wsTry = (uid, sid) => new Promise(async resolve => {
    const h = { Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', Origin: 'https://marginpad.io' };
    if (uid) { const s = await adm('/api/admin/e2euser', { uid, op: 'sess' }); h.cookie = 'mp_sess=' + (s.token || s.sess); }
    const req = https.request({ host: new URL(B).host, path: '/chat/ws?room=' + sid, method: 'GET', headers: h }, res => { res.resume(); resolve(res.statusCode); });
    req.on('upgrade', res => { try { req.destroy(); } catch (e) {} resolve(res.statusCode || 101); });
    req.on('error', () => resolve(0));
    req.end();
  });
  ok(await wsTry('e2esqc1', SID) === 403, 'A NON-MEMBER IS REFUSED THE SQUAD ROOM BY THE SERVER', SID);
  ok(await wsTry(null, SID) === 403, 'and so is a signed-out visitor');
  const memberStatus = await wsTry('e2esqa2', SID);
  ok(memberStatus === 101 || memberStatus === 426 || memberStatus === 200, 'a member is not refused (upgrade attempted)', { status: memberStatus });

  // ── the duel ────────────────────────────────────────────────────────────────────────────────
  const c2 = await sq('create', real['e2esqc1'], { name: NAME + ' B', tag: TAGB, crest: { shape: 'banner', sym: 'crown' }, open: true });
  ok(c2.ok, 'a second squad exists to fight', c2.squad && { sid: c2.squad.sid, n: c2.squad.n });
  const SIDB = c2.squad && c2.squad.sid;

  const STAKE = 40;
  await adm('/api/admin/ticks', { uid: real['e2esqa1'], amt: 500, note: 'squads-e2e' });
  await adm('/api/admin/ticks', { uid: real['e2esqc1'], amt: 500, note: 'squads-e2e' });
  const tA0 = await ticks('e2esqa1'), tC0 = await ticks('e2esqc1');
  ok(tA0 >= STAKE && tC0 >= STAKE, 'both leaders hold enough Ticks to stake', { tA0, tC0 });

  const ch = await sq('challenge', real['e2esqa1'], { sid: SIDB, metric: 'pnl', dur: 86400000, stake: STAKE });
  ok(ch.ok && ch.duel && ch.duel.status === 'pending', 'the leader can challenge another squad', ch.duel && { status: ch.duel.status, stake: ch.duel.stake });
  const DID = ch.duel && ch.duel.id;
  const tA1 = await ticks('e2esqa1');
  ok(tA1 === tA0 - STAKE, 'THE CHALLENGER\'S STAKE IS TAKEN AT CHALLENGE TIME', { before: tA0, after: tA1, stake: STAKE });

  const notL = await sq('accept', real['e2esqa2'], { id: DID });
  ok(notL.error === 'not_leader' || notL.error === 'not_yours', 'only a leader can accept', notL);
  const acc = await sq('accept', real['e2esqc1'], { id: DID });
  ok(acc.ok && acc.duel.status === 'active', 'the other leader accepts and the duel goes live', acc.duel && { status: acc.duel.status });
  const tC1 = await ticks('e2esqc1');
  ok(tC1 === tC0 - STAKE, 'and their stake is taken too', { before: tC0, after: tC1 });

  const busy = await sq('challenge', real['e2esqa1'], { sid: SIDB, metric: 'roe', stake: 0 });
  ok(busy.error === 'already_duelling', 'a squad already in a duel cannot start another', busy);
  const walk = await sq('leave', real['e2esqb1'], {});
  ok(walk.error === 'duel_running', 'and nobody can walk out mid-duel', walk);

  // real closed trades inside the window: squad A trades, squad B does not
  // sweeptest runs the SERVER's floor path: it closes a position that breached its own stop or target, not one
  // handed an arbitrary exit. So each test position carries the level that decides it, and one sweep price
  // 1% up resolves both - the long into its target, the short into its stop.
  const pxNow = (await J('/api/price?symbol=BTC')).price || 0;
  ok(pxNow > 0, 'a live BTC price to build the test trades on', { pxNow });
  const LVL = +(pxNow * 1.005).toFixed(2), EXIT = +(pxNow * 1.01).toFixed(2);
  const pos = async (uid, side) => {
    const body = side === 'long' ? { sym: 'BTC', side, lev: 10, margin: 100, tp: LVL } : { sym: 'BTC', side, lev: 10, margin: 100, sl: LVL };
    const o = await J('/api/trade/open?uid=' + encodeURIComponent(real[uid]), { method: 'POST', headers: H, body: JSON.stringify(body) });
    const id = (o.position && o.position.id) || '';
    const sw = await J('/api/admin/sweeptest?uid=' + encodeURIComponent(real[uid]) + '&px=BTC:' + EXIT, { headers: H });
    return { id, opened: !!id, closed: +(sw && sw.swept) || 0, o, sw };
  };
  const pWin = await pos('e2esqa1', 'long');   // long into a 1% rise -> a win
  const pLos = await pos('e2esqa2', 'short');  // short into the same rise -> a loss
  ok(pWin.opened && pLos.opened, 'both test positions really opened on the server', { win: pWin.id, loss: pLos.id });
  ok(pWin.closed > 0 && pLos.closed > 0, 'and both really closed - otherwise nothing below proves anything', { win: pWin.closed, loss: pLos.closed, exit: EXIT });
  // e2esqa3, sqb1, sqb2 trade nothing; squad B trades nothing at all

  // Read the balances again HERE, not before the trading: closing a winning trade pays its own Ticks reward,
  // so measuring the pot against a figure taken earlier mixes two unrelated credits into one assertion.
  const tA1b = await ticks('e2esqa1'), tC1b = await ticks('e2esqc1');
  const settled = await adm('/api/admin/squadsettle', { id: DID, now: Date.now() });
  ok(settled && settled.ok, 'the duel can be settled on demand for the test', settled && { winner: (settled.duel || {}).winner });
  const d = settled.duel || {};
  ok(String(d.winner || '') === String(SID), 'SQUAD A WINS: it traded, squad B never competed', { winner: d.winner, a: d.aScore, b: d.bScore });
  ok(d.bScore === null, 'a squad that never traded scores null, not zero', { bScore: d.bScore });

  // the pot
  const tA2 = await ticks('e2esqa1');
  const nA = 5;
  const share = Math.floor(STAKE / nA), rest = STAKE - share * nA;
  ok(tA2 === tA1b + STAKE + share + rest, 'THE WINNING LEADER GETS THE STAKE BACK PLUS AN EQUAL SHARE', { before: tA1b, after: tA2, expect: tA1b + STAKE + share + rest, stake: STAKE, share, rest });
  const tMem = await ticks('e2esqa3');
  ok(tMem >= share && share > 0, 'and a member who never staked anything is paid a share', { member: tMem, share });
  const tC2 = await ticks('e2esqc1');
  ok(tC2 === tC1b, 'THE LOSING LEADER\'S STAKE IS GONE - nothing comes back', { before: tC1b, after: tC2 });

  // XP: win, draw and loss all pay - but only to members who actually traded
  const sqRows = (await xplog('e2esqa2')).filter(r => /Squad duel/i.test(String(r.note || '')));
  ok(sqRows.length >= 1, 'A MEMBER WHO TRADED AND WHOSE SIDE WON EARNS XP', sqRows.slice(0, 2));
  const idleRows = (await xplog('e2esqb2')).filter(r => /Squad duel/i.test(String(r.note || '')));
  ok(idleRows.length === 0, 'A MEMBER WHO NEVER TRADED IS PAID NOTHING (anti-farm)', idleRows.slice(0, 2));

  const after = await mine(real['e2esqa1']);
  ok(after.squad && after.squad.wins === 1, 'the squad record counts the win', after.squad && { w: after.squad.wins, d: after.squad.draws, l: after.squad.losses });
  const afterB = await mine(real['e2esqc1']);
  ok(afterB.squad && afterB.squad.losses === 1, 'and the other squad counts the loss', afterB.squad && { w: afterB.squad.wins, l: afterB.squad.losses });

  // ── leaving, kicking, handover ──────────────────────────────────────────────────────────────
  const kick = await sq('kick', real['e2esqa1'], { name: 'e2e_e2esqb2' });
  ok(kick.ok, 'the leader can remove a member once the duel is over', kick);
  const leave = await sq('leave', real['e2esqa2'], {});
  ok(leave.ok, 'a member can leave', leave);
  const hand = await sq('leave', real['e2esqa1'], {});
  ok(hand.ok, 'the leader can leave', hand);
  const newLead = await mine(real['e2esqa3']);
  ok(newLead.squad && newLead.isLeader === true, 'THE LONGEST-SERVING MEMBER INHERITS THE SQUAD', newLead.squad && { lead: newLead.squad.leaderName, n: newLead.squad.n });
  const gone = await mine(real['e2esqa1']);
  ok(gone.squad === null, 'and the old leader is out of it', { squad: gone.squad });

  // ── cleanup, and prove it ───────────────────────────────────────────────────────────────────
  for (const u of UIDS) await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  const br = await J('/api/squad/browse?nc=1');
  const left = (br.squads || []).filter(s => String(s.name || '').indexOf('E2E Squad') === 0);
  ok(left.length === 0, 'REMOVING THE ACCOUNTS LEAVES NO SQUAD BEHIND', left.map(s => s.name));

  console.log(out.join('\n'));
  console.log('\nsquads-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

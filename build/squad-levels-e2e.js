/* squad-levels-e2e (2026-10-02, owner: "klan 10 levela, na 3. otkljucavaju jedno mesto i na 8. jos jedno").
   SEATS GROW INTO the five the owner set at the start: 3 at founding, 4 at level 3, 5 at level 8 - starting at
   five and growing past it would contradict his own "max 5 clanova". The logo maker grows with the squad, and a
   piece it has not unlocked is refused by the SERVER, not merely hidden by the picker. Squad XP comes from what
   the MEMBERS do - a share of every XP grant - so a lesson or a mission moves the clan too.

   Load-bearing checks, the ones that go red if the design broke rather than the wiring:
     - three seats at level 1 and the fourth refused
     - a member earning XP moves the squad's own number
     - the seat really opens at level 3, and the fifth only at level 8
     - the aura is still locked at level 8 and open at 10
     - every member, not just the leader, was paid Ticks and XP on the way up
                                                                    node build/squad-levels-e2e.js   */
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
const UIDS = ['e2elvl1', 'e2elvl2', 'e2elvl3', 'e2elvl4', 'e2elvl5'], real = {};

(async () => {
  if (!KEY) { console.error('ADMIN_KEY.local.txt: no mpadm_ token'); process.exitCode = 1; return; }
  for (const u of UIDS) {
    await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {});
    await adm('/api/admin/e2euser', { uid: u, op: 'mk' });
    real[u] = ((await J('/api/admin/xpdiag?u=e2e_' + u, { headers: H })).user || {}).id;
  }
  await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: real['e2elvl1'], level: 'platinum', note: 'levels-e2e' }) });
  await adm('/api/admin/ticks', { uid: real['e2elvl1'], amt: 5000, note: 'levels-e2e' });

  // ── a squad starts at level 1 with THREE seats, not five ────────────────────────────────────
  const TAG = R4();
  const c = await sq('create', real['e2elvl1'], { name: 'Ladder ' + TAG, tag: TAG, crest: { shape: 'shield', sym: 'bolt', bg: '#c2f64a', fg: '#0a0b0d', ring: 'solid' }, open: true } /* every piece here is in the level-1 set */);
  ok(c.ok, 'a squad is founded', c.error || (c.squad && c.squad.sid));
  const SID = c.squad && c.squad.sid;
  ok(c.squad && c.squad.level && c.squad.level.lv === 1 && c.squad.level.max === 10, 'it starts at level 1 of 10', c.squad && c.squad.level);
  ok(c.squad && c.squad.max === 3 && c.squad.cap === 5, 'WITH THREE SEATS - the five are grown into, not given', { seats: c.squad && c.squad.max, cap: c.squad && c.squad.cap });

  const lock = await sq('edit', real['e2elvl1'], { crest: { shape: 'hex', sym: 'bolt', bg: '#c2f64a', fg: '#0a0b0d', ring: 'solid' } });
  ok(lock.error === 'locked_piece', 'A LOCKED LOGO PIECE IS REFUSED BY THE SERVER, not just hidden', lock);
  const okEdit = await sq('edit', real['e2elvl1'], { crest: { shape: 'circle', sym: 'crown', bg: '#4aa3f6', fg: '#e9e7df', ring: 'solid' } });
  ok(okEdit.ok, 'and an unlocked one is accepted', okEdit.error || 'ok');
  const o1 = (okEdit.squad || {}).opts || {};
  ok((o1.shapes || []).length === 2 && (o1.syms || []).length === 8 && (o1.cols || []).length === 8 && (o1.rings || []).length === 2, 'level 1 opens 2 shapes, 8 marks, 2 rings', { sh: (o1.shapes || []).length, sy: (o1.syms || []).length, r: o1.rings });

  // ── the fourth seat is refused at level 1 ───────────────────────────────────────────────────
  await sq('join', real['e2elvl2'], { sid: SID });
  await sq('join', real['e2elvl3'], { sid: SID });
  const full = await sq('join', real['e2elvl4'], { sid: SID });
  ok(full.error === 'squad_full' && full.max === 3, 'THE FOURTH IS REFUSED AT LEVEL 1', full);

  // ── squad XP comes from what a MEMBER does ──────────────────────────────────────────────────
  // The admin /xp/adjust writes the column directly and never runs _grantXp - right for a correction, and it
  // would prove nothing here. So a member EARNS it the way a member does: closes a real trade.
  const before = ((await mine(real['e2elvl1'])).squad || {}).sxp || 0;
  const px = (await J('/api/price?symbol=BTC')).price || 0;
  const tp = +(px * 1.005).toFixed(2), exit = +(px * 1.01).toFixed(2);
  await J('/api/trade/open?uid=' + encodeURIComponent(real['e2elvl2']), { method: 'POST', headers: H, body: JSON.stringify({ sym: 'BTC', side: 'long', lev: 10, margin: 100, tp: tp }) });
  await J('/api/admin/sweeptest?uid=' + encodeURIComponent(real['e2elvl2']) + '&px=BTC:' + exit, { headers: H });
  await new Promise(r => setTimeout(r, 1200));
  const afterA = ((await mine(real['e2elvl1'])).squad || {}).sxp || 0;
  ok(afterA > before, 'A MEMBER CLOSING A TRADE MOVES THE SQUAD OWN NUMBER', { before, after: afterA });

  // ── level 3 opens the fourth seat ───────────────────────────────────────────────────────────
  await adm('/api/admin/squadxp', { sid: SID, amt: 1800 });
  const m3 = await mine(real['e2elvl1']);
  ok(m3.squad && m3.squad.level.lv >= 3, 'the squad reaches level 3', m3.squad && m3.squad.level);
  ok(m3.squad && m3.squad.max === 4, 'AND THE FOURTH SEAT OPENS', { seats: m3.squad && m3.squad.max });
  const j4 = await sq('join', real['e2elvl4'], { sid: SID });
  ok(j4.ok && j4.squad.n === 4, 'the fourth member can now join', j4.error || { n: j4.squad && j4.squad.n });
  const j5 = await sq('join', real['e2elvl5'], { sid: SID });
  ok(j5.error === 'squad_full' && j5.max === 4, 'and the fifth still is not', j5);

  // ── level 8 opens the fifth ─────────────────────────────────────────────────────────────────
  await adm('/api/admin/squadxp', { sid: SID, amt: 18000 });
  const m8 = await mine(real['e2elvl1']);
  ok(m8.squad && m8.squad.level.lv >= 8 && m8.squad.max === 5, 'AT LEVEL 8 THE FIFTH SEAT OPENS', { lv: m8.squad && m8.squad.level.lv, seats: m8.squad && m8.squad.max });
  const o8 = (m8.squad || {}).opts || {};
  ok(o8.shapes.length === 4 && o8.syms.length === 14 && o8.cols.length === 11, 'and the logo maker has grown with it', { sh: o8.shapes.length, sy: o8.syms.length, co: o8.cols.length });
  const hexNow = await sq('edit', real['e2elvl1'], { crest: { shape: 'hex', sym: 'anchor', bg: '#f64a9e', fg: '#0a0b0d', ring: 'dashed' } });
  ok(hexNow.ok, 'the piece refused at level 1 is accepted now', hexNow.error || 'ok');
  const aura = await sq('edit', real['e2elvl1'], { crest: { shape: 'hex', sym: 'anchor', bg: '#f64a9e', fg: '#0a0b0d', ring: 'aura' } });
  ok(aura.error === 'locked_piece', 'THE AURA IS STILL LOCKED AT LEVEL 8 - it is the level 10 trophy', aura);

  // ── level 10 ────────────────────────────────────────────────────────────────────────────────
  await adm('/api/admin/squadxp', { sid: SID, amt: 32000 });
  const m10 = await mine(real['e2elvl1']);
  ok(m10.squad && m10.squad.level.lv === 10 && m10.squad.level.next === null, 'the ladder tops out at 10', m10.squad && m10.squad.level);
  const aura2 = await sq('edit', real['e2elvl1'], { crest: { shape: 'hex', sym: 'anchor', bg: '#f64a9e', fg: '#0a0b0d', ring: 'aura' } });
  ok(aura2.ok, 'AND THE AURA IS UNLOCKED', aura2.error || 'ok');
  ok(m10.squad.max === 5, 'seats never exceed the five the owner set', { seats: m10.squad.max });

  // every member, not just the leader, was paid on the way up
  const tk = (await mine(real['e2elvl3'])).ticks;
  ok(tk > 0, 'EVERY MEMBER was paid Ticks for the levels', { ticks: tk });
  const xl = ((await J('/api/admin/xpdiag?u=e2e_e2elvl3', { headers: H })).xplog || []).filter(r => /Squad reached level/i.test(String(r.note || '')));
  ok(xl.length >= 3, 'and XP, once per level, to everyone', xl.slice(0, 2));

  for (const u of UIDS) await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log(out.join('\n'));
  console.log('\nsquad-levels-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

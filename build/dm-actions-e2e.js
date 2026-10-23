/* The same three actions on a DIRECT message (owner 2026-09-14: "promena nije u DM chatu uvedena"). DMs are a REST
   thread in the UserStore, not a WebSocket room, so this is its own storage and its own route - and its own proof
   that the rule did not get weaker on the way across: only the sender may edit or delete, only the two people in the
   thread may react at all, and a stranger cannot touch any of it.   node build/dm-actions-e2e.js                  */
'use strict';
const fs = require('fs');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').replace(/^\uFEFF/, '').match(/mpadm_[a-f0-9]+/)[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const admin = async (p, b) => (await fetch(O + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
// the trade set since 2026-10-18 (worker CHAT_RX): rocket bear target brain fire skull
const THUMB = '\uD83D\uDD25', HEART = '\uD83D\uDE80';
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 200) : '')); } };
const as = (tok) => ({
  get: async (p) => (await fetch(O + p, { headers: { cookie: 'mp_sess=' + tok } })).json(),
  post: async (p, b) => (await fetch(O + p, { method: 'POST', headers: { cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }, body: JSON.stringify(b) })).json(),
});

(async () => {
  const A = 'e2edma' + Math.random().toString(36).slice(2, 6);
  const B = 'e2edmb' + Math.random().toString(36).slice(2, 6);
  const C = 'e2edmc' + Math.random().toString(36).slice(2, 6);
  for (const u of [A, B, C]) await admin('/api/admin/e2euser', { uid: u, op: 'mk' });
  const ta = (await admin('/api/admin/e2euser', { uid: A, op: 'sess' })).token;
  const tb = (await admin('/api/admin/e2euser', { uid: B, op: 'sess' })).token;
  const tc = (await admin('/api/admin/e2euser', { uid: C, op: 'sess' })).token;
  const a = as(ta), b = as(tb), c = as(tc);
  const nameA = 'e2e_' + A, nameB = 'e2e_' + B;

  // a DM needs a connection; follow each other so the thread is allowed. FOLLOW IS REQUEST-BASED since 2026-10-23
  // (Instagram-shaped: a follow is a request the target approves), so each side approves the other's request here -
  // the suite had asserted `following:true` straight off the follow call and was red for a day on working code.
  const fa = await a.post('/api/lb/follow', { tuid: B, tname: nameB });
  const apA = await b.post('/api/lb/fapprove', { ruid: A });
  const fb = await b.post('/api/lb/follow', { tuid: A, tname: nameA });
  const apB = await a.post('/api/lb/fapprove', { ruid: B });
  ok(!!(fa && (fa.following || fa.requested)) && !!(apA && apA.ok) && !!(apB && apB.ok), 'the two members are connected (request + approval both ways), so a DM is allowed', { fa, apA, fb, apB });

  const text = 'dm probe ' + Math.random().toString(36).slice(2, 7);
  const sent = await a.post('/api/dm/send', { to: nameB, text });
  ok(sent && sent.ok, 'A sends B a direct message', sent);

  let th = await a.get('/api/dm/thread?with=' + nameB);
  const msg = (th.messages || []).filter(m => m.txt === text).pop();
  ok(!!msg && !!msg.id, 'the thread returns the message with an id', msg);
  ok(typeof th.me === 'string' && th.me.length === 12, 'and the reader is told its own author hash', { me: th.me });
  ok(!(th.messages || []).some(m => m.from_uid || m.uid), 'no account id is in the thread payload');
  const id = msg && msg.id;

  // ── who may do what ───────────────────────────────────────────────────────────────────────────────────────────
  let r = await b.post('/api/dm/act', { id, act: 'edit', txt: 'hijacked' });
  ok(r && r.error === 'notyours', 'the RECIPIENT cannot edit it', r);
  r = await b.post('/api/dm/act', { id, act: 'del' });
  ok(r && r.error === 'notyours', 'the recipient cannot delete it', r);
  r = await c.post('/api/dm/act', { id, act: 'react', e: THUMB });
  ok(r && r.error === 'notyours', 'a third member, not in the thread, cannot even react', r);
  r = await fetch(O + '/api/dm/act', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, act: 'del' }) });
  ok(r.status === 401, 'a signed-out caller is refused outright', { status: r.status });

  // ── reactions ─────────────────────────────────────────────────────────────────────────────────────────────────
  r = await b.post('/api/dm/act', { id, act: 'react', e: THUMB });
  ok(r && r.ok && (r.rx[THUMB] || []).length === 1, 'the recipient CAN react', r && r.rx);
  th = await a.get('/api/dm/thread?with=' + nameB);
  let m2 = (th.messages || []).find(m => m.id === id);
  let rx = m2 && m2.rx ? JSON.parse(m2.rx) : null;
  ok(rx && (rx[THUMB] || []).length === 1, 'and the sender sees it on the next pull', rx);
  ok(rx && (rx[THUMB] || []).indexOf(th.me) < 0, 'it is not attributed to the sender', { me: th.me, who: rx && rx[THUMB] });

  r = await b.post('/api/dm/act', { id, act: 'react', e: THUMB });
  ok(r && r.ok && !r.rx[THUMB], 'reacting again takes it back', r && r.rx);
  r = await b.post('/api/dm/act', { id, act: 'react', e: 'X' });
  ok(r && r.error === 'bad_emoji', 'an emoji outside the set is refused', r);
  await a.post('/api/dm/act', { id, act: 'react', e: HEART });
  th = await a.get('/api/dm/thread?with=' + nameB);
  m2 = (th.messages || []).find(m => m.id === id); rx = m2 && m2.rx ? JSON.parse(m2.rx) : null;
  ok(rx && (rx[HEART] || []).indexOf(th.me) >= 0, 'the sender may react to their own message, and it reads as theirs', rx);

  // ── edit, then delete ─────────────────────────────────────────────────────────────────────────────────────────
  r = await a.post('/api/dm/act', { id, act: 'edit', txt: text + ' fixed' });
  ok(r && r.ok && r.txt === text + ' fixed' && r.ed > 0, 'the sender can edit', r);
  th = await b.get('/api/dm/thread?with=' + nameA);
  m2 = (th.messages || []).find(m => m.id === id);
  ok(m2 && m2.txt === text + ' fixed' && m2.ed > 0, 'the recipient sees the edit, marked as edited', m2);
  ok(m2 && (m2.txt.match(/fixed/g) || []).length === 1, 'the edit replaced the text rather than appending', m2 && m2.txt);

  r = await a.post('/api/dm/act', { id, act: 'del' });
  ok(r && r.ok && r.deleted, 'the sender can delete', r);
  th = await b.get('/api/dm/thread?with=' + nameA);
  ok(!(th.messages || []).some(m => m.id === id), 'and it is gone from the recipient\'s thread too');
  r = await a.post('/api/dm/act', { id, act: 'edit', txt: 'again' });
  ok(r && r.error === 'gone', 'acting on a deleted message says so rather than failing silently', r);

  // ── THE CAP MUST KEEP THE NEWEST, NOT THE OLDEST (2026-10-12) ─────────────────────────────────────────────────
  // The owner, as Chako, could not get a message to Papis: it appeared, then vanished on refresh. The thread had
  // reached exactly 200 rows and the read was `ORDER BY ts ASC LIMIT 200`, so it returned the OLDEST 200 and every
  // message after that was stored, delivered and invisible for ever - the inbox preview said 00:24 while the thread
  // stopped at 23:26, and Papis was hitting it in the other direction at the same time.
  // A behavioural test would have to create 201 messages against a 2-second rate limit (7 minutes), so the guard is
  // a BAN ON THE RETIRED SHAPE in the shipped source - the same thing check-formulas.js does for the liquidation
  // formula. It is load-bearing: put `ts ASC` back and this goes red.
  {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'worker.js'), 'utf8');
    const thread = (src.match(/FROM dms WHERE pair=\? ORDER BY ts (?:ASC|DESC) LIMIT \d+/g) || []);
    ok(thread.length === 1 && /DESC/.test(thread[0]),
      'the DM thread read takes the NEWEST messages, not the oldest', thread);
    const sup = (src.match(/FROM support(?: WHERE [^']*?)? ORDER BY ts (?:ASC|DESC) LIMIT \d+/g) || []);
    ok(sup.length > 0 && sup.every(q => /DESC/.test(q)),
      'every capped support read takes the newest too (same trap: it would have hidden new tickets at the cap)',
      sup.filter(q => /ASC/.test(q)));
  }

  for (const u of [A, B, C]) await admin('/api/admin/e2euser', { uid: u, op: 'rm' });
  
  // ONE SET, TWO FILES. The room is served its reactions by the server (the history frame carries `rx`),
  // but a DM thread is a REST poll with no such frame, so mp-auth.js keeps its own DM_RX - and a list that
  // exists twice drifts. Read both and demand they match.
  {
    const wsrc = fs.readFileSync('D:/part1/money-mission/src/worker.js', 'utf8');
    const asrc = fs.readFileSync('D:/part1/money-mission/dist/assets/mp-auth.js', 'utf8');
    const pick = (t, re) => { const m2 = t.match(re); return m2 ? m2[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean).join(' ') : null; };
    const w = pick(wsrc, /const CHAT_RX = \[([^\]]*)\]/);
    const a = pick(asrc, /var DM_RX = \[([^\]]*)\]/);
    ok(!!w && w === a, 'DM_RX must equal the worker CHAT_RX - one set, two files', { worker: w, dm: a });
    ok(!!w && w.split(' ').length === 12, 'twelve: six trade reactions, then the classics behind the scroll', w);
  }

  // A REACTION LEFT BY A RETIRED EMOJI MUST STILL COME OFF. The set changed on 2026-10-18; anything stored
  // under the old one would otherwise sit there for ever with a chip that refuses to clear.
  {
    const wsrc = fs.readFileSync('D:/part1/money-mission/src/worker.js', 'utf8');
    const n = (wsrc.match(/!CHAT_RX_SET\.has\(e2\) && !\(rx\[e2\] \|\| \[\]\)\.length/g) || []).length;
    ok(n === 2, 'both react paths (room and DM) allow removing an emoji that is already on the message', n);
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

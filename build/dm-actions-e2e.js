/* The same three actions on a DIRECT message (owner 2026-09-14: "promena nije u DM chatu uvedena"). DMs are a REST
   thread in the UserStore, not a WebSocket room, so this is its own storage and its own route — and its own proof
   that the rule did not get weaker on the way across: only the sender may edit or delete, only the two people in the
   thread may react at all, and a stranger cannot touch any of it.   node build/dm-actions-e2e.js                  */
'use strict';
const fs = require('fs');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').replace(/^\uFEFF/, '').match(/mpadm_[a-f0-9]+/)[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const admin = async (p, b) => (await fetch(O + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
const THUMB = '\u{1F44D}', HEART = '\u2764\uFE0F';
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

  // a DM needs a connection; follow each other so the thread is allowed
  const fa = await a.post('/api/lb/follow', { tuid: B, tname: nameB });
  const fb = await b.post('/api/lb/follow', { tuid: A, tname: nameA });
  ok(!!(fa && fa.following) || !!(fb && fb.following), 'the two members are connected, so a DM is allowed', { fa, fb });

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

  for (const u of [A, B, C]) await admin('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

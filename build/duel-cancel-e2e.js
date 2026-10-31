// A challenge nobody answered can be taken back, its stake comes home, and only its sender may do it. `node build/duel-cancel-e2e.js`
const fs = require('fs'), path = require('path');
const B = 'https://marginpad.io';
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[\w-]+/) || [])[0];
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m, x === undefined ? '' : JSON.stringify(x)); } };
const admin = (b) => fetch(B + '/api/admin/e2euser', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify(b) }).then((r) => r.json());
const call = (tok, p, b) => fetch(B + '/api/duel/' + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok }, body: b ? JSON.stringify(b) : undefined }).then((r) => r.json());
(async () => {
  const n = Date.now().toString(36).slice(-5), A = 'e2edc' + n, C = 'e2edd' + n;
  try {
    await admin({ uid: A, op: 'mk', xp: 600 }); await admin({ uid: C, op: 'mk', xp: 600 });
    const ta = (await admin({ uid: A, op: 'sess' })).token, tc = (await admin({ uid: C, op: 'sess' })).token;
    const ch = await call(ta, 'challenge', { to: 'e2e_' + C, metric: 'roe' });
    ok(ch && ch.ok && ch.id, 'a challenge goes out', ch);
    const stranger = await call(tc, 'cancelopen', { id: ch.id });
    ok(stranger && stranger.error === 'bad_state', 'the one challenged cannot cancel it', stranger);
    const del = await call(ta, 'cancelopen', { id: ch.id });
    ok(del && del.ok, 'the sender takes it back', del);
    const mine = await call(ta, 'mine');
    ok(!(mine.duels || []).some((d) => d.id === ch.id), 'it is gone from the list', mine.duels);
    const again = await call(ta, 'challenge', { to: 'e2e_' + C, metric: 'roe' });
    ok(again && again.ok, 'the slot is free again', again);
    if (again && again.id) await call(ta, 'cancelopen', { id: again.id });
  } finally { await admin({ uid: A, op: 'rm' }); await admin({ uid: C, op: 'rm' }); }
  console.log('duel-cancel-e2e: pass', pass, 'fail', fail);
  process.exitCode = fail ? 1 : 0;
})();

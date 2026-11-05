// King of the Moon desk E2E - runs against production with the admin key, under a throwaway contest id it clears at the end.
// Since 2026-11-05 Moon prints FULL usernames, so this proves: the raw dashboard dump parses (names, deposits, registered,
// wagered; a collapsed card with no wager line reads $0; repeated page edges merge into one row), compact "name wager" lines
// parse, a typed pair beats the paste, a name resolves to the member who REGISTERED it and nobody else, start/end snapshots
// persist, the standings are END minus START with ranks only above zero - and the registration box on /leaderboards/
// (/api/reward/moonlink): register, refuse a taken name, refuse a malformed one, and the member then resolves on the board.
const fs = require('fs');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const KEY = fs.readFileSync(__dirname + '/../ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const CONTEST = 'e2e-kotm';
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); } };
const post = b => fetch(ORIGIN + '/api/admin/moonwager', { method: 'POST', headers: H, body: JSON.stringify({ contest: CONTEST, ...b }) }).then(r => r.json());
const get = () => fetch(ORIGIN + '/api/admin/moonwager?contest=' + CONTEST + '&cb=' + Date.now(), { headers: H }).then(r => r.json());
const e2euser = b => fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const sfx = String(Date.now()).slice(-6);
const NAME_A = 'e2etestA' + sfx, NAME_B = 'e2etestB' + sfx; // a registration name no real Moon account carries
const DUMP = `${NAME_A}
Total Deposits:
5
Registered
08/03/2026
VIP Level
Rookie
Total Deposits
5
Last Deposit Date
09/01/2026
Overall Wagered
$1,122.44
Overall Commission
$0.47

zzqNobody77
Total Deposits:
0
Registered
09/16/2026
VIP Level
Rookie
Total Deposits
0
Overall Wagered
$10.19
Overall Commission
$0.25

${NAME_B}
Total Deposits:
0

zzqNobody77
Total Deposits:
0

lastOne9th
Total Deposits:
0
Registered
08/03/2026
VIP Level
Rookie
Total Deposits
`;
(async () => {
  console.log('moon-wager-e2e against ' + ORIGIN);
  const uA = 'e2emoonA' + sfx, uB = 'e2emoonB' + sfx;
  const mkA = await e2euser({ uid: uA, op: 'mk' }), mkB = await e2euser({ uid: uB, op: 'mk' });
  ok(mkA && mkA.ok && mkB && mkB.ok, 'two throwaway members minted', [mkA, mkB]);
  const link = (uid, b) => fetch(ORIGIN + '/api/reward/moonlink?uid=' + uid, { method: b ? 'POST' : 'GET', headers: H, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
  try {
    // 0. the registration box
    const g0 = await link(uA);
    ok(g0.ok && g0.eligible === false && g0.name === '', 'a fresh member is not registered', g0);
    const bad = await link(uA, { name: 'no spaces allowed' });
    ok(bad.error === 'bad_name', 'a malformed Moon username is refused', bad);
    const rA = await link(uA, { name: NAME_A });
    ok(rA.ok && rA.name === NAME_A, 'member A registers ' + NAME_A, rA);
    const g1 = await link(uA);
    ok(g1.eligible === true && g1.name === NAME_A && g1.source === 'registered', 'GET reads it back as registered on the board', g1);
    const tk = await link(uB, { name: NAME_A.toUpperCase() });
    ok(tk.error === 'name_taken', 'member B cannot take the same name (case-insensitive)', tk);
    const rB = await link(uB, { name: NAME_B });
    ok(rB.ok, 'member B registers ' + NAME_B, rB);
    const notOurs = await link(uB, { name: 'zzqNobody77' });
    ok(notOurs.error === 'not_ours' || notOurs.ok, 'a name off the referral list is refused once a real list is stored (' + (notOurs.error || 'no list yet') + ')', notOurs);
    if (notOurs.ok) await link(uB, { name: NAME_B });

    // 1. preview of the raw dump - nothing stored
    const p = await post({ text: DUMP, phase: 'preview' });
    ok(p.ok && p.saved === null, 'preview stores nothing');
    ok(p.n === 4, 'raw dump: 4 Moon accounts after merging the repeated page edge (' + p.n + ')', p.rows && p.rows.map(r => r.moon));
    ok(p.diag && p.diag.repeats === 1, 'the repeat is counted (' + (p.diag && p.diag.repeats) + ')');
    const a = p.rows.find(r => r.moon === NAME_A);
    ok(a && a.wager === 1122.44 && a.dep === 5 && a.reg === '08/03/2026', NAME_A + ' carries wagered 1,122.44, 5 deposits, registered 08/03/2026', a);
    ok(a && a.status === 'ok' && a.acct === 'u:' + uA && a.src === 'registered', 'and resolves to the member who registered it', a);
    const b = p.rows.find(r => r.moon === NAME_B);
    ok(b && b.status === 'ok' && b.wager === 0, 'a collapsed card (no wager line) reads $0 and still resolves', b);
    const z = p.rows.find(r => r.moon === 'zzqNobody77');
    ok(z && z.wager === 10.19 && z.status === 'unregistered', 'a name nobody registered is UNREGISTERED, and the merge kept the copy with the figures', z);
    const last = p.rows.find(r => r.moon === 'lastOne9th');
    ok(last && last.wager === 0, 'a truncated last record still parses with wagered 0');
    ok(p.diag && p.diag.skippedN === 0, 'no line of the dump was ignored (' + (p.diag && p.diag.skippedN) + ')', p.diag && p.diag.skipped);
    ok(!p.rows.some(r => 'mask' in r || 'dupMask' in r), 'no row carries a mask any more');

    // 2. compact lines + a typed pair that beats the paste
    const c = await post({ text: NAME_A + ' 50\nzzqNobody77,$1,000.50', manual: NAME_A + ' 75.5', phase: 'preview' });
    const ca = c.rows.find(r => r.moon === NAME_A), cz = c.rows.find(r => r.moon === 'zzqNobody77');
    ok(ca && ca.wager === 75.5 && ca.manual === true, 'a typed pair beats the pasted value for the same name (75.5)');
    ok(cz && cz.wager === 1000.5, 'compact "name,$1,000.50" parses to 1000.5');
    ok(c.diag.manual === 1 && c.diag.pasted === 2, 'diag counts 2 pasted + 1 typed');

    // 3. start snapshot, then an end snapshot with movement
    const s1 = await post({ text: NAME_A + ' 100\n' + NAME_B + ' 40', phase: 'start', save: true });
    ok(s1.saved === 'start' && s1.startTs > 0, 'START saved');
    const s2 = await post({ text: NAME_A + ' 130.25\n' + NAME_B + ' 40\nzzqNobody77 999', phase: 'end', save: true });
    ok(s2.saved === 'end' && Array.isArray(s2.standings), 'END saved and standings returned in the same answer');
    const st = s2.standings || [];
    ok(st[0] && st[0].moon === NAME_A && st[0].delta === 30.25 && st[0].rank === 1, '#1 = A with 130.25 - 100 = 30.25', st[0]);
    const flat = st.find(r => r.moon === NAME_B);
    ok(flat && flat.delta === 0 && !flat.rank, 'a member with no movement has delta 0 and no rank');
    ok(!st.find(r => r.moon === 'zzqNobody77'), 'a Moon account nobody registered is never in the standings');
    const g2 = await get();
    ok(g2.end && g2.end.ok === 2 && g2.standings && g2.standings.length === 2, 'GET after: END persisted, standings from stored snapshots');

    // 3b. typed pairs PATCH the stored END: one name updated, one added, everybody else untouched
    const pt = await post({ patch: true, manual: NAME_A + ' 200\nlateComer11 77' });
    ok(pt.ok && pt.patch && pt.updated === 1 && pt.added === 1, 'patch: A updated + a new name added (' + pt.updated + '/' + pt.added + ')');
    const g4 = await get();
    ok(g4.end && g4.end.rows.length === 4 && g4.end.rows.find(r => r.moon === NAME_A).wager === 200 && g4.end.rows.find(r => r.moon === NAME_B).wager === 40, 'END holds 4 names, A at 200, B still 40');
    ok(g4.standings && g4.standings[0].delta === 100, 'standings follow the patch: A delta 100');
    const nf = await post({ patch: true, manual: '' });
    ok(nf.error === 'nothing_typed', 'an empty patch is refused (' + nf.error + ')');
    const mf = await post({ markFinal: true });
    ok(mf.ok && mf.final === true && mf.pub && mf.pub.final === true, 'END marked FINAL without a paste; the public snapshot carries it');
    await post({ markFinal: false });
    ok(!(await get()).isActive, 'an e2e contest never becomes the live one (moon:active untouched)');
    const pinGone = await post({ pin: { mask: '*****786', reg: '09/22/2026', moon: 'x' } });
    ok(!pinGone.pins, 'the mask pin route is gone');
  } finally {
    // 4. clean up: both snapshots, both registrations (admin unlink), both members
    const c1 = await post({ phase: 'start', clear: true }), c2 = await post({ phase: 'end', clear: true });
    ok(c1.cleared === 'start' && c2.cleared === 'end', 'both snapshots cleared');
    const un = await link(uA, { name: '' });
    ok(un.ok, 'the admin key can unlink a registration (a member cannot)', un);
    await link(uB, { name: '' });
    await e2euser({ uid: uA, op: 'rm' }); await e2euser({ uid: uB, op: 'rm' });
    const g3 = await get();
    ok(!g3.start && !g3.end, 'GET after clear: nothing stored for ' + CONTEST);
  }
  console.log('\nmoon-wager-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

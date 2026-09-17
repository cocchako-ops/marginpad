// King of the Moon desk E2E - runs against production with the admin key, under a throwaway contest id it clears at the end.
// Proves: Moon's raw dashboard dump parses (masks, deposits, registered, wagered), compact "mask wager" lines parse, a typed pair
// beats the paste, a mask resolves to exactly one APPROVED member, a mask nobody registered is named as such, the same mask twice
// at Moon is flagged, start/end snapshots persist, and the standings are END minus START with ranks only above zero.
const fs = require('fs');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const KEY = fs.readFileSync(__dirname + '/../ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const CONTEST = 'e2e-kotm';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const post = b => fetch(ORIGIN + '/api/admin/moonwager', { method: 'POST', headers: H, body: JSON.stringify({ contest: CONTEST, ...b }) }).then(r => r.json());
const get = () => fetch(ORIGIN + '/api/admin/moonwager?contest=' + CONTEST + '&cb=' + Date.now(), { headers: H }).then(r => r.json());
const DUMP = `***X
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
$122.44
Overall Commission
$0.47

****p03
Total Deposits:
0
Registered
09/12/2026
VIP Level
Rookie
Total Deposits
0

*****006
Total Deposits:
1
Registered
08/22/2026
VIP Level
Rookie
Total Deposits
1
Last Deposit Date
09/04/2026

***yyy
Total Deposits:
0
Registered
08/03/2026
VIP Level
Rookie
Total Deposits
0

***yyy
Total Deposits:
0
Registered
08/03/2026
VIP Level
Rookie
Total Deposits
0

**raz
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

***9th
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
  const roster = await get();
  ok(roster && Array.isArray(roster.roster) && roster.members > 0, 'GET returns the roster of approved members (' + (roster.members || 0) + ')');
  const lady = (roster.roster || []).find(r => /^ladyp03$/i.test(r.moon));
  ok(lady && lady.mask === '****p03', 'Ladyp03 is on the roster and Moon shows her as ****p03 (' + (lady && lady.mask) + ')');

  // 1. preview of the raw dump - nothing stored
  const p = await post({ text: DUMP, phase: 'preview' });
  ok(p.ok && p.saved === null, 'preview stores nothing');
  ok(p.n === 7, 'raw dump: 7 Moon rows parsed (' + p.n + ')');
  const x = p.rows.find(r => r.mask === '***X');
  ok(x && x.wager === 122.44 && x.dep === 5 && x.reg === '08/03/2026', '***X carries wagered 122.44, 5 deposits, registered 08/03/2026');
  const l = p.rows.find(r => r.mask === '****p03');
  ok(l && l.status === 'ok' && /^ladyp03$/i.test(l.moon) && l.name, '****p03 resolves to the approved member ' + (l && l.name) + ' (Moon ' + (l && l.moon) + ')');
  ok(l && l.wager === 0, 'a row with no Overall Wagered line reads 0, not null');
  const n6 = p.rows.find(r => r.mask === '*****006');
  ok(n6 && n6.status === 'ok' && n6.dep === 1, '*****006 resolves (' + (n6 && n6.name) + ') with 1 deposit');
  const yy = p.rows.filter(r => r.mask === '***yyy');
  ok(yy.length === 2 && yy.every(r => r.dupMask && r.status === 'dup_mask'), 'the same mask twice at Moon is flagged dup_mask on both rows');
  const raz = p.rows.find(r => r.mask === '**raz');
  ok(raz && raz.wager === 10.19 && raz.status !== 'ok', '**raz parses (10.19) and is not a member: ' + (raz && raz.status));
  const nine = p.rows.find(r => r.mask === '***9th');
  ok(nine && nine.wager === 0, 'a truncated last record still parses with wagered 0');
  ok(p.diag && p.diag.skippedN === 0, 'no line of the dump was ignored (' + (p.diag && p.diag.skippedN) + ')');
  ok(Array.isArray(p.missing) && p.missing.length === roster.members - p.okN, 'approved members absent from the paste are listed: ' + p.missing.length + ' = ' + roster.members + ' approved - ' + p.okN + ' resolved');

  // 2. compact lines + a typed pair that beats the paste
  const c = await post({ text: '****p03 50\n***X,$1,000.50', manual: '****p03 75.5', phase: 'preview' });
  const cl = c.rows.find(r => r.mask === '****p03'), cx = c.rows.find(r => r.mask === '***X');
  ok(cl && cl.wager === 75.5 && cl.manual === true, 'a typed pair beats the pasted value for the same mask (75.5)');
  ok(cx && cx.wager === 1000.5, 'compact "mask,$1,000.50" parses to 1000.5');
  ok(c.diag.manual === 1 && c.diag.pasted === 2, 'diag counts 2 pasted + 1 typed');

  // 3. start snapshot, then an end snapshot with movement
  const s1 = await post({ text: '****p03 100\n*****006 40', phase: 'start', save: true });
  ok(s1.saved === 'start' && s1.startTs > 0, 'START saved');
  const g1 = await get();
  ok(g1.start && g1.start.ok === 2 && !g1.end && g1.standings === null, 'GET shows the START (2 resolved), no END, no standings yet');
  ok(Array.isArray(g1.contests), 'contest ids come back as a list (KV list is eventually consistent, so the new id may lag: ' + g1.contests.join(',') + ')');
  const s2 = await post({ text: '****p03 130.25\n*****006 40\n**raz 999', phase: 'end', save: true });
  ok(s2.saved === 'end' && Array.isArray(s2.standings), 'END saved and standings returned in the same answer');
  const st = s2.standings;
  const top = st[0];
  ok(top && /^ladyp03$/i.test(top.moon) && top.delta === 30.25 && top.rank === 1, '#1 = Ladyp03 with 130.25 - 100 = 30.25 (' + (top && top.delta) + ')');
  const flat = st.find(r => /^nikki006$/i.test(r.moon));
  ok(flat && flat.delta === 0 && !flat.rank, 'a member with no movement has delta 0 and no rank');
  ok(!st.find(r => r.mask === '**raz'), 'an unregistered Moon account is not in the standings');
  const g2 = await get();
  ok(g2.end && g2.end.ok === 2 && g2.standings && g2.standings.length === 2, 'GET after: END persisted, standings from stored snapshots');
  // a member in END but not in START, registered before the start: cannot be ranked and says so
  const s3 = await post({ text: '****p03 130.25\n*****006 40\n***X 500', phase: 'end', save: true });
  const xr = (s3.standings || []).find(r => r.mask === '***X');
  ok(!xr || xr.delta == null, '***X (not a member here) never ranks; a resolved member missing from START would carry delta null');

  // 4. clear both
  const c1 = await post({ phase: 'start', clear: true }), c2 = await post({ phase: 'end', clear: true });
  ok(c1.cleared === 'start' && c2.cleared === 'end', 'both snapshots cleared');
  const g3 = await get();
  ok(!g3.start && !g3.end, 'GET after clear: nothing stored for ' + CONTEST);
  console.log('\nmoon-wager-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

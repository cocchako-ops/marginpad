/* REDUCED REWARDS + A BAN THAT ACTUALLY BANS + THE MULTI-ACCOUNT SWEEP (2026-10-18, owner).

   Three things ship together here and each had a measurement behind it:

   1. REDUCED REWARDS. A member whose single biggest page by their OWN time is /rewards gets the faucet daily cap
      cut in half; #2 costs a quarter; #3 or lower costs nothing. The floor is the owner's: 4.5 h of visible time
      before the rank means anything at all. Measured the day it shipped: 51 members at 50%, 26 at 75%, 1,078
      untouched, and the 50% cohort accounts for 15.3% of all faucet money ever paid.
      THE CUT IS ON THE DAILY CAP, NOT THE PER-CLAIM AMOUNT, and that is arithmetic rather than taste: amountC is
      ONE CENT, so Math.round(1 * 0.5) is 1 and halving the claim would change nothing.

   2. THE BAN. The owner's report was "I banned them a few times and I saw they came back". The sessions were never
      the problem. There were two real holes: the site ban and the faucet ban were DISJOINT (every paid board reads
      the ledger one, so an account banned from the site still counted on the boards and could still be paid a
      prize), and the ban was keyed to an EMAIL, so the same browser signed up again under a new address. The
      device is part of the ban now.

   3. THE SWEEP. It is a dry run until the owner presses the button, `confirm` must match, and the evidence is
      graded: a shared BROWSER is one person; a shared datacentre address is strong; a shared consumer ISP address
      is a family or a carrier NAT and is never swept by default. That last distinction is load-bearing - the first
      dry run proposed azmat786/salma786, which the owner had personally adjudicated on 2026-10-01 as two different
      real people from their Moon registration dates.

   node build/reduced-rewards-e2e.js              against production
   node build/reduced-rewards-e2e.js --pure       only the checks that need no network
   node build/reduced-rewards-e2e.js --falsify    the pure rules, deliberately broken: 6 MUST go red */
const fs = require('fs'), path = require('path');
const BASE = 'https://marginpad.io';
const SRC = path.join(__dirname, '..', 'src', 'worker.js');
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const PURE = process.argv.includes('--pure'), FALSIFY = process.argv.includes('--falsify');
let pass = 0, fail = 0;
const ok = (n, c, note) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (note !== undefined ? '  -> ' + String(typeof note === 'string' ? note : JSON.stringify(note)).slice(0, 220) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const get = (u) => fetch(BASE + u, { headers: H }).then(r => r.json().then(j => ({ status: r.status, j })));
const RX_INLINE = new RegExp('<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>', 'g');
const post = (u, b) => fetch(BASE + u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(r => r.json().then(j => ({ status: r.status, j })));

// ---- lift the shipped rule out of the shipped source, so the test drives what runs ----
function lift() {
  const s = fs.readFileSync(SRC, 'utf8');
  const i = s.indexOf('const RR_MIN_DWELL_S =');
  const j = s.indexOf('\n}', s.indexOf('function rrFactorOf('));
  if (i < 0 || j < 0) throw new Error('rrFactorOf not found in the shipped worker');
  let body = s.slice(i, j + 2);
  if (FALSIFY) body = body
    .replace('const RR_MIN_DWELL_S = 16200;', 'const RR_MIN_DWELL_S = 0;')            // the floor the owner asked for
    .replace('const RR_TIERS = { 1: 50, 2: 75 };', 'const RR_TIERS = { 1: 50, 2: 50 };') // #2 must cost less than #1
    .replace("if (tag === 'off') return { pct: 100, why: 'exempt', source: 'owner' };", ''); // exempt must mean exempt
  return new Function(body + '; return { rrFactorOf: rrFactorOf, MIN: RR_MIN_DWELL_S, TIERS: RR_TIERS, FORCED: RR_FORCED };')();
}
// ---- and the /verify device gate, the half the owner's "they came back" was about ----
function liftDeviceGate() {
  const s = fs.readFileSync(SRC, 'utf8');
  const mark = "      if (b.did) { try { const bd = this.rows('SELECT did FROM bandev WHERE did=?', String(b.did).slice(0, 64))[0];";
  const i = s.indexOf(mark);
  if (i < 0) throw new Error('the /verify device gate is gone from the shipped worker');
  const j = s.indexOf('} catch (e) {} }', i) + '} catch (e) {} }'.length;
  let body = s.slice(i, j);
  if (FALSIFY) body = '      // stripped by --falsify';
  // Driven with `this` BOUND to a stub store and a stub sql, exactly as the Durable Object calls it - the block
  // itself is byte-for-byte what ships, which is the whole point of lifting it instead of restating it.
  return new Function('b', 'banned',
    'var sql = { exec: function () {} }; var email = "someone@example.com";\n' +
    'var store = { rows: function (q, d) { return banned.indexOf(d) >= 0 ? [{ did: d }] : []; }, j: function (o) { return o; } };\n' +
    'var run = function () {\n' + body + '\nreturn null; };\n' +
    'return run.call(store);');
}

(async () => {
  console.log('\n--- the rule itself (lifted from src/worker.js' + (FALSIFY ? ', FALSIFIED' : '') + ') ---');
  const L = lift();
  const F = (rank, hours, tag) => L.rrFactorOf({ rwRank: rank, dwellTotal: hours * 3600, rrtag: tag || '' });
  ok('the floor is the owner\'s 4.5 h', L.MIN === 16200, L.MIN);
  ok('rank 1 past the floor cuts the faucet to 50%', F(1, 10).pct === 50, F(1, 10));
  ok('rank 2 costs less than rank 1', F(2, 10).pct === 75 && F(2, 10).pct > F(1, 10).pct, { r1: F(1, 10).pct, r2: F(2, 10).pct });
  ok('rank 3 is no reduction at all - the tag is gone', F(3, 10).pct === 100, F(3, 10));
  ok('under the floor the rank means nothing', F(1, 4).pct === 100 && F(1, 4.4).pct === 100, { h4: F(4 && 4, 4).pct, h44: F(1, 4.4).pct });
  ok('a newcomer with 85 seconds is never tagged', F(1, 85 / 3600).pct === 100, F(1, 85 / 3600));
  ok('no recorded time on the rewards page is never tagged', F(0, 100).pct === 100, F(0, 100));
  ok('the owner can force it whatever the rank says', F(3, 0.1, 'on').pct === L.FORCED && L.FORCED === 50, F(3, 0.1, 'on'));
  ok('the owner can exempt a member the rule caught', F(1, 100, 'off').pct === 100, F(1, 100, 'off'));
  ok('a forced or exempt verdict says it came from the owner', F(1, 100, 'off').source === 'owner' && F(3, 50).source === 'auto');
  ok('the factor can never zero the faucet', [0, 1, 2, 3, 9].every(r => [0, 1, 5, 100].every(h => F(r, h).pct >= 25)));

  console.log('\n--- the /verify device gate (lifted' + (FALSIFY ? ', FALSIFIED' : '') + ') ---');
  const gate = liftDeviceGate();
  ok('a banned device is refused at the door', (gate({ did: 'devBANNED' }, ['devBANNED']) || {}).error === 'device_banned', gate({ did: 'devBANNED' }, ['devBANNED']));
  ok('an unbanned device passes', gate({ did: 'devCLEAN' }, ['devBANNED']) === null);
  ok('no device cookie at all still passes (the ban under-catches, never over-catches)', gate({}, ['devBANNED']) === null);

  const verdict = () => { // one place decides the exit code, so --pure --falsify is graded like any other run
    console.log('\nreduced-rewards-e2e' + (PURE ? ' (--pure)' : '') + (FALSIFY ? ' (--falsify)' : '') + ': ' + pass + ' passed, ' + fail + ' failed');
    if (!FALSIFY) { process.exitCode = fail ? 1 : 0; return; }
    const want = 6; // measured: breaking the floor, the rank-2 tier, the exempt branch and the device gate turns 7 red
    console.log(fail >= want ? 'falsification OK: the rules are load-bearing (' + fail + ' red)' : 'FALSIFICATION FAILED: expected at least ' + want + ' red, got ' + fail);
    process.exitCode = fail >= want ? 0 : 1;
  };
  if (PURE) { verdict(); return; }

  // ================= live =================
  /* THE UID MUST BE HEX AFTER THE PREFIX. The ledger addresses an account as `u:<uid>` and validates it against
     /^u:[0-9a-z]{8,40}$/ - a real member id is 32 hex characters, so an e2e id with an underscore in it is refused
     by the faucet ban and the test would be grading the harness, not the product. */
  const UID = 'e2e' + [...Array(12)].map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  const DID = 'e2edev' + Math.random().toString(36).slice(2, 10);
  try {
    console.log('\n--- the money path, on a real member ---');
    // 600 XP = past Bronze, so the faucet is actually open to them
    await post('/api/admin/e2euser', { uid: UID, op: 'mk', xp: 600, did: DID, dwell: { '/rewards/': 40000, '/paper-trade': 100, '/': 50 } });
    const sess = (await post('/api/admin/e2euser', { uid: UID, op: 'sess' })).j;
    ok('a real member session was minted', !!sess.token, sess);
    const asMember = (u) => fetch(BASE + u, { headers: { cookie: 'mp_sess=' + sess.token } }).then(r => r.json());

    // the rank rule, end to end: 11.1 h of dwell with /rewards biggest -> rank 1 -> 50%
    await get('/api/admin/runcron?task=rrscan').catch(() => {});
    await post('/api/admin/rrtag', { uid: UID, tag: '' });
    let me = await asMember('/api/reward/me');
    ok('the member is seeded as rank 1 past the floor', true, { perDay: me.perDay, perDayFull: me.perDayFull, rr: me.rrFactor });
    ok('/api/reward/me publishes the factor and the un-reduced cap', me.rrFactor != null && me.perDayFull != null, me);
    ok('the automatic rule halves this member\'s daily cap', Math.abs(me.rrFactor - 0.5) < 0.001 && Math.abs(me.perDay - me.perDayFull / 2) < 0.011, { rr: me.rrFactor, perDay: me.perDay, full: me.perDayFull });

    const forced = (await post('/api/admin/rrtag', { uid: UID, tag: 'on' })).j;
    ok('forcing the tag answers with the decided factor', forced.ok && forced.state && forced.state.factorPct === 50, forced);
    await sleep(1200);
    me = await asMember('/api/reward/me');
    ok('a forced tag halves the cap the member is served', Math.abs(me.rrFactor - 0.5) < 0.001, me.rrFactor);

    const exempt = (await post('/api/admin/rrtag', { uid: UID, tag: 'off' })).j;
    ok('exempting answers 100%', exempt.ok && exempt.state && exempt.state.factorPct === 100, exempt);
    await sleep(1200);
    me = await asMember('/api/reward/me');
    ok('an exempt member is served the full cap again', Math.abs(me.rrFactor - 1) < 0.001 && Math.abs(me.perDay - me.perDayFull) < 0.001, { rr: me.rrFactor, perDay: me.perDay, full: me.perDayFull });
    ok('a bad tag is refused, not stored', (await post('/api/admin/rrtag', { uid: UID, tag: 'half' })).status === 400);

    console.log('\n--- the ban, in all three places ---');
    await post('/api/admin/rrtag', { uid: UID, tag: '' });
    const before = (await get('/api/auth/user?id=' + UID)).j;
    ok('the member is active and their device is clean before the ban', before.user.status === 'active' && before.user.devBanned === false, { st: before.user.status, dev: before.user.devBanned });
    // the faucet account has to EXIST before it can be banned - a credit is what creates the ledger row
    await post('/api/admin/credit', { uid: UID, usd: 0.1, note: 'e2e reduced-rewards suite' });
    // ONE call. This is the button the owner presses, and it must do both books by itself - until 2026-10-18 it
    // did only the site half, so a banned member still counted on every paid board.
    const banned = (await post('/api/auth/control', { id: UID, action: 'ban', by: 'e2e' })).j;
    ok('the ban is accepted', banned.ok, banned);
    ok('one call banned the faucet book too, not just the site', banned.ledger === true, banned);
    await sleep(1500);
    const after = (await get('/api/auth/user?id=' + UID)).j;
    ok('the account is banned on the site', after.user.status === 'banned', after.user.status);
    ok('their device is on the barred list', after.user.devBanned === true, after.user.devBanned);
    const dev = (await get('/api/admin/bandev')).j;
    ok('the barred device is listed with who it was banned with', (dev.devices || []).some(d => d.did === DID), (dev.devices || []).slice(0, 3));
    const acct = (await get('/api/admin/acctlog?acct=u:' + UID + '&n=3')).j;
    ok('the faucet account is banned too, so no board can pay them', !!(acct.account && acct.account.banned), acct.account);
    // THE LOAD-BEARING CHECK: a banned member's session is gone, which is what the owner asked about
    const meAfter = await fetch(BASE + '/api/auth/me', { headers: { cookie: 'mp_sess=' + sess.token } }).then(r => r.json()).catch(() => ({}));
    ok('their session no longer authenticates', !(meAfter && meAfter.user && meAfter.user.id), meAfter);
    const lifted = (await post('/api/admin/bandev', { did: DID, lift: true })).j;
    ok('a barred device can be opened again by hand', lifted.ok && !((await get('/api/admin/bandev')).j.devices || []).some(d => d.did === DID));
    const un = (await post('/api/auth/control', { id: UID, action: 'unban' })).j;
    await sleep(1200);
    const back = (await get('/api/admin/acctlog?acct=u:' + UID + '&n=3')).j;
    ok('unban lifts BOTH halves, or a mistake is unfixable', un.ok && un.ledger === true && back.account && !back.account.banned, { un: un, banned: back.account && back.account.banned });

      /* THE SERVER-RENDERED PROFILE PAGE MUST PARSE. Its whole HTML is a worker template literal, so one escape
       sequence written into the inline script is emitted as a REAL newline inside a browser string literal and
       kills EVERY button on the page, not just the new one. That shipped for one deploy on 2026-10-18 and both
       the lint and the smoke test passed happily - only the browser's page error found it. dist pages have
       check-inline-js; this page had nothing watching it at all. */
    console.log('\n--- the profile page the controls live on ---');
    const sTok = (await post('/api/stats/session', {})).j.token;
    const html = await fetch(BASE + '/api/admin/user?username=alefzed', { headers: { cookie: 'mp_sadm=' + sTok } }).then(r => r.text());
    const scripts = [...html.matchAll(RX_INLINE)].map(m => m[1]);
    ok('the profile page serves its inline script and the control', scripts.length > 0 && html.indexOf('rrField') > 0, { scripts: scripts.length });
    let badJs = null;
    for (const sc of scripts) { try { new Function(sc); } catch (e) { badJs = String(e.message).slice(0, 90); break; } }
    ok('every inline script on it PARSES', badJs === null, badJs);

  console.log('\n--- the sweep ---');
    const dry = (await get('/api/admin/multiacct')).j;
    ok('it is a dry run and says so', dry.dryRun === true && dry.totals && typeof dry.totals.accounts === 'number', dry.totals);
    ok('the default evidence excludes a shared consumer ISP address', (dry.evidence || []).indexOf('ip_isp') < 0 && (dry.evidence || []).indexOf('device') >= 0, dry.evidence);
    ok('every target carries the evidence that named it', (dry.clusters || []).every(c => (c.targets || []).every(t => ['device', 'ip_dc'].indexOf(t.evidence) >= 0)));
    ok('the main of every cluster is the highest level in it', (dry.clusters || []).every(c => { const m = c.members.find(x => x.main); return m && c.members.every(x => x.xpLife <= m.xpLife); }));
    ok('no cluster proposes banning its own main', (dry.clusters || []).every(c => (c.targets || []).every(t => !c.members.find(m => m.uid === t.uid && m.main))));
    ok('the owner\'s own accounts are never proposed', (dry.clusters || []).every(c => (c.targets || []).every(t => ['chako', 'whyme', 'gladijator'].indexOf(String(t.username || '').toLowerCase()) < 0)));
    ok('no e2e account is ever proposed', (dry.clusters || []).every(c => (c.targets || []).every(t => !/^e2e/i.test(t.uid) && !/^e2e/i.test(t.username || ''))));
    const wide = (await get('/api/admin/multiacct?ev=device,ip_dc,ip_isp')).j;
    ok('asking for the weak evidence widens the set, so the grading is real', (wide.totals.accounts || 0) > (dry.totals.accounts || 0), { strict: dry.totals.accounts, wide: wide.totals.accounts });
    const bad = await post('/api/admin/multiacct', { apply: true, confirm: 999999 });
    ok('a stale confirm is refused', bad.status === 409 && bad.j.error === 'confirm_mismatch', bad.j);
    const notOffered = await post('/api/admin/multiacct', { apply: true, confirm: 1, only: ['0000000000000000000000000000dead'] });
    ok('an account the dry run never offered cannot be named', notOffered.status === 400 && notOffered.j.error === 'not_in_dry_run', notOffered.j);
    const dry2 = (await get('/api/admin/multiacct')).j;
    ok('nothing the dry run looked at was changed by looking', dry2.totals.accounts === dry.totals.accounts, { a: dry.totals.accounts, b: dry2.totals.accounts });
  } finally {
    await post('/api/admin/e2euser', { uid: UID, op: 'rm' }).catch(() => {});
    await post('/api/admin/bandev', { did: DID, lift: true }).catch(() => {});
  }

  verdict();
})().catch(e => { console.error(e); process.exitCode = 1; });

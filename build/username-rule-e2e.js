/* A USERNAME IS TEN CHARACTERS, IT IS REQUIRED, AND THE LONG ONES GET ONE FREE CHANGE (2026-10-28, owner: "kod
   pravljenja naloga, izbeci da napises username ne sme da bude moguce" + "max lenght treba da bude fazon 10
   karaktera. Svako ko ima duze, posalji mu da moze free da zameni").
   MEASURED before any of it: of 1,461 accounts, 60 carried NO username (8 of them had already traded) and 250 of
   the 1,401 named ones were over ten characters. An account with no username can never rank, because every board
   resolves its row by name - which is the owner's second question, and this suite answers it too.
   Pure: UN_RE out of the SHIPPED worker, the one-definition ban, and the board SQL that drops a nameless row.
   Live: a real throwaway member - an 11-char name refused, a 10-char one accepted, a second change refused; and
   because `e2euser mk` names the account `e2e_<uid>`, which is over the limit by construction, the free-change
   path is exercised on a real over-long name.
   node build/username-rule-e2e.js          --pure = no network                                                  */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.indexOf('--pure') >= 0;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter(l => !/^\s*\/\//.test(l)).join('\n');

(async () => {
  console.log('-- pure: the rule, and that there is only one of it');
  const m = src.match(/const UN_MIN = (\d+), UN_MAX = (\d+), UN_RE = new RegExp\('\^\[a-zA-Z0-9_\]\{' \+ UN_MIN \+ ',' \+ UN_MAX \+ '\}\$'\);/);
  ok(!!m, 'UN_MIN/UN_MAX/UN_RE are one declaration built from the two numbers');
  const UN_MIN = m ? +m[1] : 0, UN_MAX = m ? +m[2] : 0;
  ok(UN_MAX === 10 && UN_MIN === 3, 'the limit is ' + UN_MIN + '-' + UN_MAX);
  const UN_RE = new RegExp('^[a-zA-Z0-9_]{' + UN_MIN + ',' + UN_MAX + '}$');
  for (const [v, want] of [['abc', true], ['abcdefghij', true], ['abcdefghijk', false], ['ab', false], ['a_9', true], ['has space', false], ['tenchars10', true], ['stickinmywalletdaddy', false], ['', false]])
    ok(UN_RE.test(v) === want, '"' + v + '" (' + v.length + ') is ' + (want ? 'accepted' : 'refused'));
  // ONE DEFINITION: no username path may carry its own literal again (the API_TIER_MAX lesson)
  const body = strip(src);
  const setterLines = body.split('\n').filter(l => /bad_username/.test(l) && /\{3,20\}/.test(l));
  ok(setterLines.length === 0, 'no username SETTER still carries its own {3,20} literal (' + setterLines.length + ')');
  /* THE @MENTION PARSER IS A DELIBERATE EXCEPTION AND MUST STAY WIDE. 250 members carry a name longer than ten
     characters and nobody is renamed for them, so a parser narrowed to the new limit would silently stop every one
     of those members from being mentionable in chat. This asserts it did NOT get "tidied" along with the rest. */
  ok(/@\(\[a-zA-Z0-9_\]\{3,(1[1-9]|20|[2-9]\d)\}\)/.test(body), 'the @mention parser still matches names longer than the new limit, so existing long names stay mentionable');
  ok((body.match(/UN_RE\.test\(/g) || []).length >= 2, 'at least two call sites read UN_RE (the member setter and the owner override)');
  // THE OWNER'S SECOND QUESTION: a nameless row cannot rank, and no board has a level gate
  ok(/username IS NOT NULL AND username!=''/.test(body), "the board name resolution requires a username, so a nameless account cannot rank");
  const boardRegion = body.slice(body.indexOf("if (path === '/leaderboard')"), body.indexOf("if (path === '/leaderboard')") + 9000);
  ok(!/rewardsUnlocked|REWARDS_MIN_XP/.test(boardRegion), 'the board path carries NO level or XP gate - a brand-new account ranks');
  // the free change closes itself: the setter compares the CURRENT name to the limit, it keeps no flag
  ok(/curUn && curUn\.length <= UN_MAX/.test(body), 'the one free change is gated on the current name being over the limit (no stored flag)');
  // the notice never reaches a test account
  ok(/\/\^e2e\[_-\]\/i\.test\(String\(r\.username/.test(body), 'the over-limit listing drops e2e accounts');
  const cli = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js'), 'utf8');
  ok(/var UN_MIN = 3, UN_MAX = 10, UN_RE = new RegExp\(/.test(cli), 'the client mirrors the rule from the same two numbers');
  ok(/maxlength="' \+ UN_MAX \+ '"/.test(cli), 'the input maxlength is the constant, not a literal');
  ok(/if \(ME && !ME\.username\)/.test(cli), 'close() refuses while a signed-in account has no username');
  ok(/sign out below/i.test(cli), 'the gate names the escape hatch, so nobody is trapped in the sheet');
  ok(!/\{3,20\}/.test(cli.replace(/__esD_mpauth[\s\S]*?\};/, '')), 'no 3-20 literal left in the client code');
  if (PURE) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }

  console.log('-- live');
  const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
  const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
  const AH = { 'x-admin-key': K, 'content-type': 'application/json' };
  const t = Date.now().toString(36), uid = 'e2eun' + t;
  const mk = await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'mk', xp: 10 }) });
  ok(mk.s === 200, 'test member minted');
  const se = await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'sess' }) });
  const tok = se.b && (se.b.token || se.b.sess || se.b.mp_sess);
  ok(!!tok, 'member session minted');
  const H = { cookie: 'mp_sess=' + tok, 'content-type': 'application/json' };
  const setU = (v) => j('/api/auth/username', { method: 'POST', headers: H, body: JSON.stringify({ username: v }) });
  // the account is named e2e_<uid> by the mint, which is over the limit - exactly the population this round is about
  const me0 = await j('/api/auth/me', { headers: H });
  const cur0 = (me0.b && (me0.b.username || (me0.b.user && me0.b.user.username))) || '';
  ok(cur0.length > 10, 'the fixture starts with an OVER-LIMIT name "' + cur0 + '" (' + cur0.length + ')');
  const long = await setU('abcdefghijk'); // 11
  // assert the BODY, not the status: the refusal is what matters and the wrapper may answer 200 or 400
  ok(long.b && long.b.error === 'bad_username' && long.b.max === 10 && long.b.min === 3, 'an 11-character name is refused and the server states its own bounds (' + long.s + ' ' + JSON.stringify(long.b) + ')');
  const short = await setU('ab'); // 2
  ok(short.b && short.b.error === 'bad_username', 'a 2-character name is refused');
  const bad = await setU('has space1');
  ok(bad.b && bad.b.error === 'bad_username', 'a name with a space is refused even at 10 characters');
  // the free change: to a name that is still e2e-filtered everywhere (e2e_ + 6 = exactly 10)
  const good = 'e2e_' + t.slice(-6);
  const okRes = await setU(good);
  ok(okRes.s === 200 && okRes.b && okRes.b.ok && okRes.b.username === good && okRes.b.renamedFrom === cur0, 'the free change is accepted and names what it replaced (' + JSON.stringify(okRes.b) + ')');
  ok(good.length === 10, 'the new name is exactly at the limit (' + good.length + ')');
  // AND THE DOOR CLOSES ITSELF - no second change, because the current name now fits
  const again = await setU('e2e_zz' + t.slice(-4));
  ok(again.b && again.b.error === 'already_set' && again.b.username === good, 'a second change is refused: the grant closed itself (' + JSON.stringify(again.b) + ')');
  // the owner's override obeys the same rule
  const ctl = await j('/api/auth/control', { method: 'POST', headers: AH, body: JSON.stringify({ id: uid, action: 'username', username: 'waytoolongname' }) });
  ok(ctl.b && ctl.b.error === 'bad_username', 'the owner override cannot mint an over-limit name either (' + JSON.stringify(ctl.b) + ')');
  // the desk: a dry run that sends nothing, and never lists a test account
  const dry = await j('/api/admin/unrename', { headers: AH });
  ok(dry.s === 200 && dry.b && dry.b.ok && dry.b.dry === true && dry.b.sent === 0, 'the rename desk is a DRY RUN by default and sent nothing');
  ok(dry.b.max === 10 && typeof dry.b.over === 'number' && typeof dry.b.returning === 'number', 'it states the limit, how many are over it and how many of those come back (over ' + dry.b.over + ', returning ' + dry.b.returning + ')');
  ok(!(dry.b.rows || []).some(r => /^e2e[_-]/i.test(r.username || '')), 'no test account is on the list');
  ok(!(dry.b.rows || []).some(r => String(r.username || '').length <= 10), 'every listed name really is over the limit');
  // the boards: no blank name anywhere, which is the same invariant as "a nameless account cannot rank"
  const lb = await j('/api/reward/lb?full=1&nc=1&cb=' + Date.now());
  const blanks = ['top', 'topGreen', 'topWr', 'topXp', 'topGold'].reduce((s, k) => s + ((lb.b && lb.b[k]) || []).filter(r => !String(r.who || r.name || '').trim()).length, 0);
  ok(blanks === 0, 'no board row carries a blank name (' + blanks + ')');
  const xpRows = (lb.b && lb.b.topXp) || [];
  const lowest = xpRows.length ? Math.min(...xpRows.map(r => +r.xp || +r.score || Infinity).filter(n => isFinite(n))) : null;
  ok(xpRows.length > 0 && lowest !== null && lowest < 500, 'members below Bronze (500 XP) DO rank - lowest on the XP board is ' + lowest);
  const rm = await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'rm' }) });
  ok(rm.s === 200, 'test member removed');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

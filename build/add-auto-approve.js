#!/usr/bin/env node
/* THE ROBOT APPROVES WHAT IT CAN PROVE (2026-10-22, owner: "mexc treba automatski da odobri to. imamo povezan
   api nek uporedi sa unosom i nek odobri ako moze. isto tako i bitget treba da radi. bingx cekamo api").

   The verification existed and was never ON: `/api/admin/mexcverify` is a dry run, so somebody had to remember
   to call it with {run:true}. Measured the day this shipped, the MEXC queue held six claims and the API could
   already settle two of them; they had been waiting because nothing asked.

   WHAT THIS DOES NOT CHANGE, and it is the whole safety of the thing: IT ONLY EVER APPROVES. A refusal, an
   outage, a rate limit, a missing key, a UID that is not ours, a member who typed their MarginPad username into
   the box - every one of those leaves the claim PENDING for the owner. A wrong auto-approve is money gone; a
   wrong auto-reject insults a real member who did everything right. So the robot hands him less work and never
   a decision he did not make. (Of the six measured, it would clear two and leave four for him - which is the
   honest split, not a failure.)

   FOUR GUARDS, because this is a cron that moves real money:
     1. ONE TABLE. `signVerifySweep(env, venue, opts)` replaces the two hand-copied sweeps; BingX joins the day
        their API does, by adding a lookup - not by a third copy. (This feature set has broken three times in a
        week from exactly that kind of copy.)
     2. A CEILING PER PASS. `AUTO_APPROVE_MAX` - a bug cannot drain the ledger before anybody notices.
     3. A KILL SWITCH the owner owns (`autoApprove` in the reward config, ops Settings), default ON because he
        asked for it, off in one click.
     4. IT SAYS WHAT IT DID. One Telegram line per pass that actually paid, naming who and how much. An
        automatic payer nobody can see is how a silent bug runs for a week.

   AND THE MEMBER IS TOLD. A hand-approval already pushes a bell row; the sweeps never passed `notify`, so a
   robot-approved bonus would have landed in silence. It passes it now - and the default notification body said
   "Moon" or "Fomo" whatever the venue was, which is the same venue-blind string bug as everything else today.

   Idempotent, --dry. Refuses rather than guessing.                                                             */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'src', 'worker.js');
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
const done = [];

function one(name, a, b, skipIf) {
  if (skipIf && [].concat(skipIf).some(m => h.indexOf(m) >= 0)) return false;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1');
  h = h.split(a).join(b);   // split/join, never String.replace - a `$` in the replacement is a capture reference
  done.push(name);
  return true;
}
/* cut from a start marker to an end marker. NEVER fails silently: a start that does not match is the
   "it printed ok and changed nothing" trap this repo has recorded twice. */
function cut(name, startMark, endMark, replacement, skipIf) {
  if (skipIf && h.indexOf(skipIf) >= 0) return false;
  const a = h.indexOf(startMark);
  if (a < 0) throw new Error(name + ': start marker not found -> ' + JSON.stringify(startMark.slice(0, 70)));
  if (h.indexOf(startMark, a + 1) >= 0) throw new Error(name + ': start marker is not unique');
  const b = h.indexOf(endMark, a);
  if (b < 0) throw new Error(name + ': start found but end marker missing');
  h = h.slice(0, a) + replacement + h.slice(b);
  done.push(name);
  return true;
}

/* ---- 1. the two sweeps become one ------------------------------------------------------------------------ */
const GENERIC = [
  "/* ONE SWEEP FOR EVERY VENUE WHOSE ANSWER COMES FROM AN AFFILIATE API (2026-10-22). This was written twice -",
  "   once for MEXC, once for Bitget - and BingX would have made a third copy of the same forty lines. The venue",
  "   is a parameter; a new one needs a lookup in affVenueLookup and a key test in signGateReady, nothing else.",
  "",
  "   IT ONLY EVER APPROVES. `apply` is what pays; rejecting stays opt-in (`reject`) and is never what the cron",
  "   does, because a wrong auto-reject insults a member who did everything right while a wrong auto-approve is",
  "   money gone. Anything the API cannot CONFIRM - an outage, a rate limit, a UID that is not ours, a member who",
  "   typed their MarginPad username into the box - stays pending for a human. It pays through the ordinary review",
  "   route, so the XP, the ledger row and the member's notification are identical to a hand-approval: there is no",
  "   second way to pay a sign-up bonus, which is what keeps the books honest. */",
  "function signGateReady(env, venue) {   // the ONE reading of \"can this venue be verified without a human\"",
  "  if (venue === 'mexc') return !!(env.MEXC_API_KEY && env.MEXC_API_SECRET);",
  "  if (venue === 'bitget') return !!(env.BITGET_API_KEY && env.BITGET_API_SECRET && env.BITGET_API_PASSPHRASE);",
  "  return false;                        // BingX and Moon are checked by hand - there is no API to ask yet",
  "}",
  "async function signVerifySweep(env, venue, opts) {",
  "  const v = String(venue || '').toLowerCase(), label = (SIGN_VENUES[v] && SIGN_VENUES[v].label) || v.toUpperCase();",
  "  const apply = !!(opts && opts.apply), cap = Math.min(40, Math.max(1, (opts && +opts.limit) || 25));",
  "  const payCap = Math.max(1, (opts && +opts.max) || AUTO_APPROVE_MAX);",
  "  const out = { venue: v, checked: 0, approved: 0, held: 0, apply, rows: [] };",
  "  if (!signGateReady(env, v)) { out.error = 'no_key'; return out; }",
  "  let pending = [];",
  "  try {",
  "    const lr = await handleReward(new URL('https://marginpad.io/api/reward/' + v + 'sign/list'), new Request('https://marginpad.io/api/reward/' + v + 'sign/list', { headers: { 'x-admin-key': adminKeyOf(env) } }), env);",
  "    const lj = await lr.json();",
  "    pending = (lj.pending || []).filter(x => x.exchange === v && !String(x.uid || '').startsWith('e2e') && !/^e2e/i.test(String(x.address || '').replace(/^u:/, '')));",
  "  } catch (e) { out.error = 'list_failed'; return out; }",
  "  for (const row of pending.slice(0, cap)) {",
  "    out.checked++;",
  "    const r = await affVenueLookup(env, v, row.uid);",
  "    const rec = { id: row.id, uid: row.uid, acct: String(row.address || '').slice(0, 24), verdict: r.found ? 'ours' : (r.ok ? r.why : ('error:' + r.why)) };",
  "    if (r.found && r.tradingAmount != null) { rec.traded = r.tradingAmount; rec.commission = r.commission; }",
  "    /* A DEFINITIVE NEGATIVE IS SOMETHING THE VENUE SAID, NEVER SOMETHING WE FAILED TO ASK. */",
  "    const no = r.ok && !r.found && (r.why === 'not_our_referral' || r.why === 'other_invite_code' || r.why === 'not_a_uid');",
  "    if (no && apply && opts && opts.reject) {",
  "      const rnote = r.why === 'not_a_uid'",
  "        ? 'That does not look like a ' + label + ' UID. Your UID is the number in your ' + label + ' account menu, not your MarginPad username. You can submit once more.'",
  "        : 'We could not find this UID among the accounts that opened through our ' + label + ' link, so the sign-up bonus does not apply to it. If you created your ' + label + ' account another way, the bonus cannot be paid for it. If you think this is a mistake, write to support and we will look again.';",
  "      try {",
  "        const rr2 = await handleReward(new URL('https://marginpad.io/api/reward/' + v + 'sign/review'),",
  "          new Request('https://marginpad.io/api/reward/' + v + 'sign/review', { method: 'POST', headers: { 'x-admin-key': adminKeyOf(env), 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id, action: 'reject', note: rnote, notify: true }) }), env);",
  "        const rj2 = await rr2.json();",
  "        rec.rejected = !!(rj2 && rj2.status === 'rejected'); if (!rec.rejected) rec.payError = (rj2 && rj2.error) || 'failed';",
  "      } catch (e) { rec.rejected = false; rec.payError = 'threw'; }",
  "      if (rec.rejected) out.rejected = (out.rejected || 0) + 1; else out.held++;",
  "      out.rows.push(rec);",
  "      continue;",
  "    }",
  "    if (r.found && apply && out.approved < payCap) {",
  "      const note = 'auto-verified against the ' + label + ' affiliate API: uid ' + r.uid + ' is one of our referrals'",
  "        + (r.code ? ' under ' + r.code : '')",
  "        + (r.tradingAmount != null ? ', traded $' + (+r.tradingAmount).toFixed(2) + ', commission $' + (+r.commission).toFixed(4) : '')",
  "        + (r.registerTime ? ', registered ' + new Date(+r.registerTime).toISOString().slice(0, 10) : '');",
  "      try {",
  "        const rr = await handleReward(new URL('https://marginpad.io/api/reward/' + v + 'sign/review'),",
  "          new Request('https://marginpad.io/api/reward/' + v + 'sign/review', { method: 'POST', headers: { 'x-admin-key': adminKeyOf(env), 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id, action: 'approve', note, notify: true }) }), env);",
  "        const rj = await rr.json();",
  "        rec.paid = !!(rj && rj.status === 'approved'); rec.amount = (rj && +rj.amount) || 0; rec.acctUid = (rj && rj.acct) || '';",
  "        if (!rec.paid) rec.payError = (rj && rj.error) || 'failed';",
  "      } catch (e) { rec.paid = false; rec.payError = 'threw'; }",
  "      if (rec.paid) out.approved++; else out.held++;",
  "    } else out.held++;",
  "    out.rows.push(rec);",
  "  }",
  "  try { await env.STATS.put(v + 'verify:last', JSON.stringify({ ts: Date.now(), checked: out.checked, approved: out.approved, held: out.held, apply }), { expirationTtl: 2592000 }); } catch (e) {}",
  "  return out;",
  "}",
  "/* THE CRON HALF (owner: \"nek odobri ako moze\"). Runs on the affiliate pass, walks every OPEN venue that has a",
  "   working key, and pays what the venue's own API confirms. Silent when it did nothing - and loud, once, when it",
  "   did: an automatic payer nobody can see is how a silent bug runs for a week. */",
  "async function autoApproveSweep(env) {",
  "  if (!env.STATS || !env.REWARDS) return { skipped: 'no_env' };",
  "  let cfg = null; try { cfg = await rewardCfg(env); } catch (e) {}",
  "  if (cfg && cfg.autoApprove === false) return { skipped: 'off' };   // the owner's switch, ops > Reward config",
  "  const out = { venues: {}, approved: 0 }, paid = [];",
  "  for (const v of Object.keys(SIGN_VENUES)) {",
  "    if (!SIGN_VENUES[v].open || !signGateReady(env, v)) continue;",
  "    let r = null;",
  "    try { r = await signVerifySweep(env, v, { apply: true, limit: 25, max: AUTO_APPROVE_MAX }); }",
  "    catch (e) { out.venues[v] = { error: String((e && e.message) || e).slice(0, 80) }; continue; }",
  "    out.venues[v] = { checked: r.checked, approved: r.approved, held: r.held, error: r.error || null };",
  "    out.approved += r.approved;",
  "    for (const row of (r.rows || [])) if (row.paid) paid.push({ v: v, label: (SIGN_VENUES[v] && SIGN_VENUES[v].label) || v, uid: row.uid, amount: row.amount, acct: row.acctUid });",
  "  }",
  "  if (!paid.length) return out;",
  "  let names = {}; try { names = await resolveProfiles(env, paid.map(p => 'u:' + String(p.acct || '').replace(/^u:/, ''))); } catch (e) {}",
  "  const who = p => { const k = String(p.acct || '').replace(/^u:/, ''); const n = names && (names[k] || names['u:' + k]); return (n && (n.username || n.name)) ? '@' + (n.username || n.name) : ('account ' + k.slice(0, 8)); };",
  "  try {",
  "    await tgOwner(env, 'signup auto-approved', 'Paid ' + paid.length + ' sign-up bonus' + (paid.length === 1 ? '' : 'es') + ' automatically',",
  "      [paid.map(p => p.label + ' UID ' + p.uid + ' - ' + who(p) + ' - $' + (+p.amount || 0).toFixed(2)).join(String.fromCharCode(10)),",
  "        'Verified against the venue\\u2019s own affiliate API. Anything it could not confirm is still waiting for you.'],",
  "      'https://marginpad.io/api/stats#money/faucet');",
  "  } catch (e) {}",
  "  return out;",
  "}",
].join('\n');

cut('one sweep for every venue, replacing the MEXC copy',
  "/* The sweep. DRY BY DEFAULT - `apply` is what pays. It approves through the ordinary review route so the member",
  "/* THE KEY DIES EVERY 90 DAYS BY MEXC'S OWN RULE",
  GENERIC + '\n', 'async function signVerifySweep');

/* A SKIP GUARD ON A DELETION IS INVERTED: "already applied" means the thing is GONE, not that it is there.
   Written the usual way round, this skipped itself for ever and the guard below caught it. */
if (h.indexOf('async function bitgetVerifySweep') >= 0) {
  cut('and the Bitget copy',
    "/* The sweep. DRY BY DEFAULT - `apply` is what pays, and it pays through the ordinary review route so the member",
    "/* A CREDENTIAL THAT DIES IN SILENCE",
    '');
}

/* the two admin routes call the generic */
one('the MEXC desk calls the generic sweep',
  "const res = await mexcVerifySweep(env, { apply: body.run === true, reject: body.reject === true, limit: body.limit });",
  "const res = await signVerifySweep(env, 'mexc', { apply: body.run === true, reject: body.reject === true, limit: body.limit, max: body.max });",
  "signVerifySweep(env, 'mexc'");
one('the Bitget desk calls the generic sweep',
  "const resB = await bitgetVerifySweep(env, { apply: bodyB.run === true, reject: bodyB.reject === true, limit: bodyB.limit });",
  "const resB = await signVerifySweep(env, 'bitget', { apply: bodyB.run === true, reject: bodyB.reject === true, limit: bodyB.limit, max: bodyB.max });",
  "signVerifySweep(env, 'bitget'");

/* ---- 2. the ceiling ------------------------------------------------------------------------------------- */
one('the per-pass approval ceiling',
  "const SIGN_VENUES = {",
  "/* A CRON THAT PAYS NEEDS A CEILING. Sign-up claims arrive a handful a day, so ten in one ten-minute pass is far\n"
  + "   above anything real and far below anything that could drain the ledger before the Telegram line is read. */\n"
  + "const AUTO_APPROVE_MAX = 10;\n"
  + "const SIGN_VENUES = {",
  'const AUTO_APPROVE_MAX');

/* ---- 3. the switch -------------------------------------------------------------------------------------- */
one('rewardCfg carries the autoApprove switch',
  "for (const k of ['enabled', 'wdEnabled', 'requireOnchain', 'promoEnabled', 'moonEnabled',",
  "for (const k of ['autoApprove', 'enabled', 'wdEnabled', 'requireOnchain', 'promoEnabled', 'moonEnabled',",
  "'autoApprove', 'enabled'");
one('and its default is ON',
  "return { enabled: !!m.enabled, wdEnabled: m.wdEnabled !== false,",
  "return { autoApprove: m.autoApprove !== false, enabled: !!m.enabled, wdEnabled: m.wdEnabled !== false,",
  'autoApprove: m.autoApprove !== false');

/* ---- 4. the cron ---------------------------------------------------------------------------------------- */
one('the cron runs the auto-approval',
  "[checkMexcKey, 'mexckey'], [checkBitgetKey, 'bitgetkey'], [bitgetRefSync, 'bitgetrefs']]) {",
  "[checkMexcKey, 'mexckey'], [checkBitgetKey, 'bitgetkey'], [bitgetRefSync, 'bitgetrefs'], [autoApproveSweep, 'autoapprove']]) {",
  "[autoApproveSweep, 'autoapprove']");

/* ---- 5. the member is told, and told the right venue ----------------------------------------------------- */
one('the approval notification names the venue it was for',
  "body: String(b.notifyBody || ('Your ' + (path.indexOf('fomo') >= 0 ? 'Fomo' : 'Moon') + ' sign-up has been approved - $' + ((+data.amount || 1)).toFixed(2) + ' landed on your rewards balance')).slice(0, 200)",
  "body: String(b.notifyBody || ('Your ' + ((SIGN_VENUES[(SIGN_RE.exec(path) || [])[1]] || {}).label || 'exchange') + ' sign-up has been approved - $' + ((+data.amount || 1)).toFixed(2) + ' landed on your rewards balance')).slice(0, 200)",
  "(SIGN_VENUES[(SIGN_RE.exec(path) || [])[1]] || {}).label");

/* ---- 6. the submit line stops telling him to do what the robot now does ---------------------------------- */
one('the claim alert says who will check it',
  "              'Check it in the ' + _lbT + ' affiliate dashboard before you approve - that check is the only thing between a typed UID and a real dollar.'],",
  "              signGateReady(env, _vT)\n"
  + "                ? 'The ' + _lbT + ' affiliate API checks this one by itself within ten minutes. You only hear from it again if it could not confirm the UID.'\n"
  + "                : 'Check it in the ' + _lbT + ' affiliate dashboard before you approve - that check is the only thing between a typed UID and a real dollar.'],",
  'signGateReady(env, _vT)');

/* ---- report ---------------------------------------------------------------------------------------------- */
if (!done.length) { console.log('add-auto-approve: nothing to do (already applied)'); process.exit(0); }

// guards
for (const nm of ['signGateReady', 'signVerifySweep', 'autoApproveSweep']) {
  if ((h.match(new RegExp('function ' + nm + '\\b', 'g')) || []).length !== 1) throw new Error(nm + ' is not defined exactly once');
}
for (const gone of ['async function mexcVerifySweep', 'async function bitgetVerifySweep']) {
  if (h.indexOf(gone) >= 0) throw new Error(gone + ' survived - there must be exactly one sweep');
}
if (h.indexOf('mexcVerifySweep(') >= 0 || h.indexOf('bitgetVerifySweep(') >= 0) throw new Error('a call site still points at a deleted sweep');
// the cron must never reject: rejecting is opt-in and the cron does not pass it
const cronBlock = h.slice(h.indexOf('async function autoApproveSweep'), h.indexOf('async function autoApproveSweep') + 2600);
if (/reject/.test(cronBlock)) throw new Error('the cron sweep must never reject');
if (cronBlock.indexOf('max: AUTO_APPROVE_MAX') < 0) throw new Error('the cron sweep lost its ceiling');
if (cronBlock.indexOf("cfg.autoApprove === false") < 0) throw new Error('the kill switch is gone');
if (h.indexOf('async function checkMexcKey') < 0 || h.indexOf('async function checkBitgetKey') < 0) throw new Error('a key watchdog was swallowed');
if (h.indexOf("'/api/admin/mexcverify'") < 0 || h.indexOf("'/api/admin/bitgetverify'") < 0) throw new Error('an admin desk was swallowed');

console.log('add-auto-approve: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
const tmp = F + '.tmp';
fs.writeFileSync(tmp, h);
fs.renameSync(tmp, F);
console.log('  written: src/worker.js (' + (h.length - before.length >= 0 ? '+' : '') + (h.length - before.length) + ' bytes)');
console.log('  NEXT: node build/lint.js && npm run deploy');

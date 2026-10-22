#!/usr/bin/env node
/* THE REVIEW DESK KNEW ONLY MOON AND FOMO (2026-10-22, owner: "moras da mi omogucis na mp-ops da mogu da odobrim
   prijave za mexc i bingx").

   MEXC and BingX went live on 2026-10-21 and have been payable ever since, with NO way to approve a claim: 19 and
   23 real people were waiting behind a desk that could only see the two venues somebody had hand-copied a fold for.
   That is the whole reason this is a table now - the worker has had `SIGN_VENUES` as its one definition since the
   day the venues shipped, and the desk did not follow because its two folds were copies rather than a loop.

   Fomo stays on the desk deliberately: it is retired for NEW claims (submit answers 410) and seven real ones filed
   before it closed are still waiting for the owner's decision. A retirement that hides them would strand them.

   Idempotent, --dry. Refuses rather than guessing if the file has moved on.                                       */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'src', 'ops', 'client', 'ops.js.txt');
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
const done = [];

function one(name, a, b, skipIf) {
  if (skipIf && [].concat(skipIf).some(m => h.indexOf(m) >= 0)) return false;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1');
  h = h.split(a).join(b);
  done.push(name);
  return true;
}

// 1. fetch every venue's queue, not just two
const FETCH_A = "J('/api/reward/fomosign/list').catch(function () { return {}; })]).then(function (r) {";
const FETCH_B = "J('/api/reward/fomosign/list').catch(function () { return {}; }), J('/api/reward/mexcsign/list').catch(function () { return {}; }), J('/api/reward/bingxsign/list').catch(function () { return {}; })]).then(function (r) {";
// the guard must match what this patch WRITES, not an earlier draft of it - the recurring patcher trap
one('fetch the MEXC and BingX queues', FETCH_A, FETCH_B, "J('/api/reward/mexcsign/list')");

const DEST_A = "ua = r[10] || {}, fomo = r[11] || {};";
const DEST_B = "ua = r[10] || {}, fomo = r[11] || {}, mexcQ = r[12] || {}, bingxQ = r[13] || {};";
one('bind them', DEST_A, DEST_B, 'mexcQ = r[12]');

// 2. one fold per venue, built from one table
const TABLE = "        /* ONE FOLD PER VENUE, FROM ONE TABLE. A venue added to the worker's SIGN_VENUES needs a line here and\n"
  + "           nothing else - the previous shape was two hand-copied folds, which is exactly why MEXC and BingX were\n"
  + "           payable for a day with no button to pay them. The note under each one says what to check BEFORE\n"
  + "           approving, because that check is the only thing standing between a typed UID and a real dollar. */\n"
  + "        var SIGNV = [\n"
  + "          { v: 'moon', label: 'Moon', d: moon, note: 'check the username in the Moon affiliate dashboard before you approve' },\n"
  + "          { v: 'mexc', label: 'MEXC', d: mexcQ, note: 'check the UID in the MEXC affiliate portal (Referral Strategy) before you approve' },\n"
  + "          { v: 'bingx', label: 'BingX', d: bingxQ, note: 'check the UID in the BingX affiliate dashboard before you approve' },\n"
  + "          { v: 'fomo', label: 'Fomo', d: fomo, note: 'RETIRED - no new claims are taken; these were filed before it closed' }\n"
  + "        ];\n"
  + "        function signFold(s) {\n"
  + "          var d = s.d || {}, pend = d.pending || [], dec = (d.decided || []).slice(0, 8);\n"
  + "          var amt = d[s.v + 'Usd'] != null ? d[s.v + 'Usd'] : 1;\n"
  + "          var rows = pend.map(function (x) { return '<div class=\"row\">' + flag(x.cc) + '<span class=\"who\">' + whoRow(x) + '</span><span class=\"meta\">' + esc(s.label) + ' user <b class=\"mono\" style=\"color:var(--ink)\">' + esc(x.uid) + '</b></span><span class=\"meta\">' + ago(x.ts) + ' ago</span><span style=\"margin-left:auto;display:flex;gap:6px\"><button class=\"btn sm lime\" data-sign=\"' + s.v + '|' + esc(x.id) + '\" data-act=\"approve\">Approve +' + USD(amt) + '</button><button class=\"btn sm red\" data-sign=\"' + s.v + '|' + esc(x.id) + '\" data-act=\"reject\">Reject</button></span></div>'; }).join('')\n"
  + "            + dec.map(function (x) { return '<div class=\"row\" style=\"opacity:.65\">' + flag(x.cc) + '<span class=\"who\">' + whoRow(x) + '</span><span class=\"meta\">' + esc(x.uid) + '</span><span class=\"mono ' + (x.status === 'approved' ? 'up' : 'dn') + '\">' + esc(x.status) + (x.status === 'approved' ? ' +' + USD(x.amount) : '') + '</span><span class=\"meta\" style=\"margin-left:auto\">' + ago(x.ts) + ' ago</span></div>'; }).join('');\n"
  + "          return fold(s.label + ' sign-ups', rows || '<div class=\"empty\">no sign-ups waiting</div>', pend.length + ' waiting \\u00b7 ' + s.note, pend.length > 0);\n"
  + "        }\n"
  + "        var act = +ms.activeClaimers || 0;";
one('the venue table and its renderer', "        var act = +ms.activeClaimers || 0;", TABLE, 'var SIGNV = [');

// 3. render them in place of the two copies
const foldStart = h.indexOf("fold('Moon sign-ups'");
if (foldStart < 0 && h.indexOf('SIGNV.map(signFold)') < 0) throw new Error('the Moon fold is gone and the loop is not there either - refusing to guess');
if (foldStart >= 0) {
  const foldEnd = h.indexOf("+ fold('Content posts'", foldStart);
  if (foldEnd < 0) throw new Error("cannot find the 'Content posts' fold that follows - refusing to guess");
  h = h.slice(0, foldStart) + "SIGNV.map(signFold).join('')\n          " + h.slice(foldEnd);
  done.push('render one fold per venue (replaces the two hand-copied ones)');
}

// 4. one delegated handler for every venue
const H_MOON = /el\.querySelectorAll\('\[data-moon\]'\)[\s\S]*?\n/;
const H_FOMO = /el\.querySelectorAll\('\[data-fomo\]'\)[\s\S]*?\n/;
const NEWH = "el.querySelectorAll('[data-sign]').forEach(function (b) { b.onclick = function () { var p = String(b.getAttribute('data-sign')).split('|'), actn = b.getAttribute('data-act'); var note = actn === 'reject' ? (prompt('Reason shown to the user (optional):') || '') : ''; b.disabled = true; post('/api/reward/' + p[0] + 'sign/review', { id: p.slice(1).join('|'), action: actn, note: note }).then(function (j) { toast(j && j.ok !== false ? actn + 'd' : 'failed'); paint(); }); }; });\n";
if (h.indexOf("[data-sign]") < 0) {
  if (!H_MOON.test(h)) throw new Error('the Moon click handler is not where it was - refusing to guess');
  h = h.replace(H_MOON, NEWH);
  h = h.replace(H_FOMO, '');
  done.push('one delegated review handler for every venue');
}

if (!done.length) { console.log('fix-ops-signup-venues: nothing to do (already applied)'); process.exit(0); }

// guards: the thing must actually be wired, and nothing may be left half-replaced
for (const v of ['moon', 'mexc', 'bingx', 'fomo']) {
  if (h.indexOf("v: '" + v + "'") < 0) throw new Error('venue ' + v + ' missing from SIGNV');
}
if (h.indexOf('data-moon=') >= 0 || h.indexOf('data-fomo=') >= 0) throw new Error('an old per-venue button survived the replacement');
if ((h.match(/SIGNV\.map\(signFold\)/g) || []).length !== 1) throw new Error('the venue loop is not rendered exactly once');
if ((h.match(/\[data-sign\]/g) || []).length !== 1) throw new Error('the delegated handler is not present exactly once');
if (h.indexOf("fold('Content posts'") < 0) throw new Error('the Content posts fold was swallowed');

console.log('fix-ops-signup-venues: ' + done.length + ' edits -> ' + done.join(', '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
const tmp = F + '.tmp';
fs.writeFileSync(tmp, h);
fs.renameSync(tmp, F);
console.log('  written: src/ops/client/ops.js.txt (' + (h.length - before.length >= 0 ? '+' : '') + (h.length - before.length) + ' bytes)');

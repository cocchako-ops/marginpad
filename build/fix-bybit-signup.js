#!/usr/bin/env node
/* BYBIT TAKES BITGET'S PLACE ON THE SIGN-UP BONUS, AND THE BITGET LINK IS THE OWNER'S NEW ONE (2026-10-24, owner:
   "Bitget ukini $1 bonus. Samo umesto njega ubaci Bybit. (automatski approve). Update bitget link na pocetnoj i
   gde jos treba - https://partner.bitget.com/bg/CUWBCM").

   WHY BYBIT CAN BE APPROVED BY ITSELF AND BITGET NEVER COULD: Bitget refuses our account agent access (error
   70102, measured 2026-10-22), so every Bitget claim was a human reading the portal - which is exactly the work
   the owner is now taking back. Bybit is the opposite case: the affiliate API has been feeding the volume board
   since 2026-09-20 and `aff-user-list` names every referred UID, so "is this UID ours" is a question the API
   already answers, and the UID allowlist the withdrawal gate uses (KV bybit:uids) is built from the same read.
   So Bybit joins MEXC and BingX on the automatic desk, and `bitget` closes the same way Fomo did: submit answers
   410 while `mine`, `list` and `review` keep working, because claims already filed are still the owner's to
   decide. A retirement that strands a real claim is a worse bug than the one it fixes.

   A NEW VENUE TOUCHES FOUR CONFIG PLACES AND THIS FILE SAYS WHY (worker.js already carries the warning): the cents
   and the kill switch live in rewardCfg, in the ops POST allow-list, in the snapshot the DO reads, and in the
   public meta the page reads. Miss the DO snapshot and the venue is paid the retired $3 exsign default; miss the
   meta and the card cannot say what it pays.

   Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = path.join(__dirname, '..');
const W = path.join(R, 'src', 'worker.js');
let w = fs.readFileSync(W, 'utf8');
const edits = [];
const one = (hay, needle, what) => { const n = hay.split(needle).length - 1; if (n !== 1) throw new Error(what + ': anchor appears ' + n + ' times, expected 1'); };

/* ---- 1. the venue table: Bitget closes, Bybit opens ---- */
if (w.indexOf("bybit: { label: 'Bybit'") < 0) {
  const OLD = "const SIGN_VENUES = { moon: { label: 'Moon', open: true }, mexc: { label: 'MEXC', open: true }, bingx: { label: 'BingX', open: true }, bitget: { label: 'Bitget', open: true }, fomo: { label: 'Fomo', open: false } };";
  const NEW = "const SIGN_VENUES = { moon: { label: 'Moon', open: true }, mexc: { label: 'MEXC', open: true }, bingx: { label: 'BingX', open: true }, bybit: { label: 'Bybit', open: true }, /* 2026-10-24: Bitget's $1 went to Bybit, which the affiliate API can approve by itself */ bitget: { label: 'Bitget', open: false }, fomo: { label: 'Fomo', open: false } };";
  one(w, OLD, 'SIGN_VENUES'); w = w.split(OLD).join(NEW); edits.push('SIGN_VENUES: bitget closed, bybit open');
  const RE_OLD = "const SIGN_RE = /^\\/(moon|mexc|bingx|bitget|fomo)sign\\/(submit|mine|list|review)$/;";
  one(w, RE_OLD, 'SIGN_RE'); w = w.split(RE_OLD).join("const SIGN_RE = /^\\/(moon|mexc|bingx|bybit|bitget|fomo)sign\\/(submit|mine|list|review)$/;");
  edits.push('SIGN_RE: bybit routes');
}

/* ---- 2. the gate: what it takes to verify a Bybit UID without a human ---- */
/* A skipIf MUST MATCH WHAT THE PATCH WRITES, not an earlier draft of it: this guard read BYBIT_API_KEY while the
   line ships as BYBIT_AFF_KEY, so it never matched and a re-run would have declared the branch twice. */
if (w.indexOf("if (venue === 'bybit') return (env.BYBIT_AFF_KEY") < 0) {
  const OLD = "  if (venue === 'bitget') {";
  const NEW = "  // the affiliate key already feeds the volume board; aff-user-list is the same credential\n"
    + "  if (venue === 'bybit') return (env.BYBIT_AFF_KEY && env.BYBIT_AFF_SECRET) ? '' : 'no_key';  // the AFFILIATE key, the one bybitAffSign uses - BYBIT_API_* is the trading key and answers nothing here\n"
    + "  if (venue === 'bitget') {";
  one(w, OLD, 'signGateWhy bitget branch'); w = w.split(OLD).join(NEW); edits.push('signGateWhy: bybit');
}

/* ---- 3. the lookup itself ---- */
if (w.indexOf('async function bybitAffLookup') < 0) {
  const OLD = "async function affVenueLookup(env, venue, uid) {\n  if (venue === 'mexc') return mexcAffLookup(env, uid);";
  const NEW = "/* IS THIS UID ONE OF OURS? Two sources, cheapest first: the allowlist KV the withdrawal gate already\n"
    + "   maintains from this same API, then the affiliate list itself (one read, memoised per isolate for a\n"
    + "   minute - the sweep walks up to 25 claims and must not ask Bybit 25 times). A read that FAILS returns\n"
    + "   ok:false, so the sweep HOLDS the claim for a human: a wrong auto-approve is money gone, a wrong\n"
    + "   auto-reject insults a real member, and silence costs neither. */\nlet _byAffMemo = null;\n"
    + "async function bybitAffLookup(env, uid) {\n"
    + "  const u = String(uid || '').replace(/[^0-9]/g, '');\n"
    + "  if (!u) return { ok: true, found: false, why: 'bad_uid' };\n"
    + "  try { const set = await bybitUidSet(env); if (set.has(u)) return { ok: true, found: true, via: 'allowlist' }; } catch (e) {}\n"
    + "  try {\n"
    + "    if (!_byAffMemo || Date.now() - _byAffMemo.t > 60000) {\n"
    + "      const l = await bybitAffList(env, 0);\n"
    + "      if (l && l.error) return { ok: false, found: false, why: l.error };\n"
    + "      _byAffMemo = { t: Date.now(), ids: new Set(((l && l.list) || []).map(r => String((r && (r.userId != null ? r.userId : r.uid)) || ''))) };\n"
    + "    }\n"
    + "    return _byAffMemo.ids.has(u) ? { ok: true, found: true, via: 'aff-user-list' } : { ok: true, found: false, why: 'not_referred' };\n"
    + "  } catch (e) { return { ok: false, found: false, why: 'unreachable' }; }\n"
    + "}\n"
    + "async function affVenueLookup(env, venue, uid) {\n  if (venue === 'mexc') return mexcAffLookup(env, uid);\n  if (venue === 'bybit') return bybitAffLookup(env, uid);";
  one(w, OLD, 'affVenueLookup'); w = w.split(OLD).join(NEW); edits.push('bybitAffLookup + the dispatch');
}

/* ---- 4. the four config places (see the header: miss one and the venue is paid the wrong amount) ---- */
const CFG = [
  ["bitgetC: c(num(m.bitgetUsd, 1)), bitgetEnabled: m.bitgetEnabled !== false,",
   "bitgetC: c(num(m.bitgetUsd, 1)), bitgetEnabled: m.bitgetEnabled === true, /* 2026-10-24: the Bitget $1 is RETIRED (owner) - opt-in only, like Fomo, so a stale KV row cannot reopen it */ bybitC: c(num(m.bybitUsd, 1)), bybitEnabled: m.bybitEnabled !== false,",
   'rewardCfg'],
  ["'mexcUsd', 'bingxUsd', 'bitgetUsd',",
   "'mexcUsd', 'bingxUsd', 'bitgetUsd', 'bybitUsd',",
   'the ops config allow-list'],
  ["bitgetC: full.bitgetC, bitgetEnabled: full.bitgetEnabled,",
   "bitgetC: full.bitgetC, bitgetEnabled: full.bitgetEnabled, bybitC: full.bybitC, bybitEnabled: full.bybitEnabled,",
   'the DO snapshot'],
  ["bitgetUsd: (cfg.bitgetC == null ? 1 : cfg.bitgetC / 100), bitgetEnabled: cfg.bitgetEnabled !== false,",
   "bitgetUsd: (cfg.bitgetC == null ? 1 : cfg.bitgetC / 100), bitgetEnabled: cfg.bitgetEnabled === true, bybitUsd: (cfg.bybitC == null ? 1 : cfg.bybitC / 100), bybitEnabled: cfg.bybitEnabled !== false,",
   'the public meta'],
  /* THE FIFTH PLACE, AND IT IS THE ONE THAT WAS MISSED (2026-10-24, caught by signup-venues-e2e, not by reading):
     the numeric fields and the BOOLEAN fields are two separate allow-lists in the ops config POST, so adding
     bybitUsd to one of them left `bybitEnabled` unwritable - the kill switch answered ok and paused nothing, the
     exact same hole mexcEnabled had on 2026-10-21. A new venue needs BOTH lines. */
  ["'mexcEnabled', 'bingxEnabled', 'bitgetEnabled',",
   "'mexcEnabled', 'bingxEnabled', 'bitgetEnabled', 'bybitEnabled',",
   'the ops config BOOLEAN allow-list']
];
for (const [o, n, what] of CFG) {
  if (w.indexOf(n) >= 0) continue;
  one(w, o, what); w = w.split(o).join(n); edits.push(what + ': bybit cents + switch');
}

/* ---- 5. the admin verify route for Bybit, beside the other two ---- */
if (w.indexOf("'/api/admin/bybitverify'") < 0) {
  const OLD = "    if (url.pathname === '/api/admin/bingxverify') {";
  const NEW = "    if (url.pathname === '/api/admin/bybitverify') {\n"
    /* COPY THE GUARD, DO NOT RETYPE IT: the first cut of this route used adminOk()/jr(), which do not exist in
       this scope, and the route answered "Server error" to every call. These three are what its neighbours use. */
    + "      if (!isAdminKey(adminKeyFrom(request, url), env) && !(await adminCookieOk(request, env))) return J({ error: 'unauthorized' }, 401);\n"
    + "      let bodyY = {}; if (request.method === 'POST') { try { bodyY = await request.json(); } catch (e) {} }\n"
    + "      const resY = await signVerifySweep(env, 'bybit', { apply: bodyY.run === true, reject: bodyY.reject === true, limit: bodyY.limit, max: bodyY.max, by: 'owner' });\n"
    + "      let lastY = null; try { lastY = JSON.parse((await env.STATS.get('bybitverify:last')) || 'null'); } catch (e) {}\n"
    + "      return J({ ok: true, dry: !resY.apply, ...resY, last: lastY });\n"
    + "    }\n"
    + "    if (url.pathname === '/api/admin/bingxverify') {";
  one(w, OLD, 'bingxverify route'); w = w.split(OLD).join(NEW); edits.push('/api/admin/bybitverify');
}

if (edits.length) {
  if (!DRY) { fs.writeFileSync(W + '.tmp', w); fs.renameSync(W + '.tmp', W); }
  console.log('worker.js: ' + edits.join(' | '));
} else console.log('worker.js: already applied');

/* ---- 6. THE BITGET LINK, EVERY SHAPE OF IT. A changed partner link is a site-wide edit (CLAUDE.md): the four
        variants below are the same URL with the campaign tail, an escaped tail, and an HTML-escaped tail. ---- */
const NEWL = 'https://partner.bitget.com/bg/CUWBCM';
const OLDS = [
  'https://partner.bitget.com/bg/CUWBCM',
  'https://partner.bitget.com/bg/CUWBCM',
  'https://partner.bitget.com/bg/CUWBCM'
];
const walk = (dir, out) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|js|txt|json|css|md)$/i.test(e.name)) out.push(p);
  }
  return out;
};
let files = 0, hits = 0;
for (const p of walk(path.join(R, 'dist'), []).concat(walk(path.join(R, 'src'), []), walk(path.join(R, 'build'), []), [path.join(R, 'app', 'index.html')])) {
  let s; try { s = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
  if (s.indexOf('clacCode=DSSSQKGK') < 0) continue;
  let before = s;
  for (const o of OLDS) s = s.split(o).join(NEWL);
  /* A PAIR PAGE CANNOT CARRY A PARTNER LINK'S CODE, so Bitget joins OKX: the deep link is dropped and every
     Bitget href is the join page. The 2026-09-13 audit rule is that an exchange href without the venue's code
     earns nothing - a pair URL with the retired clacCode on it is worse than no deep link at all. */
  s = s.split("deep: null").join('deep: null');
  s = s.split("u:function(s){return 'https://partner.bitget.com/bg/CUWBCM';}").join("u:function(s){return 'https://partner.bitget.com/bg/CUWBCM';}");
  // the deep-link form (a pair page carrying the code) has no equivalent on a partner link - send it to the partner page
  s = s.split('https://partner.bitget.com/bg/CUWBCM').join(NEWL);
  if (s !== before) { hits += (before.length - s.length) > 0 ? 1 : 1; files++; if (!DRY) { fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p); } }
}
console.log('bitget link: ' + files + ' file(s) ' + (DRY ? 'would be' : '') + ' rewritten to ' + NEWL);
const left = walk(path.join(R, 'dist'), []).concat(walk(path.join(R, 'src'), []), [path.join(R, 'app', 'index.html')])
  .filter(p => { try { return fs.readFileSync(p, 'utf8').indexOf('clacCode=DSSSQKGK') >= 0; } catch (e) { return false; } });
if (!DRY && left.length) throw new Error('the old Bitget code survives in ' + left.length + ' file(s): ' + left.slice(0, 3).join(', '));
console.log('fix-bybit-signup: ' + (DRY ? 'dry run' : 'done') + '\n  NEXT: node build/bump-home-assets.js && npm run deploy');

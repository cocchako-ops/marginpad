#!/usr/bin/env node
/* BITGET JOINS THE SIGN-UP BONUS AND THE PAYOUT METHODS (2026-10-22, owner: "Ajde uvedi ovaj bitget api isto kao
   i ovo sve do sad (mexc bybit moon) za sign in prijavu od 1$ kao i wd metodu ... hocu poruke na telegram kad se
   neko registruje").

   WHAT BITGET ACTUALLY PUBLISHES, read off their own docs rather than assumed (Affiliate - Customer Info, the
   `/api/v2/broker/*` family). It is RICHER than MEXC's:

     POST /api/v2/broker/customer-list          -> is this UID one of my referrals (their docs name this exact use)
     POST /api/v2/broker/customer-trade-volume  -> spot + futures volume per UID  (a volume board, later)
     POST /api/v2/broker/customer-deposit       -> deposits per UID
     GET  /api/v2/broker/customer-commissions   -> what each referral actually paid us
     GET  /api/v2/broker/customer-kyc-result    -> KYC passed / not

   Only the FIRST is used here. The others are what make a Bybit-style volume board possible the day there is
   anybody to put on it - and today there is not, so nothing is built on top of them (the MEXC lesson: do not
   publish an empty table beside a real one).

   THREE CREDENTIALS, NOT TWO. Bitget signs with key + secret + PASSPHRASE, and the signature is BASE64 of the
   HMAC, not hex - that is the single difference from MEXC and it fails as an opaque signature error rather than
   as anything readable, so it is called out here and asserted by the E2E.

   FOUR RULES CARRIED OVER VERBATIM FROM THE MEXC ROUND, because they are what make this safe:
     1. The sweep ONLY EVER APPROVES. Any refusal, outage, rate limit or missing key leaves the claim pending for
        a human. A wrong auto-reject insults a real member; a wrong auto-approve is money gone.
     2. The payout gate FAILS OPEN. Money a member has already earned must never be trapped by our own API being
        down - a false block costs trust, a false pass costs the owner one manual look.
     3. Everything that moves money is a DRY RUN until told otherwise.
     4. The key is watched from day one, not after the first silent outage (Coinglass, Bybit, MEXC - three times).

   AND THE TELEGRAM LINE THE OWNER ASKED FOR, which needed a correction first: he believed Bybit pings him when
   somebody registers. It does not - a Bybit UID registration writes to the `bylog` ring and nothing else. What
   DOES ping for Bybit is `bybitAffSync` noticing a NEW UID in the affiliate API. So Bitget gets both halves, and
   they are different events: `bitgetRefSync` pings when a new referral appears in Bitget's own book (someone
   opened an account through our link), and a sign-up CLAIM pings because that one is work waiting for him - a
   dollar he has to approve. The claim line is venue-generic, so Moon, MEXC and BingX get it too.

   Idempotent, --dry. Refuses rather than guessing.                                                             */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'src', 'worker.js');
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
const done = [];

/* `skipIf` must match something only THIS edit writes - the recurring patcher trap recorded twice in the rekt
   round: a guard that matches text the file already carries elsewhere skips the edit for ever. */
function one(name, a, b, skipIf) {
  if (skipIf && [].concat(skipIf).some(m => h.indexOf(m) >= 0)) return false;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1 (already applied?)');
  h = h.split(a).join(b);   // split/join, never String.replace - a `$` in the replacement is a capture reference
  done.push(name);
  return true;
}
function all(name, a, b, min) {
  const n = h.split(a).length - 1;
  if (n < (min || 1)) throw new Error(name + ': anchor appears ' + n + ' times, expected at least ' + (min || 1));
  h = h.split(a).join(b);
  done.push(name + ' (x' + n + ')');
  return true;
}

/* ---- 1. the venue joins the one table ------------------------------------------------------------------- */
one('SIGN_VENUES + SIGN_RE carry Bitget',
  "const SIGN_VENUES = { moon: { label: 'Moon', open: true }, mexc: { label: 'MEXC', open: true }, bingx: { label: 'BingX', open: true }, fomo: { label: 'Fomo', open: false } };\n"
  + "const SIGN_RE = /^\\/(moon|mexc|bingx|fomo)sign\\/(submit|mine|list|review)$/;",
  "const SIGN_VENUES = { moon: { label: 'Moon', open: true }, mexc: { label: 'MEXC', open: true }, bingx: { label: 'BingX', open: true }, bitget: { label: 'Bitget', open: true }, fomo: { label: 'Fomo', open: false } };\n"
  + "const SIGN_RE = /^\\/(moon|mexc|bingx|bitget|fomo)sign\\/(submit|mine|list|review)$/;\n"
  + "/* EVERY VENUE BUT MOON SHARES ONE SET OF ALIAS ROUTES, and five separate regexes used to spell that list out\n"
  + "   by hand - which is how MEXC and BingX reached the review desk with no username and no fold. One reading now:\n"
  + "   moon keeps its older dedicated branches, everything else answers here. A new venue is a line in SIGN_VENUES. */\n"
  + "function signAliasOp(p, op) { const m = SIGN_RE.exec(String(p || '')); return (m && m[1] !== 'moon' && m[2] === op) ? m[1] : ''; }\n"
  + "function signSubmitPath(p) { const m = SIGN_RE.exec(String(p || '')); return !!(m && m[2] === 'submit'); }",
  "bitget: { label: 'Bitget'");

/* the five hand-written venue lists become the one reading */
all('the submit-restriction lists read the venue table',
  "/^\\/(moon|mexc|bingx|fomo)sign\\/submit$/.test(path)", 'signSubmitPath(path)', 2);
all('the alias submit/review/list branches read the venue table',
  "/^\\/(mexc|bingx|fomo)sign\\/review$/.test(path)", "!!signAliasOp(path, 'review')", 1);
one('the alias submit beacon reads the venue table',
  "if (/^\\/(mexc|bingx|fomo)sign\\/submit$/.test(path) && _rd.ok) await evPush(env, request, 'exsign', path.slice(1).split('sign')[0], '/rewards/');",
  "if (signAliasOp(path, 'submit') && _rd.ok) await evPush(env, request, 'exsign', signAliasOp(path, 'submit'), '/rewards/');",
  "if (signAliasOp(path, 'submit') && _rd.ok)");
one('the per-venue list/mine filter reads the venue table',
  "if (r.status === 200 && /^\\/(mexc|bingx|fomo)sign\\/(list|mine)$/.test(path)) {\n    const _v = path.slice(1).split('sign')[0], _op = path.split('/').pop();",
  "if (r.status === 200 && (signAliasOp(path, 'list') || signAliasOp(path, 'mine'))) {\n    const _v = path.slice(1).split('sign')[0], _op = path.split('/').pop();",
  "if (r.status === 200 && (signAliasOp(path, 'list') || signAliasOp(path, 'mine')))");

/* ---- 2. the affiliate layer ------------------------------------------------------------------------------ */
const ANCHOR = 'function moonContestEnd(startTs) { return lbPeriodStart(startTs) + 2 * LB_PERIOD; }';
const BLOCK = [
  "/* BITGET AFFILIATE (2026-10-22) - see build/add-bitget-affiliate.js for why each guard is where it is.",
  "   Bitget signs with THREE credentials and a BASE64 signature; MEXC signs with two and hex. Getting that wrong",
  "   fails as an opaque signature error, so both facts are stated here and asserted by bitget-sign-e2e. */",
  "const BITGET_API = 'https://api.bitget.com';",
  "const BITGET_INVITE = 'DSSSQKGK'; // our referral code - the same one FEE_VENUES and window.mpEx carry",
  "async function bitgetSigned(env, method, pathname, payload) {",
  "  const key = env.BITGET_API_KEY, secret = env.BITGET_API_SECRET, pass = env.BITGET_API_PASSPHRASE;",
  "  if (!key || !secret || !pass) return { ok: false, why: 'no_key' };",
  "  const m = String(method || 'GET').toUpperCase(), ts = String(Date.now());",
  "  const qs = (m === 'GET' && payload && Object.keys(payload).length) ? '?' + new URLSearchParams(payload).toString() : '';",
  "  const body = m === 'GET' ? '' : JSON.stringify(payload || {});",
  "  /* THE PREHASH IS timestamp + METHOD + requestPath + queryString + body, and the signature is BASE64 of the",
  "     HMAC - not hex. Bitget answers a wrong signature with a generic code, so this is the one place to get right. */",
  "  let sig = '';",
  "  try {",
  "    const ck = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);",
  "    const mac = await crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(ts + m + pathname + qs + body));",
  "    sig = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(mac))));",
  "  } catch (e) { return { ok: false, why: 'sign_failed' }; }",
  "  try {",
  "    const r = await fetch(BITGET_API + pathname + qs, {",
  "      method: m,",
  "      headers: { 'ACCESS-KEY': key, 'ACCESS-SIGN': sig, 'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': pass, 'Content-Type': 'application/json', locale: 'en-US' },",
  "      body: m === 'GET' ? undefined : body,",
  "      signal: AbortSignal.timeout(8000)",
  "    });",
  "    const txt = await r.text();",
  "    let j = null; try { j = JSON.parse(txt); } catch (e) { return { ok: false, why: 'bad_json', status: r.status, body: txt.slice(0, 300) }; }",
  "    /* Bitget's success code is the string '00000'. Anything else is a real answer about a real problem, so the",
  "       code and the message are CARRIED - the 2026-10-07 ai_error lesson and the 2026-10-19 Bybit one, both of",
  "       which were a thrown-away body costing a day. */",
  "    if (!r.ok || String(j.code) !== '00000') return { ok: false, why: r.status === 429 ? 'rate_limited' : 'refused', code: String(j.code || ''), msg: String(j.msg || ''), status: r.status, body: txt.slice(0, 300) };",
  "    return { ok: true, data: j.data };",
  "  } catch (e) { return { ok: false, why: 'fetch_failed', body: String((e && e.message) || e).slice(0, 160) }; }",
  "}",
  "/* Is this UID a referral of ours? Bitget's own documentation names this exact call for this exact question:",
  "   POST /api/v2/broker/customer-list with {uid} answers with that customer or with nothing. An EMPTY array is a",
  "   definitive no - it is our own book being read, in real time, with no 90-day window on the customer list.",
  "   Deliberately NOT filtered by referralCode: the account may carry several codes and we earn on all of them,",
  "   so a code filter could only ever refuse somebody who really is ours. */",
  "async function bitgetAffLookup(env, uid) {",
  "  const u = String(uid || '').trim();",
  "  if (!/^[0-9]{4,20}$/.test(u)) return { ok: true, found: false, why: 'not_a_uid' };",
  "  const r = await bitgetSigned(env, 'POST', '/api/v2/broker/customer-list', { uid: u, pageSize: '10' });",
  "  if (!r.ok) return { ok: false, found: false, why: r.why, code: r.code, msg: r.msg, status: r.status, body: r.body };",
  "  const rows = Array.isArray(r.data) ? r.data : ((r.data && r.data.list) || []);",
  "  const row = rows.filter(x => String(x.uid) === u)[0] || null;",
  "  if (!row) return { ok: true, found: false, why: 'not_our_referral' };",
  "  return { ok: true, found: true, uid: u, registerTime: row.registerTime || null };",
  "}",
  "/* OUR WHOLE BITGET BOOK, paged. Used by the new-referral watch and by the admin roster - the second, independent",
  "   reading that says whether a UID is simply absent, which is what the MEXC round needed before it could trust a",
  "   negative. */",
  "async function bitgetAffAll(env, cap) {",
  "  const out = [], lim = Math.max(1, Math.min(20, cap || 10));",
  "  for (let pg = 1; pg <= lim; pg++) {",
  "    const r = await bitgetSigned(env, 'POST', '/api/v2/broker/customer-list', { pageNo: String(pg), pageSize: '1000' });",
  "    if (!r.ok) return { error: r.why, code: r.code, msg: r.msg, body: r.body, list: out };",
  "    const rows = Array.isArray(r.data) ? r.data : ((r.data && r.data.list) || []);",
  "    rows.forEach(x => out.push({ uid: String(x.uid), reg: x.registerTime || null }));",
  "    if (rows.length < 1000) break;",
  "  }",
  "  return { list: out };",
  "}",
  "/* THE TELEGRAM LINE THE OWNER ASKED FOR (\"poruke na telegram kad se neko registruje bas kao i za Bybit\").",
  "   For Bybit that line is bybitAffSync noticing a new UID in the affiliate API - NOT the member registering a UID",
  "   with us, which writes to the bylog ring and pings nothing. This is the same event for Bitget: somebody opened",
  "   an account through our link and Bitget's own book now holds them. The set is kept in KV so 'new' means new,",
  "   and the FIRST run is silent - it would otherwise announce the entire back catalogue as if it had just happened. */",
  "async function bitgetRefSync(env) {",
  "  if (!env.STATS || !env.BITGET_API_KEY) return { skipped: 'no_key' };",
  "  const r = await bitgetAffAll(env, 6);",
  "  if (r.error) return { error: r.error, detail: (r.msg || r.body || '').slice(0, 90) };",
  "  let prev = null; try { prev = JSON.parse((await env.STATS.get('bitget:refs')) || 'null'); } catch (e) {}",
  "  const have = new Set((prev && prev.uids) || []);",
  "  const fresh = r.list.filter(x => !have.has(x.uid));",
  "  const all = r.list.map(x => x.uid);",
  "  try { await env.STATS.put('bitget:refs', JSON.stringify({ ts: Date.now(), uids: all }), { expirationTtl: 400 * 86400 }); } catch (e) {}",
  "  if (!prev) return { seeded: all.length };   // first run: record the book, announce nothing",
  "  if (!fresh.length) return { ok: true, n: all.length, fresh: 0 };",
  "  const when = x => { const t = +x.reg || 0; return t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : ''; };",
  "  try {",
  "    await tgOwner(env, 'bitget referral', 'Bitget: ' + fresh.length + ' new account' + (fresh.length === 1 ? '' : 's') + ' through our link',",
  "      [fresh.slice(0, 6).map(x => 'UID ' + x.uid + (when(x) ? ' - registered ' + when(x) : '')).join(String.fromCharCode(10)),",
  "        fresh.length > 6 ? 'and ' + (fresh.length - 6) + ' more' : '',",
  "        all.length + ' referrals in the Bitget book now. They can claim the $1 sign-up bonus on /rewards/.'],",
  "      'https://marginpad.io/api/stats#money/faucet');",
  "  } catch (e) {}",
  "  return { ok: true, n: all.length, fresh: fresh.length };",
  "}",
  "/* The sweep. DRY BY DEFAULT - `apply` is what pays, and it pays through the ordinary review route so the member",
  "   gets the same XP, the same ledger row and the same notification a hand-approval gives them. */",
  "async function bitgetVerifySweep(env, opts) {",
  "  const apply = !!(opts && opts.apply), cap = Math.min(40, Math.max(1, (opts && +opts.limit) || 25));",
  "  const out = { checked: 0, approved: 0, held: 0, apply, rows: [] };",
  "  if (!env.BITGET_API_KEY || !env.BITGET_API_SECRET || !env.BITGET_API_PASSPHRASE) { out.error = 'no_key'; return out; }",
  "  let pending = [];",
  "  try {",
  "    const lr = await handleReward(new URL('https://marginpad.io/api/reward/bitgetsign/list'), new Request('https://marginpad.io/api/reward/bitgetsign/list', { headers: { 'x-admin-key': adminKeyOf(env) } }), env);",
  "    const lj = await lr.json();",
  "    pending = (lj.pending || []).filter(x => x.exchange === 'bitget' && !String(x.uid || '').startsWith('e2e'));",
  "  } catch (e) { out.error = 'list_failed'; return out; }",
  "  for (const row of pending.slice(0, cap)) {",
  "    out.checked++;",
  "    const v = await bitgetAffLookup(env, row.uid);",
  "    const rec = { id: row.id, uid: row.uid, acct: String(row.address || '').slice(0, 24), verdict: v.found ? 'ours' : (v.ok ? v.why : ('error:' + v.why)) };",
  "    const _no = v.ok && !v.found && (v.why === 'not_our_referral' || v.why === 'not_a_uid');",
  "    if (_no && apply && opts && opts.reject) {",
  "      const rnote = v.why === 'not_a_uid'",
  "        ? 'That does not look like a Bitget UID. Your UID is the number in your Bitget account menu. You can submit once more.'",
  "        : 'We could not find this UID among the accounts that opened through our Bitget link, so the sign-up bonus does not apply to it. If you created your Bitget account another way, the bonus cannot be paid for it. If you think this is a mistake, write to support and we will look again.';",
  "      try {",
  "        const rr2 = await handleReward(new URL('https://marginpad.io/api/reward/bitgetsign/review'),",
  "          new Request('https://marginpad.io/api/reward/bitgetsign/review', { method: 'POST', headers: { 'x-admin-key': adminKeyOf(env), 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id, action: 'reject', note: rnote }) }), env);",
  "        const rj2 = await rr2.json();",
  "        rec.rejected = !!(rj2 && rj2.status === 'rejected'); if (!rec.rejected) rec.payError = (rj2 && rj2.error) || 'failed';",
  "      } catch (e) { rec.rejected = false; rec.payError = 'threw'; }",
  "      if (rec.rejected) out.rejected = (out.rejected || 0) + 1; else out.held++;",
  "      out.rows.push(rec);",
  "      continue;",
  "    }",
  "    if (v.found && apply) {",
  "      const note = 'auto-verified against the Bitget affiliate API: uid ' + v.uid + ' is in our customer list'",
  "        + (v.registerTime ? ', registered ' + new Date(+v.registerTime).toISOString().slice(0, 10) : '');",
  "      try {",
  "        const rr = await handleReward(new URL('https://marginpad.io/api/reward/bitgetsign/review'),",
  "          new Request('https://marginpad.io/api/reward/bitgetsign/review', { method: 'POST', headers: { 'x-admin-key': adminKeyOf(env), 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id, action: 'approve', note }) }), env);",
  "        const rj = await rr.json();",
  "        rec.paid = !!(rj && rj.status === 'approved'); if (!rec.paid) rec.payError = (rj && rj.error) || 'failed';",
  "      } catch (e) { rec.paid = false; rec.payError = 'threw'; }",
  "      if (rec.paid) out.approved++; else out.held++;",
  "    } else out.held++;",
  "    out.rows.push(rec);",
  "  }",
  "  try { await env.STATS.put('bitgetverify:last', JSON.stringify({ ts: Date.now(), checked: out.checked, approved: out.approved, held: out.held, apply }), { expirationTtl: 2592000 }); } catch (e) {}",
  "  return out;",
  "}",
  "/* A CREDENTIAL THAT DIES IN SILENCE HAS COST THIS CODEBASE THREE OUTAGES (Coinglass, Bybit, MEXC), so the watch",
  "   ships with the feature rather than after the first one. A rate limit or a network blip is NOT a dead key. */",
  "async function checkBitgetKey(env) {",
  "  if (!env.BITGET_API_KEY || !env.BITGET_API_SECRET || !env.BITGET_API_PASSPHRASE) return { skipped: 'no_key' };",
  "  const r = await bitgetSigned(env, 'POST', '/api/v2/broker/customer-list', { pageSize: '1' });",
  "  if (r.ok) { try { await env.STATS.delete('bitgetkey:lasterr'); } catch (e) {} return { ok: true }; }",
  "  try { await env.STATS.put('bitgetkey:lasterr', JSON.stringify({ ts: Date.now(), why: r.why, code: r.code || '', msg: r.msg || '', status: r.status || 0, body: String(r.body || '').slice(0, 200) }), { expirationTtl: 604800 }); } catch (e) {}",
  "  if (r.why === 'rate_limited' || r.why === 'fetch_failed') return { ok: false, soft: r.why };",
  "  let muted = false; try { muted = !!(await env.STATS.get('alrt:bitgetkey')); } catch (e) {}",
  "  if (!muted) {",
  "    try { await env.STATS.put('alrt:bitgetkey', '1', { expirationTtl: 21600 }); } catch (e) {}",
  "    try { await tgAdmin(env, '<b>Bitget API kljuc ne radi</b> (' + r.why + (r.code ? ' code ' + r.code : '') + (r.status ? ' HTTP ' + r.status : '') + '). Auto-odobravanje Bitget prijava stoji i kapija za isplatu propusta sve - sve ide rucno dok se ne zameni. ' + String(r.msg || r.body || '').replace(/[<>]/g, '').slice(0, 160), { kind: 'bitgetkey', sev: 'warn' }); } catch (e) {}",
  "  }",
  "  return { ok: false, why: r.why, code: r.code };",
  "}",
  "/* ONE READING OF \"did this UID open under our link\", for every venue whose answer comes from an affiliate API.",
  "   The payout gate and the public pre-check both go through it, so the two can never disagree about a member. */",
  "async function affVenueLookup(env, venue, uid) {",
  "  if (venue === 'mexc') return mexcAffLookup(env, uid);",
  "  if (venue === 'bitget') return bitgetAffLookup(env, uid);",
  "  return { ok: false, found: false, why: 'no_gate' };",
  "}",
  ANCHOR
].join('\n');
one('the Bitget affiliate layer', ANCHOR, BLOCK, 'async function bitgetAffLookup');

/* ---- 3. the admin desk ------------------------------------------------------------------------------------ */
const ROUTE_A = "    if (url.pathname === '/go') return handleExchangeGo(url); // TG signal exchange buttons → deep-link into the native app";
const ROUTE = [
  "    /* Bitget sign-up verification desk - the MEXC desk's twin, same house rules: a DRY RUN unless {run:true},",
  "       ?uid= checks one UID and touches no claim, ?list=1 is the whole roster (the independent second reading",
  "       that lets a negative be trusted). */",
  "    if (url.pathname === '/api/admin/bitgetverify') {",
  "      const akB = adminKeyFrom(request, url);",
  "      if (!isAdminKey(env, akB) && !(await adminCookieOk(request, env))) return J({ error: 'forbidden' }, 403);",
  "      const oneB = url.searchParams.get('uid');",
  "      if (oneB) return J({ uid: oneB, result: await bitgetAffLookup(env, oneB) });",
  "      if (url.searchParams.get('list') === '1') { const rB = await bitgetAffAll(env, 6); return J({ roster: rB.list, n: rB.list.length, error: rB.error || null, msg: rB.msg || '', body: rB.body || '' }); }",
  "      if (url.searchParams.get('sync') === '1') return J({ sync: await bitgetRefSync(env) });",
  "      let bodyB = {}; if (request.method === 'POST') { try { bodyB = await request.json(); } catch (e) {} }",
  "      const resB = await bitgetVerifySweep(env, { apply: bodyB.run === true, reject: bodyB.reject === true, limit: bodyB.limit });",
  "      let lastB = null; try { lastB = JSON.parse((await env.STATS.get('bitgetverify:last')) || 'null'); } catch (e) {}",
  "      let keyErrB = null; try { keyErrB = JSON.parse((await env.STATS.get('bitgetkey:lasterr')) || 'null'); } catch (e) {}",
  "      return J({ ...resB, lastRun: lastB, keyLastError: keyErrB, note: resB.apply ? 'applied' : 'DRY RUN - nothing was paid; POST {\"run\":true} to approve the rows marked ours' });",
  "    }",
  ROUTE_A
].join('\n');
one('the /api/admin/bitgetverify desk', ROUTE_A, ROUTE, "'/api/admin/bitgetverify'");

/* ---- 4. the public pre-check, venue-driven ---------------------------------------------------------------- */
const CHECK_A = "  if (path === '/mexccheck') { // public MEXC-UID pre-check for the withdraw form - yes/no only, same contract as /uidcheck\n"
  + "    const u9 = String(url.searchParams.get('uid') || '').trim();\n"
  + "    if (!/^[0-9]{4,20}$/.test(u9)) return jr({ ok: false });\n"
  + "    const v9 = await mexcAffLookup(env, u9);\n"
  + "    // gate:false when we could not ASK (no key, 429, network) - a member must never be blocked by our own outage\n"
  + "    if (!v9.ok) return jr({ ok: true, gate: false, listed: true, why: v9.why });\n"
  + "    return jr({ ok: true, gate: true, listed: !!v9.found, why: v9.found ? 'ours' : v9.why });\n"
  + "  }";
const CHECK_B = "  /* Public UID pre-check for the withdraw form - yes/no only, same contract as /uidcheck, and ONE branch for\n"
  + "     every venue whose answer comes from an affiliate API (/mexccheck kept as the name the live page calls). */\n"
  + "  if (path === '/mexccheck' || path === '/bitgetcheck') {\n"
  + "    const vN = path === '/bitgetcheck' ? 'bitget' : 'mexc';\n"
  + "    const u9 = String(url.searchParams.get('uid') || '').trim();\n"
  + "    if (!/^[0-9]{4,20}$/.test(u9)) return jr({ ok: false });\n"
  + "    const v9 = await affVenueLookup(env, vN, u9);\n"
  + "    // gate:false when we could not ASK (no key, 429, network) - a member must never be blocked by our own outage\n"
  + "    if (!v9.ok) return jr({ ok: true, gate: false, listed: true, why: v9.why });\n"
  + "    return jr({ ok: true, gate: true, listed: !!v9.found, why: v9.found ? 'ours' : v9.why });\n"
  + "  }";
one('the public pre-check covers Bitget', CHECK_A, CHECK_B, "path === '/bitgetcheck'");

/* ---- 5. the payout gate, venue-driven --------------------------------------------------------------------- */
const GATE_A = "  if (path === '/withdraw') { // MEXC gate: we pay a MEXC UID only if it opened under our link. Answered by MEXC's own\n"
  + "    // affiliate API rather than a hand-kept list - and it FAILS OPEN: an unreachable API or an expired key lets the\n"
  + "    // request through to the manual queue, because earned money must not be trapped by our outage.\n"
  + "    const mx = String((b && b.address) || '').trim();\n"
  + "    if (/^mexc:[0-9]{4,20}$/i.test(mx)) {\n"
  + "      const uidM = mx.split(':')[1];\n"
  + "      try {\n"
  + "        const vm = await mexcAffLookup(env, uidM);\n"
  + "        if (vm.ok && !vm.found) {\n"
  + "          try { await evPush(env, request, 'wdreject', 'MEXC UID ' + uidM + ' is not one of our referrals (blocked at request)', '/rewards/'); } catch (e) {}\n"
  + "          return jr({ error: 'uid_not_ours', message: 'This MEXC UID is not among the accounts that opened through MarginPad\\u2019s MEXC link, so we can\\u2019t send a payout to it. Open a MEXC account through our link and use that UID, or switch the payout method to Moon (just your Moon username). If you DID sign up through our link, contact support and we\\u2019ll check - your balance is untouched.' }, 403);\n"
  + "        }\n"
  + "      } catch (e) {} // never block on a throw\n"
  + "    }";
const GATE_B = "  if (path === '/withdraw') { /* THE PAYOUT GATE, one branch for every affiliate-answered venue: we pay a UID only\n"
  + "    if it opened under our link, answered by the venue's own API rather than a hand-kept list - and it FAILS OPEN.\n"
  + "    An unreachable API or an expired key lets the request through to the manual queue, because money a member has\n"
  + "    already earned must never be trapped by OUR outage: a false block costs trust and a support ticket, a false\n"
  + "    pass costs the owner one manual look at a UID he can see on the desk. */\n"
  + "    const mx = String((b && b.address) || '').trim();\n"
  + "    const gm = /^(mexc|bitget):([0-9]{4,20})$/i.exec(mx);\n"
  + "    if (gm) {\n"
  + "      const vG = gm[1].toLowerCase(), uidM = gm[2], labG = SIGN_VENUES[vG] ? SIGN_VENUES[vG].label : vG.toUpperCase();\n"
  + "      try {\n"
  + "        const vm = await affVenueLookup(env, vG, uidM);\n"
  + "        if (vm.ok && !vm.found) {\n"
  + "          try { await evPush(env, request, 'wdreject', labG + ' UID ' + uidM + ' is not one of our referrals (blocked at request)', '/rewards/'); } catch (e) {}\n"
  + "          return jr({ error: 'uid_not_ours', message: 'This ' + labG + ' UID is not among the accounts that opened through MarginPad\\u2019s ' + labG + ' link, so we can\\u2019t send a payout to it. Open a ' + labG + ' account through our link and use that UID, or switch the payout method to Moon (just your Moon username). If you DID sign up through our link, contact support and we\\u2019ll check - your balance is untouched.' }, 403);\n"
  + "        }\n"
  + "      } catch (e) {} // never block on a throw\n"
  + "    }";
one('the payout gate covers Bitget', GATE_A, GATE_B, "const gm = /^(mexc|bitget):");

/* ---- 6. the reward config knows the venue ----------------------------------------------------------------- */
one('rewardCfg carries bitgetEnabled',
  "'moonEnabled', 'fomoEnabled', 'mexcEnabled', 'bingxEnabled'",
  "'moonEnabled', 'fomoEnabled', 'mexcEnabled', 'bingxEnabled', 'bitgetEnabled'",
  "'bingxEnabled', 'bitgetEnabled'");
one('rewardCfg carries bitgetUsd',
  "'moonUsd', 'fomoUsd', 'mexcUsd', 'bingxUsd'",
  "'moonUsd', 'fomoUsd', 'mexcUsd', 'bingxUsd', 'bitgetUsd'",
  "'bingxUsd', 'bitgetUsd'");
one('the public meta carries the Bitget amount and switch',
  "bingxUsd: (cfg.bingxC == null ? 1 : cfg.bingxC / 100), bingxEnabled: cfg.bingxEnabled !== false,",
  "bingxUsd: (cfg.bingxC == null ? 1 : cfg.bingxC / 100), bingxEnabled: cfg.bingxEnabled !== false, bitgetUsd: (cfg.bitgetC == null ? 1 : cfg.bitgetC / 100), bitgetEnabled: cfg.bitgetEnabled !== false,",
  'bitgetUsd: (cfg.bitgetC');

/* ---- 7. the store accepts a Bitget payout address --------------------------------------------------------- */
one('the store validates a bitget: payout address',
  "    const validMexc = /^mexc:[0-9]{4,20}$/.test(addr); // MEXC payout - 'mexc:<uid>'. A BARE number already means a Bybit UID,",
  "    const validMexc = /^(mexc|bitget):[0-9]{4,20}$/.test(addr); // MEXC and Bitget payouts - '<venue>:<uid>'. A BARE number already means a Bybit UID,",
  "/^(mexc|bitget):[0-9]{4,20}$/.test(addr)");

/* ---- 8. the cron watches the key and the book ------------------------------------------------------------- */
one('the cron runs the Bitget key watch and the referral watch',
  "for (const [fn, label] of [[bybitAffSync, 'bybitaff'], [checkBybitBonus, 'bybitbonus'], [checkBybitKey, 'bybitkey'], [checkMexcKey, 'mexckey']]) {",
  "for (const [fn, label] of [[bybitAffSync, 'bybitaff'], [checkBybitBonus, 'bybitbonus'], [checkBybitKey, 'bybitkey'], [checkMexcKey, 'mexckey'], [checkBitgetKey, 'bitgetkey'], [bitgetRefSync, 'bitgetrefs']]) {",
  "[checkBitgetKey, 'bitgetkey']");

/* ---- 9. the money link must earn (the BingX lesson) ------------------------------------------------------- */
one('/go?ex=bitget keeps our referral code',
  "    mexc: { name: 'MEXC', web: 'https://www.mexc.com/futures/' + sym + '_USDT?inviteCode=47LrK', scheme: 'mexc', host: 'futures/' + sym + '_USDT', pkg: 'com.mexc.mexctrade' },\n  };",
  "    mexc: { name: 'MEXC', web: 'https://www.mexc.com/futures/' + sym + '_USDT?inviteCode=47LrK', scheme: 'mexc', host: 'futures/' + sym + '_USDT', pkg: 'com.mexc.mexctrade' },\n"
  + "    /* A VENUE WE PAY A BONUS FOR MUST HAVE A MONEY LINK THAT EARNS (the 2026-10-21 BingX lesson: /go?ex=bingx\n"
  + "       went to /charts). What earns is the CODE, not the host - clacCode is Bitget's. */\n"
  + "    bitget: { name: 'Bitget', web: 'https://www.bitget.com/futures/usdt/' + sym + 'USDT?clacCode=' + BITGET_INVITE, scheme: 'bitget', host: 'futures/usdt/' + sym + 'USDT', pkg: 'com.bitget.exchange' },\n  };",
  "bitget: { name: 'Bitget', web:");

/* ---- 10. a sign-up claim pings Telegram, for every venue -------------------------------------------------- */
const TG_A = "      if (signAliasOp(path, 'submit') && _rd.ok) await evPush(env, request, 'exsign', signAliasOp(path, 'submit'), '/rewards/');";
const TG_B = TG_A + "\n"
  + "      /* A CLAIM IS WORK WAITING FOR THE OWNER - a dollar he has to approve - and until now it arrived in silence\n"
  + "         (2026-10-22, owner: \"hocu poruke na telegram kad se neko registruje\"). Venue-generic on purpose: Moon,\n"
  + "         MEXC, BingX and Bitget all reach the same desk. A Bybit-style 'a new account appeared in the affiliate\n"
  + "         book' line is a DIFFERENT event and lives in bitgetRefSync. */\n"
  + "      if (SIGN_RE.test(path) && path.slice(-7) === '/submit' && _rd.ok) {\n"
  + "        try {\n"
  + "          const _vT = SIGN_RE.exec(path)[1], _lbT = SIGN_VENUES[_vT] ? SIGN_VENUES[_vT].label : _vT;\n"
  + "          const _unT = getCookie(request, 'mp_un'), _uidT = String(JSON.parse(raw || '{}').uid || '').slice(0, 32);\n"
  + "          await tgOwner(env, 'signup claim', _lbT + ' sign-up claim waiting',\n"
  + "            [(_unT ? '@' + decodeURIComponent(_unT) : 'a member') + ' from ' + ccName((request.cf && request.cf.country) || '') + ' submitted ' + _lbT + ' UID ' + (_uidT || '(none)'),\n"
  + "              'Check it in the ' + _lbT + ' affiliate dashboard before you approve - that check is the only thing between a typed UID and a real dollar.'],\n"
  + "            'https://marginpad.io/api/stats#money/faucet');\n"
  + "        } catch (e) {}\n"
  + "      }";
one('a sign-up claim pings Telegram', TG_A, TG_B, 'sign-up claim waiting');

/* ---- report ----------------------------------------------------------------------------------------------- */
if (!done.length) { console.log('add-bitget-affiliate: nothing to do (already applied)'); process.exit(0); }

// guards: every new function exactly once, and nothing load-bearing swallowed
for (const nm of ['bitgetSigned', 'bitgetAffLookup', 'bitgetAffAll', 'bitgetRefSync', 'bitgetVerifySweep', 'checkBitgetKey', 'affVenueLookup', 'signAliasOp', 'signSubmitPath']) {
  if ((h.match(new RegExp('function ' + nm + '\\b', 'g')) || []).length !== 1) throw new Error(nm + ' is not defined exactly once');
}
if (h.indexOf("'/api/admin/bitgetverify'") < 0) throw new Error('the admin route did not land');
if (h.indexOf("path === '/mexccheck'") < 0) throw new Error('the MEXC pre-check name was lost - the live page calls it');
if (h.indexOf("path === '/uidcheck'") < 0) throw new Error('the Bybit pre-check was swallowed');
if (h.indexOf('async function mexcAffLookup') < 0) throw new Error('the MEXC layer was swallowed');
// the sweep may never reject on its own; rejecting is opt-in and explicit
if (/bitgetVerifySweep[\s\S]{0,4000}action: 'reject'[\s\S]{0,200}opts\.reject/.test(h) === false && h.indexOf("_no && apply && opts && opts.reject") < 0) throw new Error('the reject path is not opt-in');
if (h.indexOf("btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(mac))))") < 0) throw new Error('the base64 signature is gone - Bitget does not take hex');
// the venue list may exist in exactly ONE place - SIGN_RE. (The guard itself was wrong first: the source carries
// an escaped slash, `/^\/(moon|...`, so a pattern written without it matches nothing and the check reads as a
// failure of the edit rather than of the check.)
if ((h.match(/\(moon\|mexc\|bingx\|bitget\|fomo\)sign/g) || []).length !== 1) throw new Error('SIGN_RE is not the one venue list');

console.log('add-bitget-affiliate: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
const tmp = F + '.tmp';
fs.writeFileSync(tmp, h);
fs.renameSync(tmp, F);
console.log('  written: src/worker.js (+' + (h.length - before.length) + ' bytes)');
console.log('  NEXT: node build/lint.js, then set BITGET_API_KEY / BITGET_API_SECRET / BITGET_API_PASSPHRASE as wrangler secrets and npm run deploy');

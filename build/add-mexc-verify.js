#!/usr/bin/env node
/* AUTOMATIC MEXC SIGN-UP VERIFICATION (2026-10-22, owner: "za mexc cak mozemo automatski ... samo nastavi").

   A MEXC sign-up bonus is $1 of real money paid on the strength of a UID the member typed into a box. The only
   thing that has ever stood between a typed number and that dollar is the owner opening the MEXC affiliate portal
   and looking the UID up by hand. MEXC publishes exactly that lookup, so the check can be ours:

     GET /api/v3/rebate/affiliate/referral?uid=<uid>   (SPOT_ACCOUNT_READ, HMAC-signed, weight 1)

   It answers with the referral row for that UID - invite code, registration time, traded volume, commission - or
   with nothing, which is the answer that matters: a UID that is not under our code is not ours to pay.

   FOUR RULES, and every one of them is about not paying the wrong person:

   1. IT ONLY EVER APPROVES. A refusal from MEXC, a missing key, a 429, a network error, a row under somebody
      else's invite code - all of them leave the claim PENDING for the owner. The automation can hand him less
      work; it can never hand him a decision he did not make. A wrong auto-REJECT is visible to the member and
      insulting; a wrong auto-APPROVE is money gone. So: approve on proof, never decide anything else.
   2. THE INVITE CODE MUST BE OURS. "Found in the portal" is not enough - the endpoint is ours, so every row it
      returns is already under our account, but the code is checked anyway because a second strategy link would
      otherwise pay out as if it were the first.
   3. THE FIGURE IS RECORDED, NOT TRUSTED LATER. What MEXC said at the moment of approval goes in the row's note,
      so a month from now the desk can still say why a dollar was paid.
   4. IT IS A DRY RUN BY DEFAULT. `GET /api/admin/mexcverify` tells the owner what it WOULD do and touches
      nothing. Only `{run:true}` (or the cron, once he switches it on) pays.

   THE KEY EXPIRES IN 90 DAYS AND THERE IS NOTHING WE CAN DO ABOUT IT. MEXC: "The validity of an API Key without a
   linked IP address is 90 days". A Cloudflare Worker has no fixed egress IP, so no whitelist is possible. This
   codebase has been bitten by a silently dead credential twice (Coinglass, Bybit), so the watchdog is built in
   from the first day rather than after the first outage.

   Idempotent, --dry. Refuses rather than guessing.                                                              */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'src', 'worker.js');
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
const done = [];

function one(name, anchor, text, skipIf) {
  if (skipIf && [].concat(skipIf).some(m => h.indexOf(m) >= 0)) return false;
  const n = h.split(anchor).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1');
  h = h.split(anchor).join(text);
  done.push(name);
  return true;
}

/* ---- 1. the signed call + the lookup + the sweep ---------------------------------------------------------- */
const ANCHOR = "function signVenueOpen(v) { const x = SIGN_VENUES[String(v || '').toLowerCase()]; return !!(x && x.open); }";

const BLOCK = ANCHOR + "\n"
+ "/* MEXC affiliate verification - see build/add-mexc-verify.js for why each guard is where it is. */\n"
+ "const MEXC_API = 'https://api.mexc.com';\n"
+ "const MEXC_INVITE = 'mexc-47LrK'; // our own referral code, read off the owner's affiliate portal 2026-10-22\n"
+ "async function mexcSigned(env, pathname, params) {\n"
+ "  const key = env.MEXC_API_KEY, secret = env.MEXC_API_SECRET;\n"
+ "  if (!key || !secret) return { ok: false, why: 'no_key' };\n"
+ "  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&') + '&timestamp=' + Date.now() + '&recvWindow=5000';\n"
+ "  let sig = '';\n"
+ "  try {\n"
+ "    const ck = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);\n"
+ "    const mac = await crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(qs));\n"
+ "    sig = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join(''); // MEXC accepts lowercase hex only\n"
+ "  } catch (e) { return { ok: false, why: 'sign_failed' }; }\n"
+ "  try {\n"
+ "    const r = await fetch(MEXC_API + pathname + '?' + qs + '&signature=' + sig, { headers: { 'X-MEXC-APIKEY': key }, signal: AbortSignal.timeout(8000) });\n"
+ "    const txt = await r.text();\n"
+ "    let j = null; try { j = JSON.parse(txt); } catch (e) { return { ok: false, why: 'bad_json', status: r.status, body: txt.slice(0, 300) }; }\n"
+ "    if (!r.ok || j.success === false) return { ok: false, why: r.status === 429 ? 'rate_limited' : 'refused', status: r.status, body: txt.slice(0, 300) };\n"
+ "    return { ok: true, data: j.data || j };\n"
+ "  } catch (e) { return { ok: false, why: 'fetch_failed', body: String(e && e.message || e).slice(0, 160) }; }\n"
+ "}\n"
+ "/* Is this UID a real referral of ours? Returns a VERDICT, never a decision: `found` only when MEXC returned a\n"
+ "   row for exactly this uid under our invite code. Anything else carries `why` and leaves the claim alone. */\n"
+ "async function mexcAffLookup(env, uid) {\n"
+ "  const u = String(uid || '').trim();\n"
+ "  if (!/^[0-9]{4,20}$/.test(u)) return { ok: true, found: false, why: 'not_a_uid' }; // a MEXC uid is digits; nothing to ask about\n"
+ "  const r = await mexcSigned(env, '/api/v3/rebate/affiliate/referral', { uid: u, pageSize: 10 });\n"
+ "  if (!r.ok) return { ok: false, found: false, why: r.why, status: r.status, body: r.body };\n"
+ "  const rows = (r.data && (r.data.resultList || r.data.list)) || [];\n"
+ "  const row = rows.filter(x => String(x.uid) === u)[0] || null;\n"
+ "  if (!row) return { ok: true, found: false, why: 'not_our_referral' };\n"
+ "  const code = String(row.inviteCode || '');\n"
+ "  if (MEXC_INVITE && code && code.toLowerCase() !== MEXC_INVITE.toLowerCase()) return { ok: true, found: false, why: 'other_invite_code', code };\n"
+ "  return { ok: true, found: true, code, uid: u, registerTime: row.registerTime || null,\n"
+ "    tradingAmount: +row.tradingAmount || 0, commission: +row.commission || 0, depositAmount: +row.depositAmount || 0 };\n"
+ "}\n"
+ "/* The sweep. DRY BY DEFAULT - `apply` is what pays. It approves through the ordinary review route so the member\n"
+ "   gets the same XP, the same ledger row and the same notification a hand-approval gives them; there is no second\n"
+ "   way to pay a sign-up bonus, which is what keeps the books honest. */\n"
+ "async function mexcVerifySweep(env, opts) {\n"
+ "  const apply = !!(opts && opts.apply), cap = Math.min(40, Math.max(1, (opts && +opts.limit) || 25));\n"
+ "  const out = { checked: 0, approved: 0, held: 0, apply, rows: [] };\n"
+ "  if (!env.MEXC_API_KEY || !env.MEXC_API_SECRET) { out.error = 'no_key'; return out; }\n"
+ "  let pending = [];\n"
+ "  try {\n"
+ "    const lr = await handleReward(new URL('https://marginpad.io/api/reward/mexcsign/list'), new Request('https://marginpad.io/api/reward/mexcsign/list', { headers: { 'x-admin-key': adminKeyOf(env) } }), env);\n"
+ "    const lj = await lr.json();\n"
+ "    pending = (lj.pending || []).filter(x => x.exchange === 'mexc' && !String(x.uid || '').startsWith('e2e'));\n"
+ "  } catch (e) { out.error = 'list_failed'; return out; }\n"
+ "  for (const row of pending.slice(0, cap)) {\n"
+ "    out.checked++;\n"
+ "    const v = await mexcAffLookup(env, row.uid);\n"
+ "    const rec = { id: row.id, uid: row.uid, acct: String(row.address || '').slice(0, 24), verdict: v.found ? 'ours' : (v.ok ? v.why : ('error:' + v.why)) };\n"
+ "    if (v.found) { rec.traded = v.tradingAmount; rec.commission = v.commission; }\n"
+ "    if (v.found && apply) {\n"
+ "      const note = 'auto-verified against the MEXC affiliate API: uid ' + v.uid + ' under ' + v.code\n"
+ "        + ', traded $' + v.tradingAmount.toFixed(2) + ', commission $' + v.commission.toFixed(4);\n"
+ "      try {\n"
+ "        const rr = await handleReward(new URL('https://marginpad.io/api/reward/mexcsign/review'),\n"
+ "          new Request('https://marginpad.io/api/reward/mexcsign/review', { method: 'POST', headers: { 'x-admin-key': adminKeyOf(env), 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id, action: 'approve', note }) }), env);\n"
+ "        const rj = await rr.json();\n"
+ "        rec.paid = !!(rj && rj.status === 'approved'); if (!rec.paid) rec.payError = (rj && rj.error) || 'failed';\n"
+ "      } catch (e) { rec.paid = false; rec.payError = 'threw'; }\n"
+ "      if (rec.paid) out.approved++; else out.held++;\n"
+ "    } else out.held++;\n"
+ "    out.rows.push(rec);\n"
+ "  }\n"
+ "  try { await env.STATS.put('mexcverify:last', JSON.stringify({ ts: Date.now(), checked: out.checked, approved: out.approved, held: out.held, apply }), { expirationTtl: 2592000 }); } catch (e) {}\n"
+ "  return out;\n"
+ "}\n"
+ "/* THE KEY DIES EVERY 90 DAYS BY MEXC'S OWN RULE and a Worker cannot whitelist an egress IP, so this is not an\n"
+ "   optional nicety: without it the first anybody would know is sign-ups quietly going back to manual. One probe,\n"
+ "   the reason kept in KV, and a page at most once per 6 h. Same shape as the Bybit key watchdog. */\n"
+ "async function checkMexcKey(env) {\n"
+ "  if (!env.MEXC_API_KEY || !env.MEXC_API_SECRET) return { skipped: 'no_key' };\n"
+ "  const r = await mexcSigned(env, '/api/v3/rebate/affiliate/referral', { pageSize: 1 });\n"
+ "  if (r.ok) { try { await env.STATS.delete('mexckey:lasterr'); } catch (e) {} return { ok: true }; }\n"
+ "  try { await env.STATS.put('mexckey:lasterr', JSON.stringify({ ts: Date.now(), why: r.why, status: r.status || 0, body: r.body || '' }), { expirationTtl: 604800 }); } catch (e) {}\n"
+ "  if (r.why === 'rate_limited' || r.why === 'fetch_failed') return { ok: false, soft: r.why }; // not a dead key\n"
+ "  let muted = false; try { muted = !!(await env.STATS.get('alrt:mexckey')); } catch (e) {}\n"
+ "  if (!muted) {\n"
+ "    try { await env.STATS.put('alrt:mexckey', '1', { expirationTtl: 21600 }); } catch (e) {}\n"
+ "    try { await tgAdmin(env, 'MEXC API kljuc ne radi (' + r.why + (r.status ? ' ' + r.status : '') + '). Auto-odobravanje MEXC prijava stoji - sve ide rucno dok se ne zameni. ' + String(r.body || '').slice(0, 160), { kind: 'mexckey', sev: 'warn' }); } catch (e) {}\n"
+ "  }\n"
+ "  return { ok: false, why: r.why };\n"
+ "}";

one('mexcSigned + mexcAffLookup + mexcVerifySweep + checkMexcKey', ANCHOR, BLOCK, 'async function mexcAffLookup');

/* ---- 2. the admin desk route ------------------------------------------------------------------------------ */
const ROUTE_ANCHOR = "    if (url.pathname === '/go') return handleExchangeGo(url);";
const ROUTE = "    /* MEXC sign-up verification desk. A DRY RUN unless {run:true} - the house pattern for anything that moves\n"
+ "       money, and here the dry run is the useful half: it is how the owner sees which pending claims are real\n"
+ "       before a cent leaves the ledger. ?uid= checks one UID without touching any claim. */\n"
+ "    if (url.pathname === '/api/admin/mexcverify') {\n"
+ "      const ak = adminKeyFrom(request, url);\n"
+ "      if (!isAdminKey(env, ak) && !(await adminCookieOk(request, env))) return jr({ error: 'forbidden' }, 403);\n"
+ "      const one9 = url.searchParams.get('uid');\n"
+ "      if (one9) return jr({ uid: one9, result: await mexcAffLookup(env, one9) });\n"
+ "      let body = {}; if (request.method === 'POST') { try { body = await request.json(); } catch (e) {} }\n"
+ "      const res = await mexcVerifySweep(env, { apply: body.run === true, limit: body.limit });\n"
+ "      let last = null; try { last = JSON.parse((await env.STATS.get('mexcverify:last')) || 'null'); } catch (e) {}\n"
+ "      let keyErr = null; try { keyErr = JSON.parse((await env.STATS.get('mexckey:lasterr')) || 'null'); } catch (e) {}\n"
+ "      return jr({ ...res, lastRun: last, keyLastError: keyErr, note: res.apply ? 'applied' : 'DRY RUN - nothing was paid; POST {\"run\":true} to approve the rows marked ours' });\n"
+ "    }\n"
+ ROUTE_ANCHOR;
one('the /api/admin/mexcverify desk', ROUTE_ANCHOR, ROUTE, "'/api/admin/mexcverify'");

if (!done.length) { console.log('add-mexc-verify: nothing to do (already applied)'); process.exit(0); }

// guards
for (const nm of ['mexcSigned', 'mexcAffLookup', 'mexcVerifySweep', 'checkMexcKey']) {
  if ((h.match(new RegExp('function ' + nm + '\\b', 'g')) || []).length !== 1) throw new Error(nm + ' is not defined exactly once');
}
if (h.indexOf("'/api/admin/mexcverify'") < 0) throw new Error('the admin route did not land');
if (h.indexOf("action: 'approve'") < 0) throw new Error('the approve call vanished');
if (/action:\s*'reject'/.test(BLOCK)) throw new Error('the sweep must never reject anything');

console.log('add-mexc-verify: ' + done.length + ' edits -> ' + done.join(', '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
const tmp = F + '.tmp';
fs.writeFileSync(tmp, h);
fs.renameSync(tmp, F);
console.log('  written: src/worker.js (+' + (h.length - before.length) + ' bytes)');
console.log('  NEXT: node build/lint.js && npm run deploy, then set MEXC_API_KEY / MEXC_API_SECRET as wrangler secrets');

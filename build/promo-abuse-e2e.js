/* PROMO ABUSE E2E (2026-10-27, owner: "nalozi koji salju X post link isti na vise naloga ... anti abuse sistem ... mora
   da prepoznaje te paterne"). Pure: promoXParse lifted out of the SHIPPED worker - every spelling of one post reads as
   one post, a profile link is not a post. Live: two throwaway members; A files a post; A again under another spelling
   (twitter.com + /photo/1 + query) = url_taken; B files a DIFFERENT post from A's X account = handle_taken, and the
   attempt is kept as a blocked row B can read; the desk lists the X handle on both with B proposed; the ban is a dry
   run until apply:true, then B is banned on both books and A is untouched.
   node build/promo-abuse-e2e.js            --pure = the parser only (no network)                                     */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.indexOf('--pure') >= 0;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
function lift(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' not in worker'); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return new Function(src.slice(i, k + 1) + '\nreturn ' + name + ';')(); } throw new Error('unbalanced ' + name); }
const parse = lift('promoXParse');
(async () => {
  console.log('-- pure: promoXParse');
  const a = parse('https://x.com/SomeUser/status/2114692274835607886');
  ok(a.ok && a.handle === 'someuser' && a.sid === '2114692274835607886', 'x.com/<handle>/status/<id> parses, handle lowercased');
  const forms = ['https://twitter.com/SomeUser/status/2114692274835607886/photo/1', 'https://mobile.twitter.com/someuser/status/2114692274835607886?s=20&t=abc', 'x.com/someuser/status/2114692274835607886/', 'https://www.x.com/SOMEUSER/status/2114692274835607886#x'];
  ok(forms.every(f => { const p = parse(f); return p.ok && p.sid === a.sid && p.handle === a.handle && p.norm === a.norm; }), 'twitter.com, mobile., /photo/1, ?s=, trailing slash, #hash are the SAME post (' + a.norm + ')');
  const i1 = parse('https://x.com/i/status/2114692274835607886'), i2 = parse('https://x.com/i/web/status/2114692274835607886');
  ok(i1.ok && i1.sid === a.sid && i1.handle === '' && i2.ok && i2.sid === a.sid, '/i/status and /i/web/status carry the id with no handle');
  ok(parse('https://x.com/someuser').why === 'profile' && parse('https://x.com/someuser').ok === false, 'a profile link is refused as profile');
  ok(parse('https://x.com/i/jf/onboarding/web').ok === false, 'an onboarding link is not a post');
  ok(parse('https://instagram.com/p/abc').ok === false && parse('not a url').ok === false, 'another host / garbage refused');
  ok(parse('https://x.com/some.user/status/2114692274835607886').ok === false, 'a handle outside X\'s own alphabet is refused');
  if (PURE) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }

  console.log('-- live');
  const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
  const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
  const AH = { 'x-admin-key': K, 'content-type': 'application/json' };
  const t = Date.now().toString(36), uidA = 'e2epra' + t, uidB = 'e2eprb' + t;
  const mk = async (uid) => { const m = await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) }); const s = await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'sess' }) }); return { ok: m.s === 200, tok: s.b && (s.b.token || s.b.sess || s.b.mp_sess) }; };
  const A = await mk(uidA), B = await mk(uidB);
  ok(A.ok && A.tok && B.ok && B.tok, 'two test members minted with sessions');
  const adm = await j('/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } });
  ok(adm.b && adm.b.token, 'admin session minted');
  const H = (tok) => ({ cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }), AD = { cookie: 'mp_sadm=' + adm.b.token, 'content-type': 'application/json' };
  const handle = 'E2ehandle' + t.slice(-6), sid1 = '21' + String(Date.now()).slice(-14) + '01', sid2 = '21' + String(Date.now()).slice(-14) + '02';
  const sub = (tok, url) => j('/api/reward/promo/submit', { method: 'POST', headers: H(tok), body: JSON.stringify({ platform: 'x', url }) });
  const s1 = await sub(A.tok, 'https://x.com/' + handle + '/status/' + sid1);
  ok(s1.s === 200 && s1.b && s1.b.ok && s1.b.handle === handle.toLowerCase(), 'A files a post from @' + handle.toLowerCase() + ' (' + s1.s + ' ' + JSON.stringify(s1.b) + ')');
  const s1b = await sub(A.tok, 'https://twitter.com/' + handle.toUpperCase() + '/status/' + sid1 + '/photo/1?s=20');
  ok(s1b.s === 409 && s1b.b && s1b.b.error === 'url_taken', 'the same post under another spelling is url_taken, not daily_limit (' + s1b.s + ' ' + (s1b.b && s1b.b.error) + ')');
  const prof = await sub(B.tok, 'https://x.com/' + handle);
  ok(prof.s === 400 && prof.b && prof.b.error === 'bad_url' && prof.b.why === 'profile', 'a profile link is refused with why=profile (' + prof.s + ')');
  const s2 = await sub(B.tok, 'https://x.com/' + handle + '/status/' + sid2);
  ok(s2.s === 409 && s2.b && s2.b.error === 'handle_taken' && s2.b.other === 'u:' + uidA, 'B filing a different post from the same X account is handle_taken naming A (' + s2.s + ' ' + JSON.stringify(s2.b) + ')');
  const mineB = await j('/api/reward/promo/mine', { headers: H(B.tok) });
  const bl = ((mineB.b && mineB.b.promos) || []).find(p => p.status === 'blocked');
  ok(!!bl && /already posts for another/i.test(bl.note || ''), 'B sees the attempt as a blocked row with the reason');
  const s3 = await sub(B.tok, 'https://x.com/e2eh2' + t.slice(-6) + '/status/' + sid2.slice(0, -1) + '3'); // another X account and a third post id: the blocked row already holds sid2 (url_taken), and handle+'x' is 16 chars (bad_handle)
  ok(s3.s === 429 && s3.b && s3.b.error === 'daily_limit', 'the blocked attempt used B\'s post for today (daily_limit, not a second try under a new handle) (' + s3.s + ' ' + JSON.stringify(s3.b) + ')');
  // the desk
  const list = await j('/api/reward/promo/list?e2e=1', { headers: AD });
  const rowA = ((list.b && list.b.pending) || []).find(p => p.address === 'u:' + uidA);
  ok(!!rowA && Array.isArray(rowA.also) && rowA.also.indexOf('u:' + uidB) >= 0 && Array.isArray(rowA.alsoNames) && rowA.alsoNames[0] === 'e2e_' + uidB, 'the pending row on the desk names B as sharing the X account (' + JSON.stringify(rowA && rowA.alsoNames) + ')');
  const rev = await j('/api/reward/promo/review', { method: 'POST', headers: AD, body: JSON.stringify({ id: rowA && rowA.id, action: 'approve', force: 0 }) });
  ok(rev.s === 400 && rev.b && rev.b.error === 'too_early' || rev.s === 409 && rev.b && rev.b.error === 'handle_shared', 'approving is refused before the money moves (' + rev.s + ' ' + (rev.b && rev.b.error) + ')');
  const ab = await j('/api/admin/promoabuse?e2e=1', { headers: AH });
  const cl = ((ab.b && ab.b.handles) || []).find(c => c.key === handle.toLowerCase());
  ok(ab.s === 200 && ab.b && ab.b.ok && !!cl, 'the abuse desk lists @' + handle.toLowerCase() + ' as one X account on 2 members');
  const mA = cl && cl.members.find(m => m.uid === uidA), mB = cl && cl.members.find(m => m.uid === uidB);
  ok(mA && mA.holder && !mA.candidate && mB && !mB.holder && mB.candidate && mB.blocked === 1, 'A (filed first) is the holder, B is the proposed ban with 1 blocked attempt');
  ok((ab.b.candidates || []).indexOf(uidB) >= 0 && (ab.b.candidates || []).indexOf(uidA) < 0, 'candidates carry B and not A');
  const abNo = await j('/api/admin/promoabuse', { headers: AH });
  ok(!((abNo.b && abNo.b.handles) || []).some(c => c.key === handle.toLowerCase()), 'without ?e2e=1 the test cluster is hidden from the owner\'s read');
  // dry run, then the ban
  const dry = await j('/api/admin/promoabuse', { method: 'POST', headers: AH, body: JSON.stringify({ ban: [uidB, 'u:' + uidA, 'nobody'], e2e: true }) });
  ok(dry.s === 200 && dry.b && dry.b.dry === true && (dry.b.results || []).length === 0 && dry.b.targets.indexOf(uidB) >= 0 && dry.b.refused.indexOf('nobody') >= 0, 'POST without apply is a dry run: targets named, an unknown uid refused, nothing banned');
  const uB0 = await j('/api/auth/user?id=' + uidB, { headers: AD });
  ok(uB0.b && uB0.b.user && uB0.b.user.status !== 'banned', 'B is still active after the dry run (' + (uB0.b && uB0.b.user && uB0.b.user.status) + ')');
  const ban = await j('/api/admin/promoabuse', { method: 'POST', headers: AH, body: JSON.stringify({ ban: [uidB], apply: true, e2e: true }) });
  const rB = ban.b && (ban.b.results || [])[0];
  ok(ban.s === 200 && ban.b && ban.b.dry === false && rB && rB.uid === uidB && rB.site && rB.ledger, 'apply bans B on the site AND the ledger (' + JSON.stringify(rB && { site: rB.site, ledger: rB.ledger, errors: rB.errors }) + ')');
  const uB1 = await j('/api/auth/user?id=' + uidB, { headers: AD });
  ok(uB1.b && uB1.b.user && uB1.b.user.status === 'banned', 'B reads as banned on the site (' + (uB1.b && uB1.b.user && uB1.b.user.status) + ')');
  const uA1 = await j('/api/auth/user?id=' + uidA, { headers: AD });
  ok(uA1.b && uA1.b.user && uA1.b.user.status === 'active', 'A is untouched (' + (uA1.b && uA1.b.user && uA1.b.user.status) + ')');
  const ab2 = await j('/api/admin/promoabuse?e2e=1', { headers: AH });
  const cl2 = ((ab2.b && ab2.b.handles) || []).find(c => c.key === handle.toLowerCase()), mB2 = cl2 && cl2.members.find(m => m.uid === uidB);
  ok(mB2 && mB2.status === 'banned' && mB2.ledgerBanned === true && mB2.candidate === false, 'the desk now shows B banned on both books and no longer proposed (' + JSON.stringify(mB2 && { status: mB2.status, ledgerBanned: mB2.ledgerBanned, candidate: mB2.candidate }) + ')');
  const s4 = await sub(B.tok, 'https://x.com/other' + t.slice(-5) + '/status/' + sid2 + '9');
  ok(s4.s === 403 || s4.s === 401, 'a banned B cannot file anything (' + s4.s + ' ' + (s4.b && s4.b.error) + ')');
  for (const uid of [uidA, uidB]) { const rm = await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'rm' }) }); ok(rm.s === 200, 'test member ' + uid + ' removed'); }
  const ab3 = await j('/api/admin/promoabuse?e2e=1', { headers: AH });
  ok(!((ab3.b && ab3.b.handles) || []).some(c => c.key === handle.toLowerCase()), 'the cluster is gone with the accounts (ledger rows cleaned)');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

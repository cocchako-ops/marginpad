/* Sliding sessions E2E (2026-09-09, owner: "nesto izloguje korisnike, nikog ne izlogujemo").
   Measured before: sessions were a FIXED 30 days (the August cohort was being signed out on schedule in September) and the cookie was
   never re-issued. Now: 180 days, and a session read more than 7 days after its last extension is pushed back to the full 180 by the
   store; /api/auth/me re-issues mp_sess (same token) + mp_uid with the full Max-Age when that happens.
   Proves on production with a throwaway member whose session is minted short (2 h, so it is "older than 7 days" by definition):
     1. the first /me answers the user AND sets mp_sess/mp_uid/mp_li/mp_un cookies with Max-Age 180 days (renewed)
     2. the second /me still answers the user and does NOT re-issue mp_sess (already at the full lifetime)
     3. a /me without a cookie answers user:null and clears mp_li only
     4. the session cookie attributes stay HttpOnly; Secure; SameSite=Lax; Path=/
   Run: node build/session-e2e.js */
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const TAG = Math.random().toString(36).slice(2, 8), uidE = 'e2esess' + TAG;
const setCookies = (r) => { try { return r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/); } catch (e) { return []; } };
const maxAge = (c) => { const m = /Max-Age=(\d+)/.exec(c || ''); return m ? +m[1] : null; };
(async () => {
  const se = await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: uidE, op: 'sess' }) }).then(r => r.json());
  const tok = se.token || ''; chk('throwaway member with a short session', !!tok, { ok: se.ok });
  if (!tok) { console.log(out.join('\n')); process.exit(1); }
  const me = (ck) => fetch(ORIGIN + '/api/auth/me', { headers: { cookie: ck, 'x-admin-key': K } });
  const r1 = await me('mp_sess=' + tok); const d1 = await r1.json(); const c1 = setCookies(r1);
  const sess1 = c1.filter(c => /^mp_sess=/.test(c))[0], uid1 = c1.filter(c => /^mp_uid=/.test(c))[0], li1 = c1.filter(c => /^mp_li=/.test(c))[0];
  chk('first /me: signed in, session slid, mp_sess re-issued with the same token for 180 days', !!(d1.user && d1.user.id === uidE) && !!sess1 && sess1.indexOf('mp_sess=' + tok) === 0 && maxAge(sess1) === 15552000, { user: d1.user && d1.user.id, sessMaxAge: maxAge(sess1) });
  chk('first /me: mp_uid re-issued alongside, mp_li marker refreshed, both 180 days', !!uid1 && maxAge(uid1) === 15552000 && !!li1 && maxAge(li1) === 15552000, { uid: maxAge(uid1), li: maxAge(li1) });
  chk('session cookie attributes: HttpOnly, Secure, SameSite=Lax, Path=/', /HttpOnly/.test(sess1 || '') && /Secure/.test(sess1 || '') && /SameSite=Lax/.test(sess1 || '') && /Path=\//.test(sess1 || ''), sess1 && sess1.replace(tok, '<tok>'));
  const r2 = await me('mp_sess=' + tok); const d2 = await r2.json(); const c2 = setCookies(r2);
  chk('second /me: still signed in, no second re-issue of mp_sess (already at the full lifetime)', !!(d2.user && d2.user.id === uidE) && !c2.some(c => /^mp_sess=/.test(c)) && c2.some(c => /^mp_li=1/.test(c)), { cookies: c2.map(c => c.split('=')[0]) });
  const r3 = await me(''); const d3 = await r3.json(); const c3 = setCookies(r3);
  chk('/me without a cookie: user null, clears only the mp_li marker', d3.user === null && c3.some(c => /^mp_li=;/.test(c) && maxAge(c) === 0) && !c3.some(c => /^mp_sess=/.test(c)), { cookies: c3.map(c => c.split('=')[0]) });
  try { await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: uidE, op: 'rm' }) }); } catch (e) {}
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' — ' + f + ' FAIL' : ''));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });

/* THE STANDING SECURITY SUITE (2026-09-21)

   The review that produced this was a snapshot: it measured a posture that was true that morning and
   that nothing would have checked again. These are the probes that found the real findings, kept, so
   the posture is a property of the deploy rather than a memory of one afternoon.

   What it refuses to let back in, each one a thing that was actually wrong:
     - a credential in a tracked file. The LIVE admin key sat in six files in a public repository and
       answered 200; the fix was a rotation, because deleting a line does not un-publish it.
     - a page with no security headers. There were none at all, anywhere, which matters because member
       text is stored raw and escaped at render: one missed escape was account takeover with nothing
       behind it.
     - an admin route that forgets its gate. All 129 hold today; the test is for the 130th.
     - a member reaching another member by putting a uid in a query or a body.
     - a cross-site post that carries the session cookie to the money routes.
     - a redirector that can be pointed at somebody else's host.

   It is READ-MOSTLY and safe to run against production: every write it attempts is one that must be
   refused, and the two throwaway accounts it mints are removed in a finally block.

   Run: node build/security-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://marginpad.io';
const KEY = (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9]+/) || [])[0];
if (!KEY) { console.error('no mpadm_ token in ADMIN_KEY.local.txt'); process.exit(1); }
const STATS_KEY = 'mp_9f3c7e21b84d4a6f';   // read-only, hardcoded by an owner decision - here as an attacker would use it
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const adm = (u, b) => fetch(BASE + u, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + String(x).slice(0, 170) : '')); } };
const head = t => console.log('\n' + t);

(async () => {
  console.log('security-e2e - the review, kept\n');

  /* ---------------------------------------------------------------- 1. secrets */
  head('-- no credential reaches the public repository');
  {
    let code = 0, out = '';
    try { out = execSync('node "' + path.join(__dirname, 'secret-scan.js') + '"', { cwd: ROOT, encoding: 'utf8' }); }
    catch (e) { code = e.status || 1; out = String(e.stdout || '') + String(e.stderr || ''); }
    ok(code === 0, 'the scanner passes over every tracked file', out.trim().split('\n').pop());
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok(/secret-scan/.test(pkg.scripts.predeploy || ''), 'and it runs before every deploy, not only by hand');
    // the files that must never be tracked, checked against git rather than the filesystem
    for (const f of ['ADMIN_KEY.local.txt', '.dev.vars', 'CLAUDE.md']) {
      let tracked = true;
      try { execSync('git ls-files --error-unmatch ' + f, { cwd: ROOT, stdio: 'ignore' }); } catch (e) { tracked = false; }
      ok(!tracked, f + ' is not tracked');
    }
  }

  /* ---------------------------------------------------------------- 2. headers */
  head('-- every page carries its security headers');
  {
    const WANT = ['strict-transport-security', 'x-content-type-options', 'x-frame-options',
      'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy'];
    // one page of each kind: a static file, a server-rendered page, a Spanish twin, an API answer
    for (const p of ['/', '/season/', '/liquidations/', '/es/rewards/']) {
      const r = await fetch(BASE + p + '?cb=' + Date.now());
      const missing = WANT.filter(k => !r.headers.get(k));
      ok(missing.length === 0, p + ' carries all six enforced headers', missing.join(', '));
      ok(!!r.headers.get('content-security-policy-report-only') || !!r.headers.get('content-security-policy'),
        p + ' carries a content security policy');
    }
    const api = await fetch(BASE + '/api/v1/price?symbol=BTC');
    ok(!!api.headers.get('x-content-type-options'), 'the API answers carry them too');
    // the frame rule is what stops a page being framed over a real one
    const r2 = await fetch(BASE + '/rewards/?cb=' + Date.now());
    ok(/SAMEORIGIN|DENY/i.test(r2.headers.get('x-frame-options') || ''), 'the money page cannot be framed by another site',
      r2.headers.get('x-frame-options'));
  }

  /* ---------------------------------------------------------------- 3. the admin surface */
  head('-- every admin route refuses everyone it should');
  const routes = [...new Set([...fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8')
    .matchAll(/url\.pathname === '(\/api\/admin\/[a-z0-9\/_-]+)'/gi)].map(m => m[1]))].sort();
  ok(routes.length > 100, 'found ' + routes.length + ' admin routes to check');
  {
    const member = await mkMember('e2e-secm');
    try {
      const openTo = { anonymous: [], statsKey: [], member: [] };
      for (const p of routes) {
        for (const [who, init] of [
          ['anonymous', { redirect: 'manual' }],
          ['statsKey', { headers: { 'x-admin-key': STATS_KEY }, redirect: 'manual' }],
          ['member', { headers: { cookie: member.cookie }, redirect: 'manual' }]
        ]) {
          let s = 0; try { s = (await fetch(BASE + p, init)).status; } catch (e) { s = -1; }
          // 200 is the only answer that means "you got in". A 302 is the login redirect; a 404 is the
          // deliberate answer for a wrong key - the route pretends not to exist.
          if (s === 200) openTo[who].push(p);
        }
      }
      // a page that renders its own password form is a correct 200 - name those explicitly rather than
      // widening the rule, so a new open route cannot hide behind the exception
      const GATED_PAGES = new Set(['/api/admin/pmail']);
      for (const who of ['anonymous', 'statsKey', 'member']) {
        const bad = openTo[who].filter(p => !GATED_PAGES.has(p));
        ok(bad.length === 0, 'no admin route answers 200 to ' + who, bad.join(', '));
      }
      for (const p of GATED_PAGES) {
        const t = await fetch(BASE + p).then(r => r.text()).catch(() => '');
        ok(/password|sign in|<form/i.test(t), p + ' answers 200 only because it is a password gate');
      }
      // and the real key must work, or none of the above proves anything
      const ctl = await fetch(BASE + '/api/admin/money', { headers: { 'x-admin-key': KEY } });
      ok(ctl.status === 200, 'control: the real key does open an admin route', ctl.status);
    } finally { await member.remove(); }
  }

  /* ---------------------------------------------------------------- 4. one member reaching another */
  head('-- a member cannot reach another member');
  {
    const A = await mkMember('e2e-seca'), B = await mkMember('e2e-secb');
    try {
      const MARK = 'CANARY-' + Date.now();
      await fetch(BASE + '/api/auth/profile', { method: 'POST', headers: { 'content-type': 'application/json', cookie: B.cookie }, body: JSON.stringify({ bio: MARK }) });

      for (const u of ['/api/auth/user', '/api/auth/xp', '/api/trade/report?days=30', '/api/reward/me',
        '/api/auth/notifs', '/api/goals', '/api/pass', '/api/bybit/bonus', '/api/trade/orders']) {
        const url = u + (u.indexOf('?') >= 0 ? '&' : '?') + 'uid=' + B.uid;
        const t = await fetch(BASE + url, { headers: { cookie: A.cookie } }).then(r => r.text()).catch(() => '');
        ok(t.indexOf(MARK) < 0 && t.indexOf(B.uid) < 0, u.split('?')[0] + ' ignores a uid that is not the caller');
      }
      // a uid in the BODY of a write must not aim it at somebody else
      await fetch(BASE + '/api/auth/profile', { method: 'POST', headers: { 'content-type': 'application/json', cookie: A.cookie }, body: JSON.stringify({ uid: B.uid, bio: 'AIMED-AT-B' }) });
      const bAfter = await fetch(BASE + '/api/auth/user?uid=' + B.uid, { headers: H }).then(r => r.text()).catch(() => '');
      ok(bAfter.indexOf('AIMED-AT-B') < 0, 'a uid in the body cannot aim a write at another account');
      // the token decides the account, never the uid cookie beside it
      const forged = await fetch(BASE + '/api/auth/user', { headers: { cookie: 'mp_sess=' + A.token + '; mp_uid=' + B.uid } }).then(r => r.text());
      ok(forged.indexOf(MARK) < 0, 'the session token decides the account, not the uid cookie');
      // a token one character off is not a session
      const near = A.token.slice(0, -1) + (A.token.slice(-1) === 'a' ? 'b' : 'a');
      const nr = await fetch(BASE + '/api/auth/me', { headers: { cookie: 'mp_sess=' + near } }).then(r => r.text());
      ok(!/"(username|email)"\s*:\s*"[^"]/.test(nr), 'a near-miss token is not a session');
      ok(A.token.length === 64 && /^[a-f0-9]+$/.test(A.token), 'session tokens are 256 bits of hex', A.token.length);
    } finally { await A.remove(); await B.remove(); }
  }

  /* ---------------------------------------------------------------- 5. cross-site and redirects */
  head('-- cross-site requests and redirects');
  {
    const M = await mkMember('e2e-secc');
    try {
      for (const ct of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data; boundary=x']) {
        for (const route of ['/api/reward/claim', '/api/reward/withdraw']) {
          const r = await fetch(BASE + route, {
            method: 'POST', headers: { 'content-type': ct, cookie: M.cookie, origin: 'https://evil.example' },
            body: ct.indexOf('form-data') >= 0 ? '--x--' : 'amount=100'
          });
          ok(r.status !== 200, route + ' refuses a cross-origin ' + ct.split(';')[0], r.status);
        }
      }
    } finally { await M.remove(); }
    const SAFE = /marginpad\.io|bybit\.com|partner\.bybit|moon\.com|fomo\.family|hyperliquid|coinbase|base\.app|binance|mexc|okx|bitget/i;
    for (const u of ['/go?ex=https://evil.example', '/go?ex=bybit&to=https://evil.example', '/bybit-bonus/aaaaaaaaaa', '/?r=https://evil.example']) {
      const r = await fetch(BASE + u, { redirect: 'manual' });
      const loc = r.headers.get('location') || '';
      ok(!(/^https?:\/\//.test(loc) && !SAFE.test(loc)), u + ' cannot be pointed at another host', loc.slice(0, 70));
    }
  }

  /* ---------------------------------------------------------------- 6. what we tell a stranger */
  head('-- error answers do not describe our stack');
  {
    const r = await fetch(BASE + '/api/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nobody-' + Date.now() + '@example.com' }) });
    const t = await r.text();
    ok(!/resend|statusCode|validation_error|HTTP 4\d\d/i.test(t), 'a failed sign-in does not name the mail provider', t.slice(0, 120));
    ok(/hint/.test(t) || r.status < 400, 'and says something the caller can act on', t.slice(0, 90));
  }

  console.log('\n' + pass + ' held, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;   // never process.exit() mid-teardown

  async function mkMember(prefix) {
    const uid = prefix + Date.now() + Math.floor(Math.random() * 1000);
    await adm('/api/admin/e2euser', { uid, op: 'mk' });
    const s = await adm('/api/admin/e2euser', { uid, op: 'sess' });
    return {
      uid, token: s.token, cookie: 'mp_sess=' + s.token + '; mp_uid=' + uid,
      remove: () => adm('/api/admin/e2euser', { uid, op: 'rm' }).catch(() => {})
    };
  }
})();

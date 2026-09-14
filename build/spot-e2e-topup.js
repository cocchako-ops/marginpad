/* Demo Spot daily lifeline E2E (2026-09-10).
   Owner: "let people who spent all their money claim 1k a day on Spot."

   The rules this locks down:
     - an account that still has money is refused (the check is the WHOLE portfolio priced by the server, not the
       card alone, and not a number the client sends)
     - an emptied account can claim $1,000 onto the card, once
     - a second claim the same UTC day is refused with the time until the next one
     - it is a TOP-UP, not a reset: the wallet, the tx history and the onboarding step all survive
   Run: node build/spot-e2e-topup.js */
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 260) : '')); console.log(out[out.length - 1]); };
const uidE = 'e2etop' + Math.random().toString(36).slice(2, 7);

(async () => {
  const se = await (await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: uidE, op: 'sess' }) })).json();
  chk('throwaway member + session', !!se.token, { uid: uidE });
  if (!se.token) process.exit(1);
  const CK = Object.assign({}, H, { cookie: 'mp_sess=' + se.token + '; mp_uid=' + uidE });
  const get = (p) => fetch(ORIGIN + p, { headers: CK }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: CK, body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    // no Demo Spot account yet
    let r = await get('/api/spot/topup');
    chk('before an account exists the endpoint says so instead of offering money', r.body.none === true, r.body);
    await post('/api/spot/start', {});
    // a full account is refused, and the reason is the priced total
    r = await get('/api/spot/topup');
    chk('a fresh $10,000 account is not eligible, and the answer states what it is worth', r.body.eligible === false && r.body.valueUsd === 10000 && r.body.amountUsd === 1000 && r.body.maxUsd === 100, r.body);
    r = await post('/api/spot/topup');
    chk('claiming while rich is refused', r.status === 400 && r.body.error === 'not_broke', r.body);
    // spend it all
    const dr = await (await fetch(ORIGIN + '/api/admin/spotdrain?uid=' + uidE, { headers: H })).json();
    chk('the throwaway account is emptied', dr.ok === true, dr);
    r = await get('/api/spot/topup');
    chk('an empty account is eligible', r.body.eligible === true && r.body.valueUsd < 100 && r.body.claimedToday === false, r.body);
    // claim
    r = await post('/api/spot/topup');
    chk('the claim pays $1,000 onto the card', r.status === 200 && r.body.ok === true && r.body.gotUsd === 1000 && r.body.cardUsd === 1000, r.body);
    const pf = await get('/api/spot/portfolio');
    chk('the portfolio shows the money and the account is NOT reset (onboarding kept)', pf.body.cardUsd === 1000 && typeof pf.body.onb === 'number' && pf.body.onb >= 0, { card: pf.body.cardUsd, onb: pf.body.onb, total: pf.body.totalUsd });
    const tx = await get('/api/spot/history');
    chk('the top-up is written into the account history', Array.isArray(tx.body.tx) && tx.body.tx.some(t => t.side === 'topup' && t.usdUsd === 1000), (tx.body.tx || []).slice(0, 2));
    // and only once a day
    r = await post('/api/spot/topup');
    chk('a second claim the same day is refused with the time until the next one', r.status === 429 && r.body.error === 'claimed' && r.body.nextMs > 0 && r.body.nextMs <= 86400000, r.body);
    r = await get('/api/spot/topup');
    chk('the state says it was claimed today', r.body.claimedToday === true && r.body.topups === 1, r.body);
    // signed out
    const anon = await fetch(ORIGIN + '/api/spot/topup').then(async x => ({ status: x.status, body: await x.json().catch(() => ({})) }));
    chk('a signed-out visitor gets no money', anon.status === 401 || anon.body.error === 'auth', anon.body);
  } finally {
    try { await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: uidE, op: 'rm' }) }); } catch (e) {}
  }
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length;
  console.log('\nUID ' + uidE + ' - pass ' + (out.length - bad) + ' fail ' + bad);
  process.exit(bad ? 1 : 0);
})();

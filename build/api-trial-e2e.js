/* THE LOAD-BEARING PROOF. A gate that nobody has watched refuse is a gate nobody can trust, and this one
   decides whether 24 live accounts keep working. Walks a real throwaway member end to end:
   mint a key -> the engine answers while the trial runs -> end the trial -> the engine answers 402
   trial_expired -> and MARKET DATA STILL WORKS, with the same key, because it is a different product. */
const fs = require('fs');
const KEY = fs.readFileSync('ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const O = 'https://marginpad.io';
const UID = 'e2e-trial' + Math.random().toString(36).slice(2, 7);
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 220) : '')); } };
const A = (extra) => Object.assign({ 'x-admin-key': KEY, 'content-type': 'application/json' }, extra || {});

(async () => {
  // a real member with a real session
  const mk = await (await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: A(), body: JSON.stringify({ uid: UID, op: 'mk' }) })).json();
  ok('throwaway member created', !!mk && !mk.error, mk);
  const se = await (await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: A(), body: JSON.stringify({ uid: UID, op: 'sess' }) })).json();
  const sess = se && (se.sess || se.token || se.mp_sess);
  ok('session minted', !!sess, se);

  // mint a key as that member - this is what starts the clock
  const kr = await (await fetch(O + '/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + sess }, body: JSON.stringify({ act: 'create', name: 'trial-proof' }) })).json();
  const key = kr && kr.key;
  ok('key minted', !!key, { error: kr && kr.error });
  ok('minting a key starts a 7-day trial and the response says when it ends',
    !!(kr && kr.trial && kr.trial.active && kr.trial.days_left === 7 && kr.trial.ends), kr && kr.trial);

  const callEngine = () => fetch(O + '/api/bot/v1/account', { headers: { 'x-api-key': key } });
  const callData = () => fetch(O + '/api/v1/price?symbol=BTC', { headers: { 'x-api-key': key } });

  // 1) while the trial runs, the engine works
  const r1 = await callEngine();
  const b1 = await r1.json().catch(() => ({}));
  ok('inside the trial the engine answers 200', r1.status === 200, { status: r1.status, body: b1 });
  ok('and every response carries the trial countdown in a header',
    !!r1.headers.get('x-mp-trial-expires') && r1.headers.get('x-mp-trial-days-left') === '7',
    { expires: r1.headers.get('x-mp-trial-expires'), left: r1.headers.get('x-mp-trial-days-left') });

  // 2) end the trial
  const sr = await (await fetch(O + '/api/admin/apitrial', { method: 'POST', headers: A(), body: JSON.stringify({ set: { uid: UID, days: 0 } }) })).json();
  ok('a trial can be ended for one account', !!sr && sr.ok && sr.active === false, sr);

  // 3) the engine now refuses, and says exactly what and where
  const r2 = await callEngine();
  const b2 = await r2.json().catch(() => ({}));
  ok('THE GATE: an expired trial is refused 402 trial_expired', r2.status === 402 && b2.error === 'trial_expired', { status: r2.status, body: b2 });
  ok('the refusal names the price and the page, never leaves a developer guessing',
    !!(b2.hint && /trial/i.test(b2.hint) && b2.upgrade && /trading-api/.test(b2.upgrade)), b2);

  // 4) THE BOUNDARY: market data is a different product and must not be gated
  const r3 = await callData();
  const b3 = await r3.json().catch(() => ({}));
  ok('MARKET DATA STILL WORKS on the same expired key', r3.status === 200 && b3 && b3.ok !== false, { status: r3.status, body: b3 });
  const r4 = await fetch(O + '/api/v1/price?symbol=BTC');
  ok('and keyless market data is untouched', r4.status === 200, { status: r4.status });

  // 5) a paid tier must never meet the gate
  await fetch(O + '/api/admin/apiplans', { method: 'POST', headers: A(), body: JSON.stringify({ uid: UID, plan: 'pro', days: 30, src: 'owner' }) }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  const r5 = await callEngine();
  ok('a paid plan passes even with the trial long dead', r5.status === 200, { status: r5.status });

  // cleanup
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: A(), body: JSON.stringify({ uid: UID, op: 'rm' }) }).catch(() => {});
  console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();

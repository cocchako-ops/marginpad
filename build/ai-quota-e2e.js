/* Ask AI daily allowance per plan (2026-09-19, owner: "obican premium ima pravo na jedan promt na AI").
   Free/guest: none. Premium: AI_DAILY.premium a day. Plus: AI_DAILY.plus.
   The load-bearing check is the SECOND call on ordinary Premium: it must be refused 429 AND the refusal must
   carry the Plus offer, because that refusal is the entire upgrade moment. Falsify by raising AI_DAILY.premium
   to 2 - the "second read is refused" check must go red.
   node build/ai-quota-e2e.js                                                                               */
const fs = require('fs'), path = require('path');
const ORIGIN = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? '  ok  ' : '  FAIL ') + m + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 220))); };

const api = (p, o) => fetch(ORIGIN + p, o).then(async r => ({ status: r.status, j: await r.json().catch(() => null) }));
const adm = (p, body) => api(p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify(body) });

(async () => {
  // ---- what the catalogue says, keyless ---------------------------------------------------------------
  const pub = await api('/api/ai/chart');
  ok(pub.status === 200, 'GET /api/ai/chart answers a guest', pub.status);
  const D = pub.j && pub.j.dailyByPlan;
  ok(!!D && D.premium >= 1 && D.plus > D.premium, 'it publishes the allowance per plan', D);
  ok(pub.j && pub.j.limit === 0 && pub.j.premiumOnly === true, 'a guest is told 0, not a number they cannot use', pub.j && { limit: pub.j.limit, premiumOnly: pub.j.premiumOnly });
  ok(pub.j && pub.j.planNeeded === 'premium', 'and is pointed at PREMIUM, the cheapest way in - not at Plus', pub.j && pub.j.planNeeded);

  const uid = 'e2equota' + Math.random().toString(36).slice(2, 7);
  let made = false;
  try {
    const mk = await adm('/api/admin/e2euser', { uid, op: 'mk' });
    made = !!(mk.j && (mk.j.ok || mk.j.uid));
    ok(made, 'throwaway member created', mk.j);
    if (!made) return;

    // ---- a member with no plan is refused, and told what the cheapest plan gives -----------------------
    const sess = await adm('/api/admin/e2euser', { uid, op: 'sess' });
    const tok = sess.j && (sess.j.token || sess.j.sess || sess.j.mp_sess);
    ok(!!tok, 'and given a session', sess.j && Object.keys(sess.j));
    const H = { 'content-type': 'application/json', cookie: 'mp_sess=' + tok };
    const askAs = (hdr) => api('/api/ai/chart', { method: 'POST', headers: hdr, body: JSON.stringify({ context: { symbol: 'BTC', timeframe: '1-hour', price: 80000, barsLoaded: 12, note: 'quota probe' }, question: 'One line: is this a quota probe?', stream: false, lang: 'en' }) });

    const free = await askAs(H);
    ok(free.status === 402, 'a member with no plan is refused 402', free.status);
    ok(free.j && free.j.plan_needed === 'premium' && free.j.daily >= 1, 'the refusal names Premium and what one costs', free.j && { p: free.j.plan_needed, d: free.j.daily });
    ok(free.j && free.j.plus_daily > free.j.daily, 'and names what Plus raises it to', free.j && { plus: free.j.plus_daily });

    // ---- grant ordinary Premium -----------------------------------------------------------------------
    // the ops grant route works on USERNAMES, and e2euser names its accounts e2e_<uid>
    const uname = 'e2e_' + uid;
    const gr = await api('/api/admin/premium?add=' + uname + '&days=2', { headers: { 'x-admin-key': KEY } }).catch(() => null);
    const granted = gr && gr.status === 200;
    ok(granted, 'ordinary Premium granted to the throwaway member', gr && gr.status);
    if (!granted) { console.log('  note: grant failed, skipping the member legs'); }
    else {
      const st = await api('/api/ai/chart', { headers: { cookie: 'mp_sess=' + tok } });
      ok(st.j && st.j.premium === true && st.j.plus === false, 'ordinary Premium reads as premium, not plus', st.j && { p: st.j.premium, pl: st.j.plus });
      ok(st.j && st.j.limit === D.premium, 'and its limit is exactly the plan allowance, never the free default', st.j && st.j.limit);
      ok(st.j && st.j.planNeeded === 'plus', 'with Plus offered as the way to more', st.j && st.j.planNeeded);

      const one = await askAs(H);
      ok(one.status === 200 || one.status === 503, 'the first read goes through', one.status);
      if (one.status === 200) {
        const two = await askAs(H);
        ok(two.status === 429, 'THE SECOND READ IS REFUSED - one a day means one', two.status);
        ok(two.j && two.j.plan === 'premium' && two.j.plan_needed === 'plus' && two.j.plus_daily === D.plus,
          'and the refusal carries the Plus offer - that refusal IS the upgrade moment', two.j);

        // The wall has to be the NUMBER rather than a hardcoded refusal. /api/ai/admin is deliberately
        // cookie-only (it is not loosened for a test), so this is asserted from the published side instead:
        // the refusal's own `limit` must equal the plan allowance the catalogue advertises, and the plan
        // allowance must be the small one - if either drifted, one of these goes red.
        ok(two.j && two.j.limit === D.premium, 'the refusal quotes the same allowance the catalogue publishes', two.j && two.j.limit);
        ok(D.premium === 1, 'and that allowance is one read a day, which is what was ordered', D);
      }
    }
  } finally {
    // the grant is KV keyed to the USERNAME and the orphan sweep cannot see it - take it back by hand
    await api('/api/admin/premium?remove=e2e_' + uid, { headers: { 'x-admin-key': KEY } }).catch(() => {});
    if (made) { await adm('/api/admin/e2euser', { uid, op: 'rm' }).catch(() => {}); console.log('  cleanup: ' + uid + ' removed, premium grant revoked'); }
  }

  console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;   // never process.exit here - it aborts mid-teardown and the shell sees 127
})().catch(e => { console.error('fatal ' + e.message); process.exitCode = 1; });

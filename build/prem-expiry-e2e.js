/* DOES PREMIUM ACTUALLY END WHEN THE CLOCK SAYS SO (2026-10-22, owner: "proveri da li istek premium-a radi kako treba i
 * da li kad prodje vreme korisnik izgubi premium")?
 *
 * The gates were always time-based (premiumFor compares both stores to Date.now() on every read), so the ENGINE expired
 * correctly. What did not: the badge roster `premium:names` was append-only, so every expired grant kept a gold name
 * in chat and `premium:true` on the profile card (measured: 20 of 25 expired members); a Premium frame checked at EQUIP
 * time stayed worn (two members); the Daily Brief delivery never asked who was still Premium; and the position / zone
 * alert crons never read the users.premium column, so an mp-ops grant got no alerts at all.
 *
 * This suite grants a throwaway member a FRACTION of a day and WAITS - the expiry happens by the clock, exactly as it
 * does for a real member, never by a removal. The load-bearing checks are the ones after the wait.
 *
 * Run: node build/prem-expiry-e2e.js        (about four minutes - most of it is the wait)
 *      node build/prem-expiry-e2e.js --pure (the stubbed premLiveRow checks only, no network)
 */
const fs = require('fs');
const path = require('path');
const ORIGIN = 'https://marginpad.io';
const PURE = process.argv.indexOf('--pure') >= 0;
const UID = 'e2eprexp1';                 // NO HYPHEN: /lbuser strips it, and so does the username sanitiser
const USER = 'e2e_' + UID;
const GRANT_DAYS = 0.0017;               // ~147 s: long enough to see every surface say "premium", short enough to wait out

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  ' + JSON.stringify(d).slice(0, 260) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms, step) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await sleep(step || 5000); } return v; };

// ---- pure: premLiveRow lifted out of the SHIPPED worker and driven with stubs --------------------------------------
(function pure() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  const m = src.match(/async function premLiveRow\(env, allow, w, now\) \{[\s\S]*?\n\}/);
  ok(!!m, 'premLiveRow exists in the worker source');
  if (!m) return;
  const premLiveRow = new Function('return ' + m[0])();
  const kv = (map) => ({ STATS: { get: async (k) => (k in map ? map[k] : null) } });
  const now = 1000000;
  (async () => {
    const allow = new Set(['granted_name']);
    ok(await premLiveRow(kv({}), allow, { uid: 'a', username: 'Granted_Name', prem: 0 }, now) === true, 'pure: the legacy allow-list counts, case-insensitively');
    ok(await premLiveRow(kv({}), allow, { uid: 'b', username: 'x', prem: now + 1 }, now) === true, 'pure: a live users.premium column counts (an mp-ops grant lives only there)');
    ok(await premLiveRow(kv({}), allow, { uid: 'c', username: 'x', prem: now - 1 }, now) === false, 'pure: an EXPIRED column does not');
    ok(await premLiveRow(kv({ 'prem:sub:d': String(now + 1) }), allow, { uid: 'd', username: 'x', prem: 0 }, now) === true, 'pure: a live paid KV row counts');
    ok(await premLiveRow(kv({ 'prem:sub:e': String(now - 1) }), allow, { uid: 'e', username: 'x', prem: now - 5 }, now) === false, '[LB] pure: expired everywhere = not Premium, whatever the row once was');
    ok(await premLiveRow({ STATS: { get: async () => { throw new Error('kv'); } } }, allow, { uid: 'f', username: 'x', prem: 0 }, now) === false, 'pure: a KV failure refuses rather than throws');
    // structural: the badge set must never again be read off the append-only name list
    const ps = src.match(/async function premiumSet\(env\) \{[\s\S]*?\n\}/);
    ok(!!ps && ps[0].indexOf("'premium:names'") < 0, 'structural: premiumSet no longer reads premium:names (the list that only ever grew)');
    ok(!!ps && ps[0].indexOf('premiumLiveRows') >= 0, 'structural: premiumSet reads the live store roster');
    const lb = src.match(/path === '\/lbuser'[\s\S]*?cardbg: u\.cardbg/);
    ok(!!lb && /'aurora'\) && !this\._isPrem\(u\)/.test(lb[0]), 'structural: /lbuser takes a Premium frame off an expired member');
    ok(/checkBriefDelivery[\s\S]{0,1600}premLiveRow\(env, allow, w, nowB\)/.test(src), 'structural: the Daily Brief delivery resolves Premium per row');
    if (PURE) { console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0; }
  })();
})();

if (!PURE) (async () => {
  await sleep(300); // let the pure block print first
  console.log('PREMIUM EXPIRY BY THE CLOCK - ' + ORIGIN);
  const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
  const A = { 'x-admin-key': KEY, 'content-type': 'application/json' };
  const jget = async (u, h) => { const r = await fetch(ORIGIN + u, { headers: h || A }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, t: t.slice(0, 200) }; } };
  const jpost = async (u, body, h) => { const r = await fetch(ORIGIN + u, { method: 'POST', headers: h || A, body: body == null ? undefined : JSON.stringify(body) }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, t: t.slice(0, 200) }; } };
  const card = async () => (await jget('/api/lb/user?name=' + USER + '&cb=' + Date.now())).j || {};
  const badges = async () => (((await jget('/api/premium/badges?cb=' + Date.now())).j || {}).names || []).map(n => String(n).toLowerCase());
  let CK = null;
  try {
    await jpost('/api/admin/e2euser', { uid: UID, op: 'mk' });
    // ---- 1. a short grant, then a session (the grant revokes sessions so a buyer sees Premium at once) --------------
    const g = await jget('/api/admin/premium?add=' + USER + '&days=' + GRANT_DAYS);
    ok(g.s === 200, 'a fraction-of-a-day grant is accepted for an e2e account', g.j && { s: g.s });
    const s = await jpost('/api/admin/e2euser', { uid: UID, op: 'sess' });
    const sess = (s.j && (s.j.token || s.j.sess || s.j.mp_sess)) || null;
    ok(!!sess, 'a throwaway member and a session for it');
    if (!sess) throw new Error('no session');
    CK = { cookie: 'mp_sess=' + sess, 'content-type': 'application/json' };

    const st = await jget('/api/premium/status', CK);
    const untilMs = st.j && +st.j.until;
    ok(st.j && st.j.premium === true && untilMs > Date.now() && untilMs < Date.now() + 5 * 60000, 'the grant is live and ends within five minutes', st.j && { premium: st.j.premium, source: st.j.source, inS: Math.round((untilMs - Date.now()) / 1000) });
    const xp1 = await jget('/api/auth/xp?fresh=1', CK);
    ok(xp1.j && xp1.j.premium === true, 'the XP poll (what every page reads) says Premium', xp1.j && { premium: xp1.j.premium });

    // ---- 2. wear a Premium frame, be on the badge roster, open the brief -----------------------------------------
    const fr = await jpost('/api/auth/frame', { frame: 'aurora' }, CK);
    ok(fr.j && fr.j.ok && fr.j.frame === 'aurora', 'a Premium member can equip the aurora frame', fr.j);
    const eq1 = await jget('/api/auth/frames', CK);
    ok(eq1.j && eq1.j.equipped === 'aurora', 'and the customize panel shows it equipped', eq1.j && { equipped: eq1.j.equipped });
    const c1 = await until(async () => { const c = await card(); return (c.premium === true && c.frame === 'aurora') ? c : null; }, 95000);
    ok(!!c1, 'the public profile card says Premium and wears the frame (within the 60 s roster memo)', c1 || await card());
    const b1 = await until(async () => { const n = await badges(); return n.indexOf(USER) >= 0 ? n : null; }, 95000);
    ok(!!b1, 'the gold-name roster carries the member', { n: (b1 || []).length });
    const br1 = await jget('/api/brief', CK);
    ok(br1.s !== 402, 'the Daily Brief opens for a Premium member', { s: br1.s, err: br1.j && br1.j.error });

    // ---- 3. WAIT for the clock. Nothing is removed; the until simply passes. -------------------------------------
    // By the SERVER's clock: the first run of this suite stopped waiting 14 s early because this machine's clock ran
    // 17 s ahead of Cloudflare's, and three load-bearing checks went red on working code. The Date header is 1 s coarse.
    let skew = 0; try { const r = await fetch(ORIGIN + '/api/health'); const srv = Date.parse(r.headers.get('date') || ''); if (srv) skew = Date.now() - srv; } catch (e) {}
    console.log('  ...  local clock is ' + Math.round(skew / 1000) + ' s ahead of the server');
    const wait = untilMs - (Date.now() - skew) + 4000;
    console.log('  ...  waiting ' + Math.max(0, Math.round(wait / 1000)) + ' s for the grant to run out by itself');
    if (wait > 0) await sleep(wait);

    // ---- 4. everything says "no" now ----------------------------------------------------------------------------
    const st2 = await jget('/api/premium/status', CK);
    ok(st2.j && st2.j.premium === false, '[LB] /api/premium/status is false the moment the until has passed - no removal, no new session', st2.j && { premium: st2.j.premium, until: st2.j.until });
    const xp2 = await jget('/api/auth/xp?fresh=1', CK);
    ok(xp2.j && xp2.j.premium === false, '[LB] the XP poll says not Premium, so an open tab flips on its next poll', xp2.j && { premium: xp2.j.premium });
    const eq2 = await jget('/api/auth/frames', CK);
    ok(eq2.j && eq2.j.equipped === 'default' && (eq2.j.owned || []).indexOf('aurora') < 0, '[LB] the aurora frame comes off with the Premium and is no longer owned', eq2.j && { equipped: eq2.j.equipped });
    const c2 = await until(async () => { const c = await card(); return (c.premium === false && c.frame === 'default') ? c : null; }, 95000);
    ok(!!c2, '[LB] the public profile card loses the PREMIUM chip and the frame (within the 60 s roster memo)', c2 || await card());
    const b2 = await until(async () => { const n = await badges(); return n.indexOf(USER) < 0 ? n : null; }, 95000);
    ok(!!b2, '[LB] the gold-name roster drops the member', { n: (b2 || []).length });
    const br2 = await jget('/api/brief', CK);
    ok(br2.s === 402 && br2.j && br2.j.error === 'premium_required', '[LB] the Daily Brief is refused again', { s: br2.s, err: br2.j && br2.j.error });
    const tfs = await jget('/api/premium/status', CK);
    ok(tfs.j && tfs.j.signedIn === true, 'and the member is still signed in - expiry takes the Premium, never the account', tfs.j && { signedIn: tfs.j.signedIn });
  } catch (e) {
    ok(false, 'threw: ' + String(e.message));
  } finally {
    try { await jget('/api/admin/premium?remove=' + USER); } catch (e) {}
    try { await jpost('/api/admin/e2euser', { uid: UID, op: 'rm' }); } catch (e) {}
    const gone = await jget('/api/auth/user?uid=' + UID);
    ok(!(gone.j && gone.j.user && gone.j.user.username === USER), 'the throwaway member is removed again', gone.j && gone.j.user ? { user: gone.j.user.username } : 'gone');
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();

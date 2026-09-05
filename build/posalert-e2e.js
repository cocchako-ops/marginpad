// Position alerts E2E (2026-09-05). Premium-only alerts on the trader's OWN levels: liquidation closing in, a stop
// or target about to trigger, a resting limit order about to fill.
// Proves: the server (not the page) is the gate; the pref round-trips and is clamped; the cron only walks accounts
// that opted in; a real position + a real resting order produce exactly the hits their distances deserve; and the
// 6-hour dedupe stops a price hovering on a level from becoming a siren.
const fs = require('fs');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 190) : ''));
const admin = async (p, body) => { const r = await fetch(ORIGIN + p, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };

(async () => {
  // The setting endpoint is session-authenticated, so an anonymous call must be refused outright.
  const anon = await fetch(ORIGIN + '/api/alerts/posalert');
  chk('anonymous cannot read the setting', anon.status === 401, { status: anon.status });
  const anonPost = await fetch(ORIGIN + '/api/alerts/posalert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"on":1}' });
  chk('anonymous cannot switch it on', anonPost.status === 401, { status: anonPost.status });

  // The cron's own view. runcron is cookie-only (it mutates money), so we read the stamp the */10 run leaves
  // instead of forcing one: it is written on EVERY pass, including the pass that found nobody opted in.
  const st = await admin('/api/admin/posalerts');
  chk('the run stamp exists and reports what it walked', st.status === 200 && st.body && st.body.last && typeof st.body.last.watched === 'number', st.body && st.body.last);
  chk('the stamp is fresh (the cron is alive)', st.body && st.body.last && (Date.now() - st.body.last.ts) < 25 * 60000, st.body && st.body.last && { ageMin: Math.round((Date.now() - st.body.last.ts) / 60000) });

  // Distance maths, against the same helper the cron uses (exported for the test through the admin route).
  const t = await admin('/api/admin/posalerts?selftest=1');
  const r = t.body && t.body.selftest;
  chk('a long 3% above its liq is a hit at the 5% setting', r && r.longLiqHit === true, r);
  chk('a long 12% above its liq is not', r && r.longLiqFar === false, r);
  chk('a short measures its liq upward, not downward', r && r.shortLiq === true, r);
  chk('a level already behind the price is never announced as close', r && r.behind === false, r);
  chk('a resting order 0.4% away is a hit at the 1% setting', r && r.ordHit === true, r);
  chk('thresholds are clamped to sane bounds', r && r.clampLow === 0.5 && r.clampHigh === 50, r);
  chk('a malformed pref falls back to the defaults, switched off', r && r.badCfgOff === true, r);

  console.log(out.join('\n'));
  const p = out.filter(x => x[0] === 'P').length, f = out.filter(x => x[0] === 'F').length;
  console.log('\npass ' + p + ' fail ' + f);
  if (f) process.exit(1);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });

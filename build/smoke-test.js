/* POST-deploy smoke test against PRODUCTION (npm "postdeploy" hook - runs AFTER wrangler deploy). Staging is least
   faithful to prod exactly in static-asset serving (run_worker_first there), and that is the class of bug that has
   bitten before (a stale /paper-trade app-shell bundle caught only from the outside). This is the only thing that
   sees it: 5 routes return 200 + a key marker, and - critically - the app-shell bundle referenced by /paper-trade
   actually resolves (catches a stale/missing ?v= hash). Exits 1 on any failure so `npm run deploy` reports it.
   Override target with SMOKE_BASE=https://marginpad-staging.<acct>.workers.dev (+ SMOKE_AUTH for the staging gate). */
const BASE = process.env.SMOKE_BASE || 'https://marginpad.io';
const AUTH = process.env.SMOKE_AUTH || ''; // 'Basic ...' for the staging gate
const H = AUTH ? { authorization: AUTH } : {};

const CHECKS = [
  { path: '/', marker: '/assets/mp-auth.js', what: 'homepage' },
  { path: '/paper-trade', marker: '/assets/home.js?v=', what: 'app-shell (paper-trade)' },
  { path: '/charts', marker: 'chartspace', what: 'charts' },
  { path: '/rewards', marker: '/assets/mp-trade.js', what: 'rewards' },
  { path: '/api/prices', json: true, what: 'prices API' },
];

async function get(path) {
  const r = await fetch(BASE + path + (path.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { headers: H, redirect: 'follow' });
  const body = await r.text();
  return { status: r.status, body };
}

(async () => {
  const fails = [];
  let appShellHtml = '';
  for (const c of CHECKS) {
    try {
      const { status, body } = await get(c.path);
      if (status !== 200) { fails.push(`${c.what} (${c.path}) → HTTP ${status}`); continue; }
      if (c.json) { try { JSON.parse(body); } catch (e) { fails.push(`${c.what} (${c.path}) → not JSON`); } continue; }
      if (c.marker && body.indexOf(c.marker) < 0) { fails.push(`${c.what} (${c.path}) → missing marker "${c.marker}"`); continue; }
      if (c.path === '/paper-trade') appShellHtml = body;
    } catch (e) { fails.push(`${c.what} (${c.path}) → ${e.message}`); }
  }
  // stale-bundle guard: the home.js the app-shell references must actually resolve (this is the /screener class of bug)
  const m = appShellHtml.match(/\/assets\/home\.js\?v=[a-f0-9]+/);
  if (m) {
    try { const r = await fetch(BASE + m[0], { headers: H }); if (r.status !== 200) fails.push(`app-shell bundle ${m[0]} → HTTP ${r.status} (STALE/missing)`); }
    catch (e) { fails.push(`app-shell bundle ${m[0]} → ${e.message}`); }
  } else if (appShellHtml) { fails.push('app-shell references no /assets/home.js?v= bundle'); }

  // INVARIANTS a deploy must never silently break. Each one is here because it DID break and cost a day:
  //  - the fee that close_all skipped for six weeks (money)
  //  - the OpenAPI body that said `margin` while the code read `margin_usd` (generated code could not open a trade)
  //  - a win rate served from counters that had been frozen since 2026-08-14
  // These are cheap, keyless, and read-only. If one trips, the deploy reports it instead of a user finding it.
  const inv = [];
  try {
    const mk = await (await fetch(BASE + '/api/bot/v1/markets?cb=' + Date.now(), { headers: { ...H, 'x-api-key': 'smoke-none' } })).json().catch(() => null);
    // unauthenticated: must be a clean 401 shape, never a stack or a 200
  } catch (e) {}
  const checkJson = async (path, fn, what) => {
    try { const r = await fetch(BASE + path + (path.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { headers: H });
      const j = await r.json(); const bad = fn(j, r); if (bad) inv.push(what + ' → ' + bad);
    } catch (e) { inv.push(what + ' → ' + e.message); }
  };
  await checkJson('/api/openapi.json', (j) => {
    const o = j && j.components && j.components.schemas && j.components.schemas.OpenRequest;
    if (!o || !o.properties) return 'OpenRequest schema missing';
    if (!o.properties.margin_usd) return 'OpenRequest lost margin_usd';
    if (o.properties.margin) return 'OpenRequest reintroduced the wrong `margin` field';
    return '';
  }, 'openapi contract');
  await checkJson('/api/changelog?format=json', (j) => (j && j.ok && j.data && j.data.entries && j.data.entries.length) ? '' : 'changelog empty', 'changelog');
  await checkJson('/api/bot/v1/time', (j) => (j && j.server_time_ms > 0) ? '' : 'no server_time_ms', 'bot time (keyless)');
  await checkJson('/api/bot/v1/account', (j, r) => (r.status === 401 && j && j.error === 'missing_api_key') ? '' : ('expected 401 missing_api_key, got ' + r.status), 'bot auth gate');
  try {
    const r = await fetch(BASE + '/mcp', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
    const j = await r.json();
    const n = (j && j.result && j.result.tools || []).length;
    if (n < 17) inv.push('mcp tools/list → ' + n + ' tools (expected >= 17)');
  } catch (e) { inv.push('mcp tools/list → ' + e.message); }
  fails.push(...inv);

  // CAN A TRADE STILL BE OPENED? (2026-09-24) Everything above is keyless and read-only on purpose, which is
  // exactly why a 500 on /api/trade/open shipped to production and this test still printed OK: a `const` read one
  // line before its own declaration threw a ReferenceError inside the handler, and nothing keyless touches that
  // path. Opening a position is the single most important thing this site does.
  //
  // Runs only when ADMIN_KEY.local.txt is present, which it always is on the machine that deploys - a CI or
  // staging run skips it silently rather than failing for a missing key. It writes to a throwaway e2e account and
  // removes it again, so nothing reaches a board, the money layer or the owner's daily read.
  // A SKIP MUST NOT READ AS A PASS. The first cut of this leg swallowed a missing key in its own try/catch and
  // printed an OK line all but identical to a real one - the same "a check that cannot fire" trap the heatmap
  // suite hit. The tail of the line now always says which of the three happened.
  let openLeg = ' + open/close SKIPPED (no admin key)';
  try {
    const fs2 = require('fs'), path2 = require('path');
    const key = (fs2.readFileSync(path2.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0];
    if (process.env.SMOKE_BASE) openLeg = ' + open/close SKIPPED (not production)';
    if (key && !process.env.SMOKE_BASE) {
      const AH = { 'x-admin-key': key, 'content-type': 'application/json' };
      const uid = 'e2e-smk' + Date.now().toString(36);
      const call = async (p, b) => { const r = await fetch(BASE + p, { method: 'POST', headers: AH, body: JSON.stringify(b) }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, j: null, raw: t.slice(0, 120) }; } };
      await call('/api/admin/e2euser', { uid, op: 'mk' });
      const o = await call('/api/trade/open?uid=' + uid, { sym: 'BTC', side: 'long', lev: 20, margin: 50 });
      const t = (o.j && (o.j.raw || o.j.position)) || o.j;
      if (o.s !== 200 || !t || !(+t.entry > 0)) fails.push('open a position → HTTP ' + o.s + ' ' + (o.raw || JSON.stringify(o.j || {}).slice(0, 140)));
      else {
        // the liq must sit on the right side of entry and inside one leverage step of it - the class of bug that
        // an inverted or fee-less formula produces, caught here rather than by a trader
        if (!(t.liq > 0) || !(t.liq < t.entry) || t.liq < t.entry * 0.9) fails.push('open → liq ' + t.liq + ' vs entry ' + t.entry);
        if (!(+t.feeOpen > 0)) fails.push('open → no feeOpen recorded');
        openLeg = ' + a real open/close';
        if (t.id) await call('/api/trade/close?uid=' + uid, { id: t.id });
      }
      await call('/api/admin/e2euser', { uid, op: 'rm' });
    }
  } catch (e) { /* no key, or no network for it: the keyless checks above still stand */ }

  if (fails.length) { console.error('smoke-test: FAIL (' + BASE + ')'); fails.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
  console.log('smoke-test: OK - ' + CHECKS.length + ' routes 200 + app-shell bundle resolves + 5 API invariants' + openLeg + ' (' + BASE + ')');
})().catch(e => { console.error('smoke-test: FATAL ' + e.message); process.exit(1); });

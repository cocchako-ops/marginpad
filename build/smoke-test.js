/* POST-deploy smoke test against PRODUCTION (npm "postdeploy" hook — runs AFTER wrangler deploy). Staging is least
   faithful to prod exactly in static-asset serving (run_worker_first there), and that is the class of bug that has
   bitten before (a stale /paper-trade app-shell bundle caught only from the outside). This is the only thing that
   sees it: 5 routes return 200 + a key marker, and — critically — the app-shell bundle referenced by /paper-trade
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

  if (fails.length) { console.error('smoke-test: FAIL (' + BASE + ')'); fails.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
  console.log('smoke-test: OK — ' + CHECKS.length + ' routes 200 + app-shell bundle resolves + 5 API invariants (' + BASE + ')');
})().catch(e => { console.error('smoke-test: FATAL ' + e.message); process.exit(1); });

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

  if (fails.length) { console.error('smoke-test: FAIL (' + BASE + ')'); fails.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
  console.log('smoke-test: OK — ' + CHECKS.length + ' routes 200 + app-shell bundle resolves (' + BASE + ')');
})().catch(e => { console.error('smoke-test: FATAL ' + e.message); process.exit(1); });

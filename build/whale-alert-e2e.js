// whale-alert-e2e.js - following a Hyperliquid wallet (Premium) (2026-10-28).
//
// Usage:
//   node build/whale-alert-e2e.js          # the callsign mirror + the live route + the cron
//   node build/whale-alert-e2e.js --pure   # only the offline half - runnable before a deploy
//
// TWO HALVES, AND THE FIRST ONE IS LOAD-BEARING FOR A REASON THAT IS NOT OBVIOUS. A wallet is presented to
// the reader as a PERSON - a callsign derived from the address - and the Telegram line the cron sends has
// to name the same person. The page's rule lives in build/hl-page.src.html and the server's mirror lives
// in src/worker.js, two files that cannot import from each other, so this lifts BOTH out of the shipped
// sources and requires them to agree over a few hundred addresses. A drift here does not break anything
// that a browser could show: it simply tells a member that "Iron Otter 44" moved when the board in front
// of them calls that wallet something else.
//
// The second half walks the route with a real throwaway member. The REFUSALS are the feature: the bell is
// drawn on every profile on purpose, so the server is what has to say no - and switching a bell OFF must
// never need Premium, or a lapsed member keeps an alert they cannot put out.
const fs = require('fs');
const path = require('path');
const BASE = 'https://marginpad.io';
const PURE_ONLY = process.argv.includes('--pure');
// --falsify drifts ONE word of the server's list, which is exactly the failure this half exists to catch
// (the alert naming a wallet something the board never called it). It must turn the agreement checks red.
const FALSIFY = process.argv.includes('--falsify');
const ADMIN = (() => { try { return (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail != null ? '  -> ' + detail : '')); }
};

function sliceFn(src, needle) {
  const i = src.indexOf(needle);
  if (i < 0) return null;
  const open = src.indexOf('{', i + needle.length - 1);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) return src.slice(i, j + 1); }
  }
  return null;
}
const W = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const G = fs.readFileSync(path.join(__dirname, 'hl-page.src.html'), 'utf8');

console.log('whale-alert-e2e' + (PURE_ONLY ? ' (pure only)' : '') + '\n');

// ---- the wiring exists at all -------------------------------------------------------------------------
console.log('the route, the index and the cron are wired:');
const maxSrc = (W.match(/const WHALE_WATCH_MAX = \d+;/) || [])[0];
const dedSrc = (W.match(/const WHALE_ALERT_DEDUPE_H = \d+;/) || [])[0];
ok('the ceiling and the dedupe window are constants, not literals', !!maxSrc && !!dedSrc, (maxSrc || '-') + ' ' + (dedSrc || '-'));
ok("the member route exists (/api/alerts/whale)", W.indexOf("if (sub === '/whale')") >= 0);
ok('the uprefs row IS the index the cron walks', W.indexOf("if (path === '/whalealertwatch')") >= 0);
ok('and the store skips a row with nowhere to send it', /if \(!u\.tg_chat && !push\) continue;/.test(W));
ok('the cron pass is registered on the */10 trigger', /bg\(checkWhaleFollow, 'whalefollow'\)/.test(W));
ok('and it can be run by hand from the ops desk', /whalefollow: checkWhaleFollow/.test(W));
ok('it stamps every pass, so "nobody followed anybody" never reads as "it never ran"', /whalealert:last/.test(W));
// checkWhaleAlerts is the 2026-08 Coinglass-gated function that still sits in the worker doing nothing. The
// follow pass had to be named something else; if that ever changes back, esbuild refuses the whole deploy.
ok('the pass is NOT named checkWhaleAlerts (that symbol is taken)', W.indexOf('async function checkWhaleFollow(') >= 0 && W.indexOf('async function checkWhaleAlerts(') >= 0);
ok('the whole pass reads ONE edge-cached feed whatever the number of watchers', /handleCgHyper/.test(sliceFn(W, 'async function checkWhaleFollow(') || ''), 'the cron must not fetch per watcher');

// ---- the callsign, from both shipped sources ----------------------------------------------------------
console.log('\nthe callsign the page shows and the callsign the alert names:');
const srvHash = sliceFn(W, 'function whHash(');
const srvName = sliceFn(W, 'function whaleName(');
let srvA = (W.match(/const WH_A_S = \[[^\]]*\];/) || [])[0];
if (FALSIFY && srvA) srvA = srvA.replace("'Iron'", "'Rusted'");
const srvN = (W.match(/const WH_N_S = \[[^\]]*\];/) || [])[0];
const cliHash = sliceFn(G, 'function wHash(');
const cliName = sliceFn(G, 'function whoName(');
const cliA = (G.match(/var WH_A=\[[^\]]*\];/) || [])[0];
const cliN = (G.match(/var WH_N=\[[^\]]*\];/) || [])[0];
ok('the server rule was found in src/worker.js', !!srvHash && !!srvName && !!srvA && !!srvN);
ok("the page's own rule was found in build/hl-page.src.html", !!cliHash && !!cliName && !!cliA && !!cliN);
if (srvHash && srvName && srvA && srvN && cliHash && cliName && cliA && cliN) {
  const srv = new Function([srvA, srvN, srvHash, srvName, 'return { name: whaleName, A: WH_A_S, N: WH_N_S };'].join('\n'))();
  const cli = new Function([cliA, cliN, cliHash, cliName, 'return { name: whoName, A: WH_A, N: WH_N };'].join('\n'))();
  ok('both word lists are the same length', srv.A.length === cli.A.length && srv.N.length === cli.N.length, srv.A.length + '/' + cli.A.length + ' ' + srv.N.length + '/' + cli.N.length);
  ok('and hold the same words in the same order', srv.A.join('|') === cli.A.join('|') && srv.N.join('|') === cli.N.join('|'));
  // 48 x 48 x 90 = 207,360 names, so a collision inside one board of 120 rows is unlikely rather than
  // impossible - the real address is printed beside every callsign for exactly that reason.
  ok('the space is big enough to read as an identity', srv.A.length * srv.N.length * 90 >= 100000, String(srv.A.length * srv.N.length * 90));
  const addr = (i) => '0x' + (i * 2654435761 >>> 0).toString(16).padStart(8, '0').repeat(5);
  let same = 0, n = 500, names = new Set();
  for (let i = 0; i < n; i++) { const a = addr(i); const s = srv.name(a), c = cli.name(a); if (s === c) same++; names.add(s); }
  ok('the two agree on every one of 500 addresses', same === n, same + ' of ' + n);
  ok('and the rule is a derivation, not a counter - mixed case is the same wallet', srv.name('0xABCDEF0123456789abcdef0123456789ABCDEF01') === srv.name('0xabcdef0123456789abcdef0123456789abcdef01'));
  ok('different wallets get different names (spread over 500)', names.size >= 450, String(names.size));
  const one = srv.name('0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00');
  ok('a name reads as a person: two words and a number', /^[A-Z][a-z]+ [A-Z][a-z]+ \d\d$/.test(one), one);
}

if (PURE_ONLY) {
  console.log('\nwhale-alert-e2e: ' + pass + ' passed, ' + fail + ' failed (pure half only)');
  process.exitCode = fail ? 1 : 0;
  return;
}

// ---- the live route ------------------------------------------------------------------------------------
const A1 = '0x1111111111111111111111111111111111111111';
(async () => {
  console.log('\nthe route, against production:');
  const g = await fetch(BASE + '/api/alerts/whale').then((r) => r.status).catch(() => 0);
  ok('a signed-out caller is refused', g === 401, 'status ' + g);
  const gp = await fetch(BASE + '/api/alerts/whale', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ addr: A1, on: true }) }).then((r) => r.status).catch(() => 0);
  ok('and cannot switch a bell on', gp === 401, 'status ' + gp);

  if (!ADMIN) { console.log('  skip the member half (no ADMIN_KEY.local.txt)'); }
  else {
    // The store names the account `e2e_<uid>`, and a username is ten characters since 2026-10-28 - so the uid
    // is SIX, or the fixture is a name the product itself would refuse.
    const uid = 'e2e' + Math.random().toString(36).slice(2, 5);
    const uname = 'e2e_' + uid;
    const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };
    const po = (p, b) => fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json().catch(() => ({}))).catch(() => ({}));
    const ga = (p) => fetch(BASE + p, { headers: H }).then((r) => r.json().catch(() => ({}))).catch(() => ({}));
    await po('/api/admin/e2euser', { uid, op: 'mk' });
    const se = await po('/api/admin/e2euser', { uid, op: 'sess' });
    const tok = se && se.token;
    ok('a throwaway member session was minted', !!tok, JSON.stringify(se).slice(0, 160));
    const CK = tok ? { cookie: 'mp_sess=' + tok, 'content-type': 'application/json' } : null;
    const put = (hdr, body) => fetch(BASE + '/api/alerts/whale', { method: 'POST', headers: hdr, body: JSON.stringify(body) });
    if (CK) {
      const rd = await fetch(BASE + '/api/alerts/whale', { headers: CK }).then((r) => r.json()).catch(() => null);
      ok('an ordinary member can READ the state - the profile has to know whether its bell is lit', !!(rd && rd.ok), JSON.stringify(rd).slice(0, 180));
      ok('and is told they are not Premium', rd && rd.premium === false, JSON.stringify(rd && rd.premium));
      ok('the ceiling comes with it, so the page never has its own copy of it', rd && rd.max >= 1, JSON.stringify(rd && rd.max));
      ok('nobody is followed yet', !!(rd && Array.isArray(rd.addrs) && !rd.addrs.length), JSON.stringify(rd && rd.addrs));
      // EVERY FREE CHECK RUNS BEFORE THE PAID ONE (the /squad/create rule): a member whose real problem is a
      // mistyped address must not be sent away to buy Premium.
      const bad = await put(CK, { addr: 'not-an-address', on: true });
      const badj = await bad.json().catch(() => ({}));
      ok('a bad address is refused as a bad address, not as a paywall', bad.status === 400 && badj.error === 'bad_address', 'status ' + bad.status + ' ' + JSON.stringify(badj).slice(0, 120));
      const w = await put(CK, { addr: A1, on: true });
      const wj = await w.json().catch(() => ({}));
      ok('an ordinary member CANNOT switch a bell on', w.status === 402 && wj.error === 'premium_required', 'status ' + w.status + ' ' + JSON.stringify(wj).slice(0, 120));
      ok('and the refusal points somewhere', /premium/i.test(JSON.stringify(wj)), JSON.stringify(wj).slice(0, 160));
      const w0 = await put(CK, { addr: A1, on: false });
      ok('but switching one OFF is never the paid action', w0.status === 200, 'status ' + w0.status);
      const after = await fetch(BASE + '/api/alerts/whale', { headers: CK }).then((r) => r.json()).catch(() => null);
      ok('and the refused bell was never saved', !!(after && !(after.addrs || []).length), JSON.stringify(after && after.addrs));
    }
    // GRANT PREMIUM, THEN MINT A NEW SESSION: the grant revokes every session the member holds.
    const gr = await ga('/api/admin/premium?add=' + encodeURIComponent(uname) + '&days=1');
    const se2 = await po('/api/admin/e2euser', { uid, op: 'sess' });
    const tok2 = se2 && se2.token;
    ok('Premium was granted and a fresh session minted', !!tok2 && !(gr && gr.error), JSON.stringify(gr).slice(0, 140));
    if (tok2) {
      const CK2 = { cookie: 'mp_sess=' + tok2, 'content-type': 'application/json' };
      const rd2 = await fetch(BASE + '/api/alerts/whale', { headers: CK2 }).then((r) => r.json()).catch(() => null);
      ok('the member now reads as Premium', !!(rd2 && rd2.premium === true), JSON.stringify(rd2 && rd2.premium));
      const on = await put(CK2, { addr: A1, on: true });
      const onj = await on.json().catch(() => ({}));
      ok('a Premium member can follow a wallet', on.status === 200 && (onj.addrs || []).indexOf(A1) >= 0, 'status ' + on.status + ' ' + JSON.stringify(onj).slice(0, 140));
      const back = await fetch(BASE + '/api/alerts/whale', { headers: CK2 }).then((r) => r.json()).catch(() => null);
      ok('and it reads back on the next open', !!(back && (back.addrs || []).indexOf(A1) >= 0), JSON.stringify(back && back.addrs));
      const twice = await put(CK2, { addr: A1.toUpperCase().replace('0X', '0x'), on: true }).then((r) => r.json()).catch(() => ({}));
      ok('following the same wallet twice follows it once', (twice.addrs || []).filter((x) => x === A1).length === 1, JSON.stringify(twice.addrs));
      // THE CEILING: the cron asks the exchange nothing per wallet (it reads one feed), but a watch list is
      // a row in the index and the member has to be told where the end is.
      const max = (back && back.max) || 10;
      let lastStatus = 200, lastBody = {};
      for (let i = 2; i <= max + 1; i++) {
        // 'ab' in every pair so no generated address can collide with A1 - '11' repeated twenty times IS A1,
        // which the first cut of this loop walked straight into and read as the ceiling failing to hold.
        const a = '0x' + (i.toString(16).padStart(2, '0') + 'ab').repeat(10);
        const r = await put(CK2, { addr: a, on: true });
        lastStatus = r.status; lastBody = await r.json().catch(() => ({}));
      }
      ok('the ' + (max + 1) + 'th wallet is refused, naming the ceiling', lastStatus === 409 && lastBody.error === 'too_many' && lastBody.max === max, 'status ' + lastStatus + ' ' + JSON.stringify(lastBody).slice(0, 120));
      const off = await put(CK2, { addr: A1, on: false }).then((r) => r.json()).catch(() => ({}));
      ok('switching one off leaves the others alone', (off.addrs || []).indexOf(A1) < 0 && (off.addrs || []).length === max - 1, JSON.stringify((off.addrs || []).length));
    }
    await ga('/api/admin/premium?remove=' + encodeURIComponent(uname));   // off the owner's roster again
    // The cron: cookie-only. It must answer even with nothing to send - and `uprefs` is in the store's own
    // BY_USER sweep, so removing the member below also takes their watch row out of the index.
    const os = await fetch(BASE + '/api/stats/session', { method: 'POST', headers: H }).then((r) => r.json()).catch(() => null);
    const cr = os && os.token ? await fetch(BASE + '/api/admin/runcron?task=whalefollow', { headers: { cookie: 'mp_sadm=' + os.token } }).then((r) => r.json()).catch(() => null) : null;
    ok('the cron task is registered and runs', !!cr && cr.ok === true && !cr.error, JSON.stringify(cr).slice(0, 220));
    await po('/api/admin/e2euser', { uid, op: 'rm' });
    const gone = await po('/api/admin/e2euser', { uid, op: 'sess' });
    void gone;
  }

  console.log('\nwhale-alert-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();

// zone-alert-e2e.js - the heatmap's Premium zone alerts (2026-10-09).
//
// Usage:
//   node build/zone-alert-e2e.js          # everything: the pure decision + the live API + the cron
//   node build/zone-alert-e2e.js --pure   # only the decision function, offline - runnable before a deploy
//
// TWO HALVES, AND THE FIRST ONE IS THE LOAD-BEARING ONE. The decision - which band fires, when, and once -
// is a pure function in the worker, so this lifts `zoneAlertHits` OUT OF THE SHIPPED SOURCE and runs it
// against bands built to contain the thing being asserted. That is the only way to test "a band the price
// has already gone through must never read as approaching", because it never happens to be true at the
// moment a browser looks. (The ai-brief-e2e pattern.)
//
// The second half walks the route with a real throwaway member: a guest is refused, an ordinary member is
// refused with the Premium offer, a member WITH Premium and no Telegram is refused with somewhere to go,
// and one with a chat saves and reads back. The refusals are the point - the page shows the bell to
// everybody on purpose, so the switch is what has to say no.
const fs = require('fs');
const path = require('path');
const BASE = 'https://marginpad.io';
const PURE_ONLY = process.argv.includes('--pure');
const ADMIN = (() => { try { return (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail != null ? '  -> ' + detail : '')); }
};

// ---- lift the real functions out of the shipped worker -------------------------------------------------
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
const cfgSrc = sliceFn(W, 'function zoneAlertCfg(');
const hitSrc = sliceFn(W, 'function zoneAlertHits(');
const txtSrc = sliceFn(W, 'function zoneAlertText(');
const defSrc = (W.match(/const ZONEALERT_DEF = \{[^}]*\};/) || [])[0];
const maxSrc = (W.match(/const ZONE_ALERT_MAX_COINS = \d+;/) || [])[0];
const minWSrc = (W.match(/const ZONE_ALERT_MIN_W = \d+;/) || [])[0];
const coinsSrc = 'const ZONE_ALERT_COINS = ' + JSON.stringify(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LINK', 'AVAX', 'LTC']) + ';';

console.log('zone-alert-e2e' + (PURE_ONLY ? ' (pure only)' : '') + '\n');
console.log('the decision function, lifted from src/worker.js:');
ok('zoneAlertCfg found in the worker', !!cfgSrc);
ok('zoneAlertHits found in the worker', !!hitSrc);
ok('zoneAlertText found in the worker', !!txtSrc);
ok('the defaults and the ceilings are declared as constants', !!defSrc && !!maxSrc && !!minWSrc);
if (!cfgSrc || !hitSrc || !txtSrc || !defSrc) {
  console.log('\ncannot continue without the real functions.');
  process.exitCode = 1;
  return;
}
// `_spx` is the worker's own price formatter; zoneAlertText uses it.
const _spxSrc = sliceFn(W, 'function _spx(');
const mod = new Function(
  [coinsSrc, defSrc, maxSrc, minWSrc, _spxSrc, cfgSrc, hitSrc, txtSrc,
    'return { zoneAlertCfg: zoneAlertCfg, zoneAlertHits: zoneAlertHits, zoneAlertText: zoneAlertText, ZONEALERT_DEF: ZONEALERT_DEF };'].join('\n')
)();
const { zoneAlertCfg, zoneAlertHits, zoneAlertText, ZONEALERT_DEF } = mod;

// ---- the config normaliser ----------------------------------------------------------------------------
console.log('\nthe config it will accept:');
{
  const d = zoneAlertCfg(null);
  ok('a missing config is off by default', d.on === 0, JSON.stringify(d));
  ok('and still names a coin, so the shape is always valid', (d.coins || []).length === 1, JSON.stringify(d.coins));
  const c = zoneAlertCfg({ on: 1, rel: 999, dist: 99, coins: ['btc', 'eth', 'sol', 'xrp', 'NOPE', 'BTC'] });
  ok('the multiple is clamped, never trusted', c.rel <= 50 && c.rel >= 1, 'rel=' + c.rel);
  ok('the distance is clamped', c.dist <= 5 && c.dist > 0, 'dist=' + c.dist);
  ok('a coin with no model is dropped', c.coins.indexOf('NOPE') < 0, JSON.stringify(c.coins));
  ok('a repeated coin is counted once', c.coins.filter((x) => x === 'BTC').length === 1, JSON.stringify(c.coins));
  ok('and the coin count is capped, so the cron stays cheap', c.coins.length <= 3, JSON.stringify(c.coins));
  ok('the swept half is on unless it is switched off', zoneAlertCfg({ on: 1 }).swept === 1);
  ok('and off when it is', zoneAlertCfg({ on: 1, swept: 0 }).swept === 0);
}

// ---- the decision -------------------------------------------------------------------------------------
// A model with one heavy band just ABOVE the price (where shorts die), one heavy band just BELOW (longs),
// one heavy band far away, and a crowd of ordinary ones to set the average.
const LIVE = 82000;
function model(opts) {
  opts = opts || {};
  const alive = [];
  // forty ordinary bands at $1M each, which is what sets the average the ratio is measured against
  for (let i = 0; i < 40; i++) alive.push({ p: LIVE * (1 + (i - 20) * 0.004), w: 1e6, long: i < 20 });
  alive.push({ p: opts.nearShortPx == null ? LIVE * 1.005 : opts.nearShortPx, w: 9e6, long: false });  // above price: shorts die there
  alive.push({ p: opts.nearLongPx == null ? LIVE * 0.997 : opts.nearLongPx, w: 8e6, long: true });     // below price: longs die there, and nearer
  alive.push({ p: LIVE * 1.4, w: 4e7, long: false });                                                  // far away, the heaviest in the whole model
  return { alive };
}
console.log('\nwhat fires, and what must not:');
{
  const cfg = zoneAlertCfg({ on: 1, rel: 3, dist: 0.6, coins: ['BTC'] });
  const hits = zoneAlertHits(cfg, 'BTC', model(), [], LIVE);
  const near = hits.filter((h) => h.t === 'near');
  const lng = near.filter((h) => h.long)[0], sht = near.filter((h) => !h.long)[0];
  ok('a heavy band inside the distance fires', near.length > 0, JSON.stringify(hits));
  ok('the band BELOW the price fires, where longs die', !!lng && Math.abs(lng.price - LIVE * 0.997) < 1e-6, lng && String(lng.price));
  ok('and the one ABOVE it, where shorts die - a squeeze is not one of them', !!sht && Math.abs(sht.price - LIVE * 1.005) < 1e-6, sht && String(sht.price));
  ok('but never more than one per side', near.filter((h) => h.long).length === 1 && near.filter((h) => !h.long).length === 1, 'long=' + near.filter((h) => h.long).length + ' short=' + near.filter((h) => !h.long).length);
  ok('the band far outside the distance never fires', !hits.some((h) => Math.abs(h.price - LIVE * 1.4) < 1e-6), JSON.stringify(hits.map((h) => h.price)));
  ok('the ratio it reports is against the average standing band', !!lng && lng.rel > 3 && lng.rel < 12, lng && String(lng.rel));
  ok('and the message says how many are in range on that side', !!lng && lng.n >= 1, lng && String(lng.n));
}
{
  // THE LOAD-BEARING CHECK. A band the price has already traded through is spent - the client calls this
  // poolGone() and greys it out. Telling somebody price is "approaching" a level it is already past is the
  // one thing this feature must never do, and it is never true at the moment a browser happens to look.
  const m = model({ nearLongPx: LIVE * 1.004, nearShortPx: LIVE * 0.996 }); // long band ABOVE price, short band BELOW: both already crossed
  const hits = zoneAlertHits(zoneAlertCfg({ on: 1, rel: 3, dist: 1, coins: ['BTC'] }), 'BTC', m, [], LIVE);
  ok('a band the price has already gone through NEVER fires', hits.filter((h) => h.t === 'near').length === 0, JSON.stringify(hits));
}
{
  const m = model();
  ok('a switched-off alert fires nothing', zoneAlertHits(zoneAlertCfg({ on: 0, coins: ['BTC'] }), 'BTC', m, [], LIVE).length === 0);
  ok('no live price means no decision', zoneAlertHits(zoneAlertCfg({ on: 1, coins: ['BTC'] }), 'BTC', m, [], 0).length === 0);
  ok('an empty model fires nothing', zoneAlertHits(zoneAlertCfg({ on: 1, coins: ['BTC'] }), 'BTC', { alive: [] }, [], LIVE).length === 0);
  const high = zoneAlertHits(zoneAlertCfg({ on: 1, rel: 20, dist: 1, coins: ['BTC'] }), 'BTC', m, [], LIVE);
  ok('a threshold above every nearby band fires nothing', high.filter((h) => h.t === 'near').length === 0, JSON.stringify(high));
}
{
  // The swept half: the ring the cron reads carries {t, p, w, long}.
  const m = model();
  const fresh = [{ t: Date.now() - 60000, p: LIVE * 0.998, w: 9e6, long: 1 }];
  const old = [{ t: Date.now() - 3 * 3600000, p: LIVE * 0.998, w: 9e6, long: 1 }];
  // Under ZONE_ALERT_MIN_W, the weight the sweep ring itself logs at - below it a sweep is noise.
  const small = [{ t: Date.now() - 60000, p: LIVE * 0.998, w: 400000, long: 1 }];
  const cfg = zoneAlertCfg({ on: 1, rel: 3, dist: 0.6, coins: ['BTC'] });
  ok('a fresh sweep of a heavy band fires', zoneAlertHits(cfg, 'BTC', m, fresh, LIVE).some((h) => h.t === 'swept'));
  ok('a sweep from three hours ago does not', !zoneAlertHits(cfg, 'BTC', m, old, LIVE).some((h) => h.t === 'swept'));
  ok('a sweep under the logging floor does not', !zoneAlertHits(cfg, 'BTC', m, small, LIVE).some((h) => h.t === 'swept'));
  ok('and with the swept half off, nothing', !zoneAlertHits(zoneAlertCfg({ on: 1, rel: 3, dist: 0.6, coins: ['BTC'], swept: 0 }), 'BTC', m, fresh, LIVE).some((h) => h.t === 'swept'));
  ok('one sweep per coin per run, never a feed', zoneAlertHits(cfg, 'BTC', m, fresh.concat([{ t: Date.now() - 30000, p: LIVE * 0.999, w: 9e6, long: 1 }]), LIVE).filter((h) => h.t === 'swept').length === 1);
}
{
  // The dedupe key is what stops a price hovering on a level from becoming a siren.
  const m = model();
  const cfg = zoneAlertCfg({ on: 1, rel: 3, dist: 0.6, coins: ['BTC'] });
  const lk = (hs) => (hs.filter((h) => h.t === 'near' && h.long)[0] || {}).k;
  const a = lk(zoneAlertHits(cfg, 'BTC', m, [], LIVE));
  const b = lk(zoneAlertHits(cfg, 'BTC', m, [], LIVE * 1.00005));  // a tick of drift
  ok('the same zone keeps the same dedupe key through a tick of drift', !!a && a === b, a + ' vs ' + b);
  const c = lk(zoneAlertHits(cfg, 'BTC', model({ nearLongPx: LIVE * 0.9945 }), [], LIVE));
  ok('a different zone gets a different key', !!a && !!c && a !== c, a + ' vs ' + c);
}
console.log('\nwhat the message says:');
{
  const h = zoneAlertHits(zoneAlertCfg({ on: 1, rel: 3, dist: 0.6, coins: ['BTC'] }), 'BTC', model(), [], LIVE).filter((x) => x.long)[0];
  const t = zoneAlertText(h);
  ok('it names the coin', /BTC/.test(t), t.slice(0, 120));
  ok('and the price of the zone', t.indexOf('$81,754') >= 0, t.slice(0, 160));
  ok('it says how far away the level is', /%/.test(t));
  ok('IT SAYS THE ZONE IS AN ESTIMATE', /estimate/i.test(t), t.slice(0, 400));
  // THE RULE THE WHOLE MODEL RESTS ON: the band's weight is a MULTIPLE and never a dollar figure. Open
  // interest was tried as a way to turn it into money and overstated an average BTC band by about thirty
  // times, so the only dollar amount allowed in this message is the PRICE of the level.
  ok('the weight is stated as a multiple', /\dx<\/b>/.test(t) || /\d(\.\d)?x/.test(t), t.slice(0, 300));
  ok('and there is exactly ONE dollar figure in it - the price', (t.match(/\$[\d,]+/g) || []).length === 1, JSON.stringify(t.match(/\$[\d,]+/g)));
  ok('it links the map', /marginpad\.io\/heatmap\?coin=BTC/.test(t));
  ok('no emoji anywhere in it', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t), t.slice(0, 200));
  const sw = zoneAlertText({ t: 'swept', sym: 'ETH', price: 2478.17, rel: 6.2, long: true, at: Date.now() });
  ok('the swept message is a different sentence', /taken out/i.test(sw), sw.slice(0, 120));
  ok('and it too says the zone was an estimate', /estimate/i.test(sw), sw.slice(0, 400));
  ok('no emoji in that one either', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(sw));
}

if (PURE_ONLY) {
  console.log('\nzone-alert-e2e: ' + pass + ' passed, ' + fail + ' failed (pure half only)');
  process.exitCode = fail ? 1 : 0;
  return;
}

// ---- the live route ------------------------------------------------------------------------------------
(async () => {
  console.log('\nthe route, against production:');
  const g = await fetch(BASE + '/api/alerts/zonealert').then((r) => r.status).catch(() => 0);
  ok('a signed-out caller is refused', g === 401, 'status ' + g);
  const gp = await fetch(BASE + '/api/alerts/zonealert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: 1, coins: ['BTC'] }) }).then((r) => r.status).catch(() => 0);
  ok('and cannot save one', gp === 401, 'status ' + gp);

  if (!ADMIN) { console.log('  skip the member half (no ADMIN_KEY.local.txt)'); }
  else {
    const uid = 'e2ezal' + Math.random().toString(36).slice(2, 6);
    const uname = 'e2e_' + uid;
    const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };
    const po = (p, b) => fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json().catch(() => ({}))).catch(() => ({}));
    const ga = (p) => fetch(BASE + p, { headers: H }).then((r) => r.json().catch(() => ({}))).catch(() => ({}));
    await po('/api/admin/e2euser', { uid, op: 'mk' });
    const se = await po('/api/admin/e2euser', { uid, op: 'sess' });
    const tok = se && se.token;
    ok('a throwaway member session was minted', !!tok, JSON.stringify(se).slice(0, 160));
    if (tok) {
      const CK = { cookie: 'mp_sess=' + tok, 'content-type': 'application/json' };
      const rd = await fetch(BASE + '/api/alerts/zonealert', { headers: CK }).then((r) => r.json()).catch(() => null);
      ok('an ordinary member can READ the settings', !!(rd && rd.cfg), JSON.stringify(rd).slice(0, 180));
      ok('and is told they are not Premium', rd && rd.premium === false, JSON.stringify(rd && rd.premium));
      ok('the catalogue of coins comes with it', !!(rd && (rd.coins || []).length >= 10), JSON.stringify(rd && rd.coins));
      // THE REFUSAL IS THE FEATURE. The page shows the bell to everybody; the server is what says no.
      const w = await fetch(BASE + '/api/alerts/zonealert', { method: 'POST', headers: CK, body: JSON.stringify({ on: 1, coins: ['BTC'], rel: 4 }) });
      const wj = await w.json().catch(() => ({}));
      ok('an ordinary member CANNOT switch it on', w.status === 402, 'status ' + w.status + ' ' + JSON.stringify(wj).slice(0, 120));
      ok('and the refusal points at Premium', /premium/i.test(JSON.stringify(wj)), JSON.stringify(wj).slice(0, 160));
      // Switching OFF is never a Premium action - a lapsed member must be able to silence a bell they set.
      const w0 = await fetch(BASE + '/api/alerts/zonealert', { method: 'POST', headers: CK, body: JSON.stringify({ on: 0, coins: [] }) });
      ok('but switching it OFF needs neither Premium nor Telegram', w0.status === 200, 'status ' + w0.status);
    }
    // GRANT PREMIUM, THEN MINT A NEW SESSION: the grant revokes every session the member holds.
    const gr = await ga('/api/admin/premium?add=' + encodeURIComponent(uname) + '&days=1');
    const se2 = await po('/api/admin/e2euser', { uid, op: 'sess' });
    const tok2 = se2 && se2.token;
    ok('Premium was granted and a fresh session minted', !!tok2 && !(gr && gr.error), JSON.stringify(gr).slice(0, 120));
    if (tok2) {
      const CK2 = { cookie: 'mp_sess=' + tok2, 'content-type': 'application/json' };
      const rd2 = await fetch(BASE + '/api/alerts/zonealert', { headers: CK2 }).then((r) => r.json()).catch(() => null);
      ok('the member now reads as Premium', !!(rd2 && rd2.premium === true), JSON.stringify(rd2 && rd2.premium));
      // With no Telegram and no push the save must still refuse - an alert that is saved and has nowhere
      // to go is the worst outcome of the three.
      const w2 = await fetch(BASE + '/api/alerts/zonealert', { method: 'POST', headers: CK2, body: JSON.stringify({ on: 1, coins: ['BTC'], rel: 4 }) });
      const w2j = await w2.json().catch(() => ({}));
      ok('a Premium member with no chat and no push is refused, with a reason', w2.status === 400 && w2j.error === 'telegram_required', 'status ' + w2.status + ' ' + JSON.stringify(w2j).slice(0, 160));
      const w3 = await fetch(BASE + '/api/alerts/zonealert', { method: 'POST', headers: CK2, body: JSON.stringify({ on: 0, coins: [] }) });
      ok('and switching it off is always accepted', w3.status === 200, 'status ' + w3.status);
    }
    await ga('/api/admin/premium?remove=' + encodeURIComponent(uname));   // off the owner's roster again
    await po('/api/admin/e2euser', { uid, op: 'rm' });
    // The cron: cookie-only, so mint an ops session from the key. It must stamp even when nobody is opted
    // in, or "nobody opted in" reads as "it never ran".
    const os = await fetch(BASE + '/api/stats/session', { method: 'POST', headers: H }).then((r) => r.json()).catch(() => null);
    const cr = os && os.token ? await fetch(BASE + '/api/admin/runcron?task=zonealerts', { headers: { cookie: 'mp_sadm=' + os.token } }).then((r) => r.json()).catch(() => null) : null;
    ok('the cron task is registered and runs', !!cr && !cr.error, JSON.stringify(cr).slice(0, 200));
    const st = await ga('/api/admin/runcron?task=zonealerts');
    void st;
  }

  console.log('\nzone-alert-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();

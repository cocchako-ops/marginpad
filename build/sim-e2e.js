// sim-e2e.js - the configurable simulation profile (2026-10-10).
//
// WHY THIS SUITE EXISTS AND WHAT IS LOAD-BEARING IN IT:
//
//  1. THE DEFAULTS MUST BE THE ENGINE AS IT WAS. Nineteen new knobs are only safe to ship if an account that
//     has never touched them fills exactly as it did the day before: at the live price, at a flat 0.5%
//     maintenance margin, refused for nothing. That is the first thing checked and it is the check that makes
//     the whole change reversible in meaning rather than just in code.
//  2. OUT OF RANGE IS REFUSED, NOT CLAMPED. The 2026-09-12 rule: a bot that asked for 5000x used to get 1000x
//     and `ok:true`. A strategy must never be measured under a setting its author did not choose.
//  3. A LEGACY WRITE MUST NOT WIPE THE PROFILE. /v1/realism used to write a fresh three-field object; if that
//     ever comes back, flipping one old switch silently resets the book size, the fee and the latency.
//  4. v1 STAYS BYTE-FROZEN. The fill detail is on v2 and in headers, never added to a v1 body.
//
// Part A runs the PURE functions lifted out of the shipped `src/worker.js` - the real code, not a copy of it -
// with the random source injected, because a refusal rate and a fill ratio are deliberately random and a test
// has to be able to pin them. Part B drives production with a throwaway account.
//
// Usage: node build/sim-e2e.js            (full)
//        node build/sim-e2e.js --pure     (Part A only - no network, no account)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://marginpad.io';
const ADMIN = (() => { try { return (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d != null ? '  -> ' + d : '')); } };
const near = (a, b, tol) => Math.abs(+a - +b) <= tol;

// ───────────────────────────────────────────────────────────────── Part A: the real functions, extracted
// Brace-matched extraction, the check-formulas pattern: find the declaration, walk the braces, and EXECUTE
// what the worker actually ships. A test that re-implements the thing it is testing proves nothing.
function lift(src, names) {
  const out = [];
  for (const n of names) {
    let i = src.indexOf('\nfunction ' + n + '(');
    let kind = 'fn';
    if (i < 0) { i = src.indexOf('\nconst ' + n + ' = '); kind = 'const'; }
    if (i < 0) throw new Error('cannot find ' + n + ' in src/worker.js');
    i++;
    if (kind === 'fn') {
      const open = src.indexOf('{', i);
      let d = 0, j = open;
      for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) break; } }
      out.push(src.slice(i, j + 1));
    } else {
      // a const declaration ends at the first newline whose line does not continue the literal
      let d = 0, j = src.indexOf('=', i);
      for (; j < src.length; j++) { const c = src[j]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') d--; else if (c === ';' && d === 0) break; }
      out.push(src.slice(i, j + 1));
    }
  }
  return out.join('\n');
}
function partA() {
  console.log('PART A - the pure functions, lifted out of the shipped worker and executed\n');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
  const code = lift(src, ['MARGIN_VENUES', 'SIM_DEF', 'SIM_RANGE', 'SIM_BOOL', 'SIM_NULLABLE', 'marginVenueNorm', 'simNorm', 'simValidate', 'simGate', 'simSlipPct', 'diffSim', 'simApply', 'SIM_PRESETS', 'FEE_VENUES']);
  const mod = {};
  // slipFor needs assetClassOf; stub it the way the engine classifies, and prove the stub against the real
  // table rather than trusting it (BTC is a major, an unknown ticker is "other crypto").
  const prelude = 'const assetClassOf = (s) => /^(SPX500|NAS100|US30|GER40)$/.test(s) ? "index" : /^(EURUSD|GBPUSD)$/.test(s) ? "forex" : /^(XAU|XAG)$/.test(s) ? "metal" : /^(AAPL|NVDA|TSLA)$/.test(s) ? "stock" : "crypto";\n'
    + lift(src, ['SLIP_MAJORS', 'slipFor', 'feeRateFor']) + '\n';
  // eslint-disable-next-line no-new-func
  new Function('X', prelude + code + '\nX.simNorm=simNorm;X.simValidate=simValidate;X.simGate=simGate;X.simSlipPct=simSlipPct;X.simApply=simApply;X.SIM_DEF=SIM_DEF;X.SIM_RANGE=SIM_RANGE;X.SIM_PRESETS=SIM_PRESETS;X.slipFor=slipFor;')(mod);
  const { simNorm, simValidate, simGate, simSlipPct, simApply, SIM_DEF, SIM_RANGE, SIM_PRESETS } = mod;

  // ---- 1. THE DEFAULTS ARE THE ENGINE AS IT WAS
  console.log('the defaults are the old engine, field by field:');
  ok('start_balance_usd is 10000', SIM_DEF.start_balance_usd === 10000, SIM_DEF.start_balance_usd);
  ok('margin_enforced is OFF', SIM_DEF.margin_enforced === false);
  ok('slippage is OFF', SIM_DEF.slippage === false);
  ok('latency is 0', SIM_DEF.latency_ms === 0);
  ok('partial_fills is OFF', SIM_DEF.partial_fills === false);
  ok('reject_rate is 0', SIM_DEF.reject_rate_pct === 0);
  ok('margin_tiers is OFF', SIM_DEF.margin_tiers === false);
  ok('funding is ON (it always was)', SIM_DEF.funding === true);
  ok('with the defaults a fill has ZERO slippage', simSlipPct(SIM_DEF, 'BTC', 1e6) === 0);
  const g0 = simGate(SIM_DEF, { margin: 100000, lev: 100, rnd: () => 0 });
  ok('with the defaults nothing is refused and the fill is whole', !g0.error && g0.fillPct === 100 && g0.marginFilled === 100000, JSON.stringify(g0));
  ok('an empty / unreadable stored value IS the defaults', JSON.stringify(simNorm(null)) === JSON.stringify(SIM_DEF) && JSON.stringify(simNorm('not json')) === JSON.stringify(SIM_DEF));

  // ---- 2. THE LEGACY SHAPE CARRIES OVER WITH NO MIGRATION
  console.log('\nthe old three-switch shape reads as a profile, so no account needs migrating:');
  const legacy = simNorm({ slippage: true, margin_tiers: true, margin_venue: 'binance' });
  ok('slippage survives', legacy.slippage === true);
  ok('margin_tiers survives', legacy.margin_tiers === true);
  ok('margin_venue survives', legacy.margin_venue === 'binance');
  ok('and every new field is at its default', legacy.start_balance_usd === 10000 && legacy.latency_ms === 0 && legacy.margin_enforced === false);
  ok('an unknown venue in a STORED row degrades to MarginPad, never throws', simNorm({ margin_venue: 'nonesuch' }).margin_venue === '');

  // ---- 3. RANGES: enforced on the fill path, refused on the write path
  console.log('\nevery range is both enforced (stored rows) and refused (a developer typing):');
  for (const k of Object.keys(SIM_RANGE)) {
    const [lo, hi] = SIM_RANGE[k];
    const over = simNorm({ [k]: hi * 10 + 1 })[k];
    ok(k.padEnd(20) + ' a stored over-range value is clamped to ' + hi, over === hi, over);
    const bad = simValidate({ [k]: hi * 10 + 1 });
    ok(k.padEnd(20) + ' a WRITE of it is refused', bad.length === 1 && bad[0].field === k, JSON.stringify(bad));
    const good = simValidate({ [k]: lo });
    ok(k.padEnd(20) + ' the bottom of the range is accepted', good.length === 0, JSON.stringify(good));
  }
  ok('a field that is not a field is refused', (() => { const b = simValidate({ turbo_mode: true }); return b.length === 1 && b[0].field === 'turbo_mode'; })());
  ok('a non-numeric number is refused, not coerced', (() => { const b = simValidate({ latency_ms: 'soon' }); return b.length === 1; })());
  ok('an unknown margin_venue is refused on a write', (() => { const b = simValidate({ margin_venue: 'nonesuch' }); return b.length === 1 && b[0].field === 'margin_venue'; })());
  ok('preset and reset are not treated as unknown fields', simValidate({ preset: 'realistic', reset: true }).length === 0);
  ok('the three nullable fields accept null', (() => { const n = simNorm({ slippage_bps: null, taker_bps: null, mmr_pct: null }); return n.slippage_bps === null && n.taker_bps === null && n.mmr_pct === null; })());

  // ---- 4. THE CROSSING COST
  console.log('\nthe crossing cost: the measured table, your own figure, and size on top:');
  ok('off by default', simSlipPct(simNorm({}), 'BTC', 100000) === 0);
  ok('a major is 0.01% when switched on', near(simSlipPct(simNorm({ slippage: true }), 'BTC', 1000), 0.0001, 1e-12));
  ok('a thinner coin is 0.05%', near(simSlipPct(simNorm({ slippage: true }), 'SOMEALT', 1000), 0.0005, 1e-12));
  ok('your own 30 bps replaces the table', near(simSlipPct(simNorm({ slippage: true, slippage_bps: 30 }), 'BTC', 1000), 0.003, 1e-12));
  ok('setting slippage_bps alone does NOT switch slippage on in the stored profile', simNorm({ slippage_bps: 30 }).slippage === false);
  const impSmall = simSlipPct(simNorm({ slippage: true, slippage_bps: 10, impact_bps_per_100k: 20 }), 'BTC', 10000);
  const impBig = simSlipPct(simNorm({ slippage: true, slippage_bps: 10, impact_bps_per_100k: 20 }), 'BTC', 1000000);
  ok('size costs more: $1M pays more than $10k', impBig > impSmall, impBig + ' vs ' + impSmall);
  ok('and by exactly the declared amount (10bps + 20bps x 10)', near(impBig, 0.001 + 0.002 * 10, 1e-12), impBig);
  ok('the crossing cost is capped at 25% however absurd the input', simSlipPct(simNorm({ slippage: true, slippage_bps: 500, impact_bps_per_100k: 500 }), 'BTC', 1e9) === 0.25);

  // ---- 5. THE GATE, with the dice pinned
  console.log('\nthe gate - refusals and fill ratios, with the random source pinned:');
  ok('leverage over the profile ceiling is refused', simGate(simNorm({ leverage_max: 20 }), { margin: 10, lev: 50 }).error === 'leverage_over_profile');
  ok('exactly at the ceiling is allowed', !simGate(simNorm({ leverage_max: 20 }), { margin: 10, lev: 20, rnd: () => 0 }).error);
  ok('notional over the profile ceiling is refused', simGate(simNorm({ max_notional_usd: 1000 }), { margin: 200, lev: 10 }).error === 'notional_over_profile');
  ok('exactly at the notional ceiling is allowed', !simGate(simNorm({ max_notional_usd: 1000 }), { margin: 100, lev: 10, rnd: () => 0 }).error);
  ok('a 100% reject rate always refuses', simGate(simNorm({ reject_rate_pct: 50 }), { margin: 10, lev: 1, rnd: () => 0 }).error === 'venue_rejected');
  ok('a refusal says it is retryable', simGate(simNorm({ reject_rate_pct: 50 }), { margin: 10, lev: 1, rnd: () => 0 }).retryable === true);
  ok('the same rate with the dice the other way lets it through', !simGate(simNorm({ reject_rate_pct: 50 }), { margin: 10, lev: 1, rnd: () => 0.99 }).error);
  ok('reject_rate 0 can never refuse, whatever the dice', !simGate(simNorm({ reject_rate_pct: 0 }), { margin: 10, lev: 1, rnd: () => 0 }).error);
  const pWorst = simGate(simNorm({ partial_fills: true, min_fill_pct: 40 }), { margin: 1000, lev: 1, rnd: () => 0 });
  const pBest = simGate(simNorm({ partial_fills: true, min_fill_pct: 40 }), { margin: 1000, lev: 1, rnd: () => 0.9999999 });
  ok('the worst partial fill is exactly min_fill_pct', near(pWorst.fillPct, 40, 0.01) && near(pWorst.marginFilled, 400, 0.01), JSON.stringify(pWorst));
  ok('the best partial fill is the whole order', near(pBest.fillPct, 100, 0.01) && near(pBest.marginFilled, 1000, 0.01), JSON.stringify(pBest));
  ok('a partial fill is flagged as partial', pWorst.partial === true && pBest.partial === false);
  ok('min_fill_pct 100 means no partial even with partial_fills on', simGate(simNorm({ partial_fills: true, min_fill_pct: 100 }), { margin: 1000, lev: 1, rnd: () => 0 }).fillPct === 100);
  ok('a partial fill never drops below $1 of margin', simGate(simNorm({ partial_fills: true, min_fill_pct: 10 }), { margin: 1, lev: 1, rnd: () => 0 }).marginFilled >= 1);

  // ---- 6. PRESETS
  console.log('\nthe presets:');
  const PRE = SIM_PRESETS();
  const want = ['frictionless', 'realistic', 'binance', 'bybit', 'okx', 'hyperliquid', 'thin_book', 'brutal'];
  ok('all eight exist', want.every(k => PRE[k]), Object.keys(PRE).join(','));
  ok('every preset has a label and an explanation', want.every(k => PRE[k].label && PRE[k].about && PRE[k].about.length > 40));
  // THIS CHECK USED TO COMPARE SIM_DEF WITH ITSELF. frictionless carries an empty `sim`, so
  // `{...SIM_DEF, ...PRE.frictionless.sim}` IS SIM_DEF and the assertion was a tautology - it stayed green
  // with the defaults deliberately broken, which the falsification run caught. It states the VALUES now.
  ok('frictionless is a free, unconstrained fill - stated, not compared to itself', (() => {
    const p = simNorm({ ...SIM_DEF, ...PRE.frictionless.sim });
    return p.slippage === false && p.slippage_bps === null && p.impact_bps_per_100k === 0 && p.latency_ms === 0
      && p.partial_fills === false && p.reject_rate_pct === 0 && p.margin_enforced === false
      && p.margin_tiers === false && p.mmr_pct === null && p.taker_bps === null && p.start_balance_usd === 10000;
  })());
  ok('realistic enforces the book and costs something', (() => { const p = simNorm({ ...SIM_DEF, ...PRE.realistic.sim }); return p.margin_enforced && p.slippage && p.margin_tiers; })());
  ok('bybit quotes bybit’s own maintenance margin', simNorm({ ...SIM_DEF, ...PRE.bybit.sim }).margin_venue === 'bybit');
  // THE UNIT IS THE WHOLE POINT. This check used to assert taker_bps === 0.055 * 0.8 - the PERCENT - which
  // is exactly the mistake the builder was making, so it stayed green while every venue preset charged a
  // hundredth of the real fee. It asserts the EFFECTIVE PERCENT a fill is charged, which is unit-safe.
  ok('a venue preset charges that venue’s own published percent, in the right unit', (() => {
    const p = simNorm({ ...SIM_DEF, ...PRE.bybit.sim });
    return near(p.taker_bps / 100, 0.055 * (1 - 20 / 100), 1e-9) && near(mod.simNorm && p.taker_bps, 4.4, 1e-9);
  })(), 'taker_bps=' + simNorm({ ...SIM_DEF, ...PRE.bybit.sim }).taker_bps + ' => ' + (simNorm({ ...SIM_DEF, ...PRE.bybit.sim }).taker_bps / 100) + '%');
  ok('and every venue preset lands in a plausible fee band (1-10 bps), never a hundredth of one', ['binance', 'bybit', 'okx', 'hyperliquid'].every((k) => { const t = simNorm({ ...SIM_DEF, ...PRE[k].sim }).taker_bps; return t >= 1 && t <= 10; }), ['binance', 'bybit', 'okx', 'hyperliquid'].map((k) => k + '=' + simNorm({ ...SIM_DEF, ...PRE[k].sim }).taker_bps).join(' '));
  ok('brutal is genuinely hostile on every axis', (() => { const p = simNorm({ ...SIM_DEF, ...PRE.brutal.sim }); return p.slippage_bps >= 50 && p.reject_rate_pct > 0 && p.partial_fills && p.latency_ms >= 500 && p.margin_enforced && p.impact_bps_per_100k >= 100; })());
  ok('every preset survives a round trip through simNorm unchanged', want.every(k => { const a = simNorm({ ...SIM_DEF, ...PRE[k].sim }); return JSON.stringify(simNorm(a)) === JSON.stringify(a); }));

  // ---- 7. A WRITE MERGES; A PRESET IS A CLEAN SLATE
  console.log('\nhow a write composes:');
  const held = simNorm({ start_balance_usd: 2500, latency_ms: 300, taker_bps: 7 });
  const merged = simApply(held, { slippage: true });
  ok('setting one field keeps the rest', merged.next.start_balance_usd === 2500 && merged.next.latency_ms === 300 && merged.next.taker_bps === 7 && merged.next.slippage === true);
  ok('and `changed` names only what moved', Object.keys(merged.changed).length === 1 && merged.changed.slippage.from === false && merged.changed.slippage.to === true, JSON.stringify(merged.changed));
  const viaPreset = simApply(held, { preset: 'bybit' });
  ok('a PRESET starts from the defaults, it is not a layer', viaPreset.next.start_balance_usd === 10000 && viaPreset.next.latency_ms === 0, JSON.stringify({ b: viaPreset.next.start_balance_usd, l: viaPreset.next.latency_ms }));
  ok('a preset plus a field keeps the field', simApply(held, { preset: 'bybit', start_balance_usd: 5000 }).next.start_balance_usd === 5000);
  ok('reset is the defaults', JSON.stringify(simApply(held, { reset: true }).next) === JSON.stringify(SIM_DEF));
  ok('an unknown preset is refused and lists the real ones', (() => { const r = simApply(held, { preset: 'moon' }); return r.error === 'unknown_preset' && r.presets.length === 8; })());
  console.log('');
}

// ───────────────────────────────────────────────────────────────── Part B: production
async function partB() {
  console.log('PART B - production\n');
  const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };
  const uid = 'e2esim' + Math.random().toString(36).slice(2, 5);
  await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
  const se = await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());
  const km = await fetch(BASE + '/api/bot/key', { method: 'POST', headers: { cookie: 'mp_sess=' + se.token, 'content-type': 'application/json' }, body: '{}' }).then(r => r.json());
  const KEY = km.key || (km.keys && km.keys[0] && km.keys[0].key);
  ok('a throwaway key was minted', !!KEY, JSON.stringify(km).slice(0, 140));
  if (!KEY) return;
  const KH = { 'X-API-Key': KEY, 'Content-Type': 'application/json' };
  const g = (p) => fetch(BASE + '/api/bot' + p, { headers: KH }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})), h: r.headers }));
  const p = (p2, body) => fetch(BASE + '/api/bot' + p2, { method: 'POST', headers: KH, body: JSON.stringify(body || {}) }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})), h: r.headers }));
  const setSim = (o) => p('/v2/sim', o);
  const px = async (sym) => (await g('/v1/price?symbol=' + sym)).j.price;
  const openIt = (o) => p('/v2/open', o);
  const closeIt = (id, sym) => p('/v2/close', { id, symbol: sym });
  const openIds = [];
  const track = (r) => { const id = r.j && r.j.data && r.j.data.position && r.j.data.position.id; if (id) openIds.push(id); return r; };

  try {
    // ---- the GET is the documentation
    const s0 = await g('/v2/sim');
    const D = s0.j.data || {};
    ok('GET /v2/sim answers 200', s0.s === 200, s0.s);
    ok('it returns the profile', !!D.profile && D.profile.start_balance_usd === 10000, JSON.stringify(D.profile || {}).slice(0, 120));
    // 18, COUNTED from SIM_DEF, not guessed - the first draft of this check said 19 and the docs said
    // "nineteen" in four places with it. Counts are counted.
    ok('it describes all 18 fields', D.fields && Object.keys(D.fields).length === 18, D.fields && Object.keys(D.fields).length);
    ok('every field carries what it DOES, not just its type', D.fields && Object.keys(D.fields).every(k => D.fields[k].about && D.fields[k].about.length > 30));
    ok('every numeric field publishes its range', D.fields && Object.keys(D.fields).filter(k => D.fields[k].type === 'number').every(k => Array.isArray(D.fields[k].range) && D.fields[k].range.length === 2));
    ok('it offers all eight presets', D.presets && Object.keys(D.presets).length === 8, D.presets && Object.keys(D.presets).join(','));
    ok('it states the fee / margin / slippage precedence', Array.isArray(D.precedence) && D.precedence.length === 3);
    ok('it says a position keeps what it was filled under', /history is never rewritten/i.test(String(D.applies_to || '')));
    ok('a fresh account reads NO slippage', D.effective && D.effective.slippage_pct === null);
    ok('and a flat 0.5% maintenance margin', D.effective && near(D.effective.maintenance_margin_pct, 0.5, 1e-9), D.effective && D.effective.maintenance_margin_pct);
    ok('and a book that is not a constraint', D.effective && D.effective.book_is_a_constraint === false);

    // ---- v1 stays frozen
    const rl = await g('/v1/realism');
    ok('/v1/realism still answers its ORIGINAL three-switch shape', rl.j.realism && Object.keys(rl.j.realism).sort().join(',') === 'margin_tiers,margin_venue,slippage', JSON.stringify(rl.j.realism));
    ok('and points at the full profile', /v2\/sim/.test(JSON.stringify(rl.j)));

    // ---- out of range is refused
    const bad = await setSim({ latency_ms: 99999 });
    ok('an out-of-range write is refused 400', bad.s === 400 && bad.j.error && bad.j.error.code === 'bad_sim_field', bad.s + ' ' + JSON.stringify(bad.j).slice(0, 120));
    ok('and it is NOT clamped - the profile did not move', (await g('/v2/sim')).j.data.profile.latency_ms === 0);
    const badF = await setSim({ turbo: 1 });
    ok('a field that is not a field is refused', badF.s === 400, badF.s);

    // ---- a preset
    const pre = await setSim({ preset: 'bybit' });
    ok('a preset applies', pre.s === 200 && pre.j.data.preset_applied === 'bybit', pre.s + ' ' + JSON.stringify(pre.j).slice(0, 120));
    ok('and names what it changed', pre.j.data.changed && Object.keys(pre.j.data.changed).length >= 4, JSON.stringify(pre.j.data.changed || {}).slice(0, 160));
    const afterPre = (await g('/v2/sim')).j.data;
    ok('bybit’s maintenance margin is now live', near(afterPre.effective.maintenance_margin_pct, 0.5, 1e-9) && afterPre.profile.margin_venue === 'bybit', JSON.stringify(afterPre.profile.margin_venue));
    ok('and the fee comes from the profile', afterPre.effective.taker_fee_pct > 0 && /taker_bps/.test(afterPre.effective.fee_from), JSON.stringify(afterPre.effective.fee_from));

    // ---- A LEGACY WRITE MUST MERGE, NOT WIPE
    await setSim({ reset: true });
    await setSim({ start_balance_usd: 2500, latency_ms: 120, taker_bps: 9 });
    const lw = await p('/v1/realism', { slippage: true });
    ok('a /v1/realism write answers the old shape', lw.s === 200 && lw.j.realism && Object.keys(lw.j.realism).length === 3, JSON.stringify(lw.j).slice(0, 120));
    const afterLegacy = (await g('/v2/sim')).j.data.profile;
    ok('AND IT DID NOT WIPE THE PROFILE', afterLegacy.start_balance_usd === 2500 && afterLegacy.latency_ms === 120 && afterLegacy.taker_bps === 9 && afterLegacy.slippage === true,
      JSON.stringify({ b: afterLegacy.start_balance_usd, l: afterLegacy.latency_ms, t: afterLegacy.taker_bps, s: afterLegacy.slippage }));

    // ---- the book reaches every number measured against it
    await setSim({ reset: true });
    await setSim({ start_balance_usd: 2500 });
    const acc = await g('/v1/account'), bal = await g('/v1/balance'), eq = await g('/v1/equity?days=2');
    ok('/v1/account reports the chosen book', acc.j.starting_balance_usd === 2500, acc.j.starting_balance_usd);
    ok('/v1/balance reports the chosen book', bal.j.starting_balance_usd === 2500, bal.j.starting_balance_usd);
    ok('/v1/equity reports the chosen book', eq.j.starting_balance_usd === 2500, eq.j.starting_balance_usd);
    ok('margin_enforced still reads false while it IS false', acc.j.margin_enforced === false && bal.j.margin_enforced === false);

    // ---- AN ENFORCED BOOK REFUSES WHAT IT CANNOT FUND
    await setSim({ margin_enforced: true });
    const over = await openIt({ symbol: 'SOL', side: 'long', margin_usd: 9000, leverage: 2 });
    ok('an open over the book is refused 402 insufficient_margin', over.s === 402 && over.j.error && over.j.error.code === 'insufficient_margin', over.s + ' ' + JSON.stringify(over.j).slice(0, 160));
    // /account is built from the positions answer, which is cached for 2 SECONDS per isolate and keyed on the
    // price vector - and the isolate that handled the profile write is not necessarily the one answering this
    // read (the 2026-09-16 lesson). The write drops that cache in its own isolate; across isolates the stale
    // window is at most two seconds. So this polls it out rather than racing it: it still goes red if the flag
    // never propagates, which is the thing being checked. A flaky check is a broken check.
    let accE = await g('/v1/account');
    for (let i = 0; i < 6 && accE.j.margin_enforced !== true; i++) { await new Promise(r => setTimeout(r, 900)); accE = await g('/v1/account'); }
    ok('and /v1/account now says the book IS enforced', accE.j.margin_enforced === true, JSON.stringify({ enforced: accE.j.margin_enforced, book: accE.j.starting_balance_usd }));
    const fits = track(await openIt({ symbol: 'SOL', side: 'long', margin_usd: 50, leverage: 2 }));
    ok('an open inside the book is allowed', fits.s === 200, fits.s + ' ' + JSON.stringify(fits.j).slice(0, 140));
    const bal2 = await g('/v1/balance');
    ok('free margin dropped by the committed margin', near(bal2.j.free_margin_usd, 2500 - 50, 0.02), JSON.stringify({ free: bal2.j.free_margin_usd, inUse: bal2.j.margin_in_use_usd }));
    const over2 = await openIt({ symbol: 'SOL', side: 'long', margin_usd: 2480, leverage: 2 });
    ok('the committed margin really is unavailable', over2.s === 402, over2.s + ' ' + JSON.stringify(over2.j).slice(0, 140));
    ok('the refusal shows the arithmetic', (() => { const e = over2.j.error || {}; return /free margin/i.test(String(e.message || '')); })(), JSON.stringify(over2.j.error || {}).slice(0, 200));

    // ---- the profile ceilings
    await setSim({ reset: true });
    await setSim({ leverage_max: 5, max_notional_usd: 500 });
    const lo = await openIt({ symbol: 'SOL', side: 'long', margin_usd: 10, leverage: 20 });
    ok('over the profile leverage ceiling is refused 400', lo.s === 400 && lo.j.error.code === 'leverage_over_profile', lo.s + ' ' + JSON.stringify(lo.j).slice(0, 120));
    const no = await openIt({ symbol: 'SOL', side: 'long', margin_usd: 200, leverage: 5 });
    ok('over the profile notional ceiling is refused 400', no.s === 400 && no.j.error.code === 'notional_over_profile', no.s + ' ' + JSON.stringify(no.j).slice(0, 120));
    ok('the market cap is still its own, separate refusal', (await openIt({ symbol: 'SOL', side: 'long', margin_usd: 10, leverage: 99999 })).j.error.code === 'leverage_max');

    // ---- SLIPPAGE MOVES THE ENTRY THE RIGHT WAY, AND BY THE RIGHT AMOUNT
    await setSim({ reset: true });
    await setSim({ slippage: true, slippage_bps: 100 }); // 1% - far larger than any drift in the second between two calls
    const mark = await px('BTC');
    const lng = track(await openIt({ symbol: 'BTC', side: 'long', margin_usd: 20, leverage: 2 }));
    const sht = track(await openIt({ symbol: 'BTC', side: 'short', margin_usd: 20, leverage: 2 }));
    const eL = lng.j.data && lng.j.data.position && +lng.j.data.position.entry_price;
    const eS = sht.j.data && sht.j.data.position && +sht.j.data.position.entry_price;
    ok('a LONG pays up', eL > mark * 1.005, 'mark ' + mark + ' entry ' + eL);
    ok('a SHORT sells down', eS < mark * 0.995, 'mark ' + mark + ' entry ' + eS);
    ok('and by about the declared 1%', near(eL / mark, 1.01, 0.004) && near(eS / mark, 0.99, 0.004), (eL / mark).toFixed(5) + ' / ' + (eS / mark).toFixed(5));
    ok('v2 reports the slippage it applied', lng.j.data.fill && near(lng.j.data.fill.slippage_pct, 1, 0.01), JSON.stringify(lng.j.data.fill || {}).slice(0, 160));

    // ---- EXIT SLIPPAGE COSTS MONEY ON THE WAY OUT
    const markB = await px('BTC');
    const cl = await closeIt(lng.j.data.position.id, 'BTC');
    const exitP = cl.j.data && cl.j.data.position && +cl.j.data.position.exit_price;
    ok('a LONG exits BELOW the mark - it sold into the bid', exitP > 0 && exitP < markB * 0.995, 'mark ' + markB + ' exit ' + exitP);
    const markC = await px('BTC');
    const cl2 = await closeIt(sht.j.data.position.id, 'BTC');
    const exitS = cl2.j.data && cl2.j.data.position && +cl2.j.data.position.exit_price;
    ok('a SHORT exits ABOVE the mark - it bought the ask', exitS > markC * 1.005, 'mark ' + markC + ' exit ' + exitS);

    // ---- AND IT IS THE RATE THE POSITION WAS FILLED UNDER, FOR LIFE
    const held2 = track(await openIt({ symbol: 'SOL', side: 'long', margin_usd: 10, leverage: 2 }));
    await setSim({ slippage: false, slippage_bps: '' }); // turn the whole thing off AFTER the fill
    const markD = await px('SOL');
    const cl3 = await closeIt(held2.j.data.position.id, 'SOL');
    const exitD = cl3.j.data && cl3.j.data.position && +cl3.j.data.position.exit_price;
    ok('a position opened under slippage still PAYS it on exit after the profile changed', exitD > 0 && exitD < markD * 0.995, 'mark ' + markD + ' exit ' + exitD);

    // ---- exit_slippage can be switched off on its own
    await setSim({ reset: true });
    await setSim({ slippage: true, slippage_bps: 100, exit_slippage: false });
    const noX = track(await openIt({ symbol: 'SOL', side: 'long', margin_usd: 10, leverage: 2 }));
    ok('the entry still pays the crossing', +noX.j.data.position.entry_price > (await px('SOL')) * 1.005);
    const markE = await px('SOL');
    const clX = await closeIt(noX.j.data.position.id, 'SOL');
    ok('but the exit does NOT, when exit_slippage is off', near(+clX.j.data.position.exit_price / markE, 1, 0.003), markE + ' vs ' + (clX.j.data.position || {}).exit_price);

    // ---- PARTIAL FILLS
    await setSim({ reset: true });
    await setSim({ partial_fills: true, min_fill_pct: 30 });
    let sawPartial = 0, worst = 100;
    for (let i = 0; i < 6; i++) {
      const r = track(await openIt({ symbol: 'SOL', side: 'long', margin_usd: 100, leverage: 2 }));
      const f = r.j.data && r.j.data.fill;
      if (!f) continue;
      if (f.partial) sawPartial++;
      worst = Math.min(worst, f.fill_pct);
      ok('fill ' + (i + 1) + ': filled margin matches the ratio', near(f.filled_margin_usd, 100 * f.fill_pct / 100, 0.02) && near(+r.j.data.position.margin_usd, f.filled_margin_usd, 0.02), JSON.stringify(f).slice(0, 120));
      ok('fill ' + (i + 1) + ': never below min_fill_pct', f.fill_pct >= 30, f.fill_pct);
      ok('fill ' + (i + 1) + ': the header says the same thing', near(+r.h.get('x-mp-fill-pct'), f.fill_pct, 0.01) && +r.h.get('x-mp-margin-requested') === 100, r.h.get('x-mp-fill-pct') + ' / ' + r.h.get('x-mp-margin-requested'));
    }
    ok('six orders at min 30% produced at least one partial fill', sawPartial >= 1, 'partials=' + sawPartial + ' worst=' + worst);

    // ---- REFUSALS (statistical: 50% over 14 tries - a run that sees none is 1 in 16,000)
    await setSim({ reset: true });
    await setSim({ reject_rate_pct: 50 });
    let rej = 0, acc2 = 0;
    for (let i = 0; i < 14; i++) {
      const r = await openIt({ symbol: 'SOL', side: 'long', margin_usd: 5, leverage: 2 });
      if (r.s === 503 && r.j.error && r.j.error.code === 'venue_rejected') rej++;
      else if (r.s === 200) { acc2++; track(r); }
    }
    ok('a 50% reject rate refuses some opens with 503 venue_rejected', rej >= 1, 'refused ' + rej + ' of 14');
    ok('and lets the rest through', acc2 >= 1, 'accepted ' + acc2 + ' of 14');

    // ---- LATENCY
    await setSim({ reset: true });
    await setSim({ latency_ms: 900 });
    const t0 = Date.now();
    const slow = track(await openIt({ symbol: 'SOL', side: 'long', margin_usd: 5, leverage: 2 }));
    const took = Date.now() - t0;
    ok('an open with 900 ms of latency really waits for it', slow.s === 200 && took >= 900, took + 'ms');
    ok('and v2 reports the latency it applied', slow.j.data.fill && slow.j.data.fill.latency_ms === 900, JSON.stringify(slow.j.data.fill || {}).slice(0, 120));

    // ---- YOUR OWN FEE
    await setSim({ reset: true });
    await setSim({ taker_bps: 25 });
    const dry = await openIt({ symbol: 'SOL', side: 'long', margin_usd: 100, leverage: 10, dry_run: true });
    ok('a dry run quotes YOUR fee, not ours', near(dry.j.data.position.taker_fee_pct, 0.25, 1e-6), JSON.stringify(dry.j.data.position.taker_fee_pct));
    ok('a dry run never rolls the dice and says so', dry.j.data.simulation && /never rolls the dice/i.test(dry.j.data.simulation.note), JSON.stringify(dry.j.data.simulation || {}).slice(0, 140));
    const fee1 = track(await openIt({ symbol: 'SOL', side: 'long', margin_usd: 100, leverage: 10 }));
    ok('and a real open is filled at it', near(+fee1.j.data.fill.taker_fee_pct, 0.25, 1e-6), JSON.stringify(fee1.j.data.fill || {}).slice(0, 140));

    // ---- /markets MUST QUOTE THE FEE THIS CALLER WILL PAY, not the house rate (found by writing a bot
    // with the published client: the profile charged one rate and "at what fee" answered another).
    const mkt = await g('/v2/markets?class=crypto');
    const btcRow = ((mkt.j.data || mkt.j).markets || []).filter(m => m.symbol === 'BTC')[0];
    ok('/markets quotes the profile fee for a keyed caller', btcRow && near(btcRow.taker_fee_pct, 0.25, 1e-5), JSON.stringify(btcRow));
    ok('and keeps the house rate beside it', btcRow && near(btcRow.default_taker_fee_pct, 0.055, 1e-5), JSON.stringify(btcRow));
    ok('and names where the fee came from', /taker_bps/.test(String((mkt.j.data || mkt.j).fee_source || '')), (mkt.j.data || mkt.j).fee_source);
    // /markets is a KEYED endpoint - the first draft of this check assumed it was keyless market data (that is
    // /api/v1/*) and asserted a house rate on a body that is a 401. The real contract is the refusal.
    const mktAnon = await fetch(BASE + '/api/bot/v2/markets?class=crypto').then(async r => ({ s: r.status, j: await r.json() }));
    ok('/markets without a key is refused, so there is always an account to read the fee from', mktAnon.s === 401 && mktAnon.j.error && mktAnon.j.error.code === 'missing_api_key', mktAnon.s + ' ' + JSON.stringify(mktAnon.j).slice(0, 110));

    // ---- WHAT EXECUTION COST, ON THE REPORT
    await closeIt(fee1.j.data.position.id, 'SOL');
    const rep = await g('/v1/report?days=1');
    const C = rep.j.costs || (rep.j.data && rep.j.data.costs);
    ok('/v1/report carries a costs block', !!C, JSON.stringify(rep.j).slice(0, 200));
    ok('and it is on the FREE plan', !!C && rep.j.plan === 'free', rep.j.plan);
    ok('fees were actually recorded', C && C.fees_usd > 0, JSON.stringify(C || {}).slice(0, 220));
    ok('gross = net + what it cost, to the cent', C && near(C.pnl_gross_usd, C.pnl_net_usd + C.total_usd, 0.02), JSON.stringify(C || {}).slice(0, 220));
    ok('a missing cost is counted as unknown, never as zero', C && typeof C.unknown_n === 'number' && /unknown_n/.test(C.note));
    ok('kept_pct is only printed when there is a gross to divide by', !C || C.kept_pct === null || (C.kept_pct >= -100000 && C.pnl_gross_usd > 0));

    // ---- THE PER-TRADE COST, and the two papercuts the developer walk found
    await setSim({ reset: true });
    const pc = track(await openIt({ symbol: 'SOL', side: 'long', margin_usd: 20, leverage: 5 }));
    const pcId = pc.j.data.position.id;
    const pcC = await closeIt(pcId, 'SOL');
    const cp = pcC.j.data.position;
    ok('a CLOSED position carries its own fees_usd', cp && cp.fees_usd > 0, JSON.stringify(cp).slice(0, 200));
    ok('and its own funding_usd (0, not missing, on a trade that accrued none)', cp && cp.funding_usd === 0, JSON.stringify({ f: cp && cp.funding_usd }));
    ok('and the fee matches qty x (entry + exit) x rate to the cent', (() => {
      const want = cp.qty * (cp.entry_price + cp.exit_price) * (cp.fee_rate_pct / 100);
      return near(cp.fees_usd, want, 0.02);
    })(), JSON.stringify({ got: cp && cp.fees_usd, qty: cp && cp.qty, rate: cp && cp.fee_rate_pct }));

    const pr2 = track(await openIt({ symbol: 'SOL', side: 'long', margin_usd: 15, leverage: 3 }));
    const st = await p('/v2/sltp', { id: pr2.j.data.position.id, trail_pct: 1.4 });
    ok('v2 /sltp answers in the Position shape, not the journal row', st.s === 200 && st.j.data.position && st.j.data.position.trail_pct === 1.4 && st.j.data.position.sl != null, JSON.stringify((st.j.data || {}).position || st.j).slice(0, 200));
    const st1 = await fetch(BASE + '/api/bot/v1/sltp', { method: 'POST', headers: KH, body: JSON.stringify({ id: pr2.j.data.position.id, trail_pct: 1.4 }) }).then(r => r.json());
    ok('v1 /sltp still answers the frozen journal row, with no extra key', st1.position && st1.position.stop != null && st1.api === undefined, Object.keys(st1.position || {}).slice(0, 8).join(','));

    await setSim({ margin_enforced: true, start_balance_usd: 1000 });
    const bz = await g('/v2/balance');
    const bd = bz.j.data || bz.j;
    ok('v2 /balance states the biggest position this book can fund', bd.max_margin_usd != null && bd.max_margin_usd <= 1000, JSON.stringify({ max: bd.max_margin_usd, free: bd.free_margin_usd }));
    ok('and asking for a dollar more than that is refused', (await openIt({ symbol: 'SOL', side: 'long', margin_usd: Math.ceil(bd.max_margin_usd) + 50, leverage: 2 })).s === 402);
    const bz1 = await fetch(BASE + '/api/bot/v1/balance', { headers: KH }).then(r => r.json());
    ok('v1 /balance does NOT carry it (frozen body)', bz1.max_margin_usd === undefined, Object.keys(bz1).join(','));
    await setSim({ reset: true });

    // ---- v1 IS BYTE-FROZEN
    await setSim({ reset: true });
    const v1open = await fetch(BASE + '/api/bot/v1/open', { method: 'POST', headers: KH, body: JSON.stringify({ symbol: 'SOL', side: 'long', margin_usd: 5, leverage: 2 }) }).then(async r => ({ s: r.status, j: await r.json(), h: r.headers }));
    if (v1open.j && v1open.j.position && v1open.j.position.id) openIds.push(v1open.j.position.id);
    ok('a v1 open body has NO `fill` key', v1open.s === 200 && v1open.j.fill === undefined, Object.keys(v1open.j || {}).join(','));
    ok('but it still carries the headers, so a v1 bot can see a partial fill', !!v1open.h.get('x-mp-fill-pct'), v1open.h.get('x-mp-fill-pct'));
    const v1pos = await fetch(BASE + '/api/bot/v1/positions', { headers: KH }).then(r => r.json());
    ok('a v1 positions body has NO `sim` key', v1pos.sim === undefined, Object.keys(v1pos || {}).join(','));
    ok('and no `life` key either, as before', v1pos.life === undefined);
    const v2pos = await g('/v2/positions');
    ok('v2 positions DOES carry the book', v2pos.j.data && v2pos.j.data.sim && v2pos.j.data.sim.start_balance_usd === 10000, JSON.stringify((v2pos.j.data || {}).sim));

    // ---- the guest / keyless read
    const anon = await fetch(BASE + '/api/trade/sim').then(async r => ({ s: r.status, j: await r.json() }));
    ok('a signed-out reader can read the defaults', anon.s === 200 && anon.j.profile && anon.j.profile.start_balance_usd === 10000, anon.s);
    ok('and gets the presets too', anon.j.presets && Object.keys(anon.j.presets).length === 8);

    // ---- the MCP tool exists
    const mcp = await fetch(BASE + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }).then(r => r.json()).catch(() => null);
    const tools = (mcp && mcp.result && mcp.result.tools) || [];
    ok('MCP exposes paper_sim', tools.some(t => t.name === 'paper_sim'), tools.length + ' tools');
    ok('and its description explains the defaults are easy', (() => { const t = tools.filter(x => x.name === 'paper_sim')[0]; return t && /deliberately easy/i.test(t.description); })());
    ok('and it offers the presets', (() => { const t = tools.filter(x => x.name === 'paper_sim')[0]; return t && t.inputSchema.properties.preset && /brutal/.test(t.inputSchema.properties.preset.description); })());

    // ---- the spec and the changelog
    const spec = await fetch(BASE + '/api/openapi.json').then(r => r.json());
    ok('the OpenAPI spec documents /v1/sim', !!(spec.paths && spec.paths['/api/bot/v1/sim']), Object.keys(spec.paths || {}).length + ' paths');
    ok('with both a GET and a POST', !!(spec.paths['/api/bot/v1/sim'].get && spec.paths['/api/bot/v1/sim'].post));
    ok('and a SimProfile schema', !!(spec.components && spec.components.schemas && spec.components.schemas.SimProfile));
    // /api/changelog answers in the v2 envelope and the list is `entries`, not `releases` - the first draft
    // of this check invented a key and reported the changelog missing while it was live.
    const chg = await fetch(BASE + '/api/changelog').then(r => r.json());
    const ents = (chg.data && chg.data.entries) || chg.entries || [];
    ok('the changelog leads with 3.0.0', ents[0] && ents[0].version === '3.0.0', ents[0] && ents[0].version);
    ok('and says side:"sell" opened a long', ents[0] && JSON.stringify(ents[0]).indexOf('OPENED A LONG') > 0);
  } finally {
    for (const id of openIds) { try { await closeIt(id, ''); } catch (e) {} }
    try { await fetch(BASE + '/api/bot/v2/close_all', { method: 'POST', headers: KH, body: '{}' }); } catch (e) {}
    await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) });
  }
}

(async () => {
  console.log('sim-e2e\n');
  partA();
  if (process.argv.indexOf('--pure') < 0) {
    if (!ADMIN) { console.log('needs ADMIN_KEY.local.txt for Part B'); fail++; }
    else await partB();
  }
  console.log('\nsim-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('sim-e2e crashed: ' + (e && e.stack || e)); process.exitCode = 1; });

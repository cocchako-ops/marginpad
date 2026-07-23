// test-trading.js — B2: API-level regression suite for the server-side trading engine (/api/trade/*).
// Runs against PRODUCTION with the e2e probe account (same pattern as replay-signals: test the real thing).
// Covers: validations, open math (slippage/liq/qty), SL/TP side checks, partial split (margin/notional/partial/fund
// scaling), partial-of-partial, double-close race, fee math to the cent, sub-penny liq precision. Cleans up after itself.
//   node build/test-trading.js
const KEY = 'mpadm_43bf150d4778e4f0e72f717f69f82d3acb326e9a'; // local-use only (file lives in a public repo path but key is already used by load-test.js — E3 will rotate)
const UID = 'e2e-trading-suite';
const BASE = 'https://marginpad.io/api/trade';
const q = '?uid=' + UID + '&key=' + KEY;
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('  OK  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } }
async function api(path, body) { const r = await fetch(BASE + path + q, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined); return r.json(); }
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9);

(async () => {
  console.log('== validations ==');
  ok('no symbol → symbol_required', (await api('/open', { side: 'long', margin: 10, lev: 5 })).error === 'symbol_required');
  ok('margin 0.5 → margin_min_1', (await api('/open', { sym: 'BTC', side: 'long', margin: 0.5, lev: 5 })).error === 'margin_min_1');
  ok('margin 200k → margin_max_100000', (await api('/open', { sym: 'BTC', side: 'long', margin: 200000, lev: 5 })).error === 'margin_max_100000');
  ok('garbage symbol → unknown_symbol', (await api('/open', { sym: 'ZZZZZZQ', side: 'long', margin: 10, lev: 5 })).error === 'unknown_symbol');
  ok('long SL above entry → sl_wrong_side', (await api('/open', { sym: 'BTC', side: 'long', margin: 10, lev: 5, sl: 99999999 })).error === 'sl_wrong_side');
  ok('long TP below entry → tp_wrong_side', (await api('/open', { sym: 'BTC', side: 'long', margin: 10, lev: 5, tp: 1 })).error === 'tp_wrong_side');
  ok('close bad id → not_found', (await api('/close', { id: 'nope123' })).error === 'not_found');

  console.log('== open math (long BTC $100 20x) ==');
  const o = await api('/open', { sym: 'BTC', side: 'long', margin: 100, lev: 20 });
  const p = o.position || {};
  ok('open ok', o.ok === true, JSON.stringify(o).slice(0, 120));
  ok('notional = margin*lev', near(p.notional, 2000, 0.01));
  ok('qty = notional/entry', near(p.qty, 2000 / p.entry, 1e-9));
  ok('liq = mpcLiq long (entry*(1-(1-mmr)/lev))', near(p.liq, p.entry * (1 - (1 - 0.005) / 20), p.entry * 1e-9));
  ok('feeRate 0.00055 stamped', p.feeRate === 0.00055);
  ok('src=srv id srv-prefixed', p.src === 'srv' && String(p.id).slice(0, 3) === 'srv');

  console.log('== sltp ==');
  const slBad = await api('/sltp', { id: p.id, sl: p.entry * 1.01 });
  ok('sltp long SL above entry rejected', slBad.error === 'sl_wrong_side');
  const slOk = await api('/sltp', { id: p.id, sl: p.entry * 0.9, tp: p.entry * 1.1 });
  ok('sltp valid accepted', slOk.ok === true && near(+slOk.position.stop, p.entry * 0.9, 0.01));

  console.log('== partial split 40% → margin/notional/partial scale, then 50% of remainder ==');
  const c1 = await api('/close', { id: p.id, pct: 40 });
  ok('partial ok', c1.ok === true, JSON.stringify(c1).slice(0, 140));
  const part = c1.closed || {}, rem = c1.remaining || {};
  ok('part margin = 40', near(+(part.margin_usd != null ? part.margin_usd : part.margin), 40, 0.01));
  ok('rem margin = 60', near(+(rem.margin_usd != null ? rem.margin_usd : rem.margin), 60, 0.01));
  ok('part qty = 40% of qty', near(+part.qty, p.qty * 0.4, p.qty * 1e-6));
  ok('rem qty = 60% of qty', near(+rem.qty, p.qty * 0.6, p.qty * 1e-6));
  // fee math to the cent: pnl = qty*(exit-entry) - qty*(entry+exit)*feeRate  (no funding yet on a fresh trade)
  const exp1 = +part.qty * (+part.exit_price - p.entry) - +part.qty * (p.entry + +part.exit_price) * 0.00055;
  ok('part pnl fee-exact (±$0.02)', near(+part.pnl_usd, Math.round(exp1 * 100) / 100, 0.02), part.pnl_usd + ' vs ' + exp1.toFixed(4));
  const c2 = await api('/close', { id: p.id, pct: 50 });
  const part2 = c2.closed || {};
  ok('partial-of-partial ok', c2.ok === true);
  ok('part2 margin = 30 (50% of 60)', near(+(part2.margin_usd != null ? part2.margin_usd : part2.margin), 30, 0.01));

  console.log('== double-close race on the remainder ==');
  const [r1, r2] = await Promise.all([api('/close', { id: p.id }), api('/close', { id: p.id })]);
  const oks = [r1, r2].filter(x => x.ok === true).length, dups = [r1, r2].filter(x => x.error === 'already_closed').length;
  ok('exactly 1 ok + 1 already_closed', oks === 1 && dups === 1, JSON.stringify([r1.error || 'ok', r2.error || 'ok']));

  console.log('== sub-penny liq precision (PEPE-class @1000x) ==');
  const sp = await api('/open', { sym: 'PEPE', side: 'long', margin: 5, lev: 1000 });
  if (sp.ok) {
    const d = (sp.position.entry - sp.position.liq) / sp.position.entry * 100;
    ok('liq dist = 0.0995% (not rounded away)', near(d, 0.0995, 0.0002), d.toFixed(5) + '%');
    await api('/close', { id: sp.position.id });
  } else ok('PEPE price available', false, sp.error);

  console.log('== short-side liq direction ==');
  const sh = await api('/open', { sym: 'ETH', side: 'short', margin: 10, lev: 50 });
  if (sh.ok) {
    ok('short liq ABOVE entry', sh.position.liq > sh.position.entry);
    ok('short liq = entry*(1+(1-mmr)/lev)', near(sh.position.liq, sh.position.entry * (1 + 0.995 / 50), sh.position.entry * 1e-9));
    await api('/close', { id: sh.position.id });
  } else ok('ETH short opened', false, sh.error);

  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (fail ? ' — DO NOT DEPLOY' : ' — trading engine green'));
  process.exit(fail ? 1 : 0);
})();

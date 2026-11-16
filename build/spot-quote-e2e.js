/* Demo Spot: a fill needs two witnesses (2026-11-16, the Monkey bug).
   Lifts spotQuoteCheck out of the SHIPPED worker and drives it with the real numbers of the incident, then asks production
   whether the trade route refuses a buy on the pool that caused it.
   node build/spot-quote-e2e.js [--pure] [--falsify]   (--falsify restores "one source is enough" and must turn the Monkey checks red) */
'use strict';
const fs = require('fs'), path = require('path');
const PURE = process.argv.includes('--pure'), FALSIFY = process.argv.includes('--falsify');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const grab = (start, end) => { const i = src.indexOf(start); const j = src.indexOf(end, i); if (i < 0 || j < 0) throw new Error('lift: ' + start); return src.slice(i, j); };
let body = grab('const SPOT_SRC_AGREE', '// the second reading of a pool');
if (FALSIFY) body = body.replace("r > SPOT_SRC_AGREE ?", "false ?").replace("if (x > SPOT_SOLO_X)", "if (false)");
const check = new Function(body + '; return spotQuoteCheck;')();
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); } };

console.log('the rule, on the incident\'s own numbers');
{ const r = check({ p1: 3.78e-24, p2: 6.26e-26, ref: 0 }); ok(!r.ok && r.why === 'price_disagree', 'DexScreener 3.78e-24 against GeckoTerminal 6.26e-26 on one pool fills nothing', r); }
{ const r = check({ p1: 1.838e-21, p2: 0, ref: 3.675e-24 }); ok(!r.ok && r.why === 'price_unconfirmed', 'the x500 sale with no second reading is refused', r); }
{ const r = check({ p1: 1.838e-21, p2: 6.2e-26, ref: 3.675e-24 }); ok(!r.ok, 'the x500 sale against a second reading is refused', r); }
{ const r = check({ p1: 3.563e-23, p2: 0, ref: 4.93e-24 }); ok(!r.ok, 'Sanaullah\'s x7 sale with one source is refused', r); }
console.log('ordinary trades still go through');
{ const r = check({ p1: 0.0881, p2: 0.0869, ref: 0.0026 }); ok(r.ok && r.confirmed, 'a real x34 pump (DOPE) confirmed by both sources fills', r); }
{ const r = check({ p1: 1.02, p2: 0, ref: 1 }); ok(r.ok, 'a small move with one source fills', r); }
{ const r = check({ p1: 0.5, p2: 0, ref: 0 }); ok(r.ok, 'a first buy with one source and no history fills', r); }
{ const r = check({ p1: 1.4, p2: 1.0, ref: 0 }); ok(r.ok, 'two sources 40% apart (inside the 1.5x band) fill', r); }
{ const r = check({ p1: 0, p2: 1, ref: 0 }); ok(!r.ok, 'no first price fills nothing', r); }
console.log('the shipped route uses it');
ok(/spotSecondPrice\(env, net, pool, mp\)/.test(src) && /spotQuoteCheck\(\{ p1: price/.test(src), 'the /trade meme path asks for a second reading and checks it');
ok(/mp\.src === 'ds'[^\n]*spotGtPool/.test(src), 'the valuation re-checks a big one-source gainer against GeckoTerminal');

(async () => {
  if (!PURE && !FALSIFY) {
    console.log('production');
    const r = await fetch('https://marginpad.io/api/spot/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ side: 'buy', kind: 'meme', mint: '0x684a1768c8d0098811017b7812c23978dd58c276', pool: '0xd9E51Cb178dCbD0de2333ef5cf94cd042aE49F31', net: 'bsc', usd: 5 }) });
    const j = await r.json().catch(() => ({}));
    ok(r.status === 401 || j.error === 'login_required' || j.error === 'no_price', 'a guest cannot trade at all (route alive)', { status: r.status, j });
  }
  console.log('\nspot-quote-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})();

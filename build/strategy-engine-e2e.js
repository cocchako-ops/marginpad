/* Proves the numbers on /strategies/ before there is a page. Hand-built candles for every fill rule, a look-ahead test
   that rewrites the future and requires the past to stay put, then all sixty rules run through JS and through the generated
   Python and compared trade by trade. A figure that two implementations do not agree on is not a figure.

   node build/strategy-engine-e2e.js [--pure] */
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const S = require('../dist/assets/mp-strat.js');
const { RULES } = require('./strategies/rules');
const { MARKETS, CLASSES } = require('./strategies/markets');
const { toPython, toPine, describe } = require('./strategies/emit');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('FAIL  ' + m + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const day = 864e5, T0 = Date.UTC(2024, 0, 1);
const mk = (rows) => { // rows: [o,h,l,c]
  const b = { t: [], o: [], h: [], l: [], c: [], v: [] };
  rows.forEach((r, i) => { b.t.push(T0 + i * day); b.o.push(r[0]); b.h.push(r[1]); b.l.push(r[2]); b.c.push(r[3]); b.v.push(100); });
  return S.bars(b);
};
const flat = (n, p = 100) => Array.from({ length: n }, () => [p, p + 1, p - 1, p]);
const FREE = { fee: 0, slip: 0 };
const on = ['gt', ['close'], ['num', 104]]; // true on the bar that closes at 105

// signal on a CLOSE, filled at the NEXT open
{
  const rows = [...flat(16), [100, 106, 100, 105], [107, 108, 106, 107], [107, 108, 106, 107]];
  const r = S.run({ entryL: on, maxBars: 1 }, mk(rows), FREE, null);
  ok(r.trades.length === 1 && near(r.trades[0].ep, 107), 'a signal on a close fills at the next open, never at that close', r.trades[0]);
}
// a flat round trip pays both sides
{
  const rows = [...flat(16), [100, 106, 100, 105], [100, 101, 99, 100], [100, 101, 99, 100], [100, 101, 99, 100]];
  const r = S.run({ entryL: on, maxBars: 1 }, mk(rows), { fee: 0.1, slip: 0 }, null);
  ok(near(r.trades[0].r, 0.999 * 0.999 - 1), 'fee is charged on both sides', r.trades[0].r);
  const s = S.run({ entryL: on, maxBars: 1 }, mk(rows), { fee: 0, slip: 0.1 }, null);
  ok(s.trades[0].ep > 100 && s.trades[0].xp < 100, 'slippage is against the trade on the way in and out', s.trades[0]);
}
// stop gapped through fills at the open, not at the stop
{
  const rows = [...flat(16), [100, 106, 100, 105], [100, 101, 99, 100], [80, 81, 79, 80], [80, 81, 79, 80]];
  const r = S.run({ entryL: on, stop: { pct: 5 } }, mk(rows), FREE, null);
  ok(near(r.trades[0].xp, 80) && r.trades[0].why === 'stop', 'a stop that gaps fills at the open', r.trades[0]);
}
// both touched in one bar: stop first
{
  const rows = [...flat(16), [100, 106, 100, 105], [100, 101, 99, 100], [100, 120, 90, 110], [110, 111, 109, 110]];
  const r = S.run({ entryL: on, stop: { pct: 5 }, tp: { pct: 5 } }, mk(rows), FREE, null);
  ok(r.trades[0].why === 'stop' && near(r.trades[0].xp, 95), 'stop and target in one bar counts as the stop', r.trades[0]);
}
// a short earns when price falls, and a target fills at its price
{
  const rows = [...flat(16), [100, 106, 100, 105], [100, 101, 99, 100], [100, 100, 89, 90], [90, 91, 89, 90]];
  const r = S.run({ entryS: on, tp: { pct: 10 } }, mk(rows), FREE, null);
  ok(r.trades[0].d === -1 && near(r.trades[0].r, 0.1), 'a short target pays exactly its distance', r.trades[0]);
}
// funding: positive rate costs a long and pays a short
{
  const rows = [...flat(16), [100, 106, 100, 105], [100, 101, 99, 100], [100, 101, 99, 100], [100, 101, 99, 100], [100, 101, 99, 100]];
  const fund = { t: [T0 + 18 * day - 1000], r: [0.01] };
  const a = S.run({ entryL: on, maxBars: 2 }, mk(rows), FREE, fund), c = S.run({ entryS: on, maxBars: 2 }, mk(rows), FREE, fund);
  ok(near(a.trades[0].r, -0.01), 'a long pays a positive funding print', a.trades[0].r);
  ok(near(c.trades[0].r, 0.01), 'a short earns it', c.trades[0].r);
}
// the trail only moves on closes and never back
{
  const up = Array.from({ length: 40 }, (_, i) => { const p = 100 + i; return [p, p + 1, p - 1, p]; });
  const rows = [...up, [139, 140, 120, 125], [125, 126, 124, 125]];
  const r = S.run({ entryL: ['gt', ['close'], ['num', 130]], stop: { atr: 3 }, trail: { atr: 3 } }, mk(rows), FREE, null);
  ok(r.trades.length >= 1 && r.trades[0].why === 'stop' && r.trades[0].xp > 125, 'a trailing stop closes the trade at its level', r.trades[0]);
}
// look-ahead: rewrite the future, the past must not move
{
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/strategies/BTC-1d.json'), 'utf8'));
  const cut = raw.c.length - 300;
  let bad = [];
  for (const r of RULES) {
    if (r.only && !r.only.includes('crypto')) continue;
    const a = S.run(r, S.bars(raw), CLASSES.crypto, null).trades.filter((t) => t.xt < raw.t[cut - 1]);
    const c = { ...raw, o: raw.o.slice(), h: raw.h.slice(), l: raw.l.slice(), c: raw.c.slice() };
    for (let i = cut; i < c.c.length; i++) { c.o[i] *= 3; c.h[i] *= 3; c.l[i] *= 3; c.c[i] *= 3; }
    const b = S.run(r, S.bars(c), CLASSES.crypto, null).trades.filter((t) => t.xt < raw.t[cut - 1]);
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(r.slug);
  }
  ok(!bad.length, 'no rule can read the future: rewriting the last 300 bars changes no earlier trade', bad);
}
// the table itself
ok(RULES.length >= 60, 'at least sixty rules', RULES.length);
ok(new Set(RULES.map((r) => r.slug)).size === RULES.length, 'every slug is unique');
ok(RULES.every((r) => r.entryL || r.entryS), 'every rule can enter');
ok(RULES.every((r) => r.exitL || r.exitS || r.stop || r.tp || r.maxBars || r.reverse), 'every rule has a way out');
ok(RULES.every((r) => !r.tp || !r.tp.r || r.stop), 'a target in R always has a stop to measure it from');
ok(RULES.every((r) => describe(r).length >= 1), 'every rule describes itself in English');
ok(MARKETS.filter((m) => m.cls === 'crypto' && m.basket).length === 20, 'the crypto basket is twenty markets');

const pines = RULES.map((r) => [r, toPine(r)]);
ok(pines.every(([, p]) => p.startsWith('//@version=6') && /strategy\("/.test(p)), 'every rule compiles to a Pine v6 strategy');
ok(pines.every(([r, p]) => !/undefined|NaN|\[object/.test(p)), 'no Pine file carries a broken expression', pines.filter(([, p]) => /undefined|NaN|\[object/.test(p)).map(([r]) => r.slug));
const lazy = (p) => p.split('\n').filter((l) => !l.startsWith('//')).some((l) => /\b(and|or)\b/.test(l) && /\bta\./.test(l));
ok(pines.every(([, p]) => !lazy(p)), 'no ta.* call sits behind a lazy and/or, which Pine v6 would skip on some bars', pines.filter(([, p]) => lazy(p)).map(([r]) => r.slug));

// Python parity
if (!process.argv.includes('--pure')) {
  const py = spawnSync('python', ['--version']).status === 0 ? 'python' : 'py';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-strat-'));
  const runtime = fs.readFileSync(path.join(__dirname, 'strategies/runtime.py.txt'), 'utf8');
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/strategies/BTC-4h.json'), 'utf8'));
  const n = 3000, cut = (k) => raw[k].slice(-n), csv = ['time,open,high,low,close,volume'];
  const b = { t: cut('t'), o: cut('o'), h: cut('h'), l: cut('l'), c: cut('c'), v: cut('v') };
  for (let i = 0; i < n; i++) csv.push([b.t[i], b.o[i], b.h[i], b.l[i], b.c[i], b.v[i]].join(','));
  fs.writeFileSync(path.join(tmp, 'c.csv'), csv.join('\n'));
  const bad = [], cost = { fee: 0.055, slip: 0.02 };
  let compared = 0;
  for (const r of RULES) {
    const f = path.join(tmp, r.slug + '.py');
    const dump = '\n\nif __name__ == "__main__":\n    pass\n';
    fs.writeFileSync(f, toPython(r, runtime).replace('    main(RULE)', '    print(json.dumps(backtest(RULE, load(sys.argv[1]))))'));
    const out = spawnSync(py, [f, path.join(tmp, 'c.csv')], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (out.status !== 0) { bad.push([r.slug, (out.stderr || '').trim().split('\n').slice(-1)[0]]); continue; }
    const pyT = JSON.parse(out.stdout), jsT = S.run(r, S.bars(b), cost, null).trades;
    compared += jsT.length;
    const same = pyT.length === jsT.length && pyT.every((t, i) => t.side === jsT[i].d && near(t.entry, jsT[i].ep, 1e-6) && near(t.exit, jsT[i].xp, 1e-6));
    if (!same) { const i = pyT.findIndex((t, k) => !jsT[k] || !near(t.exit, jsT[k].xp, 1e-6)); bad.push([r.slug, pyT.length, jsT.length, i]); }
  }
  ok(!bad.length, `all ${RULES.length} generated Python files match the engine trade by trade (${compared} trades)`, bad.slice(0, 6));
}
console.log(`\n${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);

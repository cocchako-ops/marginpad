/* Does the AI actually work? (2026-09-19, the owner's own question.)
 *
 * We measured to the cent what a read COSTS and never once measured whether it was RIGHT - every claim about
 * quality was somebody's impression, on a feature priced at $159. Every directional plan is now recorded with its
 * own levels and settled against real candles: the first target, or the stop, whichever the market touched FIRST.
 *
 * The settlement rule is the whole thing, so it is tested hardest. Two ways to get a hit-rate that flatters:
 *   - scoring "did price ever reach the target" and ignoring a stop hit on the way. That turns losses into wins.
 *   - guessing the order when both land inside ONE candle. Nobody can know it from OHLC, so that call is UNCLEAR
 *     and counts as neither.
 *
 * Run: node build/ai-calls-e2e.js
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); } };

// lift the real settler out of the worker
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const i = src.indexOf('function aiCallSettle(');
if (i < 0) { console.log('aiCallSettle not found in worker.js'); process.exit(1); }
let d = 0, started = false, end = i;
for (let j = i; j < src.length; j++) {
  if (src[j] === '{') { d++; started = true; }
  else if (src[j] === '}') { d--; if (started && d === 0) { end = j + 1; break; } }
}
eval(src.slice(i, end));

const bar = (h, l, t) => ({ time: t || 0, high: h, low: l, open: (h + l) / 2, close: (h + l) / 2 });
const LONG = { bias: 'long', entry: 100, stop: 98, tp1: 104 };
const SHORT = { bias: 'short', entry: 100, stop: 102, tp1: 96 };

console.log('\nPURE - the settlement rule');

ok(aiCallSettle(LONG, [bar(101, 99), bar(103, 100), bar(105, 102)]).state === 'win',
  'a long that reaches the target without touching the stop is a win');

ok(aiCallSettle(LONG, [bar(101, 99), bar(100, 97.5)]).state === 'loss',
  'a long that loses the stop is a loss');

// the one that matters: the stop comes FIRST, the target prints later
const trap = aiCallSettle(LONG, [bar(101, 99), bar(100, 97.5), bar(106, 99)]);
ok(trap.state === 'loss' && trap.bars === 2,
  'a stop hit BEFORE the target is a loss even though price reached the target afterwards', trap);

ok(aiCallSettle(LONG, [bar(105, 97)]).state === 'unclear',
  'target and stop inside ONE candle is unclear - the order is unknowable from OHLC');

ok(aiCallSettle(LONG, [bar(101, 99), bar(102, 99.5)]) === null,
  'a call the market has not decided yet returns nothing, rather than a guess');

ok(aiCallSettle(SHORT, [bar(101, 99), bar(100, 95.5)]).state === 'win',
  'a short is judged the other way up - target below, stop above');
ok(aiCallSettle(SHORT, [bar(103, 99)]).state === 'loss',
  'a short stopped out above the entry is a loss');

ok(aiCallSettle({ bias: 'wait', entry: 100 }, [bar(105, 95)]) === null,
  'a wait plan is never scored - it promised nothing');
ok(aiCallSettle({ bias: 'long', entry: 100, stop: 0, tp1: 104 }, [bar(105, 95)]) === null,
  'a plan missing a stop cannot be settled and is not guessed at');
ok(aiCallSettle(null, [bar(1, 1)]) === null && aiCallSettle(LONG, []) === null,
  'no row or no candles settles nothing');

ok(aiCallSettle(LONG, [bar(104, 99)]).state === 'win' && aiCallSettle(LONG, [bar(103.99, 99)]) === null,
  'the target counts when it is touched exactly, not only when it is passed');

console.log('\nLIVE - the desk that reads it');
(async () => {
// The admin key is read from the gitignored ADMIN_KEY.local.txt - NEVER hardcoded. On 2026-09-21 the
// live key was found sitting in six files in a public repository, answering 200. Anything that opens
// the money routes belongs in a file git cannot see.
const KEY = (require('fs').readFileSync(require('path').join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9]+/) || [])[0];
if (!KEY) { console.error('no mpadm_ token in ADMIN_KEY.local.txt'); process.exit(1); }
  try {
    const r = await fetch('https://marginpad.io/api/admin/aicalls?days=30', { headers: { 'x-admin-key': KEY } });
    const j = await r.json();
    ok(r.status === 200 && typeof j.decided === 'number', 'the hit-rate endpoint answers', { s: r.status, decided: j.decided });
    ok('still_open' in j && 'by_model' in j, 'it reports what is still running and splits by model', { open: j.still_open });
    ok(j.decided >= 20 ? (typeof j.hit_rate_pct === 'number') : /Too few settled calls/.test(j.note || ''),
      'below about 20 settled calls it says the number is noise instead of printing one', { decided: j.decided, note: (j.note || '').slice(0, 60) });
    const anon = await fetch('https://marginpad.io/api/admin/aicalls');
    ok(anon.status === 403 || anon.status === 404, 'and it is not readable without the admin key', anon.status);
  } catch (e) { ok(false, 'endpoint threw: ' + e.message); }
  console.log('\n' + pass + ' checks, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();

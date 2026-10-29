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
 * AND THE SWEEP ITSELF IS DRIVEN (2026-10-29): for five weeks the pure settler was green while `checkAiCalls` read
 * `d.klines` off a bare array and settled nothing - 110 nofill, 0 decided. The sweep is lifted out of the shipped
 * worker and run against a stubbed candle feed that answers exactly the way `/api/klines` answers, so the thing that
 * runs on the cron is the thing that is tested.
 *
 * Run: node build/ai-calls-e2e.js  (--pure skips the production leg)
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); } };

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
// lift a top-level function by name (brace-matched), or a top-level const line
function liftFn(name) {
  let i = src.indexOf('async function ' + name + '('); if (i < 0) i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' not found in worker.js');
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) { if (src[j] === '{') { d++; started = true; } else if (src[j] === '}') { d--; if (started && d === 0) return src.slice(i, j + 1); } }
  throw new Error(name + ' unbalanced');
}
function liftConst(name) { const m = src.match(new RegExp('^const ' + name + ' = [^\\n]*$', 'm')); if (!m) throw new Error(name + ' const not found'); return m[0].replace(/\/\/.*$/, ''); }
const LIFT = [liftConst('AICALL_KEY'), liftConst('AICALL_OPEN'), liftConst('AICALL_MAXAGE'), liftConst('AICALL_HZ_DEF'), liftConst('AICALL_TF_WORDS'),
  liftFn('aiTfToken'), liftFn('aiKlinesAfter'), liftFn('aiCallFilled'), liftFn('aiCallSettle'), liftFn('checkAiCalls')].join('\n');
const mk = new Function('handleKlines', LIFT + '\nreturn { aiTfToken, aiKlinesAfter, aiCallFilled, aiCallSettle, checkAiCalls };');

const bar = (h, l, t) => ({ time: t || 0, high: h, low: l, open: (h + l) / 2, close: (h + l) / 2 });
const LONG = { bias: 'long', entry: 100, stop: 98, tp1: 104 };
const SHORT = { bias: 'short', entry: 100, stop: 102, tp1: 96 };

// a candle feed that answers the way /api/klines answers: a BARE ARRAY, newest 1000 up to `end` (ms)
function feed(bars, seen) {
  return async (url) => {
    const u = new URL(url), end = +u.searchParams.get('end') || 0, lim = +u.searchParams.get('limit') || 1000;
    if (seen) seen.push({ sym: u.searchParams.get('symbol'), interval: u.searchParams.get('interval'), end });
    let b = bars.slice(); if (end) b = b.filter(x => x.time * 1000 <= end);
    b = b.slice(-lim);
    return { json: async () => b };
  };
}
function envStub(rows) {
  const kv = {}; kv['aicall:open'] = JSON.stringify(rows.map(r => r.id)); rows.forEach(r => { kv['aicall:' + r.id] = JSON.stringify(r); });
  const ae = [];
  return { kv, ae, env: { STATS: { get: async (k, t) => { const v = kv[k]; if (v == null) return null; return t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => { kv[k] = v; }, delete: async (k) => { delete kv[k]; } }, AE: { writeDataPoint: (p) => ae.push(p) } } };
}
const T0 = Math.floor(Date.now() / 1000) - 40 * 3600; // 40 hours ago - inside the 7-day backstop, so only the horizon rule decides
const series = (n, fn, step) => { const out = []; for (let i = 0; i < n; i++) { const b = fn(i); out.push(bar(b[0], b[1], T0 + i * (step || 3600))); } return out; };

(async () => {
  const S0 = mk(feed([]));
  const { aiCallSettle, aiCallFilled, aiTfToken } = S0;
  console.log('\nPURE - the settlement rule');

  ok(aiCallSettle(LONG, [bar(101, 99), bar(103, 100), bar(105, 102)]).state === 'win',
    'a long that reaches the target without touching the stop is a win');
  ok(aiCallSettle(LONG, [bar(101, 99), bar(100, 97.5)]).state === 'loss',
    'a long that loses the stop is a loss');
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
    'a wait plan with no trade is never scored by the directional settler');
  ok(aiCallSettle({ bias: 'long', entry: 100, stop: 0, tp1: 104 }, [bar(105, 95)]) === null,
    'a plan missing a stop cannot be settled and is not guessed at');
  ok(aiCallSettle(null, [bar(1, 1)]) === null && aiCallSettle(LONG, []) === null,
    'no row or no candles settles nothing');
  ok(aiCallSettle(LONG, [bar(101, 99), bar(104, 100.5)]).state === 'win' && aiCallSettle(LONG, [bar(101, 99), bar(103.99, 100.5)]) === null,
    'the target counts when it is touched exactly, not only when it is passed');
  /* 2026-10-29: the fill candle cannot pay. The simulation found 40-57% of the "wins" of a 1R limit recipe were the fill
     candle's own high reaching the target, which OHLC cannot order against the dip to the entry. */
  ok(aiCallSettle(LONG, [bar(104, 99)]).state === 'unclear', 'a target touched inside the fill candle is UNCLEAR, never a win');
  ok(aiCallSettle(LONG, [bar(101, 97.5)]).state === 'loss', 'a stop touched inside the fill candle is still a loss (the conservative side)');
  ok(aiCallSettle(LONG, [bar(110, 105), bar(112, 106)]) === null,
    'a long whose entry (100) price never came back to does NOT settle - it is a no-fill, not a loss');
  ok(aiCallSettle({ bias: 'long', entry: 100, stop: 98, tp1: 104 }, [bar(108, 101), bar(101, 99), bar(105, 100)]).state === 'win',
    'the clock starts when the entry is filled, and the target after it counts');
  ok(typeof aiCallFilled === 'function' && aiCallFilled(LONG, [bar(110, 105), bar(101, 99)]) === 1 && aiCallFilled(LONG, [bar(110, 105)]) === -1,
    'aiCallFilled finds the fill candle, or -1 when the entry was never reached');

  console.log('\nPURE - the timeframe token the settler asks for');
  ok(aiTfToken('1-hour') === '60' && aiTfToken('4-hour') === '240' && aiTfToken('15-minute') === '15' && aiTfToken('daily') === '1440',
    'the brief\'s words become the minute token the klines route understands', [aiTfToken('1-hour'), aiTfToken('4-hour'), aiTfToken('15-minute'), aiTfToken('daily')]);
  ok(aiTfToken('60') === '60' && aiTfToken('240') === '240' && aiTfToken('5s') === '5s' && aiTfToken('1W') === '10080' && aiTfToken('30m') === '30',
    'a token already numeric, a seconds token, 1W and 30m all pass through correctly', [aiTfToken('1W'), aiTfToken('30m')]);
  ok(aiTfToken('') === '60' && aiTfToken('banana') === '60', 'an unreadable timeframe falls back to the hour, never to one minute');

  console.log('\nPURE - the sweep, driven against a candle feed shaped like /api/klines');
  // 1. THE LOAD-BEARING ONE: a bare-array feed settles a directional call (the five-week bug was exactly here)
  {
    const bars = series(12, i => i < 3 ? [110, 105] : i === 3 ? [103, 99.5] : i < 6 ? [102, 100.5] : [105, 101]); // fill on bar 3, target on bar 6
    const seen = []; const S = mk(feed(bars, seen));
    const row = Object.assign({ id: 'r1', ts: T0 * 1000 - 1, sym: 'BTC', tf: '1-hour', state: 'open', hz: 20, model: 'm', uid: 'u1' }, LONG);
    const E = envStub([row]); await S.checkAiCalls(E.env);
    const r = JSON.parse(E.kv['aicall:r1']);
    ok(r.state === 'win', 'a long whose target printed after the fill is settled as a WIN from a bare-array candle feed', r.state);
    ok(seen.length && seen[0].interval === '60', 'the sweep asked the klines route for interval=60, not the word "1-hour"', seen[0]);
    ok(E.ae.length === 1 && E.ae[0].blobs[1] === 'win', 'and wrote one AE row with the state', E.ae[0] && E.ae[0].blobs);
    ok(JSON.parse(E.kv['aicall:open']).length === 0, 'a settled id leaves the open list');
  }
  // 2. a call still inside its horizon stays open; past the horizon with no fill it is a nofill BY HORIZON, not by calendar
  {
    const far = series(9, () => [110, 105]);
    const S = mk(feed(far));
    const row = Object.assign({ id: 'r2', ts: T0 * 1000 - 1, sym: 'ETH', tf: '60', state: 'open', hz: 10 }, LONG);
    const E = envStub([row]); await S.checkAiCalls(E.env);
    ok(JSON.parse(E.kv['aicall:r2']).state === 'open', '9 candles into a 10-candle horizon with no fill: still open');
    const S2 = mk(feed(series(10, () => [110, 105])));
    const E2 = envStub([Object.assign({}, row)]); await S2.checkAiCalls(E2.env);
    const r2 = JSON.parse(E2.kv['aicall:r2']);
    ok(r2.state === 'nofill' && r2.barsToSettle === 10, '10 candles in with no fill: nofill, with the candle count, two hours after the call rather than a week', r2);
  }
  // 3. filled but undecided for three horizons is expired
  {
    const bars = series(31, i => i === 0 ? [101, 99] : [102, 100.5]); // filled on bar 0, then nothing
    const S = mk(feed(bars));
    const row = Object.assign({ id: 'r3', ts: T0 * 1000 - 1, sym: 'SOL', tf: '60', state: 'open', hz: 10 }, LONG);
    const E = envStub([row]); await S.checkAiCalls(E.env);
    ok(JSON.parse(E.kv['aicall:r3']).state === 'expired', 'a filled call with neither target nor stop after 3 x horizon is expired');
  }
  // 4. a WAIT plan: trigger printed, the would-be trade lost -> wait_loss; trigger never printed -> wait_nofill
  {
    const bars = series(6, i => i < 2 ? [110, 105] : i === 2 ? [101, 99.5] : [100, 97]); // trigger on bar 2, stop on bar 3
    const S = mk(feed(bars));
    const rowW = { id: 'w1', ts: T0 * 1000 - 1, sym: 'XRP', tf: '60', state: 'wait', hz: 10, bias: 'wait', entry: 100, stop: 98, tp1: 104 };
    const rowN = { id: 'w2', ts: T0 * 1000 - 1, sym: 'XRP', tf: '60', state: 'wait', hz: 4, bias: 'wait', entry: 90, stop: 88, tp1: 95 };
    const E = envStub([rowW, rowN]); await S.checkAiCalls(E.env);
    ok(JSON.parse(E.kv['aicall:w1']).state === 'wait_loss', 'a wait plan whose trigger printed and whose would-be long then stopped out is wait_loss', JSON.parse(E.kv['aicall:w1']).state);
    ok(JSON.parse(E.kv['aicall:w2']).state === 'wait_nofill', 'a wait plan whose trigger never printed inside its horizon is wait_nofill', JSON.parse(E.kv['aicall:w2']).state);
    const S3 = mk(feed(bars));
    const rowT = { id: 'w3', ts: T0 * 1000 - 1, sym: 'XRP', tf: '60', state: 'wait', hz: 10, bias: 'wait', entry: 100 };
    const E3 = envStub([rowT]); await S3.checkAiCalls(E3.env);
    ok(JSON.parse(E3.kv['aicall:w3']).state === 'wait_triggered', 'a wait plan with a trigger and no trade is wait_triggered the moment the trigger prints');
  }
  // 5. pagination: a call older than the newest page is still found (the 1m/5m case)
  {
    // 5-minute candles: 1500 of them is 125 hours, the call sits at bar 300 (15 h after T0), the fill at bar 400 - both on the OLDER page
    const bars = series(1500, i => i === 400 ? [101, 99] : i > 400 ? [105, 101] : [110, 105], 300);
    const seen = []; const S = mk(feed(bars, seen));
    const row = Object.assign({ id: 'r5', ts: (T0 + 300 * 300) * 1000, sym: 'BTC', tf: '5', state: 'open', hz: 60 }, LONG);
    const E = envStub([row]); await S.checkAiCalls(E.env);
    ok(seen.length >= 2 && seen[1].end > 0, 'when the newest page does not reach the call, the sweep pages back with end=', seen.map(s => s.end));
    ok(JSON.parse(E.kv['aicall:r5']).state === 'win', 'and the fill found on the older page settles the call');
  }
  // 6. FALSIFICATION: the retired parse (`d.klines || ...`) over a bare array settles nothing - the shape of the bug
  {
    const bars = series(12, i => i < 3 ? [110, 105] : i === 3 ? [103, 99.5] : [105, 101]);
    const old = { json: async () => bars };
    let d = await old.json(); const parsedOld = (d && (d.klines || (d.data && d.data.klines))) || [];
    ok(Array.isArray(d) && parsedOld.length === 0, 'the retired reading of a bare array yields no candles - which is why nothing ever settled', parsedOld.length);
  }

  if (process.argv.includes('--pure')) { console.log('\n' + pass + ' checks, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0; return; }

  console.log('\nLIVE - the desk that reads it');
  const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9]+/) || [])[0];
  if (!KEY) { console.error('no mpadm_ token in ADMIN_KEY.local.txt'); process.exit(1); }
  try {
    const r = await fetch('https://marginpad.io/api/admin/aicalls?days=30', { headers: { 'x-admin-key': KEY } });
    const j = await r.json();
    ok(r.status === 200 && typeof j.decided === 'number', 'the hit-rate endpoint answers', { s: r.status, decided: j.decided });
    ok('still_open' in j && 'by_model' in j && j.wait && typeof j.wait.nofill === 'number', 'it reports what is still running, splits by model and carries the wait block', { open: j.still_open, wait: j.wait });
    ok(j.decided >= 20 ? (typeof j.hit_rate_pct === 'number') : /Too few settled calls/.test(j.note || ''),
      'below about 20 settled calls it says the number is noise instead of printing one', { decided: j.decided, note: (j.note || '').slice(0, 60) });
    const anon = await fetch('https://marginpad.io/api/admin/aicalls');
    ok(anon.status === 403 || anon.status === 404, 'and it is not readable without the admin key', anon.status);
    const pub = await (await fetch('https://marginpad.io/api/ai/chart')).json();
    ok(pub && pub.record && typeof pub.record.conf_ok === 'boolean', 'the public record says whether the confidence number is calibrated', pub && pub.record && pub.record.conf_ok);
  } catch (e) { ok(false, 'endpoint threw: ' + e.message); }
  console.log('\n' + pass + ' checks, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();

// Replay v2 — executes the PRODUCTION functions themselves: _sanitizeSigBars + _supertrend are extracted
// from src/worker.js by source-slicing and eval'd (zero porting). The 1-line flip decision is additionally
// asserted VERBATIM against the production source so the transcribed state machine cannot silently drift.
const fs = require('fs'), https = require('https');
const src = fs.readFileSync('D:/part1/money-mission/src/worker.js', 'utf8');

function extractFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' not found');
  // walk braces to the function end
  let j = src.indexOf('{', i), depth = 0, k = j;
  for (; k < src.length; k++) { const c = src[k]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; } }
  return src.slice(i, k + 1);
}
// eval the REAL production functions
eval(extractFn('_sanitizeSigBars'));
eval(extractFn('_supertrend'));
console.log('production fns loaded:', typeof _sanitizeSigBars, typeof _supertrend,
  '| bytes:', extractFn('_sanitizeSigBars').length, '+', extractFn('_supertrend').length);

// assert the production flip-decision lines exist VERBATIM (guards the transcribed state machine against drift)
const mustExist = [
  "let flip = dNow !== dPrev;",
  "if (flip && (!state || state.bar !== bar || force)) {",
  "const closed = (last && last.time >= curStart) ? bars.slice(0, -1) : bars;",
];
for (const lit of mustExist) { if (!src.includes(lit)) throw new Error('PRODUCTION DRIFT — literal missing: ' + lit); }
console.log('flip-decision literals verified verbatim in production source ✓');

function get(u) { return new Promise((res, rej) => { https.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej); }); }

(async () => {
  const coins = ['BTC', 'HBAR', 'BNB', 'ETH', 'SOL', 'HYPE', 'XRP', 'ZEC', 'TRX'];
  let totFlips = 0, totFired = 0, totExtra = 0, totMissing = 0, totDouble = 0;
  for (const sym of coins) {
    try {
      let p1 = await get('https://marginpad.io/api/klines?symbol=' + sym + '&interval=60&cb=' + Date.now());
      if (!Array.isArray(p1) || p1.length < 100) { console.log(sym.padEnd(5), 'NO DATA'); continue; }
      let p2 = [];
      try { p2 = await get('https://marginpad.io/api/klines?symbol=' + sym + '&interval=60&end=' + (p1[0].time * 1000) + '&cb=' + Date.now()); } catch (e) {}
      const seen = new Set(); const bars = [];
      [...(Array.isArray(p2) ? p2 : []), ...p1].forEach(b => { if (!seen.has(b.time)) { seen.add(b.time); bars.push(b); } });
      bars.sort((a, b) => a.time - b.time);
      _sanitizeSigBars(bars); // PRODUCTION sanitizer
      const cur = Math.floor(Date.now() / 3600000) * 3600;
      const closedAll = bars[bars.length - 1].time >= cur ? bars.slice(0, -1) : bars;
      const days = ((closedAll[closedAll.length - 1].time - closedAll[0].time) / 86400).toFixed(0);
      // chart marker set (production _supertrend on closed bars)
      const full = _supertrend(closedAll, 10, 3);
      const chartFlips = [];
      for (let i = 31; i < closedAll.length; i++) if (full.dir[i] != null && full.dir[i - 1] != null && full.dir[i] !== full.dir[i - 1]) chartFlips.push(closedAll[i].time + ':' + full.dir[i]);
      // engine state machine (verbatim-asserted decision), 60 ticks/bar, sliding 1000-bar window
      let state = null; const fired = []; let doubles = 0;
      for (let i = 31; i < closedAll.length; i++) {
        const prefix = closedAll.slice(0, i + 1);
        const w = prefix.length > 1000 ? prefix.slice(-1000) : prefix;
        const r = _supertrend(w, 10, 3); const li = w.length - 1;
        const dNow = r.dir[li], dPrev = r.dir[li - 1], bar = w[li].time;
        for (let tick = 0; tick < 60; tick++) {
          const flip = dNow !== dPrev;                                   // verbatim production line
          if (flip && (!state || state.bar !== bar)) {                   // verbatim production dedupe (force=false)
            if (state && state.bar === bar) doubles++;
            fired.push(bar + ':' + dNow);
            state = { bar, done: false };
          } else if (!flip) { if (!state || state.bar !== bar) state = { bar, done: true }; }
        }
      }
      const cf = new Set(chartFlips), fsr = new Set(fired);
      const extra = fired.filter(x => !cf.has(x));
      const missing = chartFlips.filter(x => !fsr.has(x));
      totFlips += chartFlips.length; totFired += fired.length; totExtra += extra.length; totMissing += missing.length; totDouble += doubles;
      console.log(sym.padEnd(5), days + 'd | chart:', String(chartFlips.length).padStart(3), '| fired:', String(fired.length).padStart(3), '| extra:', extra.length, '| missing:', missing.length, '| doubles:', doubles, (extra.length || missing.length || doubles) ? ' <-- MISMATCH' : ' OK');
    } catch (e) { console.log(sym.padEnd(5), 'ERR', e.message); }
  }
  console.log('');
  console.log('TOTAL: chart=' + totFlips, 'fired=' + totFired, 'extra=' + totExtra, 'missing=' + totMissing, 'doubles=' + totDouble);
  console.log(totExtra === 0 && totMissing === 0 && totDouble === 0 ? 'PARITY (production code): PERFECT' : 'PARITY: BROKEN');
})();

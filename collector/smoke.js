// POST-DEPLOY SMOKE TEST FOR THE COLLECTOR (2026-09-25).
//
// It exists because of an outage that nothing caught: one line of /api/v1/tape read a variable that had been
// renamed, so every call to it threw ReferenceError, express answered 500, the error was uncaught and pm2
// restarted the process - 85 times. The tape, the order book, the film and the liquidation feed were all dark
// behind that single name, and `pm2 list` said "online" throughout. A deploy here had no check of any kind.
//
// Every public route is asked for a real answer and the SHAPE is inspected, because a 200 carrying `{}` is the
// other way this fails. Exits 1 on any failure.
//
// Usage, on the droplet:  node smoke.js          (defaults to 127.0.0.1:8787)
//        from anywhere:   node smoke.js https://marginpad.io/api/v1
const BASE = (process.argv[2] || 'http://127.0.0.1:8787/api/v1').replace(/\/$/, '');

const CHECKS = [
  ['status', '/status', (j) => (j && j.uptimeMs != null) || j.venues || j.exchanges ? '' : 'no venue/uptime figures'],
  ['tape (live)', '/tape?symbol=BTC&limit=5', (j) => Array.isArray(j && j.trades) ? '' : 'no trades array'],
  // every filter the page offers, because the ring SELECTION is what broke
  ['tape $50k', '/tape?symbol=BTC&limit=2&bigmin=50000', (j) => Array.isArray(j && j.big) && j.bigRingFloorUsd === 50000 ? '' : 'ring floor ' + (j && j.bigRingFloorUsd)],
  ['tape $250k', '/tape?symbol=BTC&limit=2&bigmin=250000', (j) => Array.isArray(j && j.big) && j.bigRingFloorUsd === 250000 ? '' : 'ring floor ' + (j && j.bigRingFloorUsd) + ' (the mid ring should answer this)'],
  ['tape $1M', '/tape?symbol=BTC&limit=2&bigmin=1000000', (j) => Array.isArray(j && j.big) && j.bigRingFloorUsd === 1000000 ? '' : 'ring floor ' + (j && j.bigRingFloorUsd)],
  ['book', '/book?symbol=BTC&levels=5', (j) => (j && (j.bids || j.levels)) ? '' : 'no ladder'],
  ['bookmap', '/bookmap?symbol=BTC&mins=5&only=walls', (j) => (j && (j.cols || j.building || j.wallsStanding)) ? '' : 'no film'],
  ['feed', '/feed?limit=5', (j) => Array.isArray(j) || Array.isArray(j && j.events) ? '' : 'no liquidation events'],
  ['pulse', '/pulse', (j) => j && typeof j === 'object' ? '' : 'empty'],
];

(async () => {
  const fails = [];
  for (const [what, path, shape] of CHECKS) {
    const url = BASE + path + (path.includes('?') ? '&' : '?') + 'cb=' + Date.now();
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const body = await r.text();
      if (r.status !== 200) { fails.push(what + ' -> HTTP ' + r.status + ' ' + body.slice(0, 120)); continue; }
      let j = null;
      try { j = JSON.parse(body); } catch (e) { fails.push(what + ' -> not JSON: ' + body.slice(0, 100)); continue; }
      const bad = shape(j);
      if (bad) fails.push(what + ' -> ' + bad);
    } catch (e) { fails.push(what + ' -> ' + String((e && e.message) || e).slice(0, 90)); }
  }
  if (fails.length) {
    console.error('collector smoke: FAIL (' + BASE + ')');
    fails.forEach((f) => console.error('  x ' + f));
    process.exitCode = 1;
    return;
  }
  console.log('collector smoke: OK - ' + CHECKS.length + ' routes answer with the right shape (' + BASE + ')');
})();

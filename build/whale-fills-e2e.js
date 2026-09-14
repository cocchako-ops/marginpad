// Whale trade feed (2026-09-14) — owner: "jedan prozor gde izbacuje da je neko kupio 200k BTC long
// po tom i tom leverage u to i to vreme sa vremenskom zonom".
//
// The feature IS the aggregation, so this runs the collector's REAL functions over REAL fills pulled
// from Hyperliquid — a reimplementation in the test would prove nothing. Then it checks the live
// worker endpoint and the page.
//
//   node build/whale-fills-e2e.js
const { pathToFileURL } = require('url');
const path = require('path');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 300) : '')); } };
const post = (body) => fetch('https://api.hyperliquid.xyz/info', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
}).then(r => r.json());

(async () => {
  const { _fillsTest } = await import(pathToFileURL(path.join(__dirname, '..', 'collector', 'src', 'whales.js')).href);
  const { foldFills, flushLocal, state, reset, consts } = _fillsTest;

  // ── 1. the real grouping over real fills ────────────────────────────────────────────────────────
  console.log('\nthe grouping, run on real Hyperliquid fills');
  const w = await (await fetch('https://collector.marginpad.io/api/v1/whales')).json();
  const users = [...new Set((w.positions || []).map(p => p.user))].slice(0, 8);
  ok(users.length >= 4, 'got whale wallets to read (' + users.length + ')');

  const raw = {};
  for (const u of users) {
    try { const r = await post({ type: 'userFillsByTime', user: u, startTime: Date.now() - 3600e3, aggregateByTime: true }); if (Array.isArray(r)) raw[u] = r; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  const total = Object.values(raw).reduce((a, b) => a + b.length, 0);
  ok(total > 0, 'Hyperliquid returned fills for the last hour (' + total + ' across ' + Object.keys(raw).length + ' wallets)');

  reset({});
  for (const [u, rows] of Object.entries(raw)) foldFills(u, rows);
  flushLocal(Date.now() + consts.GROUP_MS + 1);   // close every group so the whole hour is published
  const out = state.fills.slice();
  console.log('   ' + total + ' raw fills -> ' + out.length + ' trades over $' + (consts.MIN_TRADE_USD / 1000) + 'k');

  ok(out.length > 0, 'the hour produced at least one publishable trade');
  ok(out.length < total, 'and far fewer trades than fills — this is an aggregate, not a fill dump (' + out.length + ' vs ' + total + ')');
  ok(out.every(t => t.usd >= consts.MIN_TRADE_USD), 'every published trade clears the floor');
  ok(out.every(t => t.ts > 0 && t.tsEnd >= t.ts), 'every trade carries both ends of its execution');
  ok(out.every(t => t.tsEnd - t.ts >= 0 && t.tsEnd - t.ts < 6 * 3600e3), 'no execution window is absurd');
  ok(out.every(t => t.n >= 1), 'every trade reports how many fills it is made of');
  ok(out.every(t => ['open', 'close', 'flip'].indexOf(t.act) >= 0), 'every trade has a known action', out.find(t => ['open', 'close', 'flip'].indexOf(t.act) < 0));
  ok(out.every(t => !String(t.sym).startsWith('@')), 'no spot rows — this is a futures feed', out.find(t => String(t.sym).startsWith('@')));
  ok(out.every(t => t.px > 0), 'every trade has an average fill price');

  // the average price must sit inside the range of the fills it came from
  { let bad = null;
    for (const t of out) {
      const src = (raw[t.user] || []).filter(f => f.coin === t.sym && f.dir === t.dir && +f.time >= t.ts && +f.time <= t.tsEnd).map(f => +f.px);
      if (!src.length) continue;
      const lo = Math.min(...src), hi = Math.max(...src);
      if (!(t.px >= lo - 1e-9 && t.px <= hi + 1e-9)) { bad = { sym: t.sym, px: t.px, lo, hi }; break; }
    }
    ok(!bad, 'the average price sits inside the range of its own fills', bad);
  }
  // and the size must be the sum of those fills
  { let bad = null;
    for (const t of out) {
      const src = (raw[t.user] || []).filter(f => f.coin === t.sym && f.dir === t.dir && +f.time >= t.ts && +f.time <= t.tsEnd);
      if (!src.length) continue;
      const sum = src.reduce((a, f) => a + Math.abs(+f.sz), 0);
      if (Math.abs(sum - t.sz) / Math.max(sum, 1e-9) > 0.02) { bad = { sym: t.sym, sz: t.sz, sum, n: t.n, fills: src.length }; break; }
    }
    ok(!bad, 'the size is the sum of its own fills', bad);
  }
  ok(out.length <= consts.MAX_FILLS, 'the ring is capped (' + out.length + ' <= ' + consts.MAX_FILLS + ')');
  // a group publishes when it goes quiet, so publication order is NOT the order things happened
  { let bad = null; for (let i = 1; i < out.length; i++) if (out[i].ts > out[i - 1].ts) { bad = { i, a: out[i - 1].ts, b: out[i].ts }; break; }
    ok(!bad, 'the feed is newest-first by the clock each row prints', bad); }

  // a fill already counted must never be counted twice — the rotation re-reads overlapping windows
  { const before = state.fills.length;
    for (const [u, rows] of Object.entries(raw)) foldFills(u, rows);
    flushLocal(Date.now() + consts.GROUP_MS + 1);
    ok(state.fills.length === before, 'replaying the same fills adds nothing (the cursor holds)', { before, after: state.fills.length });
  }

  // leverage comes from the position, not the fill
  { reset({ [users[0] + '|BTC']: 25 });
    const t0 = Date.now() - 600e3;
    foldFills(users[0], [
      { coin: 'BTC', dir: 'Open Long', time: t0, px: '78000', sz: '3', closedPnl: '0' },
      { coin: 'BTC', dir: 'Open Long', time: t0 + 30e3, px: '78100', sz: '2', closedPnl: '0' },
    ]);
    flushLocal(Date.now());
    const t = state.fills[0];
    ok(!!t && t.lev === 25, 'leverage is joined from the open position (a fill does not carry it)', t);
    ok(!!t && t.sz === 5 && Math.abs(t.usd - (78000 * 3 + 78100 * 2)) < 1, 'two fills 30 s apart are ONE trade', t);
    ok(!!t && t.n === 2, 'and it says so (2 fills)', t);
  }
  // outside the window they are two trades
  { reset({});
    const t0 = Date.now() - 3600e3;
    foldFills('0xtest', [
      { coin: 'ETH', dir: 'Open Short', time: t0, px: '2500', sz: '120', closedPnl: '0' },
      { coin: 'ETH', dir: 'Open Short', time: t0 + consts.GROUP_MS + 5000, px: '2510', sz: '140', closedPnl: '0' },
    ]);
    flushLocal(Date.now());
    ok(state.fills.length === 2, 'fills further apart than the window are two trades', state.fills.length);
  }
  // a trade under the floor is not published
  { reset({});
    foldFills('0xtest2', [{ coin: 'SOL', dir: 'Open Long', time: Date.now() - 3600e3, px: '100', sz: '10', closedPnl: '0' }]);
    flushLocal(Date.now());
    ok(state.fills.length === 0, 'a $1k trade never reaches the feed');
  }
  // a group still filling is not published early
  { reset({});
    const now = Date.now();
    foldFills('0xtest3', [{ coin: 'BTC', dir: 'Open Long', time: now - 1000, px: '78000', sz: '10', closedPnl: '0' }]);
    flushLocal(now);
    ok(state.fills.length === 0, 'a trade still being executed is held back, not printed at part size');
    flushLocal(now + consts.GROUP_MS + 1);
    ok(state.fills.length === 1, 'and published once it has gone quiet');
  }
  // spot is dropped rather than guessed at
  { reset({});
    foldFills('0xtest4', [{ coin: '@107', dir: 'Sell', time: Date.now() - 3600e3, px: '80', sz: '100000', closedPnl: '0' }]);
    flushLocal(Date.now());
    ok(state.fills.length === 0, 'a spot fill is dropped — this is a futures feed');
  }

  // ── 2. live surfaces ────────────────────────────────────────────────────────────────────────────
  console.log('\nlive');
  try {
    const c = await (await fetch('https://collector.marginpad.io/api/v1/whales', { signal: AbortSignal.timeout(15000) })).json();
    ok(Array.isArray(c.fills), 'the collector publishes a fills array (' + (c.fills || []).length + ')');
    ok(+c.fillWatch > 0, 'and says how many wallets it watches for trades (' + c.fillWatch + ')');
    ok(+c.fillMin > 0, 'and the floor it applies ($' + ((+c.fillMin || 0) / 1000) + 'k)');
  } catch (e) { ok(false, 'collector reachable', String(e).slice(0, 90)); }

  try {
    const h = await (await fetch('https://marginpad.io/api/cg/hyper?cb=' + Date.now(), { signal: AbortSignal.timeout(15000) })).json();
    ok(Array.isArray(h.fills), 'the worker passes the trades through to /api/cg/hyper (' + (h.fills || []).length + ')');
    ok(h.fills === undefined || h.fills.every(t => t.ts > 0 && t.usd >= 0), 'and every row carries a timestamp');
  } catch (e) { ok(false, '/api/cg/hyper reachable', String(e).slice(0, 90)); }

  console.log('\nwhale-fills-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

/* THE VENUE IS PART OF THE PRICE (2026-11-12, Ladyp03's ticket: three "liquidations" the Bybit tape never made).
   A position on a Bybit-listed perp is opened against the Bybit websocket price and charted on Bybit candles, so a stop,
   a target and a liquidation must be settled from Bybit candles and Bybit prices. The sweep's `leanKlines` fell through
   to OKX and Gate whenever Bybit was slow or refused; OKX quotes ANTHROPIC-USDT-SWAP at a tenth of Bybit's contract and a
   thin OKX/Gate wick on INIT and PIEVERSE reached levels Bybit's low never did. `settleFeed` now pins a Bybit-listed
   symbol to Bybit and HOLDS it when Bybit cannot answer.

   --pure   lifts leanKlines / bybitLinSet / fetchPriceBybit / settleFeed out of the SHIPPED worker with a stubbed fetch
            and drives the exact failure: Bybit silent, OKX eager.
   --falsify  serves the retired shape (no bybitOnly stop) and must turn the load-bearing checks red.
   (default) the pure half + production: the sweep stamp says how many symbols were pinned and that Bybit was up.
   node build/venue-pin-e2e.js [--pure] [--falsify]                                                                */
'use strict';
const fs = require('fs'), path = require('path');
const PURE = process.argv.includes('--pure'), FALS = process.argv.includes('--falsify');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
let src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
if (FALS) { // the retired shape: a pinned miss falls through to OKX like any other
  const a = "  if (!out && bOnly) return null;"; if (src.indexOf(a) < 0) throw new Error('falsify anchor'); src = src.split(a).join('  if (false) return null;');
}
function lift(name) {
  const i = src.indexOf('async function ' + name + '(');
  if (i < 0) throw new Error('no ' + name);
  let d = 0, j = src.indexOf('{', i), k = j;
  for (; k < src.length; k++) { const ch = src[k]; if (ch === '{') d++; else if (ch === '}') { d--; if (!d) break; } }
  return src.slice(i, k + 1);
}
const code = ['leanKlines', 'bybitGet', 'bybitLinSet', 'fetchPriceBybit', 'settleFeed', 'fetchTO', 'fetchPriceCached'].map(lift).join('\n');
const bars = (lo) => [[String(Date.now() - 60000), '1', '1.01', String(lo), '1.005'], [String(Date.now() - 120000), '1', '1.02', '0.995', '1.0']];
const okxBars = (lo) => [[String(Date.now() - 60000), '1', '1.01', String(lo), '1.005'], [String(Date.now() - 120000), '1', '1.02', '0.995', '1.0']];

function harness(mode) {
  // mode.bybitKl: 'ok' | 'slow' | '500'  mode.bybitTick: 'ok' | 'down'  mode.okxLow: number
  const log = [];
  const stubFetch = async (url, opts) => {
    const u = String(url); log.push(u);
    const j = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } });
    if (u.indexOf('api.bybit.com/v5/market/kline') >= 0) {
      if (mode.bybitKl === 'slow') await new Promise(r => setTimeout(r, 2500));
      if (mode.bybitKl === '500') return j({ retCode: 10006 }, 500);
      if (mode.bybitKl === 'ok') return j({ result: { list: bars(0.99) } });
      return j({ result: { list: [] } });
    }
    if (u.indexOf('api.bybit.com/v5/market/tickers?category=linear&symbol=') >= 0) {
      if (mode.bybitTick === 'down') return j({}, 503);
      return j({ result: { list: [{ symbol: 'PINNEDUSDT', lastPrice: '1.000', price24hPcnt: '0.01' }] } });
    }
    if (u.indexOf('api.bybit.com/v5/market/tickers?category=linear') >= 0) {
      if (mode.bybitTick === 'down') return j({}, 503);
      const list = []; for (let i = 0; i < 60; i++) list.push({ symbol: 'C' + i + 'USDT', lastPrice: '2', fundingRate: '0.0001' });
      list.push({ symbol: 'PINNEDUSDT', lastPrice: '1.000', fundingRate: '0.0002' });
      list.push({ symbol: '1000PEPEUSDT', lastPrice: '4.5', fundingRate: '0.0001' });
      return j({ result: { list } });
    }
    if (u.indexOf('okx.com/api/v5/market/candles') >= 0) return j({ data: okxBars(mode.okxLow) });
    if (u.indexOf('okx.com/api/v5/market/ticker') >= 0) return j({ data: [{ last: String(mode.okxLow), open24h: '1' }] });
    if (u.indexOf('gateio.ws') >= 0) return j([], 200);
    if (u.indexOf('mexc.com') >= 0) return j({}, 404);
    if (u.indexOf('collector.marginpad.io') >= 0) return j({}, 404);
    return j({}, 404);
  };
  const cacheStore = new Map();
  const caches = { default: { match: async (req) => cacheStore.get(req.url) ? cacheStore.get(req.url).clone() : undefined, put: async (req, resp) => { cacheStore.set(req.url, resp); } } };
  const kv = new Map();
  const env = { STATS: { get: async (k) => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); } } };
  if (mode.kvSet) kv.set('bybit:linset', JSON.stringify({ ts: Date.now(), syms: mode.kvSet }));
  const g = { __bybLin: null };
  const fn = new Function('fetch', 'caches', 'Request', 'Response', 'globalThis', 'yahooSymFor', 'mpadIs', '_yahooChart', 'fetchPrice',
    code + '\nreturn { leanKlines, bybitLinSet, fetchPriceBybit, settleFeed };');
  const fetchPrice = async (s) => { // the cascade price, as the shipped fetchPrice would answer with Bybit down: OKX
    const r = await stubFetch('https://www.okx.com/api/v5/market/ticker?instId=' + s + '-USDT-SWAP'); const d = await r.json(); const it = d && d.data && d.data[0]; return it ? { sym: s, price: +it.last, src: 'okx' } : null;
  };
  const api = fn(stubFetch, caches, Request, Response, g, () => null, () => false, async () => null, fetchPrice);
  return { api, env, log, kv };
}

(async () => {
  console.log('-- pure: the shipped functions over a stubbed market');
  // A. Bybit candles slow, OKX eager with a wick below any sane liq: a pinned symbol gets NO candles.
  {
    const h = harness({ bybitKl: 'slow', bybitTick: 'ok', okxLow: 0.1 });
    const pin = await h.api.bybitLinSet(h.env);
    ok(pin && !pin.down && pin.set.has('PINNED') && pin.n === 63, 'bybitLinSet reads the tickers once: 63 symbols (61 + the alias), PINNED among them, not down');
    ok(pin && pin.px && pin.px.PINNED === 1 && pin.fund && pin.fund.PINNED === 0.0002, 'the same call carries the price (1.000) and the funding rate');
    ok(h.kv.has('bybit:linset'), 'the set is written to KV for a Bybit outage');
    const sf = await h.api.settleFeed('PINNED', h.env, pin);
    ok(sf.inB === true, 'PINNED is recognised as a Bybit symbol');
    ok(sf.pd && sf.pd.price === 1 && sf.pd.src === 'bybit', 'its price is Bybit\'s 1.000, not OKX\'s 0.1 (' + JSON.stringify(sf.pd) + ')');
    ok(sf.lk === null, 'LOAD-BEARING: Bybit candles timed out and the symbol gets NO candles - OKX\'s 0.1 wick is never handed to the sweep (lk=' + JSON.stringify(sf.lk) + ')');
    ok(!h.log.some(u => u.indexOf('okx.com/api/v5/market/candles') >= 0 && u.indexOf('PINNED') >= 0), 'OKX candles were never even asked for PINNED');
    ok(sf.held === false, 'Bybit is up, so the symbol is not marked held (a plain miss on one call)');
  }
  // B. Bybit refuses (500) - same answer, and a second ask inside 10 s does not serve a cached miss.
  {
    const h = harness({ bybitKl: '500', bybitTick: 'ok', okxLow: 0.1 });
    const pin = await h.api.bybitLinSet(h.env);
    const a = await h.api.leanKlines('PINNED', '1', 30, h.env, { bybitOnly: true });
    ok(a === null, 'a Bybit 500 on a pinned symbol answers null, not OKX candles');
    const n0 = h.log.filter(u => u.indexOf('kline') >= 0 && u.indexOf('bybit') >= 0).length;
    await h.api.leanKlines('PINNED', '1', 30, h.env, { bybitOnly: true });
    const n1 = h.log.filter(u => u.indexOf('kline') >= 0 && u.indexOf('bybit') >= 0).length;
    ok(n1 === n0 + 1, 'a miss is never cached: the second ask reaches Bybit again (' + n0 + ' -> ' + n1 + ')');
    const c = await h.api.leanKlines('OTHER', '1', 30, h.env);
    ok(c && c.length === 2 && c.some(b => b.low === 0.1), 'an UNPINNED symbol keeps the cascade and takes OKX candles (the delist path)');
    const d = await h.api.leanKlines('OTHER', '1', 30, h.env, { bybitOnly: true });
    ok(d === null, 'the pinned key is its own cache entry: the cascade answer cached a moment ago is not handed to a pinned ask');
  }
  // C. Bybit answers: the pinned symbol gets Bybit's candles.
  {
    const h = harness({ bybitKl: 'ok', bybitTick: 'ok', okxLow: 0.1 });
    const pin = await h.api.bybitLinSet(h.env);
    const sf = await h.api.settleFeed('PINNED', h.env, pin);
    ok(sf.lk && sf.lk.length === 2 && sf.lk.some(b => b.low === 0.99), 'with Bybit up, the pinned symbol gets Bybit\'s candles (low 0.99)');
  }
  // D. Bybit wholly down, KV set known: the pinned symbol is HELD; an unknown symbol still cascades.
  {
    const h = harness({ bybitKl: 'slow', bybitTick: 'down', okxLow: 0.1, kvSet: ['PINNED', 'C1'] });
    const pin = await h.api.bybitLinSet(h.env);
    ok(pin && pin.down === true && pin.set.has('PINNED') && pin.px === null, 'with the tickers down the set comes from KV and is marked down');
    const sf = await h.api.settleFeed('PINNED', h.env, pin);
    ok(sf.pd === null && sf.lk === null && sf.held === true, 'LOAD-BEARING: a pinned symbol during a Bybit outage is HELD - no price, no candles, held:true (' + JSON.stringify({ pd: sf.pd, lk: sf.lk, held: sf.held }) + ')');
    const o = await h.api.settleFeed('OTHER', h.env, pin);
    ok(o.inB === false && o.pd && o.pd.src === 'okx', 'a symbol outside the set still prices through the cascade (' + (o.pd && o.pd.src) + ')');
  }
  // E. Nothing known at all (first run ever, Bybit down): null pin, callers fall back to the cascade as before.
  {
    const h = harness({ bybitKl: 'slow', bybitTick: 'down', okxLow: 0.1 });
    const pin = await h.api.bybitLinSet(h.env);
    ok(pin === null, 'no tickers and no KV set: bybitLinSet answers null');
    const sf = await h.api.settleFeed('PINNED', h.env, pin);
    ok(sf.inB === false, 'with no set known nothing is pinned (the old behaviour, so a brand-new deploy can never freeze every sweep)');
  }
  // F. The structural guards: every settlement caller goes through settleFeed; the old bare pair is gone from them.
  {
    const stripped = src.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const bare = (stripped.match(/const lk = await leanKlines\((sym2|k|s2), '1', 30, env\);/g) || []).length;
    ok(bare === 0, 'no settlement caller fetches 1m candles for the sweep outside settleFeed (' + bare + ' bare calls)');
    const calls = (stripped.match(/await settleFeed\(/g) || []).length;
    ok(calls >= 4, 'settleFeed is used by the cron sweep, the nudge, the order sweep and the admin porders run (' + calls + ')');
    ok(/fetchPriceBybit\(k9, env, \{[^}]*\}\) : await fetchPriceCached\(symC\)/.test(stripped), 'the site close prices a Bybit symbol from Bybit alone');
  }
  // G. The 1000x alias: PEPE is pinned to Bybit's 1000PEPEUSDT at a thousandth, candles included.
  {
    const h = harness({ bybitKl: 'ok', bybitTick: 'ok', okxLow: 0.1 });
    const pin = await h.api.bybitLinSet(h.env);
    ok(pin.set.has('PEPE') && pin.alias && pin.alias.PEPE === '1000PEPEUSDT', 'PEPE is in the set through the alias 1000PEPEUSDT');
    ok(Math.abs(pin.px.PEPE - 0.0045) < 1e-9, 'its price is the contract\'s divided by 1000 (' + pin.px.PEPE + ')');
    const sf = await h.api.settleFeed('PEPE', h.env, pin);
    ok(sf.inB && sf.pd && Math.abs(sf.pd.price - 0.0045) < 1e-9, 'settleFeed prices PEPE at the scaled Bybit price');
    ok(sf.lk && sf.lk.length === 2 && Math.abs(sf.lk[0].low - 0.000995) < 1e-9, 'and its candles are the 1000PEPE contract scaled down (low ' + (sf.lk && sf.lk[0].low) + ')');
    ok(h.log.some(u => u.indexOf('kline') >= 0 && u.indexOf('symbol=1000PEPEUSDT') >= 0), 'the candle request named the raw contract');
  }
  if (!PURE && !FALS) {
    console.log('-- production: the sweep stamp');
    const O = process.env.MP_ORIGIN || 'https://marginpad.io';
    const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
    try {
      const r = await fetch(O + '/api/admin/sweepstat', { headers: { 'x-admin-key': K } }); const b = await r.json();
      const st = b && (b.last || b.sweep || b);
      const fresh = st && st.ts && Date.now() - st.ts < 10 * 60000;
      ok(fresh, 'the sweep ran inside the last ten minutes (' + (st && st.ts ? Math.round((Date.now() - st.ts) / 1000) + 's ago' : 'no stamp') + ')');
      ok(st && typeof st.pinned === 'number' && st.pinned > 0, 'it pinned Bybit symbols (pinned=' + (st && st.pinned) + ', bybitSet=' + (st && st.bybitSet) + ')');
      ok(st && st.bybitDown === false, 'Bybit was reachable for it (bybitDown=' + (st && st.bybitDown) + ', held=' + (st && st.held) + ')');
    } catch (e) { ok(false, 'sweepstat unreachable: ' + e.message); }
  }
  console.log('\n' + pass + ' ok, ' + fail + ' failed' + (FALS ? ' (falsify run: red is the point)' : ''));
  process.exitCode = fail ? 1 : 0;
})();

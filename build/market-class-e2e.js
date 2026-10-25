/* WHAT A TICKER IS MUST BE DECIDED ONCE (2026-10-25).
 *
 * `assetClassOf` in the worker reads four hand-kept tables (STOCKS, COMMOD, IDX_SYMS, FX_SYMS) and that answer
 * decides THREE things a trader pays for: the taker fee (0.02% stock vs 0.055% crypto), the leverage cap, and
 * whether the market-closed guard applies. Meanwhile `/api/symbols` offers whatever Bybit trades. Nothing ever
 * compared the two, so on 2026-10-24 ninety-two companies were added and six of their tickers were already
 * COINS on Bybit - DASH (Dash), CVX (Convex Finance), CL (WTI crude), F (SynFutures), T (Threshold), DIA (dia).
 * Two members had entered DASH at the coin's price and were being marked against DoorDash: -2374% and +4634% ROE,
 * the second of them realisable onto a board that pays real money.
 *
 * Bybit publishes `symbolType` on every instrument, so this is checkable rather than a matter of remembering.
 * Run after ANY change to STOCKS / COMMOD / IDX_SYMS / FX_SYMS / SYM_DROP / handleSymbols / handleCoinIcon.
 *   node build/market-class-e2e.js
 */
'use strict';
const fs = require('fs');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const BY = 'https://api.bybit.com/v5/market';
const LIQ = 5e6; // handleSymbols' own floor: only perps over $5M of 24h turnover are offered

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra ? '\n         ' + extra : '')); } };

// ---- the tables, lifted out of the SHIPPED worker so the test cannot drift from what runs ----
function tableOf(src, name) {
  const i = src.indexOf('const ' + name + ' = {');
  if (i < 0) throw new Error('table not found in worker source: ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  const body = src.slice(src.indexOf('{', i), j + 1);
  // eslint-disable-next-line no-new-func
  return new Function('return (' + body + ')')();
}

(async () => {
  const src = fs.readFileSync('src/worker.js', 'utf8');
  const STOCKS = tableOf(src, 'STOCKS'), COMMOD = tableOf(src, 'COMMOD');
  const IDX = tableOf(src, 'IDX_SYMS'), FX = tableOf(src, 'FX_SYMS'), BEQ = tableOf(src, 'BYBIT_EQ');
  const classOf = (s) => { s = String(s).toUpperCase(); return (STOCKS[s] || BEQ[s]) ? 'stock' : COMMOD[s] ? 'metal' : IDX[s] ? 'index' : FX[s] ? 'forex' : 'crypto'; };

  console.log('tables: STOCKS ' + Object.keys(STOCKS).length + ', BYBIT_EQ ' + Object.keys(BEQ).length + ', COMMOD ' + Object.keys(COMMOD).length +
    ', IDX ' + Object.keys(IDX).length + ', FX ' + Object.keys(FX).length);
  // A ticker in BOTH tables is the ambiguity this whole file exists to stop: STOCKS means "price it from Yahoo",
  // BYBIT_EQ means "price it from Bybit", and whichever is checked first would silently decide.
  {
    const both = Object.keys(BEQ).filter(s => STOCKS[s]);
    ok(!both.length, 'no ticker is in BOTH STOCKS and BYBIT_EQ (the feed would be ambiguous)', both.join(', '));
  }

  // ---- what Bybit says each of its own perps is ----
  const ii = await (await fetch(BY + '/instruments-info?category=linear&limit=1000')).json();
  const tk = await (await fetch(BY + '/market/tickers?category=linear')).json().catch(() => null)
    || await (await fetch(BY + '/tickers?category=linear')).json();
  const turn = {};
  for (const t of ((tk.result && tk.result.list) || [])) turn[t.symbol] = +t.turnover24h || 0;
  const inst = ((ii.result && ii.result.list) || []).filter(x => /USDT$/.test(x.symbol) && x.status === 'Trading');
  const liquid = inst.filter(x => (turn[x.symbol] || 0) >= LIQ);
  const bySym = {};
  for (const x of inst) bySym[x.symbol.replace(/USDT$/, '')] = x;
  console.log('bybit: ' + inst.length + ' trading USDT perps, ' + liquid.length + ' over the $5M floor\n');

  const isEquity = (x) => x && (x.symbolType === 'stock' || x.symbolType === 'ETF');

  // 1. A BYBIT EQUITY PERP WE OFFER MUST BE CLASSED AS A STOCK, or we charge it the crypto fee with no session.
  {
    const bad = liquid.filter(isEquity)
      .map(x => x.symbol.replace(/USDT$/, ''))
      .filter(s => classOf(s) !== 'stock');
    ok(!bad.length, 'every liquid Bybit EQUITY perp is classed as a stock',
      bad.length ? bad.map(s => s + ' = ' + (bySym[s].fullName || '?') + ' [' + bySym[s].marketRegion + '] is classed ' + classOf(s)).join('; ') : '');
  }

  // 2. A TICKER BYBIT TRADES AS A COIN AND WE CLAIM AS SOMETHING ELSE MUST NOT REACH THE CRYPTO LIST.
  //    This is the collision itself. It is allowed to EXIST (the stock keeps the ticker and prices from Yahoo),
  //    but the offer list may not publish it, or the terminal offers one ticker as two different markets.
  const feed = await (await fetch(O + '/api/symbols?nc=' + Date.now())).json();
  const offered = feed.symbols || [];
  ok(offered.length > 50, '/api/symbols answers (' + offered.length + ' symbols)');
  {
    const leak = offered.filter(s => { const c = classOf(s); return c !== 'crypto' && c !== 'metal' && !BEQ[s]; });
    ok(!leak.length, 'the crypto list carries no ticker our own tables claim for another class',
      leak.length ? leak.map(s => s + ' is ' + classOf(s)).join(', ') : '');
    const clash = Object.keys(bySym).filter(s => !isEquity(bySym[s]) && bySym[s].symbolType !== 'commodity' && classOf(s) === 'stock');
    console.log('       (collisions held apart by the filter: ' + (clash.length ? clash.map(s => s + '=' + (bySym[s].fullName || '?')).join(', ') : 'none') + ')');
  }
  // 3. METALS MUST STAY on the list - XAU/XAG really are the Bybit linear perp and mpIsBybit keeps them on the WS.
  ok(offered.indexOf('XAU') >= 0 && offered.indexOf('XAG') >= 0, 'XAU and XAG are still offered (they are Bybit perps, not Yahoo)');
  // 4. A BYBIT EQUITY PERP STAYS OFFERED AND KEEPS THE BYBIT PRICE. This is the invariant that protects live
  //    money: 17 positions are open on these, one a 49x long, and marking them against the cash listing instead
  //    would move every one of them (measured 2026-10-25: SOXL's two feeds are 1.86% apart, which at 49x is 91%
  //    of margin). `stock:true` is absent on purpose - that flag means "Yahoo answered, apply its session".
  //    REACHABILITY comes from the CLIENT's own stocks group (home.js `STK`), never from /api/symbols - that
  //    list is the crypto picker and carries a $5M turnover floor these thin equity perps sit below. Asserting
  //    the wrong one is how this check was red on working code for one run.
  {
    const home = fs.readFileSync('dist/assets/home.js', 'utf8');
    const gone = Object.keys(BEQ).filter(s => home.indexOf(s + ':1,') < 0 && home.indexOf(s + ':1}') < 0);
    ok(!gone.length, "every BYBIT_EQ market is in the client's own stocks group, so the market window offers it", gone.join(', '));
    const noBeq = Object.keys(BEQ).filter(s => !new RegExp('BEQ=\\{[^}]*\\b' + s + ':1').test(home));
    ok(!noBeq.length, 'every BYBIT_EQ market is in the client BEQ table, so it stays on the Bybit websocket', noBeq.join(', '));
    // home.js answers "what class is this" in FOUR tables and they drift: STK (the fee + the market window),
    // NONCRYPTO (the icon fallback chain), STK2 (a local resolver where mpAssetClass is out of scope) and BEQ.
    // On 2026-10-24 six tickers were right in one and wrong in another for a day. They must agree, every one.
    for (const t of ['STK', 'NONCRYPTO', 'STK2', 'BEQ']) {
      const tab = (home.match(new RegExp('\\b' + t + '=\\{[^}]*\\}')) || [''])[0];
      ok(!!tab, 'home.js still declares ' + t);
      const miss = Object.keys(BEQ).filter(s => tab.indexOf(s + ':1') < 0);
      ok(!miss.length, t.padEnd(10) + ' agrees about every Bybit equity perp', miss.join(', '));
      ok(tab.indexOf('DASH') < 0, t.padEnd(10) + ' does not claim DASH (Bybit trades it as the Dash COIN)');
    }
    for (const s of ['MU', 'SOXL', 'SKHYNIX']) {
      const j = await (await fetch(O + '/api/price?symbol=' + s, { headers: { 'cache-control': 'no-cache' } })).json().catch(() => null);
      const byr = await (await fetch(BY + '/tickers?category=linear&symbol=' + s + 'USDT')).json();
      const bp = +(((byr.result && byr.result.list) || [{}])[0].lastPrice || 0);
      const px = j && +j.price;
      ok(px > 0 && bp > 0 && Math.abs(px - bp) / bp < 0.01, s.padEnd(7) + ' is priced from BYBIT, not the cash listing ($' + px + ' vs perp $' + bp + ')');
    }
  }

  // 4b. THE FEE IS THE WHOLE POINT. `feeRateFor` is pure, so it is lifted out of the shipped worker and run:
  //     a Bybit equity perp must be charged the 0.02% stock rate, not the 0.055% crypto one. At $10,000 of
  //     notional that is $4.00 a round trip against $11.00 - what these ten were really being charged.
  {
    const body = src.slice(src.indexOf('function feeRateFor('));
    let d = 0, end = body.indexOf('{');
    for (let k = end; k < body.length; k++) { if (body[k] === '{') d++; else if (body[k] === '}') { d--; if (!d) { end = k; break; } } }
    // eslint-disable-next-line no-new-func
    const feeRateFor = new Function('assetClassOf', 'FEE_VENUES', 'return ' + body.slice(0, end + 1))(
      (s) => classOf(s), {});
    const pct = (s) => +(feeRateFor(10, s) * 100).toFixed(4);
    for (const s of ['MU', 'SOXL', 'SKHYNIX', 'SKHY']) ok(pct(s) === pct('AAPL'), s.padEnd(7) + ' is charged the STOCK rate (' + pct(s) + '% a side, same as AAPL)');
    ok(pct('BTC') > pct('AAPL'), 'a coin is still charged more than a stock (' + pct('BTC') + '% vs ' + pct('AAPL') + '%)');
    ok(pct('DASH') === pct('BTC'), 'DASH is charged the COIN rate now (' + pct('DASH') + '%), which is what it is');
  }

  // 5. EVERY OFFERED MARKET HAS A PRICE, and the price's own class agrees with the table.
  const SAMPLE = ['BTC', 'DASH', 'XAU', 'SKHY', 'SPCX', 'CL', 'F', 'T', 'CVX', 'DIA', 'AAPL', 'EURUSD', 'SPX500'];
  for (const s of SAMPLE) {
    const r = await fetch(O + '/api/price?symbol=' + s, { headers: { 'cache-control': 'no-cache' } });
    const j = await r.json().catch(() => null);
    const px = j && +j.price;
    const cls = classOf(s);
    ok(px > 0, s.padEnd(7) + ' has a price ($' + px + ', class ' + cls + ')');
    // `stock:true` means Yahoo answered, so apply ITS session - true of a STOCKS market, never of a Bybit perp
    if (STOCKS[s]) ok(!!(j && j.stock), s.padEnd(7) + ' answers stock:true, so the session applies');
    if (cls === 'crypto') ok(!(j && j.stock), s.padEnd(7) + ' answers as a coin, no stock session');
  }

  // 6. AN ICON IS NEVER A LOOK-ALIKE FROM ANOTHER ASSET CLASS. The resolver must refuse CoinGecko for every
  //    class that is not crypto: stocks since 2026-10-05, commodities since 10-24, INDICES AND FOREX since 10-25
  //    (VIX answered a 115,388-byte gold token called "VIX777").
  for (const s of ['VIX', 'SPX500', 'NAS100', 'US30', 'EURUSD', 'GBPUSD', 'USDJPY']) {
    const r = await fetch(O + '/api/coinicon?sym=' + s + '&v=2', { redirect: 'follow' });
    const ct = r.headers.get('content-type') || '';
    ok(!(r.status === 200 && /^image\//.test(ct)), s.padEnd(7) + ' icon is letters, never an image from CoinGecko',
      r.status === 200 ? 'answered ' + ct + ' ' + (r.headers.get('content-length') || '?') + 'B' : '');
  }
  for (const s of ['BTC', 'XAU', 'OIL', 'AAPL']) {
    const r = await fetch(O + '/api/coinicon?sym=' + s + '&v=2', { redirect: 'follow' });
    ok(r.status === 200 && /^image\//.test(r.headers.get('content-type') || ''), s.padEnd(7) + ' still has its real mark');
  }

  console.log('\nmarket-class-e2e: ' + pass + ' pass, ' + fail + ' fail');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.log('THREW: ' + (e && e.stack || e)); process.exitCode = 1; });

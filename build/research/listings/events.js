// 2026-11-18: Binance announcements -> tradeable events (coin + direction), then Bybit 1m candles around each.
// Writes arch/bn-events.json = [{t, kind, sym, bsym, title, k:[[ms,o,h,l,c,v]...]}] for t-60m .. t+24h.
// Only events where a Bybit linear perp ALREADY traded at least 60 minutes before the announcement (so there was
// something to trade at that moment). BTC candles are stored too (arch/bn-btc.json) for the market-relative return.
const fs = require('fs'), path = require('path');
const A = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'arch', 'ann.json'), 'utf8')).filter(a => a.ex === 'binance');
const SKIP = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY', 'BRL', 'USD', 'COIN', 'M', 'U', 'ST', 'BETA', 'RWUSD', 'USD1', 'BFUSD', 'XUSD', 'AEUR']);
function kindOf(t) {
  if (/TradFi|bStocks|Pre-Market|Quarterly|Delivery|USDC Perpetual|USDC and|USDCUSDT/i.test(t) && /Futures/i.test(t)) return null;
  if (/Futures Will Launch.*Perpetual|Will Be Available on Binance Alpha and Binance Futures/i.test(t)) return 'futures';
  if (/bStocks|TradFi|Tokenized Securit|Quarterly|Delivery Contract|Options|Margin|Earn|Convert|Copy Trading|Grid|Loan|Simple|Pre-Market Trading|Collateral|Trading Pairs$/i.test(t) && !/Will List|Delist/i.test(t)) return null;
  if (/Monitoring Tag/i.test(t)) return 'tag';
  if (/Delist|Will Remove|Cease Trading|Will Cease/i.test(t) && !/Pairs? and Add|Margin|Grid|Futures/i.test(t)) return 'delist';
  if (/Futures Will Launch.*Perpetual|Will Be Available on Binance Alpha and Binance Futures/i.test(t)) return 'futures';
  if (/Will List|HODLer Airdrops|Launchpool/i.test(t)) return 'spot';
  return null;
}
function symsOf(t, kind) {
  const out = new Set();
  if (kind === 'futures') for (const m of t.matchAll(/\b(?:1000|1M)?([A-Z0-9]{2,12})USDT\b/g)) out.add(m[1]);
  for (const m of t.matchAll(/\(([A-Z0-9]{2,12})\)/g)) out.add(m[1]);
  if (kind === 'delist' || kind === 'tag') { const m = t.match(/(?:Delist|Include|Remove)\s+([A-Z0-9, &]+?)(?:\s+on|\s+from|$)/); if (m) m[1].split(/[ ,&]+/).forEach(s => s.length >= 2 && out.add(s)); }
  return [...out].filter(s => !SKIP.has(s) && !/^\d+$/.test(s));
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function kl(sym, start, end) {
  const out = []; let s = start;
  while (s < end) {
    let j = null; for (let i = 0; i < 4 && !j; i++) { try { const r = await (await fetch('https://api.bybit.com/v5/market/kline?category=linear&symbol=' + sym + '&interval=1&start=' + s + '&end=' + Math.min(end, s + 999 * 60000) + '&limit=1000')).json(); if (r.retCode === 0) j = r; } catch (e) {} if (!j) await sleep(800); }
    const L = (j && j.result.list || []).map(x => [+x[0], +x[1], +x[2], +x[3], +x[4], +x[5]]).reverse(); if (!L.length) break;
    out.push(...L); s = L[L.length - 1][0] + 60000; await sleep(60);
  }
  return out;
}
(async () => {
  const ev = [];
  for (const a of A) { const kind = kindOf(a.title); if (!kind) continue; for (const s of symsOf(a.title, kind)) ev.push({ t: a.t, kind, sym: s, title: a.title }); }
  // de-duplicate the same coin + kind inside 3 days (Binance often posts an update)
  ev.sort((a, b) => a.t - b.t); const last = {}; const E = ev.filter(e => { const k = e.kind + e.sym; if (last[k] && e.t - last[k] < 3 * 86400000) return false; last[k] = e.t; return true; });
  console.log('events parsed', E.length, Object.fromEntries(['spot', 'futures', 'delist', 'tag'].map(k => [k, E.filter(e => e.kind === k).length])));
  const out = [];
  for (const e of E) {
    if (e.t < Date.UTC(2021, 0, 1)) continue;
    const from = e.t - 60 * 60000, to = e.t + 24 * 3600000;
    let k = null, bsym = null;
    for (const cand of [e.sym + 'USDT', '1000' + e.sym + 'USDT']) { const x = await kl(cand, from, to); if (x.length && x[0][0] <= e.t - 50 * 60000) { k = x; bsym = cand; break; } }
    if (k) { out.push(Object.assign({}, e, { bsym, k })); process.stdout.write(e.kind[0]); } else process.stdout.write('.');
  }
  fs.writeFileSync(path.join(__dirname, '..', 'arch', 'bn-events.json'), JSON.stringify(out));
  // BTC 1m over every event window
  const btc = {}; for (const e of out) { const x = await kl('BTCUSDT', e.t - 60 * 60000, e.t + 24 * 3600000); for (const b of x) btc[b[0]] = b[4]; }
  fs.writeFileSync(path.join(__dirname, '..', 'arch', 'bn-btc.json'), JSON.stringify(btc));
  console.log('\ntradeable events', out.length, Object.fromEntries(['spot', 'futures', 'delist', 'tag'].map(k => [k, out.filter(e => e.kind === k).length])));
})();

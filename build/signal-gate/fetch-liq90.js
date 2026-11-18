// 2026-11-18: 90 days of 5-minute liquidations (our collector), 5-minute candles (our /api/klines) and 1h open interest
// (Bybit public) for the liquidation-flush study. Writes liq90.json.
const fs = require('fs');
const COINS = (process.env.COINS || 'BTC,ETH,SOL,XRP,BNB,HYPE,ZEC,TRX,HBAR,DOGE,ADA,AVAX,LINK,SUI,LTC,DOT,NEAR,APT').split(',');
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: { 'cache-control': 'no-cache' } }); if (r.ok) return await r.json(); } catch (e) {} await new Promise(r => setTimeout(r, 900)); } return null; };
const DAY = 864e5, SINCE = Date.now() - 90 * DAY;
async function k5(sym) {
  let all = [], end = 0;
  for (let g = 0; g < 60; g++) {
    const p = await get('https://marginpad.io/api/klines?symbol=' + sym + '&interval=5' + (end ? '&end=' + end : '') + '&cb=' + Date.now());
    if (!Array.isArray(p) || !p.length) break;
    p.sort((a, b) => a.time - b.time); all = p.concat(all);
    if (p[0].time * 1000 <= SINCE) break; const ne = p[0].time * 1000 - 1; if (end && ne >= end) break; end = ne;
  }
  const m = new Map(); all.forEach(b => m.set(b.time, b)); return [...m.values()].sort((a, b) => a.time - b.time).filter(b => b.time * 1000 >= SINCE);
}
async function oi(sym) {
  let out = [], cursor = '';
  for (let g = 0; g < 20; g++) {
    const j = await get('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=' + sym + 'USDT&intervalTime=1h&limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    const L = j && j.result && j.result.list || []; if (!L.length) break;
    out = out.concat(L.map(x => [+x.timestamp, +x.openInterest])); cursor = j.result.nextPageCursor || '';
    if (!cursor || +L[L.length - 1].timestamp <= SINCE) break;
  }
  return out.sort((a, b) => a[0] - b[0]);
}
(async () => {
  const out = {};
  for (const s of COINS) {
    const lq = await get('https://collector.marginpad.io/api/v1/liqseries?symbol=' + s + '&minutes=129600');
    const kl = await k5(s), o = await oi(s);
    out[s] = { liq: (lq && lq.buckets) || [], k5: kl, oi: o };
    console.log(s, 'liq', out[s].liq.length, 'k5', kl.length, kl.length ? new Date(kl[0].time * 1000).toISOString().slice(0, 10) : '-', 'oi', o.length);
  }
  fs.writeFileSync(__dirname + '/liq90.json', JSON.stringify(out));
})();

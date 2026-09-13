// Pull deep 1h / 4h / 1d / 15m history for the 9 watchlist coins through our own /api/klines (Gate primary, back-paginated with &end=)
const fs = require('fs');
const COINS = ['BTC', 'HBAR', 'BNB', 'ETH', 'SOL', 'HYPE', 'XRP', 'ZEC', 'TRX'];
const SINCE = { '60': Date.UTC(2026, 0, 1), '240': Date.UTC(2025, 6, 1), '1440': Date.UTC(2024, 0, 1), '15': Date.UTC(2026, 6, 20) };
async function page(sym, iv, end) {
  const u = 'https://marginpad.io/api/klines?symbol=' + sym + '&interval=' + iv + (end ? '&end=' + end : '') + '&cb=' + Date.now();
  for (let t = 0; t < 4; t++) {
    try { const r = await fetch(u, { headers: { 'cache-control': 'no-cache' } }); const j = await r.json(); if (Array.isArray(j)) return j; } catch (e) {}
    await new Promise(r => setTimeout(r, 800));
  }
  return [];
}
async function pull(sym, iv) {
  const since = SINCE[iv]; let all = []; let end = 0; let guard = 0;
  while (guard++ < 40) {
    const p = await page(sym, iv, end);
    if (!p.length) break;
    p.sort((a, b) => a.time - b.time);
    const oldest = p[0].time * 1000;
    all = p.concat(all);
    if (oldest <= since) break;
    const nextEnd = oldest - 1;
    if (end && nextEnd >= end) break;
    end = nextEnd;
  }
  const m = new Map(); all.forEach(b => m.set(b.time, b));
  const out = [...m.values()].sort((a, b) => a.time - b.time).filter(b => b.time * 1000 >= since);
  return out;
}
(async () => {
  const out = {};
  for (const iv of ['60', '240', '1440', '15']) {
    out[iv] = {};
    for (const s of COINS) {
      const b = await pull(s, iv);
      out[iv][s] = b;
      console.log(iv, s, b.length, b.length ? new Date(b[0].time * 1000).toISOString().slice(0, 10) + ' -> ' + new Date(b[b.length - 1].time * 1000).toISOString().slice(0, 16) : '-', 'vol?', b.length && b[b.length - 2].vol != null);
    }
  }
  fs.writeFileSync(__dirname + '/klines.json', JSON.stringify(out));
})();

// 4h open interest + 4h candles from Bybit (public) since 2024-01-01 for the 80 coins with the most open interest today.
// Writes build/research/arch/oi4h.json { SYM: { oi: [[t, oi]], k: [[t,o,h,l,c,v]] } }.
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const A = path.join(__dirname, 'arch');
const fd = fs.readdirSync(path.join(A, 'funding_oi')).sort().pop();
const rows = zlib.gunzipSync(fs.readFileSync(path.join(A, 'funding_oi', fd))).toString().trim().split('\n').slice(1).map(l => l.split(','));
const last = {}; for (const r of rows) last[r[1]] = +r[2];
const syms = Object.keys(last).sort((a, b) => last[b] - last[a]).slice(0, 80);
const SINCE = Date.UTC(2024, 0, 1);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const get = async (u) => { for (let t = 0; t < 4; t++) { try { const j = await (await fetch(u)).json(); if (j && j.retCode === 0) return j; } catch (e) {} await sleep(700); } return null; };
(async () => {
  const out = {};
  for (const s of syms) {
    const oi = new Map(); let end = Date.now();
    for (let g = 0; g < 60; g++) { const j = await get('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=' + s + 'USDT&intervalTime=4h&limit=200&endTime=' + end); const L = (j && j.result && j.result.list) || []; if (!L.length) break; for (const x of L) oi.set(+x.timestamp, +x.openInterest); const o = +L[L.length - 1].timestamp; if (o <= SINCE) break; end = o - 1; await sleep(40); }
    const k = new Map(); end = Date.now();
    for (let g = 0; g < 10; g++) { const j = await get('https://api.bybit.com/v5/market/kline?category=linear&symbol=' + s + 'USDT&interval=240&limit=1000&end=' + end); const L = (j && j.result && j.result.list) || []; if (!L.length) break; for (const x of L) k.set(+x[0], [+x[0], +x[1], +x[2], +x[3], +x[4], +x[5]]); const o = +L[L.length - 1][0]; if (o <= SINCE) break; end = o - 1; await sleep(40); }
    const O = [...oi.entries()].filter(x => x[0] >= SINCE).sort((a, b) => a[0] - b[0]), Kk = [...k.values()].filter(x => x[0] >= SINCE).sort((a, b) => a[0] - b[0]);
    if (O.length > 300 && Kk.length > 300) out[s] = { oi: O, k: Kk };
    process.stdout.write(s + ' ' + O.length + '/' + Kk.length + '  ');
  }
  fs.writeFileSync(path.join(A, 'oi4h.json'), JSON.stringify(out));
  console.log('\ncoins', Object.keys(out).length);
})();

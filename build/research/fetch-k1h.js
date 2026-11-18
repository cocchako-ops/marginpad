// 1h Bybit linear candles from 2026-07-20 for the 150 coins with the most open interest (from the archived funding_oi).
// Writes build/research/arch/k1h.json { SYM: [[t,o,h,l,c,v], ...] }.
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const A = path.join(__dirname, 'arch');
const fd = fs.readdirSync(path.join(A, 'funding_oi')).sort().pop();
const rows = zlib.gunzipSync(fs.readFileSync(path.join(A, 'funding_oi', fd))).toString().trim().split('\n').slice(1).map(l => l.split(','));
const last = {}; for (const r of rows) last[r[1]] = +r[2];
const syms = Object.keys(last).sort((a, b) => last[b] - last[a]).slice(0, 150);
const SINCE = Date.UTC(2026, 6, 20);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const out = {}; let n = 0;
  for (const s of syms) {
    let end = Date.now(), all = [];
    for (let g = 0; g < 6; g++) {
      let j = null; for (let t = 0; t < 3 && !j; t++) { try { j = await (await fetch('https://api.bybit.com/v5/market/kline?category=linear&symbol=' + s + 'USDT&interval=60&limit=1000&end=' + end)).json(); } catch (e) { await sleep(800); } }
      const L = (j && j.result && j.result.list) || []; if (!L.length) break;
      all = all.concat(L.map(x => [+x[0], +x[1], +x[2], +x[3], +x[4], +x[5]]));
      const oldest = +L[L.length - 1][0]; if (oldest <= SINCE) break; end = oldest - 1;
      await sleep(60);
    }
    const m = new Map(); for (const k of all) if (k[0] >= SINCE) m.set(k[0], k);
    const arr = [...m.values()].sort((a, b) => a[0] - b[0]);
    if (arr.length > 200) { out[s] = arr; n++; }
  }
  fs.writeFileSync(path.join(A, 'k1h.json'), JSON.stringify(out));
  console.log('coins', n, 'of', syms.length);
})();

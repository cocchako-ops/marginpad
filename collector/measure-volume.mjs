// HOW MUCH DATA IS THIS, ACTUALLY. Measured, not extrapolated from one symbol: every v1 venue, all ten
// tracked symbols, book and tape, for a real window - plus the gzip ratio measured on the real payloads,
// because the archive bill is paid in compressed bytes, not raw ones.
//
//   node collector/_volume.mjs 180
import { gzipSync } from 'node:zlib';

const SECS = +process.argv[2] || 120;
const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LINK', 'AVAX', 'LTC'];

const FEEDS = [
  { n: 'bybit book', url: 'wss://stream.bybit.com/v5/public/linear',
    sub: [{ op: 'subscribe', args: SYMS.map((s) => `orderbook.200.${s}USDT`) }] },
  { n: 'bybit tape', url: 'wss://stream.bybit.com/v5/public/linear',
    sub: [{ op: 'subscribe', args: SYMS.map((s) => `publicTrade.${s}USDT`) }] },
  { n: 'okx book', url: 'wss://ws.okx.com:8443/ws/v5/public',
    sub: [{ op: 'subscribe', args: SYMS.map((s) => ({ channel: 'books', instId: `${s}-USDT-SWAP` })) }] },
  { n: 'okx tape', url: 'wss://ws.okx.com:8443/ws/v5/public',
    sub: [{ op: 'subscribe', args: SYMS.map((s) => ({ channel: 'trades', instId: `${s}-USDT-SWAP` })) }] },
  { n: 'bitget book', url: 'wss://ws.bitget.com/v2/ws/public',
    sub: [{ op: 'subscribe', args: SYMS.map((s) => ({ instType: 'USDT-FUTURES', channel: 'books', instId: `${s}USDT` })) }] },
  { n: 'bitget tape', url: 'wss://ws.bitget.com/v2/ws/public',
    sub: [{ op: 'subscribe', args: SYMS.map((s) => ({ instType: 'USDT-FUTURES', channel: 'trade', instId: `${s}USDT` })) }] },
  { n: 'hyperliquid book', url: 'wss://api.hyperliquid.xyz/ws',
    sub: SYMS.map((s) => ({ method: 'subscribe', subscription: { type: 'l2Book', coin: s } })) },
  { n: 'hyperliquid tape', url: 'wss://api.hyperliquid.xyz/ws',
    sub: SYMS.map((s) => ({ method: 'subscribe', subscription: { type: 'trades', coin: s } })) },
  { n: 'binance book', url: 'wss://fstream.binance.com/stream?streams=' + SYMS.map((s) => s.toLowerCase() + 'usdt@depth@100ms').join('/'),
    sub: null },
  { n: 'binance tape', url: 'wss://fstream.binance.com/stream?streams=' + SYMS.map((s) => s.toLowerCase() + 'usdt@trade').join('/'),
    sub: null },
];

function run(f) {
  return new Promise((res) => {
    let bytes = 0, msgs = 0, t0 = 0;
    const sample = [];           // keep a slice of real payloads to measure gzip honestly
    let sampleBytes = 0;
    let ws;
    try { ws = new WebSocket(f.url); } catch (e) { return res({ n: f.n, err: String(e).slice(0, 50) }); }
    ws.addEventListener('open', () => { t0 = Date.now(); (f.sub || []).forEach((s) => { try { ws.send(JSON.stringify(s)); } catch (e) {} }); });
    ws.addEventListener('message', (e) => {
      const d = typeof e.data === 'string' ? e.data : String(e.data);
      const b = Buffer.byteLength(d);
      bytes += b; msgs++;
      if (sampleBytes < 4 * 1024 * 1024) { sample.push(d); sampleBytes += b; }
    });
    ws.addEventListener('error', () => {});
    setTimeout(() => {
      const secs = (Date.now() - t0) / 1000 || SECS;
      let ratio = null;
      if (sample.length) {
        const blob = Buffer.from(sample.join('\n'));
        ratio = gzipSync(blob, { level: 6 }).length / blob.length;
      }
      try { ws.close(); } catch (e) {}
      res({ n: f.n, bytes, msgs, secs, kbs: bytes / 1024 / secs, ratio });
    }, SECS * 1000 + 2000);
  });
}

const GB = (kbs) => kbs * 86400 / 1024 / 1024;

const out = await Promise.all(FEEDS.map(run));
console.log(`measured ${SECS}s, ${SYMS.length} symbols per feed\n`);
console.log('feed                 msgs/s     KB/s   raw GB/day   gzip    gz GB/day');
let rawBook = 0, gzBook = 0, rawTape = 0, gzTape = 0;
for (const r of out) {
  if (r.err) { console.log(r.n.padEnd(20) + '  ERR ' + r.err); continue; }
  const raw = GB(r.kbs), gz = raw * (r.ratio || 1);
  if (/book/.test(r.n)) { rawBook += raw; gzBook += gz; } else { rawTape += raw; gzTape += gz; }
  console.log(
    r.n.padEnd(20) +
    (r.msgs / r.secs).toFixed(1).padStart(7) +
    r.kbs.toFixed(1).padStart(9) +
    raw.toFixed(2).padStart(13) +
    ((r.ratio || 0) * 100).toFixed(0).padStart(7) + '%' +
    gz.toFixed(2).padStart(13));
}
console.log('\n                       raw GB/day    gzipped GB/day');
console.log('order book (5 venues)  ' + rawBook.toFixed(1).padStart(9) + gzBook.toFixed(1).padStart(18));
console.log('trade tape (5 venues)  ' + rawTape.toFixed(1).padStart(9) + gzTape.toFixed(1).padStart(18));
console.log('TOTAL                  ' + (rawBook + rawTape).toFixed(1).padStart(9) + (gzBook + gzTape).toFixed(1).padStart(18));
console.log('\nper year, gzipped:     ' + ((gzBook + gzTape) * 365 / 1024).toFixed(2) + ' TB');
console.log('at 200 symbols (x20):  ' + ((gzBook + gzTape) * 20 * 365 / 1024).toFixed(1) + ' TB/yr  (linear assumption, NOT measured)');
process.exit(0);

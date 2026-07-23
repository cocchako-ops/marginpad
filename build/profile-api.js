// profile-api.js — external p50/p95 profiling of the most-called API routes (production).
// 12 samples per route, records CF-Cache-Status distribution so cold/warm split is visible.
//   node build/profile-api.js [samplesPerRoute]
const N = +process.argv[2] || 12;
const BASE = 'https://marginpad.io';
const ROUTES = [
  ['prices', '/api/prices'],
  ['price-BTC', '/api/price?symbol=BTC'],
  ['price-alt', '/api/price?symbol=SUI'],
  ['klines-15m', '/api/klines?symbol=BTC&interval=15'],
  ['klines-1h', '/api/klines?symbol=ETH&interval=60'],
  ['screener', '/api/screener'],
  ['symbols', '/api/symbols'],
  ['chat-last', '/chat/last'],
  ['reward-lb', '/api/reward/lb'],
  ['happyhour', '/api/happyhour'],
  ['calendar', '/api/calendar'],
  ['auth-me', '/api/auth/me'],
  ['auth-xp', '/api/auth/xp'],
  ['missions', '/api/missions'],
  ['comm-feed', '/api/comm/feed'],
  ['gecko-mkts', '/api/gecko/markets'],
  ['gecko-trend', '/api/gecko/trending'],
  ['cg-pulse', '/api/cg/pulse'],
  ['fear-greed', '/api/feargreed'],
  ['track-pv', '/api/track?t=pageview&p=%2Fprofiling&r=&sw=1&sh=1'],
];
function pct(a, p) { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }
(async () => {
  console.log('route         n   p50     p95     max     hit/miss/none  status');
  const slow = [];
  for (const [name, path] of ROUTES) {
    const ms = [], cs = { HIT: 0, MISS: 0, none: 0 }; let st = 0;
    for (let i = 0; i < N; i++) {
      const t0 = Date.now();
      try {
        const r = await fetch(BASE + path, { headers: { 'user-agent': 'Mozilla/5.0 (profiling)' } });
        await r.text(); st = r.status;
        const c = r.headers.get('cf-cache-status'); cs[c === 'HIT' ? 'HIT' : (c ? 'MISS' : 'none')]++;
      } catch (e) { st = 0; }
      ms.push(Date.now() - t0);
      await new Promise(r => setTimeout(r, 350));
    }
    const p95 = pct(ms, .95);
    console.log(name.padEnd(13) + String(ms.length).padEnd(4) + (pct(ms, .5) + 'ms').padEnd(8) + (p95 + 'ms').padEnd(8) + (Math.max(...ms) + 'ms').padEnd(8) + (cs.HIT + '/' + cs.MISS + '/' + cs.none).padEnd(15) + st);
    if (p95 > 300) slow.push(name + ' p95=' + p95);
  }
  console.log('\nBudget breach (p95>300ms): ' + (slow.length ? slow.join(', ') : 'none'));
})();

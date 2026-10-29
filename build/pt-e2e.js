/* Portuguese site E2E (2026-10-29, the pt twin of es-e2e): the /pt/ twins of the top pages in production.
   node build/pt-e2e.js            - HTTP checks (twins, redirects, SSR twins, tool shell, hreflang both ways, sitemap, language ratio)
   Pass 1 covers build/data/pt/pages.txt only (no blog twins yet) - a /pt/blog/<slug>/ answers 302 to the English post, by design.
   Exit 1 on any failure.                                                                                                     */
'use strict';
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ok  ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
const cb = () => '?cb=' + Date.now() + Math.random().toString(36).slice(2, 6);
async function get(p, opts) { const r = await fetch(ORIGIN + p + (p.includes('?') ? '&' : '?') + cb().slice(1), { redirect: 'manual', ...opts }); const t = r.status >= 300 && r.status < 400 ? '' : await r.text(); return { s: r.status, t, loc: r.headers.get('location') || '', ct: r.headers.get('content-type') || '' }; }
const vis = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ');
const EN = /\b(the|and|with|your|you|for|from|this|that|are|when|how|what|which|before|after|price|position|margin|leverage|liquidation|calculator|free|trade|trades|open|close|about|more|every|without|only|also|because|between|market|order)\b/gi;
const PT = /\b(o|a|os|as|de|do|da|dos|das|um|uma|que|com|para|por|sem|seu|sua|se|em|ao|mais|como|preço|posição|margem|alavancagem|liquidação|calculadora|grátis|você|não|são|cada|quando|também|entre|sobre|mercado|ordem|abrir|fechar)\b/gi;
const ratio = (h) => { const v = vis(h); const e = (v.match(EN) || []).length, s = (v.match(PT) || []).length; return { e, s, r: s / Math.max(1, e + s) }; };

(async () => {
  console.log('Portuguese site E2E against ' + ORIGIN);
  // 1. homepage twin
  { const r = await get('/pt/'); ok(r.s === 200 && /<html[^>]*lang="pt"/.test(r.t), '/pt/ 200 + lang=pt'); ok(/hreflang="en" href="https:\/\/marginpad\.io\/"/.test(r.t) && /hreflang="pt" href="https:\/\/marginpad\.io\/pt\/"/.test(r.t), '/pt/ hreflang en+pt'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/pt\/"/.test(r.t), '/pt/ canonical on itself'); ok(/og:locale" content="pt_BR"/.test(r.t) || !/og:locale/.test(r.t), 'og:locale pt_BR (or none, like the English page)'); const q = ratio(r.t); ok(q.r > 0.75, '/pt/ reads Portuguese (' + (q.r * 100).toFixed(0) + '%: pt ' + q.s + ' / en ' + q.e + ')');
    const en = await get('/'); ok(en.s === 200 && /hreflang="pt" href="https:\/\/marginpad\.io\/pt\/"/.test(en.t) && /hreflang="es" href="https:\/\/marginpad\.io\/es\/"/.test(en.t), 'English homepage carries hreflang pt AND still es'); }
  // 2. an ask-page twin + the English page's hreflang
  { const r = await get('/pt/is-funding-positive-or-negative/'); ok(r.s === 200 && /lang="pt"/.test(r.t), '/pt/is-funding-positive-or-negative/ 200'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/pt\/is-funding-positive-or-negative\/"/.test(r.t), 'ask twin canonical'); ok(/hreflang="x-default" href="https:\/\/marginpad\.io\/is-funding-positive-or-negative\/"/.test(r.t), 'ask twin x-default → English'); ok(/href="\/pt\/liquidations\/"/.test(r.t), 'ask twin internal links point at /pt/'); const q = ratio(r.t); ok(q.r > 0.75, 'ask twin reads Portuguese (' + (q.r * 100).toFixed(0) + '%)');
    const en = await get('/is-funding-positive-or-negative/'); ok(en.s === 200 && /hreflang="pt" href="https:\/\/marginpad\.io\/pt\/is-funding-positive-or-negative\/"/.test(en.t), 'English page carries hreflang pt'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/is-funding-positive-or-negative\/"/.test(en.t), 'English canonical untouched'); }
  // 3. SSR twins get the live block
  { const map = await get('/pt/btc-liquidation-map/'); ok(map.s === 200 && /lang="pt"/.test(map.t), '/pt/btc-liquidation-map/ 200 (worker-first SSR path)');
    const hub = await get('/pt/liquidations/'); ok(hub.s === 200 && /lang="pt"/.test(hub.t), '/pt/liquidations/ hub twin 200');
    const coin = await get('/pt/coin/btc/'); const coinEn = await get('/coin/btc/'); ok(coin.s === 200 && /lang="pt"/.test(coin.t), '/pt/coin/btc/ 200'); ok(/data-ssr="coin"/.test(coin.t) && /data-ssr="coin"/.test(coinEn.t), 'SSR live block injected into the coin twin like the English page'); }
  // 4. tool shell
  { const r = await get('/pt/paper-trade'); ok(r.s === 200 && /lang="pt"/.test(r.t), '/pt/paper-trade 200 + lang=pt'); ok(/<title>Paper Trading de Cripto - Simulador grátis/.test(r.t), 'Portuguese title'); ok(/<h1[^>]*>Paper trading de cripto a preço real<\/h1>/.test(r.t), 'Portuguese h1'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/pt\/paper-trade"/.test(r.t), 'canonical /pt/paper-trade'); const en = await get('/paper-trade'); ok(/<h1[^>]*>Crypto paper trading at live prices<\/h1>/.test(en.t), 'English tool route unchanged'); const es = await get('/es/paper-trade'); ok(/<h1[^>]*>Paper trading de cripto a precio en vivo<\/h1>/.test(es.t), 'Spanish tool route unchanged'); for (const t of ['/charts', '/calculators', '/screener', '/heatmap', '/swap']) { const x = await get('/pt' + t); ok(x.s === 200 && /lang="pt"/.test(x.t), '/pt' + t + ' 200'); } }
  // 5. redirects
  { const r = await get('/pt/this-page-does-not-exist/'); ok(r.s === 302 && /\/this-page-does-not-exist\/(\?|$)/.test(r.loc) && !/\/pt\//.test(r.loc), '/pt/<missing>/ → 302 English (query kept)'); const b = await get('/pt/blog/what-is-slippage/'); ok(b.s === 302 && /\/blog\/what-is-slippage\/(\?|$)/.test(b.loc), '/pt/blog/<slug>/ (no twin in pass 1) → 302 English, not a 301 to a dead prefix'); const de = await get('/de/blog/what-is-slippage/'); ok(de.s === 301 && /\/blog\/what-is-slippage\/$/.test(de.loc), 'other languages still 301 to English'); const api = await get('/api/prices'); ok(api.s === 200, '/api/prices untouched'); }
  // 6. sitemap + robots
  { const r = await get('/sitemap-pt.xml'); const n = (r.t.match(/<loc>/g) || []).length; ok(r.s === 200 && n >= 70, 'sitemap-pt.xml 200 with ' + n + ' urls'); ok(/<loc>https:\/\/marginpad\.io\/pt\/paper-trade<\/loc>/.test(r.t), 'sitemap lists the tool twins'); const rb = await get('/robots.txt'); ok(/sitemap-pt\.xml/.test(rb.t), 'robots.txt lists sitemap-pt.xml'); const es = await get('/sitemap-es.xml'); ok(es.s === 200 && (es.t.match(/<loc>/g) || []).length > 300, 'sitemap-es.xml still whole'); }
  // 7. language ratio on a spread of twins
  { const r = await get('/sitemap-pt.xml'); const urls = (r.t.match(/<loc>([^<]+)<\/loc>/g) || []).map(x => x.replace(/<\/?loc>/g, '').replace(ORIGIN, '')).filter(u => !/paper-trade|charts|calculators|screener|heatmap|swap/.test(u)); const pick = []; for (let i = 0; i < urls.length && pick.length < 24; i += Math.max(1, Math.floor(urls.length / 24))) pick.push(urls[i]); let low = []; for (const u of pick) { const p = await get(u); if (p.s !== 200) { low.push(u + ' ' + p.s); continue; } const q = ratio(p.t); if (q.r < 0.7) low.push(u + ' ' + (q.r * 100).toFixed(0) + '%'); } ok(low.length === 0, 'twins read Portuguese on a spread of ' + pick.length + ' pages' + (low.length ? ' - low: ' + low.join(', ') : '')); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

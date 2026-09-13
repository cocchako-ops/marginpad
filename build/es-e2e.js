/* Spanish site E2E (2026-09-13): the /es/ twins in production.
   node build/es-e2e.js            — HTTP checks (twins, redirects, SSR twins, tool shell, hreflang both ways, sitemap, language ratio)
   Exit 1 on any failure.                                                                                                     */
'use strict';
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ok  ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
const cb = () => '?cb=' + Date.now() + Math.random().toString(36).slice(2, 6);
async function get(p, opts) { const r = await fetch(ORIGIN + p + (p.includes('?') ? '&' : '?') + cb().slice(1), { redirect: 'manual', ...opts }); const t = r.status >= 300 && r.status < 400 ? '' : await r.text(); return { s: r.status, t, loc: r.headers.get('location') || '', ct: r.headers.get('content-type') || '' }; }
const vis = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ');
const EN = /\b(the|and|with|your|you|for|from|this|that|are|when|how|what|which|before|after|price|position|margin|leverage|liquidation|calculator|free|trade|trades|open|close|about|more|every|without|only|also|because|between|market|order)\b/gi;
const ES = /\b(el|la|los|las|de|del|un|una|que|con|para|por|sin|tu|tus|se|es|en|al|más|cómo|qué|precio|posición|margen|apalancamiento|liquidación|calculadora|gratis|operación|abrir|cerrar|sobre|cada|solo|también|porque|entre|mercado|orden)\b/gi;
const ratio = (h) => { const v = vis(h); const e = (v.match(EN) || []).length, s = (v.match(ES) || []).length; return { e, s, r: s / Math.max(1, e + s) }; };

(async () => {
  console.log('Spanish site E2E against ' + ORIGIN);
  // 1. homepage twin
  { const r = await get('/es/'); ok(r.s === 200 && /<html[^>]*lang="es"/.test(r.t), '/es/ 200 + lang=es'); ok(/hreflang="en" href="https:\/\/marginpad\.io\/"/.test(r.t) && /hreflang="es" href="https:\/\/marginpad\.io\/es\/"/.test(r.t), '/es/ hreflang en+es'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/es\/"/.test(r.t), '/es/ canonical self'); const q = ratio(r.t); ok(q.r > 0.8, '/es/ reads Spanish (' + (q.r * 100).toFixed(0) + '% es words)'); }
  // 2. a blog twin + the English twin's hreflang
  { const r = await get('/es/blog/what-is-slippage/'); ok(r.s === 200 && /lang="es"/.test(r.t), '/es/blog/what-is-slippage/ 200'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/es\/blog\/what-is-slippage\/"/.test(r.t), 'blog twin canonical'); ok(/hreflang="x-default" href="https:\/\/marginpad\.io\/blog\/what-is-slippage\/"/.test(r.t), 'blog twin x-default → English'); ok(/href="\/es\/blog\/"/.test(r.t), 'blog twin internal links point at /es/'); const q = ratio(r.t); ok(q.r > 0.8, 'blog twin reads Spanish (' + (q.r * 100).toFixed(0) + '%)');
    const en = await get('/blog/what-is-slippage/'); ok(en.s === 200 && /hreflang="es" href="https:\/\/marginpad\.io\/es\/blog\/what-is-slippage\/"/.test(en.t), 'English page carries hreflang es'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/blog\/what-is-slippage\/"/.test(en.t), 'English canonical untouched'); }
  // 3. SSR twins get the live block
  { const es = await get('/es/btc-liquidation-calculator/'); ok(es.s === 200 && /lang="es"/.test(es.t), '/es/btc-liquidation-calculator/ 200 (worker-first SSR path)');
    const hub = await get('/es/liquidations/'); ok(hub.s === 200 && /lang="es"/.test(hub.t), '/es/liquidations/ hub twin 200 (was a 301 for a year)');
    const coin = await get('/es/coin/btc/'); const coinEn = await get('/coin/btc/'); ok(coin.s === 200 && /lang="es"/.test(coin.t), '/es/coin/btc/ 200 (kept coin page, no /coins/ redirect)'); ok(/data-ssr="coin"/.test(coin.t) && /data-ssr="coin"/.test(coinEn.t), 'SSR live block injected into the coin twin like the English page');
    const blog = await get('/es/blog/what-is-funding-rate/'); ok(blog.s === 200 && /lang="es"/.test(blog.t) && /data-ssr="blog"/.test(blog.t), '/es/blog/what-is-funding-rate/ carries the live box (SSR blog route)'); }
  // 4. tool shell
  { const r = await get('/es/paper-trade'); ok(r.s === 200 && /lang="es"/.test(r.t), '/es/paper-trade 200 + lang=es'); ok(/<title>Paper Trading de Cripto/.test(r.t), 'Spanish title'); ok(/<h1[^>]*>Paper trading de cripto a precio en vivo<\/h1>/.test(r.t), 'Spanish h1'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/es\/paper-trade"/.test(r.t), 'canonical /es/paper-trade'); ok(!/Is MarginPad paper trading free\?/.test(r.t), 'no English FAQ block appended'); const en = await get('/paper-trade'); ok(/<h1[^>]*>Crypto paper trading at live prices<\/h1>/.test(en.t), 'English tool route unchanged'); for (const t of ['/charts', '/calculators', '/screener', '/heatmap', '/swap']) { const x = await get('/es' + t); ok(x.s === 200 && /lang="es"/.test(x.t), '/es' + t + ' 200'); } }
  // 5. redirects
  { const r = await get('/es/this-page-does-not-exist/'); ok(r.s === 302 && /\/this-page-does-not-exist\/(\?|$)/.test(r.loc) && !/\/es\//.test(r.loc), '/es/<missing>/ → 302 English (query kept)'); const o = await get('/blog/how-to-calculate-liquidation-price/es/'); ok(o.s === 301 && /\/es\/blog\/how-to-calculate-liquidation-price\/$/.test(o.loc), 'old /blog/<slug>/es/ → 301 /es/blog/<slug>/'); const de = await get('/de/blog/what-is-slippage/'); ok(de.s === 301 && /\/blog\/what-is-slippage\/$/.test(de.loc), 'other languages still 301 to English'); const api = await get('/api/prices'); ok(api.s === 200, '/api/prices untouched'); }
  // 6. sitemap + robots
  { const r = await get('/sitemap-es.xml'); const n = (r.t.match(/<loc>/g) || []).length; ok(r.s === 200 && n > 300, 'sitemap-es.xml 200 with ' + n + ' urls'); ok(/<loc>https:\/\/marginpad\.io\/es\/paper-trade<\/loc>/.test(r.t), 'sitemap lists the tool twins'); const rb = await get('/robots.txt'); ok(/sitemap-es\.xml/.test(rb.t), 'robots.txt lists sitemap-es.xml'); }
  // 7. language ratio on a spread of twins
  { const r = await get('/sitemap-es.xml'); const urls = (r.t.match(/<loc>([^<]+)<\/loc>/g) || []).map(x => x.replace(/<\/?loc>/g, '').replace(ORIGIN, '')).filter(u => !/paper-trade|charts|calculators|screener|heatmap|swap/.test(u)); const pick = []; for (let i = 0; i < urls.length && pick.length < 24; i += Math.max(1, Math.floor(urls.length / 24))) pick.push(urls[i]); let low = []; for (const u of pick) { const p = await get(u); if (p.s !== 200) { low.push(u + ' ' + p.s); continue; } const q = ratio(p.t); if (q.r < 0.75) low.push(u + ' ' + (q.r * 100).toFixed(0) + '%'); } ok(low.length === 0, 'twins read Spanish on a spread of ' + pick.length + ' pages' + (low.length ? ' — low: ' + low.join(', ') : '')); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

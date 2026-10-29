/* German site E2E (2026-10-29, the German twin of es-e2e): the /de/ twins of the top pages in production.
   node build/de-e2e.js            - HTTP checks (twins, redirects, SSR twins, tool shell, hreflang both ways, sitemap, language ratio)
   Pass 2 (the same day) covers every page the Spanish twin covers, blog included; the worker also writes its live sentences in German.
   Exit 1 on any failure.                                                                                                     */
'use strict';
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ok  ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
const cb = () => '?cb=' + Date.now() + Math.random().toString(36).slice(2, 6);
async function get(p, opts) { const r = await fetch(ORIGIN + p + (p.includes('?') ? '&' : '?') + cb().slice(1), { redirect: 'manual', ...opts }); const t = r.status >= 300 && r.status < 400 ? '' : await r.text(); return { s: r.status, t, loc: r.headers.get('location') || '', ct: r.headers.get('content-type') || '' }; }
const vis = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ');
const EN = /\b(the|and|with|your|you|for|from|this|that|are|when|how|what|which|before|after|price|position|margin|leverage|liquidation|calculator|free|trade|trades|open|close|about|more|every|without|only|also|because|between|market|order)\b/gi;
const PT = /\b(der|die|das|und|mit|dein|deine|für|von|bei|nicht|ist|sind|wird|werden|auf|ein|eine|einen|oder|wenn|wie|was|auch|nur|mehr|Preis|Position|Hebel|Liquidation|Rechner|kostenlos|Gebühr|Gebühren|Börse|Margin|Konto|jetzt|hier|ohne|zu|im|am|dem|den|des)\b/gi;
const ratio = (h) => { const v = vis(h); const e = (v.match(EN) || []).length, s = (v.match(PT) || []).length; return { e, s, r: s / Math.max(1, e + s) }; };

(async () => {
  console.log('German site E2E against ' + ORIGIN);
  // 1. homepage twin
  { const r = await get('/de/'); ok(r.s === 200 && /<html[^>]*lang="de"/.test(r.t), '/de/ 200 + lang=de'); ok(/hreflang="en" href="https:\/\/marginpad\.io\/"/.test(r.t) && /hreflang="de" href="https:\/\/marginpad\.io\/de\/"/.test(r.t), '/de/ hreflang en+de'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/de\/"/.test(r.t), '/de/ canonical on itself'); ok(/og:locale" content="de_DE"/.test(r.t) || !/og:locale/.test(r.t), 'og:locale de_DE (or none, like the English page)'); const q = ratio(r.t); ok(q.r > 0.75, '/de/ reads German (' + (q.r * 100).toFixed(0) + '%: pt ' + q.s + ' / en ' + q.e + ')');
    const en = await get('/'); ok(en.s === 200 && /hreflang="de" href="https:\/\/marginpad\.io\/de\/"/.test(en.t) && /hreflang="es" href="https:\/\/marginpad\.io\/es\/"/.test(en.t), 'English homepage carries hreflang de AND still es'); }
  // 2. an ask-page twin + the English page's hreflang
  { const r = await get('/de/is-funding-positive-or-negative/'); ok(r.s === 200 && /lang="de"/.test(r.t), '/de/is-funding-positive-or-negative/ 200'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/de\/is-funding-positive-or-negative\/"/.test(r.t), 'ask twin canonical'); ok(/hreflang="x-default" href="https:\/\/marginpad\.io\/is-funding-positive-or-negative\/"/.test(r.t), 'ask twin x-default → English'); ok(/href="\/de\/liquidations\/"/.test(r.t), 'ask twin internal links point at /de/'); const q = ratio(r.t); ok(q.r > 0.75, 'ask twin reads German (' + (q.r * 100).toFixed(0) + '%)');
    const en = await get('/is-funding-positive-or-negative/'); ok(en.s === 200 && /hreflang="de" href="https:\/\/marginpad\.io\/de\/is-funding-positive-or-negative\/"/.test(en.t), 'English page carries hreflang de'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/is-funding-positive-or-negative\/"/.test(en.t), 'English canonical untouched'); }
  // 3. SSR twins get the live block
  { const map = await get('/de/btc-liquidation-map/'); ok(map.s === 200 && /lang="de"/.test(map.t), '/de/btc-liquidation-map/ 200 (worker-first SSR path)');
    const hub = await get('/de/liquidations/'); ok(hub.s === 200 && /lang="de"/.test(hub.t), '/de/liquidations/ hub twin 200');
    const coin = await get('/de/coin/btc/'); const coinEn = await get('/coin/btc/'); ok(coin.s === 200 && /lang="de"/.test(coin.t), '/de/coin/btc/ 200'); ok(/data-ssr="coin"/.test(coin.t) && /data-ssr="coin"/.test(coinEn.t), 'SSR live block injected into the coin twin like the English page'); }
  // 4. tool shell
  { const r = await get('/de/paper-trade'); ok(r.s === 200 && /lang="de"/.test(r.t), '/de/paper-trade 200 + lang=de'); ok(/<title>Krypto Paper Trading - Kostenloser Simulator/.test(r.t), 'German title'); ok(/<h1[^>]*>Krypto Paper Trading zu Live-Preisen<\/h1>/.test(r.t), 'German h1'); ok(/<link rel="canonical" href="https:\/\/marginpad\.io\/de\/paper-trade"/.test(r.t), 'canonical /de/paper-trade'); const en = await get('/paper-trade'); ok(/<h1[^>]*>Crypto paper trading at live prices<\/h1>/.test(en.t), 'English tool route unchanged'); const es = await get('/es/paper-trade'); ok(/<h1[^>]*>Paper trading de cripto a precio en vivo<\/h1>/.test(es.t), 'Spanish tool route unchanged'); for (const t of ['/charts', '/calculators', '/screener', '/heatmap', '/swap']) { const x = await get('/de' + t); ok(x.s === 200 && /lang="de"/.test(x.t), '/de' + t + ' 200'); } }
  // 5. redirects
  { const r = await get('/de/this-page-does-not-exist/'); ok(r.s === 302 && /\/this-page-does-not-exist\/(\?|$)/.test(r.loc) && !/\/de\//.test(r.loc), '/de/<missing>/ → 302 English (query kept)'); const b = await get('/de/blog/what-is-slippage/'); ok(b.s === 200 && /lang="de"/.test(b.t) && /<link rel="canonical" href="https:\/\/marginpad\.io\/de\/blog\/what-is-slippage\/"/.test(b.t), '/de/blog/<slug>/ is a twin since pass 2 (200, lang=de, own canonical)'); const fr = await get('/fr/blog/what-is-slippage/'); ok(fr.s === 301 && /\/blog\/what-is-slippage\/$/.test(fr.loc), 'other languages still 301 to English'); const api = await get('/api/prices'); ok(api.s === 200, '/api/prices untouched'); }
  // 6. sitemap + robots
  { const r = await get('/sitemap-de.xml'); const n = (r.t.match(/<loc>/g) || []).length; ok(r.s === 200 && n >= 300, 'sitemap-de.xml 200 with ' + n + ' urls'); ok(/<loc>https:\/\/marginpad\.io\/de\/paper-trade<\/loc>/.test(r.t), 'sitemap lists the tool twins'); const rb = await get('/robots.txt'); ok(/sitemap-de\.xml/.test(rb.t), 'robots.txt lists sitemap-de.xml'); const es = await get('/sitemap-es.xml'); ok(es.s === 200 && (es.t.match(/<loc>/g) || []).length > 300, 'sitemap-es.xml still whole'); }
  // 7. language ratio on a spread of twins
  { const r = await get('/sitemap-de.xml'); const urls = (r.t.match(/<loc>([^<]+)<\/loc>/g) || []).map(x => x.replace(/<\/?loc>/g, '').replace(ORIGIN, '')).filter(u => !/paper-trade|charts|calculators|screener|heatmap|swap/.test(u)); const pick = []; for (let i = 0; i < urls.length && pick.length < 24; i += Math.max(1, Math.floor(urls.length / 24))) pick.push(urls[i]); let low = []; for (const u of pick) { const p = await get(u); if (p.s !== 200) { low.push(u + ' ' + p.s); continue; } const q = ratio(p.t); if (q.r < 0.7) low.push(u + ' ' + (q.r * 100).toFixed(0) + '%'); } ok(low.length === 0, 'twins read German on a spread of ' + pick.length + ' pages' + (low.length ? ' - low: ' + low.join(', ') : '')); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

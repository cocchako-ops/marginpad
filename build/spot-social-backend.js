/* DEMO SPOT SOCIAL LAYER, BACKEND (2026-10-16, owner: a live feed of who trades what, theses that earn XP + Ticks and
   land on the blog, a Portfolio button on the profile card). One-shot patcher over src/worker.js by unique markers; writes
   atomically; idempotent (the /s2/feed marker). */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'src', 'worker.js');
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf("path === '/s2/feed'") >= 0) { console.log('already'); process.exit(0); }
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const J = s => s.split('\n').join(N);
const once = (a, nm) => { const n = h.split(a).length - 1; if (n !== 1) { console.error('marker ' + nm + ' x' + n); process.exit(1); } };
const after = (a, add, nm) => { once(a, nm); h = h.split(a).join(a + J(add)); };
const before = (a, add, nm) => { once(a, nm); h = h.split(a).join(J(add).replace(/\s+$/, '') + N + a); }; // ALWAYS a newline before the anchor: the first cut glued the /api/spot/ dispatch onto a trailing comment and took the whole Spot API down for ten minutes (2026-10-16)
const swap = (a, b, nm) => { once(a, nm); h = h.split(a).join(J(b)); };

/* 1. Ticks: theses earn a little, capped */
after(`  { k: 'duel', label: 'Duels won', cap: 30 },`, `
  { k: 'thesis', label: 'Theses published', cap: 10 }, // 2026-10-16: 5 T a thesis, two a day - a thesis is a Community post, the quality gate stands`, 'tick sources');

/* 2. UserStore: a worker-callable Ticks grant that honours the day cap (the adjust route is uncapped and ops-only) */
after(`    if (path === '/duel/mine') { // all of a user's duels: incoming pending, active (live scores), recent results`, ``, 'duel mine'); // anchor check only
before(` if (path === '/ticks/adjust') { // ops: manual Ticks credit/debit`, `    if (path === '/ticks/grant') { // internal (worker): a capped Ticks reward by source - {uid, src, amt, note}; TICK_CAP[src] is the day cap, same as every other source
      const guid = String((b && b.uid) || '').replace(/^u:/, ''), src = String((b && b.src) || '').replace(/[^a-z_]/g, ''), amt = Math.round(+(b && b.amt) || 0);
      if (!guid || !src || !(amt > 0) || amt > 100 || !TICK_CAP[src]) return this.j({ error: 'bad' }, 400);
      if (!this.rows('SELECT 1 FROM users WHERE id=?', guid)[0]) return this.j({ error: 'not_found' }, 404);
      let out = null; try { out = this._grantTicks(guid, src, amt, { dayCap: TICK_CAP[src], note: String((b && b.note) || src).slice(0, 60) }); } catch (e) { return this.j({ error: 'grant' }, 500); }
      return this.j({ ok: true, granted: out, balance: this._tickBal(guid) });
    }
`, 'ticks grant');

/* 3. SpotStore: the floor feed, what is hot today, a read-only portfolio */
after(`    if (path === '/s2/portfolio') {
      if (!uid) return this.j({ error: 'bad' }, 400);
      const a = this._acct2(uid, now, url.searchParams.get('create') === '1');
      if (!a) return this.j({ none: true });
      sql.exec('UPDATE sp2acct SET last_seen=? WHERE user_id=?', now, uid);`.split('\n').join(N), ``, 'portfolio head');
swap(`      sql.exec('UPDATE sp2acct SET last_seen=? WHERE user_id=?', now, uid);
      const holds = this.rows('SELECT key,qty,cost,meta FROM sp2hold WHERE user_id=? AND qty>0', uid)`.split('\n').join(N), `      if (!url.searchParams.get('ro')) sql.exec('UPDATE sp2acct SET last_seen=? WHERE user_id=?', now, uid); // ro=1: a public read of somebody else's portfolio is not their visit
      const holds = this.rows('SELECT key,qty,cost,meta FROM sp2hold WHERE user_id=? AND qty>0', uid)`, 'portfolio ro');
before(`    if (path === '/s2/claim') {`, `    if (path === '/s2/feed') { // THE FLOOR: the newest buys and sells across every account (uid resolved to a name by the worker, which also drops e2e members)
      const n = Math.max(1, Math.min(100, +url.searchParams.get('n') || 60));
      const rows = this.rows("SELECT user_id uid, ts, side, key, qty, price, usd, pnl, meta FROM sp2tx WHERE side IN ('buy','sell') ORDER BY ts DESC LIMIT " + n)
        .map(t => { let m = {}; try { m = JSON.parse(t.meta || '{}'); } catch (e) {} return { uid: t.uid, ts: t.ts, side: t.side, key: t.key, qty: t.qty, price: t.price, usdUsd: t.usd / 100, pnlUsd: t.side === 'sell' ? (t.pnl || 0) / 100 : null, sym: m.sym || String(t.key || '').replace(/^cex:/, ''), net: m.net || '', mint: m.mint || '', pool: m.pool || '', logo: m.logo || '', name: m.name || '', k: m.k || 'cex' }; });
      return this.j({ rows });
    }
    if (path === '/s2/hot') { // what the floor is buying today: distinct buyers and dollars per coin over 24 h
      const since = now - 86400000;
      const rows = this.rows("SELECT key, COUNT(DISTINCT user_id) buyers, SUM(usd) usd, COUNT(*) n, MAX(meta) meta FROM sp2tx WHERE side='buy' AND ts>? GROUP BY key ORDER BY buyers DESC, usd DESC LIMIT 10", since)
        .map(r => { let m = {}; try { m = JSON.parse(r.meta || '{}'); } catch (e) {} return { key: r.key, buyers: +r.buyers || 0, usdUsd: (+r.usd || 0) / 100, n: +r.n || 0, sym: m.sym || String(r.key || '').replace(/^cex:/, ''), net: m.net || '', mint: m.mint || '', pool: m.pool || '', logo: m.logo || '', k: m.k || 'cex' }; });
      return this.j({ rows, since });
    }
`, 'spot feed routes');

/* 4. worker: the public routes on /api/spot + one pricing helper shared by /portfolio and /public */
before(`  if (path === '/board') { // the Meme Spot season board, public`, `  if (path === '/feed') { // THE FLOOR (2026-10-16, owner: "feed koji ce da lista sve akcije i ko trenutno sta trejduje"): newest buys and sells by name, plus what is hot today. Public, edge 20 s.
    const ck = new Request('https://marginpad.io/__spot_feed_v1');
    try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
    let rows = [], hot = [];
    try { const d = await (await spotStub(env).fetch(new Request('https://do/s2/feed?n=80'))).json(); rows = (d && d.rows) || []; } catch (e) {}
    try { const d = await (await spotStub(env).fetch(new Request('https://do/s2/hot'))).json(); hot = (d && d.rows) || []; } catch (e) {}
    let names = {}; try { const nr = await usersDO(env, '/names', { ids: [...new Set(rows.map(r => r.uid))].slice(0, 200) }); names = (nr && nr.names) || {}; } catch (e) {}
    const pub = rows.filter(r => names[r.uid] && !/^e2e_/i.test(names[r.uid])).slice(0, 50).map(r => ({ who: names[r.uid], ts: r.ts, side: r.side, sym: r.sym, net: r.net, mint: r.mint, pool: r.pool, logo: r.logo, name: r.name, k: r.k, usdUsd: Math.round(r.usdUsd * 100) / 100, price: r.price, pnlUsd: r.pnlUsd == null ? null : Math.round(r.pnlUsd * 100) / 100 }));
    const resp = new Response(JSON.stringify({ rows: pub, hot: hot.slice(0, 8), ts: Date.now() }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20', ...CORS } });
    try { await caches.default.put(ck, resp.clone()); } catch (e) {}
    return resp;
  }
  if (path === '/public') { // somebody's Demo Spot portfolio, for the profile card's Portfolio button (2026-10-16): worth, season P&L, rank and what they hold - never the cash figure to the cent, never a quantity
    const pu = String(url.searchParams.get('uid') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!pu) return jr({ error: 'bad' }, 400);
    const ck = new Request('https://marginpad.io/__spot_public_v1_' + pu);
    try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
    let d = null; try { d = await (await spotStub(env).fetch(new Request('https://do/s2/portfolio?uid=' + encodeURIComponent(pu) + '&ro=1'))).json(); } catch (e) { return spotFail(env, jr, path); }
    let out;
    if (!d || d.none) out = { none: true };
    else {
      const holds = await spotPriceHolds(env, d.holds || []);
      const equityUsd = Math.round(((+d.usdtUsd || 0) + holds.reduce((s, x) => s + x.valueUsd, 0)) * 100) / 100;
      const netUsd = Math.round((equityUsd - (+d.depositedUsd || 0)) * 100) / 100;
      const ws = lbPeriodStart(Date.now()), sday = new Date(ws).toISOString().slice(0, 10);
      let base = 0; if ((+d.created || 0) < ws) { const sn = (d.snaps || []).filter(s => s.day <= sday).slice(-1)[0]; if (sn) base = (+sn.valueUsd || 0) - (+sn.depUsd || 0); }
      let rank = null, boardN = 0; try { const snap = await memeSnapshot(env, ws); boardN = snap.n || 0; const me = (snap.rows || []).find(r => String(r.uid) === pu); if (me) rank = me.rank; } catch (e) {}
      const tot = holds.reduce((s, x) => s + x.valueUsd, 0);
      out = { equityUsd, allTimePnlUsd: netUsd, seasonPnlUsd: Math.round((netUsd - base) * 100) / 100, rank, n: boardN, claims: +d.claims || 0, since: d.created, cashShare: equityUsd > 0 ? Math.round((+d.usdtUsd || 0) / equityUsd * 100) : 100,
        holds: holds.sort((a, b) => b.valueUsd - a.valueUsd).map(x => { const m = x.meta || {}; return { sym: m.sym || String(x.key).replace(/^cex:/, ''), net: m.net || '', logo: m.logo || '', k: m.k || 'cex', valueUsd: x.valueUsd, pnlPct: x.pnlPct, share: tot > 0 ? Math.round(x.valueUsd / tot * 100) : 0, rugged: !!x.rugged, stale: !!x.stale }; }) };
    }
    const resp = new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', ...CORS } });
    try { await caches.default.put(ck, resp.clone()); } catch (e) {}
    return resp;
  }
  if (path === '/theses') { // the newest five theses (Community posts in the thesis category), for the Demo Spot card; public, edge 60 s
    const ck = new Request('https://marginpad.io/__spot_theses_v1');
    try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
    let posts = []; try { const r = await env.COMM.get(env.COMM.idFromName('main')).fetch(new Request('https://do/feed?sort=new&cat=thesis')); posts = ((await r.json()) || {}).posts || []; } catch (e) {}
    const rows = posts.filter(p => !/^e2e_/i.test(p.author || '')).slice(0, 5).map(p => ({ id: p.id, title: p.title, author: p.author, ts: p.ts, syms: String(p.syms || '').split(',').filter(Boolean), likes: p.likes || 0, ncom: p.ncom || 0, excerpt: String(p.body || '').replace(/[#*_>\\[\\]()\`]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 150), slug: commSlug(p.title) }));
    const resp = new Response(JSON.stringify({ rows, more: '/blog/theses/' }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', ...CORS } });
    try { await caches.default.put(ck, resp.clone()); } catch (e) {}
    return resp;
  }
`, 'spot public routes');
// the pricing loop in /portfolio becomes a helper
swap(`    const holds = d.holds || [];
    for (const x of holds) {
      let px = 0;
      try {
        if (x.meta && x.meta.k === 'meme') { const mp = await spotMemePrice(env, x.meta.net || 'solana', x.meta.pool); px = mp ? mp.price : 0; if (mp && !mp.stale) { x.liqUsd = Math.round(+mp.liqUsd || 0); x.rugged = x.liqUsd < SPOT_THIN_LIQ; } }
        else { const pd = await fetchPriceCached(x.meta && x.meta.sym || String(x.key).replace(/^cex:/, '')); px = pd ? +pd.price : 0; }
      } catch (e) {}
      if (!(px > 0)) { px = +((x.meta && x.meta.lastPx)) || 0; x.stale = true; } // dead feed (rugged meme) -> last known mark + a stale flag for the UI
      x.price = px; x.valueUsd = Math.round(x.qty * px * 100) / 100; x.pnlUsd = Math.round((x.valueUsd - x.costUsd) * 100) / 100; x.pnlPct = x.costUsd > 0 ? Math.round(x.pnlUsd / x.costUsd * 10000) / 100 : 0;
    }`.split('\n').join(N), `    const holds = await spotPriceHolds(env, d.holds || []);`, 'portfolio pricing loop');
before(`// Prices for a set of held keys, cheaply:`, `// Price a member's holdings in place (the /portfolio read and the public /public card share it): a meme from its own pool
// (rugged = the pool holds under SPOT_THIN_LIQ), a major from the exchange feed, a dead feed from the last mark + stale.
async function spotPriceHolds(env, holds) {
  for (const x of holds) {
    let px = 0;
    try {
      if (x.meta && x.meta.k === 'meme') { const mp = await spotMemePrice(env, x.meta.net || 'solana', x.meta.pool); px = mp ? mp.price : 0; if (mp && !mp.stale) { x.liqUsd = Math.round(+mp.liqUsd || 0); x.rugged = x.liqUsd < SPOT_THIN_LIQ; } }
      else { const pd = await fetchPriceCached(x.meta && x.meta.sym || String(x.key).replace(/^cex:/, '')); px = pd ? +pd.price : 0; }
    } catch (e) {}
    if (!(px > 0)) { px = +((x.meta && x.meta.lastPx)) || 0; x.stale = true; } // dead feed (rugged meme) -> last known mark + a stale flag for the UI
    x.price = px; x.valueUsd = Math.round(x.qty * px * 100) / 100; x.pnlUsd = Math.round((x.valueUsd - x.costUsd) * 100) / 100; x.pnlPct = x.costUsd > 0 ? Math.round(x.pnlUsd / x.costUsd * 10000) / 100 : 0;
  }
  return holds;
}
`, 'spotPriceHolds');

/* 5. theses are Community posts in their own category; publishing one pays XP + Ticks once the DO accepted it */
swap(`const COMM_CATS = { ideas: 'Trading Ideas', analysis: 'Technical Analysis', news: 'Market News', education: 'Education', crypto: 'Crypto', forex: 'Forex', stocks: 'Stocks', futures: 'Futures', strategies: 'Strategies', psychology: 'Psychology', risk: 'Risk Management', indicators: 'Indicators', platform: 'Platform Updates' };`,
  `const COMM_CATS = { ideas: 'Trading Ideas', analysis: 'Technical Analysis', news: 'Market News', education: 'Education', crypto: 'Crypto', forex: 'Forex', stocks: 'Stocks', futures: 'Futures', strategies: 'Strategies', psychology: 'Psychology', risk: 'Risk Management', indicators: 'Indicators', platform: 'Platform Updates', thesis: 'Theses' }; // thesis (2026-10-16): a Demo Spot thesis - written on /spot/, listed on /blog/theses/, pays XP + Ticks`, 'COMM_CATS');
swap(`const COMM_CATS_ES = { ideas: 'Ideas de trading', analysis: 'Análisis técnico', news: 'Noticias del mercado', education: 'Educación', crypto: 'Crypto', forex: 'Forex', stocks: 'Acciones', futures: 'Futuros', strategies: 'Estrategias', psychology: 'Psicología', risk: 'Gestión del riesgo', indicators: 'Indicadores', platform: 'Novedades de la plataforma' };`,
  `const COMM_CATS_ES = { ideas: 'Ideas de trading', analysis: 'Análisis técnico', news: 'Noticias del mercado', education: 'Educación', crypto: 'Crypto', forex: 'Forex', stocks: 'Acciones', futures: 'Futuros', strategies: 'Estrategias', psychology: 'Psicología', risk: 'Gestión del riesgo', indicators: 'Indicadores', platform: 'Novedades de la plataforma', thesis: 'Tesis' };
const THESIS_XP = 20, THESIS_TICKS = 5; // what publishing a thesis pays (owner 2026-10-16: "XP i ticks, ne nesto puno"); Ticks are day-capped by TICK_CAP.thesis`, 'COMM_CATS_ES');
swap(`  if (request.method === 'POST' && path === '/post' && r && r.status === 200) { try { const _pd = JSON.parse(txt); if (_pd && !_pd.error) { const pr2 = evPush(env, request, 'post', author, '/community/'); if (ctx && ctx.waitUntil) ctx.waitUntil(pr2); else await pr2; } } catch (e) {} }`,
  `  if (request.method === 'POST' && path === '/post' && r && r.status === 200) { try { const _pd = JSON.parse(txt); if (_pd && !_pd.error) { const pr2 = evPush(env, request, 'post', author, '/community/'); if (ctx && ctx.waitUntil) ctx.waitUntil(pr2);
    else await pr2;
    // A THESIS PAYS (2026-10-16): XP through the one grant path (day-capped like every source), Ticks through the capped /ticks/grant.
    // The reward rides back on the response so the Demo Spot sheet can say what it paid; the DO body itself is untouched.
    let _cat = ''; try { _cat = String((JSON.parse(rawBody || '{}').cat) || ''); } catch (e) {}
    if (_cat === 'thesis' && uid) {
      const rw = { xp: 0, ticks: 0 };
      try { const xr = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/xp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, src: 'thesis', amt: THESIS_XP, dayCap: THESIS_XP * 2, note: 'published a thesis' }) })); const xj = await xr.json(); if (xj && !xj.error) rw.xp = +xj.granted || 0; } catch (e) {} // granted = what the day cap let through (0 on the third thesis of a day)
      try { const tj = await usersDO(env, '/ticks/grant', { uid, src: 'thesis', amt: THESIS_TICKS, note: 'published a thesis' }); if (tj && tj.ok) rw.ticks = +tj.granted || 0; } catch (e) {}
      try { await evPush(env, request, 'thesis', author, '/spot/'); } catch (e) {}
      try { await caches.default.delete(new Request('https://marginpad.io/__spot_theses_v1')); } catch (e) {}
      _pd.reward = rw; txt = JSON.stringify(_pd);
    }
  } } catch (e) {} }`, 'thesis reward');

/* 6. /blog/theses/ - the list every thesis lands on (SSR from the Community DO, blog chrome, 120 s) */
before(`    if (url.pathname.startsWith('/api/spot/')) return handleSpot(url, request, env);`, `    if (url.pathname === '/blog/theses/' || url.pathname === '/blog/theses') return blogThesesPage(url, request, env); // traders' theses (2026-10-16) - a Community category rendered as a blog section`, 'route theses');
before(`async function handleSpot(url, request, env) {`, `// TRADERS' THESES ON THE BLOG (2026-10-16, owner: "teza ... koja ce da se kaci na blogu"). A thesis is a Community post in the
// \`thesis\` category, written from /spot/; this page is the blog's section for them - server-rendered from the Community DO so a
// crawler reads every title, every author and the first lines, each linking to the post's own SSR page under /community/p/.
async function blogThesesPage(url, request, env) {
  if (url.pathname === '/blog/theses') return Response.redirect(url.origin + '/blog/theses/', 301);
  const ck = new Request('https://marginpad.io/__blog_theses_v1');
  if (!url.searchParams.get('nc')) { try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {} }
  let posts = []; try { const r = await env.COMM.get(env.COMM.idFromName('main')).fetch(new Request('https://do/feed?sort=new&cat=thesis')); posts = (((await r.json()) || {}).posts || []).filter(p => !/^e2e_/i.test(p.author || '')); } catch (e) {}
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ex = b => esc(String(b || '').replace(/[#*_>\\[\\]()\`]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 220));
  const day = ts => new Date(ts).toUTCString().slice(5, 16);
  const cards = posts.map(p => '<article class="th"><a class="th-t" href="/community/p/' + esc(p.id) + '/' + esc(commSlug(p.title)) + '">' + esc(p.title) + '</a><div class="th-m"><a href="/community/u/' + esc(p.author) + '">' + esc(p.author) + '</a> · ' + day(p.ts) + (p.syms ? ' · ' + String(p.syms).split(',').filter(Boolean).map(s => '<span class="th-s">$' + esc(s) + '</span>').join(' ') : '') + ' · ' + (p.likes || 0) + ' likes · ' + (p.ncom || 0) + ' comments</div><p class="th-x">' + ex(p.body) + '</p></article>').join('');
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />'
    + '<title>Traders\\' Theses - Demo Spot Calls on Meme Coins and Majors | MarginPad Blog</title>'
    + '<meta name="description" content="Theses written by MarginPad members from their Demo Spot portfolios: why they hold a coin, what would prove them wrong, and the levels they watch. ' + posts.length + ' published, newest first." />'
    + '<link rel="canonical" href="https://marginpad.io/blog/theses/" /><meta name="robots" content="index, follow, max-image-preview:large" /><meta name="theme-color" content="#0a0b0d" />'
    + '<meta property="og:title" content="Traders\\' Theses | MarginPad Blog" /><meta property="og:description" content="Why MarginPad members hold what they hold on Demo Spot - a thesis a post, newest first." /><meta property="og:type" content="website" /><meta property="og:url" content="https://marginpad.io/blog/theses/" /><meta property="og:image" content="https://marginpad.io/assets/og/spot.jpg" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" />'
    + '<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="/assets/fonts.css" /><link rel="stylesheet" href="/assets/blog.css" />'
    + '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: "Traders' Theses", url: 'https://marginpad.io/blog/theses/', description: 'Theses written by MarginPad members from their Demo Spot portfolios.', hasPart: posts.slice(0, 20).map(p => ({ '@type': 'SocialMediaPosting', headline: p.title, url: 'https://marginpad.io/community/p/' + p.id + '/' + commSlug(p.title), datePublished: new Date(p.ts).toISOString(), author: { '@type': 'Person', name: p.author } })) }) + '</script>'
    + '<style>.th{padding:16px 0;border-top:1px solid #1e242e}.th:first-of-type{border-top:0}.th-t{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:20px;letter-spacing:-.02em;color:#ecebe4;text-decoration:none}.th-t:hover{color:#c2f64a}.th-m{color:#8b939c;font-size:12.5px;margin:6px 0 8px}.th-m a{color:#c2f64a;text-decoration:none}.th-s{font-family:"Space Mono",monospace;font-size:11px;color:#a06bff;background:rgba(160,107,255,.1);border-radius:4px;padding:1px 5px}.th-x{margin:0;color:#b9c0c8;font-size:14.5px;line-height:1.6}.th-cta{display:flex;align-items:center;gap:14px;background:linear-gradient(120deg,rgba(160,107,255,.12),rgba(194,246,74,.06));border:1px solid rgba(160,107,255,.3);border-radius:14px;padding:14px 16px;margin:18px 0;text-decoration:none;color:#ecebe4}.th-cta b{color:#c2f64a}.th-cta span{flex:1;min-width:0}.th-cta small{display:block;color:#9aa3ad;font-size:13px;margin-top:2px}.th-cta i{font:700 12px "Space Mono",monospace;color:#c2f64a;font-style:normal;white-space:nowrap}.th-empty{color:#8b939c;padding:24px 0}</style></head>'
    + '<body><div class="wrap"><header><a class="brand" href="/">MARGIN<b>PAD</b></a><nav class="nav"><a href="/spot/">Demo Spot</a><a href="/blog/">Blog</a></nav></header>'
    + '<div class="crumb"><a href="/">Home</a> / <a href="/blog/">Blog</a> / Theses</div>'
    + '<div class="blog-hero"><h1 class="blog-title">Traders\\' theses</h1><p class="blog-intro">Why a MarginPad member holds what they hold on <a href="/spot/">Demo Spot</a>: the coin, the reasoning, the level that would prove them wrong. Written by members, published here newest first; each one pays its author ' + THESIS_XP + ' XP and ' + THESIS_TICKS + ' Ticks, and the market pays the rest.</p></div>'
    + '<a class="th-cta" href="/spot/#thesis"><span><b>Write your own thesis</b><small>Hold a coin on Demo Spot, say why, and it lands here within a minute.</small></span><i>Open Demo Spot &rarr;</i></a>'
    + (cards || '<p class="th-empty">No thesis published yet - the first one lands here the moment somebody writes it on Demo Spot.</p>')
    + '<footer><span>&copy; 2026 MarginPad</span><span><a href="/">Calculators</a> &middot; <a href="/blog/">Blog</a> &middot; <a href="/community/c/thesis">Theses in the Community</a> &middot; <a href="/terms/">Terms</a></span></footer></div></body></html>';
  const resp = new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=120', 'x-mp-ssr': 'blog-theses' } });
  try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
`, 'blogThesesPage');

fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('spot social backend in place');

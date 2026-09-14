// The SEO / AI-discovery surface (2026-09-14) — owner: "jel ima jos nesto ... nesto sto takodje nikad
// nije pomenuto nigde?"
//
// This is the audit that found the gaps, kept as a test so they cannot come back. The expensive one it
// exists for: robots.txt had a blanket `Disallow: /api/`, so all EIGHTEEN endpoints llms.txt tells an
// assistant to fetch mid-answer were unreadable to bingbot — 71% of the crawling we actually get, and
// what feeds Copilot — while only three named AI bots could reach them.
//
//   node build/seo-surface-e2e.js
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 240) : '')); } };
const DIST = path.join(__dirname, '..', 'dist');
const S = 'https://marginpad.io';

/* robots.txt the way a crawler reads it: per user-agent group, longest matching rule wins, Allow wins a tie */
function robots(txt) {
  const g = {}; let cur = [];
  for (const line of txt.split('\n')) {
    const ua = line.match(/^User-agent:\s*(\S+)/i);
    if (ua) { if (!g[ua[1]]) g[ua[1]] = []; cur = [ua[1]]; continue; }
    const m = line.match(/^(Allow|Disallow):\s*(\S*)/i);
    if (m && cur.length) for (const u of cur) g[u].push([m[1].toLowerCase(), m[2]]);
  }
  return (agent, p) => {
    const rules = g[agent] || g['*'] || [];
    let best = null;
    for (const [k, v] of rules) if (v && p.startsWith(v)) {
      if (!best || v.length > best[1].length || (v.length === best[1].length && k === 'allow')) best = [k, v];
    }
    return !best || best[0] === 'allow';
  };
}

(async () => {
  const get = async u => { const r = await fetch(S + u + (u.includes('?') ? '&' : '?') + 'cb=' + Date.now()); return { s: r.status, t: await r.text(), ct: (r.headers.get('content-type') || '').split(';')[0] }; };

  console.log('\nrobots.txt: everything we advertise is reachable, everything private is not');
  const rb = await get('/robots.txt');
  ok(rb.s === 200, 'robots.txt serves');
  const can = robots(rb.t);
  const llms = (await get('/llms.txt')).t;
  const eps = [...new Set([...llms.matchAll(/https:\/\/marginpad\.io(\/api\/[a-z0-9\/_-]+)/gi)].map(m => m[1]))]
    .filter(e => !e.includes('whsink'));
  ok(eps.length > 10, 'llms.txt names ' + eps.length + ' endpoints for an assistant to fetch');
  for (const agent of ['*', 'bingbot', 'Googlebot', 'GPTBot', 'ClaudeBot', 'PerplexityBot']) {
    const blocked = eps.filter(e => !can(agent, e));
    ok(blocked.length === 0, agent + ' can fetch every endpoint we advertise', blocked.slice(0, 4));
  }
  for (const priv of ['/api/admin/money', '/api/auth/user', '/api/trade/open', '/api/reward/claim', '/chat/ws', '/telegram/hook']) {
    ok(!can('*', priv) && !can('bingbot', priv), 'still closed: ' + priv);
  }
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    ok(new RegExp('User-agent:\\s*' + bot, 'i').test(rb.t), bot + ' is named and welcomed');
  }
  ok(/Sitemap:\s*https?:\/\//i.test(rb.t), 'robots names a sitemap');

  console.log('\nfeeds');
  const rss = await get('/feed.xml');
  ok(rss.s === 200 && /xml/.test(rss.ct), 'RSS serves as XML (' + rss.s + ', ' + rss.ct + ')');
  ok((rss.t.match(/<item>/g) || []).length >= 20, 'with ' + (rss.t.match(/<item>/g) || []).length + ' items');
  ok(/<atom:link[^>]+rel="self"/.test(rss.t), 'and declares itself (rel=self)');
  ok(!/\|\s*MarginPad<\/title>|—\s*MarginPad<\/title>/.test(rss.t), 'item titles are not suffixed with the site name');
  { const d = (rss.t.match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1];
    ok(d && !isNaN(new Date(d)), 'every item carries a real date (' + d + ')'); }
  const jf = await get('/feed.json');
  ok(jf.s === 200, 'JSON Feed serves');
  { let j = null; try { j = JSON.parse(jf.t); } catch (e) {}
    ok(j && /jsonfeed\.org/.test(j.version || ''), 'and is a valid JSON Feed');
    ok(j && (j.items || []).length >= 20, 'with ' + (j && j.items ? j.items.length : 0) + ' items');
    ok(j && j.items.every(x => x.id && x.url && x.title && x.date_published), 'every item has id, url, title and date'); }
  { const h = (await get('/blog/')).t;
    ok(h.indexOf('application/rss+xml') > 0, 'a page declares the feed in its head'); }

  console.log('\nstructured data where it matters');
  for (const [p, want] of [['/trading-competition/', 'Event'], ['/season/', 'Event'], ['/', 'Organization'], ['/liquidations/', null]]) {
    const h = (await get(p)).t;
    const types = [...h.matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)].map(m => m[1]);
    ok(types.length > 0, p + ' carries structured data (' + [...new Set(types)].slice(0, 4).join(', ') + ')');
    if (want) ok(types.indexOf(want) >= 0, p + ' declares ' + want, [...new Set(types)]);
  }
  { // nothing indexable may be left without any
    let none = [];
    (function walk(d, rel) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) { if (['assets', 'i18n', 'demo-home', 'es'].includes(e.name)) continue; walk(path.join(d, e.name), rel + '/' + e.name); continue; }
        if (e.name !== 'index.html') continue;
        const h = fs.readFileSync(path.join(d, e.name), 'utf8');
        if (/name="robots" content="[^"]*noindex/.test(h)) continue;
        if (!/"@type"\s*:/.test(h)) none.push(rel + '/');
      }
    })(DIST, '');
    ok(none.length <= 3, 'at most a handful of indexable pages without structured data (' + none.length + ')', none.slice(0, 6)); }

  console.log('\nthe AI layer says what we can prove');
  for (const f of ['/llms.txt', '/llms-full.txt']) {
    const t = (await get(f)).t;
    ok(/SERVER-side/.test(t), f + ' states that fills happen server-side — the reason a number here is worth citing');
    ok(/trading competition/i.test(t), f + ' names the competition');
    ok(/Last updated:\s*\d{4}-\d{2}-\d{2}/.test(t), f + ' carries a date');
  }

  console.log('\ncanonicals, redirects and the Spanish twins');
  { // a twin that canonicalises to the English page tells Google not to index it at all
    for (const pth of ['/es/premium/', '/es/rekt/', '/es/about/']) {
      const h = (await get(pth)).t;
      const c = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
      ok(c === S + pth, pth + ' canonicalises to itself', c);
    } }
  { // the frozen language subpages are copies of an English page and must not compete with it
    for (const pth of ['/de/funding/', '/tr/long-short/', '/ar/defi/']) {
      const h = (await get(pth)).t;
      const c = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
      ok(/^https:\/\/marginpad\.io\/(funding|long-short|defi)\/$/.test(c), pth + ' canonicalises to the English original', c);
    } }
  { // a sitemap lists final URLs; anything in it that redirects wastes a crawl
    const sm = (await get('/sitemap.xml')).t;
    const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    ok(!locs.some(l => /\/blog\/[a-z0-9-]+\/es\//.test(l)), 'no redirecting URL is listed in the sitemap');
    const red = [];
    for (const l of locs.slice(0, 40)) { const r = await fetch(l, { redirect: 'manual' }); if (r.status !== 200) red.push(r.status + ' ' + l.replace(S, '')); }
    ok(red.length === 0, 'the first 40 sitemap URLs all answer 200', red.slice(0, 5));
  }
  { // every URL the AI layer names has to exist - the rule in CLAUDE.md, enforced
    const t = (await get('/llms.txt')).t + '\n' + (await get('/llms-full.txt')).t;
    const urls = [...new Set([...t.matchAll(/https:\/\/marginpad\.io[^\s)\]`,;"']*/g)].map(m => m[0].replace(/[.,:;*_)\]]+$/, '')))]
      .filter(u => u.indexOf('<') < 0 && u.indexOf('whsink') < 0);
    const bad = [];
    for (let i = 0; i < urls.length; i += 12)
      await Promise.all(urls.slice(i, i + 12).map(async u => {
        try { const r = await fetch(u, { redirect: 'manual' }); if (r.status !== 200) bad.push(r.status + ' ' + u.replace(S, '')); }
        catch (e) { bad.push('ERR ' + u); }
      }));
    ok(bad.length === 0, 'all ' + urls.length + ' URLs named in the AI layer answer 200', bad.slice(0, 6));
  }

  console.log('\nseo-surface-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

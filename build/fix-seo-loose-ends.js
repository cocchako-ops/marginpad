/* Loose ends from the 2026-09-14 technical sweep. Each one is small and each one is real.
 * Idempotent, runs over dist. Run: node build/fix-seo-loose-ends.js [--dry]
 *
 * 1. /es/premium/ canonicalised to the ENGLISH page. A twin that canonicalises away tells Google not
 *    to index it at all — the Spanish page would simply vanish. It happened because the English page's
 *    canonical has no trailing slash (https://marginpad.io/premium) and gen-pages rewrites the slashed
 *    form. Fixed here and the shape is asserted by seo-surface-e2e, so one odd canonical cannot do it
 *    again quietly.
 *
 * 2. The 33 FROZEN language subpages (/de/funding/, /tr/long-short/, /ar/defi/ … 11 languages x 3)
 *    are indexable, self-canonical, in NO sitemap and reachable from nothing. CLAUDE.md records that
 *    translated subpages are RETIRED and that the worker 301s /<lang>/<anything>/ to the English
 *    original — these are the leftovers that are still served as static files. Self-canonical, they
 *    compete with the English page they are a copy of. They now canonicalise to that English page,
 *    which is the decision that was already made, just never applied to the files.
 *
 * 3. Internal links pointing at URLs that redirect: 41 to /blog/<slug>/es/ (301 -> /es/blog/<slug>/)
 *    and 18 to /liquidations/<coin>/ (301 -> /liquidations/). A redirect costs a crawl and leaks a
 *    little of the link's value; both targets exist, so link to them directly.
 *
 * 4. Three sitemap rows for /blog/<slug>/es/, which 301. A sitemap should only list final URLs.
 */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const S = 'https://marginpad.io';
const DRY = process.argv.includes('--dry');
const LANGS = ['ar', 'de', 'fr', 'id', 'ja', 'ko', 'nl', 'pt', 'ru', 'tr', 'zh'];
const SUBS = ['defi', 'funding', 'long-short'];

let n1 = 0, n2 = 0, n3 = 0, n4 = 0;

// ── 1. a Spanish twin must canonicalise to itself ─────────────────────────────────────────────────
{
  const p = path.join(DIST, 'es', 'premium', 'index.html');
  if (fs.existsSync(p)) {
    let h = fs.readFileSync(p, 'utf8');
    const want = S + '/es/premium/';
    const cur = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    if (cur && cur !== want) {
      h = h.replace(/<link rel="canonical" href="[^"]*"/, '<link rel="canonical" href="' + want + '"');
      h = h.replace(/<meta property="og:url" content="[^"]*"/, '<meta property="og:url" content="' + want + '"');
      if (!DRY) fs.writeFileSync(p, h);
      n1 = 1;
      console.log('  /es/premium/ canonical ' + cur.replace(S, '') + ' -> /es/premium/');
    }
  }
}

// ── 2. the frozen language subpages point at the English original ────────────────────────────────
for (const L of LANGS) for (const sub of SUBS) {
  const p = path.join(DIST, L, sub, 'index.html');
  if (!fs.existsSync(p)) continue;
  let h = fs.readFileSync(p, 'utf8');
  const want = S + '/' + sub + '/';
  const cur = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  if (cur === want) continue;
  if (/<link rel="canonical"/.test(h)) h = h.replace(/<link rel="canonical" href="[^"]*"/, '<link rel="canonical" href="' + want + '"');
  else h = h.replace('</head>', '<link rel="canonical" href="' + want + '" />\n</head>');
  if (!DRY) fs.writeFileSync(p, h);
  n2++;
}
if (n2) console.log('  ' + n2 + ' frozen language subpages now canonicalise to the English original');

// ── 3 + 4. links and sitemap rows that point at a redirect ───────────────────────────────────────
const REDIR = [
  [/\/blog\/([a-z0-9-]+)\/es\//g, (m, slug) => '/es/blog/' + slug + '/'],
  [/\/liquidations\/(btc|eth|sol|xrp|bnb|doge)\//g, () => '/liquidations/'],
];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'assets' || e.name === 'i18n') continue; walk(p); continue; }
    if (!e.name.endsWith('.html')) continue;
    const h = fs.readFileSync(p, 'utf8');
    let out = h;
    for (const [re, to] of REDIR) {
      // only inside href="…", never in prose or a canonical that is meant to be what it is
      out = out.replace(/href="([^"]+)"/g, (full, url) => {
        const re2 = new RegExp(re.source);
        if (!re2.test(url)) return full;
        return 'href="' + url.replace(re2, to) + '"';
      });
    }
    if (out !== h) { if (!DRY) fs.writeFileSync(p, out); n3++; }
  }
})(DIST);
if (n3) console.log('  ' + n3 + ' pages had a link to a redirect rewritten to the final URL');

for (const sm of ['sitemap.xml', 'sitemap-i18n.xml', 'sitemap-extras.xml']) {
  const p = path.join(DIST, sm);
  if (!fs.existsSync(p)) continue;
  const h = fs.readFileSync(p, 'utf8');
  const out = h.replace(/\s*<url>(?:(?!<\/url>)[\s\S])*?<loc>[^<]*\/blog\/[a-z0-9-]+\/es\/<\/loc>[\s\S]*?<\/url>/g, '');
  if (out !== h) { if (!DRY) fs.writeFileSync(p, out); n4 += (h.match(/\/blog\/[a-z0-9-]+\/es\//g) || []).length; }
}
if (n4) console.log('  ' + n4 + ' sitemap rows for redirecting URLs removed');

console.log('loose ends: canonical ' + n1 + ', frozen subpages ' + n2 + ', pages relinked ' + n3 + ', sitemap rows ' + n4 + (DRY ? '  [dry run]' : ''));

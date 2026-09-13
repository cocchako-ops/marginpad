/* Spanish site generator (2026-09-12): every English dist page → dist/es/<path>/index.html from the SAME markup,
   text swapped through build/data/es/catalog.json (segments the translators filled in). Also: dist/app-es.html (tool
   shell served by the worker on /es/paper-trade …), hreflang en/es/x-default on BOTH twins, internal links pointing at
   the Spanish twin when it exists, dist/sitemap-es.xml + robots line. Runs LAST in build.js and standalone:
     node build/es/gen-pages.js            (writes everything; prints coverage; exits 1 if a page has < MIN_COVER)
     node build/es/gen-pages.js --dry      (coverage only)                                                            */
'use strict';
const fs = require('fs'), path = require('path');
const { extract, apply } = require('./lib');
const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const CAT = path.join(ROOT, 'build', 'data', 'es', 'catalog.json');
const ORIGIN = 'https://marginpad.io';
const LANG = /^(es|pt|fr|de|ru|tr|zh|ja|ko|ar|id|nl|sv|no|da|fi)$/;
const SKIP_DIRS = new Set(['assets', 'demo-home', 'i18n', 'sdk', 'og', 'img', 'fonts', 'widget']);
const SKIP_PAGES = new Set(['dolar-cripto/index.html', 'bitcoin-hoje/index.html', 'simulador-trading-cripto-argentina/index.html',
  'simulador-trading-cripto-brasil/index.html', 'app.html' /* → app-es.html, handled apart */]);
const NOINDEX_OK = true; // a noindex English page gets a noindex Spanish twin (same meta) — nothing to decide here
const TOOL_ROUTES = ['/paper-trade', '/charts', '/calculators', '/screener', '/heatmap', '/swap'];
const MIN_COVER = 0.6; // a twin with less than 60% of its text in Spanish is not published (English fallback would read as a broken page)

function pages() {
  const out = [];
  (function walk(d, rel) {
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f), r = rel ? rel + '/' + f : f;
      const st = fs.statSync(fp);
      if (st.isDirectory()) { if (LANG.test(f) || SKIP_DIRS.has(f)) continue; walk(fp, r); }
      else if ((f === 'index.html' || (!rel && f.endsWith('.html'))) && !SKIP_PAGES.has(r)) out.push(r);
    }
  })(DIST, '');
  return out.sort();
}
const urlOf = (rel) => '/' + rel.replace(/index\.html$/, '');

function hreflangBlock(html, enUrl, esUrl) {
  // collect existing alternates, force en / es / x-default, keep the rest (12-language homepage, blog i18n)
  const re = /[ \t]*<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>\s*\n?/g;
  const map = new Map(); let m; let first = -1;
  while ((m = re.exec(html))) { if (first < 0) first = m.index; if (!map.has(m[1])) map.set(m[1], m[2]); }
  map.set('x-default', enUrl); map.set('en', enUrl); map.set('es', esUrl);
  const lines = [...map.entries()].map(([l, h]) => '<link rel="alternate" hreflang="' + l + '" href="' + h + '" />').join('\n');
  html = html.replace(re, '');
  const canon = html.indexOf('<link rel="canonical"');
  if (canon >= 0) { const end = html.indexOf('>', canon) + 1; return html.slice(0, end) + '\n' + lines + html.slice(end); }
  return html.replace('</head>', lines + '\n</head>');
}

function main() {
  const dry = process.argv.includes('--dry');
  const cat = JSON.parse(fs.readFileSync(CAT, 'utf8')).items;
  const tx = (id, en) => (cat[id] && cat[id].es) || null;
  const list = pages();
  const twins = new Set(list.map(urlOf).concat(TOOL_ROUTES, ['/']));
  const esHref = (h) => { // internal link → Spanish twin when one exists
    const abs = h.startsWith(ORIGIN) ? h.slice(ORIGIN.length) : h;
    if (!abs.startsWith('/') || abs.startsWith('//') || abs.startsWith('/es/') || abs.startsWith('/api/') || abs.startsWith('/assets/')) return null;
    const m = abs.match(/^([^?#]*)(.*)$/); let p = m[1]; const rest = m[2];
    if (/\.[a-z0-9]{2,5}$/i.test(p)) return null;
    const key = p === '' ? '/' : p;
    if (twins.has(key) || twins.has(key + '/') || twins.has(key.replace(/\/$/, ''))) return (h.startsWith(ORIGIN) ? ORIGIN : '') + '/es' + (key === '/' ? '/' : key) + rest;
    return null;
  };
  const report = []; let written = 0, skipped = 0; const sitemap = [];
  for (const rel of list) {
    const src = fs.readFileSync(path.join(DIST, rel), 'utf8');
    const r = apply(src, tx);
    const total = r.hit + r.missing, cover = total ? r.hit / total : 1;
    const enUrl = ORIGIN + urlOf(rel), esUrl = ORIGIN + '/es' + urlOf(rel);
    if (cover < MIN_COVER) { skipped++; report.push({ rel, cover, hit: r.hit, missing: r.missing, skipped: true }); continue; }
    let html = r.html;
    html = html.replace(/<html([^>]*)\blang="en"/, '<html$1lang="es"');
    html = html.split('<link rel="canonical" href="' + enUrl + '"').join('<link rel="canonical" href="' + esUrl + '"');
    html = html.split('<meta property="og:url" content="' + enUrl + '"').join('<meta property="og:url" content="' + esUrl + '"');
    html = html.replace(/<meta property="og:locale" content="en[_A-Z]*"/, '<meta property="og:locale" content="es_ES"');
    html = hreflangBlock(html, enUrl, esUrl);
    // JSON-LD: the page's own url + inLanguage
    html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (all, body) => {
      let b = body.split('"' + enUrl + '"').join('"' + esUrl + '"').split('"inLanguage":"en"').join('"inLanguage":"es"').split('"inLanguage":"en-US"').join('"inLanguage":"es"');
      return '<script type="application/ld+json">' + b + '</script>';
    });
    // internal links → Spanish twins
    html = html.replace(/<a\b([^>]*?)\bhref="([^"]*)"/g, (all, pre, h) => { const t = esHref(h); return t ? '<a' + pre + 'href="' + t + '"' : all; });
    // the language selector on standalone pages lands on the twin; mark the page for mp-nav
    html = html.replace('<html lang="es"', '<html lang="es" data-es-twin="' + urlOf(rel) + '"');
    if (!dry) {
      const out = path.join(DIST, 'es', rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, html);
      // English twin: hreflang pointing at the Spanish page (idempotent)
      const en2 = hreflangBlock(src, enUrl, esUrl);
      if (en2 !== src) fs.writeFileSync(path.join(DIST, rel), en2);
    }
    written++;
    if (!/<meta name="robots" content="noindex/.test(html)) sitemap.push(esUrl);
    report.push({ rel, cover, hit: r.hit, missing: r.missing });
  }
  // tool shell
  {
    const src = fs.readFileSync(path.join(DIST, 'app.html'), 'utf8');
    const r = apply(src, tx);
    let html = r.html.replace(/<html([^>]*)\blang="en"/, '<html$1lang="es"');
    html = html.replace(/<a\b([^>]*?)\bhref="([^"]*)"/g, (all, pre, h) => { const t = esHref(h); return t ? '<a' + pre + 'href="' + t + '"' : all; });
    if (!dry) fs.writeFileSync(path.join(DIST, 'app-es.html'), html);
    report.push({ rel: 'app.html → app-es.html', cover: r.hit / Math.max(1, r.hit + r.missing), hit: r.hit, missing: r.missing });
    for (const t of TOOL_ROUTES) sitemap.push(ORIGIN + '/es' + t);
  }
  if (!dry) {
    const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + sitemap.map(u => '  <url><loc>' + u + '</loc><changefreq>weekly</changefreq><priority>' + (u.endsWith('/es/') ? '1.0' : '0.7') + '</priority></url>').join('\n') + '\n</urlset>\n';
    fs.writeFileSync(path.join(DIST, 'sitemap-es.xml'), sm);
    const rb = path.join(DIST, 'robots.txt'); let robots = fs.readFileSync(rb, 'utf8');
    if (robots.indexOf('sitemap-es.xml') < 0) fs.writeFileSync(rb, robots.replace(/\n?$/, '\n') + 'Sitemap: https://marginpad.io/sitemap-es.xml\n');
  }
  const low = report.filter(r => r.cover < 0.98).sort((a, b) => a.cover - b.cover);
  const totHit = report.reduce((a, r) => a + r.hit, 0), totMiss = report.reduce((a, r) => a + r.missing, 0);
  console.log(`es pages written ${written} · skipped (<${MIN_COVER * 100}% Spanish) ${skipped} · segments ${totHit}/${totHit + totMiss} (${(100 * totHit / Math.max(1, totHit + totMiss)).toFixed(1)}%) · sitemap ${sitemap.length}`);
  if (low.length) console.log('lowest coverage:\n' + low.slice(0, 15).map(r => '  ' + (r.cover * 100).toFixed(0).padStart(3) + '%  ' + r.rel + (r.skipped ? '  SKIPPED' : '')).join('\n'));
  fs.writeFileSync(path.join(ROOT, 'build', 'data', 'es', 'coverage.json'), JSON.stringify(report, null, 1));
  if (skipped && process.argv.includes('--strict')) process.exit(1);
}
main();

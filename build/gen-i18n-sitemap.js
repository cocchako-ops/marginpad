/* Dedicated sitemap for the translated SEO pages that carry real per-language prose:
   /<lang>/<a>-vs-<b>/ (exchange comparisons), /<lang>/guides/<slug>/, and the translated
   /<lang>/<best-for-slug>/ cases. These pages exist on disk with self-canonical + full
   hreflang, but were not listed in any sitemap — this surfaces them to search engines.
   Kept SEPARATE from the main sitemap.xml so the core pages stay the primary signal.
   Only lists files that actually exist on disk (no 404s) and only bestfor slugs that are
   genuinely translated (the newest cases fall back to English and are excluded).
   Run: node build/gen-i18n-sitemap.js  (force-add dist/sitemap-i18n.xml to git). */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
// 2026-08-18: emptied deliberately — the translated SEO pages this sitemap listed were removed
// (1,008 pages, 47 pageviews and 7 Google visits in 90 days). A sitemap that lists redirects or
// 404s wastes crawl budget and is a quality signal in itself. Restore alongside the generators.
// was: const LANGS = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const LANGS = [];
const { CASES } = require('./data/bestfor-cases-i18n');   // CASES[lang][slug] — authoritative translated set
const today = new Date().toISOString().slice(0, 10);
const exists = p => fs.existsSync(path.join(p, 'index.html'));

const urls = [];
function add(loc, pri) { urls.push(`  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${pri}</priority></url>`); }

let nCmp = 0, nGuide = 0, nBest = 0, nCalc = 0, nSim = 0;
for (const lang of LANGS) {
  const base = path.join(DIST, lang);
  if (!fs.existsSync(base)) continue;
  // exchange comparisons  /<lang>/<a>-vs-<b>/  + exchange calculators  /<lang>/<exchange>-{liquidation,pnl}-calculator/
  for (const d of fs.readdirSync(base)) {
    if (/-vs-/.test(d) && exists(path.join(base, d))) { add(`https://marginpad.io/${lang}/${d}/`, '0.5'); nCmp++; }
    else if (/(-liquidation-calculator|-pnl-calculator)$/.test(d) && exists(path.join(base, d))) { add(`https://marginpad.io/${lang}/${d}/`, '0.5'); nCalc++; }
  }
  // guides  /<lang>/guides/<slug>/
  const gdir = path.join(base, 'guides');
  if (fs.existsSync(gdir)) for (const g of fs.readdirSync(gdir)) {
    if (exists(path.join(gdir, g))) { add(`https://marginpad.io/${lang}/guides/${g}/`, '0.5'); nGuide++; }
  }
  // best-for  /<lang>/<slug>/  — only genuinely translated slugs
  const tr = CASES[lang] || {};
  for (const slug of Object.keys(tr)) {
    if (exists(path.join(base, slug))) { add(`https://marginpad.io/${lang}/${slug}/`, '0.5'); nBest++; }
  }
  // trading-simulator SEO pages  /<lang>/{stock,forex,index}-trading-simulator/  (translated, full hreflang)
  for (const slug of ['stock-trading-simulator', 'forex-trading-simulator', 'index-trading-simulator']) {
    if (exists(path.join(base, slug))) { add(`https://marginpad.io/${lang}/${slug}/`, '0.7'); nSim++; }
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(DIST, 'sitemap-i18n.xml'), xml);
console.log(`sitemap-i18n.xml: ${urls.length} URLs (compares ${nCmp}, calculators ${nCalc}, guides ${nGuide}, best-for ${nBest}, simulators ${nSim})`);

// reference it from robots.txt (idempotent)
try {
  const rp = path.join(DIST, 'robots.txt');
  let r = fs.readFileSync(rp, 'utf8');
  if (!r.includes('sitemap-i18n.xml')) {
    r = r.replace(/(Sitemap:\s*https:\/\/marginpad\.io\/sitemap\.xml)/, '$1\nSitemap: https://marginpad.io/sitemap-i18n.xml');
    fs.writeFileSync(rp, r);
    console.log('robots.txt: +Sitemap sitemap-i18n.xml');
  }
} catch (e) { console.log('robots.txt update skipped:', e.message); }

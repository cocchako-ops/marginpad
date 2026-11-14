/* The liquidation feed reads TWELVE exchanges (2026-11-14 evening): Kraken Futures joined the eleven (its public trade feed classifies
   liquidations). Owner: "Ajde ubaci kraken". Same shape as fix-eleven-exchanges.js, one count further: every surface that says
   "eleven exchanges" and lists the eleven is corrected in the SOURCES (worker, generators, i18n master, llms, catalogs) and in the
   generated files (dist, every language) in one pass. Only noun-bound phrases are touched. Thirteen feeds: Binance is read twice.
   Two count words are shared by two languages ("onze" pt/fr, "elf" de/nl), so those rules read the file's language.
   Idempotent; --dry prints only. Never touches dist/llms-changelog.txt.
   Run: node build/fix-twelve-exchanges.js [--dry]                                                                       */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');

function rulesFor(lang) {
  const R = [
    [/Bitfinex, Bitget, Aster, Lighter(?!, Kraken| (?:and|y|e|et|und|en|ve|dan|и) Kraken)/g, 'Bitfinex, Bitget, Aster, Lighter, Kraken'],
    [/Bitfinex, Bitget, Aster (and|y|e|et|und|en|ve|dan|и) Lighter/g, 'Bitfinex, Bitget, Aster, Lighter $1 Kraken'],
    [/\\u00b7 Aster \\u00b7 Lighter<\/b>/g, '\\u00b7 Aster \\u00b7 Lighter \\u00b7 Kraken</b>'],
    [/· Aster · Lighter<\/b>/g, '· Aster · Lighter · Kraken</b>'],
    [/eleven venues, twelve websocket feeds/g, 'twelve venues, thirteen websocket feeds'],
    [/once plataformas, doce conexiones websocket/g, 'doce plataformas, trece conexiones websocket'],
    [/12 websocket feeds, 11 exchanges/g, '13 websocket feeds, 12 exchanges'],
    [/\b([Ee])leven (exchanges|venues|named venues|named exchanges|perpetual-futures (?:exchanges|venues))\b/g, (m, e, w) => (e === 'E' ? 'T' : 't') + 'welve ' + w],
    [/\b([Ee])leven-exchange\b/g, (m, e) => (e === 'E' ? 'T' : 't') + 'welve-exchange'],
    [/\b11 exchanges\b/g, '12 exchanges'],
    [/\bonce (exchanges|venues|plataformas|bolsas|mercados de futuros|casas de cambio)\b/g, 'doce $1'],
    [/\bonze (corretoras|plataformas|bolsas|mercados de futuros)\b/g, 'doze $1'],
    [/\bonze (plateformes|bourses|places)\b/g, 'douze $1'],
    [/\belf (Börsen|Exchanges|Plattformen|Handelsplätzen|Perpetual-Futures-Börsen)\b/g, 'zwölf $1'],
    [/\belf (beurzen|platforms)\b/g, 'twaalf $1'],
    [/\bon bir (borsadan|borsa|borsanın|borsadaki|borsada)\b/g, 'on iki $1'],
    [/\bsebelas (exchange|venue|bursa)\b/g, 'dua belas $1'],
    [/одиннадцати (бирж|площадок)/g, 'двенадцати $1'],
    [/十一家交易所/g, '十二家交易所'],
    [/11の取引所/g, '12の取引所'],
    [/11개 거래소/g, '12개 거래소'],
    [/إحدى عشرة منصة/g, 'اثنتي عشرة منصة'],
  ];
  // the two ambiguous count words: "onze exchanges" (pt doze / fr douze) and "elf exchanges" (nl twaalf; de capitalises Exchanges)
  if (lang === 'pt') R.push([/\bonze exchanges\b/g, 'doze exchanges']);
  if (lang === 'fr') R.push([/\bonze exchanges\b/g, 'douze exchanges']);
  if (lang === 'nl') R.push([/\belf exchanges\b/g, 'twaalf exchanges']);
  return R;
}
function patchText(s, lang) {
  let n = 0;
  for (const [re, rep] of rulesFor(lang)) s = s.replace(re, (...a) => { n++; return typeof rep === 'function' ? rep(...a) : rep.replace(/\$(\d)/g, (_, d) => a[+d] || ''); });
  return [s, n];
}
function langOf(rel) { const m = /^dist\/([a-z]{2})\//.exec(rel) || /^dist\/app-([a-z]{2})\.html$/.exec(rel) || /home-i18n\/([a-z]{2})\.json$/.exec(rel) || /\/ui-([a-z]{2})(?:-app)?\.js$/.exec(rel) || /^build\/data\/([a-z]{2})\//.exec(rel); return m ? m[1] : 'en'; }

const SOURCES = [
  'src/worker.js', 'build/i18n-master.js', 'app/index.html', 'build/gen-liq-report.js',
  'build/gen-alternative-pages.js', 'build/gen-api-widgets-pages.js', 'build/gen-ask-pages.js', 'build/gen-coin-pages.js',
  'build/gen-compare-pages.js', 'build/gen-liqmap-pages.js', 'build/gen-liq-stats-page.js', 'build/gen-liquidations-page.js',
  'build/gen-og-images.js', 'build/gen-venue-page.js', 'build/gen-blog.js', 'build/_extra.js', 'build/gen-whales-page.js',
  'build/gen-exchanges-page.js', 'build/gen-where-to-start.js', 'build/gen-competition-page.js', 'build/gen-home-live.js',
  'build/og/templates.js', 'build/data/home-i18n/es.json', 'build/data/home-i18n/pt.json', 'build/data/home-i18n/de.json',
  'build/data/i18n/strings.json', 'dist/llms.txt', 'dist/llms-full.txt', 'dist/demo-home/index.html',
  'dist/app.html', 'dist/app-es.html', 'dist/app-pt.html', 'dist/app-de.html',
];
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === '.git') continue; walk(p, out); }
    else if (e.name === 'index.html' || (dir.endsWith(path.join('dist', 'assets')) && /\.js$/.test(e.name)) || /^i18n.*\.json$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = new Set(SOURCES.map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f)));
walk(path.join(ROOT, 'dist'), []).forEach(f => files.add(f));

const PRE = /[Ee]leven|11 exchanges|once |onze |elf |on bir |sebelas |одиннадцати|十一家|11の取引所|11개 거래소|إحدى عشرة منصة|Aster/;
let changedFiles = 0, total = 0; const bundles = [];
for (const f of files) {
  if (/llms-changelog\.txt$/.test(f)) continue;
  let s; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (!PRE.test(s)) continue;
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const [out, n] = patchText(s, langOf(rel));
  if (!n || out === s) continue;
  changedFiles++; total += n;
  if (changedFiles <= 40 || /^(src|build)\//.test(rel)) console.log(String(n).padStart(4), rel);
  if (/^dist\/assets\/.*\.js$/.test(rel)) bundles.push(rel);
  if (!DRY) { fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f); }
}
console.log((DRY ? 'DRY: would change ' : 'changed ') + changedFiles + ' files, ' + total + ' replacements' + (bundles.length ? '\nbundles touched (run node build/bump-home-assets.js): ' + bundles.join(', ') : ''));

// catalogs are keyed by a hash of the English: copy each changed item under its NEW key with every translation patched by its own
// language's rules (the old item stays; gen-pages prunes nothing it is not asked to)
const { idOf } = require('./es/lib.js');
for (const d of fs.readdirSync(path.join(ROOT, 'build/data'))) {
  const f = path.join(ROOT, 'build/data', d, 'catalog.json'); if (!fs.existsSync(f)) continue;
  const cat = JSON.parse(fs.readFileSync(f, 'utf8')); const it = cat.items || {}; let added = 0;
  for (const k of Object.keys(it)) {
    const row = it[k]; if (!row || typeof row.en !== 'string' || !PRE.test(row.en)) continue;
    const [en2, n] = patchText(row.en, 'en'); if (!n || en2 === row.en) continue;
    const k2 = idOf(en2); if (it[k2]) continue;
    const copy = JSON.parse(JSON.stringify(row)); copy.en = en2;
    for (const f2 of Object.keys(copy)) if (f2 !== 'en' && typeof copy[f2] === 'string' && f2.length <= 3) copy[f2] = patchText(copy[f2], f2)[0];
    it[k2] = copy; added++;
  }
  if (added) { console.log('catalog', d, '+' + added, 'items rekeyed'); if (!DRY) { fs.writeFileSync(f + '.tmp', JSON.stringify(cat, null, 1)); fs.renameSync(f + '.tmp', f); } }
}

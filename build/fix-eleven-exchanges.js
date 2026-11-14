/* The liquidation feed reads ELEVEN exchanges (2026-11-14): Bitget (the UTA public channel), Aster and Lighter joined the eight.
   Owner: "Proveri da li negde na sajtu fali da se obaci Aster ili Lighter ... da li smo ceo sajt lepo update sa novim liquidation data."
   Every surface that said "eight exchanges" and listed the eight is corrected here, in the SOURCES (worker, generators, i18n
   master, llms) and in the generated files (dist, every language) in one pass, so a regeneration agrees with what is live.
   Only noun-bound phrases are touched ("eight exchanges", "acht Börsen" ...) - "eight hours", "eight season boards" stay.
   Twelve feeds: Binance is read twice (USD-M and COIN-M). Idempotent; --dry prints only. Never touches dist/llms-changelog.txt.
   Run: node build/fix-eleven-exchanges.js [--dry]                                                                     */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const NEW = 'Bitget, Aster';   // inserted before the list's last name, which becomes Lighter

const RULES = [
  // the venue lists: "... HTX, dYdX, Bitfinex" / "... dYdX and Bitfinex" in every conjunction the site prints
  [/HTX, dYdX, Bitfinex(?!, Bitget)/g, 'HTX, dYdX, Bitfinex, ' + NEW + ', Lighter'],
  [/HTX, dYdX,? (and|y|e|et|und|en|ve|dan|и) Bitfinex/g, 'HTX, dYdX, Bitfinex, ' + NEW + ' $1 Lighter'],
  [/\\u00b7 dYdX \\u00b7 Bitfinex<\/b>/g, '\\u00b7 dYdX \\u00b7 Bitfinex \\u00b7 Bitget \\u00b7 Aster \\u00b7 Lighter</b>'],
  [/· dYdX · Bitfinex<\/b>/g, '· dYdX · Bitfinex · Bitget · Aster · Lighter</b>'],
  [/eight venues, nine websocket feeds/g, 'eleven venues, twelve websocket feeds'],
  [/ocho plataformas, nueve conexiones websocket/g, 'once plataformas, doce conexiones websocket'],
  // the count
  [/\b([Ee])ight (exchanges|venues|named venues|named exchanges|perpetual-futures (?:exchanges|venues))\b/g, (m, e, w) => (e === 'E' ? 'E' : 'e') + 'leven ' + w],
  [/\b([Ee])ight-exchange\b/g, (m, e) => (e === 'E' ? 'E' : 'e') + 'leven-exchange'],
  [/\b8 exchanges\b/g, '11 exchanges'],
  [/\bocho (exchanges|venues|plataformas|bolsas|mercados de futuros|casas de cambio)\b/g, 'once $1'],
  [/\boito (exchanges|corretoras|plataformas|bolsas|mercados de futuros)\b/g, 'onze $1'],
  [/\bhuit (plateformes|exchanges|bourses|places)\b/g, 'onze $1'],
  [/\bacht (Börsen|Exchanges|Plattformen|Handelsplätzen|Perpetual-Futures-Börsen)\b/g, 'elf $1'],
  [/\bacht (beurzen|exchanges|platforms)\b/g, 'elf $1'],
  [/\bsekiz (borsadan|borsa|borsanın|borsadaki|borsada)\b/g, 'on bir $1'],
  [/\bdelapan (exchange|venue|bursa)\b/g, 'sebelas $1'],
  [/восьми (бирж|площадок)/g, 'одиннадцати $1'],
  [/八家交易所/g, '十一家交易所'],
  [/8つの取引所/g, '11の取引所'],
  [/8개 거래소/g, '11개 거래소'],
  [/ثماني منصات/g, 'إحدى عشرة منصة'],
];

function patchText(s) {
  let n = 0;
  for (const [re, rep] of RULES) s = s.replace(re, (...a) => { n++; return typeof rep === 'function' ? rep(...a) : rep.replace(/\$(\d)/g, (_, d) => a[+d] || ''); });
  return [s, n];
}

const SOURCES = [
  'src/worker.js', 'build/i18n-master.js', 'app/index.html', 'build/gen-liq-report.js',
  'build/gen-alternative-pages.js', 'build/gen-api-widgets-pages.js', 'build/gen-ask-pages.js', 'build/gen-coin-pages.js',
  'build/gen-compare-pages.js', 'build/gen-liqmap-pages.js', 'build/gen-liq-stats-page.js', 'build/gen-liquidations-page.js',
  'build/gen-og-images.js', 'build/gen-venue-page.js', 'build/gen-blog.js', 'build/_extra.js', 'build/gen-whales-page.js',
  'build/gen-exchanges-page.js', 'build/gen-where-to-start.js', 'build/gen-competition-page.js', 'build/gen-home-live.js',
  'build/og/templates.js', 'build/data/es/catalog.json', 'build/data/pt/catalog.json', 'build/data/de/catalog.json',
  'build/data/home-i18n/es.json', 'build/data/home-i18n/pt.json', 'build/data/home-i18n/de.json', 'build/data/i18n/strings.json',
  'dist/llms.txt', 'dist/llms-full.txt', 'dist/demo-home/index.html', 'dist/app.html', 'dist/app-es.html', 'dist/app-pt.html', 'dist/app-de.html',
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

const PRE = /[Ee]ight|8 exchanges|ocho |oito |huit |acht |sekiz |delapan |восьми|八家|8つの取引所|8개 거래소|ثماني منصات|dYdX/;
let changedFiles = 0, total = 0; const bundles = [];
for (const f of files) {
  if (/llms-changelog\.txt$/.test(f)) continue;
  let s; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (!PRE.test(s)) continue;
  const [out, n] = patchText(s);
  if (!n || out === s) continue;
  changedFiles++; total += n;
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (changedFiles <= 40 || /^(src|build)\//.test(rel)) console.log(String(n).padStart(4), rel);
  if (/^dist\/assets\/.*\.js$/.test(rel)) bundles.push(rel);
  if (!DRY) { fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f); }
}
console.log((DRY ? 'DRY: would change ' : 'changed ') + changedFiles + ' files, ' + total + ' replacements' + (bundles.length ? '\nbundles touched (run node build/bump-home-assets.js): ' + bundles.join(', ') : ''));

// THE TRANSLATION CATALOGS ARE KEYED BY A HASH OF THE ENGLISH, so a changed English segment would miss its translation on the next
// gen-pages and print English on every twin. Each item whose English changes is copied under its NEW key with its translation
// patched by the same rules (the old item stays, gen-pages prunes nothing it is not asked to).
const { idOf } = require('./es/lib.js');
for (const d of fs.readdirSync(path.join(ROOT, 'build/data'))) {
  const f = path.join(ROOT, 'build/data', d, 'catalog.json'); if (!fs.existsSync(f)) continue;
  const cat = JSON.parse(fs.readFileSync(f, 'utf8')); const it = cat.items || {}; let added = 0;
  for (const k of Object.keys(it)) {
    const row = it[k]; if (!row || typeof row.en !== 'string' || !PRE.test(row.en)) continue;
    const [en2, n] = patchText(row.en); if (!n || en2 === row.en) continue;
    const k2 = idOf(en2); if (it[k2]) continue;
    const copy = JSON.parse(JSON.stringify(row)); copy.en = en2;
    for (const f2 of Object.keys(copy)) if (f2 !== 'en' && typeof copy[f2] === 'string' && f2.length <= 3) copy[f2] = patchText(copy[f2])[0];
    it[k2] = copy; added++;
  }
  if (added) { console.log('catalog', d, '+' + added, 'items rekeyed'); if (!DRY) { fs.writeFileSync(f + '.tmp', JSON.stringify(cat, null, 1)); fs.renameSync(f + '.tmp', f); } }
}

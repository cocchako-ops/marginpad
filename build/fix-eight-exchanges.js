/* BitMEX is not a source, so the venue count is eight (2026-10-17).
   BitMEX answered 403 to every request from the droplet and from the owner's own connection (REST and the websocket
   handshake alike), had delivered 0 events in its whole life behind 3,268 reconnects, and was paging "liq izvor bitmex
   cuti" every six hours. The collector no longer subscribes to it. Every surface that said "nine exchanges" and listed
   BitMEX among them is corrected here, in the SOURCES (worker, generators, i18n master, llms) and in the generated
   files (dist, all languages) in one pass, so a regeneration agrees with what is live. Idempotent; --dry prints only.
   Never touches dist/llms-changelog.txt (history) or the words "nine boards" / "nine leaderboards" (the competition).
   Run: node build/fix-eight-exchanges.js [--dry]                                                                     */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');

const VENUE = '(?:Bitfinex|Hyperliquid|Binance|Bybit|OKX|Gate|HTX|dYdX)';
const RULES = [
  // the venue lists, every language and conjunction
  [/dYdX, BitMEX, Bitfinex/g, 'dYdX, Bitfinex'],
  [/dYdX, BitMEX (and|y|e|et|und|en|ve|dan|и) Bitfinex/g, 'dYdX $1 Bitfinex'],
  [/、BitMEX、/g, '、'],
  [/ وBitMEX/g, ''],
  [/Bybit, OKX, BitMEX and Hyperliquid/g, 'Bybit, OKX and Hyperliquid'],
  [/Bybit, OKX, BitMEX, Hyperliquid and more/g, 'Bybit, OKX, Hyperliquid and more'],
  [/Bybit, OKX, BitMEX (y|e|et|und|en|ve|dan|и) Hyperliquid/g, 'Bybit, OKX $1 Hyperliquid'],
  [/Bybit, OKX, BitMEX, Hyperliquid (y|e|et|und|en|ve|dan|и) (más|mais|plus|mehr|meer|daha|lagi|другие)/g, 'Bybit, OKX, Hyperliquid $1 $2'],
  [new RegExp('BitMEX, (?=' + VENUE + ')', 'g'), ''],
  [new RegExp(', BitMEX(?=,\\s' + VENUE + ')', 'g'), ''],
  [/<span class="chip" data-x="bitmex"><i><\/i>BitMEX<\/span>\s*/g, ''],
  // the heatmap DATA fold (mp-heatmap.js, EN with \u escapes + the inline ES dictionary): a middle-dot list and "ten feeds"
  [/ \\u00b7 BitMEX \\u00b7 /g, ' \\u00b7 '],
  [/ · BitMEX · /g, ' · '],
  [/nine venues, ten websocket feeds/g, 'eight venues, nine websocket feeds'],
  [/nueve plataformas, diez conexiones websocket/g, 'ocho plataformas, nueve conexiones websocket'],
  // the count, every language the site prints it in
  [/\b([Nn])ine (exchanges|venues|named venues|named exchanges|perpetual-futures (?:exchanges|venues))\b/g, (m, n, w) => (n === 'N' ? 'E' : 'e') + 'ight ' + w],
  [/\b([Nn])ine-exchange\b/g, (m, n) => (n === 'N' ? 'E' : 'e') + 'ight-exchange'],
  [/\b9 exchanges\b/g, '8 exchanges'],
  [/\bnueve (exchanges|venues|plataformas|bolsas|mercados|casas de cambio)\b/g, 'ocho $1'],
  [/\bnove (exchanges|corretoras|plataformas|bolsas)\b/g, 'oito $1'],
  [/\bneuf (plateformes|exchanges|bourses|places)\b/g, 'huit $1'],
  [/\bneun (Börsen|Exchanges|Plattformen|Handelsplätzen)\b/g, 'acht $1'],
  [/\bnegen (beurzen|exchanges|platforms)\b/g, 'acht $1'],
  [/\bdokuz (borsadan|borsa|borsanın|borsadaki)\b/g, 'sekiz $1'],
  [/\bsembilan (bursa)\b/g, 'delapan $1'],
  [/девяти бирж/g, 'восьми бирж'],
  [/九家交易所/g, '八家交易所'],
  [/9つの取引所/g, '8つの取引所'],
  [/9개 거래소/g, '8개 거래소'],
  [/تسع منصات/g, 'ثماني منصات'],
];

function patchText(s) {
  let n = 0;
  for (const [re, rep] of RULES) {
    s = s.replace(re, (...a) => { n++; return typeof rep === 'function' ? rep(...a) : rep.replace(/\$(\d)/g, (_, d) => a[+d] || ''); });
  }
  return [s, n];
}

const SOURCES = [
  'src/worker.js', 'build/i18n-master.js', 'app/index.html',
  'build/gen-alternative-pages.js', 'build/gen-api-widgets-pages.js', 'build/gen-ask-pages.js', 'build/gen-coin-pages.js',
  'build/gen-compare-pages.js', 'build/gen-liqmap-pages.js', 'build/gen-liq-stats-page.js', 'build/gen-liquidations-page.js',
  'build/gen-og-images.js', 'build/gen-venue-page.js', 'build/gen-blog.js', 'build/_extra.js', 'build/gen-whales-page.js',
  'build/gen-exchanges-page.js', 'build/gen-where-to-start.js', 'build/gen-competition-page.js', 'build/gen-home-live.js',
  'dist/llms.txt', 'dist/llms-full.txt', 'dist/demo-home/index.html', 'dist/app.html', 'dist/app-es.html',
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
['dist/widget', 'dist/assets/og'].forEach(() => {});

let changedFiles = 0, total = 0; const touchedBundles = [];
for (const f of files) {
  if (/llms-changelog\.txt$/.test(f)) continue;
  let s; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (!/BitMEX|[Nn]ine (exchanges|venues|named|perpetual)|[Nn]ine-exchange|9 exchanges|nueve|nove |neuf |neun |negen |dokuz |sembilan |девяти|九家|9つの取引所|9개 거래소|تسع منصات|data-x="bitmex"/.test(s)) continue;
  const [out, n] = patchText(s);
  if (!n || out === s) continue;
  changedFiles++; total += n;
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  console.log(String(n).padStart(4), rel);
  if (/^dist\/assets\/.*\.js$/.test(rel)) touchedBundles.push(rel);
  if (!DRY) { fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f); }
}
// the two E2E assertions that encoded the old count
const e2e = path.join(ROOT, 'build/heatmap-e2e.js');
if (fs.existsSync(e2e)) { const s = fs.readFileSync(e2e, 'utf8'); const o = s.split('/9 exchanges/').join('/8 exchanges/'); if (o !== s) { console.log('   2 build/heatmap-e2e.js (assertions)'); if (!DRY) fs.writeFileSync(e2e, o); } }
console.log((DRY ? 'DRY: would change ' : 'changed ') + changedFiles + ' files, ' + total + ' replacements' + (touchedBundles.length ? '\nbundles touched (run node build/bump-home-assets.js): ' + touchedBundles.join(', ') : ''));
// what is left: anything still naming BitMEX as a live source
const left = [];
for (const f of files) { if (/llms-changelog/.test(f)) continue; let s; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; } const m = s.match(/.{0,60}BitMEX.{0,60}/g); if (m) left.push(path.relative(ROOT, f).replace(/\\/g, '/') + ': ' + m.slice(0, 2).join(' || ')); }
if (left.length) { console.log('\nstill mention BitMEX (' + left.length + ' files) - review:'); left.slice(0, 25).forEach(l => console.log('  ' + l.replace(/\s+/g, ' ').slice(0, 200))); }

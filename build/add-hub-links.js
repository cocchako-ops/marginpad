/* Hub links for pages that nothing linked to (2026-09-02). A crawl of dist found 190 indexable pages with ZERO inbound
   <a href> from any other page: every per-coin liquidation map and calculator beyond the majors, every head-to-head and
   "best exchange for" page, the 12 translated hubs (/de/liquidations/ ...) and ~80 blog translations — all reachable only
   through hreflang or the sitemap. Idempotent walk-and-patch (marker data-hublinks); the link lists are derived from
   what exists in dist, so a new coin/comparison/translation joins automatically on the next build.
   Runs in build.js after the exchange rail: node build/add-hub-links.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const MARK = 'data-hublinks';
const LANG_NAMES = { ar: 'العربية', da: 'Dansk', de: 'Deutsch', es: 'Español', fi: 'Suomi', fr: 'Français', id: 'Bahasa Indonesia', ja: '日本語', ko: '한국어', nl: 'Nederlands', no: 'Norsk', pt: 'Português', ru: 'Русский', sv: 'Svenska', tr: 'Türkçe', zh: '中文' };
const LANGS = Object.keys(LANG_NAMES);
const CSS = '<style>.hublinks{margin:28px auto 8px;max-width:1080px;padding:0 16px;font-family:inherit}.hublinks h2{font-size:15px;margin:18px 0 8px;color:#e9e7df;letter-spacing:.01em}.hublinks p{margin:0 0 6px;font-size:12.5px;color:#9aa3ad}.hublinks .hl{display:flex;flex-wrap:wrap;gap:6px 8px}.hublinks .hl a{font-size:12.5px;color:#c8d0d9;background:#111419;border:1px solid #232932;border-radius:8px;padding:5px 9px;text-decoration:none;line-height:1.3}.hublinks .hl a:hover{color:#c2f64a;border-color:#2f3742}</style>';

const dirs = fs.readdirSync(DIST, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
const has = (d) => fs.existsSync(path.join(DIST, d, 'index.html'));
const coinOf = (d, suffix) => d.slice(0, -suffix.length).toUpperCase();
const MAPS = dirs.filter(d => /^[a-z0-9]+-liquidation-map$/.test(d) && has(d)).sort();
const CALCS = dirs.filter(d => /^[a-z0-9]+-liquidation-calculator$/.test(d) && has(d)).sort();
const VS = dirs.filter(d => /^[a-z0-9]+-vs-[a-z0-9]+$/.test(d) && has(d)).sort();
const BEST = dirs.filter(d => /^best-crypto-exchange-/.test(d) && has(d)).sort();
// NOT 'liquidations': its /<lang>/liquidations/ copies sit under run_worker_first and the worker 301s every translated subpage to the
// English original (retired 2026-08: 1,008 thin pages, 7 Google visits in 90 days). funding/defi/long-short are still served statically.
const HUBS = ['funding', 'defi', 'long-short'];
const exName = s => s.replace(/\b[a-z]/g, c => c.toUpperCase()).replace('Okx', 'OKX').replace('Kucoin', 'KuCoin');

function block(title, intro, links) {
  return '\n<nav class="hublinks" ' + MARK + ' aria-label="' + title.replace(/"/g, '') + '"><h2>' + title + '</h2>' + (intro ? '<p>' + intro + '</p>' : '') + '<div class="hl">' + links.map(([href, txt]) => '<a href="' + href + '">' + txt + '</a>').join('') + '</div></nav>\n';
}
function inject(file, html, blocks) {
  if (!blocks.length) return false;
  let h = fs.readFileSync(file, 'utf8');
  if (h.indexOf(MARK) >= 0) return false;
  const body = CSS + blocks.join('');
  let at = h.indexOf('<footer'); if (at < 0) at = h.indexOf('</main>'); if (at < 0) at = h.lastIndexOf('</body>');
  if (at < 0) return false;
  h = h.slice(0, at) + body + h.slice(at);
  fs.writeFileSync(file, h);
  return true;
}
let n = 0;
const rel = (d) => path.join(DIST, d, 'index.html');

// 1) every liquidation map lists every other map (+ the hub + the calculator for the same coin)
for (const d of MAPS) {
  const coin = coinOf(d, '-liquidation-map');
  const links = MAPS.filter(x => x !== d).map(x => ['/' + x + '/', coinOf(x, '-liquidation-map')]);
  const extra = [['/liquidations/', 'All liquidations (24h totals)'], ['/rekt/', 'Live liquidation feed']];
  const calc = coin.toLowerCase() + '-liquidation-calculator'; if (has(calc)) extra.unshift(['/' + calc + '/', coin + ' liquidation calculator']);
  if (inject(rel(d), null, [block('Liquidation maps for other coins', 'Same live heatmap and long/short clusters, per coin.', links), block('More on liquidations', '', extra)])) n++;
}
// 2) every liquidation calculator lists the other coins (+ its map)
for (const d of CALCS) {
  const coin = coinOf(d, '-liquidation-calculator');
  const links = CALCS.filter(x => x !== d).map(x => ['/' + x + '/', coinOf(x, '-liquidation-calculator')]);
  const extra = [['/calculators', 'All calculators'], ['/paper-trade', 'Practice with paper trading']];
  const map = coin.toLowerCase() + '-liquidation-map'; if (has(map)) extra.unshift(['/' + map + '/', coin + ' liquidation map']);
  if (inject(rel(d), null, [block('Liquidation calculators for other coins', '', links), block('Related', '', extra)])) n++;
}
// 3) the liquidations hub lists every map + calculator + the tools reviews
if (has('liquidations')) {
  const b = [block('Liquidation maps by coin', 'Live per-coin heatmaps built from our own collector feed.', MAPS.map(x => ['/' + x + '/', coinOf(x, '-liquidation-map')])),
    block('Liquidation calculators by coin', '', CALCS.map(x => ['/' + x + '/', coinOf(x, '-liquidation-calculator')])),
    block('Read more', '', [['/best-liquidation-heatmap-tools/', 'Best liquidation heatmap tools'], ['/liquidation-statistics/', 'Liquidation statistics'], ['/liquidations/by-exchange/', 'Liquidations by exchange'], ['/hyperliquid-liquidations/', 'Hyperliquid liquidations']].filter(([h]) => has(h.replace(/^\/|\/$/g, ''))))];
  if (inject(rel('liquidations'), null, b)) n++;
}
// 4) the exchanges page lists every head-to-head and every "best for" page
if (has('exchanges')) {
  const b = [block('Head-to-head comparisons', 'Fees, leverage, geo-availability and paper-trade parity, pair by pair.', VS.map(x => ['/' + x + '/', x.split('-vs-').map(exName).join(' vs ')])),
    block('Best exchange for…', '', BEST.map(x => ['/' + x + '/', x.replace(/^best-crypto-exchange-/, '').replace(/^for-/, '').replace(/-/g, ' ')])),
    block('Tools', '', [['/pnl-fee-checker/', 'PnL and fee checker'], ['/crypto-fee-calculator/', 'Fee calculator']].filter(([h]) => has(h.replace(/^\/|\/$/g, ''))))];
  if (inject(rel('exchanges'), null, b)) n++;
}
// 5) English hubs link their translations (and each translation links the English original + its siblings)
for (const hub of HUBS) {
  const langs = LANGS.filter(l => fs.existsSync(path.join(DIST, l, hub, 'index.html')));
  if (!langs.length || !has(hub)) continue;
  if (inject(rel(hub), null, [block('This page in other languages', '', langs.map(l => ['/' + l + '/' + hub + '/', LANG_NAMES[l]]))])) n++;
  for (const l of langs) {
    const links = [['/' + hub + '/', 'English']].concat(langs.filter(x => x !== l).map(x => ['/' + x + '/' + hub + '/', LANG_NAMES[x]]));
    if (inject(path.join(DIST, l, hub, 'index.html'), null, [block('Other languages', '', links)])) n++;
  }
}
// 6) blog posts with translations: the English post links every translation, each translation links English + siblings
const BLOG = path.join(DIST, 'blog');
if (fs.existsSync(BLOG)) for (const e of fs.readdirSync(BLOG, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const base = path.join(BLOG, e.name);
  const langs = LANGS.filter(l => fs.existsSync(path.join(base, l, 'index.html')));
  if (!langs.length || !fs.existsSync(path.join(base, 'index.html'))) continue;
  if (inject(path.join(base, 'index.html'), null, [block('Read this guide in other languages', '', langs.map(l => ['/blog/' + e.name + '/' + l + '/', LANG_NAMES[l]]))])) n++;
  for (const l of langs) {
    const links = [['/blog/' + e.name + '/', 'English']].concat(langs.filter(x => x !== l).map(x => ['/blog/' + e.name + '/' + x + '/', LANG_NAMES[x]]));
    if (inject(path.join(base, l, 'index.html'), null, [block('Other languages', '', links)])) n++;
  }
}
// 7) the tools hub points at the pages that had no parent at all
if (has('tools')) {
  const links = [['/premium/', 'MarginPad Premium'], ['/pnl-fee-checker/', 'PnL and fee checker'], ['/best-liquidation-heatmap-tools/', 'Best liquidation heatmap tools'], ['/where-to-start/', 'Where to start'], ['/free-crypto-api/', 'Free crypto API']].filter(([h]) => has(h.replace(/^\/|\/$/g, '')));
  if (inject(rel('tools'), null, [block('More from MarginPad', '', links)])) n++;
}
console.log('hub links injected into', n, 'pages (maps ' + MAPS.length + ', calculators ' + CALCS.length + ', comparisons ' + VS.length + ', best-for ' + BEST.length + ')');

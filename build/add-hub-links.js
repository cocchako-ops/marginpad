/* Hub links for pages that nothing linked to (2026-09-02). A crawl of dist found 190 indexable pages with ZERO inbound
   <a href> from any other page: every per-coin liquidation map and calculator beyond the majors, every head-to-head and
   "best exchange for" page, the 12 translated hubs (/de/liquidations/ ...) and ~80 blog translations - all reachable only
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
  // The block used to be write-once, so a page that already had one never saw a new link added to it.
  // With --refresh the existing block is cut out and rewritten, which is how a new destination reaches
  // the 100+ pages a crawler already walks (2026-09-15: /trading-api/ had 0 crawls with 53 links, all of
  // them on pages crawlers rarely reach).
  const had = h.indexOf(MARK);
  if (had >= 0) {
    if (!process.argv.includes('--refresh')) return false;
    // CUT FROM THE START OF THE BLOCK, NOT FROM THE MARKER. MARK is an ATTRIBUTE inside the opening tag
    // (<nav class="hublinks" data-hublinks ...>), so slicing at its index left the dangling fragment
    // `<nav class="hublinks" ` in the page; the CSS inserted next then landed INSIDE that unclosed tag and the
    // browser rendered 495 characters of stylesheet as body text. 338 pages shipped like that after the
    // 2026-09-15 refresh run - owner reported it on the BTC and ETH liquidation maps.
    // Starting at whichever comes first - the <style> or the first <nav class="hublinks" - also repairs a page
    // that is already broken, because the dangling fragment is inside the cut.
    const navAt = h.indexOf('<nav class="hublinks"');
    const cssAt = h.indexOf('<style>.hublinks{');
    let start = Math.min(navAt < 0 ? Infinity : navAt, cssAt < 0 ? Infinity : cssAt);
    if (!isFinite(start)) start = had;
    let end = h.indexOf('<footer', start); if (end < 0) end = h.indexOf('</main>', start); if (end < 0) end = h.lastIndexOf('</body>');
    if (end < 0 || end < start) return false;
    h = h.slice(0, start) + h.slice(end);
  }
  const body = CSS + blocks.join('');
  let at = h.indexOf('<footer'); if (at < 0) at = h.indexOf('</main>'); if (at < 0) at = h.lastIndexOf('</body>');
  if (at < 0) return false;
  h = h.slice(0, at) + body + h.slice(at);
  // never ship the shape that caused this: a stylesheet living inside an unclosed tag, or two copies of it
  if (h.indexOf('<nav class="hublinks" <') >= 0 || (h.split('<style>.hublinks{').length - 1) !== 1) {
    console.error('REFUSED ' + file + ' - hub-link block would be malformed'); return false;
  }
  fs.writeFileSync(file, h);
  return true;
}
let n = 0;
const rel = (d) => path.join(DIST, d, 'index.html');

// 1) every liquidation map lists every other map (+ the hub + the calculator for the same coin)
for (const d of MAPS) {
  const coin = coinOf(d, '-liquidation-map');
  const links = MAPS.filter(x => x !== d).map(x => ['/' + x + '/', coinOf(x, '-liquidation-map')]);
  const extra = [['/liquidations/', 'All liquidations (24h totals)'], ['/rekt/', 'Live liquidation feed'], ['/where-can-i-test-a-trading-bot/', 'Test a trading bot on live prices, free'], ['/trading-api/', 'Paper-trading Bot API']];
  const calc = coin.toLowerCase() + '-liquidation-calculator'; if (has(calc)) extra.unshift(['/' + calc + '/', coin + ' liquidation calculator']);
  if (inject(rel(d), null, [block('Liquidation maps for other coins', 'Same live heatmap and long/short clusters, per coin.', links), block('More on liquidations', '', extra)])) n++;
}
// 2) every liquidation calculator lists the other coins (+ its map)
for (const d of CALCS) {
  const coin = coinOf(d, '-liquidation-calculator');
  const links = CALCS.filter(x => x !== d).map(x => ['/' + x + '/', coinOf(x, '-liquidation-calculator')]);
  const extra = [['/calculators', 'All calculators'], ['/paper-trade', 'Practice with paper trading'], ['/where-can-i-test-a-trading-bot/', 'Test a trading bot on live prices, free']];
  const map = coin.toLowerCase() + '-liquidation-map'; if (has(map)) extra.unshift(['/' + map + '/', coin + ' liquidation map']);
  if (inject(rel(d), null, [block('Liquidation calculators for other coins', '', links), block('Related', '', extra)])) n++;
}
// 3) the liquidations hub lists every map + calculator + the tools reviews
if (has('liquidations')) {
  const b = [block('Liquidation maps by coin', 'Live per-coin heatmaps built from our own collector feed.', MAPS.map(x => ['/' + x + '/', coinOf(x, '-liquidation-map')])),
    block('Liquidation calculators by coin', '', CALCS.map(x => ['/' + x + '/', coinOf(x, '-liquidation-calculator')])),
    block('Read more', '', [['/best-liquidation-heatmap-tools/', 'Best liquidation heatmap tools'], ['/liquidation-statistics/', 'Liquidation statistics'], ['/liquidations/by-exchange/', 'Liquidations by exchange'], ['/hyperliquid-liquidations/', 'Hyperliquid liquidations']].filter(([h]) => has(h.replace(/^\/|\/$/g, '')))),
    // the one-question pages (2026-09-14) - an orphan page is one an assistant never finds a route to
    block('One question, one answer', 'Each of these answers a single question with a live number and says who measured it.', [['/how-many-traders-liquidated-today/', 'How many traders got liquidated today?'], ['/longs-or-shorts-liquidated-more/', 'Are longs or shorts getting liquidated more?'], ['/biggest-liquidation-today/', 'What is the biggest liquidation today?'], ['/is-funding-positive-or-negative/', 'Is funding positive or negative right now?'], ['/where-can-i-test-a-trading-bot/', 'Where can I test a trading bot for free?']].filter(([h]) => has(h.replace(/^\/|\/$/g, ''))))];
  b.push(block('Build on this data', 'Every liquidation on this page is in the free JSON API, and the same account can paper-trade against it through the Bot API or an MCP server.', [['/trading-api/', 'Paper-trading Bot API'], ['/free-crypto-api/', 'Free keyless market-data API'], ['/api-docs/', 'Live API reference']].filter(([h]) => has(h.replace(/^\/|\/$/g, '')))));
  if (inject(rel('liquidations'), null, b)) n++;
}
// 4) the exchanges page lists every head-to-head and every "best for" page
if (has('exchanges')) {
  const b = [block('Head-to-head comparisons', 'Fees, leverage, geo-availability and paper-trade parity, pair by pair.', VS.map(x => ['/' + x + '/', x.split('-vs-').map(exName).join(' vs ')])),
    block('Best exchange for…', '', BEST.map(x => ['/' + x + '/', x.replace(/^best-crypto-exchange-/, '').replace(/^for-/, '').replace(/-/g, ' ')])),
    block('Tools', '', [['/pnl-fee-checker/', 'PnL and fee checker'], ['/crypto-fee-calculator/', 'Fee calculator']].filter(([h]) => has(h.replace(/^\/|\/$/g, ''))))];
  if (inject(rel('exchanges'), null, b)) n++;
}
// 4b) THE COIN PAGES ARE WHERE THE CRAWL BUDGET GOES, AND THEY SOLD NOTHING (2026-09-16).
// Measured over 30 days: 39,655 crawler hits, 28,308 of them bingbot, and roughly 13,000 spent on six /coin/*
// pages that turn 0.1% of crawls into an assistant referral (/coin/btc/ 5,342 crawls -> 7 visits, /coin/eth/
// 2,045 -> 0). Over the same 30 days /trading-api/ - the page with four price tags on it - took ZERO crawls,
// and not one coin page linked to it. A link from a page a crawler already walks 5,000 times is worth more
// than a sitemap entry, which is the lesson /trading-api/ taught once already.
const COINDIR = path.join(DIST, 'coin');
const COINS = fs.existsSync(COINDIR) ? fs.readdirSync(COINDIR, { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(path.join(COINDIR, e.name, 'index.html'))).map(e => e.name).sort() : [];
const API_LINKS = [
  ['/trading-api/', 'Paper-trading Bot API - REST, WebSocket, webhooks'],
  ['/free-crypto-api/', 'Free keyless market-data API'],
  ['/api-docs/', 'Live API reference (try the calls)'],
  ['/where-can-i-test-a-trading-bot/', 'Where can I test a trading bot for free?'],
  ['/arena/', 'Bot leaderboard - what other bots are doing'],
].filter(([h]) => has(h.replace(/^\/|\/$/g, '')));
const API_INTRO = 'Every number on this page is available as free JSON, and the same account can run a paper-trading bot against it - no deposit, no KYC, and an MCP server for AI agents.';
// DEMO SPOT WAS INVISIBLE TO CRAWLERS (2026-09-19). Measured over 30 days: /spot/ took **zero** crawler hits
// while still bringing 17 assistant-referred visits, against /paper-trade at 1,363 crawls -> 626 visits and
// /heatmap at 535 -> 362. It is indexable, in the sitemap, has 2,171 static words and four JSON-LD blocks -
// nothing was blocking it, it was simply never reached, exactly as /trading-api/ was. The same three practice
// surfaces also answer three different questions ("try a leveraged trade", "learn to hold and self-custody",
// "learn the words"), which is why they travel together rather than as one link.
const PRACTICE_LINKS = [
  ['/paper-trade', 'Paper trade these moves - futures, live prices, fake money'],
  ['/spot/', 'Demo Spot - a $10,000 card, an exchange and your own wallet'],
  ['/academy/', 'Academy - 16 courses, from the words up'],
  ['/where-to-start/', 'Not sure where to start?'],
  ['/trading-competition/', 'Live leaderboards - $350 a season, free to enter'],
  // 2026-09-21: the highest-intent destination in this block. Somebody reading a liquidation page is a trader, and a
  // trader considering a $50-$1,000 prop-firm challenge is exactly who should meet a free run at the same rules first.
  ['/practice-for-a-funded-account/', 'Practising for a funded account? Try the rules free first'],
].filter(([h]) => h === '/paper-trade' || has(h.replace(/^\/|\/$/g, '')));
// REGIONAL (2026-09-21). Measured before adding it: the two live LATAM pages were linked from eight pages - the
// homepage, each other, and /free-crypto-api/ - and from NOTHING a crawler actually walks. Google's own report has
// both of them under "Discovered - currently not indexed": it knows the URLs and has never fetched one. Their sitemap
// cadence was already daily with a fresh lastmod, so cadence was not the gap; inbound links from crawled pages are.
// This block goes ONLY on the six coin pages and the two liquidation pages, which together carry most of the crawl
// budget - a Portuguese link on all 220 pages would be dilution, not discovery.
const REGIONAL_LINKS = [
  ['/bitcoin-hoje/', 'Bitcoin hoje - preço, funding e liquidações (Português)'],
  ['/dolar-cripto/', 'Dólar cripto - cotizaciones y brecha (Español, Argentina)'],
].filter(([h]) => has(h.replace(/^\/|\/$/g, '')));
const REGIONAL_INTRO = 'The same live numbers, written for two markets that price crypto against a currency of their own.';
const PRACTICE_INTRO = 'Reading it is one thing. Practising it costs nothing here: leveraged futures on live prices, or the whole spot journey - card, exchange, self-custody wallet - with $10,000 of practice money.';
for (const c of COINS) {
  const others = COINS.filter(x => x !== c).map(x => ['/coin/' + x + '/', x.toUpperCase()]);
  const b = [block('Build on this data', API_INTRO, API_LINKS), block('Practice with it', PRACTICE_INTRO, PRACTICE_LINKS)];
  if (REGIONAL_LINKS.length) b.push(block('In another language', REGIONAL_INTRO, REGIONAL_LINKS));
  if (others.length) b.push(block('Other coins', '', others));
  if (inject(path.join(COINDIR, c, 'index.html'), null, b)) n++;
}
// the two liquidation pages that take thousands of crawls and had no route to the API either
for (const d of ['liquidation-statistics', 'liquidations/by-exchange']) {
  const f = path.join(DIST, d, 'index.html');
  const bl = [block('Build on this data', API_INTRO, API_LINKS), block('Practice with it', PRACTICE_INTRO, PRACTICE_LINKS)];
  if (REGIONAL_LINKS.length) bl.push(block('In another language', REGIONAL_INTRO, REGIONAL_LINKS));
  if (fs.existsSync(f) && inject(f, null, bl)) n++;
}
// 5) English hubs link their translations (and each translation links the English original + its siblings)
// A LINK MUST POINT AT THE DESTINATION, NEVER AT A HOP. The eleven translated subpages were retired long ago and the
// worker 301s /<lang>/<anything>/ to the English original; only /es/ is a live twin. This block used to link every
// language whose FILE existed, which put 33 redirecting links back into dist the moment --refresh ran (caught by
// link-check on 2026-09-21, against a clean 0 the day before). Existence of the file is not the test - being served is.
const LIVE_LANGS = new Set(['es']);
for (const hub of HUBS) {
  const present = LANGS.filter(l => fs.existsSync(path.join(DIST, l, hub, 'index.html')));
  const live = present.filter(l => LIVE_LANGS.has(l));
  if (!present.length || !has(hub)) continue;
  if (live.length && inject(rel(hub), null, [block('This page in other languages', '', live.map(l => ['/' + l + '/' + hub + '/', LANG_NAMES[l]]))])) n++;
  for (const l of present) {
    // A frozen page gets the English original and nothing else - every sibling it used to name is a redirect.
    const links = [['/' + hub + '/', 'English']].concat(live.filter(x => x !== l).map(x => ['/' + x + '/' + hub + '/', LANG_NAMES[x]]));
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

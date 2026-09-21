/* Hand-maintained pages in the (generator-rebuilt) sitemap, with the cadence each one actually has.
 *
 * 2026-09-19 - WHY THIS FILE CHANGED. Every entry here used to be written as
 *     <changefreq>monthly</changefreq>   with no <lastmod> at all
 * whatever the page was. Measured across the live sitemap's 455 entries against 30 days of crawler hits:
 *
 *     hourly      3 urls   1,158.7 crawls per url
 *     daily      49 urls     600.4
 *     weekly     94 urls      18.6
 *     monthly   308 urls      15.0
 *
 * A page declared `daily` gets around forty times the crawl attention of one declared `monthly`, and 59 of the
 * 455 entries carried no lastmod whatsoever. Sitting in the `monthly` bucket with no lastmod were ALL SIX
 * one-question pages - whose entire content is a number that changes every day - plus /heatmap, /arena/,
 * /leaderboards/, /season/, /trading-competition/ and the two LATAM live pages. We were telling crawlers not to
 * come back to exactly the pages built for them, which is why the six ask pages took **zero crawler hits in 30
 * days** while /liquidations/, which links them, took 6,099.
 *
 * So each entry now carries its real cadence, and every entry gets a lastmod. This script also CORRECTS entries
 * the upstream generator already wrote - the old version only appended missing ones, so a page that was already
 * listed as monthly would have stayed monthly for ever.
 *
 * Cadence means what the page SAYS, not how often we deploy: `daily` is a page whose figures move every day.
 * Lying upward is worse than lying downward - a crawler that finds nothing new learns to discount the signal.
 */
const fs = require('fs');
const path = require('path');
const SP = path.join(__dirname, '..', 'dist', 'sitemap.xml');
const TODAY = new Date().toISOString().slice(0, 10);

// [path, priority, cadence]
const D = 'daily', W = 'weekly', M = 'monthly';
const EXTRAS = [
  // --- live figures: these genuinely change every day ------------------------------------------------------
  ['/how-many-traders-liquidated-today/', '0.9', D],
  ['/longs-or-shorts-liquidated-more/', '0.9', D],
  ['/biggest-liquidation-today/', '0.9', D],
  ['/is-funding-positive-or-negative/', '0.9', D],
  ['/where-can-i-test-a-trading-bot/', '1.0', D],
  ['/mcp-server-for-crypto-trading/', '1.0', D],
  ['/practice-for-a-funded-account/', '1.0', D],
  ['/crypto-liquidations-today/', '0.9', D],
  ['/liquidations/by-exchange/', '0.9', D],
  ['/hyperliquid-liquidations/', '0.9', D],
  ['/heatmap', '0.9', D],
  ['/arena/', '0.8', D],
  ['/leaderboards/', '0.9', D],
  ['/season/', '0.9', D],
  ['/trading-competition/', '1.0', D],
  ['/dolar-cripto/', '0.9', D],
  ['/bitcoin-hoje/', '0.9', D],
  ['/calendar/', '0.8', D],
  ['/status/', '0.6', D],
  // --- moves with the product ------------------------------------------------------------------------------
  ['/spot/', '0.9', W],
  ['/trading-api/', '0.8', W],
  ['/api-docs/', '0.8', W],
  ['/free-crypto-api/', '0.9', W],
  ['/premium/', '0.9', W],
  ['/ai-indicators/', '0.8', W],
  ['/trading-report/', '0.8', W],
  ['/academy/', '0.9', W],
  ['/vault/', '0.8', W],
  ['/rewards/', '0.9', W],
  ['/guides/', '0.7', W],
  ['/swap', '0.7', W],
  ['/paper-trading/', '0.9', W],
  ['/stock-trading-simulator/', '0.9', W],
  ['/forex-trading-simulator/', '0.9', W],
  ['/index-trading-simulator/', '0.9', W],
  ['/leverage-trading-simulator/', '0.9', W],
  ['/crypto-trading-simulator-no-sign-up/', '0.9', W],
  ['/coinglass-alternative/', '0.9', W],
  ['/best-crypto-paper-trading-platforms/', '0.9', W],
  ['/best-liquidation-heatmap-tools/', '0.9', W],
  ['/simulador-trading-cripto-argentina/', '0.8', W],
  ['/simulador-trading-cripto-brasil/', '0.8', W],
  // --- evergreen: a calculator's answer does not change because the market moved ----------------------------
  ['/hyperliquid-liquidation-calculator/', '0.9', M],
  ['/crypto-profit-calculator/', '0.8', M],
  ['/position-size-calculator/', '0.8', M],
  ['/leverage-calculator/', '0.8', M],
  ['/crypto-break-even-calculator/', '0.8', M],
  ['/stop-loss-calculator/', '0.8', M],
  ['/crypto-funding-cost-calculator/', '0.8', M],
  ['/crypto-fee-calculator/', '0.8', M],
  ['/crypto-roi-calculator/', '0.8', M],
  ['/crypto-drawdown-calculator/', '0.8', M],
  ['/crypto-compound-calculator/', '0.8', M],
  ['/crypto-dca-calculator/', '0.8', M],
  ['/crypto-win-rate-calculator/', '0.8', M],
  ['/crypto-margin-calculator/', '0.8', M],
  ['/risk-reward-calculator/', '0.8', M],
  ['/apr-apy-calculator/', '0.8', M],
  ['/crypto-slippage-calculator/', '0.8', M],
  ['/pnl-fee-checker/', '0.8', M],
  ['/crypto-tax-calculator/', '0.8', M],
  ['/crypto-cost-basis-calculator/', '0.8', M],
  ['/crypto-futures-tax-calculator/', '0.8', M],
  ['/crypto-trading-usa/', '0.8', M],
  ['/crypto-trading-canada/', '0.8', M],
  ['/wordpress-crypto-widgets/', '0.8', M],
  ['/privacy/', '0.3', M],
];

let xml = fs.readFileSync(SP, 'utf8');
let added = 0, fixed = 0;

for (const [p, pr, cf] of EXTRAS) {
  const loc = 'https://marginpad.io' + p;
  const entry = `  <url><loc>${loc}</loc><lastmod>${TODAY}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`;
  // find an existing <url> block for this exact loc and replace it whole - the old script only appended,
  // so anything already listed kept whatever cadence the upstream generator had given it.
  const re = new RegExp('[ \\t]*<url>(?:(?!</url>)[\\s\\S])*?<loc>' + loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</loc>(?:(?!</url>)[\\s\\S])*?</url>');
  const m = xml.match(re);
  if (m) {
    if (m[0].trim() !== entry.trim()) { xml = xml.replace(re, entry); fixed++; }
  } else {
    xml = xml.replace('</urlset>', entry + '\n</urlset>');
    added++;
  }
}

// Every remaining entry should carry a lastmod: an entry without one gives a crawler nothing to schedule on.
let stamped = 0;
xml = xml.replace(/<url>((?:(?!<\/url>)[\s\S])*?)<\/url>/g, (whole, inner) => {
  if (inner.indexOf('<lastmod>') >= 0) return whole;
  stamped++;
  return whole.replace('</loc>', `</loc><lastmod>${TODAY}</lastmod>`);
});

fs.writeFileSync(SP, xml);
const n = (xml.match(/<url>/g) || []).length;
const noLm = (xml.match(/<url>(?:(?!<\/url>)[\s\S])*?<\/url>/g) || []).filter(u => u.indexOf('<lastmod>') < 0).length;
console.log('sitemap extras: +' + added + ' added, ' + fixed + ' cadence corrected, ' + stamped + ' given a lastmod');
console.log('sitemap now: ' + n + ' urls, ' + noLm + ' without lastmod');
if (noLm) { console.error('REFUSING to call this done - ' + noLm + ' entries still have no lastmod'); process.exitCode = 1; }

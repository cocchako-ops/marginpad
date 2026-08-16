/* Idempotently re-adds hand-maintained pages to the (generator-rebuilt) sitemap. */
const fs = require('fs');
const path = require('path');
const SP = path.join(__dirname, '..', 'dist', 'sitemap.xml');
const EXTRAS = [
  ['https://marginpad.io/free-crypto-api/', '0.9'],
  ['https://marginpad.io/premium/', '0.9'],
  ['https://marginpad.io/vault/', '0.8'],
  ['https://marginpad.io/crypto-profit-calculator/', '0.8'],
  ['https://marginpad.io/position-size-calculator/', '0.8'],
  ['https://marginpad.io/leverage-calculator/', '0.8'],
  ['https://marginpad.io/crypto-break-even-calculator/', '0.8'],
  ['https://marginpad.io/stop-loss-calculator/', '0.8'],
  ['https://marginpad.io/crypto-funding-cost-calculator/', '0.8'],
  ['https://marginpad.io/crypto-fee-calculator/', '0.8'],
  ['https://marginpad.io/crypto-roi-calculator/', '0.8'],
  ['https://marginpad.io/crypto-drawdown-calculator/', '0.8'],
  ['https://marginpad.io/crypto-compound-calculator/', '0.8'],
  ['https://marginpad.io/crypto-dca-calculator/', '0.8'],
  ['https://marginpad.io/crypto-win-rate-calculator/', '0.8'],
  ['https://marginpad.io/crypto-margin-calculator/', '0.8'],
  ['https://marginpad.io/risk-reward-calculator/', '0.8'],
  ['https://marginpad.io/apr-apy-calculator/', '0.8'],
  ['https://marginpad.io/crypto-slippage-calculator/', '0.8'],
  ['https://marginpad.io/trading-api/', '0.8'],
  ['https://marginpad.io/pnl-fee-checker/', '0.8'],
  ['https://marginpad.io/calendar/', '0.8'],
  ['https://marginpad.io/crypto-tax-calculator/', '0.8'],
  ['https://marginpad.io/crypto-cost-basis-calculator/', '0.8'],
  ['https://marginpad.io/crypto-trading-usa/', '0.8'],
  ['https://marginpad.io/heatmap', '0.9'],
  ['https://marginpad.io/swap', '0.7'],
  ['https://marginpad.io/academy/', '0.9'],
  ['https://marginpad.io/spot/', '0.9'],
  ['https://marginpad.io/paper-trading/', '0.9'],
  ['https://marginpad.io/stock-trading-simulator/', '0.9'],
  ['https://marginpad.io/forex-trading-simulator/', '0.9'],
  ['https://marginpad.io/index-trading-simulator/', '0.9'],
  ['https://marginpad.io/leverage-trading-simulator/', '0.9'],
  ['https://marginpad.io/crypto-trading-simulator-no-sign-up/', '0.9'],
  ['https://marginpad.io/coinglass-alternative/', '0.9'],
  ['https://marginpad.io/best-crypto-paper-trading-platforms/', '0.9'],
  ['https://marginpad.io/best-liquidation-heatmap-tools/', '0.9'],
  ['https://marginpad.io/hyperliquid-liquidation-calculator/', '0.9'],
  ['https://marginpad.io/crypto-liquidations-today/', '0.9'],
  ['https://marginpad.io/crypto-trading-canada/', '0.8'],
  ['https://marginpad.io/wordpress-crypto-widgets/', '0.8'],
  ['https://marginpad.io/crypto-futures-tax-calculator/', '0.8'],
  ['https://marginpad.io/hyperliquid-liquidations/', '0.9'],
  ['https://marginpad.io/privacy/', '0.3'],
];
let xml = fs.readFileSync(SP, 'utf8');
let n = 0;
for (const [loc, pr] of EXTRAS) {
  if (xml.indexOf(loc) === -1) {
    xml = xml.replace('</urlset>', `  <url><loc>${loc}</loc><changefreq>monthly</changefreq><priority>${pr}</priority></url>\n</urlset>`);
    n++;
  }
}
if (n) fs.writeFileSync(SP, xml);
console.log('sitemap extras: +' + n);

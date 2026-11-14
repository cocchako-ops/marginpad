// EVERY PRICE ON /trading-api/ IS WRITTEN FROM API_PLANS, NOT TYPED (2026-10-10; rewritten 2026-11-14 for the two plans).
//
// The history that made this file: on 2026-09-22 the plans were repriced and four surfaces on the same page kept the old
// figure - the comparison table, the hero note, the JSON-LD FAQ answer and the JSON-LD Offer, which is what Google, Bing and
// every assistant read. Since 2026-11-14 there are two plans (Free and API Premium, $11.99 - a price with cents, which the old
// whole-dollar regexes could not read). This reads the premium row out of src/worker.js and puts its price on all five
// surfaces. Idempotent; --dry prints what it would change; it REFUSES rather than guessing if the page's shape has moved.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'dist', 'trading-api', 'index.html');
const DRY = process.argv.indexOf('--dry') >= 0;
const src = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
const m0 = src.match(/\{ id: 'premium', tier: 1, cents: (\d+)/);
if (!m0) { console.error('REFUSING: no premium row in API_PLANS'); process.exit(1); }
const USD = (+m0[1] / 100).toFixed(2).replace(/\.00$/, '');
console.log('API_PLANS says: API Premium $' + USD);
let h = fs.readFileSync(PAGE, 'utf8');
const before = h, did = [];
const P = '\\$(\\d+(?:\\.\\d\\d)?)';
function fix(re, build, label) {
  const m = h.match(re);
  if (!m) { console.error('REFUSING: ' + label + ' no longer matches'); process.exit(1); }
  if (m[1] !== USD) { h = h.replace(re, (...a) => build(a)); did.push(label + ': $' + m[1] + ' -> $' + USD); }
}
fix(/(?<="@type":"Offer","name":"API Premium","price":")(\d+(?:\.\d\d)?)(?=")/, () => USD, 'JSON-LD Offer'); // group 1 IS the price - fix() compares it
{ // the priceSpecification inside the same offer carries the figure a second time
  const i = h.indexOf('"@type":"Offer","name":"API Premium"'), seg = h.slice(i, i + 900);
  const ps = seg.match(/("@type":"UnitPriceSpecification","price":")(\d+(?:\.\d\d)?)(")/);
  if (ps && ps[2] !== USD) { h = h.slice(0, i) + seg.replace(ps[0], ps[1] + USD + ps[3]) + h.slice(i + seg.length); did.push('JSON-LD priceSpecification'); }
}
fix(new RegExp('API Premium \\(' + P + ' a month\\)'), () => 'API Premium ($' + USD + ' a month)', 'limits FAQ');
fix(new RegExp('<a href="#plans">API Premium is ' + P + '</a>'), () => '<a href="#plans">API Premium is $' + USD + '</a>', 'hero note');
fix(new RegExp('<th>API Premium &middot; ' + P + '</th>'), () => '<th>API Premium &middot; $' + USD + '</th>', 'table header');
{
  const i = h.indexOf('data-plan="premium">'); if (i < 0) { console.error('REFUSING: no premium card'); process.exit(1); }
  const seg = h.slice(i, i + 900), m = seg.match(new RegExp('class="appx">' + P + '<small>'));
  if (!m) { console.error('REFUSING: premium card has no price'); process.exit(1); }
  if (m[1] !== USD) { h = h.slice(0, i) + seg.replace(m[0], 'class="appx">$' + USD + '<small>') + h.slice(i + seg.length); did.push('price card: $' + m[1] + ' -> $' + USD); }
}
const vis = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
if (/API (Pro|Max|Business|Lab)\b/.test(vis)) { console.error('REFUSING: a retired plan is named on the page'); process.exit(1); }
try { for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]); }
catch (e) { console.error('REFUSING: a JSON-LD block no longer parses - ' + e.message); process.exit(1); }
if (!did.length) { console.log('every price on the page already agrees with API_PLANS - nothing to do'); process.exit(0); }
console.log(did.map((d) => '  ok  ' + d).join('\n'));
if (DRY) { console.log('--dry: nothing written'); process.exit(0); }
fs.writeFileSync(PAGE + '.tmp', h); fs.renameSync(PAGE + '.tmp', PAGE);
console.log('fix-api-prices: written (' + before.length + ' -> ' + h.length + ' bytes)');

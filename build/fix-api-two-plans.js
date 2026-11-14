// TWO API PLANS ON /trading-api/ (2026-11-14, owner: "ceo API, bukvalno svi planovi postanu jedan free i jedan premium. Taj
// premium nek bude $11.99 a free nek bude skroz free ... istorijske podatke ... da dobiju nesto zapravo vredno u tom planu, a da
// free plan bude bas lagan i da ima sve sta ti treba da testiras nekog bota"). Replaces the five-plan grid (Free, Lab, Pro, Max,
// Business) with Free + API Premium, rewrites the JSON-LD offers and the limits FAQ, and every sentence that named Pro/Max/Business.
// One-shot, idempotent (checks data-plan="premium"), --dry prints the plan. Prices afterwards: build/fix-api-prices.js.
const fs = require('fs');
const path = require('path');
const DRY = process.argv.includes('--dry');
const FILE = path.join(__dirname, '..', 'dist', 'trading-api', 'index.html');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
let h = fs.readFileSync(FILE, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
if (h.indexOf('data-plan="premium">') >= 0) { console.log('already applied'); process.exit(0); }
const did = [];
function sub(a, b, label) {
  const c = h.split(a).length - 1;
  if (c !== 1) { console.error('REFUSING: expected 1 of "' + label + '", found ' + c); process.exit(1); }
  h = h.split(a).join(b); did.push(label);
}
function between(startMark, endMark, repl, label) {
  const i = h.indexOf(startMark); if (i < 0) { console.error('REFUSING: no start for ' + label); process.exit(1); }
  const j = h.indexOf(endMark, i); if (j < 0) { console.error('REFUSING: no end for ' + label); process.exit(1); }
  h = h.slice(0, i) + repl + h.slice(j + endMark.length); did.push(label);
}
// the archive's own dataset list, so the page never claims a count the worker does not hold
const dsBlock = src.slice(src.indexOf('const MARKET_DS = {'), src.indexOf('\n};', src.indexOf('const MARKET_DS = {')));
const DS = [...dsBlock.matchAll(/^\s{2}(\w+):\s*\{ src:/gm)].map(m => m[1]);
if (DS.length < 5) { console.error('REFUSING: could not read MARKET_DS'); process.exit(1); }
const PR = (() => { const m = src.match(/\{ id: 'premium', tier: 1, cents: (\d+)[^}]*rpm: (\d+), maxKeys: (\d+), maxOpen: (\d+), maxBooks: (\d+), hooks: (\d+)/); if (!m) { console.error('REFUSING: no premium row'); process.exit(1); } return { usd: (+m[1] / 100).toFixed(2).replace(/\.00$/, ''), rpm: +m[2], keys: +m[3], open: +m[4], books: +m[5], hooks: +m[6] }; })();
const L = (...a) => a.join(N);

// 1. the section intro
between('<h2>Free is the whole engine. You pay to run more than one thing at once.</h2>', '</p>',
  '<h2>Free is everything you need to test a bot. API Premium is for building on it.</h2>' + N +
  '      <p>Free has no time limit and no card: the whole trading engine, real venue fees, limit and stop entries, trailing stops, replay, the configurable simulation, the WebSocket stream and all live market data. <b>API Premium</b> adds what a serious build needs - <b>our market archive over the API</b> (' + DS.length + ' datasets nobody else publishes, every liquidation since July 2026), the raw order-book ladder, webhooks, many books and 90 days of trade history. It is a separate subscription from site Premium.</p>',
  'section intro');

// 2. the cards + the table
const cards = L(
  '<div class="apgrid">',
  '      <div class="apcard" data-plan="free">',
  '        <div class="aphead"><h3><span class="apn">Free</span></h3></div>',
  '        <div class="appx">$0 <small style="font-size:15px;color:var(--dim);font-weight:400">for ever</small></div>',
  '        <p class="apsub">Everything you need to test a bot: the whole engine, the stream, replay and live market data. <b>No card, no trial, no countdown.</b></p>',
  '        <div class="apkey"><b>Test a strategy end to end</b><span>one book &middot; one journal &middot; the full engine</span></div>',
  '        <ul class="apfeat">',
  '          <li><b>3</b> keys &middot; <b>50</b> open positions &middot; <b>120</b> req/min</li>',
  '          <li>Full engine: market, limit &amp; stop orders, trailing stops, dry run, replay</li>',
  '          <li>The configurable simulation - fees, slippage, latency, partial fills - and <a href="#fees">9 real venues</a></li>',
  '          <li>WebSocket stream &middot; MCP &middot; keyless live market data</li>',
  '          <li>Trading report: totals, skill score and what fees and funding cost you</li>',
  '          <li><b>30 days</b> of trade history</li>',
  '        </ul>',
  '        <button class="apbtn ghost" type="button" disabled>Free for ever</button>',
  '      </div>',
  '      <div class="apcard feat" data-plan="premium">',
  '        <div class="aphead"><h3>API Premium</h3><span class="appill">BUILD ON IT</span></div>',
  '        <div class="appx">$' + PR.usd + '<small>/month</small></div>',
  '        <p class="apsub">For building something real: backtest on our measured history, react to webhooks, run a family of strategies side by side.</p>',
  '        <div class="apkey feat"><b>The market archive, over the API</b><span>every liquidation since July 2026 &middot; open interest &middot; funding &middot; whale trades &middot; long/short</span></div>',
  '        <ul class="apfeat">',
  '          <li><b>Market archive</b> on <code>/v1/history</code> - ' + DS.length + ' datasets, one verified CSV per UTC day</li>',
  '          <li><b>Raw order-book ladder</b> per venue</li>',
  '          <li><b>' + PR.books + '</b> books &middot; <b>' + PR.hooks + '</b> signed webhooks</li>',
  '          <li><b>90 days</b> of trade history, report breakdowns and written findings</li>',
  '          <li><b>' + PR.keys + '</b> keys &middot; <b>' + PR.open + '</b> open positions &middot; <b>' + PR.rpm + '</b> req/min</li>',
  '        </ul>',
  '        <button class="apbtn" type="button" data-buy="premium">Get API Premium</button>',
  '      </div>',
  '    </div>',
  '    <p id="apMsg" class="note" hidden></p>',
  '    <div class="tw plantw"><table class="vs">',
  '      <tr><th>What changes with the plan</th><th><span class="apn">Free</span></th><th>API Premium &middot; $' + PR.usd + '</th></tr>',
  '      <tr><td><b>Market archive</b> <code>/v1/history</code><br><span class="sub">' + DS.join(', ') + '</span></td><td>the catalogue</td><td><b>every day, every dataset</b></td></tr>',
  '      <tr><td>Raw order-book ladder per venue</td><td class="no">consolidated book only</td><td><b>yes</b></td></tr>',
  '      <tr><td><a href="#books">Books</a> - a separate journal, balance and report per strategy</td><td>1</td><td><b>' + PR.books + '</b></td></tr>',
  '      <tr><td><b>Webhooks</b> - signed, retried, delivered while you are offline</td><td class="no">none</td><td><b>' + PR.hooks + '</b></td></tr>',
  '      <tr><td>Trade history kept<br><span class="sub">what <code>/v1/trades</code>, the report and the equity curve can still see</span></td><td>30 days</td><td><b>90 days</b></td></tr>',
  '      <tr><td>Trading report <code>/v1/report</code></td><td>totals, skill score, costs</td><td><b>+ breakdowns &amp; findings</b></td></tr>',
  '      <tr><td>API keys &middot; open positions</td><td>3 &middot; 50</td><td><b>' + PR.keys + ' &middot; ' + PR.open + '</b></td></tr>',
  '      <tr><td>Requests per minute, per key (engine and <code>/api/v1/*</code> with the key)<br><span class="sub">60 / min per IP without a key, on every plan</span></td><td>120</td><td><b>' + PR.rpm + '</b></td></tr>',
  '    </table></div>'
);
{
  const i = h.indexOf('<div class="apgrid">'), j = h.indexOf('</table></div>', i);
  if (i < 0 || j < 0) { console.error('REFUSING: plan grid not found'); process.exit(1); }
  h = h.slice(0, i) + cards + h.slice(j + '</table></div>'.length); did.push('cards + table');
}
// the measurement block argued about tiers that no longer exist
{
  const i = h.indexOf('<div class="apmeas">');
  if (i >= 0) { const j = h.indexOf('</div>', h.indexOf('</p>', i)) + 6; h = h.slice(0, i) + '<div class="apmeas"><b>Why the line sits where it does.</b><p>Across every key we have served, the busiest bot peaks at a fraction of the 120 requests a minute Free allows, and no key has ever been rate-limited. Testing a bot does not need a bigger number, so Free keeps the whole engine and asks for nothing. What costs us to keep, and what nobody else can sell you, is the measured history - so that is what API Premium is.</p></div>' + h.slice(j); did.push('measurement block'); }
}
// two cards side by side
sub('.apgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));', '.apgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));', 'grid columns');

// 3. JSON-LD offers
{
  const i = h.indexOf('{"@type":"Offer","name":"Free"');
  const j = h.indexOf('{"@type":"Offer","name":"API Business"');
  if (i < 0 || j < 0) { console.error('REFUSING: offers not found'); process.exit(1); }
  const k = h.indexOf('}}', j) + 2;
  const free = h.slice(i, h.indexOf('}}', i) + 2);
  const prem = '{"@type":"Offer","name":"API Premium","price":"' + PR.usd + '","priceCurrency":"USD","description":"The MarginPad market archive over the API (' + DS.length + ' datasets, every liquidation since July 2026), the raw order-book ladder, ' + PR.books + ' books, ' + PR.hooks + ' webhooks and 90 days of trade history.","url":"https://marginpad.io/trading-api/#plans","availability":"https://schema.org/InStock","priceSpecification":{"@type":"UnitPriceSpecification","price":"' + PR.usd + '","priceCurrency":"USD","billingIncrement":1,"unitCode":"MON","billingDuration":1,"description":"Per month, paid in crypto or from a MarginPad rewards balance. Nothing renews automatically."}}';
  h = h.slice(0, i) + free + ',' + prem + h.slice(k); did.push('JSON-LD offers');
}
// 4. the limits FAQ answer
{
  const re = /"Free: 120 requests per minute per key[^"]*"/;
  if (!re.test(h)) { console.error('REFUSING: limits FAQ not found'); process.exit(1); }
  h = h.replace(re, () => '"Free: 120 requests per minute per key, 3 keys per account, 50 open positions, the whole engine and the WebSocket stream, with no time limit. API Premium ($' + PR.usd + ' a month): the market archive over the API, the raw order-book ladder, ' + PR.rpm + ' requests per minute, ' + PR.keys + ' keys, ' + PR.open + ' open positions, ' + PR.books + ' books, ' + PR.hooks + ' webhooks and 90 days of trade history. No key has ever been rate-limited on any plan."');
  did.push('limits FAQ');
}
// 5. the hero note
{
  const i = h.indexOf('Free forever at 120 requests a minute - ');
  const j = h.indexOf('Market data stays keyless on every plan.', i);
  if (i < 0 || j < 0) { console.error('REFUSING: hero note'); process.exit(1); }
  h = h.slice(0, i) + 'Free forever at 120 requests a minute - <a href="#plans">API Premium is $' + PR.usd + '</a> when you want our market archive, webhooks and many books. ' + h.slice(j); did.push('hero note');
}
// 6. sentences elsewhere on the page
sub('the written <b>findings</b> on API Pro and Max (', 'the written <b>findings</b> on API Premium (', 'report sentence');
sub('Three hooks per account on Pro, fifteen on Max, fifty on Business;', PR.hooks + ' hooks per account on API Premium;', 'webhooks sentence');
sub('Free accounts get one book besides the main account, API Pro five, Max twenty and Business fifty.', 'Free accounts get one book besides the main account, API Premium ' + PR.books + '.', 'books sentence');
sub('Delete one first - three hooks on Pro, fifteen on Max, fifty on Business.', 'Delete one first - ' + PR.hooks + ' hooks on API Premium.', 'error table');
sub("' - revoke one, or API Pro raises it to 10.'", "' - revoke one, or API Premium raises it to " + PR.keys + ".'", 'key limit line');
sub("var nm=esc({lab:'Lab',pro:'Pro',max:'Max',business:'Business'}[c.plan]||'Pro')", "var nm=esc({premium:'API Premium',lab:'Lab',pro:'Pro',max:'Max',business:'Business'}[c.plan]||'API Premium')", 'plan name in state line');

// guards
const vis = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const left = vis.match(/API (Pro|Max|Business|Lab)\b|\$27|\$69|\$139|Get (Pro|Max|Business|Lab)\b/g);
if (left) { console.error('REFUSING: retired plans still named: ' + [...new Set(left)].join(', ')); process.exit(1); }
try { for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]); }
catch (e) { console.error('REFUSING: a JSON-LD block no longer parses - ' + e.message); process.exit(1); }
if ((h.split('<section').length) !== (h.split('</section>').length)) { console.error('REFUSING: <section> tags no longer balance'); process.exit(1); }
console.log(did.map(d => '  ok  ' + d).join('\n'));
if (DRY) { console.log('--dry: nothing written'); process.exit(0); }
fs.writeFileSync(FILE + '.tmp', h); fs.renameSync(FILE + '.tmp', FILE);
console.log('written');

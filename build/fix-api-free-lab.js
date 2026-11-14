// API FREE FOR EVERYONE + THE $5 LAB PLAN ON /trading-api/ (2026-11-14, owner: "ajde da damo nas API free svima, i da stavimo
// neki plan od $5 koji daje nesto za advanced testing botova. Takodje update SEO da je sad nas API free").
// One-shot, idempotent (it checks for data-plan="lab" before touching anything), --dry prints the plan. The PRICES are
// still owned by build/fix-api-prices.js, which reads API_PLANS: this file only adds the structure Lab needs (a card,
// a JSON-LD Offer, a table column) and retires the 7-day trial wording. Run fix-api-prices.js after it.
const fs = require('fs');
const path = require('path');
const DRY = process.argv.includes('--dry');
const FILE = path.join(__dirname, '..', 'dist', 'trading-api', 'index.html');
let h = fs.readFileSync(FILE, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
if (h.indexOf('data-plan="lab">') >= 0) { console.log('already applied'); process.exit(0); }
const did = [];
function sub(a, b, label) {
  const c = h.split(a).length - 1;
  if (c !== 1) { console.error('REFUSING: expected 1 of "' + label + '", found ' + c); process.exit(1); }
  h = h.split(a).join(b); did.push(label);
}

// 1. the Free card: free for good
sub('<div class="aphead"><h3><span class="apn">Free trial</span></h3></div>', '<div class="aphead"><h3><span class="apn">Free</span></h3></div>', 'Free card title');
sub('<div class="appx">$0 <small style="font-size:15px;color:var(--dim);font-weight:400">for 7 days</small></div>', '<div class="appx">$0 <small style="font-size:15px;color:var(--dim);font-weight:400">for ever</small></div>', 'Free card price note');
{
  const i = h.indexOf('<p class="apsub">The full engine, free for <b>7 days</b>');
  if (i < 0) { console.error('REFUSING: Free card sentence not found'); process.exit(1); }
  const j = h.indexOf('</p>', i) + 4;
  h = h.slice(0, i) + '<p class="apsub">The full engine, <b>free with no time limit</b> - no card, no trial, no countdown. Market data stays free and keyless with no account at all.</p>' + h.slice(j);
  did.push('Free card sentence');
}
sub('<button class="apbtn ghost" type="button" disabled>Your 7-day trial</button>', '<button class="apbtn ghost" type="button" disabled>Free for ever</button>', 'Free card button');

// 2. the Lab card, between Free and Pro
{
  const card = [
    '<div class="apcard" data-plan="lab">',
    '        <div class="aphead"><h3><span class="apn">Lab</span></h3><span class="appill">BOT TESTING</span></div>',
    '        <div class="appx">$5<small>/month</small></div>',
    '        <p class="apsub">For testing a bot properly: run five versions of a strategy side by side and let the engine call your bot instead of being polled.</p>',
    '        <div class="apkey"><b>5 books, webhooks, 90 days</b><span>A/B test strategies &middot; signed webhooks &middot; report breakdowns</span></div>',
    '        <ul class="apfeat">',
    '          <li><b>5</b> books - a separate journal, balance and report per strategy</li>',
    '          <li><b>Webhooks</b> - 3 signed, retried endpoints</li>',
    '          <li><b>90 days</b> of trade history and the report with breakdowns and findings</li>',
    '          <li><b>5</b> keys &middot; <b>150</b> open positions &middot; <b>300</b> req/min</li>',
    '        </ul>',
    '        <button class="apbtn" type="button" data-buy="lab">Get Lab</button>',
    '      </div>',
    '      ',
  ].join(N);
  sub('<div class="apcard feat" data-plan="pro">', card + '<div class="apcard feat" data-plan="pro">', 'Lab card');
}

// 3. the JSON-LD Offer (fix-api-prices.js keeps its figure in step with API_PLANS from here on)
{
  const offer = '{"@type":"Offer","name":"API Lab","price":"5","priceCurrency":"USD","description":"Five strategy books for A/B testing a bot, three webhooks, 90-day trade history and the report with findings.","url":"https://marginpad.io/trading-api/#plans","availability":"https://schema.org/InStock","priceSpecification":{"@type":"UnitPriceSpecification","price":"5","priceCurrency":"USD","billingIncrement":1,"unitCode":"MON","billingDuration":1,"description":"Per month, paid in crypto or from a MarginPad rewards balance. Nothing renews automatically."}},';
  sub('{"@type":"Offer","name":"API Pro"', offer + '{"@type":"Offer","name":"API Pro"', 'JSON-LD Offer API Lab');
}

// 4. the comparison table: a Lab column after Free
{
  const s = h.indexOf('<div class="tw plantw"><table class="vs">');
  const e = h.indexOf('</table></div>', s);
  if (s < 0 || e < 0) { console.error('REFUSING: plan table not found'); process.exit(1); }
  let t = h.slice(s, e);
  const LAB = ['<b>300 / min</b>', '<b>5</b>', '<b>150</b>', '<b>5</b>', '<b>3</b>', '<b>90 days</b>', '<b>300</b>', '<b>+ breakdowns &amp; findings</b><br><span class="sub">up to 90 days back</span>'];
  t = t.replace('<th><span class="apn">Free</span></th>', () => '<th><span class="apn">Free</span></th><th>Lab &middot; $5</th>');
  let k = 0;
  // every data row: insert the Lab cell after the row's SECOND cell (the first is the label, the second is Free)
  t = t.replace(/<tr><td>[\s\S]*?<\/tr>/g, (row) => {
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length !== 5) return row;
    const v = LAB[k++];
    return row.replace(cells[1], () => cells[1] + '<td>' + v + '</td>');
  });
  if (k !== LAB.length) { console.error('REFUSING: expected ' + LAB.length + ' plan rows, found ' + k); process.exit(1); }
  h = h.slice(0, s) + t + h.slice(e);
  did.push('table column Lab (' + k + ' rows)');
}

// 5. the hero note names the entry plan
sub('Free forever at 120 requests a minute - <a href="#plans">Pro is', 'Free forever at 120 requests a minute - <a href="#plans">Lab is $5</a> to A/B five strategies with webhooks, <a href="#plans">Pro is', 'hero note');

// 6. the signed-in state line: no trial any more, and every plan named by its own label
sub("'You are on <b>Free</b> - 120 requests a minute, 3 keys, 50 open positions. Pick a plan below to raise it.'", "'You are on <b>Free</b>, with no time limit - 120 requests a minute, 3 keys, 50 open positions. Pick a plan below to raise it.'", 'state line');
sub("var nm=esc(c.plan==='max'?'Max':'Pro')", "var nm=esc({lab:'Lab',pro:'Pro',max:'Max',business:'Business'}[c.plan]||'Pro')", 'plan name in state line');

// guards
try { for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]); }
catch (e) { console.error('REFUSING: a JSON-LD block no longer parses - ' + e.message); process.exit(1); }
if (/7-day trial|free for <b>7 days/i.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) { console.error('REFUSING: trial wording survived'); process.exit(1); }
console.log(did.map(d => '  ok  ' + d).join('\n'));
if (DRY) { console.log('--dry: nothing written'); process.exit(0); }
fs.writeFileSync(FILE + '.tmp', h); fs.renameSync(FILE + '.tmp', FILE);
console.log('written');

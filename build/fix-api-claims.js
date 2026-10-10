// THE MEASURED SENTENCES ON /trading-api/ HAD ALL AGED, AND TWO OF THEM CONTRADICTED EACH OTHER (2026-10-10).
//
// Every figure below was re-measured from `/api/admin/apistats` the day this ran. The page is the one place a
// developer decides whether to trust our numbers, so a stale measurement there costs more than a missing one.
//
//   claim on the page                            | measured today
//   ---------------------------------------------|---------------------------------
//   "1.1M calls served"  (hardcoded, dead id)    | 4,465,176  -> LIVE off /api/status now
//   "99.4% of every call ever ... was a poll"    | 76.4% over the 40-day window
//   "89.5% of every call ... was polling"        | the SAME quantity, in another section
//   "the WebSocket had been opened six times"    | 15 calls
//   "the busiest bot sits at 46 requests a       | 66 req/min, 55% of Free
//    minute - 38% of what Free already allows"   |
//   "24 endpoints"                               | 26 usable paths (27 routed, /v1/ai is retired)
//   "no key has ever been rate-limited"          | still true: 0 x 429 in the window
//
// TWO FIGURES FOR ONE QUANTITY IS WORSE THAN EITHER BEING WRONG - a reader who notices stops believing the
// rest of the strip. Both polling sentences now quote one number and NAME THE WINDOW, because a 40-day table
// cannot support "every call ever made" however true it feels.
//
// It also adds the two things the sales blocks were missing: the market count (156 across perps, stocks,
// forex, indices and metals on one key - no alternative offers that) and the configurable simulation, which
// was the newest and largest differentiator and lived only in the reference section.
//
// Idempotent, `--dry`, refuses rather than guessing.
const fs = require('fs');
const path = require('path');
const PAGE = path.join(__dirname, '..', 'dist', 'trading-api', 'index.html');
const DRY = process.argv.indexOf('--dry') >= 0;
let h = fs.readFileSync(PAGE, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const before = h;
const did = [];
function sub(from, to, label, optional) {
  const c = h.split(from).length - 1;
  if (c === 0 && optional) { console.log('  --   ' + label + ' (already applied)'); return; }
  if (c !== 1) { console.error('REFUSING: expected 1 occurrence for "' + label + '", found ' + c); process.exit(1); }
  h = h.split(from).join(to); did.push(label);
}

// ── 1. the proof strip: endpoint count, the live calls figure, and the markets differentiator
// The strip is one <div> per item on one line - the first draft of this marker assumed the pretty-printed
// shape and matched nothing, which is why every marker here is taken from the page's own bytes.
sub('<div class="v">24</div><div class="l">endpoints, plus a WebSocket, webhooks and an MCP server</div>',
  '<div class="v">26</div><div class="l">endpoints, plus a WebSocket, webhooks and an MCP server</div>',
  'proof strip: 24 -> 26 endpoints (one-line form)', true);

sub('<div class="v" id="pvCalls">1.1M</div><div class="l">calls served for the bots already running on it</div>',
  '<div class="v" id="pvCalls">4.4M</div><div class="l">calls served for the bots already running on it</div>',
  'proof strip: the calls fallback matches the live figure', true);

// The markets count is the differentiator none of the alternatives has, and the strip never said it.
// GUARDED BY THE RESULT, not by the marker: this one APPENDS after a tile that survives the edit, so the
// marker still matches on a second run and the first version of this script inserted a duplicate tile.
if (h.indexOf('markets on one key') < 0) {
  sub('<div><div class="v">1,000<span style="font-size:18px">&times;</span></div><div class="l">maximum leverage, on any USDT pair with a live price</div></div>',
    '<div><div class="v">1,000<span style="font-size:18px">&times;</span></div><div class="l">maximum leverage, on any USDT pair with a live price</div></div>' + N +
    '  <div><div class="v">156</div><div class="l">markets on one key: crypto perps, US stocks, forex, indices and metals</div></div>',
    'proof strip gains the market count');
} else console.log('  --   proof strip market count (already applied)');

// ── 2. ONE polling figure, with its window named
sub('99.4% of every call ever made to this API was a poll of <code>/positions</code> or <code>/account</code>, and the WebSocket had been opened six times.',
  '76.4% of every call to this API over the last 40 days was a poll of <code>/positions</code> or <code>/account</code> - 890,921 and 471,390 calls - while the WebSocket was opened 15 times in its whole life.',
  'the stream section quotes the measured window', true);
sub('Measured before this existed: <b>89.5% of every call to this API was polling</b> <code>/positions</code> and <code>/account</code> for events.',
  'Measured over the last 40 days: <b>76.4% of every call to this API is a poll</b> of <code>/positions</code> and <code>/account</code> looking for events that have not happened yet.',
  'the webhooks section quotes the same figure', true);

// ── 3. the throughput measurement that sells Free honestly
sub('the busiest bot in production sits at <b>46 requests a minute</b> - 38% of what the Free plan already allows - and <b>no key has ever been rate-limited</b>, on any plan.',
  'the busiest bot in production peaks at <b>66 requests a minute</b> - 55% of what the Free plan already allows - and <b>no key has ever been rate-limited</b>, on any plan.',
  'the throughput measurement is current', true);

// ── 4. the differentiators block gains the simulation profile
// EACH CARD *IS* A `.diff` DIV - the section has no wrapper, the six cards sit side by side in its grid,
// shaped `<div class="diff"><span class="dn">Eyebrow</span><h3>..</h3><p>..</p></div>`. The first version of
// this anchored on `<div class="diff">` as though it were the container, so the new card landed INSIDE the
// first one wrapped in a `.diff-c` class that has no CSS anywhere on the page - one card with two headings.
// The browser probe still reported "reachable, nothing overflowing, no page errors": that is exactly why the
// house rule is to LOOK at the render. Printing the headings and getting one back is what caught it.
const SIMCARD = '<div class="diff"><span class="dn">Simulation</span><h3>Build the venue you will actually trade</h3>'
  + '<p>Eighteen fields and eight presets: the size of the book and whether it is a real budget, what crossing the order book costs on the way in <em>and out</em>, how long your order is in flight, partial fills, how often the venue refuses, your own fee, funding, and where liquidation sits. <b>Freqtrade lets you set the starting balance and nothing else</b>; a testnet gives you whatever its book gives you. <a href="#sim">Every field, with its range &rarr;</a></p></div>';
{
  if (h.indexOf('Build the venue you will actually trade') < 0) {
    const at = h.indexOf('<div class="diff">');
    if (at < 0) { console.error('REFUSING: no .diff card to sit beside'); process.exit(1); }
    h = h.slice(0, at) + SIMCARD + N + '      ' + h.slice(at);
    did.push('the differentiators row leads with the simulation profile');
  } else console.log('  --   differentiator card (already applied)');
}

// ── 5. the hero sub-line names what is configurable (it is the newest reason to choose us)
sub('No card, no KYC, no deposit. Free forever at 120 requests a minute',
  'No card, no KYC, no deposit. Every fill condition is yours to set - book size, slippage, latency, partial fills, refusals, fees. Free forever at 120 requests a minute',
  'the hero names the configurable engine', true);

// ── GUARDS
if (/99\.4%|89\.5%|opened six times|46 requests a minute/.test(h)) { console.error('REFUSING: a stale measurement survived'); process.exit(1); }
if ((h.split('<section').length) !== (h.split('</section>').length)) { console.error('REFUSING: <section> tags no longer balance'); process.exit(1); }
if ((h.split('<div').length) !== (h.split('</div>').length)) { console.error('REFUSING: <div> tags no longer balance'); process.exit(1); }
for (const id of ['akb', 'plans', 'quickstart', 'sim', 'realism', 'fees', 'errors', 'stream', 'webhooks', 'pvCalls']) {
  if ((h.split('id="' + id + '"').length - 1) !== 1) { console.error('REFUSING: id #' + id + ' is no longer unique'); process.exit(1); }
}
try { for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]); }
catch (e) { console.error('REFUSING: a JSON-LD block no longer parses - ' + e.message); process.exit(1); }

if (!did.length) { console.log('\nnothing to change'); process.exit(0); }
console.log(did.map((d) => '  ok  ' + d).join('\n'));
console.log('  ' + before.length + ' -> ' + h.length + ' bytes');
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }
fs.writeFileSync(PAGE, h);
console.log('\nfix-api-claims: written');

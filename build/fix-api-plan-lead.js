// THE PAID TIER WAS SOLD ON THREE THINGS NOBODY HAS EVER USED (2026-10-10).
//
// MEASURED from /api/admin/apistats, every figure below, e2e excluded, 125 accounts and 174 keys:
//
//   Pro's FIRST headline  - webhooks      : 0 registrations, ever. 112 calls = people looking and being refused.
//   Pro's SECOND headline - 5 books       : 0 accounts hold more than one book. 0 of 174 keys trade a named one.
//   report breakdowns                     : 129 calls, 0.01% of traffic.
//   requests per minute                   : busiest key 66 of its 120, and 0 x 429 in the window, ever.
//
//   the ONE Free ceiling anybody reaches  : KEYS. 12 of 125 accounts sit at or over the 3-key limit
//                                           (@RandoMagic 5, @rom4ik 4, ten more at 3).
//
// And 0 keys are on Pro. The only paid-shaped rows are a grandfathered Founder and the owner's own grant.
//
// So this is a POSITIONING fix, not a price change: zero conversions while almost nobody reaches a gate is
// not evidence about price, and lowering a price nobody has refused would be guessing. What it does is stop
// the Pro card leading with two dead features and lead instead with the only ceiling the measurements show
// people actually meeting - the same correction this page already made in 2026-09-16, when it led with
// requests-per-minute, the one axis nobody was short of.
//
// The gated features are NOT removed. Webhooks and books stay on the card, below the lead, because a feature
// with no uptake is not a feature with no value - it is a feature nobody has needed yet.
//
// Idempotent, `--dry`, refuses rather than guessing.
const fs = require('fs');
const path = require('path');
const PAGE = path.join(__dirname, '..', 'dist', 'trading-api', 'index.html');
const DRY = process.argv.indexOf('--dry') >= 0;
let h = fs.readFileSync(PAGE, 'utf8');
const before = h;
const did = [];
function sub(from, to, label) {
  const c = h.split(from).length - 1;
  if (c === 0 && h.indexOf(to) >= 0) { console.log('  --   ' + label + ' (already applied)'); return; }
  if (c !== 1) { console.error('REFUSING: expected 1 occurrence for "' + label + '", found ' + c); process.exit(1); }
  h = h.split(from).join(to); did.push(label);
}

// ── Pro leads with the ceiling people reach, not the feature nobody has used
sub('<div class="apkey feat"><b>5 strategies, and the server calls you</b><span>five separate books &middot; webhooks &middot; 90-day history</span></div>',
  '<div class="apkey feat"><b>10 keys, and 90 days of history</b><span>a key per bot &middot; 5 books &middot; webhooks &middot; report breakdowns</span></div>',
  'Pro leads with keys and history');

// ── Max and Business follow the same logic
sub('<div class="apkey"><b>20 strategies</b><span>twenty books &middot; 15 webhooks</span></div>',
  '<div class="apkey"><b>30 keys, 20 books</b><span>deeper order book &middot; 15 webhooks</span></div>',
  'Max leads with keys and books');

// ── the measurement statement says what now measures, including the gate that DOES bind
{
  const old = h.match(/<div class="apmeas">[\s\S]*?<\/div>/);
  if (!old) { console.error('REFUSING: no .apmeas block found'); process.exit(1); }
  const next = '<div class="apmeas"><b>Choose on keys and history, not on throughput - and here is the measurement.</b>'
    + '<p>Across 125 accounts and 174 keys, the busiest bot in production peaks at <b>66 requests a minute of the 120 Free already allows</b>, and <b>no key has ever been rate-limited on any plan</b>. '
    + 'The one Free ceiling that does get reached is <b>keys</b>: 12 of those 125 accounts sit at or over the three-key limit, because a serious setup wants one key per bot so a backtest and a live strategy never share a rate budget. '
    + 'Webhooks and extra books are on the paid plans and <b>have had no uptake at all so far</b> - we would rather say that than sell you a tier for them. '
    + 'Everything that decides whether a result is real - the engine, every market, limit and stop orders, replay, the WebSocket stream, the whole configurable simulation and the cost breakdown on your report - is on Free.</p></div>';
  if (old[0] !== next) {
    if (/have had no uptake at all so far/.test(old[0])) console.log('  --   the measurement statement (already applied)');
    else { h = h.replace(old[0], next); did.push('the measurement statement names the gate that binds'); }
  }
}

// ── GUARDS
if (/5 strategies, and the server calls you/.test(h)) { console.error('REFUSING: the old Pro lead survived'); process.exit(1); }
if ((h.split('<div').length) !== (h.split('</div>').length)) { console.error('REFUSING: <div> tags no longer balance'); process.exit(1); }
if ((h.split('class="apkey').length - 1) !== 4) { console.error('REFUSING: there should be exactly 4 plan unlock strips'); process.exit(1); }
for (const id of ['akb', 'plans', 'quickstart', 'sim']) if ((h.split('id="' + id + '"').length - 1) !== 1) { console.error('REFUSING: id #' + id + ' is no longer unique'); process.exit(1); }
try { for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]); }
catch (e) { console.error('REFUSING: a JSON-LD block no longer parses - ' + e.message); process.exit(1); }

if (!did.length) { console.log('\nnothing to change'); process.exit(0); }
console.log(did.map((d) => '  ok  ' + d).join('\n'));
console.log('  ' + before.length + ' -> ' + h.length + ' bytes');
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }
fs.writeFileSync(PAGE, h);
console.log('\nfix-api-plan-lead: written');

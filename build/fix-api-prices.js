// EVERY PRICE ON /trading-api/ IS WRITTEN FROM API_PLANS, NOT TYPED (2026-10-10).
//
// MEASURED the day this was written. The plans were repriced to $39/$99/$199 on 2026-09-22; the price CARDS
// moved and four other places on the same page did not:
//   price card            $39   (correct)
//   comparison table      $29   <- directly below the card
//   hero note             $29
//   JSON-LD FAQ answer    $29
//   JSON-LD Offer         $29 / $79 / $159   <- what Google, Bing and every assistant read
// So the page contradicted itself a screen apart, and the structured data published a 26% discount that does
// not exist. An assistant asked "what does the MarginPad API cost" answered $29.
//
// This reads API_PLANS out of src/worker.js - the one table - and rewrites every price on the page from it.
// Idempotent: run it after any reprice. `--dry` prints what it would change. It REFUSES rather than guessing
// if the page's shape no longer matches, and it refuses if any stale price survives the pass.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'dist', 'trading-api', 'index.html');
const DRY = process.argv.indexOf('--dry') >= 0;

// ---- the authority
const src = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
const tbl = src.slice(src.indexOf('const API_PLANS_RAW = ['), src.indexOf('\n];', src.indexOf('const API_PLANS_RAW = [')));
// A PROMO IS A PERCENT OFF THE LIST AND THE PAGE MAY NOT DO ITS OWN ARITHMETIC. The worker rounds DOWN to the
// whole dollar so the buyer always gets at least the percentage promised; this repeats that one rule, and
// apiplan-e2e compares the page against the live catalogue, so a drift between them is a red test.
const PROMO_PCT = (() => { const m = src.match(/API_PROMO = \{ pct: (\d+)/); return m ? +m[1] : 0; })();
const PROMO_LABEL = (() => { const m = src.match(/API_PROMO = \{[^}]*label: '([^']*)'/); return m ? m[1] : ''; })();
const promoCents = (c) => (PROMO_PCT > 0 && c > 0) ? Math.floor((c * (100 - PROMO_PCT)) / 10000) * 100 : c;
const PLANS = {};
for (const m of tbl.matchAll(/\{\s*id:\s*'(\w+)'[^}]*?cents:\s*(\d+)[^}]*?label:\s*'(\w+)'[^}]*?rpm:\s*(\d+)[^}]*?maxKeys:\s*(\d+)[^}]*?maxOpen:\s*(\d+)[^}]*?maxBooks:\s*(\d+)[^}]*?hooks:\s*(\d+)/g)) {
  PLANS[m[1]] = { id: m[1], usd: Math.round(promoCents(+m[2]) / 100), wasUsd: promoCents(+m[2]) !== +m[2] ? Math.round(+m[2] / 100) : 0, label: m[3], rpm: +m[4], keys: +m[5], open: +m[6], books: +m[7], hooks: +m[8] };
}
for (const id of ['free', 'pro', 'max', 'business']) if (!PLANS[id]) { console.error('REFUSING: could not read plan "' + id + '" out of API_PLANS'); process.exit(1); }
const P = PLANS.pro, M = PLANS.max, B = PLANS.business, F = PLANS.free;
console.log('API_PLANS says: Pro $' + P.usd + ' / Max $' + M.usd + ' / Business $' + B.usd
  + (PROMO_PCT ? '   (' + PROMO_LABEL + ', list $' + P.wasUsd + ' / $' + M.wasUsd + ' / $' + B.wasUsd + ')' : ''));

let h = fs.readFileSync(PAGE, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const before = h;
const did = [];
function sub(from, to, label, optional) {
  const c = h.split(from).length - 1;
  if (c === 0 && optional) { console.log('  --   ' + label + ' (already correct)'); return; }
  if (c !== 1) { console.error('REFUSING: expected 1 occurrence for "' + label + '", found ' + c); process.exit(1); }
  if (from === to) { console.log('  --   ' + label + ' (already correct)'); return; }
  h = h.split(from).join(to); did.push(label);
}

// ---- 1. the JSON-LD Offers: what search engines and assistants actually read
for (const pl of [P, M, B]) {
  const re = new RegExp('("@type":"Offer","name":"API ' + pl.label + '","price":")(\\d+)(")', 'g');
  const m = [...h.matchAll(re)];
  if (m.length !== 1) { console.error('REFUSING: expected 1 Offer for API ' + pl.label + ', found ' + m.length); process.exit(1); }
  if (m[0][2] !== String(pl.usd)) { h = h.replace(re, (mm, a, b, c) => a + pl.usd + c); did.push('JSON-LD Offer ' + pl.label + ': $' + m[0][2] + ' -> $' + pl.usd); }
  // the priceSpecification inside the same offer carries the figure a second time
  const i = h.indexOf('"@type":"Offer","name":"API ' + pl.label + '"');
  const seg = h.slice(i, i + 700);
  const ps = seg.match(/("@type":"UnitPriceSpecification","price":")(\d+)(")/);
  if (ps && ps[2] !== String(pl.usd)) {
    h = h.slice(0, i) + seg.replace(/("@type":"UnitPriceSpecification","price":")(\d+)(")/, (mm, a, b, c) => a + pl.usd + c) + h.slice(i + seg.length);
    did.push('JSON-LD priceSpecification ' + pl.label + ': $' + ps[2] + ' -> $' + pl.usd);
  }
}

// ---- 2. the JSON-LD FAQ answer (one sentence, rebuilt whole so every figure in it comes from the table)
{
  const re = /"Free: 120 requests per minute per key, 3 keys per account, 50 open positions\. API Pro \(\$\d+ a month\)[^"]*"/;
  const m = h.match(re);
  if (!m) { console.error('REFUSING: the limits FAQ answer no longer matches'); process.exit(1); }
  const next = '"Free: ' + F.rpm + ' requests per minute per key, ' + F.keys + ' keys per account, ' + F.open
    + ' open positions. API Pro ($' + P.usd + ' a month): ' + P.rpm + ' requests per minute, ' + P.keys + ' keys, ' + P.open
    + ' open positions, ' + P.books + ' strategy books, ' + P.hooks + ' webhooks and 90 days of trade history. API Max ($' + M.usd
    + ' a month): ' + M.rpm + ' requests per minute, ' + M.keys + ' keys, ' + M.open + ' open positions, ' + M.books + ' books, ' + M.hooks
    + ' webhooks. API Business ($' + B.usd + ' a month): ' + B.rpm + ' requests per minute, ' + B.keys + ' keys, ' + B.open
    + ' open positions, ' + B.books + ' books, ' + B.hooks + ' webhooks. No key has ever been rate-limited on any plan."';
  if (m[0] !== next) { h = h.replace(re, next); did.push('JSON-LD FAQ answer rebuilt from the table'); }
}

// ---- 3. the hero note
{
  const re = /(<a href="#plans">Pro is \$)\d+(<\/a>)/;
  const m = h.match(re);
  if (!m) { console.error('REFUSING: the hero note no longer matches'); process.exit(1); }
  if (m[0] !== '<a href="#plans">Pro is $' + P.usd + '</a>') { h = h.replace(re, (mm, a, b) => a + P.usd + b); did.push('hero note -> $' + P.usd); }
}

// ---- 4. the comparison table header
{
  const re = /<th>Pro &middot; \$\d+<\/th><th>Max &middot; \$\d+<\/th><th><span class="apn">Business<\/span> &middot; \$\d+<\/th>/;
  const m = h.match(re);
  if (!m) { console.error('REFUSING: the comparison table header no longer matches'); process.exit(1); }
  const want = '<th>Pro &middot; $' + P.usd + '</th><th>Max &middot; $' + M.usd + '</th><th><span class="apn">Business</span> &middot; $' + B.usd + '</th>';
  if (m[0] !== want) { h = h.replace(re, want); did.push('comparison table header -> $' + P.usd + ' / $' + M.usd + ' / $' + B.usd); }
}

// ---- 5. the price cards (already correct, but assert them rather than assume)
for (const pl of [P, M, B]) {
  // `data-plan="max"` also appears inside the stylesheet (`.apcard[data-plan="max"] .thr-t i{...}`), so the
  // MARKUP occurrence is the one carrying the closing bracket. Anchoring on the attribute alone found the CSS.
  const i = h.indexOf('data-plan="' + pl.id + '">');
  if (i < 0) { console.error('REFUSING: no card markup for plan ' + pl.id); process.exit(1); }
  const card = h.slice(i, i + 1400);
  const m = card.match(/class="appx">\$(\d+)<small>/);
  if (!m) { console.error('REFUSING: card ' + pl.id + ' has no price'); process.exit(1); }
  if (m[1] !== String(pl.usd)) {
    // FUNCTION replacement even though this regex has no capture groups: the replacement carries "$27"/"$139",
    // and the day somebody wraps a group around this pattern the string form would silently eat the price.
    h = h.slice(0, i) + card.replace(/class="appx">\$\d+<small>/, () => 'class="appx">$' + pl.usd + '<small>') + h.slice(i + card.length);
    did.push('price card ' + pl.label + ': $' + m[1] + ' -> $' + pl.usd);
  }
  // THE STRUCK LIST PRICE. A discount nobody can see is a discount nobody values, and a figure typed into the
  // markup by hand is the exact thing this file exists to stop - so the patcher owns it. Removing the promo
  // (API_PROMO.pct = 0) takes it off again on the next run, which is why the strip is cut before it is written.
  {
    const j = h.indexOf('data-plan="' + pl.id + '">');
    const seg = h.slice(j, j + 1400);
    // The newline and indent BEFORE the strip belong to the strip. Cutting only the <div> left the blank line
    // behind, so every re-run inserted a fresh one and the patcher was not idempotent (caught on run two).
    const cut = seg.replace(/(?:\r?\n)[ \t]*<div class="apwas">[\s\S]*?<\/div>/, '');
    const want = pl.wasUsd ? '<div class="apwas"><s>$' + pl.wasUsd + '</s> <b>' + PROMO_LABEL + '</b></div>' : '';
    // FUNCTION replacement: `want` carries "$199", and "$1" in a replacement STRING is capture group 1.
    const next = want ? cut.replace(/(<div class="appx">\$\d+<small>\/month<\/small><\/div>)/, (mm, g1) => g1 + N + '        ' + want) : cut;
    if (next !== seg) {
      h = h.slice(0, j) + next + h.slice(j + seg.length);
      did.push('card ' + pl.label + ': ' + (pl.wasUsd ? 'struck $' + pl.wasUsd + ' + "' + PROMO_LABEL + '"' : 'promo strip removed'));
    }
  }
}

// ---- GUARDS: no stale price may survive, and nothing structural may have moved
const visible = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
// A list price is allowed on the page ONLY struck through, so it joins the live set; anything else is stale.
const live = new Set([String(F.usd), String(P.usd), String(M.usd), String(B.usd),
  String(P.wasUsd || P.usd), String(M.wasUsd || M.usd), String(B.wasUsd || B.usd)]);
const bad = [];
for (const m of visible.matchAll(/\$(\d+)(?:<small>\/month|\s*&middot;|\s*a month|\/month)/g)) if (!live.has(m[1])) bad.push('$' + m[1] + ' in visible text');
// A LIST PRICE MAY APPEAR ONLY STRUCK THROUGH. The old guard looked for a price followed by "/month", a middot
// or "a month" - the table header puts the middot BEFORE the figure and the hero note has neither, so two
// surfaces carried the pre-reprice number while this check stayed green. Strip every <s>...</s> and nothing
// that is still a list price may be left.
{
  const unstruck = visible.replace(/<s>[\s\S]*?<\/s>/g, ' ');
  for (const pl of [P, M, B]) {
    if (!pl.wasUsd) continue;
    const n = (unstruck.match(new RegExp('\\$' + pl.wasUsd + '\\b', 'g')) || []).length;
    if (n) bad.push('the list price $' + pl.wasUsd + ' (' + pl.label + ') appears ' + n + 'x NOT struck through');
  }
}
for (const m of h.matchAll(/"@type":"Offer","name":"API \w+","price":"(\d+)"/g)) if (!live.has(m[1])) bad.push('$' + m[1] + ' in a JSON-LD Offer');
if (bad.length) { console.error('REFUSING: a stale price survived - ' + bad.join(', ')); process.exit(1); }
if ((h.split('<section').length) !== (h.split('</section>').length)) { console.error('REFUSING: <section> tags no longer balance'); process.exit(1); }
for (const id of ['akb', 'plans', 'quickstart', 'sim', 'realism', 'fees', 'errors']) {
  if ((h.split('id="' + id + '"').length - 1) !== 1) { console.error('REFUSING: anchor #' + id + ' is no longer unique'); process.exit(1); }
}
try { for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]); }
catch (e) { console.error('REFUSING: a JSON-LD block no longer parses - ' + e.message); process.exit(1); }

if (!did.length) { console.log('\nevery price on the page already agrees with API_PLANS - nothing to do'); process.exit(0); }
console.log(did.map((d) => '  ok  ' + d).join('\n'));
console.log('  ' + before.length + ' -> ' + h.length + ' bytes');
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }
fs.writeFileSync(PAGE, h);
console.log('\nfix-api-prices: written');

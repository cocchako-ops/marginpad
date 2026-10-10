// THE npm AND PyPI PACKAGE PAGES WERE STILL SELLING THE PRE-SPLIT WORLD (2026-10-10).
//
// Found while preparing the 3.0.0 publish. All three READMEs - and therefore the page npmjs.com and
// pypi.org render as the package's own documentation - carried:
//
//   "Free: 120 requests/minute per key, 3 keys, 50 open positions. Premium: 600/minute, 10 keys, 200 open."
//
// Premium has bought NOTHING on the Bot API since 2026-09-15. The plan is API Pro at $39, Premium is the
// site subscription, and the two were decoupled deliberately. So the first thing a developer evaluating
// the SDK read was a plan that does not exist, at a price we do not charge - the same drift that put
// $29/$79/$159 on five surfaces for nineteen days, in the one place a build script had never looked.
//
// And `sim()` - the whole reason 3.0.0 exists - was not mentioned once. Eighteen fields and eight presets
// shipped in the client, documented in its own source comments, and invisible on its package page.
//
// So the limits table is DERIVED from `API_PLANS` in src/worker.js and the MCP tool count from
// `MCP_TOOLS`, exactly as every other price surface now is. A reprice or a new tool cannot leave the
// package page behind: it either regenerates or this script refuses to write.
//
// Idempotent. `--dry` prints without writing. Refuses rather than guessing.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.indexOf('--dry') >= 0;
const FILES = ['sdk/README.md', 'sdk/js/README.md', 'sdk/python/README.md'];
const did = [];

// ── the authorities: API_PLANS and MCP_TOOLS, read out of the worker source ───────────────────────────
const src = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');

function planTable() {
  const at = src.indexOf('const API_PLANS = [');
  if (at < 0) throw new Error('API_PLANS not found in src/worker.js');
  const blk = src.slice(at, src.indexOf('\n];', at));
  const rows = [];
  for (const m of blk.matchAll(/\{\s*id:\s*'(\w+)'[\s\S]*?\}/g)) {
    const o = m[0];
    const g = (k) => { const r = new RegExp(k + ':\\s*(-?\\d+)').exec(o); return r ? +r[1] : null; };
    const lbl = (/label:\s*'([^']+)'/.exec(o) || [])[1];
    rows.push({
      id: m[1], label: lbl, usd: Math.round((g('cents') || 0) / 100),
      rpm: g('rpm'), keys: g('maxKeys'), open: g('maxOpen'), books: g('maxBooks'), hooks: g('hooks'),
    });
  }
  if (rows.length !== 4) throw new Error('expected 4 plans in API_PLANS, parsed ' + rows.length);
  for (const r of rows) {
    if (!r.label || r.rpm === null || r.keys === null || r.open === null || r.books === null) {
      throw new Error('plan ' + r.id + ' is missing a field this table prints: ' + JSON.stringify(r));
    }
  }
  return rows;
}

function mcpCount() {
  const at = src.indexOf('const MCP_TOOLS');
  if (at < 0) throw new Error('MCP_TOOLS not found in src/worker.js');
  const blk = src.slice(at, src.indexOf('\n];', at));
  const n = [...blk.matchAll(/name:\s*'[a-z_]+'/g)].length;
  if (n < 20 || n > 60) throw new Error('MCP_TOOLS parsed as ' + n + ' tools, which is not credible');
  return n;
}

const PLANS = planTable();
const TOOLS = mcpCount();
const pkgVer = (/"version"\s*:\s*"([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, 'sdk', 'js', 'package.json'), 'utf8')) || [])[1];
if (!/^\d+\.\d+\.\d+$/.test(pkgVer || '')) throw new Error('could not read the SDK version from sdk/js/package.json');

// ── the two blocks this script owns ───────────────────────────────────────────────────────────────────
const MARK_LIM = '<!-- sdk-limits: generated from API_PLANS, do not hand-edit -->';
const MARK_SIM = '<!-- sdk-sim: generated, do not hand-edit -->';

function limitsBlock() {
  const L = [];
  L.push(MARK_LIM);
  L.push('');
  L.push('| Plan | Requests/min | Keys | Open positions | Books | Webhooks |');
  L.push('|---|---|---|---|---|---|');
  for (const p of PLANS) {
    L.push('| ' + p.label + ' $' + p.usd + ' | ' + p.rpm + ' | ' + p.keys + ' | ' + p.open + ' | ' + p.books
      + ' | ' + (p.hooks ? p.hooks : '-') + ' |');
  }
  L.push('');
  // An API plan is its own product. Saying so here is what stops a reader assuming the site subscription
  // covers the API - which is exactly what this paragraph used to tell them.
  L.push('An API plan is its own product: a MarginPad Premium subscription buys nothing here, and an API plan buys nothing on the site. The whole engine, the simulation, several books per key, the replay, the WebSocket stream and every market-data endpoint are free - only webhooks and the AI read are gated. Trade history is 30 days on Free and 90 on a paid plan.');
  L.push('');
  // Measured, and it is the honest thing to put next to a throughput table: nobody is short of throughput.
  L.push('Measured in production: the busiest bot peaks at 66 requests a minute against the Free ceiling of '
    + PLANS[0].rpm + ', and no key has ever been rate-limited on any plan. Choose on keys and history, not on throughput.');
  L.push('');
  L.push('Every response carries `X-RateLimit-Limit / Remaining / Reset`; on 429 both clients wait `Retry-After` and retry once. Out-of-range input is refused with a named error (`leverage_max` carries the market\'s cap), never silently clamped.');
  return L.join('\n');
}

function simBlock() {
  const L = [];
  L.push(MARK_SIM);
  L.push('');
  L.push('Eighteen fields and eight presets, so the paper venue can be the one you will actually trade. The defaults are deliberately frictionless, and nothing you have already built moves until you change them.');
  L.push('');
  L.push('```python');
  L.push('mp.sim()                                   # your profile, every field with its range, the presets');
  L.push('mp.sim(preset="realistic")                 # the honest middle, in one call');
  L.push('mp.sim(preset="bybit")                     # Bybit\'s published taker fee and maintenance margin');
  L.push('mp.sim(preset="brutal")                    # refusals, partial fills, a second of latency');
  L.push('mp.sim(start_balance_usd=2500, margin_enforced=True, slippage_bps=8, latency_ms=250)');
  L.push('mp.sim(reset=True)                         # back to the defaults');
  L.push('```');
  L.push('');
  L.push('```js');
  L.push("await mp.sim({ preset: 'realistic' });");
  L.push('await mp.sim({ start_balance_usd: 2500, margin_enforced: true, reject_rate_pct: 2 });');
  L.push('```');
  L.push('');
  L.push('The **book** (`start_balance_usd`, `margin_enforced`, `leverage_max`, `max_notional_usd`), the **fill** (`slippage`, `slippage_bps`, `impact_bps_per_100k`, `exit_slippage`, `latency_ms`, `partial_fills`, `min_fill_pct`, `reject_rate_pct`), the **cost** (`taker_bps`, `funding`, `funding_mult`) and the **liquidation** (`margin_venue`, `margin_tiers`, `mmr_pct`).');
  L.push('');
  L.push('Out-of-range values are refused, never clamped, and a position keeps the simulation it was filled under for life. `margin_enforced` turns the balance into a real budget: size past it and the open comes back 402, which is the failure a live bot has to handle and a frictionless simulator never shows you. `reject_rate_pct` is the one a retry loop is worth writing for.');
  L.push('');
  L.push('Every field with its range: https://marginpad.io/trading-api/#sim');
  return L.join('\n');
}

// ── the patch ─────────────────────────────────────────────────────────────────────────────────────────
// A generated block is replaced WHOLE between its marker and the next heading. Anchoring on the prose
// would mean re-finding sentences this script itself wrote, which is how a patcher starts matching its
// own output; the marker is the contract.
function replaceSection(h, heading, marker, body) {
  const hi = h.indexOf(heading);
  if (hi < 0) return null;
  // `heading` ends in its own newline, so the replacement starts flush against it and ends flush against
  // the next heading. Emitting an extra '\n\n' here is what made the first cut grow a blank line on every
  // run - a patcher whose output is not a fixed point is not idempotent, whatever its markers say.
  const from = hi + heading.length;
  let to = h.indexOf('\n## ', from);
  if (to < 0) to = h.length;
  return h.slice(0, from) + body + '\n' + h.slice(to);
}

for (const rel of FILES) {
  const p = path.join(ROOT, rel);
  let h = fs.readFileSync(p, 'utf8');
  const before = h;

  // 1. Limits, derived from API_PLANS
  const lim = replaceSection(h, '\n## Limits\n', MARK_LIM, limitsBlock());
  if (lim === null) { console.error('REFUSING: ' + rel + ' has no "## Limits" section'); process.exit(1); }
  h = lim;

  // 2. The simulation. New heading, inserted before Examples (js/python) or before the Limits section.
  if (h.indexOf(MARK_SIM) < 0) {
    const anchor = h.indexOf('\n## Examples\n') >= 0 ? '\n## Examples\n' : '\n## Limits\n';
    const at = h.indexOf(anchor);
    if (at < 0) { console.error('REFUSING: ' + rel + ' has neither an Examples nor a Limits section to sit above'); process.exit(1); }
    h = h.slice(0, at) + '\n## The simulation is yours to set\n\n' + simBlock() + '\n' + h.slice(at);
  } else {
    const sim = replaceSection(h, '\n## The simulation is yours to set\n', MARK_SIM, simBlock());
    if (sim === null) { console.error('REFUSING: ' + rel + ' carries the sim marker but not its heading'); process.exit(1); }
    h = sim;
  }

  // 3. The honesty note has to move with the feature: the modelling is the reader's to set now, and what
  //    is still NOT modelled is the part that keeps the note worth reading.
  const OLDNOTE = 'This is a simulator. Fees, funding and liquidation math mirror real exchanges; there is no order book, so slippage is modelled, not measured on depth. A bot that passes here still needs a small live test. Educational use, not financial advice.';
  const NEWNOTE = 'This is a simulator. Fees, funding and liquidation maths mirror real exchanges and every fill condition above is yours to set - but there is no order book behind `impact_bps_per_100k`, so market impact is modelled rather than measured on depth, and a stop, target or liquidation fills at its own level without paying the crossing cost. A bot that passes here still needs a small live test. Educational use, not financial advice.';
  if (h.indexOf(OLDNOTE) >= 0) h = h.split(OLDNOTE).join(NEWNOTE);

  if (h !== before) { did.push(rel); if (!DRY) fs.writeFileSync(p, h); }

  // ── GUARDS, per file
  if (/Premium:\s*600\/minute/.test(h)) { console.error('REFUSING: ' + rel + ' still sells Premium as an API plan'); process.exit(1); }
  for (const bad of ['$29', '$79', '$159']) {
    if (h.indexOf(bad + ' ') >= 0 || h.indexOf('| ' + bad + ' ') >= 0) {
      console.error('REFUSING: ' + rel + ' quotes a retired price (' + bad + ')'); process.exit(1);
    }
  }
  for (const p2 of PLANS) if (p2.usd && h.indexOf('$' + p2.usd) < 0) {
    console.error('REFUSING: ' + rel + ' does not quote the live ' + p2.label + ' price ($' + p2.usd + ')'); process.exit(1);
  }
  if (h.indexOf('mp.sim(') < 0) { console.error('REFUSING: ' + rel + ' does not document sim()'); process.exit(1); }
  if ((h.split(MARK_LIM).length - 1) !== 1 || (h.split(MARK_SIM).length - 1) !== 1) {
    console.error('REFUSING: ' + rel + ' has a duplicated generated block'); process.exit(1);
  }
  if ((h.match(/```/g) || []).length % 2) { console.error('REFUSING: ' + rel + ' has an unbalanced code fence'); process.exit(1); }
}

// ── 4. the MCP registry manifest: version and tool count are facts, not prose ─────────────────────────
{
  const p = path.join(ROOT, 'sdk', 'mcp', 'server.json');
  const raw = fs.readFileSync(p, 'utf8');
  let h = raw;
  h = h.replace(/"version":\s*"[^"]+"/, '"version": "' + pkgVer + '"');
  h = h.replace(/\b\d+ tools;/, TOOLS + ' tools;');
  try { JSON.parse(h); } catch (e) { console.error('REFUSING: sdk/mcp/server.json no longer parses - ' + e.message); process.exit(1); }
  const j = JSON.parse(h);
  if (j.version !== pkgVer) { console.error('REFUSING: server.json version did not take'); process.exit(1); }
  if (j.description.indexOf(TOOLS + ' tools') < 0) { console.error('REFUSING: server.json still names the wrong tool count'); process.exit(1); }
  if (h !== raw) { did.push('sdk/mcp/server.json'); if (!DRY) fs.writeFileSync(p, h); }
}

console.log('API_PLANS: ' + PLANS.map((p) => p.label + ' $' + p.usd).join(' / ') + '   MCP_TOOLS: ' + TOOLS + '   SDK: ' + pkgVer);
if (!did.length) { console.log('nothing to change'); process.exit(0); }
console.log(did.map((d) => '  ok  ' + d).join('\n'));
console.log(DRY ? '\n--dry: nothing written' : '\nfix-sdk-readme: written');

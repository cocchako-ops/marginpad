// TWO FACTS THAT DRIFT, ON THE TWO PAGES ASSISTANTS ACTUALLY CITE (2026-10-10).
//
// Found while publishing SDK 3.0.0, which is how the MCP tool count came up for inspection at all:
//
//   dist/trading-api/index.html      JSON-LD featureList "Remote MCP server with 28 tools"   -> 29
//   dist/trading-api/index.html      JSON-LD softwareVersion "2.4"                           -> 3.0.0
//   dist/free-crypto-api/index.html  "A remote MCP server is live ... (28 tools)"  x3, one of
//                                    them inside a JSON-LD acceptedAnswer                    -> 29
//
// A number inside JSON-LD is the one a search engine and an assistant quote back without reading the prose
// around it, so a stale count there is worse than a stale sentence. CLAUDE.md has carried "MCP = N tools"
// on its list of facts that drift since 2026-09-14; the llms files were updated on 10-08 and these two
// pages were not, because nothing derived them.
//
// Both numbers now come from the worker's own tables - `MCP_TOOLS` (the server's own list, so the count
// cannot disagree with what /mcp answers) and the newest `API_CHANGELOG` entry - so the next tool or
// release either regenerates these pages or turns this script red.
//
// Idempotent. `--dry` prints without writing. Refuses rather than guessing.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.indexOf('--dry') >= 0;
const src = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');

function mcpCount() {
  const at = src.indexOf('const MCP_TOOLS');
  if (at < 0) { console.error('REFUSING: MCP_TOOLS not found in src/worker.js'); process.exit(1); }
  const blk = src.slice(at, src.indexOf('\n];', at));
  const n = [...blk.matchAll(/name:\s*'[a-z_]+'/g)].length;
  if (n < 20 || n > 60) { console.error('REFUSING: MCP_TOOLS parsed as ' + n + ' tools, which is not credible'); process.exit(1); }
  return n;
}
function apiVersion() {
  const at = src.indexOf('const API_CHANGELOG');
  if (at < 0) { console.error('REFUSING: API_CHANGELOG not found in src/worker.js'); process.exit(1); }
  const m = /version:\s*'(\d+\.\d+(?:\.\d+)?)'/.exec(src.slice(at, at + 2000));
  if (!m) { console.error('REFUSING: cannot read the newest changelog version'); process.exit(1); }
  return m[1];
}

const TOOLS = mcpCount();
const VER = apiVersion();
const did = [];

for (const rel of ['dist/trading-api/index.html', 'dist/free-crypto-api/index.html']) {
  const p = path.join(ROOT, rel);
  let h = fs.readFileSync(p, 'utf8');
  const before = h;

  // The MCP tool count, wherever it is stated as "<n> tools". Anchored on the MCP sentence so an unrelated
  // "19 tools" (the drawing kit, on other pages) can never be rewritten by this.
  h = h.replace(/(MCP server (?:with|is live[^()]*\()\s*)(\d+)(\s*tools)/g, (m, a, n, b) => a + TOOLS + b);
  h = h.replace(/(https:\/\/marginpad\.io\/mcp\s*\()(\d+)(\s*tools\))/g, (m, a, n, b) => a + TOOLS + b);

  // The API version a crawler reads off the structured data, from the changelog that is the real record.
  h = h.replace(/("softwareVersion"\s*:\s*")[^"]*(")/g, (m, a, b) => a + VER + b);

  if (h !== before) { did.push(rel); if (!DRY) fs.writeFileSync(p, h); }

  // ── GUARDS
  const stale = [...h.matchAll(/MCP server (?:with|is live[^()]*\()\s*(\d+)\s*tools/g)].map((m) => +m[1])
    .concat([...h.matchAll(/marginpad\.io\/mcp\s*\((\d+)\s*tools\)/g)].map((m) => +m[1]))
    .filter((n) => n !== TOOLS);
  if (stale.length) { console.error('REFUSING: ' + rel + ' still claims ' + stale.join(',') + ' MCP tools'); process.exit(1); }
  const sv = [...h.matchAll(/"softwareVersion"\s*:\s*"([^"]*)"/g)].map((m) => m[1]).filter((v) => v !== VER);
  if (sv.length) { console.error('REFUSING: ' + rel + ' still declares softwareVersion ' + sv.join(',')); process.exit(1); }
  try { for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]); }
  catch (e) { console.error('REFUSING: ' + rel + ' has a JSON-LD block that no longer parses - ' + e.message); process.exit(1); }
  // This check was RELATIVE for one run, because free-crypto-api carried two unclosed `.ep` cards from long
  // before this script (76 open against 74 closed, identical in HEAD) - the Bot API card and the
  // liquidation-feed card, which the browser silently closed at `</section>` so they nested inside the card
  // that followed them. Both are closed now, so the check is ABSOLUTE again: balance, and never move.
  const tags = (t) => (t.split('<div').length - 1) + ':' + (t.split('</div>').length - 1);
  if (tags(h) !== tags(before)) { console.error('REFUSING: ' + rel + ' div balance changed, ' + tags(before) + ' -> ' + tags(h)); process.exit(1); }
  if ((h.split('<div').length) !== (h.split('</div>').length)) { console.error('REFUSING: ' + rel + ' div tags do not balance'); process.exit(1); }
}

console.log('MCP_TOOLS: ' + TOOLS + '   API version: ' + VER);
if (!did.length) { console.log('nothing to change'); process.exit(0); }
console.log(did.map((d) => '  ok  ' + d).join('\n'));
console.log(DRY ? '\n--dry: nothing written' : '\nfix-api-facts: written');

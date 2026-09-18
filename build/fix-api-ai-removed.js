/* Ask AI is off on the API (2026-09-18, owner). It is a Premium Plus feature of the SITE now - the plan priced
 * for it - and an API key is not a consumer subscription.
 *
 * The risk here is the same one the plan change had: a stale PRICE is a wrong number, but a stale FEATURE CLAIM
 * is a promise. /trading-api/ sold "50 AI market reads a day" as a reason to buy API Pro; leaving that standing
 * would take money for something the endpoint now answers 410 to. Every surface that advertised it is edited,
 * including the plan tables where it was a bullet in what a tier unlocks.
 *
 * Idempotent. Run: node build/fix-api-ai-removed.js [--dry]
 */
const fs = require('fs'), path = require('path');

const SUBS = [
  // /trading-api/ plan cards and the endpoint matrix
  ['<li><b>AI market reads</b> - 50 a day through <code>/v1/ai</code></li>', ''],
  ['<li><b>200</b> AI market reads a day</li>', ''],
  ['<li><b>500</b> AI market reads a day</li>', ''],
  ['<li><b>50</b> AI market reads a day</li>', ''],
  // the llms lines that sold it as part of a tier
  ['webhooks and AI reads', 'webhooks'],
  [' + 50 AI reads/day + report breakdowns', ' + report breakdowns'],
  [' + 200 AI/day', ''],
  [' + 500 AI/day', ''],
  ['50 AI reads/day', ''],
  // the OpenAPI summary - the path itself is removed separately, in the worker
  ["summary: 'AI market read (Premium)'", "summary: 'AI market read (retired 2026-09-18)'"],
];
// A whole table ROW for the endpoint matrix has to go, not just its cells.
const ROW = /<tr><td><b>AI market read<\/b>[\s\S]{0,400}?<\/tr>/g;

const DRY = process.argv.includes('--dry');
const EXT = /\.(html|txt|js|json)$/i;
const SKIPDIR = /^(node_modules|\.git|og-images|ops-shots|vault-shots)$/;
const SKIPFILE = /fix-api-ai-removed\.js$/;
let files = 0, changed = 0; const hits = Object.create(null);

function patch(p) {
  let s; try { s = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
  files++; const before = s;
  for (const [from, to] of SUBS) {
    if (!from || s.indexOf(from) < 0) continue;
    hits[from.slice(0, 44)] = (hits[from.slice(0, 44)] || 0) + s.split(from).length - 1;
    s = s.split(from).join(to);
  }
  if (ROW.test(s)) { ROW.lastIndex = 0; s = s.replace(ROW, () => { hits['<AI market read table row>'] = (hits['<AI market read table row>'] || 0) + 1; return ''; }); }
  ROW.lastIndex = 0;
  if (s === before) return;
  changed++;
  if (DRY) { console.log('  would patch ' + path.relative(process.cwd(), p).replace(/\\/g, '/')); return; }
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(s, 'utf8'));
  fs.renameSync(tmp, p);
}
function walk(d) {
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const f of ents) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!SKIPDIR.test(f.name)) walk(p); continue; }
    if (EXT.test(f.name) && !SKIPFILE.test(f.name)) patch(p);
  }
}
['dist', 'src', 'build'].forEach(walk);
console.log((DRY ? '[dry] ' : '') + 'scanned ' + files + ', changed ' + changed);
for (const k of Object.keys(hits)) console.log('  ' + String(hits[k]).padStart(4) + '  ' + k);

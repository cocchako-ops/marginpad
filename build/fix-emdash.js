/* Replace every em dash with a plain hyphen, site-wide (2026-09-14).
 *
 * Owner: "ajde prodji kroz sajt i izbaci svuda gde ima ovo" ... "svuda je zameni samo sa obicnom -".
 *
 * Measured first: 57,527 occurrences across 1,371 text files - 747 page titles, 234 meta descriptions,
 * the shared bundles, the worker, the app shell, the generators and the Spanish catalog. A plain hyphen
 * is a pure character swap, so nothing can become ungrammatical. That is why it was the safe answer.
 *
 * THE TRAP, and the reason this file is careful: a blind swap through SOURCE CODE changes regex
 * semantics. The first run turned gen-feed's character class from [|<emdash><endash>-] into [|-<endash>-],
 * where "|-<endash>" is now a RANGE covering every character between them. Same family as the $-in-a-
 * replacement trap in CLAUDE.md: a global text edit does not know it is inside code.
 *
 * So a .js / .py / .json file is scanned LINE BY LINE and a line is skipped, and REPORTED, when the em
 * dash sits inside square brackets - which is where a regex character class lives. Markup and text are
 * swapped wholesale. Every changed .js is syntax-checked at the end, and the run fails if one breaks.
 *
 * Run: node build/fix-emdash.js [--dry]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const EXT = /\.(html|js|txt|json|css|xml|md|py)$/i;
const CODE = /\.(js|py)$/i;
const SKIP_DIR = new Set(['node_modules', '.git', '.wrangler', 'fonts', 'og']);
const SKIP_FILE = new Set([__filename]);   // and it never rewrites its own source

const TARGETS = ['dist', 'src/worker.js', 'src/ops', 'app/index.html', 'build', 'collector/src'];

const DASH = String.fromCharCode(0x2014);   // the em dash, built from its code point so this tool cannot eat itself
const ENT = '&' + 'mdash;';     // written this way so this file never contains the entity it replaces

let files = 0, hits = 0, changed = 0, heldBack = 0;
const held = [];
const touchedJs = [];
const byKind = {};

const kindOf = rel => rel.startsWith('dist' + path.sep + 'assets') ? 'shared bundles'
  : rel.startsWith('dist' + path.sep) ? 'pages and data in dist'
    : rel.startsWith('build') ? 'generators'
      : rel.startsWith('src') ? 'worker and ops'
        : rel.startsWith('app') ? 'app shell' : 'other';

/* A line is risky when an em dash sits between [ and ] - a regex character class, where a hyphen
   silently becomes a range. Those are few; they are left alone and printed so they can be read. */
const inCharClass = (line, i) => {
  const open = line.lastIndexOf('[', i);
  if (open < 0) return false;
  // a ] between the bracket and the dash means the dash is NOT inside that bracket. Without this the
  // guard read `tags: ['Derivatives'], summary: '... - a bot'` as a character class and held back real
  // prose: 734 visible strings, including every Academy lesson, survived the first careful pass.
  if (line.slice(open, i).indexOf(']') >= 0) return false;
  const close = line.indexOf(']', i);
  if (close < 0) return false;
  const inner = line.slice(open + 1, close);
  // a real character class here is short and has no quotes or spaces: [|<em><en>-], [^<em>], [<em><en>]
  return inner.length <= 16 && !/["'\s]/.test(inner);
};

function doFile(p) {
  if (!EXT.test(p) || SKIP_FILE.has(p)) return;
  let s;
  try { s = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
  files++;
  const n = (s.split(DASH).length - 1) + (s.split(ENT).length - 1);
  if (!n) return;
  const rel = path.relative(ROOT, p);

  let out;
  if (CODE.test(p)) {
    let skipped = 0;
    out = s.split('\n').map(line => {
      // per OCCURRENCE, not per line: one character class must not hold back the whole line
      if (line.indexOf(DASH) < 0) return line.split(ENT).join('-');
      let out = '', last = 0;
      for (let i = line.indexOf(DASH); i >= 0; i = line.indexOf(DASH, i + 1)) {
        if (inCharClass(line, i)) { skipped++; continue; }
        out += line.slice(last, i) + '-';
        last = i + 1;
      }
      out += line.slice(last);
      // split/join, never a replacement string: a `$` in one is the trap that duplicated 8,608 lines
      return out.split(ENT).join('-');
    }).join('\n');
    if (skipped) { heldBack += skipped; held.push(rel + ' x' + skipped); }
  } else {
    out = s.split(ENT).join('-').split(DASH).join('-');
  }

  if (out === s) return;
  hits += n; changed++;
  byKind[kindOf(rel)] = (byKind[kindOf(rel)] || 0) + n;
  if (!DRY) {
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, out, 'utf8');
    fs.renameSync(tmp, p);
    if (/\.js$/i.test(p)) touchedJs.push(p);
  }
}

function walk(d) {
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p); continue; }
    doFile(p);
  }
}

for (const t of TARGETS) {
  const p = path.join(ROOT, t);
  if (!fs.existsSync(p)) continue;
  if (fs.statSync(p).isDirectory()) walk(p); else doFile(p);
}

console.log('em dash -> hyphen: ' + hits + ' in ' + changed + ' of ' + files + ' text files' + (DRY ? '  [dry run]' : ''));
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log('   ' + String(v).padStart(6) + '  ' + k);
if (heldBack) {
  console.log('\nheld back (an em dash inside a regex character class - swapping it would create a range):');
  held.forEach(x => console.log('   ' + x));
}

/* Every file that was rewritten has to still parse. A blind text edit that breaks a bundle is worse
   than the em dash it removed. */
if (!DRY && touchedJs.length) {
  const bad = [];
  for (const f of touchedJs) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { bad.push(path.relative(ROOT, f) + ': ' + String(e.stderr || e).split('\n').find(l => /Error/.test(l))); }
  }
  console.log('\nsyntax-checked ' + touchedJs.length + ' JavaScript files: ' + (bad.length ? bad.length + ' BROKEN' : 'all parse'));
  bad.forEach(b => console.log('   ' + b));
  if (bad.length) process.exit(1);
}

/* The language switcher offered four languages that do not exist, and hid four that do.

   MEASURED 2026-09-20 from Search Console's "Not found (404)" list: /it/, /pl/, /hi/ and /vi/ are
   404, and all four are options in the <select id="langSel"> on 16 live pages - the English
   homepage, all twelve language homepages, /rewards/ and its Spanish twin. A reader who picks
   Italian gets a 404. Meanwhile zh, ja, ko and ar DO exist and were not offered at all.

   The hand-written option list had simply gone stale. The authoritative list is LANGS in
   build/gen-i18n-pages.js - the same one that decides which homepages are generated and what
   hreflang is emitted - so this script READS it rather than repeating it, and the list can never
   drift from the pages again.

   It only ever rewrites the <option> children; the <select> tag and every attribute on it are left
   byte-for-byte alone. It matches the switcher the way mp-nav itself does -
   '#langSel, select.lang[aria-label="Language"]' - because the Spanish twins carry
   aria-label="Idioma" (gen-pages translates aria-label by design) and matching only the English
   attribute silently skipped all four of them. The id is what makes those pages work, and it is
   also what makes them findable here.

   Run: node build/fix-lang-select.js [--dry]
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DRY = process.argv.includes('--dry');

// the one list, read from the generator that owns it
const gen = fs.readFileSync(path.join(ROOT, 'build', 'gen-i18n-pages.js'), 'utf8');
const m = gen.match(/const LANGS = \[([^\]]*)\]/);
if (!m) { console.error('fix-lang-select: could not read LANGS from gen-i18n-pages.js'); process.exit(1); }
const LANGS = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
if (LANGS.length < 5) { console.error('fix-lang-select: LANGS looks wrong: ' + JSON.stringify(LANGS)); process.exit(1); }

// refuse to offer a language whose homepage is not on disk - that is the bug this fixes
const live = LANGS.filter(l => fs.existsSync(path.join(DIST, l, 'index.html')));
const dead = LANGS.filter(l => !live.includes(l));
if (dead.length) console.log('fix-lang-select: NOTE - in LANGS but no homepage on disk, so left out: ' + dead.join(', '));

const OPTS = ['<option value="/">EN</option>']
  .concat(live.map(l => '<option value="/' + l + '/">' + l.toUpperCase() + '</option>')).join('');

// mirror mp-nav's own selector: '#langSel, select.lang[aria-label="Language"]'
const SEL = /(<select[^>]*(?:id="langSel"|aria-label="Language")[^>]*>)([\s\S]*?)(<\/select>)/g;
const MARK = /<select[^>]*(?:id="langSel"|aria-label="Language")/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let touched = 0, seen = 0, bad = [];
for (const f of walk(DIST, [])) {
  const h = fs.readFileSync(f, 'utf8');
  if (!MARK.test(h)) continue;
  seen++;
  const out = h.replace(SEL, (whole, open, inner, close) => {
    // An EMPTY select is deliberate, not stale: the app shell ships <select id=langSel></select> and
    // mp-nav fills it at runtime from window.__mpLangs. Writing static options there would both fight
    // that code and drift, because dist/app.html is a COPY of app/index.html and the next copy wins.
    if (!/<option/i.test(inner)) return whole;
    // keep a leading placeholder option (the hand-made pages use a hidden selected one)
    const keep = (inner.match(/^\s*<option value=""[^>]*>[\s\S]*?<\/option>/) || [''])[0];
    return open + keep + OPTS + close;
  });
  if (out === h) continue;
  // never write a file whose select came out empty or unbalanced
  const chk = out.match(SEL);
  if (!chk || out.split('<select').length !== h.split('<select').length || !MARK.test(out)) { bad.push(f); continue; }
  touched++;
  if (!DRY) { fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f); }
}

if (bad.length) { console.error('fix-lang-select: REFUSED to write ' + bad.length + ' file(s) - the markup came out wrong: ' + bad.slice(0, 3).join(', ')); process.exit(1); }
console.log('fix-lang-select: ' + (DRY ? 'would update ' : 'updated ') + touched + ' of ' + seen + ' pages carrying the switcher');
console.log('  now offers: EN ' + live.map(l => l.toUpperCase()).join(' '));

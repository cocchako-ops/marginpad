// REPAIR: dictionary values that carry a LITERAL backslash escape.
//
// The English strings are source-level literal bodies, so they hold —, \' and \" as backslash sequences,
// and a translator mirrors those to keep the shapes matching. But the dictionary is written with
// JSON.stringify, which quotes on its own - so a value holding a backslash renders the text "—" to the
// reader instead of an em dash. Interpret every value the way JavaScript would have, once.
//
//   node build/es/i18n-fix-escapes.js [--dry]
//
// Idempotent: a value with no backslash is left exactly as it is.

const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const DRY = process.argv.includes('--dry');

function unescapeJs(s) {
  const SIMPLE = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' };
  return String(s).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, g) => {
    if (g[0] === 'u' && g.length === 5) return String.fromCharCode(parseInt(g.slice(1), 16));
    if (g[0] === 'x' && g.length === 3) return String.fromCharCode(parseInt(g.slice(1), 16));
    return SIMPLE[g] != null ? SIMPLE[g] : g;
  });
}

const targets = [];
for (const f of fs.readdirSync(path.join(DIST, 'assets'))) if (f.endsWith('.js')) targets.push(path.join(DIST, 'assets', f));
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets' && e.name !== 'es') walk(p); }
    else if (e.name.endsWith('.html')) targets.push(p);
  }
})(DIST);

let files = 0, fixed = 0;
for (const f of targets) {
  let s = ''; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  const m = /var (__esD_[a-z0-9]+) = (\{.*?\});\r?\n/s.exec(s);
  if (!m) continue;
  let d; try { d = JSON.parse(m[2]); } catch (e) { console.log('UNPARSEABLE dictionary: ' + f); continue; }
  let n = 0;
  for (const k of Object.keys(d)) {
    if (typeof d[k] !== 'string' || d[k].indexOf('\\') < 0) continue;
    const u = unescapeJs(d[k]);
    if (u !== d[k]) { d[k] = u; n++; }
  }
  if (!n) continue;
  files++; fixed += n;
  console.log(String(n).padStart(4) + '  ' + f.slice(DIST.length + 1));
  if (DRY) continue;
  const out = s.slice(0, m.index) + 'var ' + m[1] + ' = ' + JSON.stringify(d) + ';\n' + s.slice(m.index + m[0].length);
  fs.writeFileSync(f + '.tmp', Buffer.from(out, 'utf8'));
  fs.renameSync(f + '.tmp', f);
}
console.log('\n' + fixed + ' value(s) in ' + files + ' file(s)' + (DRY ? ' (dry run)' : ' repaired'));

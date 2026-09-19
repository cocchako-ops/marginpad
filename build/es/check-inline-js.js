// SYNTAX-CHECK EVERY INLINE <script> ON EVERY HAND-MADE PAGE.
//
// Written 2026-09-19 after routing translations into a page's inline script left /season/ throwing
// "SyntaxError: Unexpected string" in BOTH languages. The apply step runs `node --check` on a .js bundle and
// had nothing equivalent for a page, so a broken page shipped and was only caught by a browser probe reading
// page errors - which is one deploy too late.
//
//   node build/es/check-inline-js.js            every page under dist (skipping /es/ twins - same source)
//   node build/es/check-inline-js.js <path...>  just these
//
// Exits non-zero on the first page that does not parse, naming the script and the offending line.

const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');

const args = process.argv.slice(2);
let files = [];
if (args.length) files = args.map(a => path.resolve(ROOT, a));
else (function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['assets', 'es', 'i18n', 'og', 'img', 'fonts', 'sdk'].includes(e.name)) walk(p); }
    else if (e.name.endsWith('.html')) files.push(p);
  }
})(DIST);

let checked = 0, bad = 0;
for (const f of files) {
  let html = ''; try { html = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m, n = 0;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    if (/type\s*=\s*["'](?!text\/javascript)/i.test(m[1])) continue;   // ld+json, templates
    n++;
    checked++;
    try { new vm.Script(m[2], { filename: f + ' <script#' + n + '>' }); }
    catch (e) {
      bad++;
      const line = (m[2].slice(0, 0).match(/\n/g) || []).length;
      console.log('FAIL ' + f.slice(DIST.length + 1) + '  script#' + n + '  ' + String(e.message).slice(0, 120));
      // show the neighbourhood of the reported line
      const ln = +(String(e.stack || '').match(/<script#\d+>:(\d+)/) || [])[1];
      if (ln) {
        const lines = m[2].split('\n');
        for (let i = Math.max(0, ln - 2); i < Math.min(lines.length, ln + 1); i++)
          console.log('   ' + (i + 1) + ': ' + lines[i].slice(0, 200));
      }
    }
  }
}
console.log('\n' + checked + ' inline script(s) in ' + files.length + ' page(s) · ' + bad + ' broken');
process.exitCode = bad ? 1 : 0;

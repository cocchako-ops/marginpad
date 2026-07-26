/* CI / pre-deploy guard: greps the SAME file list the stamper writes (app/index.html + all dist/**.html — via
   lib-html-files) for /assets/home.(css|js)?v=<hash> and FAILS (exit 1) if more than one distinct hash survives.
   More than one hash means a bump-home-assets run missed a file and some page will load a stale bundle against a
   newer API. Exit 0 when consistent. Sharing the file list with the stamper is deliberate: if they scanned
   different sets, the guard could pass while a file it never looked at drifted. Wired as npm "predeploy".
   Usage: node build/check-home-hash.js */
const fs = require('fs');
const path = require('path');
const { htmlFiles } = require('./lib-html-files');
const ROOT = path.join(__dirname, '..');
const RE = /\/assets\/home\.(?:css|js)\?v=([a-f0-9]+)/g;

const files = htmlFiles(ROOT);
const seen = {}; // hash -> Set(files)
for (const f of files) {
  let h; try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  let m; RE.lastIndex = 0;
  while ((m = RE.exec(h))) { (seen[m[1]] = seen[m[1]] || new Set()).add(path.relative(ROOT, f)); }
}

const hashes = Object.keys(seen);
if (hashes.length === 0) { console.log('check-home-hash: no home-bundle references found (nothing to verify).'); process.exit(0); }
if (hashes.length === 1) { console.log('check-home-hash: OK — one consistent hash (' + hashes[0] + ') across ' + seen[hashes[0]].size + ' file(s).'); process.exit(0); }

console.error('check-home-hash: FAIL — ' + hashes.length + ' different home-bundle hashes (a bump was missed):');
for (const hh of hashes) { const fl = [...seen[hh]]; console.error('  ' + hh + '  -> ' + fl.slice(0, 6).join(', ') + (fl.length > 6 ? '  (+' + (fl.length - 6) + ' more)' : '')); }
console.error('Fix: node build/bump-home-assets.js  (then re-run this check).');
process.exit(1);

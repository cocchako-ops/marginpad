/* PUT THE SPANISH TABLE TAG ON EVERY PAGE ALREADY ON DISK THAT IS SERVED AS SPANISH (2026-10-13).
   gen-pages.js does this for the twins it writes, but it only writes a twin whose ENGLISH source is present -
   and most English dist pages are build output, gitignored, absent from a fresh clone. So a tree can hold a
   perfectly good Spanish page that gen-pages will not touch on this run, and without a tag that page reverts
   to English with nothing on screen to say why. This walks dist/ instead and patches in place.
   Idempotent, write-once-then-print, and it uses the SAME injector gen-pages uses (build/es/lib-es-ui.js).
   An ENGLISH page is never touched: carrying the table is exactly the cost the split removed.

     node build/es/add-es-ui-tags.js --dry     what it would add
     node build/es/add-es-ui-tags.js           add it
   Verify with: node build/es/check-es-ui.js */
'use strict';
const fs = require('fs'), path = require('path');
const { htmlFiles } = require('../lib-html-files');
const { esUiTags, isEsPage, SIDECARS } = require('./lib-es-ui');
const ROOT = path.join(__dirname, '..', '..');
const DRY = process.argv.includes('--dry');

if (!SIDECARS.size) { console.error('add-es-ui-tags: dist/assets/es is empty - run build/es/split-bundle-dicts.js first'); process.exit(1); }

const writes = [], touched = [], problems = [];
let esPages = 0;
for (const f of htmlFiles(ROOT)) {
  let h; try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (h.indexOf('/assets/') < 0 || !isEsPage(h)) continue;
  esPages++;
  const r = esUiTags(h, path.relative(ROOT, f).split(path.sep).join('/'));
  for (const p of r.problems) problems.push(p);
  if (!r.added || r.html === h) continue;
  writes.push([f, r.html]);
  touched.push(path.relative(ROOT, f).split(path.sep).join('/') + '  +' + r.added);
}

// Write every file FIRST, then report: a patch script that prints as it goes reports edits that are not on disk.
if (!DRY) for (const [f, text] of writes) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, Buffer.from(text, 'utf8')); fs.renameSync(tmp, f); }
touched.slice(0, 8).forEach(x => console.log((DRY ? 'would patch  ' : 'patched  ') + x));
if (touched.length > 8) console.log('  ... and ' + (touched.length - 8) + ' more');
problems.slice(0, 10).forEach(x => console.error('  PROBLEM ' + x));
console.log((DRY ? '(dry run - nothing written) ' : '') + touched.length + ' of ' + esPages + ' Spanish page(s) patched'
  + (problems.length ? ', ' + problems.length + ' problem(s)' : ''));
if (problems.length) process.exitCode = 1;

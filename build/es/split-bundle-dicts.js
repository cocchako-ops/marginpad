// MOVE EACH BUNDLE'S SPANISH DICTIONARY OUT OF THE BUNDLE AND INTO A SIDECAR ONLY THE TWINS LOAD.
//
// Written 2026-10-13 against the one cost CLAUDE.md has carried as outstanding since 2026-09-19: the inline
// dictionaries that made the site fully Spanish ship to EVERY reader, English or not. Measured in brotli, the
// dictionaries alone are 35,858 bytes across ten bundles - 8,772 of them in mp-nav + mp-auth, which are on
// every page, and 27,086 more across the per-surface bundles. The audience is Nigeria- and Pakistan-heavy on
// mobile and this site has deliberately measured cold load, so those bytes are worth removing.
//
// WHAT THIS IS NOT: a trim. Every string stays; so does the routing (`__esT_x("key", 'English')`), because the
// English argument IS the fallback and removing it would be the partial translation this whole layer exists to
// end. Only the TABLE moves.
//
// SIDECAR PER BUNDLE, NEVER ONE FILE FOR ALL TEN. A combined es-ui.js measures 34,392 bytes brotli, and an /es/
// SEO page loads exactly two bundles - so one file would have handed Spanish readers 25.6 KB they never use.
// Per bundle, a Spanish reader downloads only the tables for the bundles actually on the page. The existing
// dist/assets/i18n/<lang>.js already sets the precedent for a per-language subdirectory.
//
// IT IS NOT FREE FOR THE SPANISH READER AND THAT IS WORTH SAYING, because brotli compressed a table far better
// inside a 150 KB bundle (shared context) than it can standalone: the same mp-nav table costs 1,179 bytes
// inline and 3,151 as its own file. Measured per page: an English reader saves 1.2 KB on an SEO page, 7.3 KB
// signed in, 12.9 KB on /paper-trade and 21.6 KB on /heatmap; a SPANISH reader pays 2.0 KB, 4.2 KB, 7.6 KB and
// 9.0 KB more. That is the trade - a bounded cost for one language against a measured saving for every reader
// of every page - and it is the right way round for an audience that is Nigeria- and Pakistan-heavy on mobile.
//
// THE TABLE IS READ AT CALL TIME, never captured into a local: the sidecar and the bundle are two files and
// nothing may depend on which parsed first (the window.mpOrders rule).
//
//   node build/es/split-bundle-dicts.js --dry      what it would move, nothing written
//   node build/es/split-bundle-dicts.js            move it (idempotent: already-split bundles are left alone)
//
// Idempotent, and it refuses rather than guessing: a dictionary that does not parse, or a bundle whose helper
// does not look exactly like the one i18n-bundle.js writes, is reported and skipped.

'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const A = path.join(ROOT, 'dist', 'assets');
const ES = path.join(A, 'es');
const DRY = process.argv.includes('--dry');

// The dictionary and the helper, exactly as i18n-bundle.js --apply writes them.
const RE_DICT = /\/\* Spanish for this file[\s\S]*?var (__esD_([a-z0-9]+)) = (\{[\s\S]*?\});\r?\nfunction (__esT_\2)\(k, en\) \{[^\n]*\r?\n/;

// The generated head and the sidecar body are defined ONCE, in lib-es-ui.js - i18n-bundle.js --apply
// writes the same two shapes on every later translation round, and two copies would drift on the first one.
const { headFor, sidecarFor } = require('./lib-es-ui');

const bundles = fs.readdirSync(A).filter(f => f.endsWith('.js')).sort();
const moved = [], skipped = [], already = [];
const writes = [];                                      // every write is queued and flushed at the END

for (const bundle of bundles) {
  const src = fs.readFileSync(path.join(A, bundle), 'utf8');
  const m = RE_DICT.exec(src);
  if (!m) {
    if (src.indexOf('__esD_') >= 0) skipped.push(bundle + ': carries __esD_ but not in the shape i18n-bundle.js writes');
    else if (src.indexOf('window.__esUI') >= 0) {
      // AFTER THE SPLIT THE SIDECAR IS THE ONLY COPY OF THE TABLE. This script cannot rebuild one - the strings
      // are not in the bundle any more - so an absent sidecar is a refusal with somewhere to go, not a shrug.
      // (Learned by deleting dist/assets/es while the bundles were already split: nine tables, gone.)
      if (fs.existsSync(path.join(ES, bundle))) already.push(bundle);
      else skipped.push(bundle + ': already split but dist/assets/es/' + bundle + ' is MISSING - the table lives only'
        + ' there now. Restore it (git checkout -- dist/assets/es/' + bundle + ') or restore the bundle first and re-run.');
    }
    continue;
  }
  const slug = m[2], dictText = m[3];
  let dict; try { dict = JSON.parse(dictText); } catch (e) { skipped.push(bundle + ': dictionary does not parse - refusing'); continue; }
  const keys = Object.keys(dict).length;
  const out = src.slice(0, m.index) + headFor(slug, bundle, keys) + src.slice(m.index + m[0].length);
  if (out.indexOf('__esD_' + slug) >= 0) { skipped.push(bundle + ': __esD_' + slug + ' is still referenced after the move - refusing'); continue; }
  writes.push([path.join(A, bundle), out]);
  writes.push([path.join(ES, bundle), sidecarFor(slug, bundle, dict)]);
  moved.push({ bundle, slug, keys, raw: Buffer.byteLength(m[0]) });
}

// A PATCH SCRIPT PRINTS "ok" AT WRITE TIME, NOT AT SUBSTITUTION TIME (CLAUDE.md, 2026-10-10): write every file
// first, then report. The p1-costs script printed three successful edits that were never on disk.
if (!DRY) {
  fs.mkdirSync(ES, { recursive: true });
  for (const [f, text] of writes) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, Buffer.from(text, 'utf8')); fs.renameSync(tmp, f); }
}
for (const x of moved) console.log((DRY ? 'would move  ' : 'moved  ') + x.bundle + '  ' + x.keys + ' keys, ' + x.raw + ' raw bytes  ->  dist/assets/es/' + x.bundle);
for (const b of already) console.log('already split  ' + b);
for (const s of skipped) console.log('SKIPPED  ' + s);
console.log((DRY ? '(dry run - nothing written) ' : '') + moved.length + ' bundle(s) split, ' + already.length + ' already, ' + skipped.length + ' skipped');
if (skipped.length) process.exitCode = 1;

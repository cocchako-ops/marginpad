/* THE SPANISH TABLES ARE A SEPARATE FILE NOW, AND A PAGE THAT MISSES IT READS AS ENGLISH AND SAYS NOTHING.
   That is the one failure mode of the split (2026-10-13), so it gets a guard that FAILS THE DEPLOY rather than
   a line in a log. Wired as part of npm predeploy, beside check-home-hash.

   Seven things, every one of them a way the table could go missing in silence:
     1  no bundle still carries an inline `var __esD_` table (a later i18n-bundle --apply that forgot the split
        would put the bytes back on every English reader - the exact cost this removed)
     2  every bundle that asks for a table has a sidecar, and the SLUG matches (helper reads window.__esUI.X
        while the sidecar writes window.__esUI.Y is silent English)
     3  every bundle and every sidecar PARSES (new Function, which is a real parse - `node --check` lies, see
        CLAUDE.md 2026-10-10)
     4  every page served as Spanish loads a sidecar for every sidecar-carrying bundle it loads...
     5  ...BEFORE that bundle, and never `defer` in front of a bundle that is not deferred (a deferred sidecar
        would then execute after it)
     6  no ENGLISH page references /assets/es/ at all (the saving, asserted rather than assumed)
     7  every lazy loader in home.js / mp-nav.js pulls the sidecar beside the bundle (__esSide)

   Usage: node build/es/check-es-ui.js [--quiet] */
'use strict';
const fs = require('fs'), path = require('path');
const { htmlFiles } = require('../lib-html-files');
const ROOT = path.join(__dirname, '..', '..');
const A = path.join(ROOT, 'dist', 'assets');
const ES = path.join(A, 'es');
const QUIET = process.argv.includes('--quiet');

const fail = [];
const bad = (m) => fail.push(m);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

// ---- 1-3: the bundles and their sidecars ------------------------------------------------------
const bundles = fs.readdirSync(A).filter(f => f.endsWith('.js'));
const sidecars = fs.existsSync(ES) ? fs.readdirSync(ES).filter(f => f.endsWith('.js')) : [];
const wantsTable = new Set();                                  // bundles that read a Spanish table
let keyTotal = 0;

for (const b of bundles) {
  const src = fs.readFileSync(path.join(A, b), 'utf8');
  try { new Function(src); } catch (e) { bad(b + ' does not parse: ' + e.message); }
  if (/var __esD_[a-z0-9]+ = \{/.test(src)) bad(b + ' still carries an INLINE Spanish table (var __esD_) - run build/es/split-bundle-dicts.js');
  const m = /function __esT_([a-z0-9]+)\(/.exec(src);
  if (!m) continue;
  const slug = m[1];
  wantsTable.add(b);
  if (src.indexOf('window.__esUI && window.__esUI.' + slug) < 0) bad(b + ': __esT_' + slug + ' does not read window.__esUI.' + slug);
  const sf = path.join(ES, b);
  if (!fs.existsSync(sf)) { bad(b + ' reads a Spanish table but dist/assets/es/' + b + ' does not exist'); continue; }
  const side = fs.readFileSync(sf, 'utf8');
  try { new Function(side); } catch (e) { bad('es/' + b + ' does not parse: ' + e.message); continue; }
  if (side.indexOf('window.__esUI.' + slug + ' = ') < 0) bad('es/' + b + ' does not write window.__esUI.' + slug + ' (the bundle reads that slug - a mismatch is silent English)');
  // the table has to be a real object with entries, not an empty husk
  const sm = /window\.__esUI\.[a-z0-9]+ = (\{[\s\S]*\});/.exec(side);
  let n = 0;
  try { n = Object.keys(JSON.parse(sm[1])).length; } catch (e) { bad('es/' + b + ': the table does not parse as JSON'); }
  if (!n) bad('es/' + b + ' has an empty table');
  keyTotal += n;
}
for (const s of sidecars) if (!wantsTable.has(s)) bad('dist/assets/es/' + s + ' has no bundle that reads it');

// ---- 7: the lazy loaders ----------------------------------------------------------------------
// A bundle pulled by script has no tag in any HTML, so nothing in step 4 can see it. The loader itself is the
// only place its sidecar can come from; a new loader that forgets __esSide is a twin silently in English.
for (const owner of ['home.js', 'mp-nav.js']) {
  const src = fs.readFileSync(path.join(A, owner), 'utf8');
  if (src.indexOf('function __esSide(') < 0) { bad(owner + ' loads bundles but has no __esSide helper'); continue; }
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (L.indexOf("createElement('script')") < 0 && L.indexOf('createElement("script")') < 0) continue;
    const hit = /\/assets\/([A-Za-z0-9._-]+\.js)/.exec(L);
    if (!hit || !wantsTable.has(hit[1])) continue;
    if (L.indexOf('__esSide') < 0) bad(owner + ':' + (i + 1) + ' loads ' + hit[1] + ' without __esSide - its Spanish table would never arrive');
  }
}

// ---- 4-6: the pages --------------------------------------------------------------------------
const RE_TAG = /<script\b([^>]*)\bsrc="\/assets\/(es\/)?([A-Za-z0-9._-]+\.js)((?:\?[^"]*)?)"([^>]*)>/g;
let esPages = 0, enPages = 0, tags = 0;
for (const f of htmlFiles(ROOT)) {
  let h; try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (h.indexOf('/assets/') < 0) continue;
  // app-es.html declares lang="es" like the twins; app.html and every English page does not
  const isEs = /<html[^>]*\blang="es"/.test(h);
  const found = [];                                   // {es, file, query, defer, at}
  RE_TAG.lastIndex = 0;
  let m;
  while ((m = RE_TAG.exec(h))) {
    const attrs = (m[1] || '') + ' ' + (m[5] || '');
    found.push({ es: !!m[2], file: m[3], query: m[4] || '', defer: /\bdefer\b/.test(attrs), at: m.index });
  }
  if (!isEs) {
    enPages++;
    for (const t of found) if (t.es) bad(rel(f) + ' is English and loads /assets/es/' + t.file + ' - the Spanish table is shipping to English readers again');
    continue;
  }
  esPages++;
  for (const t of found) {
    if (t.es) { tags++; if (!fs.existsSync(path.join(ES, t.file))) bad(rel(f) + ' loads /assets/es/' + t.file + ' which does not exist'); continue; }
    if (!wantsTable.has(t.file)) continue;
    const side = found.find(x => x.es && x.file === t.file);
    if (!side) { bad(rel(f) + ' loads ' + t.file + ' with no /assets/es/' + t.file + ' - every string in it falls back to English'); continue; }
    if (side.at > t.at) bad(rel(f) + ': /assets/es/' + t.file + ' is loaded AFTER ' + t.file);
    if (side.query !== t.query) bad(rel(f) + ': /assets/es/' + t.file + ' carries ' + (side.query || 'no ?v=') + ' but the bundle carries ' + (t.query || 'no ?v='));
    if (side.defer && !t.defer) bad(rel(f) + ': /assets/es/' + t.file + ' is deferred in front of a bundle that is not - it would execute after it');
  }
}

if (fail.length) {
  console.error('check-es-ui: FAIL - ' + fail.length + ' problem(s):');
  fail.slice(0, 25).forEach(x => console.error('  ' + x));
  if (fail.length > 25) console.error('  (+' + (fail.length - 25) + ' more)');
  console.error('Fix: node build/es/split-bundle-dicts.js && node build/es/gen-pages.js && node build/bump-home-assets.js');
  process.exit(1);
}
if (!QUIET) console.log('check-es-ui: OK - ' + wantsTable.size + ' bundles read a Spanish table, ' + sidecars.length + ' sidecars ('
  + keyTotal + ' keys), ' + tags + ' tags across ' + esPages + ' Spanish pages, 0 of ' + enPages + ' English pages carry one.');

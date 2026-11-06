/* HARVEST WHAT A BROWSER WALK FOUND STILL ENGLISH (2026-11-06). Input: a JSON array of strings (or [{s}]) read off real pages.
   Keeps only what OUR code writes: the string (or, for one with figures, each literal piece of its template) must occur in
   our own sources - dist/assets/*.js, src/worker.js, the hand-made dist pages. News headlines, member names, coin names
   and partner text occur in none of them, so they drop out by construction, not by a list.
     plain text     -> build/data/i18n-scan/walk-<tag>.json {english:[...]}  (then: node build/i18n/ui.js dom --scan)
     with figures   -> build/data/i18n/templates.json {"<English with # for each figure>": {}}  (translated with {1}.. {n})
   node build/i18n/harvest.js <leftovers.json> <tag> [--dry] */
'use strict';
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..', '..');
const NUMRE = /[-+−]?\$?\d[\d.,]*(?:[KMBkmb](?![a-z])|%|x(?![a-z])|×)?/g; // the SAME expression as the runtime (dom-runtime.js.txt)
const tmplOf = (s) => s.replace(NUMRE, '#');
const src = process.argv[2], tag = process.argv[3] || 'walk', dry = process.argv.includes('--dry');
let rows = JSON.parse(fs.readFileSync(src, 'utf8')); rows = rows.map((r) => (typeof r === 'string' ? r : r.s));
// the corpus: everything our code can write
let corpus = '';
for (const f of fs.readdirSync(path.join(R, 'dist/assets'))) if (/\.js$/.test(f) && !/^(ui-|lightweight|sentry)/.test(f)) corpus += fs.readFileSync(path.join(R, 'dist/assets', f), 'utf8') + '\n';
corpus += fs.readFileSync(path.join(R, 'src/worker.js'), 'utf8') + '\n';
(function walk(d, depth) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p);
  if (st.isDirectory()) { if (depth < 2 && !/^(es|pt|de|fr|ru|tr|zh|ja|ko|ar|id|nl|blog|assets|academy)$/.test(f)) walk(p, depth + 1); }
  else if (f === 'index.html') corpus += fs.readFileSync(p, 'utf8') + '\n'; } })(path.join(R, 'dist'), 0);
for (const f of fs.readdirSync(path.join(R, 'build/data'))) { const p = path.join(R, 'build/data', f); if (/\.json$/.test(f) && fs.statSync(p).size < 4e6) corpus += fs.readFileSync(p, 'utf8'); }
const has = (piece) => corpus.indexOf(piece) >= 0 || corpus.indexOf(piece.replace(/'/g, "\\'")) >= 0 || corpus.indexOf(piece.replace(/&/g, '&amp;')) >= 0;
const plain = new Set(), tmpl = new Set(), dropped = [];
for (const s0 of rows) {
  const s = String(s0).replace(/\s+/g, ' ').trim(); if (s.length < 2 || !/[A-Za-z]{2}/.test(s)) continue;
  if (!/\d/.test(s)) { if (has(s)) plain.add(s); else dropped.push(s); continue; }
  const t = tmplOf(s), pieces = t.split('#').map((x) => x.trim()).filter((x) => /[A-Za-z]{3}/.test(x));
  if (!pieces.length) continue;
  if (pieces.every(has)) tmpl.add(t); else dropped.push(s);
}
console.log('rows', rows.length, '| plain (ours)', plain.size, '| templates (ours)', tmpl.size, '| dropped (not in our code)', dropped.length);
if (process.argv.includes('--show')) { console.log('DROPPED sample:', dropped.slice(0, 40).join(' | ')); console.log('TEMPLATES sample:', [...tmpl].slice(0, 40).join(' | ')); }
if (dry) process.exit(0);
fs.mkdirSync(path.join(R, 'build/data/i18n-scan'), { recursive: true });
fs.writeFileSync(path.join(R, 'build/data/i18n-scan', 'walk-' + tag + '.json'), JSON.stringify({ key: 'walk-' + tag, english: [...plain] }, null, 1));
const TF = path.join(R, 'build/data/i18n/templates.json'); let T = {}; try { T = JSON.parse(fs.readFileSync(TF, 'utf8')); } catch (e) {}
let added = 0; for (const t of tmpl) if (!T[t]) { T[t] = {}; added++; }
fs.writeFileSync(TF, JSON.stringify(T, null, 1)); console.log('templates added', added, 'total', Object.keys(T).length);

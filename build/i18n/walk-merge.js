/* Merges build/data/i18n/walk/out-*.json into the one string store (2026-11-06):
     plain    -> strings.json (only the languages still missing - a translation already in the store is never replaced)
                 + dicts.json "dom" (the exact-match DOM table every twin page carries)
     patterns -> build/data/i18n/patterns-walk.json (rows with a gate, read by ui.js build beside build/i18n/patterns.js)
   Only files that pass walk-check are merged. node build/i18n/walk-merge.js */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const D = path.join(__dirname, '..', 'data', 'i18n'), W = path.join(D, 'walk');
const strings = JSON.parse(fs.readFileSync(path.join(D, 'strings.json'), 'utf8')), dicts = JSON.parse(fs.readFileSync(path.join(D, 'dicts.json'), 'utf8'));
dicts.dom = dicts.dom || {};
let rows = []; try { rows = JSON.parse(fs.readFileSync(path.join(D, 'patterns-walk.json'), 'utf8')); } catch (e) {}
const seenRe = new Set(rows.map((r) => r.re)); let plainN = 0, fill = 0, patN = 0, skipped = [];
for (const f of fs.readdirSync(W).filter((x) => /^out-\d+\.json$/.test(x)).sort()) {
  const n = f.match(/\d+/)[0];
  try { execFileSync(process.execPath, [path.join(__dirname, 'walk-check.js'), n], { stdio: 'pipe' }); } catch (e) { skipped.push(f); continue; }
  const j = JSON.parse(fs.readFileSync(path.join(W, f), 'utf8'));
  for (const p of j.plain || []) {
    const en = String(p.en).replace(/\s+/g, ' ').trim(); if (!en) continue;
    strings[en] = strings[en] || {}; if (!dicts.dom[en] && !(dicts.domapp || {})[en]) { dicts.dom[en] = en; plainN++; }
    for (const l of Object.keys(p)) if (l !== 'en' && typeof p[l] === 'string' && p[l].trim() && !strings[en][l]) { strings[en][l] = p[l]; fill++; }
  }
  for (const p of j.patterns || []) { if (seenRe.has(p.re)) { const r = rows.find((x) => x.re === p.re); for (const l of Object.keys(p)) if (!r[l]) r[l] = p[l]; continue; } seenRe.add(p.re); rows.push(p); patN++; }
}
fs.writeFileSync(path.join(D, 'strings.json'), JSON.stringify(strings, null, 0));
fs.writeFileSync(path.join(D, 'dicts.json'), JSON.stringify(dicts, null, 0));
fs.writeFileSync(path.join(D, 'patterns-walk.json'), JSON.stringify(rows, null, 1));
console.log('plain new', plainN, 'translations filled', fill, 'patterns new', patN, 'total patterns', rows.length, skipped.length ? 'SKIPPED (failed check): ' + skipped.join(' ') : '');

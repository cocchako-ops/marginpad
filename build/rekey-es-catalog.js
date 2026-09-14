/* Re-key the Spanish catalog after a text change that touched the English source (2026-09-14).
 *
 * The catalog is keyed by a hash of the ENGLISH string. Swapping every em dash for a hyphen changes
 * 3,414 of those strings, so their old keys would never be looked up again and gen-pages would quietly
 * fall back to English on the next build - the exact failure mode that left 363 Spanish pages with an
 * English description for months.
 *
 * So: recompute each entry's id from its (already hyphenated) `en`, keeping the Spanish. An entry whose
 * id does not move is left exactly as it is.
 *
 * Run AFTER build/fix-emdash.js: node build/rekey-es-catalog.js [--dry]
 */
const fs = require('fs');
const path = require('path');
const { idOf } = require('./es/lib.js');

const P = path.join(__dirname, 'data', 'es', 'catalog.json');
const DRY = process.argv.includes('--dry');

const cat = JSON.parse(fs.readFileSync(P, 'utf8'));
const items = cat.items || {};
const out = {};
let moved = 0, kept = 0, collided = 0;

for (const [id, v] of Object.entries(items)) {
  const en = v && v.en;
  if (typeof en !== 'string' || !en) { out[id] = v; kept++; continue; }
  const want = idOf(en);
  if (want === id) { out[id] = v; kept++; continue; }
  if (out[want]) { collided++; continue; }      // two English strings collapsed onto one after the swap
  out[want] = v;
  moved++;
}

cat.items = out;
cat.meta = Object.assign({}, cat.meta, { rekeyed: new Date().toISOString(), rekeyedFrom: 'em dash -> hyphen' });

if (!DRY) {
  const tmp = P + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cat, null, 0), 'utf8');
  fs.renameSync(tmp, P);
}
console.log('catalog re-keyed: ' + moved + ' entries moved to a new id, ' + kept + ' unchanged, '
  + collided + ' merged into an identical string' + (DRY ? '  [dry run]' : ''));

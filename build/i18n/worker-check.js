/* Validates build/data/<lang>/worker.json against the pt reference shape: every key present and non-empty, every
   {placeholder}, HTML tag, entity and number of the English/pt source kept. node build/i18n/worker-check.js fr */
'use strict';
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..', '..');
const L = process.argv[2]; const ref = JSON.parse(fs.readFileSync(path.join(R, 'build/data/pt/worker.json'), 'utf8'));
let o; try { o = JSON.parse(fs.readFileSync(path.join(R, 'build/data', L, 'worker.json'), 'utf8')); } catch (e) { console.log('cannot read/parse', e.message); process.exit(1); }
const bad = [];
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
const tg = (s) => (String(s).match(/<\/?[a-z][^>]*>/gi) || []).map((t) => t.toLowerCase()).sort().join();
const en = (s) => (String(s).match(/&[a-z]+;|&#\d+;/gi) || []).sort().join();
const nu = (s) => (String(s).replace(/&#?\w+;/g, '').replace(/\{\w+\}/g, '').match(/\d+/g) || []).sort().join();
function cmp(where, a, b, srcEn) { // a = reference value (pt), b = candidate, srcEn = English source when known
  if (a && typeof a === 'object') { for (const k of Object.keys(a)) cmp(where + '.' + k, a[k], (b || {})[k]); return; }
  if (typeof b !== 'string' || !b.trim()) { bad.push(where + ': empty'); return; }
  const s = srcEn != null ? srcEn : a;
  if (ph(s) !== ph(b)) bad.push(where + ': placeholders ' + ph(s) + ' vs ' + ph(b));
  if (tg(s) !== tg(b)) bad.push(where + ': tags');
  if (srcEn != null && nu(s) !== nu(b)) bad.push(where + ': numbers');
}
for (const k of Object.keys(ref)) if (!(k in o)) bad.push('missing field ' + k);
(o.susd || []).length === 3 || bad.push('susd needs 3');
for (const k of Object.keys(ref.ssr)) cmp('ssr.' + k, ref.ssr[k], (o.ssr || {})[k]);
for (const k of Object.keys(ref.tbl)) cmp('tbl.' + k, ref.tbl[k], (o.tbl || {})[k], k);
const pairs = (name) => { const m = new Map((o[name] || []).map((p) => [p[0], p[1]])); for (const [e, t] of ref[name]) cmp(name + ' ' + JSON.stringify(e).slice(0, 40), t, m.get(e), e); };
pairs('mapPairs'); pairs('compPairs');
for (const k of Object.keys(ref.mapFrag)) cmp('mapFrag.' + k, ref.mapFrag[k], (o.mapFrag || {})[k]);
for (const k of Object.keys(ref.compFrag)) cmp('compFrag.' + k, ref.compFrag[k], (o.compFrag || {})[k]);
for (const k of Object.keys(ref.cats)) cmp('cats.' + k, ref.cats[k], (o.cats || {})[k]);
for (const k of Object.keys(ref.ask)) cmp('ask ' + JSON.stringify(k).slice(0, 50), ref.ask[k], (o.ask || {})[k], k);
for (const r of Object.keys(ref.spaMeta)) { const c = (o.spaMeta || {})[r] || {}; cmp('spaMeta' + r + '.title', ref.spaMeta[r].title, c.title); cmp('spaMeta' + r + '.desc', ref.spaMeta[r].desc, c.desc); }
for (const r of Object.keys(ref.h1)) cmp('h1' + r, ref.h1[r], (o.h1 || {})[r]);
(o.months || []).length === 12 || bad.push('months needs 12');
for (const k of Object.keys(ref.misc)) cmp('misc.' + k, ref.misc[k], (o.misc || {})[k]);
console.log(L, bad.length ? bad.length + ' problems' : 'OK'); bad.slice(0, 60).forEach((b) => console.log('  ' + b));
process.exit(bad.length ? 1 : 0);

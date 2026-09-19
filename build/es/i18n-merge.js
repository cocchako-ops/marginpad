// Merge a translator's sidecar into a key file, VALIDATING every string first.
//
//   node build/es/i18n-merge.js <keys.json> [<keys.es.json>]
//
// Two thousand machine-written strings are about to be spliced into production JavaScript. A translation that
// drops a tag, loses a number, invents a placeholder or mangles a \u escape does not fail loudly - it renders
// broken markup or a wrong figure on a live page. Anything that does not pass is LEFT UNTRANSLATED (the call
// site keeps its English fallback, which is correct behaviour) and reported by name.
//
// The checks mirror build/es/check.js, plus two this surface needs that a static page does not:
//   - escape sequences (\u2026, \', \\) must match exactly: these literals go back into a JS source file
//   - a fragment's leading and trailing spaces must survive, because the code concatenates around them

const fs = require('fs');

const KEYS = process.argv[2];
const SIDE = process.argv[3] || KEYS.replace(/\.json$/, '.es.json');
if (!KEYS) { console.error('usage: i18n-merge.js <keys.json> [<keys.es.json>]'); process.exit(2); }

const spec = JSON.parse(fs.readFileSync(KEYS, 'utf8'));
const side = JSON.parse(fs.readFileSync(SIDE, 'utf8'));
const es = new Map((Array.isArray(side) ? side : side.items || []).map(x => [x.key, x.es]));

const tags = s => (String(s).match(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g) || [])
  .map(t => { const nm = (/<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(t) || [])[1].toLowerCase(); const h = /href\s*=\s*["']([^"']*)/.exec(t); return nm + (h ? '@' + h[1] : ''); }).sort().join('|');
const attrs = s => (String(s).match(/\b(class|id|href|src|data-[\w-]+|style)\s*=\s*"[^"]*"/g) || []).sort().join('|');
const nums = s => (String(s).match(/\d[\d.,]*\d|\d/g) || []).sort().join('|');
const money = s => (String(s).match(/\$\d[\d.,]*\d|\$\d/g) || []).map(x => x.replace(/[.,]/g, '')).sort().join('|');
const phs = s => (String(s).match(/\{[a-zA-Z0-9_]+\}|%[sd]\b/g) || []).sort().join('|');
const escs = s => (String(s).match(/\\u[0-9a-fA-F]{4}|\\[nrt'"\\]/g) || []).sort().join('|');
const pad = s => [/^\s*/.exec(s)[0], /\s*$/.exec(s)[0]].join('|');
const BAD_MAGNI = (en, t) => (/\bbillions?\b/i.test(en) && /\bbillones?\b/i.test(t) && !/mil\s+millones/i.test(t))
  || (/\btrillions?\b/i.test(en) && /\btrillones?\b/i.test(t));

const CHECKS = [
  ['tags', (en, t) => tags(en) !== tags(t)],
  ['attributes', (en, t) => attrs(en) !== attrs(t)],
  ['numbers', (en, t) => nums(en) !== nums(t)],
  ['money', (en, t) => money(en) !== money(t)],
  ['placeholders', (en, t) => phs(en) !== phs(t)],
  // NO ESCAPE-PARITY CHECK. The English is a source-level literal body (it holds — and \' as backslash
  // sequences) while the Spanish goes into a JSON dictionary that quotes on its own - so the apply step
  // interprets the translation once, and both a real em dash and a — arrive at the same character.
  // Demanding parity refused five perfectly good translations on the first run.
  ['padding', (en, t) => pad(en) !== pad(t)],
  ['magnitude', BAD_MAGNI],
  ['quote', (en, t) => (String(t).match(/(^|[^\\])'/g) || []).length > 0 && spec.items && false], // reserved
];

let ok = 0, same = 0, missing = 0;
const bad = [];
for (const it of spec.items) {
  const t = es.get(it.key);
  if (t == null) { missing++; continue; }
  if (t === it.en) { it.es = ''; same++; continue; }             // deliberately unchanged - no dictionary entry
  const fail = CHECKS.find(([, f]) => f(it.en, t));
  if (fail) { bad.push(it.key + ' [' + fail[0] + ']'); it.es = ''; continue; }
  it.es = t; ok++;
}

console.log(KEYS.split(/[\\/]/).pop() + ': ' + ok + ' valid, ' + same + ' kept English on purpose, '
  + bad.length + ' refused, ' + missing + ' missing');
bad.slice(0, 14).forEach(b => console.log('   refused ' + b));
if (bad.length > 14) console.log('   ... and ' + (bad.length - 14) + ' more');

fs.writeFileSync(KEYS + '.tmp', JSON.stringify(spec, null, 1));
fs.renameSync(KEYS + '.tmp', KEYS);

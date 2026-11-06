/* Validates a walk translation file build/data/i18n/walk/out-N.json:
   {plain:[{en,es,pt,de}], patterns:[{re,sample,es,pt,de}], outside:[...]}. Every pattern must compile, match its own sample,
   have a literal gate of 6+ characters, and every translation must use exactly the capture groups {1}..{n} the regex has.
   node build/i18n/walk-check.js 3 */
'use strict';
const fs = require('fs'), path = require('path');
const N = process.argv[2], F = path.join(__dirname, '..', 'data', 'i18n', 'walk', 'out-' + N + '.json');
let j; try { j = JSON.parse(fs.readFileSync(F, 'utf8')); } catch (e) { console.log('cannot parse', e.message); process.exit(1); }
const L = ['es', 'pt', 'de'], bad = [];
function gateOf(re) { const lit = String(re).replace(/\\[dDsSwW]/g, '\u0000').replace(/\\(.)/g, '$1').split(/[()\[\]{}*+?|^$.\u0000]/); return lit.reduce((a, x) => (x.length > a.length ? x : a), '').trim(); }
const nums = (s) => (String(s).match(/\d+/g) || []).sort().join();
for (const p of j.plain || []) for (const l of L) { if (typeof p[l] !== 'string' || !p[l].trim()) bad.push('plain empty ' + l + ': ' + p.en); else if (nums(p.en) !== nums(p[l])) bad.push('plain numbers ' + l + ': ' + p.en); }
for (const p of j.patterns || []) {
  let re; try { re = new RegExp(p.re); } catch (e) { bad.push('bad regex: ' + p.re); continue; }
  const g = (new RegExp(p.re + '|').exec('').length) - 1;
  if (gateOf(p.re).length < 6) bad.push('gate too short (' + JSON.stringify(gateOf(p.re)) + '): ' + p.re);
  if (!re.test(p.sample)) bad.push('does not match its sample: ' + p.re + ' / ' + p.sample);
  for (const l of L) { const t = p[l]; if (typeof t !== 'string' || !t.trim()) { bad.push('pattern empty ' + l + ': ' + p.re); continue; }
    const used = (t.match(/\{(\d)\}/g) || []).map((x) => +x[1]); for (let k = 1; k <= g; k++) if (used.indexOf(k) < 0) bad.push('pattern ' + l + ' drops {' + k + '}: ' + p.re); if (used.some((k) => k > g)) bad.push('pattern ' + l + ' uses a group the regex lacks: ' + p.re); }
}
console.log('plain', (j.plain || []).length, 'patterns', (j.patterns || []).length, 'outside', (j.outside || []).length, bad.length ? '| ' + bad.length + ' problems' : '| OK');
bad.slice(0, 50).forEach((b) => console.log('  ' + b)); process.exit(bad.length ? 1 : 0);

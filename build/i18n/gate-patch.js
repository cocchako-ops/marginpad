/* One-shot (2026-11-06): pattern rows carry their own gate (the longest literal run of their English), so a row can be added
   without editing the runtime's GATE regex, and the rows found by the browser walk (build/data/i18n/patterns-walk.json) join the
   hand-written ones in build/i18n/patterns.js. Idempotent. */
'use strict';
const fs = require('fs'), path = require('path');
const RT = path.join(__dirname, 'dom-runtime.js.txt'), UI = path.join(__dirname, 'ui.js');
let rt = fs.readFileSync(RT, 'utf8');
if (rt.indexOf('r[2]&&o.indexOf(r[2])<0') < 0) {
  const a = "return [new RegExp(x[0],'g'),x[1]];}),GATE=";
  if (rt.split(a).length !== 2) throw new Error('runtime RE anchor');
  rt = rt.split(a).join("return [new RegExp(x[0],'g'),x[1],x[2]||''];}),GATE=");
  const b = 'function pat(v){if(!GATE.test(v))return v;var o=v;';
  if (rt.split(b).length !== 2) throw new Error('runtime pat anchor');
  rt = rt.split(b).join('function pat(v){var o=v;');
  const c = '(function(r){o=o.replace(r[0],';
  if (rt.split(c).length !== 2) throw new Error('runtime loop anchor');
  rt = rt.split(c).join('(function(r){if(r[2]&&o.indexOf(r[2])<0)return;o=o.replace(r[0],');
  fs.writeFileSync(RT, rt); console.log('runtime patched');
} else console.log('runtime already patched');
let ui = fs.readFileSync(UI, 'utf8');
const d = "window.__mpDomRe=' + JSON.stringify(require('./patterns.js').map((p) => [p.re, p[l]]))";
if (ui.indexOf(d) >= 0) {
  ui = ui.split(d).join("window.__mpDomRe=' + JSON.stringify(patRows(l))");
  ui = ui.replace('function build() {', "/* every pattern row with its gate: the longest literal run of the English, checked with indexOf before the regex runs */\nfunction gateOf(re) { const lit = String(re).replace(/\\\\[dDsSwW]/g, '\\u0000').replace(/\\\\(.)/g, '$1').split(/[()\\[\\]{}*+?|^$.\\u0000]/); return lit.reduce((a, x) => (x.length > a.length ? x : a), '').trim(); }\nfunction patRows(l) { let walk = []; try { walk = JSON.parse(fs.readFileSync(path.join(DATA, 'patterns-walk.json'), 'utf8')); } catch (e) {} return require('./patterns.js').concat(walk).filter((p) => p[l]).map((p) => [p.re, p[l], gateOf(p.re)]); }\nfunction build() {");
  fs.writeFileSync(UI, ui); console.log('ui.js patched');
} else console.log('ui.js already patched');

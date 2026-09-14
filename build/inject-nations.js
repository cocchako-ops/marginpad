// build/inject-nations.js - inject build/nations.css (the NATIONS frames source) into dist/assets/mp-auth.js as string-concat lines after the mpaCathedral keyframe (idempotent:
// replaces an existing NATIONS block). Write bytes to a tmp file + rename (project rule).
const fs = require('fs'), path = require('path');
const F = 'D:/part1/money-mission/dist/assets/mp-auth.js';
const css = fs.readFileSync(path.join(__dirname, 'nations.css'), 'utf8');
const lines = css.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('/*') && !l.trim().startsWith('an ') && !/^\s*\(/.test(l) && !/^\s*edges,|^\s*keyframe|^\s*the twenty/.test(l)).filter(l => !l.trim().startsWith('/'));
const body = lines.map(l => "    + '" + l.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'").join('\n');
const START = '    /* ===== NATIONS (2026-09-05): 20 country frames, $1.99 - generated from scratchpad nations.css by inject.js ===== */';
const END = '    /* ===== /NATIONS ===== */';
let src = fs.readFileSync(F, 'utf8');
const anchor = "    + '@keyframes mpaCathedral{0%,100%{opacity:.8}50%{opacity:1}}'";
if (src.indexOf(anchor) < 0) throw new Error('anchor missing');
const a = src.indexOf(START), b = src.indexOf(END);
if (a >= 0 && b > a) src = src.slice(0, a) + START + '\n' + body + '\n' + END + src.slice(b + END.length);
else src = src.replace(anchor, anchor + '\n' + START + '\n' + body + '\n' + END);
const tmp = F + '.tmp'; fs.writeFileSync(tmp, Buffer.from(src, 'utf8')); fs.renameSync(tmp, F);
console.log('injected', lines.length, 'css lines');

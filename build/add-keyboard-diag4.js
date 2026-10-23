#!/usr/bin/env node
/* KEYBOARD DIAGNOSTIC v4 (2026-10-24) - replaces the whole v2/v3 block at the tail of mp-auth.js with
   build/keyboard-diag4.block.js (the remedy ladder; the reasoning is in that file's header comment).
   Idempotent: the block carries its own version mark. --dry prints what it would do and writes nothing.
   The block lives in its own file because it carries regex escapes, and a patch string typed into a script
   has lost backslashes twice in this repo (CLAUDE.md: anything with a backslash goes through a file).     */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js');
const BLOCK = fs.readFileSync(path.join(__dirname, 'keyboard-diag4.block.js'), 'utf8');
let h = fs.readFileSync(F, 'utf8');
const START = ['/* KEYBOARD DIAGNOSTIC v4 (2026-10-24)', '/* KEYBOARD DIAGNOSTIC v2 (2026-10-22)'];
const END = '/* CHAT SETTINGS (2026-10-23)';
const s0 = h.indexOf(START[0]);
if (s0 >= 0 && h.indexOf(BLOCK) >= 0) { console.log('add-keyboard-diag4: already applied, nothing to do'); process.exit(0); }
let s = s0 >= 0 ? s0 : h.indexOf(START[1]);
if (s < 0) throw new Error('start anchor not found (neither v4 nor v2 block)');
if (h.indexOf(START[s0 >= 0 ? 0 : 1], s + 1) >= 0) throw new Error('start anchor appears twice');
const e = h.indexOf(END, s);
if (e < 0) throw new Error('end anchor (CHAT SETTINGS) not found after the block');
if ((h.match(/\/\* CHAT SETTINGS \(2026-10-23\)/g) || []).length !== 1) throw new Error('end anchor not unique');
const old = h.slice(s, e);
if (!/\}\)\(\);\s*$/.test(old)) throw new Error('the block to replace does not end with })(); - refusing');
h = h.slice(0, s) + BLOCK + h.slice(e);
if ((h.match(/window\.__mpKbDiag = /g) || []).length !== 1) throw new Error('__mpKbDiag set more than once after the patch');
const rest = h.split(BLOCK).join(''); // the new block's own header NAMES the old labels; the code around it must not
if (rest.indexOf('kbfail2') >= 0 || rest.indexOf('kbok2') >= 0) throw new Error('old labels survived outside the block');
console.log('add-keyboard-diag4: replacing ' + old.length + ' chars (v' + (s0 >= 0 ? '4' : '2/3') + ') with ' + BLOCK.length + ' chars');
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/assets/mp-auth.js\n  NEXT: node --check dist/assets/mp-auth.js && node build/kbdiag4-e2e.js --local && node build/bump-home-assets.js && npm run deploy');

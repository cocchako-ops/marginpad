#!/usr/bin/env node
/* REMOVE THE KEYBOARD DIAGNOSTIC (2026-11-12). The v3/v4 instrument (build/add-keyboard-diag3.js, -4.js) answered its
   question on 2026-10-26 (the owner's dock row read b852 once the body was sized by 100lvh) and then kept writing
   kbany / kbfail3 / kbok3 rows into the jserr ring: of 51 "broken pages" in 48 h on 2026-11-12, about 45 were this
   instrument, and the "12 broken pages danas" alarm was made of them. An instrument is not a feature (the 10-25 rule).
   What STAYS is the one real feature that lived inside the same IIFE: the visualViewport -> body.mpa-kb / --mpa-vvh
   sync that keeps the account sheet above an iOS keyboard (kb-sheet-e2e drives it through window.__mpKbSheet).
   Idempotent, --dry. Refuses rather than guessing if the block's shape has changed. */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js');
let h = fs.readFileSync(F, 'utf8');
const START = '/* KEYBOARD DIAGNOSTIC v4 (2026-10-24)';
const END = '\n/* CHAT SETTINGS (2026-10-23)';
const KEEP_START = '  (function () { var vv = window.visualViewport; if (!vv) return; var raf = 0;';
const KEEP_END = "    window.__mpKbSheet = sync; // the E2E drives it with a faked visual viewport - no emulator raises a keyboard\n  })();\n";
function once(s, needle) { const n = s.split(needle).length - 1; if (n !== 1) throw new Error('"' + needle.slice(0, 50) + '" appears ' + n + ' times'); return s.indexOf(needle); }
if (h.indexOf(START) < 0) {
  if (h.indexOf('/* KEYBOARD SHEET SYNC (kept from the retired keyboard diagnostic') >= 0) { console.log('already applied'); process.exit(0); }
  throw new Error('neither the diagnostic nor its replacement is in mp-auth.js');
}
const a = once(h, START), b = once(h, END);
if (b < a) throw new Error('end before start');
const block = h.slice(a, b);
const ka = once(block, KEEP_START), kb = once(block, KEEP_END) + KEEP_END.length;
const keep = block.slice(ka, kb);
for (const must of ['mpa-kb', '--mpa-vvh', '--mpa-vvt', '__mpKbSheet']) if (keep.indexOf(must) < 0) throw new Error('kept block lost ' + must);
for (const gone of ['kbany', 'kbfail3', 'kbok3', 'kbghost', '__mpKbRows', '__mpKbDiag']) if (keep.indexOf(gone) >= 0) throw new Error('kept block still carries ' + gone);
const repl = '/* KEYBOARD SHEET SYNC (kept from the retired keyboard diagnostic, 2026-11-12). The account sheet is told how much\n' +
  '   screen is really left (see the body.mpa-kb rules): a home-screen app has no URL bar to collapse, so anything over\n' +
  '   120px of lost height is the keyboard and nothing else; one rAF per burst, and only while a panel is open. */\n' +
  '(function () {\n' + keep + '})();\n';
h = h.slice(0, a) + repl + h.slice(b);
for (const gone of ['kbany', 'kbfail3', 'kbok3', 'kbghost', '__mpKbRows', '__mpKbDiag', 'KEYBOARD DIAGNOSTIC']) if (h.indexOf(gone) >= 0) throw new Error('mp-auth.js still carries ' + gone);
if (DRY) { console.log('dry: would remove', block.length, 'chars, keep', keep.length); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('removed', block.length - repl.length, 'chars from mp-auth.js');

#!/usr/bin/env node
/* SL/TP sheet v2 (2026-11-13): replaces the SL/TP edit sheet block in BOTH drawer bundles (home.js + mp-trade.js - the sheet is
   byte-identical in the two but for the i18n helper's name) with build/sltp-sheet-v2.js.txt, and appends the sheet's CSS to
   home.css + mp-trade.css. Idempotent (the v2 marker), --dry prints what it would do, refuses rather than guessing when an anchor
   is not found exactly once. Then: node --check both bundles, bump-home-assets. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DRY = process.argv.includes('--dry');
const TPL = fs.readFileSync(path.join(__dirname, 'sltp-sheet-v2.js.txt'), 'utf8');
const MARK = 'SL/TP sheet v2 (2026-11-13';
const START = ';/* ══════════ SL/TP edit sheet (owner tasks 2026-07';
const END_AT = '  window.mpSltpSheet=show;', END = '\n})();\n';
let changed = 0;
for (const [file, helper] of [['dist/assets/home.js', '__esT_home'], ['dist/assets/mp-trade.js', '__esT_mptrade']]) {
  const p = path.join(ROOT, file); let s = fs.readFileSync(p, 'utf8');
  const a = s.indexOf(START); if (a < 0 || s.indexOf(START, a + 1) >= 0) { console.error(file + ': start anchor not found exactly once'); process.exit(1); }
  const b0 = s.indexOf(END_AT, a); const b = b0 < 0 ? -1 : s.indexOf(END, b0); if (b < 0) { console.error(file + ': end anchor not found'); process.exit(1); }
  const block = TPL.split('__T__').join(helper);
  if (!block.endsWith('})();\n')) { console.error('template does not end the IIFE'); process.exit(1); }
  const out = s.slice(0, a) + block + s.slice(b + END.length); if (out === s) { console.log(file + ': already current'); continue; }
  if (!DRY) fs.writeFileSync(p, out);
  console.log(file + ': sheet replaced (' + (b + END.length - a) + ' -> ' + block.length + ' chars)' + (DRY ? ' [dry]' : ''));
  changed++;
}
const CSS = '\n/* SL/TP sheet v2 (2026-11-13): price + ROE fields, a readout per level, quick chips, the close-% as a labelled button, the dynamic stop */\n'
  + '.mpss .mpcs-card{max-height:calc(100vh - 8px);max-height:calc(100dvh - 8px);overflow-y:auto;overscroll-behavior:contain}\n'
  + '.mpss-row{flex-wrap:wrap}\n'
  + '.mpss-row .r{flex:0 0 86px;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:11px 8px;color:#c2f64a;font-size:15px;font-family:\'Space Mono\',monospace;outline:none;min-width:0;text-align:right}\n'
  + '.mpss-row .r:focus{border-color:#c2f64a}\n'
  + '.mpss-row .pc{flex:0 0 60px;height:44px;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;color:#e9e7df;font:700 12px \'Space Mono\',monospace;cursor:pointer;padding:0}\n'
  + '.mpss-row .pc:hover{border-color:#c2f64a;color:#c2f64a}\n'
  + '.mpss-ro{flex:1 1 100%;min-height:14px;font:10.5px \'Space Mono\',monospace;color:#9aa3ad;margin:-3px 0 1px 2px;letter-spacing:.01em}\n'
  + '.mpss-ro b{font-weight:700}.mpss-ro b.g{color:#34d99a}.mpss-ro b.rd{color:#ff7b72}.mpss-ro i{font-style:normal;color:#6b7684}\n'
  + '.mpss-q{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 8px}.mpss-q>i{font:700 10px \'Space Mono\',monospace;color:#5c656f;font-style:normal;letter-spacing:.06em;margin-right:2px}\n'
  + '.mpss-q button{background:#0c0f13;border:1px solid #2f3742;border-radius:999px;color:#9aa3ad;font:700 10.5px \'Space Mono\',monospace;padding:6px 10px;cursor:pointer;transition:.12s}\n'
  + '.mpss-q button:hover{color:#c2f64a;border-color:#c2f64a}\n'
  + '.mpss-dyn{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n'
  + '.mpss-dyn label{display:block;min-width:0}.mpss-dyn label span{display:block;font:10.5px \'Space Mono\',monospace;color:#9aa3ad;margin-bottom:5px;letter-spacing:.03em}\n'
  + '.mpss-in{display:flex;align-items:center;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:0 10px 0 0}\n'
  + '.mpss-in input{flex:1;min-width:0;background:none;border:0;padding:10px 10px;color:#e9e7df;font-size:15px;font-family:\'Space Mono\',monospace;outline:none}\n'
  + '.mpss-in i{font-style:normal;color:#6b7684;font:700 11px \'Space Mono\',monospace}\n'
  + '.mpss-in:focus-within{border-color:#c2f64a}\n'
  + '.mpss-dynw.off .mpss-dyn{opacity:.45}\n'
  + '.mpss-dynn{min-height:14px;font:10.5px \'Space Mono\',monospace;color:#9aa3ad;margin:6px 0 0 2px}\n'
  + '@media(max-width:380px){.mpss-row .r{flex-basis:76px;font-size:14px}.mpss-row .pc{flex-basis:52px}}\n';
for (const file of ['dist/assets/home.css', 'dist/assets/mp-trade.css']) {
  const p = path.join(ROOT, file); const s = fs.readFileSync(p, 'utf8');
  const m = s.indexOf('\n/* SL/TP sheet v2 (2026-11-13)'); const base = m >= 0 ? s.slice(0, m) : s; if (base + CSS === s) { console.log(file + ': css already current'); continue; }
  if (!DRY) fs.writeFileSync(p, base + CSS);
  console.log(file + ': css appended' + (DRY ? ' [dry]' : '')); changed++;
}
console.log(changed ? 'done' : 'nothing to do');

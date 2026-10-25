/* THE VENUE PICKER IS THE NATIVE CONTROL ON A PHONE (2026-10-25, owner, third report: "jos uvek nisi popravio
 * odabir menjacnice (berze). Onaj padajuci meni za izbor uslova za trejdovanje, sto je po default-u marginpad
 * a moze da se izabere npr. okx ili binance")
 *
 * Two rounds went into WHY our own sheet does not appear in his installed app, and both ended the same way:
 * every engine here renders it correctly (panel fixed 393x508, visible, opacity 1, the backdrop beneath it,
 * elementFromPoint at its own centre answering the sheet header), there is no WebKit here to run, and the
 * memory of the last iOS-only fault says in as many words that a green headless-Chrome probe does not clear an
 * iOS suspicion. A third round of guessing is not a fix, and the control is a MONEY control - it sets the
 * maintenance-margin rate that decides where a position liquidates and the taker fee it pays.
 *
 * So the mechanism goes, rather than the symptom. Our sheet is a reimplementation of a <select>, and it can be
 * defeated by a stacking context, a backdrop, a page lock, a dvh that resolves to nothing, or any ancestor that
 * becomes a containing block for a fixed child. A NATIVE <select> can be defeated by none of those: iOS draws
 * its own wheel above the page entirely. The real control has been sitting under our own the whole time -
 * `.csel-native` - clipped to one pixel with pointer-events off. On a coarse pointer it is simply let through:
 * it covers the trigger at opacity 0, takes the tap, and our `change` listener does exactly what it always did.
 *
 * NARROW ON PURPOSE. Only the four PLAIN pickers (liqEx, crEx, planEx, planFeeVenue - no search, no free
 * entry) fall back. `heatCoin` and `planSym` search a 150-row exchange list and type new symbols, which a
 * native select cannot do, so they keep the custom panel and every rule written for it.
 *
 * WHAT IS LOST, said plainly: on a phone those four rows lose the venue logo and read as their option text,
 * "Name - rate" - which is why CLAUDE.md requires that text to stay exactly that. The desktop keeps the rich
 * picker. A control that cannot be opened is worth less than a plain one that can.
 */
'use strict';
const fs = require('fs');
const DRY = process.argv.indexOf('--dry') >= 0;

const edits = [];
const one = (file, from, to, note) => edits.push({ file, from, to, note });

/* ---------------------------------------------------------------- home.js ---------------------------------- */

one('dist/assets/home.js',
  `  function enhance(sel, withSearch, freeEntry, floating){
    if(!sel||sel._csel)return; sel._csel=true;`,
  `  function enhance(sel, withSearch, freeEntry, floating){
    if(!sel||sel._csel)return; sel._csel=true;
    /* A PLAIN PICKER ON A COARSE POINTER IS THE NATIVE CONTROL (2026-10-25, owner's third report on the venue
       picker). Our sheet is a reimplementation of a <select> and can be defeated by a stacking context, a
       backdrop, a page lock or a dvh that resolves to nothing - none of which can touch the wheel iOS draws
       itself. Only the four plain pickers qualify: a searchable or free-entry one (heatCoin, planSym) cannot
       be a native select at all. The decision is taken ONCE, here, so no later branch has to remember it. */
    var _plain=!withSearch&&!freeEntry;
    var _nat=_plain&&(function(){try{return !!(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches);}catch(e){return false;}})();`,
  'home.js: decide once whether this picker is the native one');

one('dist/assets/home.js',
  `    var wrap=document.createElement('div'); wrap.className='csel';`,
  `    var wrap=document.createElement('div'); wrap.className='csel'+(_nat?' csel-nat':'');`,
  'home.js: the wrapper says so, and the stylesheet does the rest');

one('dist/assets/home.js',
  `    trig.addEventListener('pointerdown',function(e){ if(e.button&&e.button!==0)return; e.preventDefault(); e.stopPropagation(); _tDown=Date.now(); if(panel.hidden){open();}else{close();} });
    trig.addEventListener('click',function(e){ e.stopPropagation(); e.preventDefault(); if(Date.now()-_tDown<700)return; if(panel.hidden){open();}else{close();} });`,
  `    /* THE NATIVE PICKER OPENS NOTHING OF OURS. The select lies over the trigger and takes the tap itself, so
       there is no panel to raise, no backdrop to lay down and no page to lock - which is the whole point: every
       one of those is a thing that can go wrong on an engine we cannot test. */
    trig.addEventListener('pointerdown',function(e){ if(_nat)return; if(e.button&&e.button!==0)return; e.preventDefault(); e.stopPropagation(); _tDown=Date.now(); if(panel.hidden){open();}else{close();} });
    trig.addEventListener('click',function(e){ if(_nat)return; e.stopPropagation(); e.preventDefault(); if(Date.now()-_tDown<700)return; if(panel.hidden){open();}else{close();} });`,
  'home.js: the trigger stands aside for a native picker');

/* ---------------------------------------------------------------- home.css --------------------------------- */

one('dist/assets/home.css',
  `.csel-native{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;opacity:0;pointer-events:none;overflow:hidden;clip:rect(0 0 0 0);}`,
  `.csel-native{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;opacity:0;pointer-events:none;overflow:hidden;clip:rect(0 0 0 0);}
/* THE REAL CONTROL, LET THROUGH ON A PHONE (2026-10-25). It covers the trigger at opacity 0 and takes the tap,
   so iOS draws its own wheel and nothing of ours - no panel, no backdrop, no page lock - can be in the way.
   16px because anything smaller makes iOS zoom the page on focus; the trigger underneath keeps the styling.
   The clip and pointer-events of the rule above are undone deliberately: that rule exists to hide a select we
   are replacing, and here we are not replacing it.
   EVERY GEOMETRY LINE CARRIES !important BECAUSE TWO OF THESE FOUR SELECTS ARE STYLED BY ID: \`#planEx\` sets
   font-size 13px and its own padding and border (and \`#liqEx\` the same), and an id beats two classes - so
   without this the select is a different size and shape from the trigger it has to cover, and lands at 13px,
   which is what makes iOS zoom the page on focus. Measured, not assumed: planFeeVenue read 16px and planEx
   13px from the identical rule. */
@media(pointer:coarse){
  .csel.csel-nat{position:relative}
  .csel-nat .csel-native{position:absolute!important;left:0!important;top:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;
    opacity:0!important;pointer-events:auto!important;clip:auto!important;overflow:visible!important;z-index:3;font-size:16px!important;
    -webkit-appearance:none;appearance:none;border:0!important;border-radius:inherit;background:transparent!important;color:transparent!important}
  .csel-nat .csel-trigger{position:relative;z-index:1}
  .csel-nat .csel-panel{display:none!important}
}`,
  'home.css: the native select covers the trigger on a coarse pointer');

/* ---------------------------------------------------------------- apply ------------------------------------ */

const byFile = {};
for (const e of edits) (byFile[e.file] = byFile[e.file] || []).push(e);
let bad = 0; const out = {};
for (const f of Object.keys(byFile)) {
  let s = fs.readFileSync(f, 'utf8');
  for (const e of byFile[f]) {
    const n = s.split(e.from).length - 1;
    if (n !== 1) { console.log('REFUSING: ' + f + ' holds ' + n + ' of the anchor for "' + e.note + '" (want exactly 1)'); bad++; continue; }
    s = s.split(e.from).join(e.to);
    console.log('  ok  ' + e.note);
  }
  out[f] = s;
}
if (bad) { console.log('\n' + bad + ' anchor(s) missing - nothing written'); process.exit(1); }
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }
for (const f of Object.keys(out)) fs.writeFileSync(f, out[f]);
console.log('\nwritten: ' + Object.keys(out).join(', '));

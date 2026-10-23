#!/usr/bin/env node
/* BITGET IS COMING SOON AMONG THE PAYOUT METHODS (2026-10-24, owner: "Stavi Bitget pod coming soon. Za sad samo
   BingX, Mexc, Bybit i Moon ... nek bude coming soon u poslednjem redu ... moze da se razvuce").

   The four he named are exactly the four live payout methods, so this is the withdraw row and not the sign-up
   hub (which has no Bybit). Three edits, and the third is the one that matters:
     1. the row wraps, so a fifth tile can have a line of its own;
     2. Bitget is `flex:1 0 100%` - alone on the last line and stretched across it, the same height, padding and
        radius as its neighbours so the block still reads as one set;
     3. it leaves WD_METHODS. That table is what wires the click, what `wdM()` resolves and what `setWdMethod`
        shows a note for, so dropping the row is what makes the tile unselectable - a `disabled` attribute alone
        would still leave a live entry that any other code path could select.
   The SERVER is deliberately untouched: `bingx|mexc|bitget:<uid>` all still validate, so a member who already
   saved a Bitget address is never trapped mid-withdrawal, and turning the tile back on is one line here.

   Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'rewards', 'index.html');
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf('id="wdmBitget" disabled') >= 0) { console.log('fix-wd-bitget-soon: already applied'); process.exit(0); }

// 1. the row wraps. THIS FILE IS CRLF, so a multi-line marker built from a bare \n matches nothing in it -
// read the file's own ending once and build every marker from that (the documented trap, hit again here).
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const ROW = '<div style="display:flex;gap:8px;margin:0 0 10px">' + N + '        <button type="button" id="wdmBybit"';
if (h.indexOf(ROW) < 0) throw new Error('the withdraw method row was not found');
if (h.split(ROW).length - 1 !== 1) throw new Error('the withdraw method row is not unique');
h = h.split(ROW).join('<div style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px">' + N + '        <button type="button" id="wdmBybit"');

// 2. Bitget: its own full-width line, the same shape as the others, and plainly not ready
const OLD = h.match(/<button type="button" id="wdmBitget"[\s\S]*?<\/button>/);
if (!OLD) throw new Error('the Bitget button was not found');
const NEW = '<button type="button" id="wdmBitget" disabled aria-disabled="true" title="Bitget payouts are not open yet" style="flex:1 0 100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px dashed var(--line);background:transparent;color:#7f8893;font-weight:700;font-size:13px;cursor:default"><img src="/assets/ex/bitget.png" alt="" width="16" height="16" style="border-radius:4px;opacity:.5">Bitget<span style="font-size:10px;line-height:1;letter-spacing:.07em;font-weight:800;color:#00e7d8;border:1px solid rgba(0,231,216,.38);border-radius:999px;padding:3px 7px">COMING SOON</span></button>';
/* the pill is sized so it cannot make the tile taller than its neighbours: without an explicit line-height a
   10px font inside a 13px row measured 40px against the phone's 36, and the fit above can only set a MINIMUM. */
h = h.replace(OLD[0], NEW);

// 3. out of the table that makes a method selectable
const ROWJS = h.match(/\r?\n? *\{ k: 'bitget', btn: 'wdmBitget',[^\r\n]*\r?\n?/);
if (!ROWJS) throw new Error('the Bitget WD_METHODS row was not found');
// the entry before it ends with a comma only if bitget is not last - keep the array valid either way
let before = h.slice(0, h.indexOf(ROWJS[0])), after = h.slice(h.indexOf(ROWJS[0]) + ROWJS[0].length);
before = before.replace(/,(\s*)$/, '$1');
h = before + N + after;

// the sign-up hub has its own { k: 'bitget', label: 'Bitget' } and is a different table - this guard is about
// the PAYOUT one only, which is what the first draft got wrong and what stopped it before it wrote anything
if (h.indexOf("btn: 'wdmBitget'") >= 0) throw new Error('a Bitget entry survived in WD_METHODS');
if ((h.match(/id="wdmBitget"/g) || []).length !== 1) throw new Error('the Bitget tile is not unique');

/* 4. THE TILE IS AS TALL AS THE ROW ABOVE IT, AND THAT NUMBER IS MEASURED, NOT TYPED (owner: "moze da se
   naprave dimenzije da se lepo uklapa sa ostalima"). Measured first: the live tiles are 50px on a desktop,
   where "Bybit UID" wraps to two lines inside a 326px card, and 36px on a phone, where it does not - so there
   is no single height to hardcode, and a media query would be right at one font size and wrong at the next.
   It reads the tallest sibling instead, on open and on resize. */
const WIRE = "  (function(){ WD_METHODS.forEach(function(x){ var b=document.getElementById(x.btn); if(b)b.addEventListener('click',function(){setWdMethod(x.k);}); }); })();";
if (h.indexOf(WIRE) < 0) throw new Error('the withdraw-method wiring was not found');
h = h.split(WIRE).join(WIRE + N
  + "  /* the coming-soon tile matches the tiles above it: their height depends on whether the label wraps, which"
  + N + "     depends on the viewport, so it is read rather than guessed (2026-10-24). */" + N
  + "  function wdFitSoon(){ var s=document.getElementById('wdmBitget'); if(!s)return; var t=0;"
  + " WD_METHODS.forEach(function(x){ var b=document.getElementById(x.btn); if(b&&b.offsetHeight>t)t=b.offsetHeight; });"
  + " if(t>0)s.style.minHeight=t+'px'; }" + N
  + "  window.addEventListener('resize',function(){ try{wdFitSoon();}catch(e){} });");

const SETM = '    if(wdAddr){wdAddr.classList.remove(\'invalid\');wdAddr.setAttribute(\'inputmode\',cur.mode);wdAddr.placeholder=cur.ph;}';
if (h.indexOf(SETM) < 0) throw new Error('the end of setWdMethod was not found');
h = h.split(SETM).join(SETM + N + "    try{wdFitSoon();}catch(e){}");
/* ...AND ON OPEN, WHICH IS THE CASE THAT ACTUALLY MATTERS: setWdMethod runs on open only for a member who
   already has a saved payout address, so hanging the fit on it alone left every new member's tile at its
   natural height - measured 40px against the row's 50. A hidden row has no height to copy, so the fit has to
   happen after it is shown. */
const OPEN = 'wdAmtFill(); setTimeout(function(){(wdAmt||wdAddr).focus();},30); }';
if (h.indexOf(OPEN) < 0) throw new Error('the withdraw-row open branch was not found');
h = h.split(OPEN).join('wdAmtFill(); try{wdFitSoon();}catch(e){} setTimeout(function(){(wdAmt||wdAddr).focus();},30); }');

/* AND THE PRE-CHECK NAMED THE WRONG VENUE - my own bug from this morning (2026-10-24). The refusal label was a
   two-way ladder, `wdC.k === 'bitget' ? 'Bitget' : 'MEXC'`, written when those were the only two methods with a
   pre-check; adding BingX to it meant a BingX UID we cannot find was refused with "our MEXC link". The method
   already carries its own name - use it, and the next venue is right by construction. */
const LBL = "var wdLbl=wdC.k==='bitget'?'Bitget':'MEXC';";
if (h.indexOf(LBL) >= 0) {
  h = h.split(LBL).join("var wdLbl=(wdC.k||'').toUpperCase()==='BINGX'?'BingX':(wdC.k||'').toUpperCase()==='MEXC'?'MEXC':(wdC.k||'').charAt(0).toUpperCase()+(wdC.k||'').slice(1);");
  console.log('  and the pre-check refusal names the venue it checked, not always MEXC');
}
console.log('fix-wd-bitget-soon: the row wraps, Bitget is a full-width coming-soon tile and is out of WD_METHODS');
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/rewards/index.html\n  NEXT: node build/es/check-inline-js.js && npm run deploy');

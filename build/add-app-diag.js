/* TWO REPORTS ONLY HIS PHONE CAN ANSWER (2026-10-25, owner: "Select exchange na paper trade terminalu u advanced
 * opcijama preko 'aplikacije' ne radi jos uvek" + "Demo spot nav bar je previse podignut na 'aplikaciji'")
 *
 * MEASURED FIRST, in a home-screen app emulation at 393x852 with navigator.standalone forced true:
 *   - the exchange picker OPENS AND WORKS: panel position:fixed, 0,344 393x508 flush to the bottom, visible,
 *     opacity 1, z 2147482999, the backdrop a SIBLING beneath it at 2147482998 inside the same .csel, and
 *     elementFromPoint at the panel's own centre answers the sheet header rather than the backdrop.
 *   - the Demo Spot dock sits FLUSH: 793..852 of an 852 viewport, padding-bottom 4px, and 73px tall with a
 *     34px inset simulated on its padding - still flush.
 * And staleness is ruled out as the explanation: /paper-trade is no-store, /spot/ and every bundle are
 * max-age=0 must-revalidate, and sw.js has been push-only since 2026-10-15.
 *
 * So both faults are WebKit-only and there is no WebKit here to run. The memory of the last one says it
 * outright: "a green headless-Chrome probe does NOT clear an iOS suspicion - the engines differ exactly here."
 * Guessing a third time is the thing not to do. This is the keyboard-diagnostic method instead: ONE measurement
 * from the device that can answer, sent once per session, carrying the numbers that separate every candidate:
 *   dock -> is it flush, how tall, what inset does the phone really report, what does the column reserve
 *   csel -> is the panel laid out at all, how tall, what max-height did dvh resolve to, what is painted at
 *           its own centre, and is the page lock the thing cutting the page off
 * Both live in mp-auth.js, the one bundle on every page, so neither the terminal nor the Spot page is touched.
 */
'use strict';
const fs = require('fs');
const DRY = process.argv.indexOf('--dry') >= 0;

const F = 'dist/assets/mp-auth.js';
const MARK = '__mpAppDiag';

let s = fs.readFileSync(F, 'utf8');
if (s.indexOf(MARK) >= 0) { console.log('add-app-diag: already present - nothing to do'); process.exit(0); }

const BLOCK = `
/* ══════════ APP DIAGNOSTIC (2026-10-25) ══════════
   The owner's installed app disagrees with every emulator on two things, and no engine here can reproduce
   either. One row per session per surface, over the ordinary /api/track beacon, so the answer arrives the
   next time he opens the page instead of after another round of guessing. Delete this block once both are
   settled - it is an instrument, not a feature. */
(function(){
  if(window.__mpAppDiag)return; window.__mpAppDiag=1;
  var sent={};
  function send(tag,label){
    if(sent[tag])return; sent[tag]=1;
    try{fetch('/api/track?t=diag&e='+encodeURIComponent(String(label).slice(0,108))+'&p='+encodeURIComponent(location.pathname),{keepalive:true,cache:'no-store'});}catch(e){}
  }
  // env(safe-area-inset-bottom) cannot be read any other way: an emulator resolves it to 0 and getComputedStyle
  // never reports the env() itself, so a throwaway element whose HEIGHT is the inset is the only honest reading
  function inset(){
    try{var d=document.createElement('div');
      d.style.cssText='position:fixed;left:-9999px;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(d); var h=Math.round(d.getBoundingClientRect().height); d.remove(); return h;
    }catch(e){return -1;}
  }
  function R(e){ if(!e)return null; var r=e.getBoundingClientRect(); return {y:Math.round(r.y),h:Math.round(r.height),b:Math.round(r.bottom),w:Math.round(r.width)}; }
  var N=function(v){return Math.round(parseFloat(v)||0);};

  // ── the Demo Spot dock ─────────────────────────────────────────────────────
  function dock(){
    var d=document.querySelector('.tdock'); if(!d)return false;
    var r=R(d); if(!r||!r.h)return false;
    var cs=getComputedStyle(d), col=document.querySelector('.tcol-left,.tcol-mid,.tcol');
    var vv=(window.visualViewport&&Math.round(window.visualViewport.height))||0;
    send('dock','dock y'+r.y+' h'+r.h+' b'+r.b+' ih'+window.innerHeight+' vv'+vv
      +' pb'+N(cs.paddingBottom)+' ins'+inset()+' col'+(col?N(getComputedStyle(col).paddingBottom):-1)
      +' bp'+N(getComputedStyle(document.body).paddingBottom)+' sa'+(window.navigator.standalone?1:0));
    return true;
  }

  // ── the exchange / fee picker's sheet ──────────────────────────────────────
  function csel(panel){
    var r=R(panel); var cs=getComputedStyle(panel);
    var bd=document.querySelector('.csel-sheet-bd'), br=R(bd);
    var hit=null;
    try{ if(r&&r.w>0&&r.h>0){ var el=document.elementFromPoint(Math.round(r.y>=0?r.w/2:1), Math.round(r.y+Math.min(30,r.h/2)));
      hit=el?String(el.className||el.tagName).replace(/\\s+/g,'.').slice(0,14):'null'; } }catch(e){}
    send('csel','csel y'+(r?r.y:-1)+' h'+(r?r.h:-1)+' w'+(r?r.w:-1)+' d'+cs.display.slice(0,4)
      +' v'+cs.visibility.slice(0,4)+' o'+cs.opacity+' mh'+N(cs.maxHeight)+' p'+cs.position.slice(0,5)
      +' z'+String(cs.zIndex).slice(-4)+' bdh'+(br?br.h:-1)+' hit'+hit
      +' bf'+(getComputedStyle(document.body).position==='fixed'?1:0)+' ih'+window.innerHeight+' ins'+inset());
  }

  function scan(){
    try{ dock(); }catch(e){}
    try{ var p=document.querySelector('.csel-panel.csel-sheet:not([hidden])'); if(p)csel(p); }catch(e){}
  }
  // a sheet is opened by a tap and the dock is built after the page decides who the reader is, so watch rather
  // than sample once - and stop watching as soon as both rows are in, this must cost a reader nothing
  try{
    var mo=new MutationObserver(function(){ scan(); if(sent.dock&&sent.csel)mo.disconnect(); });
    mo.observe(document.documentElement,{subtree:true,attributes:true,childList:true,attributeFilter:['class','hidden','style']});
    setTimeout(scan,2500); setTimeout(scan,6000);
  }catch(e){}
})();
`;

// append at the very end of the bundle - it depends on nothing above it and nothing above it depends on it
s = s.replace(/\s*$/, '\n') + BLOCK;
if (DRY) { console.log('add-app-diag: would append ' + BLOCK.length + ' chars to ' + F); process.exit(0); }
fs.writeFileSync(F + '.tmp', s); fs.renameSync(F + '.tmp', F);
console.log('add-app-diag: appended ' + BLOCK.length + ' chars to ' + F);
console.log('  NEXT: node --check ' + F + ' && node build/bump-home-assets.js && npm run deploy');

/* A DIAGNOSTIC THAT CANNOT HANG THE PAGE (2026-10-25, rewritten the same day it froze the owner's app)
 *
 * WHAT I SHIPPED AND WHAT IT DID. The first cut observed the WHOLE document (subtree + childList + attributes)
 * and, inside its own callback, created a probe element, appended it to <body>, measured it and removed it -
 * to read env(safe-area-inset-bottom), which getComputedStyle never reports. A DOM mutation inside a
 * MutationObserver callback queues that callback again, and MutationObserver callbacks are MICROTASKS, which
 * are drained to exhaustion before the next task or paint. So it was not a slow loop, it was a page that never
 * comes back. Worse, the inset was read while BUILDING the label - before send()'s own "once per session"
 * guard - so the guard could never stop it, and the observer only disconnected when BOTH rows had been sent,
 * which on /spot/ (no picker) never happened.
 * Owner, within the hour: "Freezuje kad se klikne na meni da se selektuje" and "posle load screen-a pojavi se
 * stari demo spot page koji je frozen i celu app frezuje" - that second one is the GATE, still standing
 * because the terminal can never build on a dead main thread.
 *
 * PROVEN, not assumed (scratchpad/freeze-proof.js): injecting the shipped block into a live page makes the
 * injection itself never return and the page stops answering; the identical block with the inset measured ONCE
 * fires three times and answers in 1 ms.
 *
 * THREE SIGNALS I EXPLAINED AWAY AND SHOULD NOT HAVE. Two of my own probe runs died with "Execution context
 * destroyed" / an evaluate timeout right after opening the picker, and spot3-e2e's desktop leg hit a 90 s
 * navigation timeout - I wrote all three off as flakes and even said so out loud. They were the freeze. A
 * probe that dies at the exact moment the feature under test is exercised is evidence, not noise.
 *
 * THE RULES THIS VERSION OBEYS, and any future in-page instrument must obey them too:
 *   1. NO MutationObserver. There is no feedback path at all - two timeouts and one click listener.
 *   2. The DOM is mutated EXACTLY ONCE, at startup, before anything else can call it, and the value is cached.
 *   3. Every entry point checks its "already sent" guard FIRST, before building anything.
 *   4. Everything stops after a fixed deadline whether or not it ever measured anything.
 */
'use strict';
const fs = require('fs');
const DRY = process.argv.indexOf('--dry') >= 0;

const F = 'dist/assets/mp-auth.js';
const MARK = '__mpAppDiag';

let s = fs.readFileSync(F, 'utf8');
if (s.indexOf(MARK) >= 0) { console.log('add-app-diag: already present - nothing to do'); process.exit(0); }

const BLOCK = `
/* ══════════ APP DIAGNOSTIC (2026-10-25, v2) ══════════
   The owner's installed app disagrees with every emulator about two things and no engine here reproduces
   either, so this measures from the device that can answer. v1 of this block FROZE the app: it mutated the
   DOM inside a MutationObserver callback, which re-queues the callback as a microtask and never yields.
   v2 has no observer, touches the DOM exactly once at startup, and stops on a deadline regardless.
   Delete it once both are settled - it is an instrument, not a feature. */
(function(){
  if(window.__mpAppDiag)return; window.__mpAppDiag=1;
  var sent={}, dead=false;
  /* env(safe-area-inset-bottom) cannot be read any other way - getComputedStyle never reports the env() and an
     emulator resolves it to 0 - so ONE throwaway element, measured ONCE, at startup, cached for ever. This is
     the only DOM write in the whole block and nothing can call it again. */
  var INS=-1;
  try{ var d=document.createElement('div');
    d.style.cssText='position:fixed;left:-9999px;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px)';
    (document.body||document.documentElement).appendChild(d);
    INS=Math.round(d.getBoundingClientRect().height); d.parentNode.removeChild(d);
  }catch(e){}

  function send(tag,label){
    if(sent[tag]||dead)return; sent[tag]=1;
    try{fetch('/api/track?t=diag&e='+encodeURIComponent(String(label).slice(0,108))+'&p='+encodeURIComponent(location.pathname),{keepalive:true,cache:'no-store'});}catch(e){}
  }
  function R(e){ if(!e)return null; var r=e.getBoundingClientRect(); return {y:Math.round(r.y),h:Math.round(r.height),b:Math.round(r.bottom),w:Math.round(r.width)}; }
  var N=function(v){return Math.round(parseFloat(v)||0);};

  function dock(){
    if(sent.dock||dead)return;                              // guard FIRST - nothing is built for a row already sent
    var d=document.querySelector('.tdock'); if(!d)return;
    var r=R(d); if(!r||!r.h)return;
    var cs=getComputedStyle(d), col=document.querySelector('.tcol-left,.tcol-mid,.tcol');
    var vv=(window.visualViewport&&Math.round(window.visualViewport.height))||0;
    send('dock','dock y'+r.y+' h'+r.h+' b'+r.b+' ih'+window.innerHeight+' vv'+vv
      +' pb'+N(cs.paddingBottom)+' ins'+INS+' col'+(col?N(getComputedStyle(col).paddingBottom):-1)
      +' bp'+N(getComputedStyle(document.body).paddingBottom)+' sa'+(window.navigator.standalone?1:0));
  }

  function csel(){
    if(sent.csel||dead)return;
    var panel=document.querySelector('.csel-panel.csel-sheet:not([hidden])'); if(!panel)return;
    var r=R(panel), cs=getComputedStyle(panel), br=R(document.querySelector('.csel-sheet-bd')), hit=null;
    try{ if(r&&r.w>0&&r.h>0){ var el=document.elementFromPoint(Math.round(r.w/2),Math.round(r.y+Math.min(30,r.h/2)));
      hit=el?String(el.className||el.tagName).replace(/\\s+/g,'.').slice(0,14):'null'; } }catch(e){}
    send('csel','csel y'+(r?r.y:-1)+' h'+(r?r.h:-1)+' w'+(r?r.w:-1)+' d'+cs.display.slice(0,4)
      +' v'+cs.visibility.slice(0,4)+' o'+cs.opacity+' mh'+N(cs.maxHeight)+' p'+cs.position.slice(0,5)
      +' z'+String(cs.zIndex).slice(-4)+' bdh'+(br?br.h:-1)+' hit'+hit
      +' bf'+(getComputedStyle(document.body).position==='fixed'?1:0)+' ih'+window.innerHeight+' ins'+INS);
  }

  /* the sheet is raised by a tap, so listen for the tap and read on the NEXT FRAME - a listener fires once per
     gesture and a rAF runs once per frame, so there is no path by which either can re-trigger the other */
  try{
    document.addEventListener('click',function(ev){
      if(sent.csel||dead)return;
      var t=ev.target; if(!t||!t.closest||!t.closest('.csel'))return;
      requestAnimationFrame(function(){ setTimeout(csel,160); });
    },true);
  }catch(e){}
  setTimeout(dock,2500); setTimeout(dock,7000);
  setTimeout(function(){ dead=true; },60000);   // stops for good, measured or not
})();
`;

s = s.replace(/\s*$/, '\n') + BLOCK;
if (DRY) { console.log('add-app-diag: would append ' + BLOCK.length + ' chars to ' + F); process.exit(0); }
fs.writeFileSync(F + '.tmp', s); fs.renameSync(F + '.tmp', F);
console.log('add-app-diag v2: appended ' + BLOCK.length + ' chars to ' + F);
console.log('  NEXT: node --check ' + F + ' && node build/app-diag-e2e.js && node build/bump-home-assets.js && npm run deploy');

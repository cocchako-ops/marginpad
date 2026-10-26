#!/usr/bin/env node
/* THE CHAT STAYS ON THE NEWEST MESSAGE WHILE IT IS STUCK THERE, HOWEVER LATE THE ROOM GROWS (2026-10-26, owner, on the
   installed iPhone app: "i dalje me baca negde mnogo poruka iznad kad god udjem ponovo").
   WHY CHROME NEVER SHOWED IT: Chrome has scroll anchoring, so a card hydrating ABOVE the viewport keeps the viewed
   message in place; Safari has none, so every late card pushes the view up by its own height. And the "grow watch"
   that was meant to cover exactly this observed the SCROLL CONTAINER - a ResizeObserver fires on an element's own box,
   never on its scrollHeight, so a fixed-height list never fired it - and it was disconnected after 12 s anyway, while a
   cold start of the app can take longer than that to deliver the history and hydrate 30 cards.
   Now: the observer watches every ROW (each one added as it lands), it lives as long as the box is open, and the ONE
   rule is: while the reader is stuck to the bottom (ctStick), any growth re-pins; the moment they scroll up, nothing
   touches the view. Patched into home.js AND mp-trade.js - the chat is byte-identical in both. Idempotent, --dry. */
'use strict';
const fs = require('fs');
const DRY = process.argv.indexOf('--dry') >= 0;
const FILES = ['dist/assets/home.js', 'dist/assets/mp-trade.js'];
const OLD = "  function ctGrowWatch(){ if(!msgs||!window.ResizeObserver)return; if(_ctGrowRO){try{_ctGrowRO.disconnect();}catch(e){}}\n    var h0=msgs.scrollHeight;\n    _ctGrowRO=new ResizeObserver(function(){ if(!ctStick||!msgs||box.hidden)return; if(msgs.scrollHeight===h0)return; h0=msgs.scrollHeight; msgs.scrollTop=msgs.scrollHeight; });\n    try{_ctGrowRO.observe(msgs);}catch(e){}\n    setTimeout(function(){ if(_ctGrowRO){try{_ctGrowRO.disconnect();}catch(e){}_ctGrowRO=null;} },12000); }";
const NEW = "  /* STUCK TO THE BOTTOM MEANS STUCK (2026-10-26): the observer watches every ROW, not the list box (a ResizeObserver never fires on scrollHeight), lives while the box is open, and re-pins on any growth while ctStick - Safari has no scroll anchoring, so a card hydrating above the view pushed it up by its own height on every cold start of the installed app */\n  var _ctGrowMO=null;\n  function ctGrowWatch(){ if(!msgs||!window.ResizeObserver)return; if(_ctGrowRO){try{_ctGrowRO.disconnect();}catch(e){}} if(_ctGrowMO){try{_ctGrowMO.disconnect();}catch(e){}_ctGrowMO=null;}\n    var h0=msgs.scrollHeight;\n    _ctGrowRO=new ResizeObserver(function(){ if(!ctStick||!msgs||box.hidden)return; if(msgs.scrollHeight===h0)return; h0=msgs.scrollHeight; msgs.scrollTop=msgs.scrollHeight; });\n    var watch=function(el){ try{ if(el&&el.nodeType===1)_ctGrowRO.observe(el); }catch(e){} };\n    try{ Array.prototype.forEach.call(msgs.children,watch); }catch(e){}\n    try{ _ctGrowMO=new MutationObserver(function(ml){ for(var i=0;i<ml.length;i++){ var a=ml[i].addedNodes; for(var j=0;j<a.length;j++)watch(a[j]); } }); _ctGrowMO.observe(msgs,{childList:true}); }catch(e){} }";
let done = 0;
for (const f of FILES) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.indexOf('STUCK TO THE BOTTOM MEANS STUCK') >= 0) { console.log(f + ': already applied'); continue; }
  const n = s.split(OLD).length - 1;
  if (n !== 1) throw new Error(f + ': expected the grow watch exactly once, found ' + n);
  s = s.split(OLD).join(NEW);
  if (!DRY) { fs.writeFileSync(f + '.tmp', s); fs.renameSync(f + '.tmp', f); }
  console.log(f + ': grow watch rewritten (rows observed, permanent while open)'); done++;
}
console.log(DRY ? '--dry: nothing written' : (done ? 'NEXT: node --check copies, node build/bump-home-assets.js, npm run deploy, node build/chat-bottom-e2e.js' : 'nothing to do'));

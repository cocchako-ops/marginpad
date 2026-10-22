#!/usr/bin/env node
/* MP TAPE EVENT MODE (2026-10-23, owner: "ajde za ovaj mp tape da ga pretvorimo u event calendar da kaze npr. za
   pola sata pocinje to i to. To samo da bude pred event inace nek bude obican mp tape kao i inace").

   Both strips on the bento homepage - the desktop price tape at the top (`#tape`) and the phone's MP·TAPE row
   under the header (`#mpqMT`) - stop scrolling and read ONE static line while a scheduled event is close:
   "IN 28 MIN · FOMC rate decision · 20:00". The window is sixty minutes before to fifteen after, impact 2 or 3,
   never an all-day entry (no time to count down to). Outside it the marquee is exactly what it was.

   One source: the same `/api/calendar?year=` the calendar tile already fetches - the promise is memoised on
   `window.__mpCalP` and the tile reads it too, so the page makes ONE request, not two. The mode is re-decided
   every 30 s; `window.__mpTapeEv.tick(nowMs)` lets a test move the clock. Leaving the mode restores the desktop
   tape from `window.__tapeLast` (the newest content buildTape produced, which the marquee rule says may only be
   swapped at the seam - here the seam is irrelevant because the animation restarts from zero) and the phone
   track from the markup saved on entry, which `draw()` refills on its next 1.5 s pass.

   Idempotent, --dry. Then: gen-home-live -> add-og-image -> gen-feed -> bump-home-assets -> deploy.          */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'demo-home', 'index.html');
let h = fs.readFileSync(F, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const done = [];
function one(name, a, b, skipIf) {
  if (skipIf && h.indexOf(skipIf) >= 0) return;
  // the file may carry mixed endings around earlier patches - try the anchor in both
  for (const [A, B] of [[a, b], [a.split('\n').join('\r\n'), b.split('\n').join('\r\n')]]) {
    const n = h.split(A).length - 1;
    if (n === 1) { h = h.split(A).join(B); done.push(name); return; }
    if (n > 1) throw new Error(name + ': anchor appears ' + n + ' times');
  }
  throw new Error(name + ': anchor not found');
}

/* 1. desktop CSS, right after the tape keyframes */
one('desktop event CSS',
  '  @keyframes tape{from{transform:translateX(0)}to{transform:translateX(-50%)}}\n',
  '  @keyframes tape{from{transform:translateX(0)}to{transform:translateX(-50%)}}\n'
  + '  /* MP TAPE EVENT MODE (2026-10-23) - see build/add-tape-event.js: a static line while an event is close */\n'
  + '  .tape.ev{-webkit-mask-image:none;mask-image:none;background:rgba(255,215,90,.06);border-bottom-color:rgba(255,215,90,.35)}\n'
  + '  .tape.ev .tape-in{animation:none!important;padding:8px 16px;transform:none!important}\n'
  + "  .tape-ev{display:inline-flex;align-items:center;gap:9px;font:700 12.5px/1.4 'Space Mono',monospace;letter-spacing:.06em;color:#ffd75a;white-space:nowrap}\n"
  + '  .tape-ev i{width:7px;height:7px;border-radius:50%;background:#ffd75a;box-shadow:0 0 10px rgba(255,215,90,.9);flex:none}\n'
  + '  .tape-ev b{color:#e9e7df;font-weight:700}\n'
  + '  .tape-ev a{color:#8fa3c4;text-decoration:none;font-weight:400;margin-left:4px}.tape-ev a:hover{color:#e9e7df}\n',
  '.tape.ev{');

/* 2. phone CSS, inside the strip's own media block */
one('phone event CSS',
  "  .mpqm-trk b{color:#e9e7df;font-weight:700}.mpqm-trk .up{color:#2ebd85}.mpqm-trk .dn{color:#ff6258}.mpqm-trk .sym{color:#8fa3c4}\n",
  "  .mpqm-trk b{color:#e9e7df;font-weight:700}.mpqm-trk .up{color:#2ebd85}.mpqm-trk .dn{color:#ff6258}.mpqm-trk .sym{color:#8fa3c4}\n"
  + '  .mpqm.ev{cursor:pointer;background:#0d0b05;border-bottom-color:rgba(255,215,90,.35)}\n'
  + '  .mpqm.ev .mpqm-cap{color:#ffd75a}.mpqm.ev .mpqm-cap s{background:#ffd75a}\n'
  + '  .mpqm.ev .mpqm-trk{animation:none!important;transform:none!important;display:block;padding-left:10px;overflow:hidden;text-overflow:ellipsis;max-width:100%}\n'
  + '  .mpqm.ev .tape-ev{font-size:10.5px;gap:6px;letter-spacing:.04em}.mpqm.ev .tape-ev i{width:6px;height:6px}.mpqm.ev .tape-ev a{display:none}\n',
  '.mpqm.ev{');

/* 3. buildTape keeps its newest content where the event mode can restore it from */
one('buildTape publishes its newest content',
  '    tapeNext = html + html;\n',
  '    tapeNext = html + html; window.__tapeLast = tapeNext; // the event mode restores the marquee from this (build/add-tape-event.js)\n',
  'window.__tapeLast = tapeNext;');

/* 4. the calendar tile shares its fetch */
one('the calendar tile shares its fetch',
  "    fetch('/api/calendar?year='+Y).then(function(r){return r.json();}).then(function(d){\n      var ev=((d&&d.events)||[]).filter(function(e){var x=new Date(e.ts);return x.getFullYear()===Y&&x.getMonth()===M;});",
  "    (window.__mpCalP||(window.__mpCalP=fetch('/api/calendar?year='+Y).then(function(r){return r.json();}))).then(function(d){ /* one calendar request per page - the tape's event mode reads the same promise */\n      var ev=((d&&d.events)||[]).filter(function(e){var x=new Date(e.ts);return x.getFullYear()===Y&&x.getMonth()===M;});",
  'window.__mpCalP||(window.__mpCalP=');

/* 5. the mode itself, its own script after the strips are built */
const SCRIPT = [
  '<script>',
  '/* MP TAPE EVENT MODE (2026-10-23, owner: "za pola sata pocinje to i to ... samo pred event, inace obican mp tape") - see',
  '   build/add-tape-event.js. Sixty minutes before to fifteen after a timed event of impact 2+, both strips read one static',
  '   line; outside that window nothing here touches them. */',
  '(function(){try{',
  '  var WIN_BEFORE=60*60000, WIN_AFTER=15*60000, MIN_IMPACT=2;',
  '  var T=function(k,en){try{return __esT_demohomeindex(k,en);}catch(e){return en;}};',
  '  var list=null, ev=null, mode=false, saved={};',
  '  function pick(ls,now){ var best=null;',
  '    (ls||[]).forEach(function(e){ if(!e||e.allday||!(e.impact>=MIN_IMPACT)||!(e.ts>0))return; var d=e.ts-now; if(d>WIN_BEFORE||d<-WIN_AFTER)return;',
  '      if(!best){best=e;return;} var bd=best.ts-now;',
  '      if(d>=0&&(bd<0||d<bd))best=e;            // the nearest upcoming one wins',
  '      else if(d<0&&bd<0&&d>bd)best=e;          // only among already-started ones: the most recent',
  '    });',
  '    return best; }',
  "  function esc(s){return String(s==null?'':s).replace(/[<>&\"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','\"':'&quot;'}[c];});}",
  "  function when(e){try{return new Date(e.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch(x){return '';}}",
  "  function lead(e,now){ var m=Math.round((e.ts-now)/60000); if(m>1)return T('tapeEvIn','IN {n} MIN').replace('{n}',m); if(m>=0)return T('tapeEvStarting','STARTING'); return T('tapeEvNow','NOW'); }",
  "  function line(e,now){ return '<span class=\"tape-ev\"><i></i><span class=\"tape-ev-l\">'+esc(lead(e,now))+'</span><span class=\"tape-ev-s\">&middot;</span><b>'+esc(e.title)+'</b><span class=\"tape-ev-s\">&middot;</span>'+esc(when(e))+'<a href=\"/calendar/\">'+esc(T('tapeEvCal','calendar'))+'</a></span>'; }",
  "  function go(){location.href='/calendar/';}",
  '  function paint(now){',
  "    var tp=document.getElementById('tape'), tw=tp&&tp.closest('.tape');",
  "    var mt=document.getElementById('mpqMT'), ms=mt&&mt.closest('.mpqm'), mc=ms&&ms.querySelector('.mpqm-cap');",
  '    if(ev){ var h=line(ev,now);',
  "      if(tp&&tw){ if(!mode)saved.tp=tp.innerHTML; tw.classList.add('ev'); if(tp.getAttribute('data-ev')!==h){tp.innerHTML=h;tp.setAttribute('data-ev',h);} }",
  "      if(mt&&ms){ if(!mode){saved.mt=mt.innerHTML;saved.mc=mc?mc.innerHTML:'';ms.addEventListener('click',go);} ms.classList.add('ev'); if(mc)mc.innerHTML=esc(T('tapeEvCap','EVENT'))+'<s></s>'; if(mt.getAttribute('data-ev')!==h){mt.innerHTML=h;mt.setAttribute('data-ev',h);} }",
  '      mode=true;',
  '    } else if(mode){',
  "      if(tp&&tw){ tw.classList.remove('ev'); tp.removeAttribute('data-ev'); tp.innerHTML=window.__tapeLast||saved.tp||''; }",
  "      if(mt&&ms){ ms.classList.remove('ev'); mt.removeAttribute('data-ev'); mt.innerHTML=saved.mt||''; if(mc&&saved.mc)mc.innerHTML=saved.mc; ms.removeEventListener('click',go); }",
  '      mode=false;',
  '    }',
  '  }',
  '  function tick(now){ now=now||Date.now(); ev=pick(list,now); paint(now); return {mode:mode,ev:ev}; }',
  '  var Y=new Date().getFullYear();',
  "  (window.__mpCalP||(window.__mpCalP=fetch('/api/calendar?year='+Y).then(function(r){return r.json();}))).then(function(d){ list=(d&&d.events)||[]; tick(); setInterval(function(){tick();},30000); }).catch(function(){});",
  '  window.__mpTapeEv={tick:tick,pick:pick,state:function(){return {mode:mode,ev:ev,n:(list||[]).length};}};',
  '}catch(e){}})();',
  '</script>',
  '',
].join('\n');
one('the event mode script',
  '    seed(); setInterval(draw,1500); setInterval(seed,90000);\n  }\n}catch(e){}})();\n</script>\n',
  '    seed(); setInterval(draw,1500); setInterval(seed,90000);\n  }\n}catch(e){}})();\n</script>\n' + SCRIPT,
  'window.__mpTapeEv={');

if (!done.length) { console.log('add-tape-event: nothing to do'); process.exit(0); }
if ((h.match(/window\.__mpTapeEv=\{/g) || []).length !== 1) throw new Error('the mode is not defined exactly once');
if ((h.match(/window\.__mpCalP\|\|\(window\.__mpCalP=/g) || []).length !== 2) throw new Error('the shared calendar promise should have exactly two readers');
console.log('add-tape-event: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/demo-home/index.html');
console.log('  NEXT: node build/gen-home-live.js && node build/add-og-image.js && node build/gen-feed.js && node build/bump-home-assets.js && npm run deploy');

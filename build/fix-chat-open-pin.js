#!/usr/bin/env node
/* THE CHAT OPENS ON THE NEWEST MESSAGE, AND THE SETTINGS OUTLIVE THE SESSION (2026-10-24, owner: "popravi da chat
   kad se otvori uvek bude fokusiran na poslednju poruku poslatu, a ne da mi stalno kad otvorim gurne na sredinu
   chat-a" + "settings za chat ako se jednom postave ne sme da se vraca na staro").

   WHY THE MIDDLE, measured: the history frame pins to the bottom, but a shared trade arrives as a one-line LINK
   and `mpTradeCard.hydrate` replaces it with a ~150px card inside a `load(id).then(...)` - seven of those on a
   busy room. Each one grows the stream ABOVE the viewport, so a position that was the bottom becomes the middle.
   There IS a pin observer, and it only fires while `ctStick` holds - one touch-jiggle, or the ?m= jump from a
   mention notification, clears that flag for the rest of the page. And a REOPEN gets no history frame at all
   (the socket is already connected), so nothing re-pinned it.
   So the open path now pins explicitly and keeps pinning across the frames in which those cards land, and stops
   the moment the reader scrolls up themselves - which is the one case where moving the view would be rude.

   WHY THE SETTINGS REVERTED: the gear is inserted by a poll that gave up after 40 tries (20 s), and the chat is
   LAZY on most pages - open it a minute into reading and the gear was never inserted, so `apply()` never ran and
   the stored text size was never put back on the box. The preference was in localStorage the whole time; what was
   missing was anyone applying it. It is an observer now, so it cannot time out.

   Both chat copies are byte-identical here, which is why this is a patcher and not two hand edits. Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const A = path.join(__dirname, '..', 'dist', 'assets');
let wrote = 0;

/* ---- 1. the two chat bundles: pin on open ---- */
const OPEN_OLD = "function openBox(){chatAlert(false);markChatSeen();box.hidden=false;fab.hidden=true;setTimeout(function(){try{ctJump();}catch(e){}},80);";
const OPEN_NEW = "function openBox(){chatAlert(false);markChatSeen();box.hidden=false;fab.hidden=true;ctOpenPin();setTimeout(function(){try{ctJump();}catch(e){}},80);";
/* THE SETTLE LOOP: a trade card lands whenever its fetch lands, so one rAF is not enough and a single late
   timeout is a guess. It re-pins on a short ladder and gives up the moment the reader has scrolled away - and
   ctJump() (a mention link) deliberately cancels it, because that reader asked for a different message. */
const PIN_FN = "function ctOpenPin(){if(!msgs)return;ctStick=true;ctPill(0);ctPinT.forEach(function(t){clearTimeout(t);});ctPinT=[];"
  + "[0,60,160,360,700,1200,2000].forEach(function(ms){ctPinT.push(setTimeout(function(){"
  + "if(!ctStick||!msgs||box.hidden)return;msgs.scrollTop=msgs.scrollHeight;},ms));});}"
  + "function ctOpenPinStop(){ctPinT.forEach(function(t){clearTimeout(t);});ctPinT=[];}";
const PIN_ANCHOR = "function ctPin(){ if(ctStick&&msgs) msgs.scrollTop=msgs.scrollHeight; }";

for (const f of ['home.js', 'mp-trade.js']) {
  const p = path.join(A, f);
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('ctOpenPin') >= 0) { console.log('  ' + f + ': already applied'); continue; }
  if ((s.split(OPEN_OLD).length - 1) !== 1) throw new Error(f + ': openBox anchor is not unique');
  if ((s.split(PIN_ANCHOR).length - 1) !== 1) throw new Error(f + ': ctPin anchor is not unique');
  s = s.split(OPEN_OLD).join(OPEN_NEW);
  s = s.split(PIN_ANCHOR).join('var ctPinT=[];' + PIN_FN + PIN_ANCHOR);
  // a reader who scrolls up owns the view: the existing scroll handler already clears ctStick, and the ladder
  // reads that flag on every rung - but cancel the pending rungs too so nothing fights their thumb
  const SCROLL_OLD = "if(msgs)msgs.addEventListener('scroll',function(){if(ctBottom()){ctStick=true;if(ctNew)ctPill(0);}else ctStick=false;});";
  const SCROLL_NEW = "if(msgs)msgs.addEventListener('scroll',function(){if(ctBottom()){ctStick=true;if(ctNew)ctPill(0);}else{ctStick=false;ctOpenPinStop();}});";
  if ((s.split(SCROLL_OLD).length - 1) !== 1) throw new Error(f + ': scroll handler anchor is not unique');
  s = s.split(SCROLL_OLD).join(SCROLL_NEW);
  // the mention jump is the one move that outranks the pin
  const JUMP_OLD = "ctJumpId='';ctStick=false;";
  if ((s.split(JUMP_OLD).length - 1) !== 1) throw new Error(f + ': ctJump anchor is not unique');
  s = s.split(JUMP_OLD).join("ctJumpId='';ctStick=false;ctOpenPinStop();");
  if (!DRY) { fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p); }
  console.log('  ' + f + ': open pins to the newest message');
  wrote++;
}

/* ---- 2. mp-auth: the gear (and with it apply()) can no longer time out ---- */
{
  const p = path.join(A, 'mp-auth.js');
  let s = fs.readFileSync(p, 'utf8');
  const OLD = "  var tries = 0; (function look() { if (gear() || ++tries > 40) return; setTimeout(look, 500); })();";
  const NEW = "  /* THE CHAT IS LAZY ON MOST PAGES, so a bounded poll is a bounded product: open it a minute into\n"
    + "     reading and the gear was never inserted, which is why the stored text size read as \"reverted\" - nobody\n"
    + "     had applied it. gear() is idempotent, so watching for the box costs one call per insertion. */\n"
    + "  (function () {\n"
    + "    if (gear()) return;\n"
    + "    var mo = null, stop = function () { try { mo.disconnect(); } catch (e) {} };\n"
    + "    try { mo = new MutationObserver(function () { if (document.getElementById('chatBox') && gear()) stop(); });\n"
    + "      mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}\n"
    + "    var t = 0; (function look() { if (gear()) { stop(); return; } if (++t > 240) return; setTimeout(look, 500); })();\n"
    + "  })();";
  if (s.indexOf('THE CHAT IS LAZY ON MOST PAGES') >= 0) console.log('  mp-auth.js: already applied');
  else {
    if ((s.split(OLD).length - 1) !== 1) throw new Error('mp-auth.js: the gear poll anchor is not unique');
    s = s.split(OLD).join(NEW);
    if (!DRY) { fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p); }
    console.log('  mp-auth.js: the gear waits for the chat however late it arrives');
    wrote++;
  }
}

console.log('fix-chat-open-pin: ' + (DRY ? 'dry run, nothing written' : wrote + ' file(s) written') + '\n  NEXT: node build/bump-home-assets.js');

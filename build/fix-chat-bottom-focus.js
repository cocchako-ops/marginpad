#!/usr/bin/env node
/* THE CHAT OPENS IN THE MIDDLE, AND THE KEYBOARD DOES NOT COME UP (2026-10-22, owner: "chat kad se otvori,
   umesto da po default-u bude na dnu (poslednje poruke) on mi otvara na poruke u sredini" + "probam da kucam
   negde neki tekst, ne izlazi mi tastatura. Ni za dm-s a ni za chat").

   TWO SEPARATE FAULTS, both of them about doing the right thing at the wrong moment.

   1. THE BOTTOM MOVES AFTER WE GET THERE. The history handler scrolls to the bottom exactly once, and then the
      content grows underneath that decision: a `trade:<id>` line is REPLACED by a tall card, avatars and coin
      logos finish loading, a poll box or the squad strip is inserted ABOVE the stream and shortens it, and on a
      phone the keyboard halves the box. The scroll position stays at the pixel it was given, which by then is
      the middle. Nothing was wrong with the scroll; it was simply final while the content was not.
      So the bottom is now PINNED rather than set: while `ctStick` holds (the reader has not scrolled up), any
      change to the list - a mutation, a resize, an image finishing - re-pins it on the next frame. `ctStick` is
      the existing reading of "does the reader want the bottom", and ctJump() already clears it when it lands on
      a mentioned message, so this cannot fight the one thing that deliberately scrolls elsewhere.

   2. A PROGRAMMATIC focus() DOES NOT RAISE A KEYBOARD, AND IT POISONS THE NEXT TAP. On iOS a focus() that is not
      inside a real user gesture gives the field focus with no keyboard - and because the field is now already
      focused, the reader's tap changes nothing and the keyboard still does not come. That is the owner's
      "tapnem, ne izlazi tastatura", in the chat and in DMs, and it is the whole reason an autofocus from a
      setTimeout is worse than none at all. On a coarse pointer we simply do not focus; the reader's own tap on
      an unfocused field raises it, first time. Desktop keeps the autofocus, where it costs nothing and helps.

   MIRRORED BY HAND in home.js and mp-trade.js (the chat exists twice) plus mp-auth.js (the DM composer).
   Idempotent, --dry. Refuses rather than guessing.                                                            */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const done = [];

const R = f => path.join(__dirname, '..', 'dist', 'assets', f);
function one(h, name, a, b, skipIf) {
  if (skipIf && h.indexOf(skipIf) >= 0) return h;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1');
  done.push(name);
  return h.split(a).join(b);   // split/join, never String.replace
}

/* ---------------------------------------------------------------- the chat, in both bundles ------------- */
const PIN = [
  "  /* THE BOTTOM MOVES AFTER WE GET THERE (2026-10-22). Scrolling to the bottom once is final while the content",
  "     is not: a trade link becomes a tall card, avatars and coin logos finish loading, a poll box or the squad",
  "     strip is inserted ABOVE the stream, the keyboard halves the box. The position stays at a pixel that is by",
  "     then the middle. So PIN it: while ctStick holds, any change re-pins on the next frame. One rAF, so a burst",
  "     of mutations costs one write, and ctStick is what keeps this away from a reader who scrolled up. */",
  "  function ctPin(){ if(ctStick&&msgs) msgs.scrollTop=msgs.scrollHeight; }",
  "  (function(){",
  "    if(!msgs)return;",
  "    var q=0; function ping(){ if(q)return; q=1; requestAnimationFrame(function(){ q=0; ctPin(); }); }",
  "    try{ new MutationObserver(ping).observe(msgs,{childList:true,subtree:true,attributes:true,characterData:true}); }catch(e){}",
  "    try{ new ResizeObserver(ping).observe(msgs); }catch(e){}",
  "    msgs.addEventListener('load',ping,true);   // an <img> finishing is not a mutation - avatars, coin logos, trade cards",
  "    try{ if(window.visualViewport) window.visualViewport.addEventListener('resize',ping); }catch(e){} // the keyboard",
  "  })();",
].join('\n');

for (const f of ['home.js', 'mp-trade.js']) {
  let h = fs.readFileSync(R(f), 'utf8');
  const before = h;

  // the pin itself, right after the scroll listener that maintains ctStick
  h = one(h, f + ': the bottom is pinned, not set once',
    "  if(msgs)msgs.addEventListener('scroll',function(){if(ctBottom()){ctStick=true;if(ctNew)ctPill(0);}else ctStick=false;});",
    "  if(msgs)msgs.addEventListener('scroll',function(){if(ctBottom()){ctStick=true;if(ctNew)ctPill(0);}else ctStick=false;});\n" + PIN,
    'function ctPin(){');

  /* A PROGRAMMATIC focus() ON A TOUCH DEVICE RAISES NO KEYBOARD AND POISONS THE NEXT TAP (see the header). */
  h = one(h, f + ': no autofocus on a touch device',
    "setTimeout(function(){input.focus();},50);}",
    "/* no autofocus on a coarse pointer: a focus() outside a user gesture gives iOS the caret with NO keyboard, and the reader's own tap then changes nothing because the field is already focused. Letting them tap an UNfocused field raises it first time. */try{if(!matchMedia('(pointer:coarse)').matches)setTimeout(function(){input.focus();},50);}catch(e){setTimeout(function(){input.focus();},50);}}",
    "no autofocus on a coarse pointer");

  if (h !== before && !DRY) fs.writeFileSync(R(f), h);
}

/* ---------------------------------------------------------------- the DM composer ----------------------- */
{
  let h = fs.readFileSync(R('mp-auth.js'), 'utf8');
  const before = h;
  h = one(h, 'mp-auth: the DM composer does not steal focus on a phone',
    "if (warn) warn.innerHTML = ''; if (inp) inp.focus(); }",
    "if (warn) warn.innerHTML = ''; /* same rule as the chat: on a coarse pointer a focus() from an async callback is OUTSIDE the gesture, so iOS gives the caret and no keyboard - and the next tap is then a no-op on an already-focused field */ try { if (inp && !matchMedia('(pointer:coarse)').matches) inp.focus(); } catch (e) { if (inp) inp.focus(); } }",
    'same rule as the chat: on a coarse pointer');
  if (h !== before && !DRY) fs.writeFileSync(R('mp-auth.js'), h);
}

/* ---------------------------------------------------------------- report -------------------------------- */
if (!done.length) { console.log('fix-chat-bottom-focus: nothing to do (already applied)'); process.exit(0); }

if (!DRY) {
  for (const f of ['home.js', 'mp-trade.js']) {
    const h = fs.readFileSync(R(f), 'utf8');
    if ((h.match(/function ctPin\(\)/g) || []).length !== 1) throw new Error(f + ': ctPin is not defined exactly once');
    if (h.indexOf('new MutationObserver(ping)') < 0 || h.indexOf('new ResizeObserver(ping)') < 0) throw new Error(f + ': the pin lost one of its triggers');
    if (h.indexOf("matchMedia('(pointer:coarse)')") < 0) throw new Error(f + ': the autofocus is still unconditional');
    if (h.indexOf('ctStick&&msgs') < 0) throw new Error(f + ': the pin must respect a reader who scrolled up');
  }
  const a = fs.readFileSync(R('mp-auth.js'), 'utf8');
  if (a.indexOf("inp && !matchMedia('(pointer:coarse)').matches") < 0) throw new Error('mp-auth: the DM autofocus is still unconditional');
}

console.log('fix-chat-bottom-focus: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
console.log('  NEXT: node build/bump-home-assets.js && npm run deploy && node build/chat-bottom-e2e.js');
